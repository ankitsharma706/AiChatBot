/**
 * ingestResearch.js — Ingestion script for /research folder
 *
 * Run once (or when research papers are added):
 *   npm run ingest:research
 *
 * Reads:
 *   server/research/*.pdf   → parsed via pdf-parse
 *   server/research/*.txt
 *   server/research/*.md
 *
 * Chunks → Embeds → Upserts to Supabase pgvector with source_type='research'
 */

import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { ingestText } from './services/ingestion.service.js';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const RESEARCH_DIR = path.join(__dirname, 'research');
const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.md'];

/**
 * Parse a PDF file and return its text content.
 */
const parsePDF = async (filePath) => {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
};

/**
 * Read and return text from supported file formats.
 */
const readDocument = async (filePath, ext) => {
    if (ext === '.pdf') return parsePDF(filePath);
    return readFile(filePath, 'utf-8');
};

const runResearchIngestion = async () => {
    logger.info('========================================');
    logger.info('🔬 Afterma Research Ingestion Pipeline');
    logger.info('========================================\n');

    let files;
    try {
        files = await readdir(RESEARCH_DIR);
    } catch {
        logger.error(`[ResearchIngestion] research/ directory not found at: ${RESEARCH_DIR}`);
        logger.info('Create the directory and add PDF/TXT/MD research files, then re-run.');
        process.exit(1);
    }

    const matchedFiles = files.filter((f) =>
        SUPPORTED_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext))
    );

    if (matchedFiles.length === 0) {
        logger.warn('[ResearchIngestion] No PDF, TXT, or MD files found in research/.');
        logger.info('Add research papers to server/research/ and run again.');
        process.exit(0);
    }

    logger.info(`Found ${matchedFiles.length} research document(s).\n`);

    let totalChunks = 0;
    let totalFiles = 0;
    const errors = [];

    for (const filename of matchedFiles) {
        const filePath = path.join(RESEARCH_DIR, filename);
        const ext = path.extname(filename).toLowerCase();

        try {
            logger.info(`→ Processing: ${filename} (${ext.toUpperCase().slice(1)})`);
            const text = await readDocument(filePath, ext);

            if (!text || text.trim().length < 50) {
                logger.warn(`  ⚠️  Content too short or empty — skipping: ${filename}`);
                continue;
            }

            const metadata = {
                source_type: 'research',
                source: filename,
                filename,
                format: ext.slice(1).toUpperCase(),
                directory: 'research',
                ingested_at: new Date().toISOString(),
            };

            const count = await ingestText(text, metadata);
            totalChunks += count;
            totalFiles++;
            logger.info(`  ✅ ${filename} → ${count} chunk(s) ingested\n`);

        } catch (err) {
            logger.error(`  ❌ Failed to process ${filename}: ${err.message}`);
            errors.push({ file: filename, error: err.message });
        }
    }

    console.log('\n════════════════════════════════════════');
    logger.info('🔬 Research Ingestion Complete!');
    logger.info(`   Files processed : ${totalFiles}`);
    logger.info(`   Total chunks    : ${totalChunks}`);
    if (errors.length > 0) {
        logger.warn(`   Errors          : ${errors.length}`);
        errors.forEach((e) => logger.warn(`     - ${e.file}: ${e.error}`));
    }
    console.log('════════════════════════════════════════\n');

    process.exit(0);
};

runResearchIngestion().catch((err) => {
    logger.error(`[ResearchIngestion] Fatal error: ${err.message}`);
    process.exit(1);
});
