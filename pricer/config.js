// =============================================================================
// SkinOracle™ Product Pricer — settings (v1.0.0)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// These values are PUBLIC on purpose (they are visible in every browser that
// opens the page). The publishable key can only call things the database
// allows; Product Pricer's tables allow phones nothing directly — everything
// goes through the "product-pricer" Edge Function.
// =============================================================================

export const CONFIG = {
  /** Shown in the app footer and sent with each scan. Bump on every release. */
  version: "1.1.3",

  /** SkinOracle's Supabase project (same one the website and iPhone app use). */
  supabaseUrl: "https://afmbniyyipzcpgwzhgve.supabase.co",
  supabasePublishableKey: "sb_publishable_VLszriJ9foepLGF9ZFR_jQ_jcaUU5fS",

  /** Edge Function name (backend/supabase/functions/pricer in SkinOracle V4). */
  functionName: "pricer",

  /**
   * "Where did you buy it?" choices. MUST match the server's list (backend/supabase/functions/pricer/logic.ts STORES
   * names + "Other store"): anything else is ignored by the server. A fixed list on purpose: no free text that could
   * carry personal details.
   */
  boughtAtChoices: ["Amazon", "Sephora", "Ulta Beauty", "Sally Beauty", "Walmart", "Target", "CVS", "Walgreens", "Dermstore", "Other store"],

  /** Folder name used in saved file names and shown in the save instructions. */
  folderName: "Skin Oracle",


  /** Longest side (pixels) of the background-removed PNG saved on the phone. */
  cutoutMaxSide: 1600,

  /**
   * TEST MODE: add ?demo=1 to the app URL to skip the real AI/backend and use
   * a canned answer. Used by tests/e2e.mjs and handy for trying the flow offline.
   */
  demo: new URLSearchParams(location.search).has("demo"),
};
