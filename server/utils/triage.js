// ─── Emergency keyword detection ─────────────────────────────────────────────
const EMERGENCY_KEYWORDS = [
    // English
    'heavy bleeding', 'hemorrhage', 'unconscious', 'not breathing', 'chest pain',
    'seizure', 'convulsion', 'severe abdominal pain', 'fainted', 'stroke',
    'heart attack', 'difficulty breathing', 'can\'t breathe', 'cannot breathe',
    'stopped breathing', 'very heavy blood', 'placenta', 'eclampsia', 'preeclampsia',
    'postpartum hemorrhage', 'baby not moving', 'no fetal movement',
    // Hindi transliterated
    'zyada khoon', 'bahut khoon', 'bar bar dard', 'behosh', 'sans nahi',
    'chat pain', 'ulti khoon',
];

const TRIAGE_MODERATE_KEYWORDS = [
    'fever', 'infection', 'wound', 'stitches', 'c-section pain', 'swelling',
    'mastitis', 'not healing', 'pus', 'redness', 'persistent vomiting',
    'high temperature', 'depression', 'self harm',
];

/**
 * Returns true if the message contains emergency keywords.
 * @param {string} text
 * @returns {boolean}
 */
export const detectEmergency = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
};

/**
 * Returns a triage level hint based on keywords.
 * @param {string} text
 * @returns {'emergency' | 'moderate' | 'mild'}
 */
export const getTriageHint = (text) => {
    if (!text) return 'mild';
    if (detectEmergency(text)) return 'emergency';
    const lower = text.toLowerCase();
    if (TRIAGE_MODERATE_KEYWORDS.some((kw) => lower.includes(kw))) return 'moderate';
    return 'mild';
};
