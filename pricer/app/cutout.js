// =============================================================================
// SkinOracle™ Product Pricer — background removal ON THE PHONE (v1.0.0)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// HOW IT WORKS
//   * Model: U²-Net "u2netp" (vendor/u2netp.onnx, 4.5 MB). A salient-object
//     model: it finds "the main thing in the photo", which for a product shot is
//     the product. License: Apache-2.0 (commercial use allowed). Source:
//     https://github.com/xuebinqin/U-2-Net (weights as packaged by rembg).
//   * Runtime: ONNX Runtime Web (vendor/ort.*, MIT license) running WebAssembly
//     on the phone. Nothing is uploaded to remove the background, and it costs $0.
//   * Steps: shrink photo → 320×320 tensor → model → mask → upscale mask →
//     use mask as transparency → crop to the product → PNG.
//
// SAFETY NET
//   If the mask looks wrong (almost nothing, or almost everything, detected) we
//   keep the ORIGINAL photo instead of a bad cut-out and say so in the UI.
//   A cut-out with half a bottle missing is worse than no cut-out.
// =============================================================================
import * as ort from "../vendor/ort.wasm.min.mjs";

const SIZE = 320;                          // model input is 1×3×320×320
const MEAN = [0.485, 0.456, 0.406];        // ImageNet normalisation used when the model was trained
const STD = [0.229, 0.224, 0.225];

let sessionPromise = null;

/** Loads the model once (first scan only; afterwards it's cached by the service worker). */
export function loadCutoutModel() {
  if (!sessionPromise) {
    ort.env.wasm.wasmPaths = new URL("../vendor/", import.meta.url).href;
    ort.env.wasm.numThreads = 1;           // multi-threading needs special server headers; 1 thread is plenty
    ort.env.wasm.proxy = false;
    sessionPromise = ort.InferenceSession.create(new URL("../vendor/u2netp.onnx", import.meta.url).href, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    }).catch((e) => { sessionPromise = null; throw e; });
  }
  return sessionPromise;
}

/**
 * Removes the background of a photo.
 * @param {HTMLCanvasElement} src  upright photo, already shrunk (≤ CONFIG.cutoutMaxSide)
 * @returns {Promise<{canvas: HTMLCanvasElement, cutOut: boolean}>}
 *          cutOut=false means we fell back to the original photo.
 */
export async function removeBackground(src) {
  const session = await loadCutoutModel();
  const W = src.width, H = src.height;

  // 1. Photo → 320×320 RGB float tensor (rembg-style: divide by the brightest value, then normalise).
  const small = document.createElement("canvas");
  small.width = SIZE; small.height = SIZE;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(src, 0, 0, SIZE, SIZE);
  const px = sctx.getImageData(0, 0, SIZE, SIZE).data;
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let p = 0, i = 0; p < plane; p++, i += 4) {
    input[p] = (px[i] / max - MEAN[0]) / STD[0];
    input[plane + p] = (px[i + 1] / max - MEAN[1]) / STD[1];
    input[2 * plane + p] = (px[i + 2] / max - MEAN[2]) / STD[2];
  }

  // 2. Run the model. The first output is the final, most detailed mask.
  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) };
  const out = await session.run(feeds);
  const mask = out[session.outputNames[0]].data;

  // 3. Normalise mask to 0..255 and paint it into a 320×320 greyscale canvas.
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < mask.length; i++) { const v = mask[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
  const range = mx - mn || 1;
  const mImg = sctx.createImageData(SIZE, SIZE);
  let covered = 0;
  for (let p = 0; p < plane; p++) {
    const v = (mask[p] - mn) / range;
    if (v > 0.5) covered++;
    const a = Math.round(255 * v);
    const i = p * 4;
    mImg.data[i] = mImg.data[i + 1] = mImg.data[i + 2] = 255; mImg.data[i + 3] = a;
  }
  const coverage = covered / plane;
  if (coverage < 0.03 || coverage > 0.97) return { canvas: src, cutOut: false, coverage };

  // 4. Upscale the mask (smoothly, so edges stay soft) and use it as transparency.
  const mCanvas = document.createElement("canvas");
  mCanvas.width = SIZE; mCanvas.height = SIZE;
  mCanvas.getContext("2d").putImageData(mImg, 0, 0);
  const outC = document.createElement("canvas");
  outC.width = W; outC.height = H;
  const octx = outC.getContext("2d", { willReadFrequently: true });
  octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = "high";
  octx.drawImage(mCanvas, 0, 0, W, H);                 // mask (alpha) first…
  octx.globalCompositeOperation = "source-in";         // …then keep the photo only where the mask is
  octx.drawImage(src, 0, 0);
  octx.globalCompositeOperation = "source-over";

  // 5. Crop to the product (pixels more than ~10% opaque) plus a little breathing room.
  const a = octx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (a[(y * W + x) * 4 + 3] > 26) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { canvas: src, cutOut: false, coverage };
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const crop = document.createElement("canvas");
  crop.width = x1 - x0 + 1; crop.height = y1 - y0 + 1;
  crop.getContext("2d").drawImage(outC, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return { canvas: crop, cutOut: true, coverage };
}
