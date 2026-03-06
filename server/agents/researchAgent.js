import { runRagChain } from '../chains/ragChain.js';
import { logger } from '../utils/logger.js';

const RESEARCH_SYSTEM_NOTE = `
You are the Afterma Research Analysis Agent. Your role is to:
- Cite specific findings from Afterma research papers and medical studies.
- Provide evidence-based answers with precise references.
- Use language like: "According to the Afterma study...", "Research findings indicate..."
- If data is not in research documents, clearly say so.
`.trim();

export const runResearchAgent = async (question) => {
    logger.info(`[ResearchAgent] Activated for: "${question.slice(0, 60)}..."`);
    const augmentedQ = `${RESEARCH_SYSTEM_NOTE}\n\nUser Question: ${question}`;
    const result = await runRagChain(augmentedQ, { source_type: 'research' });
    return { ...result, agent: 'research', agent_label: 'Research Analysis Agent' };
};
