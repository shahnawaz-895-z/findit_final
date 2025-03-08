# FindIt Advanced Matching System

This is an advanced item matching system for the FindIt app that combines semantic embeddings with keyword matching and metadata to provide high-quality matches between lost and found items.

## Features

- **Semantic Embedding-Based Matching (60%)**: Uses transformer models to generate embeddings for item descriptions and calculates semantic similarity.
- **Enhanced Keyword Matching (15%)**: Improved word-based matching with TF-IDF weighting to give more importance to distinctive words.
- **Category Matching (10%)**: Exact matching of item categories.
- **Location Matching (10%)**: Text-based location similarity calculation.
- **Date Proximity (5%)**: Time-based proximity scoring to prioritize items found close to when they were lost.

## Installation

To install the required dependencies, run:

```bash
chmod +x install_dependencies.sh
./install_dependencies.sh
```

Or manually:

```bash
npm install @xenova/transformers natural stopwords
```

## How It Works

1. **Embedding Generation**: When an item is created, its description is processed through a transformer model to generate a semantic embedding vector.
2. **Matching Process**: When searching for matches, the system:
   - Pre-filters items by category for efficiency
   - Calculates semantic similarity between descriptions (60%)
   - Performs enhanced keyword matching (15%)
   - Checks for exact category matches (10%)
   - Calculates location similarity (10%)
   - Considers date proximity (5%)
3. **Scoring**: Combines all signals into a final match score (0-100)
4. **Filtering**: Returns only matches above a quality threshold (30%)

## Performance Optimizations

- **Embedding Caching**: Frequently used embeddings are cached to improve performance
- **Pre-filtering**: Basic filtering is applied before the more expensive semantic matching
- **Asynchronous Processing**: Embeddings are generated asynchronously when items are created

## Future Improvements

- Replace the embedding model with a fine-tuned model specific to lost-and-found items
- Implement vector database for more efficient similarity search at scale
- Add image similarity as an additional matching signal
- Incorporate user feedback to improve matching quality over time 