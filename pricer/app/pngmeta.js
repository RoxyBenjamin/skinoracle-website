// =============================================================================
// SkinOracle™ Product Pricer — write the product name INTO the PNG file (v1.0.0)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// A PNG file is a list of "chunks". We add:
//   * tEXt "Title", "Description", "Software", "Source"   (read by most image tools)
//   * iTXt "XML:com.adobe.xmp" with dc:title / dc:description   (XMP — read by Apple
//     Photos/Files, Adobe, Google tools)
// right after the IHDR (header) chunk. The image pixels are untouched.
// Apple Photos does not always show XMP as a caption, so the FILE NAME also
// carries the product name (see app.js → fileBase()).
// =============================================================================

const enc = new TextEncoder();

// CRC-32 table (PNG chunks end with a CRC of type+data).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(enc.encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

// tEXt must be Latin-1; we replace anything else with "?" (the XMP chunk below keeps full Unicode).
function latin1(s) { return Uint8Array.from([...s].map((ch) => { const c = ch.charCodeAt(0); return c < 256 ? c : 63; })); }
function tEXt(key, value) { const k = latin1(key), v = latin1(value); const d = new Uint8Array(k.length + 1 + v.length); d.set(k); d.set(v, k.length + 1); return chunk("tEXt", d); }
function iTXt(key, value) {
  const k = enc.encode(key), v = enc.encode(value);
  const d = new Uint8Array(k.length + 5 + v.length);          // key \0 compFlag compMethod lang\0 transKey\0 text
  d.set(k); d.set(v, k.length + 5);
  return chunk("iTXt", d);
}
const xmlEsc = (s) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));

/**
 * Returns a new PNG Blob with the metadata added.
 * @param {Blob} pngBlob
 * @param {{title: string, description: string, keywords?: string[]}} meta
 */
export async function addPngMetadata(pngBlob, meta) {
  const bytes = new Uint8Array(await pngBlob.arrayBuffer());
  // PNG signature (8 bytes) + IHDR chunk (4 len + 4 type + 13 data + 4 crc = 25 bytes)
  const insertAt = 8 + 25;
  if (bytes.length < insertAt || bytes[1] !== 0x50 || bytes[12] !== 0x49) return pngBlob;   // not a PNG we understand → unchanged
  const kw = (meta.keywords ?? []).map((k) => `<rdf:li>${xmlEsc(k)}</rdf:li>`).join("");
  const xmp =
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">` +
    `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(meta.title)}</rdf:li></rdf:Alt></dc:title>` +
    `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(meta.description)}</rdf:li></rdf:Alt></dc:description>` +
    (kw ? `<dc:subject><rdf:Bag>${kw}</rdf:Bag></dc:subject>` : "") +
    `<xmp:CreatorTool>SkinOracle Product Pricer</xmp:CreatorTool></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  const extra = [
    tEXt("Title", meta.title), tEXt("Description", meta.description),
    tEXt("Software", "SkinOracle Product Pricer"), tEXt("Source", "skinoracle.ai/pricer"),
    iTXt("XML:com.adobe.xmp", xmp),
  ];
  return new Blob([bytes.subarray(0, insertAt), ...extra, bytes.subarray(insertAt)], { type: "image/png" });
}
