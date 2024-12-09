import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import User from './userdetail.js';
import FoundItem from './founditemschema.js';

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

// Found item route
app.post('/report-found', upload.single('photo'), async (req, res) => {
    try {
        const { itemName, time, contact, location, date, description } = req.body;

        // Validation
        if (!itemName || !time || !contact || !location || !date) {
            return res.status(400).json({
                status: 'error',
                message: 'Required fields are missing'
            });
        }

        // Create new found item
        const newFoundItem = new FoundItem({
            itemName,
            time,
            contact,
            location,
            date,
            description,
            photo: req.file ? req.file.path : null,
        });

        await newFoundItem.save();
        console.log('Found item reported successfully');

        res.status(201).json({
            status: 'success',
            message: 'Found item reported successfully'
        });
    } catch (error) {
        console.error('Report found item error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error during report submission'
        });
    }
});

// Start server
const PORT = process.env.PORT || 5003;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});