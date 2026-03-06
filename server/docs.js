/**
 * docs.js — Load all local knowledge base documents.
 * Returns a flat array of { text, source, source_type } objects.
 * Supports .json (array or object) and .md / .txt files.
 */
import { readFile, readdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;

const DOC_DIRS = [
    { path: join(__dirname, 'docs'), source_type: 'health' },
    { path: join(__dirname, 'knowledgebase'), source_type: 'knowledge' },
    { path: join(__dirname, 'research'), source_type: 'research' },
    { path: join(__dirname, 'gov-schemes'), source_type: 'scheme' },
    { path: join(__dirname, '../docs'), source_type: 'dataset' },
];

// Singleton store
let _docs = null;

/**
 * Convert a JSON value to readable text chunks.
 * Handles arrays of objects, plain objects, and primitives.
 */
function jsonToText(data, source) {
    if (Array.isArray(data)) {
        return data.map((item) => {
            if (typeof item === 'object' && item !== null) {
                return Object.entries(item)
                    .map(([k, v]) => {
                        const val = Array.isArray(v) ? v.join(', ') : v;
                        return `${k}: ${val}`;
                    })
                    .join('\n');
            }
            return String(item);
        });
    }
    if (typeof data === 'object' && data !== null) {
        return [
            Object.entries(data)
                .map(([k, v]) => {
                    const val = Array.isArray(v) ? v.join(', ') : v;
                    return `${k}: ${val}`;
                })
                .join('\n'),
        ];
    }
    return [String(data)];
}

/**
 * Split markdown/text into chunks of ~800 chars with some overlap.
 */
function splitText(text, chunkSize = 800, overlap = 100) {
    if (text.length <= chunkSize) return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        chunks.push(text.slice(start, start + chunkSize));
        start += chunkSize - overlap;
    }
    return chunks;
}

export async function getDocs() {
    if (_docs) return _docs;

    const all = [];

    for (const { path: dir, source_type } of DOC_DIRS) {
        let files;
        try { files = await readdir(dir); }
        catch { continue; }

        for (const file of files) {
            const ext = extname(file).toLowerCase();
            if (!['.json', '.md', '.txt'].includes(ext)) continue;

            let raw;
            try { raw = await readFile(join(dir, file), 'utf-8'); }
            catch { continue; }

            const src = basename(file);

            if (ext === '.json') {
                let data;
                try { data = JSON.parse(raw); } catch { continue; }
                const texts = jsonToText(data, src);
                for (const text of texts) {
                    all.push({ text, source: src, source_type });
                }
            } else {
                for (const chunk of splitText(raw)) {
                    all.push({ text: chunk, source: src, source_type });
                }
            }
        }
    }

    _docs = all;
    console.log(`[Docs] Loaded ${_docs.length} chunks from local files.`);
    return _docs;
}

/**
 * Keyword search — returns top-k most relevant chunks.
 * Optionally filter by source_type.
 */
export function searchDocs(query, { source_type = null, k = 5 } = {}) {
    if (!_docs) return [];

    const words = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3);

    let pool = source_type
        ? _docs.filter((d) => d.source_type === source_type)
        : _docs;

    if (pool.length === 0) pool = _docs; // fallback to all

    const scored = pool
        .map((doc) => {
            const text = doc.text.toLowerCase();
            const score = words.reduce((acc, w) => {
                const count = (text.match(new RegExp(w, 'g')) || []).length;
                return acc + count;
            }, 0);
            return { ...doc, score };
        })
        .filter((d) => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

    return scored;
}
