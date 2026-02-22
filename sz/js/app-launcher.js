;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /**
   * AppLauncher — loads application manifests, creates desktop icons, and
   * launches apps either as iframe-hosted HTML pages or as directly-hosted
   * script-based classes (app.js).
   *
   * Manifest entry types:
   *   "iframe"  (default) — loads entry as an iframe src
   *   "hosted"            — loads entry as a <script> and expects it to
   *                         register SZ.Apps[appId] = { Application }
   */
  class AppLauncher {
    #windowManager;
    #themeEngine;
    #desktop;
    #apps = new Map();
    #singletons = new Map();

    constructor(windowManager, themeEngine, desktop) {
      this.#windowManager = windowManager;
      this.#themeEngine = themeEngine;
      this.#desktop = desktop;
    }

    /**
     * Load apps from an already-parsed manifest object (works on file://).
     * Falls back to fetch if no inline manifest is available (works on http).
     */
    async loadManifest(urlOrManifest) {
      let manifest;
      if (typeof urlOrManifest === 'object' && urlOrManifest.applications) {
        manifest = urlOrManifest;
      } else {
        const resp = await fetch(urlOrManifest);
        manifest = await resp.json();
      }

      for (const app of manifest.applications)
        this.#apps.set(app.id, app);
    }

    async launch(appId, urlParams) {
      const app = this.#apps.get(appId);
      if (!app) {
        console.warn(`[AppLauncher] Unknown app: "${appId}"`);
        return;
      }

      if (app.singleton && this.#singletons.has(appId)) {
        const existingId = this.#singletons.get(appId);
        const existingWin = this.#windowManager.getWindow(existingId);
        if (existingWin && existingWin.state !== 'closed') {
          this.#windowManager.focusWindow(existingId);
          return existingWin;
        }
        this.#singletons.delete(appId);
      }

      const type = app.type || 'iframe';
      let datasource;

      if (type === 'hosted') {
        datasource = await this.#createHostedDatasource(app, urlParams);
      } else {
        datasource = 'Applications/' + app.entry;
        const params = Object.assign({}, urlParams);
        const versions = SZ.appVersions;
        if (versions) {
          if (versions.apps?.[appId])
            params._szVersion = versions.apps[appId];
          if (versions.gitHash)
            params._szGitHash = versions.gitHash;
          if (versions.osVersion)
            params._szOsVersion = versions.osVersion;
        }
        const qs = new URLSearchParams(params).toString();
        if (qs) datasource += '?' + qs;
      }

      const win = this.#windowManager.createWindow({
        title: app.title,
        icon: this.resolveIconPath(app),
        appId,
        datasource,
        width: app.width || 512,
        height: app.height || 412,
        resizable: app.resizable !== false,
        minimizable: app.minimizable !== false,
        maximizable: app.maximizable !== false,
      });

      if (app.singleton)
        this.#singletons.set(appId, win.id);

      if (type === 'hosted' && datasource?.element) {
        datasource.element._szWindow = win;
        datasource.element._szAppInstance?.onAttach?.(win);
      }

      if (type !== 'hosted') {
        const iframe = win.iframe;
        if (iframe && this.#themeEngine) {
          iframe.addEventListener('load', () => {
            // Try direct injection (fast, works when same-origin)
            this.#themeEngine.injectInto(iframe);
            // Also push via postMessage (fallback for file:// cross-origin)
            try {
              iframe.contentWindow?.postMessage({
                type: 'sz:themeCSS',
                css: this.#themeEngine.styleText,
              }, '*');
            } catch (_) {}
          });
        }
      }

      return win;
    }

    getApp(id) { return this.#apps.get(id); }
    get apps() { return this.#apps; }

    onWindowClosed(windowId) {
      for (const [appId, wId] of this.#singletons) {
        if (wId === windowId) {
          this.#singletons.delete(appId);
          return appId;
        }
      }
      return null;
    }

    resolveIconPath(app) {
      return 'Applications/' + (app.icon || app.id + '/icon.png');
    }

    /**
     * Load a hosted app.js via <script> injection (works on file://).
     * The app.js must register: SZ.Apps['appId'] = { Application: class { ... } }
     */
    async #createHostedDatasource(app, urlParams) {
      const scriptPath = 'Applications/' + app.entry;

      SZ.Apps = SZ.Apps || {};

      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptPath;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${scriptPath}`));
        document.head.appendChild(script);
      });

      const AppClass = SZ.Apps[app.id]?.Application;
      if (!AppClass)
        throw new Error(`[AppLauncher] ${app.id}: app.js must register SZ.Apps['${app.id}'] = { Application }`);

      const container = document.createElement('div');
      container.className = 'sz-hosted-app';
      container.style.cssText = 'position:absolute;inset:0;overflow:auto;';

      const instance = new AppClass(container, urlParams || {});
      container._szAppInstance = instance;

      return { type: 'hosted', element: container };
    }
  }

  SZ.AppLauncher = AppLauncher;
})();
