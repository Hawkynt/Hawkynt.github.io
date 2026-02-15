# Virtual In-Browser Filesystem (VFS) — Specification v1.0

## 0. Purpose

This document specifies a **virtual filesystem** for browser JavaScript apps.

* The app interacts **exclusively** through the **Kernel API**.
* Storage is provided by **mountable backends** (JS objects, JSON documents, LocalStorage, cloud, etc.).
* The filesystem stores **more than files/folders**: it stores **typed nodes**: directories, bytes, JSON-serializable values, and URIs.
* The Kernel normalizes data, performs conversions (JSON stringify, base64, fetch), and provides consistent errors and semantics.

Non-goals:

* POSIX permissions model
* Symlinks/hardlinks
* Partial file streams (v1 is whole-object read/write)

---

## 1. Terms

* **Path**: absolute, POSIX-style (`/a/b/c`).
* **Node**: a typed item stored at a path.
* **Backend**: a storage provider implementing the Driver interface.
* **Mount**: a path prefix bound to a backend + policy.
* **Kernel**: orchestrates path resolution, normalization, caching, conversion, and driver calls.

---

## 2. Node Model

### 2.1 Node Kinds

The filesystem supports exactly these node kinds:

1. `dir`
   A directory mapping names to child nodes.
2. `bytes`
   A binary blob.
3. `value`
   Any **JSON-serializable JavaScript value** (object, array, string, number, boolean, null).
4. `uri`
   A URI reference string, not automatically fetched unless requested.

A path resolves to exactly one node or NotFound.

### 2.2 Atomicity

* `dir` nodes contain children.
* `bytes`, `value`, and `uri` nodes are **atomic** (no subpaths beneath them).

If `/x` is `value`, then `/x/y` MUST throw `NotDirectory`.

### 2.3 Metadata

Each node MAY carry metadata:

* `mtime`: number (milliseconds since epoch)
* `contentType`: string (MIME type) — relevant for `bytes` and `uri`
* `etag`: string — relevant for `uri` fetched materialization cache
* `size`: number — may be unknown until materialization for `uri`
* `origin`: string — optional (driver-defined)

Metadata is best-effort; drivers may omit it.

---

## 3. Path Rules

### 3.1 Normalization

Kernel MUST normalize input paths:

* Must be absolute and start with `/`
* Collapse `//` → `/`
* Remove `.` segments
* Resolve `..` segments without escaping root (attempts to escape root MUST throw `InvalidPath`)
* Root is `/`

### 3.2 Name Constraints

Directory entry names:

* MUST be non-empty
* MUST NOT contain `/`
* SHOULD reject `.` and `..` as literal names (Kernel may treat as invalid)

---

## 4. Kernel API

All Kernel methods are asynchronous and return Promises.

### 4.1 Core

* `Stat(path): Promise<NodeStat>`
* `List(path): Promise<string[]>` (dir only)
* `Mkdir(path, options?): Promise<void>`
* `Delete(path, options?): Promise<void>`
* `Move(from, to, options?): Promise<void>`

### 4.2 Typed Writes

* `WriteAllBytes(path, bytes: Uint8Array, meta?): Promise<void>` → stores `bytes`
* `WriteValue(path, value: JsonValue, meta?): Promise<void>` → stores `value`
* `WriteUri(path, uri: string, meta?): Promise<void>` → stores `uri`

### 4.3 Typed Reads

* `ReadAllBytes(path, options?): Promise<Uint8Array>`
* `ReadValue(path, options?): Promise<JsonValue>`
* `ReadUri(path, options?): Promise<string>`

### 4.4 Convenience Read (Text)

* `ReadAllText(path, options?): Promise<string>`

`ReadAllText` is a **conversion method**, not a stored node kind.

---

## 5. Type Semantics and Conversions

### 5.1 JsonValue Definition

`JsonValue` is any value that can be serialized with JSON without loss of structural validity:

* allowed: `null`, `boolean`, `number` (finite), `string`, arrays, plain objects composed of JsonValue
* disallowed: `undefined`, functions, symbols, DOM nodes, class instances with cycles, `BigInt`, `NaN`, `Infinity`, circular references

Kernel MUST validate in `WriteValue` and throw `InvalidValue` if the value is not JSON-serializable under the chosen policy.

**Policy default**: reject `NaN`/`Infinity` and `BigInt`.

### 5.2 ReadAllBytes(path)

Default behavior by node kind:

* `bytes`: ✅ returns stored bytes
* `value`: ✅ returns UTF-8 bytes of `JSON.stringify(value)`
* `uri`: ✅ fetches and returns response body bytes
* `dir`: ❌ throws `IsDirectory`

Notes:

* For `uri`, the Kernel MUST use `fetch()` unless a driver provides a specialized materializer.
* For `value`, stringification MUST be deterministic under v1 rules (see §5.5).

### 5.3 ReadAllText(path)

Default behavior by node kind:

* `value`: ✅ returns `JSON.stringify(value)`
* `bytes`: ✅ UTF-8 decode of bytes
* `uri`: ✅ fetch, then UTF-8 decode
* `dir`: ❌ throws `IsDirectory`

UTF-8 decoding policy:

* Default: **strict** (invalid sequences throw `InvalidEncoding`)
* Optional: allow `replacement` mode via options.

### 5.4 ReadValue(path)

Default behavior by node kind:

* `value`: ✅ returns a **structured clone** of the stored value
* `bytes`: ❌ throws `WrongType`
* `uri`: ❌ throws `WrongType`
* `dir`: ❌ throws `IsDirectory`

Rationale: do not silently parse bytes/text as JSON. If you want parsing, implement it as an explicit helper above the kernel (`ReadValueFromJsonText`).

### 5.5 JSON Stringify Rules

Kernel MUST define stringification rules for conversions:

* Use `JSON.stringify(value)` with:

  * no custom replacer by default
  * no pretty-printing by default
* Key ordering:

  * v1: **preserve native insertion order** (do not sort keys)
  * If deterministic ordering is needed, add a future option `stableJson: true` (not required in v1)

---

## 6. ReadUri(path)

`ReadUri` returns a URI string representing the node.

Default behavior by node kind:

* `uri`: ✅ return the stored URI string as-is
* `bytes`: ✅ return a `data:` URI containing the bytes
* `value`: ✅ return a `data:` URI containing JSON text of the value
* `dir`: ❌ throws `IsDirectory`

### 6.1 Data URI Encoding

Kernel MUST support:

* `dataUriEncoding = "base64"` (default)
* `dataUriEncoding = "percent"`

Defaults:

* `bytes` → `data:<mime>;base64,<b64>`
* `value` → `data:application/json;base64,<b64(jsonUtf8)>`

`mime` selection:

* for `bytes`: `meta.contentType` if present else `application/octet-stream`
* for `value`: always `application/json`

### 6.2 Size Limits

`ReadUri` MUST provide a safety fuse:

* `maxDataUriBytes` default: 2 MiB (configurable)
* If generated data would exceed limit:

  * default behavior: throw `DataTooLarge`
  * optional behavior: `onOversize="blobUri"` returns `blob:` URL and requires caller cleanup (see §6.3)

### 6.3 Optional Blob URI Fallback

If `onOversize="blobUri"`:

* Kernel creates a `Blob` and returns `URL.createObjectURL(blob)`
* Kernel MUST expose `ReleaseUri(uri)` to revoke blob URLs:

  * `ReleaseUri(uri: string): void` (synchronous)
* Kernel MUST NOT persist blob URIs in `WriteUri` by default (see §8.4)

---

## 7. Errors

Kernel MUST throw typed errors with stable codes.

Minimum codes:

* `InvalidPath`
* `NotFound`
* `AlreadyExists`
* `NotDirectory`
* `IsDirectory`
* `WrongType`
* `InvalidValue`
* `InvalidEncoding`
* `PermissionDenied`
* `Conflict`
* `Unsupported`
* `DataTooLarge`
* `NetworkError` (for uri fetch)
* `Cancelled` (if AbortSignal supported)

Errors SHOULD carry `{ code, path, message, cause? }`.

---

## 8. Writes and Mutations

### 8.1 Create/Overwrite

All write methods overwrite existing nodes by default.

Optional future: `options = { overwrite: false }` to throw `AlreadyExists`.

### 8.2 Parent Directories

Write methods MUST require parent directory existence unless `options = { recursive: true }` is provided.

* Without `recursive`, missing parents → `NotFound`
* With `recursive`, Kernel creates missing parent `dir` nodes.

### 8.3 Move

`Move(from, to)` semantics:

* If `to` exists → overwrite by default (optional future `overwrite:false`)
* Must preserve node kind and content
* Cross-mount move:

  * Kernel MUST implement as copy+delete (non-atomic) unless a backend supports native moves

### 8.4 WriteUri Restrictions

By default Kernel MUST reject `blob:` URIs in `WriteUri` with `InvalidValue` because they are session-scoped.
Optional policy: `acceptBlobUri: true` which forces immediate materialization into `bytes` (fetch blob) or stores as `uri` with warning metadata.

---

## 9. Mounting and Resolution

### 9.1 Mount Table

Kernel holds an ordered list of mount entries:

Each mount defines:

* `prefix: string` (absolute path, normalized, no trailing slash except `/`)
* `driver: IVfsDriver`
* `policy: MountPolicy`

Resolution:

* Kernel chooses the **longest-prefix match**.
* If none matches, Kernel MUST have a root mount `/`.

### 9.2 Overlay Mounts (Optional but recommended)

Kernel MAY support overlay mounts:

* A mount can be an `OverlayDriver([top, ..., bottom])`
* Reads search top→bottom
* Writes go to top by default
* Deletions can create tombstones (policy-defined)

Overlay semantics MUST be explicit if enabled; if not implemented in v1, omit.

---

## 10. Driver Interface

Drivers are storage providers. They store **raw nodes** or the canonical node format. Drivers MUST NOT perform URI fetches or base64 decoding unless they are explicitly the responsible materializer (advanced).

Minimum driver operations:

* `GetNode(relPath): Promise<StoredNode | null>`
* `PutNode(relPath, node: StoredNode): Promise<void>`
* `DeleteNode(relPath): Promise<void>`
* `ListChildren(relPath): Promise<string[]>` (dir only)
* `EnsureDir(relPath): Promise<void>` (mkdir)
* Optional:

  * `MoveNode(fromRel, toRel): Promise<boolean>` (return false if unsupported)
  * `Flush(): Promise<void>`
  * `Watch(relPath, cb): Unsubscribe`

Where `relPath` is mount-relative (no leading slash).

### 10.1 StoredNode Canonical Shape

Drivers SHOULD store nodes in this canonical discriminated form:

* `dir`: `{ k:"dir", e: Record<string, StoredNode>, meta? }` *(or driver-native child storage)*
* `bytes`: `{ k:"bytes", c: ContentRefStored, meta? }`
* `value`: `{ k:"value", v: JsonValue, meta? }`
* `uri`: `{ k:"uri", u: string, meta? }`

Drivers MAY store directories as separate child records instead of embedding.

### 10.2 ContentRefStored

`bytes` nodes store content via a content reference:

Allowed ref types in v1:

* `inline`: `{ t:"inline", b64:string }` *(JSON-friendly)*
* `blob`: `{ t:"blob", id:string }` *(IndexedDB or driver blob store)*

Kernel MUST normalize and materialize these.

---

## 11. Normalization and Materialization

Kernel responsibilities:

1. Normalize paths and resolve mounts.
2. Validate node shapes and invariants.
3. Materialize content refs:

   * base64 decode for `inline`
   * blob lookup for `blob`
4. Materialize URI fetch for `uri` reads:

   * caching (see §12)
   * content-type metadata best-effort

Drivers may provide specialized materialization only if explicitly agreed by policy.

---

## 12. Caching

Kernel SHOULD implement two caches:

1. **Node cache**

   * Key: `(mountId, relPath)`
   * Stores: normalized node + stat metadata
2. **Content cache**

   * For `uri` fetch results and decoded bytes
   * Key: `uri + etag` if available, else `uri + hash(body)` (hash optional)

Minimum caching requirements:

* Prevent redundant concurrent fetches for the same URI (request coalescing).
* Allow TTL in mount policy: `uriCacheTtlMs`.

Cache invalidation:

* Any `PutNode/DeleteNode/MoveNode` MUST invalidate relevant cached entries.

---

## 13. Concurrency and Locking

Kernel MUST serialize write operations per path (or per mount) to avoid corruption:

* Use an async RW lock:

  * Reads may run concurrently
  * Writes are exclusive
  * Write excludes reads on same path subtree as needed (implementation-defined)

At minimum:

* Two writes to the same path must not interleave.
* Read during write must return either old or new value, not partial.

---

## 14. Security and Networking

* All URI fetches are subject to browser CORS and sandbox policies.
* Kernel MUST allow providing a `fetch` implementation via policy (for auth headers, retries, etc.).
* Kernel SHOULD support `AbortSignal` on read operations involving fetch.

---

## 15. Examples

### 15.1 Store config object and retrieve as JSON text

* `WriteValue("/cfg/app", { theme: "dark", flags: [1,2] })`
* `ReadAllText("/cfg/app")` → `{"theme":"dark","flags":[1,2]}`

### 15.2 Store bytes and embed as data URI

* `WriteAllBytes("/img/logo", bytes, { contentType: "image/png" })`
* `ReadUri("/img/logo")` → `data:image/png;base64,...`

### 15.3 Store a URI reference and pass through

* `WriteUri("/remote/readme", "https://example.com/readme.txt")`
* `ReadUri("/remote/readme")` → `https://example.com/readme.txt`
* `ReadAllText("/remote/readme")` → fetched and decoded text

---

## 16. Compliance Checklist (v1)

An implementation is v1-compliant if it supports:

* Node kinds: `dir`, `bytes`, `value`, `uri`
* Kernel API: `Stat`, `List`, `Mkdir`, `Delete`, `Move`, `WriteAllBytes`, `WriteValue`, `WriteUri`, `ReadAllBytes`, `ReadValue`, `ReadAllText`, `ReadUri`
* Path normalization + errors per §7
* `WriteValue` JSON-serializable validation
* `ReadUri` data URI generation with size fuse

---

If you want this to be “hand to an engineer and get code back”, the only missing bits are: **exact TypeScript signatures** (including option shapes) and the **canonical stored node JSON schema** (with `ContentRefStored` variants). I can produce those as the appendix, but this spec already pins down the semantics tightly enough that nobody gets to invent “helpful” auto-magic later.
