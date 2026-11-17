// Keeping place search honest. Free map data (OpenStreetMap) has few small
// Malaysian companies and its search "fuzzy-matches" — "LRG Rubber" came back
// as a different rubber company. A wrong pin is worse than no result, so a
// result must contain every distinctive word of what was typed.

/** Words that say nothing about WHICH company it is. */
const GENERIC = new Set([
  "sdn",
  "bhd",
  "berhad",
  "sendirian",
  "plt",
  "enterprise",
  "enterprises",
  "trading",
  "co",
  "company",
  "corporation",
  "corp",
  "group",
  "holdings",
  "holding",
  "industries",
  "industry",
  "industrial",
  "manufacturing",
  "malaysia",
  "m",
  "the",
  "and",
  "of",
  "ltd",
  "limited",
  "inc",
  "services",
  "service",
  "resources",
  "international",
]);

function words(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** "SPRING ART  INDUSTRIES SDN. BHD." → "Spring Art Industries" — better for map search. */
export function searchableCompanyName(company: string) {
  const cleaned = company
    .replace(/\(\s*m\s*\)/gi, " ")
    .replace(/\b(sdn\.?\s*bhd\.?|sendirian\s+berhad|berhad|bhd\.?|plt)\b/gi, " ")
    .replace(/[.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || company.trim())
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function distinctiveWords(query: string) {
  return [...new Set(words(query).filter((word) => !GENERIC.has(word) && word.length > 1))];
}

/**
 * True when every distinctive word typed appears in the result (as a whole
 * word or a word prefix, so "lanadr" still matches while typing). With no
 * distinctive words — e.g. just "Sdn Bhd" — nothing is trustworthy.
 */
export function isRelevantPlace(query: string, name: string, detail = "") {
  const wanted = distinctiveWords(query);
  if (wanted.length === 0) return false;
  const have = words(`${name} ${detail}`);
  return wanted.every((word) => have.some((candidate) => candidate === word || candidate.startsWith(word)));
}

/** Pasted text that is a link or coordinates rather than a name to search. */
export function looksLikeLocationInput(text: string) {
  const value = text.trim();
  return /^https?:\/\//i.test(value) || /https?:\/\/\S+/i.test(value) || /^\(?\s*-?\d{1,3}\.\d+\s*°?\s*[NS]?\s*[,;\s]\s*-?\d{1,3}\.\d+/i.test(value);
}
