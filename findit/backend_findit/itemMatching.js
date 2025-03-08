/**
 * itemMatching.js
 * Advanced item matching system for FindIt app
 * Combines semantic embeddings with keyword matching and metadata
 */

import { pipeline } from '@xenova/transformers';
import natural from 'natural';
import stopwords from 'stopwords';

const tokenizer = new natural.WordTokenizer();
const stopwordsList = stopwords.english;

// Common word frequency dictionary (can be expanded)
const commonWordFrequency = {
  'the': 100, 'and': 95, 'with': 90, 'that': 85, 'this': 80,
  'from': 75, 'have': 70, 'what': 65, 'some': 60, 'there': 55,
  'phone': 50, 'wallet': 45, 'keys': 40, 'card': 35, 'bag': 30,
  'black': 25, 'blue': 24, 'red': 23, 'white': 22, 'green': 21,
  'small': 20, 'large': 19, 'medium': 18
};

// Cache for embeddings to improve performance
const embeddingCache = new Map();

/**
 * Generate text embeddings using a lightweight transformer model
 * @param {string} text - The text to encode
 * @returns {Promise<Float32Array>} - The embedding vector
 */
async function getEmbedding(text) {
  // Check cache first
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }

  try {
    // Use feature-extraction pipeline with MiniLM model
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const result = await extractor(text, { pooling: 'mean', normalize: true });
    
    // Get the embedding from the result
    const embedding = result.data;
    
    // Cache the result
    embeddingCache.set(text, embedding);
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return a zero vector as fallback
    return new Float32Array(384).fill(0);
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {Float32Array|Array<number>} embedding1 - First embedding vector
 * @param {Float32Array|Array<number>} embedding2 - Second embedding vector
 * @returns {number} - Similarity score between 0 and 1
 */
function cosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Enhanced keyword matching with TF-IDF weighting
 * @param {string} lostDesc - Description of the lost item
 * @param {string} foundDesc - Description of the found item
 * @returns {number} - Similarity score between 0 and 1
 */
function enhancedKeywordMatching(lostDesc, foundDesc) {
  if (!lostDesc || !foundDesc) {
    return 0;
  }
  
  // Tokenize and normalize
  const lostWords = tokenizer.tokenize(lostDesc.toLowerCase());
  const foundWords = tokenizer.tokenize(foundDesc.toLowerCase());
  
  // Remove stopwords and short words
  const filteredLostWords = lostWords.filter(w => 
    w.length > 3 && !stopwordsList.includes(w)
  );
  const filteredFoundWords = foundWords.filter(w => 
    w.length > 3 && !stopwordsList.includes(w)
  );
  
  if (filteredLostWords.length === 0 || filteredFoundWords.length === 0) {
    return 0;
  }
  
  // Count matching words with importance weighting
  let score = 0;
  let totalWeight = 0;
  
  for (const word of filteredLostWords) {
    // Calculate word importance (inverse of frequency)
    const wordImportance = 1 + (1 / Math.max(1, commonWordFrequency[word] || 1));
    totalWeight += wordImportance;
    
    if (filteredFoundWords.includes(word)) {
      score += wordImportance;
    }
  }
  
  return totalWeight > 0 ? score / totalWeight : 0;
}

/**
 * Calculate location similarity based on text matching
 * @param {string} location1 - First location string
 * @param {string} location2 - Second location string
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateLocationSimilarity(location1, location2) {
  if (!location1 || !location2) {
    return 0;
  }
  
  // Split locations into parts (city, area, etc.)
  const loc1Parts = location1.toLowerCase().split(/,|\s+/).filter(p => p.length > 2);
  const loc2Parts = location2.toLowerCase().split(/,|\s+/).filter(p => p.length > 2);
  
  if (loc1Parts.length === 0 || loc2Parts.length === 0) {
    return 0;
  }
  
  // Count matching parts
  const matchingParts = loc1Parts.filter(part => loc2Parts.includes(part)).length;
  
  return matchingParts / Math.max(loc1Parts.length, 1);
}

/**
 * Calculate date/time proximity score
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {number} - Proximity score between 0 and 1
 */
function calculateDateProximity(date1, date2) {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Calculate difference in days
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Score decreases as days increase (max 30 days difference)
    return Math.max(0, 1 - (diffDays / 30));
  } catch (error) {
    return 0;
  }
}

/**
 * Main matching function that combines all signals
 * @param {Object} lostItem - Lost item data
 * @param {Array<Object>} foundItems - Array of found items to match against
 * @returns {Promise<Array<Object>>} - Scored and sorted matches
 */
async function findMatches(lostItem, foundItems) {
  if (!lostItem || !foundItems || foundItems.length === 0) {
    return [];
  }
  
  // Pre-compute lost item embedding
  let lostItemEmbedding = null;
  if (lostItem.description) {
    lostItemEmbedding = await getEmbedding(lostItem.description);
  }
  
  // Process each found item
  const scoredMatches = await Promise.all(foundItems.map(async (item) => {
    let totalScore = 0;
    const weights = {
      semantic: 0.6,  // 60% weight for semantic similarity
      keyword: 0.15,  // 15% weight for keyword matching
      category: 0.1,  // 10% weight for category matching
      location: 0.1,  // 10% weight for location matching
      date: 0.05      // 5% weight for date proximity
    };
    
    // 1. Semantic similarity (60% of score)
    let semanticScore = 0;
    if (lostItem.description && item.description && lostItemEmbedding) {
      const itemEmbedding = await getEmbedding(item.description);
      semanticScore = cosineSimilarity(lostItemEmbedding, itemEmbedding);
    }
    totalScore += semanticScore * weights.semantic * 100;
    
    // 2. Keyword matching (15% of score)
    let keywordScore = 0;
    if (lostItem.description && item.description) {
      keywordScore = enhancedKeywordMatching(lostItem.description, item.description);
    }
    totalScore += keywordScore * weights.keyword * 100;
    
    // 3. Category matching (10% of score)
    let categoryScore = 0;
    if (lostItem.category && item.category) {
      categoryScore = lostItem.category === item.category ? 1 : 0;
    }
    totalScore += categoryScore * weights.category * 100;
    
    // 4. Location matching (10% of score)
    let locationScore = 0;
    if (lostItem.location && item.location) {
      locationScore = calculateLocationSimilarity(lostItem.location, item.location);
    }
    totalScore += locationScore * weights.location * 100;
    
    // 5. Date proximity (5% of score)
    let dateScore = 0;
    if (lostItem.date && item.date) {
      dateScore = calculateDateProximity(lostItem.date, item.date);
    }
    totalScore += dateScore * weights.date * 100;
    
    // Return the item with its match score
    return {
      ...item,
      matchScore: Math.round(totalScore),
      matchDetails: {
        semanticScore: Math.round(semanticScore * 100),
        keywordScore: Math.round(keywordScore * 100),
        categoryScore: Math.round(categoryScore * 100),
        locationScore: Math.round(locationScore * 100),
        dateScore: Math.round(dateScore * 100)
      }
    };
  }));
  
  // Sort by match score (highest first)
  scoredMatches.sort((a, b) => b.matchScore - a.matchScore);
  
  // Filter to matches above threshold (30%)
  return scoredMatches.filter(match => match.matchScore > 30);
}

/**
 * Precompute and store embeddings for an item
 * @param {Object} item - The item to precompute embeddings for
 * @returns {Promise<Object>} - The item with added embedding
 */
async function precomputeItemEmbedding(item) {
  if (!item || !item.description) {
    return item;
  }
  
  try {
    const embedding = await getEmbedding(item.description);
    return {
      ...item,
      _embedding: embedding
    };
  } catch (error) {
    console.error('Error precomputing embedding:', error);
    return item;
  }
}

/**
 * Clear the embedding cache
 */
function clearEmbeddingCache() {
  embeddingCache.clear();
}

export {
  findMatches,
  getEmbedding,
  cosineSimilarity,
  enhancedKeywordMatching,
  calculateLocationSimilarity,
  calculateDateProximity,
  precomputeItemEmbedding,
  clearEmbeddingCache
}; 