import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import { User } from './userdetail.js';
import FoundItem from './founditemschema.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import LostItem from './lostitemschema.js';
import Message from './messageschema.js';
import Notification from './notificationschema.js';
import natural from 'natural';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { findPotentialMatches } from './matching.js';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins (you can restrict this in production)
        methods: ['GET', 'POST'],
    },
});

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'Authentication token required'
        });
    }

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Token has expired, please login again'
            });
        }
        
        return res.status(403).json({
            status: 'error',
            message: 'Invalid or expired token'
        });
    }
};

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Use memory storage instead of disk storage
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});


// MongoDB connection
const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB with URI:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4, // Force IPv4
        });
        console.log('MongoDB connected successfully');

        // Test the connection by counting messages
        const messageCount = await Message.countDocuments();
        console.log(`Database contains ${messageCount} messages`);

        // Test the User model
        const userCount = await User.countDocuments();
        console.log(`Database contains ${userCount} users`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Monitor MongoDB connection
mongoose.connection.on('connected', () => console.log('Mongoose connected to MongoDB Atlas'));
mongoose.connection.on('error', (err) => console.error('Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

// Connect to MongoDB
connectDB();

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a room (user ID)
    socket.on('joinRoom', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined room`);
    });

    // Send and receive messages
    socket.on('sendMessage', async (message) => {
        try {
            const { receiverId, senderId, text, clientMessageId } = message;
            console.log(`Received message from ${senderId} to ${receiverId}: ${text}`);

            // Check if a message with this client-generated ID already exists
            if (clientMessageId) {
                const existingMessage = await Message.findOne({ clientMessageId });
                if (existingMessage) {
                    console.log(`Message with ID ${clientMessageId} already exists, skipping duplicate`);

                    // Emit the existing message back to the sender for confirmation
                    io.to(senderId).emit('messageSaved', {
                        _id: existingMessage._id,
                        senderId,
                        text,
                        createdAt: existingMessage.createdAt,
                        clientMessageId
                    });

                    return;
                }
            }

            // Save message to database
            const newMessage = new Message({
                senderId,
                receiverId,
                text,
                createdAt: new Date(),
                read: false,
                clientMessageId: clientMessageId || null
            });

            const savedMessage = await newMessage.save();
            console.log('Message saved to database:', savedMessage);

            // Emit the message to the receiver
            io.to(receiverId).emit('receiveMessage', {
                _id: savedMessage._id,
                senderId,
                text,
                createdAt: savedMessage.createdAt,
                clientMessageId
            });

            // Emit confirmation back to the sender
            io.to(senderId).emit('messageSaved', {
                _id: savedMessage._id,
                senderId,
                text,
                createdAt: savedMessage.createdAt,
                clientMessageId
            });

            console.log(`Message sent from ${senderId} to ${receiverId}: ${text}`);
        } catch (error) {
            console.error('Error saving message:', error);
            // Emit error back to sender
            socket.emit('messageError', {
                error: 'Failed to save message',
                clientMessageId: message.clientMessageId
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

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


// Modify this section in app.js for the login route

// Login attempts tracking for basic rate limiting
const loginAttempts = {};

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check for missing fields
    if (!email || !password) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Email and password are required' 
      });
    }
    
    // Basic rate limiting
    const ipAddress = req.ip || req.connection.remoteAddress;
    if (loginAttempts[ipAddress]) {
      const attempts = loginAttempts[ipAddress];
      const now = Date.now();
      
      // Reset attempts after 15 minutes
      if (attempts.timestamp < now - 15 * 60 * 1000) {
        loginAttempts[ipAddress] = { count: 1, timestamp: now };
      } else if (attempts.count >= 5) {
        return res.status(429).json({
          status: 'error',
          message: 'Too many login attempts. Please try again later.'
        });
      } else {
        loginAttempts[ipAddress].count += 1;
      }
    } else {
      loginAttempts[ipAddress] = { count: 1, timestamp: Date.now() };
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // Avoid timing attacks by still comparing password even if user doesn't exist
    if (!user) {
      await bcrypt.compare(password, '$2b$10$InvalidUserHashForSecurityPurposes');
      return res.status(401).json({ 
        status: 'error', 
        message: 'Invalid email or password' 
      });
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Invalid email or password' 
      });
    }
    
    // If login successful, reset the attempts counter
    if (loginAttempts[ipAddress]) {
      delete loginAttempts[ipAddress];
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );
    
    // Prepare user data for response (excluding sensitive information)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      profileImage: user.profileImage
    };
    
    // Return success response with token and user data
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      user: userData,
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login', details: error.message });
  }
});

//get profileroute

app.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // ✅ Validate if userId is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ status: 'error', message: 'Invalid user ID format' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        let profileImage = null;
        if (user.profileImage && user.profileImage.buffer) {
            const base64Image = Buffer.from(user.profileImage.buffer).toString('base64');
            profileImage = `data:${user.profileImageType || 'image/jpeg'};base64,${base64Image}`;
        }

        console.log("🔹 Sending Profile Image (Base64 Length):", profileImage ? profileImage.length : "No Image"); // Debugging

        res.status(200).json({
            status: 'success',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                profileImage, // ✅ Correct Base64-encoded image
                profileImageType: user.profileImageType || 'image/jpeg'
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error fetching profile', details: error.message });
    }
});

// **Update Profile Route**
const uploadMiddleware = multer({ storage: upload });

// **Use the existing 'upload' instead of declaring a new one**
app.put('/profile/:userId', upload.single('profileImage'), async (req, res) => {
    try {
        console.log('Received profile update request');
        console.log('Request body:', req.body);
        console.log('File:', req.file);

        const { userId } = req.params;
        const { name, email, mobile } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.log('Invalid user ID:', userId);
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID format'
            });
        }

        const existingUser = await User.findById(userId);
        if (!existingUser) {
            console.log('User not found:', userId);
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Handle profile image update
        let profileImage = existingUser.profileImage;
        let profileImageType = existingUser.profileImageType;

        if (req.file) {
            console.log('Processing new profile image');
            try {
                profileImage = req.file.buffer.toString('base64');
                profileImageType = req.file.mimetype;
                console.log('Image processed successfully');
            } catch (error) {
                console.error('Error processing image:', error);
                return res.status(400).json({
                    status: 'error',
                    message: 'Error processing profile image'
                });
            }
        }

        // Update user data
        const updateData = {
            name: name || existingUser.name,
            email: email || existingUser.email,
            mobile: mobile || existingUser.mobile,
            profileImage,
            profileImageType
        };

        console.log('Updating user with data:', {
            ...updateData,
            profileImage: updateData.profileImage ? 'base64_string' : null
        });

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        console.log('User updated successfully');

        res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully',
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                mobile: updatedUser.mobile,
                profileImage: updatedUser.profileImage,
                profileImageType: updatedUser.profileImageType
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error updating profile',
            details: error.message
        });
    }
});

app.get('/search-users', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                status: 'error',
                message: 'Search query is required'
            });
        }

        if (query.length < 3) {
            return res.status(400).json({
                status: 'error',
                message: 'Search query must be at least 3 characters long'
            });
        }

        const searchRegex = new RegExp(query, 'i');

        const users = await User.find({
            $or: [
                { name: searchRegex },
                { email: searchRegex }
            ]
        }).select('name email profileImage profileImageType').lean();

        // Process users to properly include profile images
        const processedUsers = users.map(user => ({
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            profileImage: user.profileImage,  // Send the full base64 string
            profileImageType: user.profileImageType || 'image/jpeg'
        }));

        return res.json({
            status: 'success',
            users: processedUsers
        });

    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Server error while searching users'
        });
    }
});

// **Report Found Item**
app.post('/reportfound', upload.single('photo'), async (req, res) => {
    try {
        console.log('Received found item report:', req.body);
        const { contact, location, time, date, description, category, userId, itemName, latitude, longitude } = req.body;
        
        // Log the user ID for debugging
        console.log(`User ID from request: ${userId}`);
        
        // Extract userId from the JWT token if not provided in the request
        let extractedUserId = userId;
        if ((!extractedUserId || extractedUserId === 'null' || extractedUserId === 'undefined') && req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                extractedUserId = decoded.userId || decoded._id || decoded.id;
                console.log('Extracted userId from token:', extractedUserId);
            } catch (tokenError) {
                console.error('Error extracting userId from token:', tokenError);
            }
        }
        
        // Validation with detailed error messages
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

        let photoData = null;
        if (req.file) {
            photoData = req.file.buffer;
        }

        // Parse userId properly
        let userIdObj = null;
        if (extractedUserId && mongoose.Types.ObjectId.isValid(extractedUserId)) {
            userIdObj = new mongoose.Types.ObjectId(extractedUserId);
            console.log('Valid ObjectId for userId:', userIdObj);
        } else if (extractedUserId) {
            console.log('Invalid ObjectId format for userId:', extractedUserId);
        } else {
            console.log('No userId provided or extracted from token');
        }

        const foundItem = new FoundItem({
            contact, 
            location, 
            time, 
            date, 
            description,
            category,
            userId: userIdObj, // Use the properly parsed ObjectId or null
            itemName: itemName || description.substring(0, 30),
            coordinates: {
                latitude: latitude || null,
                longitude: longitude || null
            },
            photo: photoData
        });

        const savedItem = await foundItem.save();
        console.log(`Found item saved with ID: ${savedItem._id}, User ID: ${savedItem.userId}`);
        
        res.status(201).json({ 
            status: 'success', 
            message: 'Found item reported successfully',
            itemId: savedItem._id
        });
    } catch (error) {
        console.error('Error reporting found item:', error);
        res.status(500).json({ status: 'error', message: 'Server error reporting found item' });
    }
});

// Add alias for /founditem to match frontend
app.post('/founditem', upload.single('photo'), async (req, res) => {
    try {
        const { contact, location, time, date, description, category, userId, itemName, latitude, longitude } = req.body;
        if (!contact || !location || !time || !date || !description || !category) {
            return res.status(400).json({ status: 'error', message: 'All fields are required' });
        }

        // Extract userId from the JWT token if not provided in the request
        let extractedUserId = userId;
        if ((!extractedUserId || extractedUserId === 'null' || extractedUserId === 'undefined') && req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                extractedUserId = decoded.userId || decoded._id || decoded.id;
                console.log('Extracted userId from token:', extractedUserId);
            } catch (tokenError) {
                console.error('Error extracting userId from token:', tokenError);
            }
        }

        // Parse userId properly
        let userIdObj = null;
        if (extractedUserId && mongoose.Types.ObjectId.isValid(extractedUserId)) {
            userIdObj = new mongoose.Types.ObjectId(extractedUserId);
            console.log('Valid ObjectId for userId:', userIdObj);
        } else if (extractedUserId) {
            console.log('Invalid ObjectId format for userId:', extractedUserId);
        } else {
            console.log('No userId provided or extracted from token');
        }

        const foundItem = new FoundItem({
            contact, 
            location, 
            time, 
            date, 
            description,
            category,
            userId: userIdObj, // Use the properly parsed ObjectId or null
            itemName: itemName || description.substring(0, 30),
            coordinates: {
                latitude: latitude || null,
                longitude: longitude || null
            },
            photo: req.file ? req.file.buffer : null
        });

        await foundItem.save();
        res.status(201).json({ status: 'success', message: 'Found item reported successfully' });
    } catch (error) {
        console.error('Error reporting found item:', error);
        res.status(500).json({ status: 'error', message: 'Server error reporting found item' });
    }
});

// **Report Lost Item**
app.post('/reportlost', upload.single('photo'), async (req, res) => {
    try {
        console.log('Received lost item report:', req.body);
        console.log('Content-Type:', req.headers['content-type']);
        
        let { contact, location, time, date, description, category, userId, itemName, latitude, longitude, uniquePoint } = req.body;
        
        // Extract userId from the JWT token if not provided in the request
        if (!userId && req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId || decoded._id || decoded.id;
                console.log('Extracted userId from token:', userId);
            } catch (tokenError) {
                console.error('Error extracting userId from token:', tokenError);
            }
        }
        
        // Log the user ID and uniquePoint for debugging
        console.log(`User ID from request: ${userId}`);
        console.log(`uniquePoint from request: ${uniquePoint}`);
        console.log(`uniquePoint type: ${typeof uniquePoint}`);
        console.log(`All req.body keys: ${Object.keys(req.body)}`);
        
        // Validation with detailed error messages
        const missingFields = [];
        if (!contact) missingFields.push('contact');
        if (!location) missingFields.push('location');
        if (!time) missingFields.push('time');
        if (!date) missingFields.push('date');
        if (!description) missingFields.push('description');
        if (!category) missingFields.push('category');
        if (!uniquePoint) missingFields.push('uniquePoint');

        if (missingFields.length > 0) {
            console.log(`Missing required fields: ${missingFields.join(', ')}`);
            return res.status(400).json({ 
                status: 'error', 
                message: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        let photoData = null;
        if (req.file) {
            photoData = req.file.buffer;
        }

        const lostItem = new LostItem({
            contact,
            location,
            time,
            date,
            description,
            category,
            userId: userId || null,
            itemName: itemName || description.substring(0, 30),
            coordinates: {
                latitude: latitude || null,
                longitude: longitude || null
            },
            uniquePoint: uniquePoint || "", // Ensure it's at least an empty string instead of undefined
            photo: photoData
        });

        try {
            // Add extra validation check here
            if (!lostItem.uniquePoint) {
                return res.status(400).json({ 
                    status: 'validation_error', 
                    message: 'Validation error', 
                    errors: ['uniquePoint: Path `uniquePoint` is required.']
                });
            }
            
            // Log the complete item before saving
            console.log('Attempting to save lost item:', {
                contact: lostItem.contact,
                location: lostItem.location,
                category: lostItem.category,
                userId: lostItem.userId,
                uniquePoint: lostItem.uniquePoint,
                hasPhoto: !!lostItem.photo
            });
            
            const savedItem = await lostItem.save();
            res.status(201).json({ 
                status: 'success', 
                message: 'Lost item reported successfully',
                itemId: savedItem._id
            });
        } catch (saveError) {
            console.error('Error saving lost item:', saveError);
            if (saveError.name === 'ValidationError') {
                const validationErrors = Object.keys(saveError.errors).map(field => 
                    `${field}: ${saveError.errors[field].message}`
                );
                return res.status(400).json({ 
                    status: 'validation_error', 
                    message: 'Validation error', 
                    errors: validationErrors 
                });
            }
            throw saveError; // Re-throw for the outer catch
        }
    } catch (error) {
        console.error('Error reporting lost item:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Server error reporting lost item',
            details: error.message 
        });
    }
});

// Add alias for /lostitem to match frontend
app.post('/lostitem', upload.single('photo'), async (req, res) => {
    try {
        console.log('Received lost item report:', req.body);
        const { contact, location, time, date, description, category, userId, itemName, latitude, longitude, uniquePoint } = req.body;
        
        // Validation with detailed error messages
        const missingFields = [];
        if (!contact) missingFields.push('contact');
        if (!location) missingFields.push('location');
        if (!time) missingFields.push('time');
        if (!date) missingFields.push('date');
        if (!description) missingFields.push('description');
        if (!category) missingFields.push('category');
        if (!uniquePoint) missingFields.push('uniquePoint');

        if (missingFields.length > 0) {
            console.log(`Missing required fields: ${missingFields.join(', ')}`);
            return res.status(400).json({ 
                status: 'error', 
                message: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        let photoData = null;
        if (req.file) {
            photoData = req.file.buffer;
        }

        const lostItem = new LostItem({
            contact,
            location,
            time,
            date,
            description,
            category,
            userId: userId || null,
            itemName: itemName || description.substring(0, 30),
            uniquePoint: uniquePoint,
            coordinates: {
                latitude: latitude || null,
                longitude: longitude || null
            },
            photo: photoData
        });

        try {
            const savedItem = await lostItem.save();
            res.status(201).json({ 
                status: 'success', 
                message: 'Lost item reported successfully',
                itemId: savedItem._id
            });
        } catch (saveError) {
            console.error('Error saving lost item:', saveError);
            if (saveError.name === 'ValidationError') {
                const validationErrors = Object.keys(saveError.errors).map(field => 
                    `${field}: ${saveError.errors[field].message}`
                );
                return res.status(400).json({ 
                    status: 'validation_error', 
                    message: 'Validation error', 
                    errors: validationErrors 
                });
            }
            throw saveError; // Re-throw for the outer catch
        }
    } catch (error) {
        console.error('Error reporting lost item:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Server error reporting lost item',
            details: error.message 
        });
    }
});

// **Get user notifications**
app.get('/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID is required'
            });
        }

        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json({
            status: 'success',
            notifications
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching notifications',
            details: error.message
        });
    }
});

// **Mark notification as read**
app.put('/api/notifications/:notificationId/read', async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// **Get Lost Item by ID**
app.get('/lostitem/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid item ID format'
            });
        }

        const lostItem = await LostItem.findById(id);

        if (!lostItem) {
            return res.status(404).json({
                status: 'error',
                message: 'Lost item not found'
            });
        }

        res.status(200).json({
            status: 'success',
            item: lostItem
        });

    } catch (error) {
        console.error('Error fetching lost item:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching lost item',
            details: error.message
        });
    }
});

// **Get Found Item by ID**
app.get('/founditem/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid item ID format'
            });
        }

        const foundItem = await FoundItem.findById(id);

        if (!foundItem) {
            return res.status(404).json({
                status: 'error',
                message: 'Found item not found'
            });
        }

        res.status(200).json({
            status: 'success',
            item: foundItem
        });

    } catch (error) {
        console.error('Error fetching found item:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching found item',
            details: error.message
        });
    }
});

// **Get User's Lost Items**
app.get('/user/:userId/lostitems', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID is required'
            });
        }

        // Find all lost items reported by this user (based on contact info)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Use the user's contact information to find their lost items
        const lostItems = await LostItem.find({ contact: user.mobile })
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            items: lostItems
        });

    } catch (error) {
        console.error('Error fetching user lost items:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user lost items',
            details: error.message
        });
    }
});

// **Get User's Found Items**
app.get('/user/:userId/founditems', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID is required'
            });
        }

        // Find all found items reported by this user (based on contact info)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Use the user's contact information to find their found items
        const foundItems = await FoundItem.find({ contact: user.mobile })
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            items: foundItems
        });

    } catch (error) {
        console.error('Error fetching user found items:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user found items',
            details: error.message
        });
    }
});

// **Get User Matches**
app.get('/user-matches/:userId', async (req, res) => {
    try {
        // Since we removed matching functionality
        return res.json({
            status: 'success',
            matches: [],
            totalMatches: 0,
            message: 'Matching functionality has been disabled'
        });
    } catch (error) {
        console.error('Error in user-matches endpoint:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Notification polling endpoint
app.get('/api/notifications/poll/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { lastPolled } = req.query;

        const query = {
            userId,
            createdAt: { $gt: new Date(parseInt(lastPolled) || 0) }
        };

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            notifications,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Error polling notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Notification.countDocuments({ userId });

        res.json({
            success: true,
            notifications,
            total,
            hasMore: skip + notifications.length < total
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications'
        });
    }
});

app.put('/api/notifications/:notificationId/read', async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

app.put('/api/notifications/:userId/read-all', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await Notification.updateMany(
            { userId, read: false },
            { read: true }
        );

        res.json({
            success: true,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update notifications'
        });
    }
});

app.get('/api/notifications/:userId/unread-count', async (req, res) => {
    try {
        const { userId } = req.params;

        const count = await Notification.countDocuments({
            userId,
            read: false
        });

        res.json({ count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

// Create notification
async function createNotification(userId, type, title, message, data = {}) {
    try {
        // Create notification in database
        const notification = new Notification({
            userId,
            type,
            title,
            message,
            ...data,
            read: false,
            createdAt: new Date()
        });

        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

// **Start Server**
const PORT = process.env.PORT || 5000;

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
        // Try the next port
        server.listen(PORT + 1, '0.0.0.0', () => {
            console.log(`Server running on http://0.0.0.0:${PORT + 1}`);
        });
    } else {
        console.error('Server error:', error);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Helper function to normalize text for better matching
function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().trim();
}

// Get user info from token
app.get('/user/info', async (req, res) => {
    try {
        // Check for auth token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized - No token provided' });
        }

        // Extract and verify token
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Extract user ID from token
        const userId = decoded.userId || decoded._id || decoded.id;
        
        if (!userId) {
            return res.status(400).json({ status: 'error', message: 'Invalid token - No user ID found' });
        }
        
        // Find user in database
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        
        // Return user info
        res.status(200).json(user);
    } catch (error) {
        console.error('Error getting user info:', error);
        
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ status: 'error', message: 'Unauthorized - Invalid token' });
        }
        
        res.status(500).json({ status: 'error', message: 'Server error getting user info' });
    }
});
// **Message API endpoints**
app.get('/api/messages/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fetching conversations for user: ${userId}`);
        
        // Find all conversations where the user is either sender or receiver
        const messages = await Message.find({
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ]
        }).sort({ createdAt: -1 });
        
        console.log(`Found ${messages.length} messages for user ${userId}`);
        
        // Group messages by conversation partner
        const conversationMap = new Map();
        
        for (const message of messages) {
            // Determine the conversation partner ID
            const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
            
            // If this is the first message we've seen for this conversation, add it
            if (!conversationMap.has(partnerId)) {
                conversationMap.set(partnerId, message);
            }
        }
        
        console.log(`Grouped into ${conversationMap.size} conversations`);
        
        // Convert the map to an array of conversations
        const conversations = [];
        
        for (const [partnerId, lastMessage] of conversationMap.entries()) {
            try {
                // Look up the user details - try with both string and ObjectId
                let partner;
                try {
                    // First try with the ID as is
                    partner = await User.findOne({ _id: partnerId });
                } catch (err) {
                    console.log(`Error finding user with ID ${partnerId}, trying alternative formats`);
                }
                
                if (!partner) {
                    // If not found, try with string ID
                    try {
                        partner = await User.findOne({ _id: partnerId.toString() });
                    } catch (err) {
                        console.log(`Error finding user with string ID ${partnerId}`);
                    }
                }
                
                if (partner) {
                    console.log(`Found user details for ${partnerId}: ${partner.name}`);
                    
                    // Process the profile image if it exists
                    let avatar = null;
                    if (partner.profileImage) {
                        // If it's already a data URI or URL, use it as is
                        if (typeof partner.profileImage === 'string' && 
                            (partner.profileImage.startsWith('data:') || partner.profileImage.startsWith('http'))) {
                            avatar = partner.profileImage;
                        } else {
                            // Otherwise, it's likely a Buffer or base64 string
                            avatar = partner.profileImage;
                        }
                    }
                    
                    conversations.push({
                        id: partnerId,
                        name: partner.name || 'Unknown User',
                        lastMessage: lastMessage.text,
                        time: formatMessageTime(lastMessage.createdAt),
                        avatar: avatar,
                        unread: !lastMessage.read && lastMessage.receiverId === userId
                    });
                } else {
                    console.log(`No user details found for ${partnerId}`);
                    
                    // Include the conversation even if we can't find the user
                    conversations.push({
                        id: partnerId,
                        name: 'Unknown User',
                        lastMessage: lastMessage.text,
                        time: formatMessageTime(lastMessage.createdAt),
                        avatar: null,
                        unread: !lastMessage.read && lastMessage.receiverId === userId
                    });
                }
            } catch (error) {
                console.error(`Error looking up user ${partnerId}:`, error);
                
                // Still include the conversation even if there's an error
                conversations.push({
                    id: partnerId,
                    name: 'Unknown User',
                    lastMessage: lastMessage.text,
                    time: formatMessageTime(lastMessage.createdAt),
                    avatar: null,
                    unread: !lastMessage.read && lastMessage.receiverId === userId
                });
            }
        }
        
        console.log(`Returning ${conversations.length} formatted conversations`);
        res.status(200).json(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ message: 'Failed to fetch conversations' });
    }
});

app.get('/api/messages/:userId/:otherUserId', async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;
        
        if (!userId || !otherUserId || 
            !mongoose.Types.ObjectId.isValid(userId) || 
            !mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Invalid user IDs' 
            });
        }
        
        console.log(`Fetching messages between ${userId} and ${otherUserId}`);
        
        // Find all messages between the two users
        const messages = await Message.find({
            $or: [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId }
            ]
        }).sort({ createdAt: 1 }); // Sort by createdAt in ascending order (oldest first)
        
        console.log(`Found ${messages.length} messages between ${userId} and ${otherUserId}`);
        
        // Get user details for both sender and receiver
        const [user, otherUser] = await Promise.all([
            User.findById(userId),
            User.findById(otherUserId)
        ]);
        
        // Format messages for GiftedChat
        const formattedMessages = messages.map(msg => ({
            _id: msg._id.toString(),
            text: msg.text,
            createdAt: msg.createdAt,
            user: {
                _id: msg.senderId,
                name: msg.senderId === userId 
                    ? (user ? user.name : 'You') 
                    : (otherUser ? otherUser.name : 'Other User'),
                avatar: msg.senderId === userId 
                    ? (user && user.profileImage ? user.profileImage : null) 
                    : (otherUser && otherUser.profileImage ? otherUser.profileImage : null)
            },
            received: true,
            sent: true,
            pending: false
        }));
        
        // Mark messages as read
        const updateResult = await Message.updateMany(
            { senderId: otherUserId, receiverId: userId, read: false },
            { $set: { read: true } }
        );
        
        console.log(`Marked ${updateResult.modifiedCount} messages as read`);
        
        res.status(200).json({
            status: 'success',
            messages: formattedMessages,
            otherUser: otherUser ? {
                _id: otherUser._id,
                name: otherUser.name || 'User',
                avatar: otherUser.profileImage
            } : null
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Failed to fetch messages',
            error: error.message
        });
    }
});

// API endpoint for directly saving messages
app.post('/api/messages', async (req, res) => {
    try {
        const { senderId, receiverId, text } = req.body;
        
        if (!senderId || !receiverId || !text) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing required fields: senderId, receiverId, text' 
            });
        }
        
        console.log(`API: Saving message from ${senderId} to ${receiverId}: ${text}`);
        
        // Create and save the message
        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            createdAt: new Date(),
            read: false
        });
        
        const savedMessage = await newMessage.save();
        console.log('Message saved to database via API:', savedMessage);
        
        // Emit the message via Socket.IO for real-time delivery
        io.to(receiverId).emit('receiveMessage', { 
            _id: savedMessage._id,
            senderId, 
            text,
            createdAt: savedMessage.createdAt
        });
        
        res.status(201).json({
            status: 'success',
            message: 'Message saved successfully',
            data: savedMessage
        });
    } catch (error) {
        console.error('Error saving message via API:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to save message' 
        });
    }
});

// Helper function to format message time
function formatMessageTime(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInDays = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
        // Today: show time
        return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
        // Yesterday
        return 'Yesterday';
    } else if (diffInDays < 7) {
        // Within a week: show day name
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[messageDate.getDay()];
    } else {
        // Older: show date
        return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
};
app.get('/api-test', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'API is running' });
  });

  app.post('/api/match', async (req, res) => {
    try {
        console.log('Match request received:', req.body);
        const { lost_desc, found_desc } = req.body;

        if (!lost_desc || !found_desc) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Both lost and found descriptions are required' 
            });
        }

        // Try to get the Python API URL from env vars with a fallback to the direct IP
        const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5001';
        console.log('Using Python API URL:', pythonApiUrl);
        
        // Send descriptions to the Python API with timeout
        console.log('Sending request to Python API at:', pythonApiUrl);
        const response = await axios.post(`${pythonApiUrl}/match`, {
            lost_desc,
            found_desc
        }, {
            timeout: 8000, // 8 second timeout
            headers: { 'Content-Type': 'application/json' }
        });

        // Valid response received from Python API
        console.log('Python API responded with:', response.data);
        
        // Ensure the response has a similarity_score
        if (response.data && typeof response.data.similarity_score === 'number') {
            res.json({
                status: 'success',
                ...response.data
            });
        } else {
            console.error('Invalid response format from Python API:', response.data);
            res.status(500).json({ 
                status: 'error', 
                message: 'Invalid response from matching service',
                similarity_score: 0
            });
        }
    } catch (error) {
        console.error("Error communicating with Python API:", error.message);
        
        // Check if it's a timeout error
        if (error.code === 'ECONNABORTED') {
            return res.status(503).json({ 
                status: 'error', 
                message: 'Matching service timed out', 
                similarity_score: 0
            });
        }
        
        // Check if it's a connection error
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ 
                status: 'error', 
                message: 'Matching service is currently unavailable',
                similarity_score: 0
            });
        }
        
        res.status(500).json({ 
            status: 'error', 
            message: 'Matching service error: ' + error.message,
            similarity_score: 0
        });
    }
});

// Create a lost item report with potential matches
app.post('/api/lost-items', async (req, res) => {
    try {
        const lostItem = new LostItem(req.body);
        await lostItem.save();
        
        // Find potential matches with existing found items
        const potentialMatches = await findPotentialMatches(lostItem.description, 'found');
        
        res.status(201).json({
            status: 'success',
            data: {
                lostItem,
                potentialMatches
            }
        });
    } catch (error) {
        console.error('Error creating lost item:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to report lost item',
            error: error.message
        });
    }
});

// Create a found item report with potential matches
app.post('/api/found-items', async (req, res) => {
    try {
        const foundItem = new FoundItem(req.body);
        await foundItem.save();
        
        // Find potential matches with existing lost items
        const potentialMatches = await findPotentialMatches(foundItem.description, 'lost');
        
        res.status(201).json({
            status: 'success',
            data: {
                foundItem,
                potentialMatches
            }
        });
    } catch (error) {
        console.error('Error creating found item:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to report found item',
            error: error.message
        });
    }
});

// Match model definition
const matchSchema = new mongoose.Schema({
    lostItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LostItem',
        required: true
    },
    foundItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoundItem',
        required: true
    },
    similarityScore: {
        type: Number,
        required: true
    },
    matchDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'rejected'],
        default: 'pending'
    }
}, { timestamps: true });

const Match = mongoose.model('Match', matchSchema);

// Record a match between items
app.post('/api/record-match', async (req, res) => {
    try {
        const { lostItemId, foundItemId, similarityScore } = req.body;

        if (!lostItemId || !foundItemId) {
            return res.status(400).json({
                status: 'error',
                message: 'Both lost item ID and found item ID are required'
            });
        }

        if (similarityScore < 0.4) {
            return res.status(400).json({
                status: 'error',
                message: 'Similarity score too low to record a match'
            });
        }

        const match = new Match({
            lostItemId,
            foundItemId,
            similarityScore,
            status: 'confirmed'
        });

        await match.save();

        res.json({
            status: 'success',
            data: { match }
        });
    } catch (error) {
        console.error('Error recording match:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to record match',
            error: error.message
        });
    }
});