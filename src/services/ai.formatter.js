
/**
 * ai.formatter.js
 * Normalizes AI output into the strict Afterma response schema.
 * Even if the AI skips a field, we guarantee a valid safe structure.
 */
export const formatResponse = (aiData = {}) => {
  const triage = ['mild', 'moderate', 'emergency'].includes(aiData.triage)
    ? aiData.triage
    : 'mild';

  const isEmergency = triage === 'emergency';

  return {
    status: 'success',
    triage,
    message: typeof aiData.message === 'string' && aiData.message.trim()
      ? aiData.message.trim()
      : 'I am here to support you. Please share more about how you are feeling.',
    bullets: Array.isArray(aiData.bullets)
      ? aiData.bullets.filter(b => typeof b === 'string').slice(0, 4)
      : [],
    warnings: Array.isArray(aiData.warnings)
      ? aiData.warnings.filter(w => typeof w === 'string').slice(0, 3)
      : [],
    quick_replies: Array.isArray(aiData.quick_replies)
      ? aiData.quick_replies.filter(q => typeof q === 'string').slice(0, 3)
      : ['Can you tell me more?', 'When should I see a doctor?'],
    ui_flags: {
      show_emergency_banner: isEmergency,
      highlight: isEmergency,
    },
  };
};
