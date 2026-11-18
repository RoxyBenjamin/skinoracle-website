// =============================================================================
// SkinOracle™ Product Pricer — image helpers (v1.1.1)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// Turning a camera photo (File) into canvases and JPEG/PNG data we can use.
// Phone photos are 12–48 megapixels; we ALWAYS shrink first so iPhones don't run
// out of memory (iOS limits a canvas to about 16 million pixels).
// =============================================================================

/**
 * Loads a photo File into an <img>. Browsers apply the photo's EXIF rotation
 * automatically when drawing an <img>, so sideways phone photos come out upright.
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);                  // keep the object URL alive while the img is in use
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This photo could not be opened.")); };
    img.src = url;
  });
}

/**
 * Draws the image onto a new canvas whose longest side is at most maxSide pixels.
 * `orientation` (1.0.3, 14 Nov 2026; founder report "it's presented sideways"): the photo's EXIF Orientation (1–8,
 * from readOrientation). It is applied HERE only when this browser does not already turn photos by itself
 * (browserTurnsPhotos); today's Safari and Chrome do, so this is a safety net for older phones. Default 1 = as drawn.
 */
export function toCanvas(img, maxSide, orientation = 1) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const swap = orientation >= 5 && orientation <= 8;          // 5–8 = turned a quarter: width and height swap
  const c = document.createElement("canvas");
  c.width = swap ? h : w; c.height = swap ? w : h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // The standard EXIF transforms (what a camera means by each Orientation value).
  const T = { 2: [-1, 0, 0, 1, w, 0], 3: [-1, 0, 0, -1, w, h], 4: [1, 0, 0, -1, 0, h], 5: [0, 1, 1, 0, 0, 0],
    6: [0, 1, -1, 0, h, 0], 7: [0, -1, -1, 0, h, w], 8: [0, -1, 1, 0, 0, w] }[orientation];
  if (T) ctx.setTransform(...T);
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/**
 * Turns a canvas clockwise by 90, 180 or 270 degrees and returns a NEW canvas (any other value: the same canvas).
 * Used for the AI's photo_turn (the label reads upright) and the "Turn" button on the result.
 */
export function turnCanvas(src, deg) {
  const d = ((Number(deg) % 360) + 360) % 360;
  if (d !== 90 && d !== 180 && d !== 270) return src;
  const c = document.createElement("canvas");
  c.width = d === 180 ? src.width : src.height;
  c.height = d === 180 ? src.height : src.width;
  const x = c.getContext("2d");
  x.translate(c.width / 2, c.height / 2);
  x.rotate((d * Math.PI) / 180);
  x.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

/**
 * Does this browser turn photos upright by itself when drawing them (EXIF Orientation)? Tested once with a tiny 2 × 1
 * picture marked "turned a quarter": a browser that applies the mark reports it as 1 × 2. Cached for the session.
 */
let turnsPhotos = null;
export function browserTurnsPhotos() {
  if (turnsPhotos) return turnsPhotos;
  turnsPhotos = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth === 1 && img.naturalHeight === 2);
    img.onerror = () => resolve(true);                         // can't tell: trust the browser
    img.src = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0CiiigD//2Q==";
  });
  return turnsPhotos;
}

/** The photo's EXIF Orientation (1–8), or 1 when there is none or it can't be read (JPEG only). */
export async function readOrientation(file) {
  try {
    const b = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (b.getUint16(0) !== 0xffd8) return 1;
    let off = 2;
    while (off + 4 < b.byteLength) {
      const marker = b.getUint16(off), len = b.getUint16(off + 2);
      if (marker === 0xffe1 && b.getUint32(off + 4) === 0x45786966) {        // "Exif"
        const t = off + 10, le = b.getUint16(t) === 0x4949;
        const ifd0 = t + b.getUint32(t + 4, le), n = b.getUint16(ifd0, le);
        for (let i = 0; i < n; i++) {
          const e = ifd0 + 2 + i * 12;
          if (b.getUint16(e, le) === 0x0112) { const v = b.getUint16(e + 8, le); return v >= 1 && v <= 8 ? v : 1; }
        }
        return 1;
      }
      if ((marker & 0xff00) !== 0xff00 || len < 2) return 1;
      off += 2 + len;
    }
  } catch { /* unreadable: as drawn */ }
  return 1;
}

/** Canvas → "data:image/jpeg;base64,..." (sent to the AI). */
export function canvasToJpegDataUrl(canvas, quality) {
  return canvas.toDataURL("image/jpeg", quality);
}

/** Canvas → Blob (PNG keeps the transparent background). */
export function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image file."))), type, quality));
}

/** Lets the screen repaint between heavy steps so the progress bar moves. */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/**
 * The photo's own location tag (EXIF GPS), ROUNDED to 0.1 degree (about 11 km), or null.
 * Founder direction (Roxanne Haberland), 14 Nov 2026: "We need to know where it was bought. as long as there is not
 * linking to the person, it should be OK". Only the AREA leaves the phone: an exact spot on a photo taken at home is the
 * home's address. Reads JPEG files only (iPhone and Android hand JPEGs to websites); anything else → null.
 */
export async function photoArea(file) {
  try {
    const b = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (b.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 < b.byteLength) {
      const marker = b.getUint16(off), len = b.getUint16(off + 2);
      if (marker === 0xffe1 && b.getUint32(off + 4) === 0x45786966) return readGps(b, off + 10);   // "Exif"
      if ((marker & 0xff00) !== 0xff00 || len < 2) return null;
      off += 2 + len;
    }
  } catch { /* unreadable: no area */ }
  return null;
}

/** Reads the GPS block of an EXIF (TIFF) structure starting at `t`. */
function readGps(b, t) {
  const le = b.getUint16(t) === 0x4949;
  const u16 = (o) => b.getUint16(t + o, le), u32 = (o) => b.getUint32(t + o, le);
  const entry = (ifd, tag) => { const n = u16(ifd); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === tag) return e; } return null; };
  const ifd0 = u32(4);
  const gpsPtr = entry(ifd0, 0x8825);
  if (gpsPtr === null) return null;
  const gps = u32(gpsPtr + 8);
  const deg = (tag) => { const e = entry(gps, tag); if (e === null) return null; const o = u32(e + 8);
    const r = (k) => u32(o + k * 8) / (u32(o + k * 8 + 4) || 1); return r(0) + r(1) / 60 + r(2) / 3600; };
  const ref = (tag) => { const e = entry(gps, tag); return e === null ? "" : String.fromCharCode(b.getUint8(t + e + 8)); };
  let lat = deg(2), lon = deg(4);
  if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (ref(1) === "S") lat = -lat;
  if (ref(3) === "W") lon = -lon;
  return roundArea(lat, lon, "photo");
}

/** Rounds a position to the AREA kept (0.1 degree ≈ 11 km). */
export function roundArea(lat, lon, source) {
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  return { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10, source };
}

/**
 * The phone's location, rounded to the area, if the person allows it (the phone asks once). Coarse accuracy is
 * requested on purpose; waits at most 6 seconds; null when refused or unavailable.
 */
export function deviceArea() {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const done = setTimeout(() => resolve(null), 6500);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(done); resolve(roundArea(p.coords.latitude, p.coords.longitude, "device")); },
      () => { clearTimeout(done); resolve(null); },
      { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 6000 },
    );
  });
}
