;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  async function boot() {
    const bootEl = document.getElementById('sz-boot-screen');
    const bootScreen = new SZ.BootScreen(bootEl);
    await bootScreen.show();
    bootScreen.setProgress(5, 'Initializing...');
    const settings = new SZ.Settings();

    // -- Virtual File System --
    bootScreen.setProgress(10, 'Initializing VFS...');
    const kernel = new SZ.VFS.Kernel();
    kernel.mount('/user', new SZ.VFS.LocalStorageDriver('sz-vfs-user:'));
    try {
      await kernel.Mkdir('/system');
      await kernel.Mkdir('/system/wallpapers');
      await kernel.Mkdir('/user/desktop');
      await kernel.Mkdir('/user/documents');
      await kernel.Mkdir('/user/pictures');
      await kernel.WriteUri('/system/wallpapers/bliss.svg', 'assets/backgrounds/bliss.svg');
      await kernel.WriteUri('/system/wallpapers/default.jpg', 'assets/backgrounds/default.jpg');
    } catch (e) {
      // Non-critical if they already exist
    }

    // -- Skin Engine --
    bootScreen.setProgress(15, 'Loading skin...');
    let {skin: currentSkin, name: currentSkinName, subSkin: currentSubSkinId} = await loadSkin(settings);
    bootScreen.setProgress(25, 'Pre-loading skin images...');
    await preloadSkinImages(currentSkin, (p) => bootScreen.setProgress(25 + p * 35, 'Pre-loading...'));
    let skinCSSResult = await SZ.generateSkinCSS(currentSkin);
    const themeEngine = new SZ.ThemeEngine();
    await themeEngine.generateFromSkin(currentSkin);
    applyRootTheme(currentSkin);

    // -- UI and Managers --
    const commonDialogs = new SZ.CommonDialogs(kernel);
    document.documentElement.classList.toggle('sz-animations-off', settings.get('animations') === false);
    
    const desktopEl = document.getElementById('sz-desktop');
    const desktop = new SZ.Desktop(desktopEl);
    await setInitialBackground(kernel, desktop, settings);

    const windowManager = new SZ.WindowManager(document.getElementById('sz-window-area'));
    await windowManager.setSkin(currentSkin);
    SZ.setupPointerHandlers(document.getElementById('sz-window-area'), windowManager);

    const taskbar = new SZ.Taskbar(document.getElementById('sz-taskbar'), windowManager);
    taskbar.applySkin(currentSkin);
    taskbar.applyStartButtonImage(skinCSSResult?.startButtonImage || currentSkin.startButton?.image, currentSkin.personality);
    
    const appLauncher = new SZ.AppLauncher(windowManager, themeEngine, desktop);
    await appLauncher.loadManifest(SZ.manifest);

    // Wire WindowManager lifecycle callbacks to Taskbar + AppLauncher
    windowManager.onWindowCreated = (win) => taskbar.addWindow(win.id, win.title, win.icon);
    windowManager.onWindowClosed = (win) => {
      taskbar.removeWindow(win.id);
      appLauncher.onWindowClosed(win.id);
    };
    windowManager.onWindowFocused = (win) => taskbar.setActive(win?.id);
    windowManager.onWindowTitleChanged = (win) => taskbar.updateTitle(win.id, win.title);

    const fileSystem = new SZ.FileSystem(); // For shell icons
    populateFileSystem(fileSystem, appLauncher);
    createDesktopIcons(fileSystem, appLauncher, desktop, kernel, settings, taskbar);
    
    const mru = settings.get('mru') || [];
    taskbar.populateStartMenu(
      fileSystem.startMenu.getItems(),
      (id, params) => {
          recordMRU(id, settings);
          appLauncher.launch(id, params);
          taskbar.refreshMRU(settings, appLauncher);
      },
      { mru, categories: fileSystem.programs, appLauncher }
    );
    
    const cursorEffects = new SZ.CursorEffects(desktopEl);
    cursorEffects.applySettings(settings);
    SZ.contextMenu = new SZ.ContextMenu(desktopEl, windowManager, appLauncher, kernel);
    
    const skinState = { skin: currentSkin, name: currentSkinName, subSkinId: currentSubSkinId, cssResult: skinCSSResult };
    setupPostMessageBridge({kernel, windowManager, themeEngine, desktop, settings, appLauncher, commonDialogs, taskbar, cursorEffects, skinState});

    SZ.system = Object.freeze({
      windowManager, desktop, taskbar, themeEngine, settings, appLauncher, kernel, commonDialogs, cursorEffects,
      get skin() { return skinState.skin; },
    });

    bootScreen.setProgress(100, 'Ready');
    desktopEl.style.visibility = '';
    document.getElementById('sz-taskbar').style.visibility = '';
    await bootScreen.hide();
    bootScreen.destroy();
    console.log('[SZ] Desktop ready');
  }

  function setupPostMessageBridge(context) {
    const {kernel, windowManager, themeEngine, desktop, settings, appLauncher, commonDialogs, taskbar, cursorEffects, skinState} = context;

    window.addEventListener('message', (e) => {
      const { data } = e;
      if (!data?.type?.startsWith('sz:')) return;

      const { type, requestId, path } = data;
      const win = windowManager.getWindowByIframe(e.source);

      const respond = (responseType, payload) => e.source?.postMessage({ type: responseType, requestId, path, ...payload }, '*');
      const handle = (p, type) => p.then(res => respond(type, res)).catch(err => respond(type, { error: { message: err.message, code: err.code } }));

      switch (type) {
        // Window management
        case 'sz:getTheme': return respond('sz:themeCSS', { css: themeEngine.styleText });
        case 'sz:setTitle': if (win) { win.setTitle(data.title); taskbar.updateTitle(win.id, data.title); } return;
        case 'sz:close': if (win) windowManager.closeWindow(win.id); return;
        case 'sz:resize': if (win) win.resizeContentTo(data.width, data.height); return;
        case 'sz:closeWindow': if (data.windowId) windowManager.closeWindow(data.windowId); return;
        case 'sz:getWindows':
            return respond('sz:getWindowsResult', {
              windows: windowManager.allWindows.map(w => ({ id: w.id, title: w.title, state: w.state }))
            });
        case 'sz:launchApp':
            recordMRU(data.appId, settings);
            appLauncher.launch(data.appId, data.urlParams);
            taskbar.refreshMRU(settings, appLauncher);
            return;

        // Settings
        case 'sz:setBackground':
            if (data.src) {
                kernel.ReadUri(data.src).then(uri => {
                    desktop.setBackground(uri, data.mode || 'cover');
                    settings.set('background', { src: data.src, mode: data.mode || 'cover' });
                });
            }
            return;
        case 'sz:getSettings':
            return handle(
                Promise.all([kernel.List('/system/wallpapers').catch(()=>[]), kernel.List('/user/pictures').catch(()=>[])])
                .then(([sys, usr]) => ({
                    skin: skinState.name,
                    subSkin: skinState.subSkinId,
                    background: settings.get('background'),
                    animations: settings.get('animations'),
                    cursor: {
                      shadow: settings.get('cursor.shadow'),
                      trail: settings.get('cursor.trail'),
                      trailLen: settings.get('cursor.trailLen') || 5,
                    },
                    availableSkins: SZ.getAvailableSkins().map(name => {
                        const s = SZ.getSkin(name);
                        return {
                            id: name,
                            displayName: s?.name || name,
                            colors: s?.colors || {},
                            fonts: s?.fonts || null,
                            subSkins: s?.subSkins || [],
                        };
                    }),
                    availableBackgrounds: [
                        ...sys.map(name => ({ name: name.split('.')[0], src: `/system/wallpapers/${name}` })),
                        ...usr.map(name => ({ name: name.split('.')[0], src: `/user/pictures/${name}` }))
                    ],
                })), 'sz:getSettingsResult'
            );
        case 'sz:setSkin': {
            const skinName = data.skinName;
            const subSkinId = data.subSkin || '';
            let skin = SZ.getSkin(skinName);
            if (!skin) return;
            if (subSkinId)
              skin = SZ.resolveSkin(skin, subSkinId);
            skinState.skin = skin;
            skinState.name = skinName;
            skinState.subSkinId = subSkinId;
            settings.set('skin', skinName);
            settings.set('subSkin', subSkinId);
            (async () => {
              skinState.cssResult = await SZ.generateSkinCSS(skin);
              await themeEngine.generateFromSkin(skin);
              applyRootTheme(skin);
              await windowManager.setSkin(skin);
              taskbar.applySkin(skin);
              taskbar.applyStartButtonImage(skinState.cssResult?.startButtonImage || skin.startButton?.image, skin.personality);
            })();
            return;
        }
        case 'sz:animationSetting':
            settings.set('animations', data.value);
            document.documentElement.classList.toggle('sz-animations-off', !data.value);
            return;
        case 'sz:cursorSetting':
            if (data.key === 'shadow') {
              settings.set('cursor.shadow', data.value);
              cursorEffects.setShadowEnabled(data.value);
            } else if (data.key === 'trail') {
              settings.set('cursor.trail', data.value);
              cursorEffects.setTrailEnabled(data.value);
            } else if (data.key === 'trailLen') {
              settings.set('cursor.trailLen', data.value);
              cursorEffects.setTrailLength(data.value);
            }
            return;
        case 'sz:clearMRU':
            settings.set('mru', []);
            taskbar.refreshMRU(settings, appLauncher);
            return;
        case 'sz:taskbarSetting':
            // Forward taskbar settings
            if (data.key === 'showClock')
              taskbar.setShowClock?.(data.value);
            else if (data.key === 'autoHide')
              taskbar.setAutoHide?.(data.value);
            else if (data.key === 'smallIcons')
              taskbar.setSmallIcons?.(data.value);
            return;
        case 'sz:shellExecute':
            if(data.path) openFileByPath(data.path, kernel, appLauncher);
            return;

        // Common Dialogs
        case 'sz:fileOpen': return handle(commonDialogs.showOpen(data), 'sz:fileOpenResult');
        case 'sz:fileSave': return handle(commonDialogs.showSave(data), 'sz:fileSaveResult');

        // VFS Bridge
        case 'sz:vfs:Stat': return handle(kernel.Stat(path).then(stat=>({stat})), 'sz:vfs:StatResult');
        case 'sz:vfs:List': return handle(kernel.List(path).then(entries=>({entries})), 'sz:vfs:ListResult');
        case 'sz:vfs:Mkdir': return handle(kernel.Mkdir(path).then(()=>({success:true})), 'sz:vfs:MkdirResult');
        case 'sz:vfs:Delete': return handle(kernel.Delete(path).then(()=>({success:true})), 'sz:vfs:DeleteResult');
        case 'sz:vfs:Move': return handle(kernel.Move(data.from, data.to).then(()=>({success:true})), 'sz:vfs:MoveResult');
        case 'sz:vfs:WriteAllBytes': return handle(kernel.WriteAllBytes(path, new Uint8Array(data.bytes), data.meta).then(()=>({success:true})), 'sz:vfs:WriteAllBytesResult');
        case 'sz:vfs:ReadAllText': return handle(kernel.ReadAllText(path).then(text=>({text})), 'sz:vfs:ReadAllTextResult');
        case 'sz:vfs:ReadUri': return handle(kernel.ReadUri(path).then(uri=>({uri})), 'sz:vfs:ReadUriResult');
        case 'sz:vfs:ReadAllBytes': return handle(kernel.ReadAllBytes(path).then(bytes=>({bytes: Array.from(bytes)})), 'sz:vfs:ReadAllBytesResult');
        case 'sz:vfs:ReadValue': return handle(kernel.ReadValue(path).then(value=>({value})), 'sz:vfs:ReadValueResult');
        case 'sz:vfs:WriteValue': return handle(kernel.WriteValue(path, data.value, data.meta).then(()=>({success:true})), 'sz:vfs:WriteValueResult');
        case 'sz:vfs:WriteUri': return handle(kernel.WriteUri(path, data.uri, data.meta).then(()=>({success:true})), 'sz:vfs:WriteUriResult');
        case 'sz:vfs:Copy': return handle(kernel.ReadAllBytes(data.from).then(bytes => kernel.WriteAllBytes(data.to, bytes)).then(()=>({success:true})), 'sz:vfs:CopyResult');

        // MessageBox
        case 'sz:messageBox': {
            const mbType = (data.flags || 0) & 0x0F;
            const prompt = (data.caption ? data.caption + '\n\n' : '') + (data.text || '');
            let result;
            if (mbType === 4 || mbType === 3) // MB_YESNO, MB_YESNOCANCEL
              result = confirm(prompt) ? 6 : 7; // IDYES : IDNO
            else if (mbType === 1) // MB_OKCANCEL
              result = confirm(prompt) ? 1 : 2; // IDOK : IDCANCEL
            else {
              alert(prompt);
              result = 1; // IDOK
            }
            return respond('sz:messageBoxResult', { result });
        }

        // System metrics
        case 'sz:getSystemMetrics': {
            const tb = document.getElementById('sz-taskbar');
            return respond('sz:getSystemMetricsResult', {
              metrics: {
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                workAreaWidth: window.innerWidth,
                workAreaHeight: window.innerHeight - (tb?.offsetHeight || 40),
                captionHeight: 30,
                taskbarHeight: tb?.offsetHeight || 40,
              }
            });
        }

        // Registry (settings) bridge
        case 'sz:regRead':
            return respond('sz:regReadResult', { value: settings.get(data.key) });
        case 'sz:regWrite':
            settings.set(data.key, data.value);
            return respond('sz:regWriteResult', { success: true });
      }
    });
  }

  function recordMRU(appId, settings) {
    let mru = settings.get('mru') || [];
    mru = mru.filter(e => e.appId !== appId);
    mru.unshift({ appId, timestamp: Date.now() });
    if (mru.length > 6) mru.length = 6;
    settings.set('mru', mru);
  }

  function populateFileSystem(fileSystem, appLauncher) {
      fileSystem.desktop.addSystemItem({ name: 'My Computer', icon: 'Applications/explorer/icon.svg', appId: 'explorer' });
      for (const app of SZ.manifest.applications) {
          if (!app.hidden) {
              const item = {name: app.title, icon: `Applications/${app.icon}`, appId: app.id};
              fileSystem.startMenu.addSystemItem(item);
              if (app.category) {
                const folder = fileSystem.addProgramCategory(app.category);
                folder.addSystemItem(item);
              }
          }
      }
  }
  
  function createDesktopIcons(fileSystem, appLauncher, desktop, kernel, settings, taskbar) {
      for (const item of fileSystem.desktop.getItems()) {
          const icon = new SZ.Icon({
              id: item.appId || item.name,
              title: item.name,
              iconSrc: item.icon,
              onLaunch: () => {
                if (!item.appId) return;
                recordMRU(item.appId, settings);
                appLauncher.launch(item.appId);
                taskbar.refreshMRU(settings, appLauncher);
              },
          });
          desktop.addIcon(icon);

          // Also create a file in the VFS for the explorer to see
          const vfsPath = `/user/desktop/${item.name}.lnk`;
          const vfsValue = { type: 'shortcut', appId: item.appId, icon: item.icon };
          kernel.WriteValue(vfsPath, vfsValue).catch(e => console.warn(`Failed to create VFS shortcut for ${item.name}:`, e));
      }
  }

  async function openFileByPath(path, kernel, appLauncher) {
    if (path.endsWith('.lnk')) {
        try {
            const shortcut = await kernel.ReadValue(path);
            if (shortcut && shortcut.appId)
                appLauncher.launch(shortcut.appId);
        } catch (e) {
            console.error(`Error opening shortcut ${path}:`, e);
        }
        return;
    }

    // Extract extension
    const dot = path.lastIndexOf('.');
    const ext = dot >= 0 ? path.substring(dot + 1).toLowerCase() : '';

    // Find the best matching app by fileTypes in manifest
    let bestApp = null;
    for (const [, app] of appLauncher.apps) {
        if (!app.fileTypes)
            continue;
        if (app.fileTypes.includes(ext)) {
            // Prefer specialized apps over notepad (which handles everything)
            if (!bestApp || bestApp.id === 'notepad')
                bestApp = app;
        }
    }

    appLauncher.launch(bestApp ? bestApp.id : 'notepad', { path });
  }

  async function loadSkin(settings) {
    let name = settings.get('skin') || 'LUNAX';
    let subSkin = settings.get('subSkin') || '';
    let skin = SZ.getSkin(name) || SZ.getSkin('LUNAX');
    if (subSkin) skin = SZ.resolveSkin(skin, subSkin);
    return {skin, name, subSkin};
  }
  
  async function setInitialBackground(kernel, desktop, settings) {
    const bgPref = settings.get('background');
    let path = '/system/wallpapers/default.jpg';
    let mode = 'cover';
    if (bgPref && bgPref.src) {
        path = bgPref.src;
        mode = bgPref.mode || 'cover';
    }
    try {
        const uri = await kernel.ReadUri(path);
        desktop.setBackground(uri, mode);
    } catch (err) {
        console.error("Failed to set initial background:", err);
        desktop.setBackground('assets/backgrounds/default.jpg', 'cover');
    }
  }
  
  function applyRootTheme(skin) {
    const root = document.documentElement;
    const c = skin.colors;
    const rgb = (arr) => arr ? `${arr[0]},${arr[1]},${arr[2]}` : '0,0,0';
    [...root.style].forEach(prop => prop.startsWith('--sz-color-') && root.style.removeProperty(prop));
    for (const [key, value] of Object.entries(c)) {
      root.style.setProperty(`--sz-color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, `rgb(${rgb(value)})`);
    }
  }

  function preloadSkinImages(skin, onProgress) {
    const urls = new Set();
    if (skin.personality) for (const k of ['top','left','right','bottom']) if(skin.personality[k]) urls.add(skin.personality[k]);
    if (skin.titleButtons) for (const tb of skin.titleButtons) if (tb?.image) urls.add(tb.image);
    if (urls.size === 0) return Promise.resolve();
    let loaded = 0;
    return Promise.all([...urls].map(url => new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = () => {
        if (onProgress) onProgress(++loaded / urls.size);
        resolve();
      };
      img.src = url;
    })));
  }
  
  boot().catch(err => {
      console.error('[SZ] Boot failed:', err);
      document.getElementById('sz-boot-screen').innerHTML = `<h1>Boot Failed</h1><p>${err.message}</p><pre>${err.stack}</pre>`;
  });
})();
