;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  async function boot() {
    // -- Boot screen --------------------------------------------------------
    const bootEl = document.getElementById('sz-boot-screen');
    const bootScreen = new SZ.BootScreen(bootEl);
    await bootScreen.show();
    bootScreen.setProgress(5, 'Initializing...');

    const settings = new SZ.Settings();

    // -- Load skin ----------------------------------------------------------
    bootScreen.setProgress(15, 'Loading skin...');
    let currentSkinName = settings.get('skin') || 'LUNAX';
    let currentSubSkinId = settings.get('subSkin') || '';
    let currentSkin = SZ.getSkin(currentSkinName) || SZ.getSkin('LUNAX');
    if (!currentSkin) {
      console.error('[SZ] No skin found');
      return;
    }

    // Apply saved sub-skin color override
    if (currentSubSkinId)
      currentSkin = SZ.resolveSkin(currentSkin, currentSubSkinId);

    // -- Pre-load skin BMP images into browser cache ------------------------
    bootScreen.setProgress(25, 'Pre-loading skin images...');
    await preloadSkinImages(currentSkin, (pct) => {
      bootScreen.setProgress(25 + Math.round(pct * 35), 'Pre-loading skin images...');
    });

    // -- Generate skin frame CSS -------------------------------------------
    bootScreen.setProgress(62, 'Processing skin frames...');
    let skinCSSResult = await SZ.generateSkinCSS(currentSkin);

    // -- Theme engine -------------------------------------------------------
    bootScreen.setProgress(65, 'Building theme...');
    const themeEngine = new SZ.ThemeEngine();
    await themeEngine.generateFromSkin(currentSkin);
    applyRootTheme(currentSkin);

    // -- Virtual File System ------------------------------------------------
    bootScreen.setProgress(68, 'Mounting file system...');
    const vfs = new SZ.VFS();
    vfs.mount('/user/', new SZ.LocalStorageMount());
    vfs.mount('/tmp/', new SZ.MemoryMount());
    const wallpaperMount = await createWallpaperMount();
    vfs.mount('/system/', new SZ.ReadOnlyObjectMount(() => ({
      skins: Object.fromEntries(SZ.getAvailableSkins().map(n => [n, SZ.getSkin(n)?.name || n])),
      version: '2.0',
      wallpapers: wallpaperMount,
    })));
    vfs.mount('/apps/', new SZ.ReadOnlyObjectMount(() => {
      const apps = {};
      if (SZ.manifest?.applications)
        for (const app of SZ.manifest.applications)
          apps[app.id] = { title: app.title, type: app.type };
      return apps;
    }));
    await SZ.VFS.createDefaultUserFiles(vfs);

    // -- Common Dialogs -----------------------------------------------------
    bootScreen.setProgress(69, 'Setting up file dialogs...');
    const commonDialogs = new SZ.CommonDialogs(vfs);

    // -- Animations setting ---------------------------------------------------
    const animationsEnabled = settings.get('animations') !== false;
    document.documentElement.classList.toggle('sz-animations-off', !animationsEnabled);

    // -- Desktop ------------------------------------------------------------
    bootScreen.setProgress(70, 'Setting up desktop...');
    const desktopEl = document.getElementById('sz-desktop');
    const desktop = new SZ.Desktop(desktopEl);

    const bgPref = settings.get('background');
    if (bgPref)
      await desktop.setBackground(bgPref.src || bgPref, bgPref.mode || 'cover');

    // -- Window manager -----------------------------------------------------
    bootScreen.setProgress(75, 'Initializing window manager...');
    const windowArea = document.getElementById('sz-window-area');
    const windowManager = new SZ.WindowManager(windowArea);
    await windowManager.setSkin(currentSkin);

    SZ.setupPointerHandlers(windowArea, windowManager);

    // -- WM_ broadcast helper -----------------------------------------------
    function broadcastToAllApps(msg, wParam, lParam) {
      for (const win of windowManager.allWindows) {
        try {
          win.iframe?.contentWindow?.postMessage({
            type: 'sz:wm', msg, wParam: wParam ?? 0, lParam: lParam ?? 0
          }, '*');
        } catch (_) {}
      }
    }

    // -- Taskbar ------------------------------------------------------------
    bootScreen.setProgress(80, 'Building taskbar...');
    const taskbarEl = document.getElementById('sz-taskbar');
    const taskbar = new SZ.Taskbar(taskbarEl, windowManager);
    taskbar.applySkin(currentSkin);
    taskbar.applyStartButtonImage(
      skinCSSResult?.startButtonImage || currentSkin.startButton?.image,
      currentSkin.personality
    );

    // Restore taskbar settings
    if (settings.get('taskbar.autoHide'))
      taskbarEl.classList.add('sz-auto-hide');
    if (settings.get('taskbar.showClock') === false) {
      const clockEl = document.getElementById('sz-system-tray');
      if (clockEl) clockEl.style.display = 'none';
    }
    if (settings.get('taskbar.smallIcons'))
      taskbar.setSmallIcons(true);

    windowManager.onWindowCreated = (win) => taskbar.addWindow(win.id, win.title);
    windowManager.onWindowClosed = (win) => { taskbar.removeWindow(win.id); appLauncher.onWindowClosed(win.id); };
    windowManager.onWindowFocused = (win) => taskbar.setActive(win?.id);
    windowManager.onWindowTitleChanged = (win) => taskbar.updateTitle(win.id, win.title);

    // -- App launcher -------------------------------------------------------
    bootScreen.setProgress(85, 'Loading applications...');
    const appLauncher = new SZ.AppLauncher(windowManager, themeEngine, desktop);
    await appLauncher.loadManifest(SZ.manifest);

    // -- File system (shell folders) ----------------------------------------
    bootScreen.setProgress(87, 'Setting up shell folders...');
    const fileSystem = new SZ.FileSystem();

    // Desktop: only My Computer and Recycle Bin
    const explorerApp = appLauncher.getApp('explorer');
    fileSystem.desktop.addSystemItem({
      name: 'My Computer',
      icon: explorerApp ? appLauncher.resolveIconPath(explorerApp) : 'assets/icons/recycle-bin.svg',
      appId: 'explorer',
    });
    fileSystem.desktop.addSystemItem({
      name: 'Recycle Bin',
      icon: 'assets/icons/recycle-bin.svg',
      type: 'shortcut',
    });

    // Start Menu: all non-hidden apps + populate program categories
    for (const [id, app] of appLauncher.apps) {
      if (app.hidden) continue;
      const item = { name: app.title, icon: appLauncher.resolveIconPath(app), appId: id };
      fileSystem.startMenu.addSystemItem(item);
      if (app.category) {
        const folder = fileSystem.addProgramCategory(app.category);
        folder.addSystemItem(item);
      }
    }

    // Create desktop icons from FileSystem
    for (const item of fileSystem.desktop.getItems()) {
      if (item.type === 'separator')
        continue;
      const icon = new SZ.Icon({
        id: item.appId || item.name,
        title: item.name,
        iconSrc: item.icon,
        onLaunch: () => {
          if (item.appId) {
            recordMRU(item.appId);
            appLauncher.launch(item.appId);
          }
        },
      });
      desktop.addIcon(icon);
    }

    // -- MRU tracking -------------------------------------------------------
    function recordMRU(appId) {
      let mru = settings.get('mru') || [];
      mru = mru.filter(e => e.appId !== appId);
      mru.unshift({ appId, timestamp: Date.now() });
      if (mru.length > 6) mru.length = 6;
      settings.set('mru', mru);
    }

    // Populate start menu from FileSystem (with MRU + categories)
    const mru = settings.get('mru') || [];
    const launchFromMenu = (id, urlParams) => {
      recordMRU(id);
      appLauncher.launch(id, urlParams);
      taskbar.refreshMRU(settings, appLauncher);
    };
    taskbar.populateStartMenu(
      fileSystem.startMenu.getItems(),
      launchFromMenu,
      { mru, categories: fileSystem.programs, appLauncher }
    );

    // -- Cursor effects -----------------------------------------------------
    bootScreen.setProgress(88, 'Setting up cursor effects...');
    const cursorEffects = new SZ.CursorEffects(desktopEl);
    cursorEffects.applySettings(settings);

    // -- Context menu -------------------------------------------------------
    bootScreen.setProgress(89, 'Setting up context menus...');
    if (SZ.ContextMenu)
      SZ.contextMenu = new SZ.ContextMenu(desktopEl, windowManager, appLauncher);

    // -- Desktop click to deactivate ----------------------------------------
    desktopEl.addEventListener('sz:desktop-click', () => {
      windowManager.deactivateAll();
      taskbar.setActive(null);
    });

    // -- postMessage bridge -------------------------------------------------
    bootScreen.setProgress(90, 'Setting up message bridge...');
    window.addEventListener('message', (e) => {
      const data = e.data;
      if (!data || typeof data.type !== 'string' || !data.type.startsWith('sz:'))
        return;

      const win = windowManager.getWindowByIframe(e.source);

      switch (data.type) {
        case 'sz:getTheme':
          // App bootstrap requests theme CSS via postMessage (works on file://)
          if (e.source)
            e.source.postMessage({ type: 'sz:themeCSS', css: themeEngine.styleText }, '*');
          break;
        case 'sz:setTitle':
          if (win) {
            win.setTitle(data.title);
            taskbar.updateTitle(win.id, data.title);
          }
          break;
        case 'sz:close':
          if (win) windowManager.closeWindow(win.id);
          break;
        case 'sz:resize':
          if (win) win.resizeContentTo(data.width, data.height);
          break;
        case 'sz:setSkin': {
          const baseSkin = SZ.getSkin(data.skinName);
          if (!baseSkin) break;
          const subId = data.subSkin || '';
          const resolvedSkin = SZ.resolveSkin(baseSkin, subId);
          (async () => {
            await preloadSkinImages(resolvedSkin);
            skinCSSResult = await SZ.generateSkinCSS(resolvedSkin);
            applyRootTheme(resolvedSkin);
            await themeEngine.generateFromSkin(resolvedSkin);
            windowManager.updateSkinReference(resolvedSkin);
            themeEngine.updateAll(windowManager.allWindows);
            taskbar.applySkin(resolvedSkin);
            taskbar.applyStartButtonImage(
              skinCSSResult?.startButtonImage || resolvedSkin.startButton?.image,
              resolvedSkin.personality
            );
            currentSkinName = data.skinName;
            currentSubSkinId = subId;
            currentSkin = resolvedSkin;
            settings.set('skin', data.skinName);
            settings.set('subSkin', subId);
            broadcastToAllApps(0x031A, 0, 0); // WM_THEMECHANGED
          })();
          break;
        }
        case 'sz:setBackground':
          if (data.src) {
            const bgMode = data.mode || 'cover';
            desktop.setBackground(data.src, bgMode);
            settings.set('background', { src: data.src, mode: bgMode });
            broadcastToAllApps(0x001A, 'background', 0); // WM_SETTINGCHANGE
          }
          break;
        case 'sz:getSettings':
          if (e.source) {
            (async () => {
              const availableBackgrounds = (await vfs.list('/system/wallpapers')).map(entry => ({
                name: entry.name.split('.')[0],
                src: `/system/wallpapers/${entry.name}`,
              }));

              e.source.postMessage({
                type: 'sz:settings',
                requestId: data.requestId,
                skin: currentSkinName,
                subSkin: currentSubSkinId,
                availableSkins: SZ.getAvailableSkins().map(name => {
                  const s = SZ.getSkin(name);
                  return {
                    id: name,
                    displayName: s?.name || name,
                    colors: s?.colors || null,
                    fonts: s?.fonts || null,
                    subSkins: s?.subSkins || null,
                  };
                }),
                background: settings.get('background'),
                availableBackgrounds,
                animations: settings.get('animations') !== false,
                cursor: {
                  shadow: !!settings.get('cursor.shadow'),
                  trail: !!settings.get('cursor.trail'),
                  trailLen: settings.get('cursor.trailLen') || 5,
                },
              }, '*');
            })();
          }
          break;
        case 'sz:getWindows':
          if (e.source) {
            const list = windowManager.allWindows.map(w => ({
              id: w.id,
              title: w.title,
              state: w.state,
            }));
            e.source.postMessage({ type: 'sz:windowList', windows: list, requestId: data.requestId }, '*');
          }
          break;
        case 'sz:closeWindow':
          if (data.windowId)
            windowManager.closeWindow(data.windowId);
          break;
        case 'sz:launchApp':
          if (data.appId) {
            recordMRU(data.appId);
            appLauncher.launch(data.appId, data.urlParams);
            taskbar.refreshMRU(settings, appLauncher);
          }
          break;
        case 'sz:clearMRU':
          settings.set('mru', []);
          taskbar.refreshMRU(settings, appLauncher);
          break;
        case 'sz:taskbarSetting':
          if (data.key === 'showClock') {
            const clockEl = document.getElementById('sz-system-tray');
            if (clockEl) clockEl.style.display = data.value ? '' : 'none';
            settings.set('taskbar.showClock', data.value);
          } else if (data.key === 'autoHide') {
            taskbarEl.classList.toggle('sz-auto-hide', !!data.value);
            settings.set('taskbar.autoHide', data.value);
          } else if (data.key === 'smallIcons') {
            taskbar.setSmallIcons(data.value);
            settings.set('taskbar.smallIcons', data.value);
          }
          broadcastToAllApps(0x001A, data.key, 0); // WM_SETTINGCHANGE
          break;
        case 'sz:animationSetting': {
          const enabled = !!data.value;
          settings.set('animations', enabled);
          document.documentElement.classList.toggle('sz-animations-off', !enabled);
          broadcastToAllApps(0x001A, 'animations', 0); // WM_SETTINGCHANGE
          break;
        }
        case 'sz:cursorSetting':
          if (data.key === 'shadow') {
            settings.set('cursor.shadow', !!data.value);
            cursorEffects.setShadowEnabled(!!data.value);
          } else if (data.key === 'trail') {
            settings.set('cursor.trail', !!data.value);
            cursorEffects.setTrailEnabled(!!data.value);
          } else if (data.key === 'trailLen') {
            const cLen = Math.max(3, Math.min(10, data.value | 0));
            settings.set('cursor.trailLen', cLen);
            cursorEffects.setTrailLength(cLen);
          }
          broadcastToAllApps(0x001A, 'cursor.' + data.key, 0); // WM_SETTINGCHANGE
          break;
        case 'sz:browse':
          if (e.source) {
            const bPath = data.path || '/';
            if (bPath === '/vfs' || bPath.startsWith('/vfs/')) {
              const vfsPath = bPath === '/vfs' ? '/' : bPath.slice(4);
              _browseVFS(vfs, vfsPath).then(result => {
                result.requestId = data.requestId;
                e.source.postMessage(result, '*');
              });
            } else {
              const result = _browseSZ(bPath);
              // Inject VFS entry at root level
              if (bPath === '/' && result.entries)
                result.entries.push({ name: 'vfs', type: 'object', isContainer: true, childCount: 4, preview: 'Virtual File System' });
              result.requestId = data.requestId;
              e.source.postMessage(result, '*');
            }
          }
          break;

        // -- MessageBox -------------------------------------------------------
        case 'sz:messageBox':
          if (e.source)
            commonDialogs.showMessageBox(data.text, data.caption, data.flags || 0).then(result => {
              e.source.postMessage({
                type: 'sz:messageBoxResult',
                result,
                requestId: data.requestId,
              }, '*');
            });
          break;

        // -- System metrics ---------------------------------------------------
        case 'sz:getSystemMetrics':
          if (e.source) {
            const area = document.getElementById('sz-window-area');
            const tb = document.getElementById('sz-taskbar');
            e.source.postMessage({
              type: 'sz:systemMetrics',
              metrics: {
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                workAreaWidth: area?.clientWidth ?? window.innerWidth,
                workAreaHeight: area?.clientHeight ?? window.innerHeight,
                taskbarHeight: tb?.clientHeight ?? 35,
                captionHeight: 25,
              },
              requestId: data.requestId,
            }, '*');
          }
          break;

        // -- Registry (settings) read/write -----------------------------------
        case 'sz:regRead':
          if (e.source)
            e.source.postMessage({
              type: 'sz:regReadResult',
              value: settings.get(data.key),
              requestId: data.requestId,
            }, '*');
          break;

        case 'sz:regWrite':
          if (e.source) {
            settings.set(data.key, data.value);
            broadcastToAllApps(0x001A, data.key, 0); // WM_SETTINGCHANGE
            e.source.postMessage({
              type: 'sz:regWriteResult',
              success: true,
              requestId: data.requestId,
            }, '*');
          }
          break;

        // -- Shell execute (file associations) --------------------------------
        case 'sz:shellExecute': {
          const ext = data.extension?.toLowerCase();
          let targetApp = null;
          if (ext) {
            const manifest = SZ.manifest?.applications;
            if (manifest) {
              // Prefer the most specific app (fewest fileTypes) for this extension
              let bestSpecificity = Infinity;
              for (const app of manifest) {
                if (app.fileTypes?.includes(ext)) {
                  if (app.fileTypes.length < bestSpecificity) {
                    bestSpecificity = app.fileTypes.length;
                    targetApp = app.id;
                  }
                }
              }
            }
          }
          if (targetApp) {
            recordMRU(targetApp);
            appLauncher.launch(targetApp, { path: data.path });
            taskbar.refreshMRU(settings, appLauncher);
          } else if (data.path) {
            recordMRU('notepad');
            appLauncher.launch('notepad', { path: data.path });
            taskbar.refreshMRU(settings, appLauncher);
          }
          break;
        }

        // -- Common file dialogs --------------------------------------------
        case 'sz:fileOpen':
          if (e.source)
            commonDialogs.showOpen({
              filters: data.filters,
              initialDir: data.initialDir,
              multiSelect: data.multiSelect,
              title: data.title,
            }).then(result => {
              e.source.postMessage({
                type: 'sz:fileOpenResult',
                ...result,
                requestId: data.requestId,
              }, '*');
            });
          break;

        case 'sz:fileSave':
          if (e.source)
            commonDialogs.showSave({
              filters: data.filters,
              initialDir: data.initialDir,
              defaultName: data.defaultName,
              title: data.title,
            }).then(async (result) => {
              if (!result.cancelled && data.content != null)
                await vfs.write(result.path, data.content);
              e.source.postMessage({
                type: 'sz:fileSaveResult',
                ...result,
                success: !result.cancelled,
                requestId: data.requestId,
              }, '*');
            });
          break;

        // -- VFS operations ---------------------------------------------------
        case 'sz:vfs:list':
          if (e.source)
            vfs.list(data.path || '/').then(entries => {
              e.source.postMessage({ type: 'sz:vfs:listResult', entries, path: data.path, requestId: data.requestId }, '*');
            }).catch(err => {
              e.source.postMessage({ type: 'sz:vfs:listResult', entries: [], error: err.message, path: data.path, requestId: data.requestId }, '*');
            });
          break;
        case 'sz:vfs:read':
          if (e.source)
            vfs.read(data.path).then(content => {
              e.source.postMessage({ type: 'sz:vfs:readResult', content, path: data.path, requestId: data.requestId }, '*');
            }).catch(err => {
              e.source.postMessage({ type: 'sz:vfs:readResult', content: null, error: err.message, path: data.path, requestId: data.requestId }, '*');
            });
          break;
        case 'sz:vfs:write':
          if (e.source)
            vfs.write(data.path, data.data).then(() => {
              e.source.postMessage({ type: 'sz:vfs:writeResult', success: true, path: data.path, requestId: data.requestId }, '*');
            }).catch(err => {
              e.source.postMessage({ type: 'sz:vfs:writeResult', success: false, error: err.message, path: data.path, requestId: data.requestId }, '*');
            });
          break;
        case 'sz:vfs:delete':
          if (e.source)
            vfs.delete(data.path).then(() => {
              e.source.postMessage({ type: 'sz:vfs:deleteResult', success: true, path: data.path, requestId: data.requestId }, '*');
            }).catch(err => {
              e.source.postMessage({ type: 'sz:vfs:deleteResult', success: false, error: err.message, path: data.path, requestId: data.requestId }, '*');
            });
          break;
        case 'sz:vfs:exists':
          if (e.source)
            vfs.exists(data.path).then(exists => {
              e.source.postMessage({ type: 'sz:vfs:existsResult', exists, path: data.path, requestId: data.requestId }, '*');
            }).catch(err => {
              e.source.postMessage({ type: 'sz:vfs:existsResult', exists: false, error: err.message, path: data.path, requestId: data.requestId }, '*');
            });
          break;
        case 'sz:vfs:mkdir':
          if (e.source)
            vfs.mkdir(data.path).then(() => {
              e.source.postMessage({ type: 'sz:vfs:mkdirResult', success: true, path: data.path, requestId: data.requestId }, '*');
            }).catch(err => {
              e.source.postMessage({ type: 'sz:vfs:mkdirResult', success: false, error: err.message, path: data.path, requestId: data.requestId }, '*');
            });
          break;
        case 'sz:vfs:getUri':
          if (e.source)
            vfs.getUri(data.path).then(uri => {
              e.source.postMessage({ type: 'sz:vfs:getUriResult', uri, path: data.path, requestId: data.requestId }, '*');
            }).catch(err => {
              e.source.postMessage({ type: 'sz:vfs:getUriResult', uri: '', error: err.message, path: data.path, requestId: data.requestId }, '*');
            });
          break;
        case 'sz:vfs:rename':
          if (e.source)
            (async () => {
              try {
                const items = await vfs.list(data.oldPath);
                if (items && items.length > 0 && await vfs.read(data.oldPath) === null) {
                  // It's a directory — recursively move all children
                  const moveDir = async (srcDir, destDir) => {
                    await vfs.mkdir(destDir);
                    const children = await vfs.list(srcDir);
                    for (const child of children) {
                      const srcChild = srcDir.replace(/\/$/, '') + '/' + child.name;
                      const destChild = destDir.replace(/\/$/, '') + '/' + child.name;
                      if (child.type === 'dir')
                        await moveDir(srcChild, destChild);
                      else {
                        const c = await vfs.read(srcChild);
                        await vfs.write(destChild, c);
                      }
                    }
                  };
                  await moveDir(data.oldPath, data.newPath);
                  await vfs.delete(data.oldPath);
                } else {
                  // It's a file
                  const content = await vfs.read(data.oldPath);
                  await vfs.write(data.newPath, content);
                  await vfs.delete(data.oldPath);
                }
                e.source.postMessage({ type: 'sz:vfs:renameResult', success: true, oldPath: data.oldPath, newPath: data.newPath, requestId: data.requestId }, '*');
              } catch (err) {
                e.source.postMessage({ type: 'sz:vfs:renameResult', success: false, error: err.message, oldPath: data.oldPath, newPath: data.newPath, requestId: data.requestId }, '*');
              }
            })();
          break;
        case 'sz:vfs:copy':
          if (e.source)
            (async () => {
              try {
                const content = await vfs.read(data.src);
                await vfs.write(data.dest, content);
                e.source.postMessage({ type: 'sz:vfs:copyResult', success: true, src: data.src, dest: data.dest, requestId: data.requestId }, '*');
              } catch (err) {
                e.source.postMessage({ type: 'sz:vfs:copyResult', success: false, error: err.message, src: data.src, dest: data.dest, requestId: data.requestId }, '*');
              }
            })();
          break;
        case 'sz:vfs:move':
          if (e.source)
            (async () => {
              try {
                const content = await vfs.read(data.src);
                await vfs.write(data.dest, content);
                await vfs.delete(data.src);
                e.source.postMessage({ type: 'sz:vfs:moveResult', success: true, src: data.src, dest: data.dest, requestId: data.requestId }, '*');
              } catch (err) {
                e.source.postMessage({ type: 'sz:vfs:moveResult', success: false, error: err.message, src: data.src, dest: data.dest, requestId: data.requestId }, '*');
              }
            })();
          break;
      }
    });

    // -- Expose system instances for Explorer browsing -----------------------
    SZ.system = Object.freeze({
      windowManager,
      desktop,
      taskbar,
      themeEngine,
      settings,
      appLauncher,
      vfs,
      fileSystem,
      commonDialogs,
      cursorEffects,
      get skin() { return currentSkin; },
    });

    // -- Finish boot --------------------------------------------------------
    bootScreen.setProgress(100, 'Ready');

    desktopEl.style.visibility = '';
    taskbarEl.style.visibility = '';

    await bootScreen.hide();
    bootScreen.destroy();

    // -- Auto-launch app from URL parameter (?app=appId&maximized=1) ------
    const params = new URLSearchParams(location.search);
    const autoApp = params.get('app');
    if (autoApp && appLauncher.getApp(autoApp)) {
      const win = await appLauncher.launch(autoApp);
      if (params.get('maximized') === '1' && win)
        windowManager.maximizeWindow(win.id);
    }

    console.log('[SZ] Desktop ready');
  }

  async function createWallpaperMount() {
    const wallpapers = {
      'bliss.svg': 'assets/backgrounds/bliss.svg',
      'default.jpg': 'assets/backgrounds/default.jpg',
    };
    const promises = Object.entries(wallpapers).map(async ([name, path]) => {
      try {
        const resp = await fetch(path);
        if (!resp.ok) return [name, JSON.stringify({ type: 'uri', data: path })];
        const blob = await resp.blob();
        const dataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        return [name, JSON.stringify({ type: 'uri', data: dataUrl })];
      } catch {
        return [name, JSON.stringify({ type: 'uri', data: path })];
      }
    });
    return Object.fromEntries(await Promise.all(promises));
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function applyRootTheme(skin) {
    const root = document.documentElement;
    const c = skin.colors;
    const rgb = (arr) => arr ? `${arr[0]}, ${arr[1]}, ${arr[2]}` : '0,0,0';

    // Clear all old --sz-color-* properties to prevent stale values from previous skins
    for (const prop of [...root.style])
      if (prop.startsWith('--sz-color-'))
        root.style.removeProperty(prop);

    for (const [key, value] of Object.entries(c)) {
      const cssKey = '--sz-color-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(cssKey, `rgb(${rgb(value)})`);
    }
  }

  function preloadSkinImages(skin, onProgress) {
    const urls = new Set();

    const p = skin.personality;
    if (p) {
      for (const key of ['top', 'topmask', 'left', 'leftmask', 'right', 'rightmask', 'bottom', 'bottommask', 'menubar', 'menuborders', 'explorerbmp', 'dialogbmp', 'mdibmp', 'mdibmpmask'])
        if (p[key]) urls.add(p[key]);
    }

    const b = skin.buttons;
    if (b) {
      for (const key of ['checkbutton', 'checkbuttonmask', 'radiobutton', 'bitmap', 'bitmapmask'])
        if (b[key]) urls.add(b[key]);
    }

    if (skin.titleButtons)
      for (const tb of skin.titleButtons)
        if (tb?.image) urls.add(tb.image);

    if (skin.comboButton?.image) urls.add(skin.comboButton.image);
    if (skin.startButton?.image) urls.add(skin.startButton.image);

    if (urls.size === 0)
      return Promise.resolve();

    let loaded = 0;
    const total = urls.size;

    return Promise.all([...urls].map(url =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          ++loaded;
          if (onProgress)
            onProgress(loaded / total);
          resolve();
        };
        img.src = url;
      })
    ));
  }

  // -------------------------------------------------------------------------
  // Object browser for Explorer (sz:browse handler)
  // -------------------------------------------------------------------------

  const _CONTAINER_TYPES = new Set(['object', 'array', 'map', 'set', 'instance', 'class', 'element']);
  const _FUNC_NOISE = new Set(['length', 'name', 'arguments', 'caller', 'constructor']);

  function _browseSZ(path) {
    let obj = SZ;
    const segments = path.split('/').filter(Boolean);

    for (const seg of segments) {
      if (obj == null)
        return { type: 'sz:browseResult', path, nodeType: 'error', preview: 'Cannot read property of ' + String(obj), entries: [] };
      try {
        obj = (obj instanceof Map) ? obj.get(seg) : obj[seg];
      } catch (err) {
        return { type: 'sz:browseResult', path, nodeType: 'error', preview: err.message, entries: [] };
      }
    }

    return {
      type: 'sz:browseResult',
      path,
      nodeType: _classifyType(obj),
      preview: _previewValue(obj),
      entries: _getEntries(obj),
    };
  }

  function _classifyType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    const t = typeof value;
    if (t === 'boolean' || t === 'number' || t === 'string' || t === 'bigint' || t === 'symbol')
      return t;
    if (t === 'function') {
      const proto = value.prototype;
      if (proto && Object.getOwnPropertyNames(proto).length > 1)
        return 'class';
      return 'function';
    }
    if (Array.isArray(value)) return 'array';
    if (value instanceof Map) return 'map';
    if (value instanceof Set) return 'set';
    if (value instanceof RegExp) return 'regexp';
    if (value instanceof Date) return 'date';
    if (value instanceof HTMLElement) return 'element';
    if (value.constructor && value.constructor !== Object)
      return 'instance';
    return 'object';
  }

  function _previewValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    const t = typeof value;
    if (t === 'string') return value.length > 80 ? JSON.stringify(value.slice(0, 80)) + '\u2026' : JSON.stringify(value);
    if (t === 'number' || t === 'boolean' || t === 'bigint') return String(value);
    if (t === 'symbol') return value.toString();
    if (t === 'function') return (value.name || 'anonymous') + '()';
    if (Array.isArray(value)) return 'Array(' + value.length + ')';
    if (value instanceof Map) return 'Map(' + value.size + ')';
    if (value instanceof Set) return 'Set(' + value.size + ')';
    if (value instanceof RegExp) return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (value instanceof HTMLElement) return '<' + value.tagName.toLowerCase() + '>';
    const ctor = value.constructor;
    if (ctor && ctor !== Object) return ctor.name;
    const keys = Object.keys(value);
    if (keys.length <= 4) return '{' + keys.join(', ') + '}';
    return '{' + keys.slice(0, 3).join(', ') + ', \u2026}';
  }

  function _getDetail(value, type) {
    try {
      if (type === 'function' || type === 'class')
        return value.toString();
      if (type === 'string')
        return value;
      if (type === 'regexp')
        return value.toString();
      if (type === 'date')
        return value.toString() + '\n\nISO: ' + value.toISOString() + '\nTimestamp: ' + value.getTime();
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      return String(value);
    } catch (e) {
      return '[Error: ' + e.message + ']';
    }
  }

  function _describeEntry(name, value) {
    const type = _classifyType(value);
    const isContainer = _CONTAINER_TYPES.has(type);
    let childCount = 0;
    if (isContainer) {
      try {
        if (value instanceof Map) childCount = value.size;
        else if (value instanceof Set) childCount = value.size;
        else if (Array.isArray(value)) childCount = value.length;
        else childCount = Object.getOwnPropertyNames(value).length;
      } catch (_) {}
    }
    const entry = { name, type, isContainer, childCount, preview: _previewValue(value) };
    if (!isContainer)
      entry.detail = _getDetail(value, type);
    return entry;
  }

  function _getEntries(obj) {
    if (obj == null) return [];
    const t = typeof obj;
    if (t !== 'object' && t !== 'function') return [];

    const entries = [];
    const seen = new Set();

    if (obj instanceof Map) {
      for (const [key, value] of obj) {
        const name = String(key);
        seen.add(name);
        try { entries.push(_describeEntry(name, value)); }
        catch (e) { entries.push({ name, type: 'error', isContainer: false, childCount: 0, preview: e.message }); }
      }
      return entries;
    }

    if (obj instanceof Set) {
      let idx = 0;
      for (const value of obj) {
        try { entries.push(_describeEntry(String(idx), value)); }
        catch (e) { entries.push({ name: String(idx), type: 'error', isContainer: false, childCount: 0, preview: e.message }); }
        ++idx;
      }
      return entries;
    }

    const isFunc = t === 'function';

    // Own properties
    try {
      for (const key of Object.getOwnPropertyNames(obj)) {
        if (key === '__proto__') continue;
        if (isFunc && _FUNC_NOISE.has(key)) continue;
        seen.add(key);
        try { entries.push(_describeEntry(key, obj[key])); }
        catch (e) { entries.push({ name: key, type: 'error', isContainer: false, childCount: 0, preview: e.message }); }
      }
    } catch (_) {}

    // Prototype chain for class instances (show inherited methods/getters)
    if (!isFunc) {
      let proto = Object.getPrototypeOf(obj);
      while (proto && proto !== Object.prototype && proto !== Function.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (key === 'constructor' || key === '__proto__' || seen.has(key)) continue;
          seen.add(key);
          try {
            const desc = Object.getOwnPropertyDescriptor(proto, key);
            const value = desc?.get ? desc.get.call(obj) : obj[key];
            entries.push(_describeEntry(key, value));
          } catch (e) {
            entries.push({ name: key, type: 'error', isContainer: false, childCount: 0, preview: e.message });
          }
        }
        proto = Object.getPrototypeOf(proto);
      }
    }

    return entries;
  }

  // -------------------------------------------------------------------------
  // VFS browser for Explorer (sz:browse handler for /vfs/* paths)
  // -------------------------------------------------------------------------

  async function _browseVFS(vfs, path) {
    try {
      const entries = await vfs.list(path);
      if (entries.length > 0 || path === '/') {
        // Directory listing
        return {
          type: 'sz:browseResult',
          path: '/vfs' + (path === '/' ? '' : path),
          nodeType: 'object',
          preview: 'VFS: ' + path,
          entries: entries.map(e => ({
            name: e.name,
            type: e.type === 'dir' ? 'object' : 'string',
            isContainer: e.type === 'dir',
            childCount: e.type === 'dir' ? 1 : 0,
            preview: e.type === 'dir' ? 'Folder' : (e.size != null ? e.size + ' bytes' : 'File'),
          })),
        };
      }

      // Try reading as a file
      const content = await vfs.read(path);
      if (content != null)
        return {
          type: 'sz:browseResult',
          path: '/vfs' + path,
          nodeType: 'string',
          preview: content.length > 200 ? content.slice(0, 200) + '\u2026' : content,
          entries: [],
        };

      return {
        type: 'sz:browseResult',
        path: '/vfs' + path,
        nodeType: 'error',
        preview: 'Path not found: ' + path,
        entries: [],
      };
    } catch (err) {
      return {
        type: 'sz:browseResult',
        path: '/vfs' + path,
        nodeType: 'error',
        preview: err.message,
        entries: [],
      };
    }
  }

  boot().catch(err => console.error('[SZ] Boot failed:', err));
})();
