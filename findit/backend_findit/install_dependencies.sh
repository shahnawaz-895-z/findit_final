#!/bin/bash

# Install dependencies for the advanced matching system
echo "Installing dependencies for the advanced matching system..."
npm install @xenova/transformers natural stopwords

# Update existing dependencies
echo "Updating existing dependencies..."
npm update

echo "Installation complete!"
echo "You can now start the server with: npm start" 