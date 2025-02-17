import { User } from './userdetail.js';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import bcrypt from 'bcrypt';
import fs from 'fs';
import FoundItem from './founditemschema.js';
import LostItem from './lostitemschema.js';

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

// **Register Route**
app.post('/register', upload.single('profileImage'), async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        console.log('Received file:', req.file ? `File size: ${req.file.size} bytes` : 'No file received');

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

        // Validate and process profile image
        let profileImage = null;
        let profileImageType = null;
        
        if (req.file) {
            try {
                // Validate file size (max 5MB)
                if (req.file.size > 5 * 1024 * 1024) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Image file too large (max 5MB allowed)'
                    });
                }
                
                // Validate MIME type
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
                if (!allowedTypes.includes(req.file.mimetype)) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid image format. Allowed formats: JPEG, PNG, GIF, WebP, HEIC'
                    });
                }
                
                // Convert image buffer to base64
                profileImage = req.file.buffer.toString('base64');
                
                // Clean the base64 string
                profileImage = profileImage.replace(/[\s\r\n]+/g, '');
                
                // Validate base64 format with more permissive regex
                if (!profileImage.match(/^[A-Za-z0-9+/]+=*$/)) {
                    return res.status(400).json({ 
                        status: 'error', 
                        message: 'Invalid image data format' 
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
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Profile image is required'
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ 
                status: 'error', 
                message: 'User already exists with this email' 
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
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Process profile image
        let profileImage = user.profileImage;
        let profileImageType = user.profileImageType || 'image/jpeg';

        // If profile image exists, ensure it's properly formatted
        if (profileImage) {
            if (Buffer.isBuffer(profileImage)) {
                profileImage = profileImage.toString('base64');
            }

            // Remove any existing data URL prefix if present
            profileImage = profileImage.replace(/^data:image\/[a-z]+;base64,/, '');
            // Clean the base64 string
            profileImage = profileImage.replace(/[\s\r\n]+/g, '');
        }

        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            profileImage: profileImage ? `data:${profileImageType};base64,${profileImage}` : null
        };

        console.log('Login successful for:', email);
        res.status(200).json({ 
            message: 'Login successful',
            user: userResponse
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// **Profile Route**
app.post('/uploadProfileImage', upload.single('profileImage'), async (req, res) => {
    const { name, email, mobile, password } = req.body;
    const profileImage = req.file;
  
    const newUser = new User({
      name,
      email,
      mobile,
      password,
      profileImage: profileImage.buffer, // Store image as buffer
      profileImageType: profileImage.mimetype, // Store image type (e.g., image/jpeg)
    });
  
    try {
      const savedUser = await newUser.save();
      res.status(201).json({
        message: 'User created successfully',
        user: savedUser,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error creating user', error });
    }
  });
  
  // Route to fetch user profile (with image in base64 format)
  app.get('/profile/:userId', async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      let profileImage = null;
      if (user.profileImage) {
        // Convert buffer to Base64 string
        profileImage = `data:${user.profileImageType || 'image/jpeg'};base64,${user.profileImage.toString('base64')}`;
      }
  
      res.status(200).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          profileImage, // Send the Base64-encoded profile image string
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching user profile', error });
    }
  });

// **Report Found Item Route**
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

// **Report Lost Item Route**
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
        res.status(500).json({ status: 'error', message: 'Server error reporting lost item' });
    }
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
