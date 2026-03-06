# Afterma AI — MongoDB Atlas Vector Search Setup Guide

This replaces the Supabase pgvector setup. Follow these steps **once** before running ingestion.

---

## Option A — MongoDB Atlas (Recommended for Production)

### 1. Create a Free Cluster
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → **New Project** → **Build a Database**
2. Choose **M0 Free Tier** and any cloud region
3. Create a database user with Read/Write permissions
4. Add your IP to the Access List (or use `0.0.0.0/0` for development)
5. Copy the **Connection String** → paste into `.env` as `MONGODB_URI`

### 2. Create the Database and Collection
The ingestion script will create these automatically on first run.

Or create manually in Atlas:
- Database: `afterma_ai` (or your `MONGODB_DB_NAME`)
- Collection: `documents` (or your `MONGODB_COLLECTION`)

### 3. Create the Vector Search Index

In Atlas UI → **Search** → **Create Search Index** → select **Atlas Vector Search (JSON editor)**:

Select your collection: `afterma_ai.documents`

Paste this JSON definition:

```json
{
  "fields": [
    {
      "numDimensions": 1536,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    },
    {
      "path": "metadata.source_type",
      "type": "filter"
    },
    {
      "path": "metadata.source",
      "type": "filter"
    }
  ]
}
```

- **Index Name**: `vector_index` (must match `MONGODB_INDEX_NAME` in `.env`)
- Click **Create Search Index** — takes ~1–2 minutes to build

> [!IMPORTANT]
> The `numDimensions: 1536` matches `text-embedding-3-small`. If you switch to a different embedding model, update this value.

---

## Option B — Local MongoDB (Development Only)

> [!NOTE]
> Local MongoDB does NOT support Atlas Vector Search. For local development you can still run full-text search, but semantic vector search requires Atlas (free tier is sufficient).

Install MongoDB locally:
```bash
# Ubuntu / Debian
sudo apt install mongodb

# macOS
brew install mongodb-community

# Start
sudo systemctl start mongod   # Linux
brew services start mongodb-community  # macOS
```

Set in `.env`:
```
MONGODB_URI=mongodb://localhost:27017
```

For local testing, the vector store will function but semantic similarity search requires Atlas.

---

## Verification

After running `npm run ingest`, verify in Atlas:

```javascript
// In Atlas Data Explorer → afterma_ai → documents → Filter:
{ "metadata.source_type": "docs" }
```

You should see documents with `content`, `embedding` (1536-element array), and `metadata` fields.

You can also run a quick count via MongoDB shell:
```js
use afterma_ai
db.documents.countDocuments()
db.documents.distinct("metadata.source_type")
```
