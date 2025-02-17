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
const storage = multer.memoryStorage(); // Use memory storage instead of disk storage
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

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
app.post('/register', upload.single('profileImage'), async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        console.log('Received file:', req.file);

        const { name, email, mobile, password } = req.body;

        // Validate required fields
        const missingFields = [];
        if (!name) missingFields.push('name');
        if (!email) missingFields.push('email');
        if (!mobile) missingFields.push('mobile');
        if (!password) missingFields.push('password');

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        // Validate and process profile image if provided
        let profileImage = null;
        let profileImageType = null;
        
        if (req.file) {
            try {
                // Convert image buffer to base64
                profileImage = req.file.buffer.toString('base64');
                
                // Clean the base64 string
                profileImage = profileImage.replace(/[\s\r\n]+/g, '');
                
                // Validate base64 format
                if (!profileImage.match(/^[A-Za-z0-9+/]+=*$/)) {
                    return res.status(400).json({ 
                        status: 'error', 
                        message: 'Invalid image format' 
                    });
                }
                
                profileImageType = req.file.mimetype;
            } catch (error) {
                console.error('Error processing profile image:', error);
                return res.status(400).json({ 
                    status: 'error', 
                    message: 'Error processing profile image' 
                });
            }
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ 
                status: 'error', 
                message: 'User already exists' 
            });
        }

        const newUser = new User({
            name,
            email,
            mobile,
            password,
            profileImage,
            profileImageType
        });

        await newUser.save();
        
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

// **Login Route**
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Process and validate the profile image
        let profileImage = null;
        try {
            if (user.profileImage) {
                // Convert Buffer to base64 if needed
                if (Buffer.isBuffer(user.profileImage)) {
                    profileImage = user.profileImage.toString('base64');
                } else if (typeof user.profileImage === 'string') {
                    profileImage = user.profileImage;
                }
                
                // Clean the base64 string
                if (profileImage) {
                    // Remove any existing data URL prefix
                    profileImage = profileImage.replace(/^data:image\/[a-z]+;base64,/, '');
                    // Remove any whitespace or invalid characters
                    profileImage = profileImage.replace(/[\s\r\n]+/g, '');
                    // Validate base64 format
                    if (!profileImage.match(/^[A-Za-z0-9+/]+=*$/)) {
                        console.warn('Invalid base64 format detected, clearing profile image');
                        profileImage = null;
                    }
                }
            }
        } catch (error) {
            console.error('Error processing profile image:', error);
            profileImage = null;
        }

        const profileImageType = user.profileImageType || 'image/jpeg';
        console.log('Login: Profile image validation completed');

        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            profileImage: user.profileImage ? user.profileImage.toString('base64') : null,
            profileImageType: user.profileImageType || 'image/jpeg'
        };
        console.log('Profile image length:', userResponse.profileImage?.length);
console.log('Profile image type:', userResponse.profileImageType);
        

        res.status(200).json({ 
            message: 'Login successful', 
            user: userResponse 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// **Get Profile Route**
app.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        res.status(200).json({ status: 'success', user });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error fetching profile', details: error.message });
    }
});

// **Update Profile Route**
app.put('/profile/:userId', async (req, res) => {
    try {
        const { name, email, contact } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.params.userId,
            { name, email, contact },
            { new: true }
        );
        if (!updatedUser) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        res.status(200).json({ status: 'success', message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error updating profile', details: error.message });
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