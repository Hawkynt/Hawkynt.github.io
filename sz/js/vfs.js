;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /**
   * Normalize a VFS path: collapse double slashes, resolve `.` and `..`,
   * ensure leading `/`, strip trailing slash (unless root).
   */
  function _normalizePath(path) {
    if (!path || path === '/')
      return '/';

    const parts = path.replace(/\\/g, '/').split('/');
    const resolved = [];
    for (const part of parts) {
      if (part === '' || part === '.')
        continue;
      if (part === '..') {
        resolved.pop();
        continue;
      }
      resolved.push(part);
    }

    const result = '/' + resolved.join('/');
    return result || '/';
  }

  /**
   * Ensure a mount-point string ends with `/`.
   */
  function _ensureTrailingSlash(mp) {
    return mp.endsWith('/') ? mp : mp + '/';
  }

  // ── LocalStorageMount ──────────────────────────────────────────────

  class LocalStorageMount {
    #prefix;

    constructor(keyPrefix = 'sz-vfs:') {
      this.#prefix = keyPrefix;
    }

    get readonly() { return false; }

    async list(relativePath) {
      const dir = relativePath === '' || relativePath === '/'
        ? ''
        : (relativePath.endsWith('/') ? relativePath : relativePath + '/');

      const seen = new Map();

      for (let i = 0; i < localStorage.length; ++i) {
        const key = localStorage.key(i);
        if (!key.startsWith(this.#prefix))
          continue;

        const full = key.slice(this.#prefix.length);
        if (!full.startsWith(dir))
          continue;

        const remainder = full.slice(dir.length);
        if (remainder === '')
          continue;

        const slashIdx = remainder.indexOf('/');
        if (slashIdx === -1) {
          const value = localStorage.getItem(key);
          seen.set(remainder, {
            name: remainder,
            type: 'file',
            size: value ? value.length : 0,
            modified: null,
          });
        } else {
          const childDir = remainder.slice(0, slashIdx);
          if (!seen.has(childDir + '/'))
            seen.set(childDir + '/', {
              name: childDir,
              type: 'dir',
              size: 0,
              modified: null,
            });
        }
      }

      return _sortEntries([...seen.values()]);
    }

    async read(relativePath) {
      const key = this.#prefix + relativePath;
      return localStorage.getItem(key);
    }

    async write(relativePath, data) {
      const key = this.#prefix + relativePath;
      try {
        localStorage.setItem(key, data);
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22)
          throw new Error('Storage quota exceeded. Free up space or delete files before saving.');
        throw e;
      }
    }

    async delete(relativePath) {
      const exact = this.#prefix + relativePath;
      if (localStorage.getItem(exact) !== null) {
        localStorage.removeItem(exact);
        return;
      }

      const dirPrefix = this.#prefix + (relativePath.endsWith('/') ? relativePath : relativePath + '/');
      const toRemove = [];
      for (let i = 0; i < localStorage.length; ++i) {
        const key = localStorage.key(i);
        if (key.startsWith(dirPrefix))
          toRemove.push(key);
      }
      for (const key of toRemove)
        localStorage.removeItem(key);
    }

    async exists(relativePath) {
      const exact = this.#prefix + relativePath;
      if (localStorage.getItem(exact) !== null)
        return true;

      const dirPrefix = this.#prefix + (relativePath.endsWith('/') ? relativePath : relativePath + '/');
      for (let i = 0; i < localStorage.length; ++i) {
        if (localStorage.key(i).startsWith(dirPrefix))
          return true;
      }
      return false;
    }

    async mkdir(_relativePath) {
      // Directories are implicit — no-op.
    }
  }

  // ── MemoryMount ────────────────────────────────────────────────────

  class MemoryMount {
    #store = new Map();

    get readonly() { return false; }

    async list(relativePath) {
      const dir = relativePath === '' || relativePath === '/'
        ? ''
        : (relativePath.endsWith('/') ? relativePath : relativePath + '/');

      const seen = new Map();

      for (const [full, value] of this.#store) {
        if (!full.startsWith(dir))
          continue;

        const remainder = full.slice(dir.length);
        if (remainder === '')
          continue;

        const slashIdx = remainder.indexOf('/');
        if (slashIdx === -1) {
          seen.set(remainder, {
            name: remainder,
            type: 'file',
            size: typeof value === 'string' ? value.length : 0,
            modified: null,
          });
        } else {
          const childDir = remainder.slice(0, slashIdx);
          if (!seen.has(childDir + '/'))
            seen.set(childDir + '/', {
              name: childDir,
              type: 'dir',
              size: 0,
              modified: null,
            });
        }
      }

      return _sortEntries([...seen.values()]);
    }

    async read(relativePath) {
      const value = this.#store.get(relativePath);
      return value !== undefined ? value : null;
    }

    async write(relativePath, data) {
      this.#store.set(relativePath, data);
    }

    async delete(relativePath) {
      if (this.#store.has(relativePath)) {
        this.#store.delete(relativePath);
        return;
      }

      const dirPrefix = relativePath.endsWith('/') ? relativePath : relativePath + '/';
      const toRemove = [];
      for (const key of this.#store.keys()) {
        if (key.startsWith(dirPrefix))
          toRemove.push(key);
      }
      for (const key of toRemove)
        this.#store.delete(key);
    }

    async exists(relativePath) {
      if (this.#store.has(relativePath))
        return true;

      const dirPrefix = relativePath.endsWith('/') ? relativePath : relativePath + '/';
      for (const key of this.#store.keys()) {
        if (key.startsWith(dirPrefix))
          return true;
      }
      return false;
    }

    async mkdir(_relativePath) {
      // Directories are implicit — no-op.
    }
  }

  // ── ReadOnlyObjectMount ────────────────────────────────────────────

  class ReadOnlyObjectMount {
    #treeFn;

    constructor(treeFn) {
      this.#treeFn = treeFn;
    }

    get readonly() { return true; }

    /**
     * Walk the object tree to the node at the given relative path.
     * Returns `undefined` if not found.
     */
    #resolve(relativePath) {
      const tree = this.#treeFn();
      if (!tree)
        return undefined;
      if (relativePath === '' || relativePath === '/')
        return tree;

      const parts = relativePath.replace(/^\/|\/$/g, '').split('/');
      let node = tree;
      for (const part of parts) {
        if (node == null || typeof node !== 'object')
          return undefined;
        if (Array.isArray(node)) {
          const idx = parseInt(part, 10);
          if (isNaN(idx) || idx < 0 || idx >= node.length)
            return undefined;
          node = node[idx];
        } else {
          if (!(part in node))
            return undefined;
          node = node[part];
        }
      }
      return node;
    }

    async list(relativePath) {
      const node = this.#resolve(relativePath);
      if (node == null || typeof node !== 'object')
        return [];

      const entries = [];
      const keys = Array.isArray(node) ? node.map((_, i) => String(i)) : Object.keys(node);
      for (const key of keys) {
        const child = Array.isArray(node) ? node[parseInt(key, 10)] : node[key];
        const isDir = child != null && typeof child === 'object';
        entries.push({
          name: key,
          type: isDir ? 'dir' : 'file',
          size: isDir ? 0 : String(child).length,
          modified: null,
        });
      }

      return _sortEntries(entries);
    }

    async read(relativePath) {
      const node = this.#resolve(relativePath);
      if (node === undefined)
        return null;
      if (node != null && typeof node === 'object')
        return null;

      return String(node);
    }

    async write(_relativePath, _data) {
      throw new Error('Cannot write to a read-only mount.');
    }

    async delete(_relativePath) {
      throw new Error('Cannot delete from a read-only mount.');
    }

    async exists(relativePath) {
      return this.#resolve(relativePath) !== undefined;
    }

    async mkdir(_relativePath) {
      throw new Error('Cannot create directories on a read-only mount.');
    }
  }

  // ── Sorting helper ─────────────────────────────────────────────────

  function _sortEntries(entries) {
    return entries.sort((a, b) => {
      if (a.type !== b.type)
        return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  // ── VFS (central router) ──────────────────────────────────────────

  class VFS {
    #mounts = new Map();

    /**
     * Register a mount handler at the given mount point.
     * Mount points are normalized to have a trailing slash.
     */
    mount(mountPoint, handler) {
      const mp = _ensureTrailingSlash(_normalizePath(mountPoint));
      this.#mounts.set(mp, handler);
    }

    /**
     * Remove a previously registered mount.
     */
    unmount(mountPoint) {
      const mp = _ensureTrailingSlash(_normalizePath(mountPoint));
      this.#mounts.delete(mp);
    }

    /**
     * Return all registered mounts for UI display.
     */
    getMounts() {
      const result = [];
      for (const [mountPoint, handler] of this.#mounts)
        result.push({ mountPoint, readonly: !!handler.readonly });
      return result;
    }

    /**
     * Find the mount and relative path for an absolute VFS path.
     * Uses longest-prefix matching.
     */
    #resolve(path) {
      const normalized = _normalizePath(path);
      const withSlash = normalized === '/' ? '/' : normalized + '/';

      let bestMount = null;
      let bestLength = 0;

      for (const [mp, handler] of this.#mounts) {
        if ((normalized + '/').startsWith(mp) || normalized === mp.slice(0, -1)) {
          if (mp.length > bestLength) {
            bestMount = { mountPoint: mp, handler };
            bestLength = mp.length;
          }
        }
      }

      if (!bestMount)
        return null;

      let relative = normalized.slice(bestMount.mountPoint.length);
      if (relative.startsWith('/'))
        relative = relative.slice(1);

      return { handler: bestMount.handler, relative, mountPoint: bestMount.mountPoint };
    }

    async list(path) {
      const resolved = this.#resolve(path);
      if (!resolved) {
        // Root listing — show mount points as directories
        if (_normalizePath(path) === '/') {
          const entries = [];
          for (const [mp] of this.#mounts) {
            const name = mp.slice(1, -1).split('/')[0];
            if (!entries.some(e => e.name === name))
              entries.push({ name, type: 'dir', size: 0, modified: null });
          }
          return _sortEntries(entries);
        }
        return [];
      }
      return resolved.handler.list(resolved.relative);
    }

    async read(path) {
      const resolved = this.#resolve(path);
      if (!resolved)
        return null;
      return resolved.handler.read(resolved.relative);
    }

    async write(path, data) {
      const resolved = this.#resolve(path);
      if (!resolved)
        throw new Error('No mount found for path: ' + path);
      return resolved.handler.write(resolved.relative, data);
    }

    async delete(path) {
      const resolved = this.#resolve(path);
      if (!resolved)
        throw new Error('No mount found for path: ' + path);
      return resolved.handler.delete(resolved.relative);
    }

    async exists(path) {
      const resolved = this.#resolve(path);
      if (!resolved)
        return _normalizePath(path) === '/';
      return resolved.handler.exists(resolved.relative);
    }

    async mkdir(path) {
      const resolved = this.#resolve(path);
      if (!resolved)
        throw new Error('No mount found for path: ' + path);
      return resolved.handler.mkdir(resolved.relative);
    }

    /**
     * Populate initial user files if they do not already exist.
     */
    static async createDefaultUserFiles(vfs) {
      const welcomePath = '/user/documents/Welcome.txt';
      if (!await vfs.exists(welcomePath))
        await vfs.write(
          welcomePath,
          'Welcome to SynthelicZ!\n\n'
          + 'This is your personal documents folder (Eigene Dateien).\n'
          + 'You can create, edit, and save files here using Notepad.\n\n'
          + 'Files are stored in your browser\'s localStorage.'
        );

      // Ensure the desktop directory exists by writing and removing a placeholder
      // only if no files are present yet.
      const desktopPath = '/user/desktop';
      if (!await vfs.exists(desktopPath)) {
        const placeholder = desktopPath + '/.keep';
        await vfs.write(placeholder, '');
      }
    }
  }

  SZ.VFS = VFS;
  SZ.LocalStorageMount = LocalStorageMount;
  SZ.MemoryMount = MemoryMount;
  SZ.ReadOnlyObjectMount = ReadOnlyObjectMount;
})();
