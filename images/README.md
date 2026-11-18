# Website images (`web/public/images/`)

*Owner: Roxy Benjamin. © 2026 Roxy Benjamin. See OWNERSHIP.md.*

Files here are copied as they are to the website (`/images/...`).

- `roxy-720.webp` / `roxy-720.jpg` (portrait, 720 × 720) and `roxy-160.webp` / `roxy-160.jpg` (signature, 160 × 160):
  Roxy's own photo, on the About page (`src/pages/about.astro`). Founder direction (Roxy Benjamin), 13 Nov 2026:
  "and add in this photo of her". Made from the photo she sent: resized, and saved WITHOUT any of the original's hidden
  photo details (EXIF: camera, date, location). Re-make them the same way if the photo changes; never upload the
  original file straight from a phone (it can carry the place where it was taken).
- How to change safely: keep the names (the page refers to them), keep both sizes and both formats (WebP first, JPEG
  for older browsers), and keep files small (under about 100 KB each).
- `pricer-icon.png` (512 × 512) and `pricer-qr.svg`: the SO Pricer invitation on the price engine page
  (`src/components/site/PricerInvite.astro`). Founder direction (Roxy Benjamin), 14 Nov 2026: "Want your own pricing
  engine for your next visit to the beauty supply store? Install the SkinOracle Pricer tool on your phone... the ICON
  should be SO (use the logo) Pricer". `pricer-icon.png` is a copy of `pricer/site/icons/icon-512.png` (made by
  `pricer/tools/make-icons.mjs`): copy it again whenever the Pricer's icon changes. `pricer-qr.svg` is a QR code of
  `https://skinoracle.ai/pricer/` (made with Python `segno`, espresso on cream, with a viewBox so it scales); make it
  again only if that address changes, and test it with a phone camera.
