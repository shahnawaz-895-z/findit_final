from flask import Flask, request, jsonify
from flask_cors import CORS
import nltk
from nltk.corpus import stopwords, wordnet
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import numpy as np
import os
import sys
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create nltk_data directory in backend folder
NLTK_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nltk_data')
os.makedirs(NLTK_DATA_DIR, exist_ok=True)
nltk.data.path.append(NLTK_DATA_DIR)

# Download NLTK dependencies to the local directory
print(f"Downloading NLTK resources to {NLTK_DATA_DIR}...")
try:
    nltk.download('punkt', download_dir=NLTK_DATA_DIR, quiet=True)
    nltk.download('stopwords', download_dir=NLTK_DATA_DIR, quiet=True)
    nltk.download('wordnet', download_dir=NLTK_DATA_DIR, quiet=True)
    nltk.download('omw-1.4', download_dir=NLTK_DATA_DIR, quiet=True)
    print("NLTK resources downloaded successfully")
except Exception as e:
    print(f"Error downloading NLTK resources: {str(e)}")
    # Continue anyway as we'll use fallbacks

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize text processing tools
try:
    lemmatizer = WordNetLemmatizer()
    stop_words = set(stopwords.words('english'))
    print("NLTK tools initialized successfully")
except Exception as e:
    print(f"Error initializing NLTK tools: {str(e)}")
    # Fallback stopwords
    stop_words = {'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 
                 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'from'}

# Initialize vectorizers with better parameters
try:
    vectorizer = TfidfVectorizer(
        min_df=1, max_df=0.9, lowercase=True, 
        stop_words='english', use_idf=True, 
        smooth_idf=True, sublinear_tf=True
    )

    count_vectorizer = CountVectorizer(
        lowercase=True, stop_words='english'
    )

    # Initial corpus
    initial_corpus = [
        "sample lost item phone wallet keys laptop bag",
        "sample found item phone wallet keys laptop bag"
    ]

    # Fit the vectorizers with the initial corpus
    vectorizer.fit(initial_corpus)
    count_vectorizer.fit(initial_corpus)
    print("Vectorizers initialized successfully")
except Exception as e:
    print(f"Error initializing vectorizers: {str(e)}")

# Synonyms dictionary for common lost & found terms
ITEM_SYNONYMS = {
    # Places
    'cafeteria': ['dining', 'canteen', 'cafe', 'food court', 'restaurant', 'lunch room'],
    'library': ['book', 'study', 'reading', 'lib'],
    'classroom': ['class', 'lecture', 'room', 'hall', 'theater'],
    'bathroom': ['restroom', 'toilet', 'washroom', 'lavatory'],
    'parking': ['car park', 'garage', 'lot'],
    'gym': ['fitness', 'sport', 'exercise', 'workout'],
    'dorm': ['dormitory', 'residence', 'housing', 'apartment'],
    
    # Common items
    'phone': ['mobile', 'cell', 'smartphone', 'iphone', 'android', 'device'],
    'laptop': ['computer', 'notebook', 'macbook', 'pc', 'chromebook'],
    'wallet': ['purse', 'billfold', 'pocketbook', 'card holder'],
    'keys': ['keychain', 'key ring', 'car key', 'fob'],
    'backpack': ['bag', 'knapsack', 'rucksack', 'pack', 'sack'],
    'bottle': ['water bottle', 'flask', 'thermos', 'container', 'tumbler'],
    'watch': ['wristwatch', 'timepiece', 'clock', 'smartwatch'],
    'glasses': ['eyeglasses', 'spectacles', 'sunglasses', 'eyewear'],
    
    # Colors
    'black': ['dark', 'ebony', 'jet'],
    'white': ['light', 'ivory', 'cream', 'pale'],
    'blue': ['navy', 'azure', 'teal', 'turquoise'],
    'red': ['crimson', 'scarlet', 'maroon', 'burgundy'],
    'green': ['emerald', 'lime', 'olive', 'forest'],
    'brown': ['tan', 'beige', 'khaki', 'chocolate', 'leather'],
    'gray': ['grey', 'silver', 'charcoal', 'ash'],
    'yellow': ['gold', 'amber', 'blonde']
}

# Expand the dictionary to include both directions
EXPANDED_SYNONYMS = {}
for key, values in ITEM_SYNONYMS.items():
    EXPANDED_SYNONYMS[key] = values
    for value in values:
        if value not in EXPANDED_SYNONYMS:
            EXPANDED_SYNONYMS[value] = [key]
        else:
            if key not in EXPANDED_SYNONYMS[value]:
                EXPANDED_SYNONYMS[value].append(key)

# Brands dictionary
COMMON_BRANDS = {
    'phone': ['apple', 'samsung', 'iphone', 'google', 'pixel', 'huawei', 'oneplus', 'xiaomi', 'oppo', 'vivo', 'motorola', 'lg', 'nokia'],
    'laptop': ['apple', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'microsoft', 'msi', 'toshiba', 'samsung', 'huawei', 'razer'],
    'watch': ['apple', 'samsung', 'fitbit', 'garmin', 'fossil', 'rolex', 'casio', 'citizen', 'seiko', 'timex'],
    'shoes': ['nike', 'adidas', 'puma', 'reebok', 'converse', 'vans', 'new balance', 'asics', 'sketchers'],
    'bags': ['jansport', 'north face', 'nike', 'adidas', 'herschel', 'kipling', 'samsonite', 'tumi']
}

def expand_with_synonyms(text):
    """Add synonyms to the text to improve matching."""
    words = text.split()
    expanded_words = words.copy()
    
    # Add synonyms for each word
    for word in words:
        if word in EXPANDED_SYNONYMS:
            # Add top 2 synonyms to avoid making text too long
            expanded_words.extend(EXPANDED_SYNONYMS[word][:2])
    
    # Look for brands and item types
    for item_type, brands in COMMON_BRANDS.items():
        if item_type in words:
            # If we mentioned a type of item but no brand, add common brands
            found_brand = False
            for brand in brands:
                if brand in text:
                    found_brand = True
                    break
            
            if not found_brand:
                # Don't add any brands, but increase weight of item type
                expanded_words.append(item_type)
    
    return ' '.join(expanded_words)

def extract_important_features(text):
    """Extract and prioritize important features like colors, brands, and item types."""
    important_words = []
    
    # Look for colors
    for color in list(ITEM_SYNONYMS.keys())[-8:]:  # Last 8 keys are colors
        if color in text:
            important_words.append(color)
    
    # Look for brands
    all_brands = set()
    for brands in COMMON_BRANDS.values():
        all_brands.update(brands)
    
    for brand in all_brands:
        if brand in text:
            important_words.append(brand)
            important_words.append(brand)  # Add twice for higher weight
    
    # Look for item types
    for item_type in list(COMMON_BRANDS.keys()):
        if item_type in text:
            important_words.append(item_type)
    
    return important_words

def preprocess_text(text):
    """Preprocess text for NLP similarity comparison with better feature handling."""
    if not text:
        return ""
    
    try:
        # Convert to lowercase
        text = text.lower()
        
        # Replace special characters with spaces
        text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
        
        # Extract important features first
        important_features = extract_important_features(text)
        
        # Tokenize with fallback
        try:
            tokens = word_tokenize(text)
        except:
            tokens = text.split()
        
        # Remove stopwords and lemmatize
        try:
            processed_tokens = [lemmatizer.lemmatize(token) for token in tokens if token not in stop_words]
        except:
            processed_tokens = [token for token in tokens if token not in stop_words]
        
        # Join the processed tokens
        processed_text = ' '.join(processed_tokens)
        
        # Expand with synonyms
        expanded_text = expand_with_synonyms(processed_text)
        
        # Add important features for emphasis
        final_text = expanded_text + ' ' + ' '.join(important_features)
        
        return final_text
    
    except Exception as e:
        print(f"Error in preprocess_text: {str(e)}")
        # Return a safe fallback
        return text.lower()

def jaccard_similarity(str1, str2):
    """Calculate Jaccard similarity between two strings."""
    set1 = set(str1.split())
    set2 = set(str2.split())
    
    intersection = len(set1.intersection(set2))
    union = len(set1) + len(set2) - intersection
    
    if union == 0:
        return 0.0
    
    return float(intersection) / union

def matching_words_similarity(str1, str2):
    """Calculate similarity based on matching words and semantic similarity."""
    words1 = str1.split()
    words2 = str2.split()
    
    # Count exact matches
    exact_matches = len(set(words1).intersection(set(words2)))
    
    # Count synonym matches
    synonym_matches = 0
    for word1 in words1:
        if word1 in EXPANDED_SYNONYMS:
            for word2 in words2:
                if word2 in EXPANDED_SYNONYMS[word1]:
                    synonym_matches += 0.5  # Half weight for synonym matches
    
    # Calculate similarity
    total_words = len(set(words1).union(set(words2)))
    if total_words == 0:
        return 0.0
    
    return (exact_matches + synonym_matches) / total_words

@app.route('/match', methods=['POST'])
def match_descriptions():
    """Find similarity between lost & found item descriptions using multiple methods."""
    start_time = time.time()
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        lost_desc = data.get('lost_desc', '')
        found_desc = data.get('found_desc', '')
        
        print(f"Received descriptions: \nLost: {lost_desc}\nFound: {found_desc}")

        if not lost_desc or not found_desc:
            return jsonify({"error": "Both lost and found descriptions are required"}), 400
        
        # Preprocess descriptions
        lost_processed = preprocess_text(lost_desc)
        found_processed = preprocess_text(found_desc)
        
        print(f"Preprocessed descriptions: \nLost: {lost_processed}\nFound: {found_processed}")
        
        if not lost_processed or not found_processed:
            return jsonify({
                "similarity_score": 0.0,
                "preprocessed_lost": lost_processed,
                "preprocessed_found": found_processed,
                "warning": "One or both descriptions were empty after preprocessing"
            })

        # Try multiple methods to calculate similarity
        methods_results = {}
        
        # Method 1: TF-IDF with Cosine Similarity
        try:
            # Refit vectorizer with current texts to ensure proper vocabulary
            vectorizer.fit([lost_processed, found_processed] + initial_corpus)
            tfidf_matrix = vectorizer.transform([lost_processed, found_processed])
            tfidf_similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            methods_results['tfidf'] = float(tfidf_similarity) if not np.isnan(tfidf_similarity) else 0.0
            print(f"TF-IDF similarity: {methods_results['tfidf']}")
        except Exception as e:
            print(f"TF-IDF similarity calculation failed: {str(e)}")
            methods_results['tfidf'] = 0.0
        
        # Method 2: Count Vectorizer with Cosine Similarity
        try:
            # Refit count vectorizer with current texts
            count_vectorizer.fit([lost_processed, found_processed] + initial_corpus)
            count_matrix = count_vectorizer.transform([lost_processed, found_processed])
            count_similarity = cosine_similarity(count_matrix[0:1], count_matrix[1:2])[0][0]
            methods_results['count'] = float(count_similarity) if not np.isnan(count_similarity) else 0.0
            print(f"Count vectorizer similarity: {methods_results['count']}")
        except Exception as e:
            print(f"Count vectorizer similarity calculation failed: {str(e)}")
            methods_results['count'] = 0.0
        
        # Method 3: Jaccard Similarity
        jaccard_sim = jaccard_similarity(lost_processed, found_processed)
        methods_results['jaccard'] = jaccard_sim
        print(f"Jaccard similarity: {jaccard_sim}")
        
        # Method 4: Matching Words with Synonym Support
        matching_words_sim = matching_words_similarity(lost_processed, found_processed)
        methods_results['matching_words'] = matching_words_sim
        print(f"Matching words similarity: {matching_words_sim}")
        
        # Use the highest similarity score from all methods
        similarity = max(methods_results.values())
        
        # Apply a small boost for multi-method agreement
        if len([s for s in methods_results.values() if s > 0.4]) >= 2:
            similarity = min(1.0, similarity + 0.05)
            agreement_boost = True
        else:
            agreement_boost = False
        
        print(f"Final similarity score: {similarity}")
        best_method = max(methods_results, key=methods_results.get)
        print(f"Best method: {best_method}")
        print(f"Processing time: {time.time() - start_time:.3f} seconds")
                
        return jsonify({
            "similarity_score": similarity,
            "preprocessed_lost": lost_processed,
            "preprocessed_found": found_processed,
            "method_used": best_method,
            "all_methods": methods_results,
            "agreement_boost": agreement_boost,
            "processing_time_ms": int((time.time() - start_time) * 1000)
        })
        
    except Exception as e:
        print(f"Unexpected error in match endpoint: {str(e)}")
        traceback_str = str(sys.exc_info()[2])
        return jsonify({
            "error": str(e), 
            "traceback": traceback_str,
            "similarity_score": 0.0,
            "processing_time_ms": int((time.time() - start_time) * 1000)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple endpoint to check if the service is running."""
    return jsonify({
        "status": "ok", 
        "service": "matching-api",
        "version": "2.0"
    }), 200

if __name__ == '__main__':
    print("Starting matching service on http://0.0.0.0:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)
