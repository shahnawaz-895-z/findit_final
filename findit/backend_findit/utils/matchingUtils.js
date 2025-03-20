import natural from 'natural';
import { promisify } from 'util';

// Initialize natural language processing tools
const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();
const stringDistance = natural.LevenshteinDistance;
const metaphone = natural.Metaphone;
const soundex = natural.SoundEx;

/**
 * Preprocess text for matching
 */
function preprocessText(text) {
    if (!text) return '';
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();
}

/**
 * Calculate string similarity using multiple metrics
 */
function calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Convert to lowercase for comparison
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    
    // 1. Levenshtein Distance (40% weight)
    const maxLength = Math.max(str1.length, str2.length);
    const levenshteinScore = 1 - (stringDistance(str1, str2) / maxLength);
    
    // 2. Metaphone matching (30% weight)
    const metaphone1 = metaphone.process(str1);
    const metaphone2 = metaphone.process(str2);
    const metaphoneScore = metaphone1 === metaphone2 ? 1 : 0;
    
    // 3. Soundex matching (30% weight)
    const soundex1 = soundex.process(str1);
    const soundex2 = soundex.process(str2);
    const soundexScore = soundex1 === soundex2 ? 1 : 0;
    
    return (levenshteinScore * 0.4) + (metaphoneScore * 0.3) + (soundexScore * 0.3);
}

/**
 * Calculate TF-IDF similarity between two texts
 */
function calculateTfIdfSimilarity(text1, text2) {
    // Handle null, undefined, or empty texts
    if (!text1 || !text2 || text1.trim() === '' || text2.trim() === '') {
        return 0;
    }
    
    try {
        // Create a new TfIdf instance for each comparison
        const localTfidf = new TfIdf();
        
        // Preprocess texts
        const processedText1 = preprocessText(text1);
        const processedText2 = preprocessText(text2);
        
        // Add documents
        localTfidf.addDocument(processedText1);
        localTfidf.addDocument(processedText2);
        
        // Tokenize the texts
        const tokens1 = tokenizer.tokenize(processedText1);
        const tokens2 = tokenizer.tokenize(processedText2);
        
        // If either document has no tokens, return 0
        if (!tokens1.length || !tokens2.length) {
            return 0;
        }
        
        // Find unique tokens from both documents
        const uniqueTokens = [...new Set([...tokens1, ...tokens2])];
        
        // Calculate cosine similarity
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;
        
        for (const token of uniqueTokens) {
            // Safe access to TF-IDF values with fallback to 0
            let value1 = 0;
            let value2 = 0;
            
            try {
                value1 = localTfidf.tfidf(token, 0) || 0;
            } catch (e) {
                value1 = 0;
            }
            
            try {
                value2 = localTfidf.tfidf(token, 1) || 0;
            } catch (e) {
                value2 = 0;
            }
            
            dotProduct += value1 * value2;
            magnitude1 += value1 * value1;
            magnitude2 += value2 * value2;
        }
        
        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);
        
        // Avoid division by zero
        if (magnitude1 === 0 || magnitude2 === 0) {
            return 0;
        }
        
        // Calculate and return cosine similarity
        return dotProduct / (magnitude1 * magnitude2);
    } catch (error) {
        console.error('Error in TF-IDF calculation:', error);
        return 0;  // Return 0 on any error
    }
}

/**
 * Extract key features from text
 */
function extractFeatures(text) {
    const tokens = tokenizer.tokenize(text);
    const features = {
        nouns: [],
        adjectives: [],
        colors: [],
        numbers: [],
        brands: []
    };
    
    // Common color words
    const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'purple', 'pink', 'orange', 'brown', 'grey', 'gray'];
    
    // Common brand names
    const brands = ['apple', 'samsung', 'nike', 'adidas', 'sony', 'lg', 'dell', 'hp', 'lenovo', 'asus', 'xiaomi', 'huawei', 'canon', 'nikon', 'google', 'microsoft', 'amazon'];
    
    tokens.forEach(token => {
        // Extract colors
        if (colors.includes(token.toLowerCase())) {
            features.colors.push(token.toLowerCase());
        }
        
        // Extract brands
        if (brands.includes(token.toLowerCase())) {
            features.brands.push(token.toLowerCase());
        }
        
        // Extract numbers
        if (/^\d+$/.test(token)) {
            features.numbers.push(token);
        }
        
        // Basic POS tagging (simplified)
        if (token.length > 3) {
            if (token.endsWith('ing') || token.endsWith('ed')) {
                features.adjectives.push(token);
            } else {
                features.nouns.push(token);
            }
        }
    });
    
    return features;
}

/**
 * Compare category-specific attributes
 */
function compareAttributes(item1, item2, category) {
    let score = 0;
    const weights = {
        Electronics: {
            brand: 0.3,
            model: 0.3,
            color: 0.2,
            serialNumber: 0.2
        },
        Accessories: {
            brand: 0.3,
            material: 0.3,
            color: 0.4
        },
        Clothing: {
            brand: 0.3,
            size: 0.2,
            color: 0.3,
            material: 0.2
        },
        Documents: {
            documentType: 0.4,
            issuingAuthority: 0.3,
            nameOnDocument: 0.3
        }
    };

    const categoryWeights = weights[category] || {};
    
    for (const [attr, weight] of Object.entries(categoryWeights)) {
        if (item1[attr] && item2[attr]) {
            const similarity = calculateStringSimilarity(
                item1[attr].toLowerCase(),
                item2[attr].toLowerCase()
            );
            score += similarity * weight;
        }
    }

    return score;
}

/**
 * Main matching function that combines all matching strategies
 */
export async function findMatches(foundItem, lostItems) {
    const matches = [];
    
    // Extract features from found item description
    const foundItemFeatures = extractFeatures(foundItem.description);
    
    for (const lostItem of lostItems) {
        if (!lostItem.description) continue;
        
        // 1. String similarity (40% weight)
        const stringSimilarity = calculateStringSimilarity(
            foundItem.description,
            lostItem.description
        );
        
        // 2. TF-IDF similarity (30% weight)
        const tfidfScore = calculateTfIdfSimilarity(
            foundItem.description,
            lostItem.description
        );
        
        // 3. Feature matching (30% weight)
        const lostItemFeatures = extractFeatures(lostItem.description);
        let featureScore = 0;
        
        // Compare features
        const featureWeights = {
            brands: 0.4,
            colors: 0.3,
            numbers: 0.2,
            nouns: 0.1
        };
        
        for (const [featureType, weight] of Object.entries(featureWeights)) {
            const foundFeatures = foundItemFeatures[featureType];
            const lostFeatures = lostItemFeatures[featureType];
            
            if (foundFeatures.length > 0 && lostFeatures.length > 0) {
                let matchCount = 0;
                foundFeatures.forEach(feature => {
                    if (lostFeatures.includes(feature)) {
                        matchCount++;
                    }
                });
                featureScore += (matchCount / Math.max(foundFeatures.length, lostFeatures.length)) * weight;
            }
        }
        
        // 4. Attribute matching (20% weight)
        const attributeScore = compareAttributes(foundItem, lostItem, foundItem.category);
        
        // Calculate final score
        const finalScore = (
            stringSimilarity * 0.4 +
            tfidfScore * 0.3 +
            featureScore * 0.3 +
            attributeScore * 0.2
        ) * 100;
        
        if (finalScore >= 40) { // Lower threshold from 60 to 40
            matches.push({
                lostItemId: lostItem._id,
                foundItemId: foundItem._id,
                matchConfidence: finalScore.toFixed(1),
                category: foundItem.category,
                lostItemDescription: lostItem.description,
                foundItemDescription: foundItem.description,
                lostLocation: lostItem.location,
                foundLocation: foundItem.location,
                lostDate: lostItem.date,
                foundDate: foundItem.date,
                lostItemOwner: lostItem.userId,
                foundItemOwner: foundItem.userId,
                lostItemContact: lostItem.contact,
                matchDetails: {
                    stringSimilarity: stringSimilarity.toFixed(2),
                    tfidfScore: tfidfScore.toFixed(2),
                    featureScore: featureScore.toFixed(2),
                    attributeScore: attributeScore.toFixed(2)
                }
            });
        }
    }
    
    // Sort matches by confidence score
    return matches.sort((a, b) => b.matchConfidence - a.matchConfidence);
}

/**
 * Batch process matches for better performance
 */
export async function batchProcessMatches(foundItems, lostItems, batchSize = 10) {
    const allMatches = [];
    
    for (let i = 0; i < foundItems.length; i += batchSize) {
        const batch = foundItems.slice(i, i + batchSize);
        const batchPromises = batch.map(foundItem => findMatches(foundItem, lostItems));
        const batchResults = await Promise.all(batchPromises);
        allMatches.push(...batchResults.flat());
    }
    
    return allMatches;
} 