import { runResearchAgent } from './researchAgent.js';
import { runHealthAgent } from './healthAgent.js';
import { runSchemeAgent } from './schemeAgent.js';
import { runKnowledgeAgent } from './knowledgeAgent.js';
import { runRagChain } from '../chains/ragChain.js';
import { logger } from '../utils/logger.js';

// ─── Intent classification rules ─────────────────────────────────────────────
const INTENT_RULES = [
    {
        agent: 'research',
        keywords: [
            'research', 'study', 'paper', 'findings', 'evidence', 'data shows',
            'journal', 'clinical', 'thesis', 'survey', 'antenatal', 'postnatal study',
            'sample size', 'conclusion', 'afterma study', 'afterma research',
        ],
    },
    {
        agent: 'scheme',
        keywords: [
            'scheme', 'yojana', 'government', 'benefit', 'sarkari', 'pm scheme',
            'apply', 'eligibility', 'subsidy', 'ration', 'anganwadi', 'pradhan mantri',
            'financial aid', 'matru vandana', 'janani', 'pmmvy', 'jsy', 'mahila',
            'welfare', 'government help', 'free service',
        ],
    },
    {
        agent: 'knowledge',
        keywords: [
            'app', 'feature', 'platform', 'afterma app', 'how to use', 'log', 'tracker',
            'dashboard', 'profile', 'account', 'subscription', 'notification',
            'reminder', 'consult', 'book', 'appointment',
        ],
    },
    {
        agent: 'health',
        keywords: [
            'pain', 'fever', 'bleeding', 'discharge', 'breastfeed', 'milk', 'recovery',
            'c-section', 'normal delivery', 'exercise', 'diet', 'nutrition', 'iron',
            'vitamin', 'medicine', 'trimester', 'pregnancy', 'postpartum', 'baby',
            'mental health', 'depression', 'mood', 'sleep', 'rest', 'wound', 'stitch',
        ],
    },
];

const classifyIntent = (question) => {
    const lower = question.toLowerCase();
    for (const rule of INTENT_RULES) {
        if (rule.keywords.some((kw) => lower.includes(kw))) {
            logger.info(`[AgentRouter] Intent classified as '${rule.agent}'`);
            return rule.agent;
        }
    }
    logger.info(`[AgentRouter] No specific intent matched — defaulting to 'health'`);
    return 'health';
};

/**
 * Route the question to the appropriate specialized agent (stateless).
 *
 * @param {string} question
 * @returns {Promise<{ answer: string, sources: Array, agent: string, agent_label: string }>}
 */
export const routeToAgent = async (question) => {
    const intent = classifyIntent(question);

    let result;
    switch (intent) {
        case 'research': result = await runResearchAgent(question); break;
        case 'scheme': result = await runSchemeAgent(question); break;
        case 'knowledge': result = await runKnowledgeAgent(question); break;
        default: result = await runHealthAgent(question);
    }

    const isEmpty =
        !result.answer ||
        result.answer.toLowerCase().includes('could not find relevant information') ||
        result.answer.trim().length < 20;

    if (isEmpty) {
        logger.warn(`[AgentRouter] Agent '${intent}' returned no result — trying cross-source fallback.`);
        const fallback = await runRagChain(question, {});
        return { answer: fallback.answer, sources: fallback.sources, agent: 'general', agent_label: 'General Afterma Assistant' };
    }

    return result;
};
