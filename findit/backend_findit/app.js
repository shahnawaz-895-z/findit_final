import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import User from './userdetail.js';
import FoundItem from './founditemschema.js';
import bcrypt from 'bcrypt';
import fs from 'fs'; 
import LostItem from './lostitemschema.js';
import { pipeline } from '@huggingface/transformers';
import natural from 'natural';
import compromise from 'compromise';

// Initialize the model
const similarityModel = pipeline('feature-extraction', 'sentence-transformers/all-MiniLM-L6-v2');

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') // Make sure this folder exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// MongoDB connection with improved error handling
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4  // Force IPv4
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Monitor MongoDB connection
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

// Connect to MongoDB
connectDB();

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ status: 'error', message: 'Something broke!' });
});

// Routes
app.get('/', (req, res) => {
    res.status(200).send({ status: "Server is running" });
});

// Register route with improved error handling and logging
app.post('/register', async (req, res) => {
    try {
        console.log('Received registration request:', req.body);
        const { name, email, mobile, password } = req.body;

        // Validation
        if (!name || !email || !mobile || !password) {
            console.log('Validation failed: Missing fields');
            return res.status(400).json({ 
                status: 'error', 
                message: 'All fields are required' 
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('Validation failed: Invalid email format');
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('User already exists:', email);
            return res.status(409).json({ 
                status: 'error', 
                message: 'User already exists' 
            });
        }

        // Create new user
        const newUser = new User({
            name,
            email,
            mobile,
            password
        });

        await newUser.save();
        console.log('User saved successfully:', email);
        
        res.status(201).json({ 
            status: 'success', 
            message: 'User registered successfully' 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Server error during registration',
            details: error.message
        });
    }
});




app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // If login is successful
    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Found item reporting route
app.post('/reportfound', upload.single('photo'), async (req, res) => {
    try {
        const { contact, location, time, date, description } = req.body;

        // Ensure required fields are present
        if (!contact || !location || !time || !date || !description) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields (contact, location, time, date, and description) are required'
            });
        }

        // If a photo is uploaded, include it in the record
        const photoPath = req.file ? req.file.path : null;

        // Create new found item record
        const foundItem = new FoundItem({
            contact,
            location,
            time,
            date,
            description,
            photo: photoPath ? fs.readFileSync(photoPath) : null // Store photo as binary or handle accordingly
        });

        await foundItem.save();
        res.status(201).json({
            status: 'success',
            message: 'Found item reported successfully',
            foundItem
        });
    } catch (error) {
        console.error('Error reporting found item:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error  reporting found item',
            details: error.message
        });
    }
});
app.use((err, req, res, next) => {
    console.error('Error details:', err);
    res.status(500).json({ 
      status: 'error', 
      message: err.message || 'Something went wrong!',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });
  
  // Modified lost item reporting route with better error handling
  app.post('/reportlost', upload.single('photo'), async (req, res) => {
      try {
          console.log('Received request body:', req.body);
          console.log('Received file:', req.file);
  
          const { contact, location, time, date, description, category } = req.body;
  
          // Detailed validation
          const missingFields = [];
          if (!contact) missingFields.push('contact');
          if (!location) missingFields.push('location');
          if (!time) missingFields.push('time');
          if (!date) missingFields.push('date');
          if (!description) missingFields.push('description');
          if (!category) missingFields.push('category');
  
          if (missingFields.length > 0) {
              return res.status(400).json({
                  status: 'error',
                  message: `Missing required fields: ${missingFields.join(', ')}`
              });
          }
  
          // Create new lost item record
          const lostItem = new LostItem({
              contact,
              location,
              time: new Date(time),
              date: new Date(date),
              description,
              category
          });
  
          // If a photo was uploaded, add it to the record
          if (req.file) {
              try {
                  lostItem.photo = fs.readFileSync(req.file.path);
                  lostItem.photoContentType = req.file.mimetype;
                  // Clean up the uploaded file
                  fs.unlinkSync(req.file.path);
              } catch (photoError) {
                  console.error('Error processing photo:', photoError);
                  // Continue without photo if there's an error
              }
          }
  
          console.log('Saving lost item to database...');
          await lostItem.save();
          console.log('Lost item saved successfully');
  
          res.status(201).json({
              status: 'success',
              message: 'Lost item reported successfully',
              lostItem: {
                  _id: lostItem._id,
                  contact: lostItem.contact,
                  location: lostItem.location,
                  time: lostItem.time,
                  date: lostItem.date,
                  description: lostItem.description,
                  category: lostItem.category,
                  hasPhoto: !!lostItem.photo
              }
          });
      } catch (error) {
          console.error('Detailed error in /reportlost:', error);
          res.status(500).json({
              status: 'error',
              message: 'Server error while reporting lost item',
              details: error.message
          });
      }
  });

  const computeTextSimilarity = (text1, text2) => {
    // Normalize and preprocess text
    const normalizeText = (text) => {
        // Convert to lowercase
        text = text.toLowerCase().trim();
        
        // Remove punctuation and special characters
        text = text.replace(/[^\w\s]/g, '');
        
        return text;
    };

    // Tokenize and remove stop words
    const preprocessText = (text) => {
        const doc = compromise(text);
        const processedTokens = doc
            .remove('StopWord')
            .text()
            .split(/\s+/);
        return processedTokens;
    };

    // Compute Jaccard similarity
    const computeJaccardSimilarity = (set1, set2) => {
        const intersection = set1.filter(token => set2.includes(token));
        const union = [...new Set([...set1, ...set2])];
        return intersection.length / union.length;
    };

    // Compute TF-IDF similarity
    const computeTFIDFSimilarity = (text1, text2) => {
        const tokenizer = new natural.WordTokenizer();
        const tokens1 = tokenizer.tokenize(normalizeText(text1));
        const tokens2 = tokenizer.tokenize(normalizeText(text2));

        const tfidf = new natural.TfIdf();
        tfidf.addDocument(tokens1);
        tfidf.addDocument(tokens2);

        let similarity = 0;
        tokens1.forEach((token, index) => {
            const tfidfValue1 = tfidf.tfidf(token, 0);
            const tfidfValue2 = tfidf.tfidf(token, 1);
            similarity += Math.min(tfidfValue1, tfidfValue2);
        });

        return similarity / Math.max(tokens1.length, tokens2.length);
    };

    // Preprocess texts
    const processedText1 = preprocessText(text1);
    const processedText2 = preprocessText(text2);

    // Compute multiple similarity metrics
    const jaccardSimilarity = computeJaccardSimilarity(processedText1, processedText2);
    const tfidfSimilarity = computeTFIDFSimilarity(text1, text2);

    // Combine similarities with weighted average
    const combinedSimilarity = (jaccardSimilarity * 0.4) + (tfidfSimilarity * 0.6);

    return combinedSimilarity;
};

// Endpoint to find matching items based on description similarity
app.post('/matchingfounditems', async (req, res) => {
    try {
        const { lostItemDescription } = req.body;

        if (!lostItemDescription) {
            return res.status(400).json({ status: 'error', message: 'Missing lost item description' });
        }

        // Logic for finding matching items from the database
        const matchedItems = await FoundItem.find({
            description: { $regex: lostItemDescription, $options: 'i' }
        });

        if (matchedItems.length === 0) {
            return res.status(200).json({ status: 'not_found', message: 'No items match your description' });
        }

        res.status(200).json({
            status: 'success',
            matchedItems
        });
    } catch (error) {
        console.error('Error in /matchingfounditems:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error finding matched items',
            details: error.message
        });
    }
});
// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});