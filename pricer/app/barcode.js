// =============================================================================
// SkinOracle™ Product Pricer — barcode / QR reading ON THE PHONE (v1.0.0)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// Uses zxing-wasm (vendor/zxing-reader.iife.js + zxing_reader.wasm, MIT license).
// iPhone's browser has no built-in barcode reader, so we bundle one that works
// the same on iPhone and Android. Reads UPC/EAN (retail), QR, DataMatrix, Code128…
// =============================================================================

let ready = null;

/** Loads the reader script once and points it at our own copy of the .wasm file. */
function loadReader() {
  if (!ready) {
    ready = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = new URL("../vendor/zxing-reader.iife.js", import.meta.url).href;
      s.onload = () => {
        const Z = globalThis.ZXingWASM;
        Z.prepareZXingModule({
          overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? new URL("../vendor/zxing_reader.wasm", import.meta.url).href : prefix + path) },
          fireImmediately: true,
        });
        resolve(Z);
      };
      s.onerror = () => { ready = null; reject(new Error("Barcode reader failed to load.")); };
      document.head.appendChild(s);
    });
  }
  return ready;
}

/**
 * Tries to read a barcode/QR code from one or more canvases (best photo first).
 * @returns {Promise<{text: string, format: string} | null>}
 */
export async function readBarcode(canvases) {
  let Z;
  try { Z = await loadReader(); } catch { return null; }
  for (const c of canvases) {
    if (!c) continue;
    try {
      const imgData = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
      const results = await Z.readBarcodes(imgData, { tryHarder: true, maxNumberOfSymbols: 1 });
      const hit = results.find((r) => r.isValid && r.text);
      if (hit) return { text: hit.text.trim().slice(0, 64), format: hit.format };
    } catch { /* try the next photo */ }
  }
  return null;
}
