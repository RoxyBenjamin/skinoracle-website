// =============================================================================
// SkinOracle™ Product Pricer — frame guard (pricer v1.0.0)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne
// Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// WHY: Founder direction (Roxanne Haberland), 14 Nov 2026: "make sure we build the needed security around it so it
//   cannot be hacked". A trick called "clickjacking" puts our page inside an invisible frame on another website so a
//   person taps our buttons without knowing. Normally a server header stops it, but GitHub Pages (which serves
//   skinoracle.ai) can't send that header, so this small script does it: if the page is inside ANY frame, it shows
//   nothing and stops.
// HOW IT CONNECTS: loaded as a plain (non-module) script in the <head> of index.html and app/index.html, BEFORE
//   everything else, so nothing else runs when framed.
// HOW TO CHANGE SAFELY: don't make it a module (modules run later) and don't remove it unless the site moves to a host
//   that sends "Content-Security-Policy: frame-ancestors 'none'".
// =============================================================================
(function () {
  "use strict";
  var framed;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }   // a cross-site parent throws → framed
  if (framed) {
    document.documentElement.style.display = "none";
    try { window.top.location = window.self.location.href; } catch (e) { /* the parent blocked it: page stays blank */ }
    throw new Error("Product Pricer can't be shown inside another website.");
  }
})();
