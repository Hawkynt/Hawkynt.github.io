;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // =========================================================================
  // Errors
  // =========================================================================
  const ERROR_CODES = {
    InvalidPath: 'InvalidPath',
    NotFound: 'NotFound',
    AlreadyExists: 'AlreadyExists',
    NotDirectory: 'NotDirectory',
    IsDirectory: 'IsDirectory',
    WrongType: 'WrongType',
    InvalidValue: 'InvalidValue',
    PermissionDenied: 'PermissionDenied',
    DataTooLarge: 'DataTooLarge',
  };

  const SearchOption = Object.freeze({ TopOnly: 0, BreadthFirst: 1, DepthFirst: 2 });

  class VFSError extends Error {
    constructor(code, path, message) {
      super(message);
      this.code = code;
      this.path = path;
      this.name = 'VFSError';
    }
  }

  // =========================================================================
  // Path Helpers
  // =========================================================================
  function normalizePath(path) {
    if (!path || typeof path !== 'string') throw new VFSError(ERROR_CODES.InvalidPath, path, 'Path must be a non-empty string.');
    
    const parts = path.replace(/\\/g, '/').split('/');
    const resolved = [];
    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') {
        if (resolved.length === 0) {
          throw new VFSError(ERROR_CODES.InvalidPath, path, 'Path attempts to escape root.');
        }
        resolved.pop();
        continue;
      }
      resolved.push(part);
    }
    const result = '/' + resolved.join('/');
    return result || '/';
  }

  function getParentPath(path) {
    if (path === '/') return null;
    const lastSlash = path.lastIndexOf('/');
    return path.substring(0, lastSlash) || '/';
  }

  function getBaseName(path) {
    if (path === '/') return '';
    const lastSlash = path.lastIndexOf('/');
    return path.substring(lastSlash + 1);
  }

  // =========================================================================
  // Drivers (Storage Backends)
  // =========================================================================

  /**
   * Base class for a VFS driver.
   */
  class BaseDriver {
    get readonly() { return false; }
    async GetNode(relPath) { throw new Error('Not implemented'); }
    async PutNode(relPath, node) { if (this.readonly) throw new VFSError(ERROR_CODES.PermissionDenied, relPath, 'This mount is read-only.'); }
    async DeleteNode(relPath) { if (this.readonly) throw new VFSError(ERROR_CODES.PermissionDenied, relPath, 'This mount is read-only.'); }
    async ListChildren(relPath) { throw new Error('Not implemented'); }
  }

  class LocalStorageDriver extends BaseDriver {
    #prefix;
    constructor(keyPrefix = 'sz-vfs:') {
      super();
      this.#prefix = keyPrefix;
    }

    async GetNode(relPath) {
      const raw = localStorage.getItem(this.#prefix + relPath);
      return raw ? JSON.parse(raw) : null;
    }

    async PutNode(relPath, node) {
      super.PutNode(relPath);
      localStorage.setItem(this.#prefix + relPath, JSON.stringify(node));
    }
    
    async DeleteNode(relPath) {
      super.DeleteNode(relPath);
      localStorage.removeItem(this.#prefix + relPath);
    }
    
    async ListChildren(relPath) {
      const dirPrefix = (relPath === '/' || relPath === '') ? '' : relPath + '/';
      const children = new Set();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this.#prefix)) {
          const path = key.substring(this.#prefix.length);
          if (path.startsWith(dirPrefix)) {
            const name = path.substring(dirPrefix.length).split('/')[0];
            if (name) children.add(name);
          }
        }
      }
      return [...children];
    }
  }

  class ReadOnlyObjectDriver extends BaseDriver {
    #root;
    constructor(obj) {
        super();
        this.#root = obj;
    }

    get readonly() { return true; }

    async GetNode(relPath) {
        if (relPath === '') return { k: 'dir', meta: {} };
        const parts = relPath.split('/');
        let current = this.#root;
        for (const part of parts) {
            if (typeof current !== 'object' || current === null || !current.hasOwnProperty(part)) {
                return null;
            }
            current = current[part];
        }
        
        // This is a simplified GetNode. It doesn't distinguish node kinds from the object.
        // It assumes all non-object properties are files (values).
        if (typeof current === 'object' && current !== null) {
            return { k: 'dir', meta: {} };
        } else {
            return { k: 'value', v: current, meta: {} };
        }
    }

    async ListChildren(relPath) {
        if (relPath === '') return Object.keys(this.#root);
        const parts = relPath.split('/');
        let current = this.#root;
        for (const part of parts) {
            if (typeof current !== 'object' || current === null || !current.hasOwnProperty(part)) {
                return [];
            }
            current = current[part];
        }

        if (typeof current === 'object' && current !== null) {
            return Object.keys(current);
        }
        return [];
    }
  }

  // =========================================================================
  // File System Access API Driver
  // =========================================================================
  class FileSystemAccessDriver extends BaseDriver {
    #root;
    constructor(directoryHandle) {
      super();
      this.#root = directoryHandle;
    }

    async #walkPath(relPath) {
      if (!relPath || relPath === '') return { handle: this.#root, kind: 'directory' };
      const segments = relPath.split('/');
      let current = this.#root;
      for (let i = 0; i < segments.length; ++i) {
        const seg = segments[i];
        const isLast = i === segments.length - 1;
        if (!isLast) {
          current = await current.getDirectoryHandle(seg);
          continue;
        }
        // Last segment: try directory first, then file
        try {
          const dir = await current.getDirectoryHandle(seg);
          return { handle: dir, kind: 'directory' };
        } catch {
          const file = await current.getFileHandle(seg);
          return { handle: file, kind: 'file' };
        }
      }
      return { handle: current, kind: 'directory' };
    }

    async GetNode(relPath) {
      if (!relPath || relPath === '') return { k: 'dir', meta: {} };
      try {
        const { handle, kind } = await this.#walkPath(relPath);
        if (kind === 'directory')
          return { k: 'dir', meta: {} };
        const file = await handle.getFile();
        return {
          k: 'bytes',
          c: { t: 'fsaa', handle },
          meta: { size: file.size, mtime: file.lastModified, contentType: file.type || 'application/octet-stream' },
        };
      } catch {
        return null;
      }
    }

    async PutNode(relPath, node) {
      const segments = relPath.split('/');
      const name = segments.pop();
      let parent = this.#root;
      for (const seg of segments)
        parent = await parent.getDirectoryHandle(seg, { create: false });

      if (node.k === 'dir') {
        await parent.getDirectoryHandle(name, { create: true });
        return;
      }
      const fh = await parent.getFileHandle(name, { create: true });
      const writable = await fh.createWritable();
      if (node.k === 'bytes' && node.c?.t === 'inline') {
        const binary = atob(node.c.b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; ++i)
          bytes[i] = binary.charCodeAt(i);
        await writable.write(bytes);
      } else if (node.k === 'bytes' && node.c?.t === 'fsaa') {
        const file = await node.c.handle.getFile();
        await writable.write(await file.arrayBuffer());
      } else if (node.k === 'value') {
        await writable.write(JSON.stringify(node.v));
      } else if (node.k === 'uri') {
        await writable.write(node.u);
      }
      await writable.close();
    }

    async DeleteNode(relPath) {
      const segments = relPath.split('/');
      const name = segments.pop();
      let parent = this.#root;
      for (const seg of segments)
        parent = await parent.getDirectoryHandle(seg, { create: false });
      await parent.removeEntry(name, { recursive: true });
    }

    async ListChildren(relPath) {
      let dir;
      if (!relPath || relPath === '')
        dir = this.#root;
      else {
        const { handle, kind } = await this.#walkPath(relPath);
        if (kind !== 'directory') return [];
        dir = handle;
      }
      const names = [];
      for await (const name of dir.keys())
        names.push(name);
      return names;
    }
  }

  // =========================================================================
  // MountStore — IndexedDB persistence for FileSystemDirectoryHandles
  // =========================================================================
  const MountStore = {
    _dbPromise: null,
    _open() {
      if (this._dbPromise) return this._dbPromise;
      this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('sz-mounts', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('mounts'))
            db.createObjectStore('mounts', { keyPath: 'name' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._dbPromise;
    },
    async getAll() {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('mounts', 'readonly');
        const store = tx.objectStore('mounts');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
    async put(name, handle) {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('mounts', 'readwrite');
        const store = tx.objectStore('mounts');
        const req = store.put({ name, handle });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async remove(name) {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('mounts', 'readwrite');
        const store = tx.objectStore('mounts');
        const req = store.delete(name);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
  };

  // =========================================================================
  // Kernel
  // =========================================================================
  class Kernel {
    #mounts = new Map();

    constructor() {
      // Default root mount
      this.mount('/', new LocalStorageDriver('sz-vfs-root:'));
    }

    mount(prefix, driver) {
      const normPrefix = normalizePath(prefix);
      this.#mounts.set(normPrefix, driver);
    }

    unmount(prefix) {
      this.#mounts.delete(normalizePath(prefix));
    }

    listMounts() {
      const result = [];
      for (const [prefix, driver] of this.#mounts)
        result.push({ prefix, readonly: driver.readonly, isLocal: driver instanceof FileSystemAccessDriver });
      return result;
    }

    #resolve(path) {
      const normPath = normalizePath(path);
      let bestMountPrefix = '';
      for (const prefix of this.#mounts.keys()) {
        if (normPath.startsWith(prefix) && prefix.length > bestMountPrefix.length) {
          bestMountPrefix = prefix;
        }
      }
      const driver = this.#mounts.get(bestMountPrefix);
      const relPath = normPath.substring(bestMountPrefix.length).replace(/^\//, '');
      return { driver, relPath, normPath };
    }

    async #getNode(path) {
      const { driver, relPath, normPath } = this.#resolve(path);
      // The root or a mount point itself is always a directory.
      if (normPath === '/' || (this.#mounts.has(normPath) && relPath === ''))
        return { k: 'dir', meta: {} };
      // Intermediate mount prefix (e.g. /mount when /mount/foo is mounted)
      const prefix = normPath + '/';
      for (const mp of this.#mounts.keys())
        if (mp.startsWith(prefix))
          return { k: 'dir', meta: {} };
      const node = await driver.GetNode(relPath);
      if (!node) throw new VFSError(ERROR_CODES.NotFound, normPath, 'Path not found.');
      return node;
    }
    
    async #putNode(path, node) {
      const { driver, relPath } = this.#resolve(path);
      const parentPath = getParentPath(path);
      if (parentPath) {
        try {
          const parentNode = await this.#getNode(parentPath);
          if (parentNode.k !== 'dir') {
            throw new VFSError(ERROR_CODES.NotDirectory, parentPath, 'Parent path is not a directory.');
          }
        } catch (e) {
          if (e.code === ERROR_CODES.NotFound) {
             throw new VFSError(ERROR_CODES.NotFound, parentPath, 'Parent directory does not exist.');
          }
          throw e;
        }
      }
      await driver.PutNode(relPath, node);
    }

    // --- Core API ---
    async Stat(path) {
      const { meta, k } = await this.#getNode(path);
      return { ...meta, kind: k };
    }

    async List(path, searchOption = 0) {
      const { driver, relPath, normPath } = this.#resolve(path);
      const node = await this.#getNode(path);
      if (node.k !== 'dir') throw new VFSError(ERROR_CODES.NotDirectory, normPath, 'Path is not a directory.');
      const children = await driver.ListChildren(relPath);
      // Include direct child mount points not already in the list
      const childPrefix = normPath === '/' ? '/' : normPath + '/';
      for (const mountPrefix of this.#mounts.keys()) {
        if (mountPrefix === normPath) continue;
        if (mountPrefix.startsWith(childPrefix)) {
          const rest = mountPrefix.substring(childPrefix.length);
          const directChild = rest.split('/')[0];
          if (directChild && !children.includes(directChild))
            children.push(directChild);
        }
      }

      if (!searchOption || searchOption === SearchOption.TopOnly)
        return children;

      // Recursive walk — BFS or DFS
      const results = [];
      if (searchOption === SearchOption.BreadthFirst) {
        const queue = children.map(name => ({ prefix: '', name }));
        while (queue.length) {
          const { prefix, name } = queue.shift();
          const rel = prefix ? prefix + '/' + name : name;
          results.push(rel);
          const fullPath = normPath === '/' ? '/' + rel : normPath + '/' + rel;
          try {
            const childNode = await this.#getNode(fullPath);
            if (childNode.k === 'dir') {
              const subChildren = await this.List(fullPath);
              for (const sub of subChildren)
                queue.push({ prefix: rel, name: sub });
            }
          } catch { /* skip inaccessible */ }
        }
      } else {
        // DepthFirst
        const stack = children.slice().reverse().map(name => ({ prefix: '', name }));
        while (stack.length) {
          const { prefix, name } = stack.pop();
          const rel = prefix ? prefix + '/' + name : name;
          results.push(rel);
          const fullPath = normPath === '/' ? '/' + rel : normPath + '/' + rel;
          try {
            const childNode = await this.#getNode(fullPath);
            if (childNode.k === 'dir') {
              const subChildren = await this.List(fullPath);
              for (let i = subChildren.length - 1; i >= 0; --i)
                stack.push({ prefix: rel, name: subChildren[i] });
            }
          } catch { /* skip inaccessible */ }
        }
      }
      return results;
    }

    async Mkdir(path) {
      const normPath = normalizePath(path);
      await this.#putNode(normPath, { k: 'dir', meta: { mtime: Date.now() } });
    }

    async Delete(path) {
        const { driver, relPath, normPath } = this.#resolve(path);
        const node = await this.#getNode(normPath);
        if (node.k === 'dir') {
            const children = await this.List(normPath);
            if (children.length > 0) {
                throw new VFSError(ERROR_CODES.Conflict, normPath, 'Directory is not empty.');
            }
        }
        await driver.DeleteNode(relPath);
    }
    
    async Move(from, to) {
      const normFrom = normalizePath(from);
      const normTo = normalizePath(to);
      const node = await this.#getNode(normFrom);
      if (node.k === 'dir')
        throw new VFSError(ERROR_CODES.Unsupported, normFrom, 'Moving directories is not supported.');
      await this.#putNode(normTo, node);
      const { driver, relPath } = this.#resolve(normFrom);
      await driver.DeleteNode(relPath);
    }

    // --- Typed Writes ---
    async WriteAllBytes(path, bytes, meta = {}) {
      const b64 = btoa(String.fromCharCode.apply(null, bytes));
      await this.#putNode(path, { k: 'bytes', c: { t: 'inline', b64 }, meta: { ...meta, mtime: Date.now(), size: bytes.length } });
    }
    
    async WriteValue(path, value, meta = {}) {
      // Basic JSON-serializable check
      try {
        JSON.stringify(value);
      } catch (e) {
        throw new VFSError(ERROR_CODES.InvalidValue, path, 'Value is not JSON-serializable.');
      }
      await this.#putNode(path, { k: 'value', v: value, meta: { ...meta, mtime: Date.now() } });
    }

    async WriteUri(path, uri, meta = {}) {
      await this.#putNode(path, { k: 'uri', u: uri, meta: { ...meta, mtime: Date.now() } });
    }
    
    // --- Typed Reads ---
    async ReadAllBytes(path) {
        const node = await this.#getNode(path);
        switch (node.k) {
            case 'bytes':
                if (node.c.t === 'inline') {
                    const binary = atob(node.c.b64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; ++i)
                        bytes[i] = binary.charCodeAt(i);
                    return bytes;
                }
                if (node.c.t === 'fsaa') {
                    const file = await node.c.handle.getFile();
                    return new Uint8Array(await file.arrayBuffer());
                }
                throw new VFSError(ERROR_CODES.Unsupported, path, 'Unsupported byte content reference type.');
            case 'value':
                return new TextEncoder().encode(JSON.stringify(node.v));
            case 'uri': {
                const resp = await fetch(node.u);
                if (!resp.ok)
                    throw new VFSError(ERROR_CODES.NotFound, path, `Fetch failed: ${resp.status} ${resp.statusText}`);
                return new Uint8Array(await resp.arrayBuffer());
            }
            case 'dir':
                throw new VFSError(ERROR_CODES.IsDirectory, path, 'Cannot read directory as bytes.');
            default:
                throw new VFSError(ERROR_CODES.WrongType, path, `Cannot read '${node.k}' as bytes.`);
        }
    }

    async ReadValue(path) {
      const node = await this.#getNode(path);
      if (node.k !== 'value') throw new VFSError(ERROR_CODES.WrongType, path, 'Node is not a value.');
      return JSON.parse(JSON.stringify(node.v)); // Structured clone
    }

    async ReadUri(path) {
        const node = await this.#getNode(path);
        switch (node.k) {
            case 'uri':
                return node.u;
            case 'bytes': {
                // Fast path: FSAA files — create blob URL directly, avoids base64
                if (node.c?.t === 'fsaa') {
                    const file = await node.c.handle.getFile();
                    return URL.createObjectURL(file);
                }
                const bytes = await this.ReadAllBytes(path);
                const mime = node.meta?.contentType || 'application/octet-stream';
                return URL.createObjectURL(new Blob([bytes], { type: mime }));
            }
            case 'value': {
                 const json = JSON.stringify(node.v);
                 const jsonBytes = new TextEncoder().encode(json);
                 return URL.createObjectURL(new Blob([jsonBytes], { type: 'application/json' }));
            }
            default:
                throw new VFSError(ERROR_CODES.WrongType, path, `Cannot read '${node.k}' as URI.`);
        }
    }

    async ReadAllText(path) {
      const node = await this.#getNode(path);
      if (node.k === 'value') return JSON.stringify(node.v);
      if (node.k === 'uri') return node.u;
      if (node.k === 'dir') throw new VFSError(ERROR_CODES.IsDirectory, path, 'Cannot read directory as text.');
      const bytes = await this.ReadAllBytes(path);
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
  
  SZ.VFS = {
    Kernel,
    LocalStorageDriver,
    ReadOnlyObjectDriver,
    FileSystemAccessDriver,
    MountStore,
    VFSError,
    ERROR_CODES,
    SearchOption,
  };

})();
