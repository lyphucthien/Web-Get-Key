// Default language of the website. Used whenever the visitor's country cannot be determined.
const DEFAULT_LANG = "vi";

// Country code from the request (Vercel sets x-vercel-ip-country from the visitor's IP).
// Only Vietnam gets Vietnamese; every other known country gets English.
// A missing or unusable code (not two letters, or the placeholders XX / T1) falls back to the default.
function countryFromRequest(req) {
  const raw = String((req.headers && req.headers["x-vercel-ip-country"]) || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(raw) || raw === "XX") return null;
  return raw;
}

function langFromCountry(country) {
  if (!country) return DEFAULT_LANG;
  return country === "VN" ? "vi" : "en";
}

module.exports = { DEFAULT_LANG, countryFromRequest, langFromCountry };
