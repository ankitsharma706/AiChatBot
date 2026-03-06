/**
 * ingestDocs.js — Ingestion script for /docs, /knowledgebase, /gov-schemes
 *
 * Run once (or when documents change):
 *   npm run ingest
 *
 * Reads:
 *   server/docs/*.{txt,md}
 *   server/knowledgebase/*.{txt,md}
 *   server/gov-schemes/*.json
 *
 * Chunks → Embeds → Upserts to Supabase pgvector
 */

import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ingestText } from './services/ingestion.service.js';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Directory → source_type mapping ─────────────────────────────────────────
const SOURCE_DIRS = [
    { dir: 'docs', source_type: 'docs', extensions: ['.txt', '.md'] },
    { dir: 'knowledgebase', source_type: 'knowledgebase', extensions: ['.txt', '.md'] },
    { dir: 'gov-schemes', source_type: 'scheme', extensions: ['.json', '.txt', '.md'] },
];

/**
 * Read a file and return its text content.
 * JSON files are converted to pretty-printed text for embedding.
 */
const readFileText = async (filePath, ext) => {
    const raw = await readFile(filePath, 'utf-8');
    if (ext === '.json') {
        try {
            const parsed = JSON.parse(raw);
            // Convert JSON to readable text for embedding
            return JSON.stringify(parsed, null, 2);
        } catch {
            return raw;
        }
    }
    return raw;
};

const runIngestion = async () => {
    logger.info('========================================');
    logger.info('📥 Afterma Docs Ingestion Pipeline');
    logger.info('========================================\n');

    let totalChunks = 0;
    let totalFiles = 0;
    const errors = [];

    for (const { dir, source_type, extensions } of SOURCE_DIRS) {
        const dirPath = path.join(__dirname, dir);

        let files;
        try {
            files = await readdir(dirPath);
        } catch {
            logger.warn(`[Ingestion] Directory not found — skipping: ${dir}/`);
            continue;
        }

        const matchedFiles = files.filter((f) =>
            extensions.some((ext) => f.toLowerCase().endsWith(ext))
        );

        if (matchedFiles.length === 0) {
            logger.info(`[Ingestion] No matching files in ${dir}/ — skipping.`);
            continue;
        }

        logger.info(`\n📂 Processing ${dir}/ (${matchedFiles.length} file(s))...`);

        for (const filename of matchedFiles) {
            const filePath = path.join(dirPath, filename);
            const ext = path.extname(filename).toLowerCase();

            try {
                logger.info(`  → Reading: ${filename}`);
                const text = await readFileText(filePath, ext);

                if (!text.trim()) {
                    logger.warn(`  ⚠️  Empty file, skipping: ${filename}`);
                    continue;
                }

                const metadata = {
                    source_type,
                    source: filename,
                    directory: dir,
                    ingested_at: new Date().toISOString(),
                };

                const count = await ingestText(text, metadata);
                totalChunks += count;
                totalFiles++;
                logger.info(`  ✅ ${filename} → ${count} chunk(s) ingested`);

            } catch (err) {
                logger.error(`  ❌ Failed to ingest ${filename}: ${err.message}`);
                errors.push({ file: filename, error: err.message });
            }
        }
    }

    console.log('\n════════════════════════════════════════');
    logger.info(`📊 Ingestion Complete!`);
    logger.info(`   Files processed : ${totalFiles}`);
    logger.info(`   Total chunks    : ${totalChunks}`);
    if (errors.length > 0) {
        logger.warn(`   Errors          : ${errors.length}`);
        errors.forEach((e) => logger.warn(`     - ${e.file}: ${e.error}`));
    }
    console.log('════════════════════════════════════════\n');

    process.exit(0);
};

runIngestion().catch((err) => {
    logger.error(`[Ingestion] Fatal error: ${err.message}`);
    process.exit(1);
});
