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
      await kernel.Mkdir('/user/downloads');
      await kernel.Mkdir('/user/music');
      await kernel.Mkdir('/user/pictures');
      await kernel.Mkdir('/user/videos');
      await kernel.WriteUri('/system/wallpapers/bliss.svg', 'assets/backgrounds/bliss.svg');
      await kernel.WriteUri('/system/wallpapers/default.jpg', 'assets/backgrounds/default.jpg');
    } catch (e) {
      // Non-critical if they already exist
    }

    // -- Restore persisted local mounts --
    try {
      const savedMounts = await SZ.VFS.MountStore.getAll();
      for (const { name, handle } of savedMounts) {
        try {
          const perm = await handle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            kernel.mount('/mount/' + name, new SZ.VFS.FileSystemAccessDriver(handle));
            console.log('[SZ] Restored mount:', name);
          }
        } catch (err) {
          console.warn('[SZ] Could not restore mount "' + name + '":', err);
        }
      }
    } catch (err) {
      console.warn('[SZ] Mount restoration skipped:', err);
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

    const windowManager = new SZ.WindowManager(document.getElementById('sz-window-area'));
    await windowManager.setSkin(currentSkin);

    // -- Snap Engine & Tab Manager --
    const snapKeys = [
      'snap.enabled', 'snap.mode', 'snap.magnetEnabled', 'snap.magnetDistance',
      'snap.magnetScreenEdges', 'snap.magnetOuterEdges', 'snap.magnetInnerEdges',
      'snap.magnetCorners', 'snap.magnetDisableFast', 'snap.magnetSpeedThreshold',
      'snap.stretchMode', 'snap.stretchVertical', 'snap.stretchHorizontal',
      'snap.stretchDiagonal', 'snap.stretchTarget', 'snap.glueEnabled',
      'snap.glueCtrlDrag', 'snap.glueCtrlResize', 'snap.tabEnabled', 'snap.tabAutoHide',
    ];
    const snapConfig = {};
    for (const key of snapKeys)
      snapConfig[key] = settings.get(key);
    const snapEngine = new SZ.SnapEngine(snapConfig);
    const tabManager = new SZ.TabManager(windowManager);
    SZ.tabManager = tabManager;

    SZ.setupPointerHandlers(document.getElementById('sz-window-area'), windowManager, snapEngine);

    const taskbar = new SZ.Taskbar(document.getElementById('sz-taskbar'), windowManager);
    taskbar.applySkin(currentSkin);
    taskbar.applyStartButtonImage(skinCSSResult?.startButtonImage || currentSkin.startButton?.image, currentSkin.personality);
    
    const appLauncher = new SZ.AppLauncher(windowManager, themeEngine, desktop);
    await appLauncher.loadManifest(SZ.manifest);

    SZ.os = { kernel, windowManager, appLauncher, taskbar, themeEngine, settings };

    // Wire WindowManager lifecycle callbacks to Taskbar + AppLauncher
    windowManager.onWindowCreated = (win) => taskbar.addWindow(win.id, win.title, win.icon);
    windowManager.onWindowClosed = (win) => {
      taskbar.removeWindow(win.id);
      const closedAppId = appLauncher.onWindowClosed(win.id);
      tabManager.onWindowClosed(win.id);
      if (closedAppId === 'about') {
        const aboutVer = SZ.appVersions?.apps?.['about'];
        if (aboutVer)
          settings.set('about.lastSeenVersion', aboutVer);
      }
    };
    windowManager.onWindowFocused = (win) => taskbar.setActive(win?.id);
    windowManager.onWindowTitleChanged = (win) => taskbar.updateTitle(win.id, win.title);

    const fileSystem = new SZ.FileSystem(); // For shell icons
    populateFileSystem(fileSystem, appLauncher);
    createDesktopIcons(fileSystem, appLauncher, desktop, kernel, settings, taskbar);
    await refreshDesktopVFS(kernel, appLauncher, desktop, settings, taskbar);
    setupDesktopDropZone(desktopEl, kernel, appLauncher, desktop, settings, taskbar);
    
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
    setupPostMessageBridge({kernel, windowManager, themeEngine, desktop, settings, appLauncher, commonDialogs, taskbar, cursorEffects, skinState, snapEngine});

    SZ.system = Object.freeze({
      windowManager, desktop, taskbar, themeEngine, settings, appLauncher, kernel, commonDialogs, cursorEffects,
      get skin() { return skinState.skin; },
    });

    // Apply saved background (must happen after SZ.system so desktop.js can access kernel)
    await setInitialBackground(kernel, desktop, settings);

    bootScreen.setProgress(100, 'Ready');
    desktopEl.style.visibility = '';
    document.getElementById('sz-taskbar').style.visibility = '';
    await bootScreen.hide();
    bootScreen.destroy();
    console.log('[SZ] Desktop ready');

    // Auto-start About app on version change
    const aboutVer = SZ.appVersions?.apps?.['about'];
    if (aboutVer && aboutVer !== settings.get('about.lastSeenVersion'))
      appLauncher.launch('about', { autostart: '1' });

    // Auto-launch app from URL parameter (standalone redirect from sz-app-bootstrap)
    const urlParams = new URLSearchParams(location.search);
    const autoApp = urlParams.get('app');
    if (autoApp) {
      const launchParams = {};
      for (const [k, v] of urlParams)
        if (k !== 'app')
          launchParams[k] = v;

      const win = await appLauncher.launch(autoApp, launchParams);
      if (win && launchParams.maximized)
        windowManager.maximizeWindow(win.id);
    }
  }

  function setupPostMessageBridge(context) {
    const {kernel, windowManager, themeEngine, desktop, settings, appLauncher, commonDialogs, taskbar, cursorEffects, skinState, snapEngine} = context;

    let _dskRefreshTimer = null;
    const _dskRefresh = () => {
      clearTimeout(_dskRefreshTimer);
      _dskRefreshTimer = setTimeout(() => refreshDesktopVFS(kernel, appLauncher, desktop, settings, taskbar), 300);
    };
    const _affectsDesktop = (p) => p && (p === '/user/desktop' || p.startsWith('/user/desktop/'));

    window.addEventListener('message', (e) => {
      const { data } = e;
      if (!data?.type?.startsWith('sz:')) return;

      const { type, requestId, path } = data;
      const win = windowManager.getWindowByIframe(e.source);

      const respond = (responseType, payload) => e.source?.postMessage({ type: responseType, requestId, path, ...payload }, '*');
      const handle = (p, type) => p.then(res => respond(type, res)).catch(err => respond(type, { error: { message: err.message, code: err.code } }));

      switch (type) {
        // Changelog
        case 'sz:getChangelog': return respond('sz:getChangelogResult', { changelog: SZ.appVersions?.changelog || '' });

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
        case 'sz:setBackground': {
            const bgSettings = _normalizeBackgroundSettings(data);
            settings.set('background', bgSettings);
            _applyBackgroundFull(kernel, desktop, bgSettings);
            return;
        }
        case 'sz:getSettings':
            return handle(
                Promise.all([kernel.List('/system/wallpapers').catch(()=>[]), kernel.List('/user/pictures').catch(()=>[])])
                .then(([sys, usr]) => ({
                    skin: skinState.name,
                    subSkin: skinState.subSkinId,
                    background: _normalizeBackgroundSettings(settings.get('background')),
                    onlineServicesAvailable: location.protocol !== 'file:',
                    animations: settings.get('animations'),
                    cursor: {
                      shadow: settings.get('cursor.shadow'),
                      trail: settings.get('cursor.trail'),
                      trailLen: settings.get('cursor.trailLen') || 5,
                    },
                    snap: {
                      enabled: settings.get('snap.enabled'),
                      mode: settings.get('snap.mode'),
                      magnetEnabled: settings.get('snap.magnetEnabled'),
                      magnetDistance: settings.get('snap.magnetDistance'),
                      magnetScreenEdges: settings.get('snap.magnetScreenEdges'),
                      magnetOuterEdges: settings.get('snap.magnetOuterEdges'),
                      magnetInnerEdges: settings.get('snap.magnetInnerEdges'),
                      magnetCorners: settings.get('snap.magnetCorners'),
                      magnetDisableFast: settings.get('snap.magnetDisableFast'),
                      magnetSpeedThreshold: settings.get('snap.magnetSpeedThreshold'),
                      stretchMode: settings.get('snap.stretchMode'),
                      stretchVertical: settings.get('snap.stretchVertical'),
                      stretchHorizontal: settings.get('snap.stretchHorizontal'),
                      stretchDiagonal: settings.get('snap.stretchDiagonal'),
                      stretchTarget: settings.get('snap.stretchTarget'),
                      glueEnabled: settings.get('snap.glueEnabled'),
                      glueCtrlDrag: settings.get('snap.glueCtrlDrag'),
                      glueCtrlResize: settings.get('snap.glueCtrlResize'),
                      tabEnabled: settings.get('snap.tabEnabled'),
                      tabAutoHide: settings.get('snap.tabAutoHide'),
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
        case 'sz:snapSetting':
            settings.set('snap.' + data.key, data.value);
            if (snapEngine)
              snapEngine.updateConfig({ ['snap.' + data.key]: data.value });
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
        case 'sz:getFileTypeAssociations': {
            const associations = {};
            for (const [, app] of appLauncher.apps) {
              if (!app.fileTypes) continue;
              for (const ext of app.fileTypes)
                if (!associations[ext] || associations[ext].appId === 'notepad')
                  associations[ext] = { appId: app.id, iconPath: app.icon };
            }
            return handle(Promise.resolve({ associations }), 'sz:getFileTypeAssociationsResult');
        }

        // Common Dialogs
        case 'sz:fileOpen': return handle(commonDialogs.showOpen(data), 'sz:fileOpenResult');
        case 'sz:fileSave': return handle(commonDialogs.showSave(data), 'sz:fileSaveResult');
        case 'sz:browseFolder': return handle(commonDialogs.showBrowseFolder(data), 'sz:browseFolderResult');

        // VFS Bridge
        case 'sz:vfs:Stat': return handle(kernel.Stat(path).then(stat=>({stat})), 'sz:vfs:StatResult');
        case 'sz:vfs:List': return handle(kernel.List(path, data.searchOption).then(entries=>({entries})), 'sz:vfs:ListResult');
        case 'sz:vfs:Mkdir': return handle(kernel.Mkdir(path).then(()=>{ if (_affectsDesktop(path)) _dskRefresh(); return {success:true}; }), 'sz:vfs:MkdirResult');
        case 'sz:vfs:Delete': return handle(kernel.Delete(path).then(()=>{ if (_affectsDesktop(path)) _dskRefresh(); return {success:true}; }), 'sz:vfs:DeleteResult');
        case 'sz:vfs:Move': return handle(kernel.Move(data.from, data.to).then(()=>{ if (_affectsDesktop(data.from) || _affectsDesktop(data.to)) _dskRefresh(); return {success:true}; }), 'sz:vfs:MoveResult');
        case 'sz:vfs:WriteAllBytes': return handle(kernel.WriteAllBytes(path, new Uint8Array(data.bytes), data.meta).then(()=>{ if (_affectsDesktop(path)) _dskRefresh(); return {success:true}; }), 'sz:vfs:WriteAllBytesResult');
        case 'sz:vfs:ReadAllText': return handle(kernel.ReadAllText(path).then(text=>({text})), 'sz:vfs:ReadAllTextResult');
        case 'sz:vfs:ReadUri': return handle(kernel.ReadUri(path).then(uri=>({uri})), 'sz:vfs:ReadUriResult');
        case 'sz:vfs:ReadAllBytes': return handle(kernel.ReadAllBytes(path).then(bytes=>({bytes: Array.from(bytes)})), 'sz:vfs:ReadAllBytesResult');
        case 'sz:vfs:ReadValue': return handle(kernel.ReadValue(path).then(value=>({value})), 'sz:vfs:ReadValueResult');
        case 'sz:vfs:WriteValue': return handle(kernel.WriteValue(path, data.value, data.meta).then(()=>{ if (_affectsDesktop(path)) _dskRefresh(); return {success:true}; }), 'sz:vfs:WriteValueResult');
        case 'sz:vfs:WriteUri': return handle(kernel.WriteUri(path, data.uri, data.meta).then(()=>{ if (_affectsDesktop(path)) _dskRefresh(); return {success:true}; }), 'sz:vfs:WriteUriResult');
        case 'sz:vfs:Copy': return handle(kernel.ReadAllBytes(data.from).then(bytes => kernel.WriteAllBytes(data.to, bytes)).then(()=>{ if (_affectsDesktop(data.to)) _dskRefresh(); return {success:true}; }), 'sz:vfs:CopyResult');
        case 'sz:desktopRefresh': _dskRefresh(); return;
        case 'sz:clipboardUpdate': window._szClipboard = data.clipboard; return;

        // Mount/unmount local directories
        case 'sz:vfs:MountLocal': {
          (async () => {
            try {
              const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
              let name = dirHandle.name.replace(/[^a-zA-Z0-9_\-. ]/g, '').toLowerCase().trim() || 'local';
              // Deduplicate
              const existing = new Set(kernel.listMounts().map(m => m.prefix));
              let candidate = name;
              let counter = 1;
              while (existing.has('/mount/' + candidate))
                candidate = name + '-' + (++counter);
              name = candidate;
              const driver = new SZ.VFS.FileSystemAccessDriver(dirHandle);
              kernel.mount('/mount/' + name, driver);
              await SZ.VFS.MountStore.put(name, dirHandle);
              respond('sz:vfs:MountLocalResult', { success: true, name, prefix: '/mount/' + name });
            } catch (err) {
              if (err.name === 'AbortError')
                return respond('sz:vfs:MountLocalResult', { cancelled: true });
              respond('sz:vfs:MountLocalResult', { error: { message: err.message, code: err.name } });
            }
          })();
          return;
        }
        case 'sz:vfs:Unmount': {
          const prefix = data.prefix;
          kernel.unmount(prefix);
          const mountName = prefix.replace(/^\/mount\//, '');
          SZ.VFS.MountStore.remove(mountName).catch(() => {});
          return respond('sz:vfs:UnmountResult', { success: true });
        }
        case 'sz:vfs:ListMounts':
          return respond('sz:vfs:ListMountsResult', { mounts: kernel.listMounts() });

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

        // EyeDropper bridge (top-level context for iframe apps)
        case 'sz:eyeDropper':
            if (!window.EyeDropper)
              return respond('sz:eyeDropperResult', { error: { message: 'EyeDropper API not supported' } });
            new EyeDropper().open()
              .then(result => respond('sz:eyeDropperResult', { sRGBHex: result.sRGBHex }))
              .catch(() => respond('sz:eyeDropperResult', { cancelled: true }));
            return;

        // Circle-sampling eyedropper (screen capture + magnifier overlay)
        case 'sz:eyeDropperCircle': {
            const diameter = data.diameter || 5;
            const radius = (diameter - 1) / 2;

            if (!navigator.mediaDevices?.getDisplayMedia) {
              respond('sz:eyeDropperCircleResult', { cancelled: true, error: 'getDisplayMedia not available' });
              return;
            }

            (async () => {
              let stream;
              try {
                stream = await navigator.mediaDevices.getDisplayMedia({
                  video: { displaySurface: 'browser' },
                  preferCurrentTab: true
                });
              } catch {
                respond('sz:eyeDropperCircleResult', { cancelled: true });
                return;
              }

              // Grab a single frame from the stream
              const video = document.createElement('video');
              video.srcObject = stream;
              video.muted = true;
              await video.play();

              // Wait for a frame to be available
              await new Promise(r => requestAnimationFrame(r));

              const captureCanvas = document.createElement('canvas');
              captureCanvas.width = video.videoWidth;
              captureCanvas.height = video.videoHeight;
              const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
              captureCtx.drawImage(video, 0, 0);

              // Stop the stream immediately
              for (const track of stream.getTracks())
                track.stop();
              video.srcObject = null;

              // Scale factors: captured image may differ from screen CSS pixels
              const scaleX = captureCanvas.width / window.innerWidth;
              const scaleY = captureCanvas.height / window.innerHeight;

              // --- Build overlay ---
              const overlay = document.createElement('div');
              Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '99998',
                cursor: 'none',
                background: 'transparent'
              });

              // Loupe canvas
              const loupeSize = Math.max(diameter * 8, 120);
              const loupeCanvas = document.createElement('canvas');
              loupeCanvas.width = loupeSize;
              loupeCanvas.height = loupeSize;
              Object.assign(loupeCanvas.style, {
                position: 'absolute',
                width: loupeSize + 'px',
                height: loupeSize + 'px',
                borderRadius: '50%',
                border: '2px solid #fff',
                boxShadow: '0 0 8px rgba(0,0,0,.5)',
                pointerEvents: 'none',
                imageRendering: 'pixelated'
              });
              overlay.appendChild(loupeCanvas);
              const loupeCtx = loupeCanvas.getContext('2d', { willReadFrequently: false });

              // Color label
              const colorLabel = document.createElement('div');
              Object.assign(colorLabel.style, {
                position: 'absolute',
                padding: '2px 6px',
                background: 'rgba(0,0,0,.75)',
                color: '#fff',
                fontSize: '11px',
                fontFamily: 'Consolas, monospace',
                borderRadius: '3px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                borderLeft: '12px solid #f00'
              });
              overlay.appendChild(colorLabel);

              document.body.appendChild(overlay);

              // --- Sampling helpers ---
              function sampleCircle(cx, cy) {
                const sx = Math.round(cx * scaleX);
                const sy = Math.round(cy * scaleY);
                const ir = Math.round(radius * Math.max(scaleX, scaleY));
                const x0 = Math.max(0, sx - ir);
                const y0 = Math.max(0, sy - ir);
                const x1 = Math.min(captureCanvas.width - 1, sx + ir);
                const y1 = Math.min(captureCanvas.height - 1, sy + ir);
                const w = x1 - x0 + 1;
                const h = y1 - y0 + 1;
                if (w <= 0 || h <= 0)
                  return [0, 0, 0];

                const imgData = captureCtx.getImageData(x0, y0, w, h);
                const px = imgData.data;
                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                const r2 = ir * ir;

                for (let dy = 0; dy < h; ++dy) {
                  for (let dx = 0; dx < w; ++dx) {
                    const ddx = (x0 + dx) - sx;
                    const ddy = (y0 + dy) - sy;
                    if (ddx * ddx + ddy * ddy <= r2) {
                      const i = (dy * w + dx) * 4;
                      rSum += px[i];
                      gSum += px[i + 1];
                      bSum += px[i + 2];
                      ++count;
                    }
                  }
                }

                if (count === 0)
                  return [0, 0, 0];
                return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
              }

              function rgbHex(r, g, b) {
                return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
              }

              let currentColor = [0, 0, 0];

              function updateLoupe(px, py) {
                // Position loupe near cursor, flip if near edges
                const margin = 20;
                let lx = px + margin;
                let ly = py + margin;
                if (lx + loupeSize + margin > window.innerWidth)
                  lx = px - loupeSize - margin;
                if (ly + loupeSize + 30 > window.innerHeight)
                  ly = py - loupeSize - margin;

                loupeCanvas.style.left = lx + 'px';
                loupeCanvas.style.top = ly + 'px';

                // Draw zoomed view centered on cursor
                const zoomPixels = diameter + 4; // show a few extra pixels around the sample
                const sx = Math.round(px * scaleX) - Math.floor(zoomPixels / 2);
                const sy = Math.round(py * scaleY) - Math.floor(zoomPixels / 2);
                const sw = zoomPixels;
                const sh = zoomPixels;

                loupeCtx.clearRect(0, 0, loupeSize, loupeSize);
                loupeCtx.imageSmoothingEnabled = false;
                loupeCtx.drawImage(captureCanvas, sx, sy, sw, sh, 0, 0, loupeSize, loupeSize);

                // Draw circle outline showing the sample area
                const pixelScale = loupeSize / zoomPixels;
                const centerOff = loupeSize / 2;
                loupeCtx.strokeStyle = 'rgba(255,255,255,.7)';
                loupeCtx.lineWidth = 1.5;
                loupeCtx.beginPath();
                loupeCtx.arc(centerOff, centerOff, radius * pixelScale, 0, Math.PI * 2);
                loupeCtx.stroke();

                // Crosshair
                loupeCtx.strokeStyle = 'rgba(255,255,255,.5)';
                loupeCtx.lineWidth = 0.5;
                loupeCtx.beginPath();
                loupeCtx.moveTo(centerOff, 0);
                loupeCtx.lineTo(centerOff, loupeSize);
                loupeCtx.moveTo(0, centerOff);
                loupeCtx.lineTo(loupeSize, centerOff);
                loupeCtx.stroke();

                // Sample color
                currentColor = sampleCircle(px, py);
                const hex = rgbHex(...currentColor);

                // Update label
                colorLabel.textContent = `${hex}  rgb(${currentColor.join(', ')})`;
                colorLabel.style.borderLeftColor = hex;
                colorLabel.style.left = lx + 'px';
                colorLabel.style.top = (ly + loupeSize + 4) + 'px';
              }

              // --- Events ---
              function onMove(e) {
                updateLoupe(e.clientX, e.clientY);
              }

              function onDown(e) {
                e.preventDefault();
                cleanup();
                const hex = rgbHex(...currentColor);
                respond('sz:eyeDropperCircleResult', { hex, r: currentColor[0], g: currentColor[1], b: currentColor[2] });
              }

              function onKeyDown(e) {
                if (e.key === 'Escape') {
                  cleanup();
                  respond('sz:eyeDropperCircleResult', { cancelled: true });
                }
              }

              function cleanup() {
                overlay.removeEventListener('pointermove', onMove);
                overlay.removeEventListener('pointerdown', onDown);
                document.removeEventListener('keydown', onKeyDown);
                overlay.remove();
              }

              overlay.addEventListener('pointermove', onMove);
              overlay.addEventListener('pointerdown', onDown);
              document.addEventListener('keydown', onKeyDown);

              // Initial position at center
              updateLoupe(window.innerWidth / 2, window.innerHeight / 2);
            })();
            return;
        }
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

  // -- Desktop ↔ VFS integration -------------------------------------------------

  const _VFS_ICON_PREFIX = 'vfs-desktop:';

  const _GENERIC_FILE_ICON = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M12 4h16l10 10v28a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#e8eaed" stroke="#5f6368" stroke-width="1.5"/><path d="M28 4v8a2 2 0 0 0 2 2h8" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg>'
  );
  const _GENERIC_FOLDER_ICON = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M4 8h14l4 4h22a2 2 0 0 1 2 2v26a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" fill="#fdd663" stroke="#f9a825" stroke-width="1"/></svg>'
  );

  function _getFileIconForExt(ext, appLauncher) {
    for (const [, app] of appLauncher.apps)
      if (app.fileTypes?.includes(ext))
        return appLauncher.resolveIconPath(app);
    return _GENERIC_FILE_ICON;
  }

  async function refreshDesktopVFS(kernel, appLauncher, desktop, settings, taskbar) {
    let entries;
    try {
      entries = await kernel.List('/user/desktop');
    } catch {
      return;
    }

    const existingVfsIds = new Set();
    for (const icon of desktop.icons)
      if (icon.id.startsWith(_VFS_ICON_PREFIX))
        existingVfsIds.add(icon.id);

    const expectedIds = new Set();
    for (const name of entries) {
      if (name.endsWith('.lnk'))
        continue;

      const id = _VFS_ICON_PREFIX + name;
      expectedIds.add(id);

      if (existingVfsIds.has(id)) {
        existingVfsIds.delete(id);
        continue;
      }

      const vfsPath = '/user/desktop/' + name;
      let iconSrc;
      try {
        const stat = await kernel.Stat(vfsPath);
        if (stat.kind === 'dir') {
          iconSrc = _GENERIC_FOLDER_ICON;
        } else {
          const dot = name.lastIndexOf('.');
          const ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : '';
          iconSrc = _getFileIconForExt(ext, appLauncher);
        }
      } catch {
        const dot = name.lastIndexOf('.');
        const ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : '';
        iconSrc = _getFileIconForExt(ext, appLauncher);
      }

      const icon = new SZ.Icon({
        id,
        title: name,
        iconSrc,
        onLaunch: () => {
          try {
            kernel.Stat(vfsPath).then(stat => {
              if (stat.kind === 'dir')
                appLauncher.launch('explorer', { path: '/user/desktop/' + name });
              else
                openFileByPath(vfsPath, kernel, appLauncher);
            });
          } catch {
            openFileByPath(vfsPath, kernel, appLauncher);
          }
        },
      });
      desktop.addIcon(icon);
    }

    // Remove icons for files that no longer exist
    for (const removedId of existingVfsIds)
      desktop.removeIcon(removedId);
  }

  function setupDesktopDropZone(desktopEl, kernel, appLauncher, desktop, settings, taskbar) {
    const iconArea = desktop.iconArea;

    desktopEl.addEventListener('dragover', (e) => {
      if (e.target.closest('.sz-window'))
        return;
      e.preventDefault();
      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
      iconArea.classList.add('sz-drop-target');
    });

    desktopEl.addEventListener('dragleave', (e) => {
      if (!desktopEl.contains(e.relatedTarget) || e.relatedTarget?.closest?.('.sz-window'))
        iconArea.classList.remove('sz-drop-target');
    });

    desktopEl.addEventListener('drop', async (e) => {
      iconArea.classList.remove('sz-drop-target');
      if (e.target.closest('.sz-window'))
        return;
      e.preventDefault();

      // 1) VFS drops from Explorer (try dataTransfer first, then shared variable for cross-iframe)
      const vfsJson = e.dataTransfer.getData('application/x-sz-vfs') || window._szDragData;
      window._szDragData = null;
      if (vfsJson) {
        try {
          const data = JSON.parse(vfsJson);
          const isCopy = e.ctrlKey;
          for (const srcPath of data.paths) {
            const name = srcPath.split('/').pop();
            const dest = '/user/desktop/' + name;
            if (srcPath === dest)
              continue;
            if (isCopy) {
              const bytes = await kernel.ReadAllBytes(srcPath);
              await kernel.WriteAllBytes(dest, bytes);
            } else
              await kernel.Move(srcPath, dest);
          }
        } catch (err) {
          console.warn('[SZ] Desktop drop (VFS) failed:', err);
        }
        await refreshDesktopVFS(kernel, appLauncher, desktop, settings, taskbar);
        return;
      }

      // 2) OS file drops
      if (e.dataTransfer.files?.length) {
        for (const file of e.dataTransfer.files) {
          try {
            const buf = await file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            await kernel.WriteAllBytes('/user/desktop/' + file.name, bytes, {
              contentType: file.type,
              size: file.size,
              mtime: file.lastModified,
            });
          } catch (err) {
            console.warn('[SZ] Desktop drop (OS file) failed:', err);
          }
        }
        await refreshDesktopVFS(kernel, appLauncher, desktop, settings, taskbar);
      }
    });
  }

  // ----------------------------------------------------------------------------------

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
  
  function _normalizeBackgroundSettings(data) {
    if (!data) return { baseColor: '#3A6EA5', pattern: null, sourceType: 'image', src: '/system/wallpapers/default.jpg', mode: 'cover' };
    // Backward compat: old format { src, mode } without sourceType
    const st = data.sourceType;
    if (st === undefined && data.src !== undefined)
      return { baseColor: data.baseColor || '#3A6EA5', pattern: data.pattern || null, sourceType: 'image', src: data.src, mode: data.mode || 'cover' };
    return {
      baseColor: data.baseColor || '#3A6EA5',
      pattern: data.pattern || null,
      sourceType: st || 'image',
      src: data.src || '',
      mode: data.mode || 'cover',
      slideshow: data.slideshow || null,
      video: data.video || null,
      online: data.online || null,
    };
  }

  async function _applyBackgroundFull(kernel, desktop, bgSettings) {
    const resolved = { ...bgSettings };
    // Resolve VFS image src to data URI
    if (resolved.sourceType === 'image' && resolved.src && resolved.src.startsWith('/')) {
      try {
        const uri = await kernel.ReadUri(resolved.src);
        resolved.src = uri;
      } catch (err) {
        console.error('Failed to resolve background src:', err);
        try { resolved.src = await kernel.ReadUri('/system/wallpapers/bliss.svg'); } catch {}
      }
    }
    if (resolved.sourceType === 'online' && resolved.online?.cachedUrl && resolved.online.cachedUrl.startsWith('/')) {
      try { resolved.online = { ...resolved.online, cachedUrl: await kernel.ReadUri(resolved.online.cachedUrl) }; } catch {}
    }
    await desktop.setBackgroundFull(resolved);
  }

  async function setInitialBackground(kernel, desktop, settings) {
    const bgPref = settings.get('background');
    const bgSettings = _normalizeBackgroundSettings(bgPref);
    try {
      await _applyBackgroundFull(kernel, desktop, bgSettings);
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
