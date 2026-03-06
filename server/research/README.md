# Afterma Research Papers — Directory

## Purpose
This folder stores research documents that power the **Research Analysis Agent**.

Place any of the following file types here:
- `.pdf` — Research papers, medical journals, theses (parsed via pdf-parse)
- `.txt` — Extracted text from research papers
- `.md` — Markdown-formatted research summaries

## How Ingestion Works
When you run `npm run ingest:research`, the system will:
1. Read all PDF/TXT/MD files from this directory
2. Parse PDFs using `pdf-parse`
3. Split content into semantic chunks (~800 characters with 100-character overlap)
4. Generate OpenAI embeddings for each chunk
5. Store embeddings in Supabase with metadata: `{ source_type: 'research', filename }`

## Recommended Research Documents to Add
- Afterma maternal health research papers
- WHO guidelines on maternal nutrition
- Indian Council of Medical Research (ICMR) publications
- Studies on postpartum depression in Indian women
- Research on traditional Indian postpartum practices (Ayurveda)
- UNICEF reports on maternal and child nutrition in India
- Studies on iron-deficiency anemia in Indian mothers

## Existing Source Documents
The `/docs` folder at the project root contains some source documents:
- `afterma01.txt` — Primary Afterma knowledge document
- `afterma02.txt` — Secondary Afterma knowledge document
- `afterma_complete.pdf` — Full Afterma research compendium
- `afterma_knowledge_base.pdf` — Afterma knowledge base PDF

**To ingest these existing docs**, copy them here:
```bash
cp /path/to/AiChatBot-main/docs/afterma01.txt server/research/
cp /path/to/AiChatBot-main/docs/afterma02.txt server/research/
cp /path/to/AiChatBot-main/docs/afterma_complete.pdf server/research/
cp /path/to/AiChatBot-main/docs/afterma_knowledge_base.pdf server/research/
```
Then run: `npm run ingest:research`

## Format Notes
- PDFs are parsed for text content; tables and charts may not extract perfectly
- For best results, use text-based PDFs (not scanned images)
- For scanned PDFs, use OCR tools first (e.g., `tesseract-ocr`)
