import nltk
import os

def download_nltk_resources():
    """
    Download all necessary NLTK resources for the matching service.
    Run this once before starting the matching service.
    """
    resources = [
        'punkt',
        'stopwords',
        'wordnet',
        'omw-1.4'
    ]
    
    # Create nltk_data directory in user home if it doesn't exist
    nltk_data_dir = os.path.join(os.path.expanduser('~'), 'nltk_data')
    os.makedirs(nltk_data_dir, exist_ok=True)
    
    print(f"Downloading NLTK resources to {nltk_data_dir}...")
    
    for resource in resources:
        try:
            print(f"Downloading {resource}...")
            nltk.download(resource)
        except Exception as e:
            print(f"Error downloading {resource}: {str(e)}")
    
    # Download punkt tokenizer files specifically
    try:
        print("Downloading punkt tokenizer files...")
        nltk.download('punkt')
    except Exception as e:
        print(f"Error downloading punkt tokenizer: {str(e)}")
    
    print("NLTK resource download complete!")

if __name__ == "__main__":
    download_nltk_resources() 