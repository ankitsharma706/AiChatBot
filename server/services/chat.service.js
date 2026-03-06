import { routeToAgent } from '../agents/agentRouter.js';
import { detectEmergency, getTriageHint } from '../utils/triage.js';
import { logger } from '../utils/logger.js';

const QUICK_REPLIES = {
    research: ['What other findings does Afterma research mention?', 'Are there studies on postpartum nutrition?', 'What does research say about breastfeeding?'],
    health: ['What foods are good during recovery?', 'When should I resume exercise after delivery?', 'How do I manage postpartum mood changes?'],
    scheme: ['How can I apply for this scheme?', 'What documents do I need?', 'Are there other schemes I am eligible for?'],
    knowledge: ['How do I log my health data?', 'How do I book a consultation?', 'What reminders can I set in the app?'],
    general: ['Tell me more about Afterma features', 'What maternal health tips do you have?', 'Are there government schemes for my situation?'],
};

/**
 * Main stateless chat service.
 * @param {string} question
 * @returns {Promise<object>}
 */
export const processChat = async (question) => {
    const trimmed = question.trim();

    // ── Emergency fast-path ────────────────────────────────────────────────────
    if (detectEmergency(trimmed)) {
        logger.warn(`[ChatService] ⚠️ Emergency detected`);
        return {
            status: 'success',
            triage: 'emergency',
            message: 'Namaste. This sounds like a serious medical emergency. Please call 112 or go to the nearest hospital immediately. Do not delay — your health is the priority.',
            bullets: ['Call Indian Emergency: 112', 'iCall (Mental Health): 9152987821', 'Lie still and call for help if feeling faint.'],
            warnings: ['Do NOT wait for home remedies in an emergency.', 'Have someone drive you to the hospital immediately.'],
            sources: [],
            agent_used: 'emergency-detector',
            agent_label: 'Emergency Triage System',
            quick_replies: ['What are other emergency symptoms?', 'How do I stay calm?'],
            ui_flags: { show_emergency_banner: true, highlight: true },
        };
    }

    // ── Route to agent ─────────────────────────────────────────────────────────
    const { answer, sources, agent, agent_label } = await routeToAgent(trimmed);
    const triage = getTriageHint(trimmed);
    const replies = QUICK_REPLIES[agent] || QUICK_REPLIES.general;

    const notFound = !answer || answer.toLowerCase().includes('could not find relevant information') || answer.trim().length < 15;
    const finalMessage = notFound
        ? 'Namaste. I apologize, but I could not find relevant information in the Afterma knowledge base for your question. Please consult your healthcare provider for personalized guidance.'
        : answer;

    logger.info(`[ChatService] ✅ Response from agent '${agent}' | triage: ${triage} | sources: ${sources.length}`);

    return {
        status: 'success',
        triage,
        message: finalMessage,
        sources,
        agent_used: agent,
        agent_label,
        quick_replies: replies,
        ui_flags: { show_emergency_banner: triage === 'emergency', highlight: triage === 'emergency' },
    };
};
