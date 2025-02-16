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
        cb(null, 'uploads/'); // Ensure this folder exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// MongoDB connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4 // Force IPv4
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Monitor MongoDB connection
mongoose.connection.on('connected', () => console.log('Mongoose connected to MongoDB Atlas'));
mongoose.connection.on('error', err => console.error('Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

// Connect to MongoDB
connectDB();

// **Fixed: Initialize the Hugging Face model with correct dtype and handle potential issues**
{/* let similarityModel;
(async () => {
    try {
        similarityModel = await pipeline('feature-extraction', 'sentence-transformers/all-MiniLM-L6-v2', {
            device: 'cpu', // Ensuring CPU compatibility
            dtype: 'auto'  // Fix dtype issue
        });
        console.log("Hugging Face Model Loaded Successfully.");
    } catch (error) {
        console.error("Error loading Hugging Face model:", error);
        if (error.message.includes('Cannot read properties of undefined')) {
            console.error("It seems like the model or its configuration is not properly defined.");
        }
    }
})();

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ status: 'error', message: 'Something broke!' });
});

// Routes
app.get('/', (req, res) => {
    res.status(200).send({ status: "Server is running" });
});*/}

// **Register Route**
app.post('/register', async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;
        if (!name || !email || !mobile || !password) {
            return res.status(400).json({ status: 'error', message: 'All fields are required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ status: 'error', message: 'Invalid email format' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ status: 'error', message: 'User already exists' });
        }

        const newUser = new User({ name, email, mobile, password });
        await newUser.save();
        res.status(201).json({ status: 'success', message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error during registration', details: error.message });
    }
});

// **Login Route**
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// **Report Found Item**
app.post('/reportfound', upload.single('photo'), async (req, res) => {
    try {
        const { contact, location, time, date, description } = req.body;
        if (!contact || !location || !time || !date || !description) {
            return res.status(400).json({ status: 'error', message: 'All fields are required' });
        }

        const foundItem = new FoundItem({
            contact, location, time, date, description,
            photo: req.file ? fs.readFileSync(req.file.path) : null
        });

        await foundItem.save();
        res.status(201).json({ status: 'success', message: 'Found item reported successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error reporting found item' });
    }
});

// **Report Lost Item**
app.post('/reportlost', upload.single('photo'), async (req, res) => {
    try {
        const { contact, location, time, date, description, category } = req.body;
        if (!contact || !location || !time || !date || !description || !category) {
            return res.status(400).json({ status: 'error', message: 'All fields are required' });
        }

        const lostItem = new LostItem({
            contact, location, time, date, description, category,
            photo: req.file ? fs.readFileSync(req.file.path) : null
        });

        await lostItem.save();
        res.status(201).json({ status: 'success', message: 'Lost item reported successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error while reporting lost item' });
    }
});

// **Find Matching Items Based on Description**
app.post('/matchingfounditems', async (req, res) => {
    try {
        const { lostItemDescription } = req.body;
        if (!lostItemDescription) {
            return res.status(400).json({ status: 'error', message: 'Missing lost item description' });
        }

        const matchedItems = await FoundItem.find({ description: { $regex: lostItemDescription, $options: 'i' } });

        if (matchedItems.length === 0) {
            return res.status(200).json({ status: 'not_found', message: 'No items match your description' });
        }

        res.status(200).json({ status: 'success', matchedItems });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error finding matched items' });
    }
});

// **Start Server**
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
