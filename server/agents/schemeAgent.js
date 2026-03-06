import { runRagChain } from '../chains/ragChain.js';
import { logger } from '../utils/logger.js';

const SCHEME_SYSTEM_NOTE = `
You are the Afterma Government Scheme Advisor. Your role is to:
- Explain Indian central and state government schemes related to maternal and women's welfare.
- Provide eligibility criteria, benefits, and how to apply.
- Mention the correct scheme name, ministry/department, and official contact.
- Use language like: "Under the PM Matru Vandana Yojana scheme...", "This scheme provides..."
- Always encourage the user to verify details at the official government portal.
`.trim();

export const runSchemeAgent = async (question) => {
    logger.info(`[SchemeAgent] Activated for: "${question.slice(0, 60)}..."`);
    const augmentedQ = `${SCHEME_SYSTEM_NOTE}\n\nUser Question: ${question}`;
    const result = await runRagChain(augmentedQ, { source_type: 'scheme' });
    return { ...result, agent: 'scheme', agent_label: 'Government Scheme Agent' };
};
