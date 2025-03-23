from flask import Flask, request, jsonify
from flask_cors import CORS  # Allow frontend to connect
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import numpy as np

# Download NLTK dependencies (only run once)
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')
nltk.download('omw-1.4')

app = Flask(__name__)
CORS(app)  # Allow React Native frontend to make requests

# Initialize text processing tools
lemmatizer = WordNetLemmatizer()
stop_words = set(stopwords.words('english'))
vectorizer = TfidfVectorizer()  # Define globally to avoid reloading

def preprocess_text(text):
    """Preprocess text for NLP similarity comparison."""
    text = text.lower()
    text = re.sub(r'[^a-zA-Z\s]', '', text)  # Remove special characters
    tokens = word_tokenize(text)
    tokens = [lemmatizer.lemmatize(token) for token in tokens if token not in stop_words]
    return ' '.join(tokens)

@app.route('/match', methods=['POST'])
def match_descriptions():
    """Find similarity between lost & found item descriptions."""
    try:
        data = request.json
        lost_desc = data.get('lost_desc', '')
        found_desc = data.get('found_desc', '')

        if not lost_desc or not found_desc:
            return jsonify({"error": "Both lost and found descriptions are required"}), 400

        # Preprocess descriptions
        lost_processed = preprocess_text(lost_desc)
        found_processed = preprocess_text(found_desc)

        # Fit vectorizer only once
        global vectorizer
        if not hasattr(vectorizer, 'vocabulary_'):
            vectorizer.fit([lost_processed, found_processed])  # Train on first call

        # Transform descriptions into TF-IDF vectors
        tfidf_matrix = vectorizer.transform([lost_processed, found_processed])

        # Compute similarity
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

        return jsonify({
            "similarity_score": float(similarity),
            "preprocessed_lost": lost_processed,
            "preprocessed_found": found_processed
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
