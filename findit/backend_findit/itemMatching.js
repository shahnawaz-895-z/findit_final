/**
 * itemMatching.js
 * Advanced item matching system for FindIt app
 * Combines semantic embeddings with keyword matching and metadata
 * Includes category-specific attribute matching
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
  const lostWords = lostDesc.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const foundWords = foundDesc.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  
  if (lostWords.length === 0 || foundWords.length === 0) {
    return 0;
  }
  
  // Count matching words
  let matchCount = 0;
  for (const word of lostWords) {
    if (foundWords.includes(word)) {
      matchCount++;
    }
  }
  
  // Calculate similarity score (0-1)
  const totalWords = Math.max(lostWords.length, foundWords.length);
  return totalWords > 0 ? matchCount / totalWords : 0;
}

/**
 * Calculate similarity between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // If strings are exactly equal (case-insensitive)
  if (s1 === s2) return 1;
  
  // If one string contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }
  
  // Calculate Levenshtein distance for fuzzy matching
  const m = s1.length;
  const n = s2.length;
  
  // Handle empty strings
  if (m === 0) return 0;
  if (n === 0) return 0;
  
  // Initialize the distance matrix
  const d = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
  
  // Initialize the first row and column
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  // Calculate normalized similarity score (1 - normalized distance)
  const maxLength = Math.max(m, n);
  const distance = d[m][n];
  return 1 - (distance / maxLength);
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
 * Get weight configuration based on item category
 * @param {string} category - The item category
 * @returns {Object} - Category-specific weight configuration
 */
function getCategoryWeights(category) {
  const weights = {
    // Default weights
    default: {
      semantic: 0.25,    // 25% weight for semantic similarity
      keyword: 0.15,     // 15% weight for keyword matching
      category: 0.1,     // 10% weight for category matching
      location: 0.1,     // 10% weight for location matching
      date: 0.05,        // 5% weight for date proximity
      brand: 0.1,        // 10% weight for brand matching
      model: 0.05,       // 5% weight for model matching
      color: 0.1,        // 10% weight for color matching
      attributes: 0.1    // 10% weight for other attributes
    },
    
    // Electronics-specific weights
    Electronics: {
      semantic: 0.15,   // 15% weight for semantic similarity
      keyword: 0.1,     // 10% weight for keyword matching
      category: 0.05,   // 5% weight for category matching
      location: 0.05,   // 5% weight for location matching
      date: 0.05,       // 5% weight for date proximity
      brand: 0.2,       // 20% weight for brand matching
      model: 0.25,      // 25% weight for model matching
      color: 0.1,       // 10% weight for color matching
      serialNumber: 0.05 // 5% weight for serial number matching
    },
    
    // Accessories-specific weights
    Accessories: {
      semantic: 0.2,     // 20% weight for semantic similarity
      keyword: 0.1,      // 10% weight for keyword matching
      category: 0.05,    // 5% weight for category matching
      location: 0.1,     // 10% weight for location matching
      date: 0.05,        // 5% weight for date proximity
      brand: 0.15,       // 15% weight for brand matching
      material: 0.15,    // 15% weight for material matching
      color: 0.2         // 20% weight for color matching
    },
    
    // Clothing-specific weights
    Clothing: {
      semantic: 0.15,    // 15% weight for semantic similarity
      keyword: 0.1,      // 10% weight for keyword matching
      category: 0.05,    // 5% weight for category matching
      location: 0.1,     // 10% weight for location matching
      date: 0.05,        // 5% weight for date proximity
      brand: 0.15,       // 15% weight for brand matching
      color: 0.2,        // 20% weight for color matching
      size: 0.15,        // 15% weight for size matching
      material: 0.05     // 5% weight for material matching
    },
    
    // Documents-specific weights
    Documents: {
      semantic: 0.15,          // 15% weight for semantic similarity
      keyword: 0.1,            // 10% weight for keyword matching
      category: 0.05,          // 5% weight for category matching
      location: 0.1,           // 10% weight for location matching
      date: 0.05,              // 5% weight for date proximity
      documentType: 0.3,       // 30% weight for document type matching
      issuingAuthority: 0.15,  // 15% weight for issuing authority matching
      nameOnDocument: 0.1      // 10% weight for name matching
    },
    
    // Others - use default weights
    Others: null
  };
  
  return weights[category] || weights.default;
}

/**
 * Match items based on category-specific attributes
 * @param {Object} lostItem - Lost item data
 * @param {Object} foundItem - Found item data
 * @param {string} category - The item category
 * @returns {Object} - Score object with total score and detailed scores
 */
function matchCategoryAttributes(lostItem, foundItem, category) {
  // Get category-specific weights
  const weights = getCategoryWeights(category);
  let totalScore = 0;
  const detailedScores = {};
  
  // Base match score from semantic similarity
  let semanticScore = 0;
  if (lostItem.description && foundItem.description) {
    // This would be calculated later with embeddings
    semanticScore = 0.5; // Placeholder value
  }
  
  // Process category-specific attributes
  switch(category) {
    case 'Electronics': {
      // Brand match
      let brandScore = 0;
      if (lostItem.brand && foundItem.brand) {
        brandScore = stringSimilarity(lostItem.brand, foundItem.brand);
      }
      
      // Model match
      let modelScore = 0;
      if (lostItem.model && foundItem.model) {
        modelScore = stringSimilarity(lostItem.model, foundItem.model);
      }
      
      // Color match
      let colorScore = 0;
      if (lostItem.color && foundItem.color) {
        colorScore = stringSimilarity(lostItem.color, foundItem.color);
      }
      
      // Serial number match (exact match gives high score)
      let serialNumberScore = 0;
      if (lostItem.serialNumber && foundItem.serialNumber) {
        serialNumberScore = lostItem.serialNumber.toLowerCase() === foundItem.serialNumber.toLowerCase() ? 1 : 0;
      }
      
      // Calculate weighted score
      totalScore = (semanticScore * weights.semantic) + 
                  (brandScore * weights.brand) + 
                  (modelScore * weights.model) + 
                  (colorScore * weights.color) + 
                  (serialNumberScore * weights.serialNumber);
      
      detailedScores.brand = brandScore;
      detailedScores.model = modelScore;
      detailedScores.color = colorScore;
      detailedScores.serialNumber = serialNumberScore;
      break;
    }
    
    case 'Accessories': {
      // Brand match
      let brandScore = 0;
      if (lostItem.brand && foundItem.brand) {
        brandScore = stringSimilarity(lostItem.brand, foundItem.brand);
      }
      
      // Material match
      let materialScore = 0;
      if (lostItem.material && foundItem.material) {
        materialScore = stringSimilarity(lostItem.material, foundItem.material);
      }
      
      // Color match
      let colorScore = 0;
      if (lostItem.color && foundItem.color) {
        colorScore = stringSimilarity(lostItem.color, foundItem.color);
      }
      
      // Calculate weighted score
      totalScore = (semanticScore * weights.semantic) + 
                  (brandScore * weights.brand) + 
                  (materialScore * weights.material) + 
                  (colorScore * weights.color);
      
      detailedScores.brand = brandScore;
      detailedScores.material = materialScore;
      detailedScores.color = colorScore;
      break;
    }
    
    case 'Clothing': {
      // Brand match
      let brandScore = 0;
      if (lostItem.brand && foundItem.brand) {
        brandScore = stringSimilarity(lostItem.brand, foundItem.brand);
      }
      
      // Color match
      let colorScore = 0;
      if (lostItem.color && foundItem.color) {
        colorScore = stringSimilarity(lostItem.color, foundItem.color);
      }
      
      // Size match
      let sizeScore = 0;
      if (lostItem.size && foundItem.size) {
        sizeScore = stringSimilarity(lostItem.size, foundItem.size);
      }
      
      // Material match
      let materialScore = 0;
      if (lostItem.material && foundItem.material) {
        materialScore = stringSimilarity(lostItem.material, foundItem.material);
      }
      
      // Calculate weighted score
      totalScore = (semanticScore * weights.semantic) + 
                  (brandScore * weights.brand) + 
                  (colorScore * weights.color) + 
                  (sizeScore * weights.size) + 
                  (materialScore * weights.material);
      
      detailedScores.brand = brandScore;
      detailedScores.color = colorScore;
      detailedScores.size = sizeScore;
      detailedScores.material = materialScore;
      break;
    }
    
    case 'Documents': {
      // Document type match
      let documentTypeScore = 0;
      if (lostItem.documentType && foundItem.documentType) {
        documentTypeScore = stringSimilarity(lostItem.documentType, foundItem.documentType);
      }
      
      // Issuing authority match
      let issuingAuthorityScore = 0;
      if (lostItem.issuingAuthority && foundItem.issuingAuthority) {
        issuingAuthorityScore = stringSimilarity(lostItem.issuingAuthority, foundItem.issuingAuthority);
      }
      
      // Name on document match
      let nameOnDocumentScore = 0;
      if (lostItem.nameOnDocument && foundItem.nameOnDocument) {
        nameOnDocumentScore = stringSimilarity(lostItem.nameOnDocument, foundItem.nameOnDocument);
      }
      
      // Calculate weighted score
      totalScore = (semanticScore * weights.semantic) + 
                  (documentTypeScore * weights.documentType) + 
                  (issuingAuthorityScore * weights.issuingAuthority) + 
                  (nameOnDocumentScore * weights.nameOnDocument);
      
      detailedScores.documentType = documentTypeScore;
      detailedScores.issuingAuthority = issuingAuthorityScore;
      detailedScores.nameOnDocument = nameOnDocumentScore;
      break;
    }
    
    default: {
      // Use default attribute matching
      let brandScore = 0;
      if (lostItem.brand && foundItem.brand) {
        brandScore = stringSimilarity(lostItem.brand, foundItem.brand);
      }
      
      let modelScore = 0;
      if (lostItem.model && foundItem.model) {
        modelScore = stringSimilarity(lostItem.model, foundItem.model);
      }
      
      let colorScore = 0;
      if (lostItem.color && foundItem.color) {
        colorScore = stringSimilarity(lostItem.color, foundItem.color);
      }
      
      // Calculate weighted score for Others category
      totalScore = (semanticScore * weights.semantic) + 
                  (brandScore * weights.brand) + 
                  (modelScore * weights.model) + 
                  (colorScore * weights.color);
      
      detailedScores.brand = brandScore;
      detailedScores.model = modelScore;
      detailedScores.color = colorScore;
    }
  }
  
  return {
    totalScore,
    detailedScores
  };
}

/**
 * Main matching function that combines all signals and applies category-specific matching
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
  
  // Get the item category
  const category = lostItem.category || 'Others';
  
  // Get category-specific weights
  const weights = getCategoryWeights(category);
  
  // Process each found item
  const scoredMatches = await Promise.all(foundItems.map(async (foundItem) => {
    let totalScore = 0;
    const matchScores = {};
    
    // 1. Semantic similarity
    let semanticScore = 0;
    if (lostItem.description && foundItem.description && lostItemEmbedding) {
      const itemEmbedding = await getEmbedding(foundItem.description);
      semanticScore = cosineSimilarity(lostItemEmbedding, itemEmbedding);
    }
    matchScores.semanticScore = semanticScore * 100;
    
    // 2. Keyword matching
    let keywordScore = 0;
    if (lostItem.description && foundItem.description) {
      keywordScore = enhancedKeywordMatching(lostItem.description, foundItem.description);
    }
    matchScores.keywordScore = keywordScore * 100;
    
    // 3. Category matching (exact match required)
    const categoryScore = (lostItem.category === foundItem.category) ? 1 : 0;
    matchScores.categoryScore = categoryScore * 100;
    
    // 4. Location matching
    let locationScore = 0;
    if (lostItem.location && foundItem.location) {
      locationScore = calculateLocationSimilarity(lostItem.location, foundItem.location);
    }
    matchScores.locationScore = locationScore * 100;
    
    // 5. Date proximity
    let dateScore = 0;
    if (lostItem.date && foundItem.date) {
      dateScore = calculateDateProximity(lostItem.date, foundItem.date);
    }
    matchScores.dateScore = dateScore * 100;
    
    // 6. Category-specific attribute matching
    const categoryMatchResult = matchCategoryAttributes(lostItem, foundItem, category);
    
    // Calculate base score using general attributes
    totalScore += (semanticScore * weights.semantic) +
                 (keywordScore * weights.keyword) +
                 (categoryScore * weights.category) +
                 (locationScore * weights.location) +
                 (dateScore * weights.date);
    
    // Add scores from category-specific attributes
    // Note: These are already weighted in the matchCategoryAttributes function
    // We normalize to 0-100 scale
    totalScore = (totalScore + categoryMatchResult.totalScore) * 50;
    
    // Ensure score is between 0-100
    totalScore = Math.min(100, Math.max(0, totalScore));
    
    // Add category-specific attribute scores to match details
    Object.keys(categoryMatchResult.detailedScores).forEach(key => {
      matchScores[key + 'Score'] = categoryMatchResult.detailedScores[key] * 100;
    });
    
    // Return the item with its match score and detailed breakdown
    return {
      ...foundItem,
      matchScore: Math.round(totalScore),
      matchDetails: matchScores
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

/**
 * Calculate a comprehensive match score between a lost and found item
 * @param {Object} lostItem - Lost item object
 * @param {Object} foundItem - Found item object
 * @returns {Object} - Object with total score and detailed breakdown
 */
function calculateMatchScore(lostItem, foundItem) {
  // Initialize scores
  let totalScore = 0;
  const details = {};
  
  // Basic requirement: Category match
  if (lostItem.category !== foundItem.category) {
    return { totalScore: 0, details: { reason: 'Category mismatch' } };
  }
  
  // Base score for matching category (20%)
  totalScore += 20;
  details.categoryMatch = 20;
  
  // Description similarity (up to 50%)
  const descSimilarity = enhancedKeywordMatching(lostItem.description, foundItem.description);
  const descScore = Math.round(descSimilarity * 50);
  totalScore += descScore;
  details.descriptionSimilarity = descScore;
  
  // Location similarity (up to 30%)
  const locSimilarity = stringSimilarity(lostItem.location, foundItem.location);
  const locScore = Math.round(locSimilarity * 30);
  totalScore += locScore;
  details.locationSimilarity = locScore;
  
  // Category-specific attribute matching
  const categoryScore = calculateCategorySpecificScore(lostItem, foundItem);
  totalScore += categoryScore.score;
  details.categorySpecificAttributes = categoryScore.details;
  
  // Ensure total score doesn't exceed 100
  totalScore = Math.min(100, totalScore);
  
  return {
    totalScore,
    details
  };
}

/**
 * Calculate match score based on category-specific attributes
 * @param {Object} lostItem - Lost item object
 * @param {Object} foundItem - Found item object
 * @returns {Object} - Object with score and details
 */
function calculateCategorySpecificScore(lostItem, foundItem) {
  const category = lostItem.category || 'Others';
  let score = 0;
  const details = {};
  
  switch (category) {
    case 'Electronics':
      // Brand match (up to 20%)
      if (lostItem.brand && foundItem.brand) {
        const brandSimilarity = stringSimilarity(lostItem.brand, foundItem.brand);
        const brandScore = Math.round(brandSimilarity * 20);
        score += brandScore;
        details.brand = brandScore;
      }
      
      // Model match (up to 30%)
      if (lostItem.model && foundItem.model) {
        const modelSimilarity = stringSimilarity(lostItem.model, foundItem.model);
        const modelScore = Math.round(modelSimilarity * 30);
        score += modelScore;
        details.model = modelScore;
      }
      
      // Color match (up to 15%)
      if (lostItem.color && foundItem.color) {
        const colorSimilarity = stringSimilarity(lostItem.color, foundItem.color);
        const colorScore = Math.round(colorSimilarity * 15);
        score += colorScore;
        details.color = colorScore;
      }
      
      // Serial number is a strong indicator (up to 35%)
      if (lostItem.serialNumber && foundItem.serialNumber) {
        // Serial numbers should match exactly for full score
        const exactMatch = lostItem.serialNumber.toLowerCase() === foundItem.serialNumber.toLowerCase();
        const serialScore = exactMatch ? 35 : 0;
        score += serialScore;
        details.serialNumber = serialScore;
      }
      break;
      
    case 'Accessories':
      // Brand match (up to 25%)
      if (lostItem.brand && foundItem.brand) {
        const brandSimilarity = stringSimilarity(lostItem.brand, foundItem.brand);
        const brandScore = Math.round(brandSimilarity * 25);
        score += brandScore;
        details.brand = brandScore;
      }
      
      // Material match (up to 25%)
      if (lostItem.material && foundItem.material) {
        const materialSimilarity = stringSimilarity(lostItem.material, foundItem.material);
        const materialScore = Math.round(materialSimilarity * 25);
        score += materialScore;
        details.material = materialScore;
      }
      
      // Color match (up to 25%)
      if (lostItem.color && foundItem.color) {
        const colorSimilarity = stringSimilarity(lostItem.color, foundItem.color);
        const colorScore = Math.round(colorSimilarity * 25);
        score += colorScore;
        details.color = colorScore;
      }
      break;
      
    case 'Clothing':
      // Brand match (up to 20%)
      if (lostItem.brand && foundItem.brand) {
        const brandSimilarity = stringSimilarity(lostItem.brand, foundItem.brand);
        const brandScore = Math.round(brandSimilarity * 20);
        score += brandScore;
        details.brand = brandScore;
      }
      
      // Size match (up to 25%)
      if (lostItem.size && foundItem.size) {
        const sizeSimilarity = stringSimilarity(lostItem.size, foundItem.size);
        const sizeScore = Math.round(sizeSimilarity * 25);
        score += sizeScore;
        details.size = sizeScore;
      }
      
      // Color match (up to 25%)
      if (lostItem.color && foundItem.color) {
        const colorSimilarity = stringSimilarity(lostItem.color, foundItem.color);
        const colorScore = Math.round(colorSimilarity * 25);
        score += colorScore;
        details.color = colorScore;
      }
      
      // Material match (up to 15%)
      if (lostItem.material && foundItem.material) {
        const materialSimilarity = stringSimilarity(lostItem.material, foundItem.material);
        const materialScore = Math.round(materialSimilarity * 15);
        score += materialScore;
        details.material = materialScore;
      }
      break;
      
    case 'Documents':
      // Document type match (up to 30%)
      if (lostItem.documentType && foundItem.documentType) {
        const docTypeSimilarity = stringSimilarity(lostItem.documentType, foundItem.documentType);
        const docTypeScore = Math.round(docTypeSimilarity * 30);
        score += docTypeScore;
        details.documentType = docTypeScore;
      }
      
      // Issuing authority match (up to 20%)
      if (lostItem.issuingAuthority && foundItem.issuingAuthority) {
        const authoritySimilarity = stringSimilarity(lostItem.issuingAuthority, foundItem.issuingAuthority);
        const authorityScore = Math.round(authoritySimilarity * 20);
        score += authorityScore;
        details.issuingAuthority = authorityScore;
      }
      
      // Name on document match (up to 50%)
      if (lostItem.nameOnDocument && foundItem.nameOnDocument) {
        const nameSimilarity = stringSimilarity(lostItem.nameOnDocument, foundItem.nameOnDocument);
        const nameScore = Math.round(nameSimilarity * 50);
        score += nameScore;
        details.nameOnDocument = nameScore;
      }
      break;
      
    case 'Bags':
      // Brand match (up to 20%)
      if (lostItem.brand && foundItem.brand) {
        const brandSimilarity = stringSimilarity(lostItem.brand, foundItem.brand);
        const brandScore = Math.round(brandSimilarity * 20);
        score += brandScore;
        details.brand = brandScore;
      }
      
      // Color match (up to 25%)
      if (lostItem.color && foundItem.color) {
        const colorSimilarity = stringSimilarity(lostItem.color, foundItem.color);
        const colorScore = Math.round(colorSimilarity * 25);
        score += colorScore;
        details.color = colorScore;
      }
      
      // Material match (up to 20%)
      if (lostItem.material && foundItem.material) {
        const materialSimilarity = stringSimilarity(lostItem.material, foundItem.material);
        const materialScore = Math.round(materialSimilarity * 20);
        score += materialScore;
        details.material = materialScore;
      }
      break;
      
    default:
      // For "Others" category, use basic matching
      if (lostItem.color && foundItem.color) {
        const colorSimilarity = stringSimilarity(lostItem.color, foundItem.color);
        const colorScore = Math.round(colorSimilarity * 15);
        score += colorScore;
        details.color = colorScore;
      }
      
      if (lostItem.brand && foundItem.brand) {
        const brandSimilarity = stringSimilarity(lostItem.brand, foundItem.brand);
        const brandScore = Math.round(brandSimilarity * 15);
        score += brandScore;
        details.brand = brandScore;
      }
      
      if (lostItem.material && foundItem.material) {
        const materialSimilarity = stringSimilarity(lostItem.material, foundItem.material);
        const materialScore = Math.round(materialSimilarity * 10);
        score += materialScore;
        details.material = materialScore;
      }
      break;
  }
  
  return {
    score: Math.min(score, 100),
    details
  };
}

// Convert exports from CommonJS to ES modules
export { 
  findMatches,
  getEmbedding,
  cosineSimilarity,
  enhancedKeywordMatching,
  calculateLocationSimilarity, 
  calculateDateProximity,
  precomputeItemEmbedding,
  clearEmbeddingCache,
  matchCategoryAttributes,
  getCategoryWeights,
  calculateMatchScore,
  stringSimilarity,
  calculateCategorySpecificScore
}; 