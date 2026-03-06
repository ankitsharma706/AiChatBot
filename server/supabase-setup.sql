-- ═══════════════════════════════════════════════════════════════════════
-- Afterma AI Backend — Supabase pgvector Setup SQL
-- Run this ONCE in the Supabase SQL Editor before ingesting documents.
-- Dashboard URL: https://app.supabase.com → Your Project → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the documents table
CREATE TABLE IF NOT EXISTS documents (
  id          BIGSERIAL PRIMARY KEY,
  content     TEXT             NOT NULL,
  metadata    JSONB            DEFAULT '{}',
  embedding   VECTOR(1536),    -- text-embedding-3-small dimension
  created_at  TIMESTAMPTZ      DEFAULT NOW()
);

-- 3. Create an HNSW index for fast approximate nearest-neighbor searches
--    (Better performance than IVFFlat for < 1M rows)
CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
  ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Create the match_documents RPC function
--    Called by LangChain SupabaseVectorStore and vectorSearch.service.js
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding  VECTOR(1536),
  match_count      INT     DEFAULT 5,
  filter           JSONB   DEFAULT '{}'
)
RETURNS TABLE (
  id          BIGINT,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE
    CASE
      WHEN filter = '{}' THEN TRUE
      ELSE d.metadata @> filter
    END
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Enable Row Level Security (recommended for production)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 6. Policy: Allow service role (your backend) full access
CREATE POLICY "Service role full access"
  ON documents
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERY — run after setup to check everything is working:
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT COUNT(*) FROM documents;
-- SELECT DISTINCT metadata->>'source_type' AS source_type FROM documents;
