import { runRagChain } from '../chains/ragChain.js';
import { logger } from '../utils/logger.js';

const HEALTH_SYSTEM_NOTE = `
You are the Afterma Health Guidance Agent. Your role is to:
- Answer maternal health questions using Afterma health guidelines and documentation.
- Provide practical, safe, culturally sensitive advice for Indian mothers.
- Use warm language: "As per Afterma health guidelines...", "For your recovery..."
- Always recommend consulting a doctor for clinical decisions.
`.trim();

export const runHealthAgent = async (question) => {
    logger.info(`[HealthAgent] Activated for: "${question.slice(0, 60)}..."`);
    const augmentedQ = `${HEALTH_SYSTEM_NOTE}\n\nUser Question: ${question}`;
    const result = await runRagChain(augmentedQ, { source_type: 'docs' });
    return { ...result, agent: 'health', agent_label: 'Health Guidance Agent' };
};
