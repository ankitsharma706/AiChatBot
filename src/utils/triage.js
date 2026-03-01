/**
 * triage.js
 * Local keyword-based safety check — runs BEFORE the AI call.
 * Catches clear emergencies without waiting for API latency.
 */

const EMERGENCY_PATTERNS = [
  'chest pain', 'cannot breathe', "can't breathe", 'heavy bleeding',
  'hemorrhage', 'unconscious', 'not breathing', 'seizure', 'convulsion',
  'stroke', 'heart attack', 'severe bleeding', 'stopped breathing',
  'collapsed', 'unresponsive', 'very heavy bleeding', 'passing out',
  'fainted', 'fainting', 'eclampsia', 'preeclampsia severe',
];

const MODERATE_PATTERNS = [
  'fever', 'pain', 'swelling', 'redness', 'discharge', 'vomiting',
  'dizziness', 'headache', 'palpitations', 'difficulty feeding',
  'wound', 'infection', 'bleeding', 'rash', 'numbness',
];

/**
 * Returns true if text matches known emergency keywords.
 */
export const detectEmergency = (text) => {
  const lower = text.toLowerCase();
  return EMERGENCY_PATTERNS.some(p => lower.includes(p));
};

/**
 * Returns a triage hint ("mild" | "moderate" | "emergency") based on keywords.
 * Used as a fallback hint when AI doesn't return a valid triage level.
 */
export const getTriageHint = (text) => {
  const lower = text.toLowerCase();
  if (EMERGENCY_PATTERNS.some(p => lower.includes(p))) return 'emergency';
  if (MODERATE_PATTERNS.some(p => lower.includes(p))) return 'moderate';
  return 'mild';
};
