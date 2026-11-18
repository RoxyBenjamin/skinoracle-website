// =============================================================================
// SkinOracle™ Product Pricer — "My scans" kept on the phone (v1.0.0)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// Uses IndexedDB (the browser's built-in database). Each scan:
//   { id, createdAt, product, prices, barcode, files: [{kind, name, blob}], cutOut: {kind: bool} }
// Data stays on this phone. When the app is installed on the Home Screen the
// browser keeps it; deleting the Home-Screen app deletes it.
// =============================================================================

const DB = "skinoracle-product-pricer";
const STORE = "scans";

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  }));
}

export const saveScan = (scan) => tx("readwrite", (s) => s.put(scan));
export const deleteScan = (id) => tx("readwrite", (s) => s.delete(id));
export const getScan = (id) => tx("readonly", (s) => s.get(id));
export async function listScans() {
  const all = await tx("readonly", (s) => s.getAll());
  return (all ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Ask the browser not to clear our data when the phone is low on space (best effort). */
export function askPersistentStorage() {
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
