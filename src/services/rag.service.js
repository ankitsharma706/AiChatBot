import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '../../docs');

// ─── Cache ────────────────────────────────────────────────────────────────────
let docsCache = null;

const loadAllDocs = async () => {
  if (docsCache) return docsCache;

  let files = [];
  try {
    files = await readdir(DOCS_DIR);
  } catch {
    console.warn('[RAG] docs/ folder not found or empty — skipping RAG context.');
    docsCache = [];
    return docsCache;
  }

  // Load only text/markdown files (skip PDFs — they need a parser)
  const readable = files.filter(f => /\.(txt|md)$/i.test(f));
  const contents = await Promise.all(
    readable.map(async (file) => {
      try {
        const text = await readFile(path.join(DOCS_DIR, file), 'utf-8');
        return { file, text };
      } catch {
        return null;
      }
    })
  );

  docsCache = contents.filter(Boolean);
  console.log(`[RAG] Loaded ${docsCache.length} doc(s) from docs/:`, docsCache.map(d => d.file));
  return docsCache;
};

// ─── Split doc into paragraph-level chunks ────────────────────────────────────
const chunkDoc = (text, chunkSize = 600) => {
  // Split on double newlines (sections/paragraphs), then re-join if too small
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length <= chunkSize) {
      current = current ? current + '\n\n' + para : para;
    } else {
      if (current) chunks.push(current);
      // If single paragraph is still too long, slice it
      if (para.length > chunkSize) {
        for (let i = 0; i < para.length; i += chunkSize) {
          chunks.push(para.slice(i, i + chunkSize));
        }
        current = '';
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

// ─── Score a text block against keywords ─────────────────────────────────────
const scoreText = (text, keywords) => {
  const lower = text.toLowerCase();
  return keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
};

// ─── Main export ──────────────────────────────────────────────────────────────
export const loadDocsContext = async (question) => {
  const docs = await loadAllDocs();
  if (!docs.length) return '';

  // Extract keywords — allow short words (>=2 chars) to catch Hindi terms
  const keywords = question
    .toLowerCase()
    .split(/[\s,।?!.]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);

  if (!keywords.length) return '';

  // For each doc, find the best-matching chunk(s)
  const allChunks = [];

  for (const { file, text } of docs) {
    const chunks = chunkDoc(text, 600);
    for (const chunk of chunks) {
      const score = scoreText(chunk, keywords);
      if (score > 0) {
        allChunks.push({ file, chunk, score });
      }
    }
  }

  if (!allChunks.length) {
    // Fallback: no keyword match — return opening of the most relevant doc
    console.warn('[RAG] No keyword match found — using fallback doc opening.');
    const first = docs[0];
    return `[From: ${first.file}]\n${first.text.slice(0, 800).trim()}`;
  }

  // Sort best chunks first, then deduplicate by file to get variety
  allChunks.sort((a, b) => b.score - a.score);

  // Pick top chunks, max 3000 chars total, avoid repeating the same file too much
  const seen = {};
  const selected = [];
  let totalChars = 0;
  const MAX_CHARS = 3000;
  const MAX_PER_FILE = 2; // allow at most 2 chunks per file

  for (const item of allChunks) {
    if (totalChars >= MAX_CHARS) break;
    seen[item.file] = (seen[item.file] || 0);
    if (seen[item.file] >= MAX_PER_FILE) continue;

    const remaining = MAX_CHARS - totalChars;
    const text = item.chunk.slice(0, remaining).trim();
    selected.push(`[From: ${item.file}]\n${text}`);
    totalChars += text.length;
    seen[item.file]++;
  }

  console.log(`[RAG] Injecting ${selected.length} chunk(s) (${totalChars} chars) into prompt.`);
  return selected.join('\n\n---\n\n');
};
