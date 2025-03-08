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

// Import the matching system
import { 
    findMatches, 
    precomputeItemEmbedding 
} from './itemMatching.js';

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
            const { receiverId, senderId, text, messageId } = message;
            console.log(`Received message from ${senderId} to ${receiverId}: ${text}`);
            
            // Check if a message with this client-generated ID already exists
            if (messageId) {
                const existingMessage = await Message.findOne({ clientMessageId: messageId });
                if (existingMessage) {
                    console.log(`Message with ID ${messageId} already exists, skipping duplicate`);
                    
                    // Emit the existing message back to the sender for confirmation
                    io.to(senderId).emit('messageSaved', { 
                        _id: existingMessage._id,
                        senderId, 
                        text,
                        createdAt: existingMessage.createdAt,
                        clientMessageId: messageId
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
                clientMessageId: messageId || null // Store the client-generated ID if provided
            });
            
            const savedMessage = await newMessage.save();
            console.log('Message saved to database:', savedMessage);
            
            // Emit the message to the receiver
            io.to(receiverId).emit('receiveMessage', { 
                _id: savedMessage._id,
                senderId, 
                text,
                createdAt: savedMessage.createdAt,
                clientMessageId: messageId
            });
            
            // Emit confirmation back to the sender
            io.to(senderId).emit('messageSaved', { 
                _id: savedMessage._id,
                senderId, 
                text,
                createdAt: savedMessage.createdAt,
                clientMessageId: messageId
            });
            
            console.log(`Message sent from ${senderId} to ${receiverId}: ${text}`);
        } catch (error) {
            console.error('Error saving message:', error);
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

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Process and validate the profile image
        let profileImage = null;
        let profileImageType = user.profileImageType || 'image/jpeg';

        try {
            if (user.profileImage) {
                // Handle Buffer or string
                if (Buffer.isBuffer(user.profileImage)) {
                    profileImage = user.profileImage.toString('base64');
                } else if (typeof user.profileImage === 'string') {
                    profileImage = user.profileImage;
                }

                // Clean the base64 string
                if (profileImage) {
                    // Remove any existing data URL prefix if present
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
            console.error('Error processing profile image during login:', error);
            profileImage = null;
        }

        // Constructing the user response object
        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            profileImage: profileImage,
            profileImageType: profileImageType
        };

        console.log('Login successful. Profile image length:', profileImage?.length);

        res.status(200).json({
            message: 'Login successful',
            user: userResponse
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
// In app.js, update the search-users route:

// In app.js, update the search-users route:

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
// Add this near the other routes in app.js
app.get('/api-test', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'API is working',
        timestamp: new Date()
    });
});

// Test endpoint to create a test message
app.get('/api/create-test-message', async (req, res) => {
    try {
        // Create a test message
        const testMessage = new Message({
            senderId: '67b443f3a395bfa585014af8', // Use the user ID from your logs
            receiverId: 'test-receiver-id',
            text: 'This is a test message',
            createdAt: new Date(),
            read: false
        });
        
        const savedMessage = await testMessage.save();
        console.log('Test message created:', savedMessage);
        
        res.status(201).json({
            status: 'success',
            message: 'Test message created',
            data: savedMessage
        });
    } catch (error) {
        console.error('Error creating test message:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create test message'
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

        const foundItem = new FoundItem({
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

        const foundItem = new FoundItem({
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
        const { contact, location, time, date, description, category, userId, itemName, latitude, longitude } = req.body;
        
        // Log the user ID for debugging
        console.log(`User ID from request: ${userId}`);
        
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
            photo: photoData
        });

        const savedItem = await lostItem.save();
        console.log(`Lost item saved with ID: ${savedItem._id}, User ID: ${savedItem.userId}`);
        
        res.status(201).json({ 
            status: 'success', 
            message: 'Lost item reported successfully',
            itemId: savedItem._id
        });
    } catch (error) {
        console.error('Error reporting lost item:', error);
        res.status(500).json({ status: 'error', message: 'Server error reporting lost item' });
    }
});

// Add alias for /lostitem to match frontend
app.post('/lostitem', upload.single('photo'), async (req, res) => {
    try {
        console.log('Received lost item report:', req.body);
        const { contact, location, time, date, description, category, userId, itemName, latitude, longitude } = req.body;
        
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
            photo: photoData
        });

        await lostItem.save();
        res.status(201).json({ status: 'success', message: 'Lost item reported successfully' });
    } catch (error) {
        console.error('Error reporting lost item:', error);
        res.status(500).json({ status: 'error', message: 'Server error reporting lost item' });
    }
});

// **Find Matching Items Based on Description**
app.post('/matchingfounditems', async (req, res) => {
    try {
        const { lostItemId, lostItemDescription, lostItemLocation, lostItemCategory, lostItemDate } = req.body;
        
        if (!lostItemDescription && !lostItemId) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing lost item information. Please provide either description or item ID' 
            });
        }

        let lostItem;
        if (lostItemId) {
            // If an ID is provided, fetch the lost item details
            lostItem = await LostItem.findById(lostItemId);
            if (!lostItem) {
                return res.status(404).json({ 
                    status: 'error', 
                    message: 'Lost item not found' 
                });
            }
        } else {
            // Create a temporary lost item object from the provided data
            lostItem = {
                description: lostItemDescription,
                location: lostItemLocation,
                category: lostItemCategory,
                date: lostItemDate || new Date()
            };
        }

        // Build a basic query to pre-filter items (for efficiency)
        const query = {};
        
        // Category matching (if available) - exact match for pre-filtering
        if (lostItem.category) {
            query.category = lostItem.category;
        }
        
        // Find potential matches with basic filtering
        const potentialMatches = await FoundItem.find(query).sort({ createdAt: -1 }).limit(50);

        if (potentialMatches.length === 0) {
            return res.status(200).json({ 
                status: 'not_found', 
                message: 'No items match your description yet. We\'ll notify you when a match is found.' 
            });
        }

        // Use the advanced matching system to score and rank matches
        const goodMatches = await findMatches(lostItem, potentialMatches);
        
        if (goodMatches.length === 0) {
            return res.status(200).json({ 
                status: 'no_good_matches', 
                message: 'No strong matches found for your item yet. We\'ll notify you when a better match is found.',
                potentialMatches: potentialMatches.slice(0, 5).map(item => ({
                    ...item.toObject(),
                    matchScore: 20 // Low confidence score
                }))
            });
        }

        res.status(200).json({ 
            status: 'success', 
            matchedItems: goodMatches,
            totalMatches: potentialMatches.length,
            goodMatches: goodMatches.length
        });
    } catch (error) {
        console.error('Error finding matched items:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Error finding matched items',
            details: error.message
        });
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
        console.log(`Fetching messages between ${userId} and ${otherUserId}`);
        
        // Validate user IDs
        if (!userId || !otherUserId) {
            return res.status(400).json({ 
                error: 'Missing user IDs',
                messages: [] 
            });
        }
        
        // Find all messages between the two users
        const messages = await Message.find({
            $or: [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId }
            ]
        }).sort({ createdAt: -1 }); // Sort by createdAt in descending order (newest first)
        
        console.log(`Found ${messages.length} messages between ${userId} and ${otherUserId}`);
        
        // Format messages for GiftedChat
        const formattedMessages = messages.map(msg => ({
            _id: msg._id.toString(),
            text: msg.text,
            createdAt: msg.createdAt,
            user: {
                _id: msg.senderId,
                // We don't have name and avatar here, client will need to handle that
            },
            received: true,
            sent: true
        }));
        
        // Mark messages as read
        try {
            const updateResult = await Message.updateMany(
                { senderId: otherUserId, receiverId: userId, read: false },
                { $set: { read: true } }
            );
            
            console.log(`Marked ${updateResult.modifiedCount} messages as read`);
        } catch (markError) {
            console.error('Error marking messages as read:', markError);
            // Continue anyway, this is not critical
        }
        
        res.status(200).json(formattedMessages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        // Return an empty array instead of an error to prevent app crashes
        res.status(200).json([]);
    }
});

// API endpoint for directly saving messages
app.post('/api/messages', async (req, res) => {
    try {
        const { senderId, receiverId, text, messageId } = req.body;
        
        if (!senderId || !receiverId || !text) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing required fields: senderId, receiverId, text' 
            });
        }
        
        console.log(`API: Saving message from ${senderId} to ${receiverId}: ${text}`);
        
        // Check if a message with this client-generated ID already exists
        if (messageId) {
            const existingMessage = await Message.findOne({ clientMessageId: messageId });
            if (existingMessage) {
                console.log(`Message with ID ${messageId} already exists, skipping duplicate`);
                return res.status(200).json({
                    status: 'success',
                    message: 'Message already exists',
                    data: existingMessage
                });
            }
        }
        
        // Create and save the message
        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            createdAt: new Date(),
            read: false,
            clientMessageId: messageId || null // Store the client-generated ID if provided
        });
        
        const savedMessage = await newMessage.save();
        console.log('Message saved to database via API:', savedMessage);
        
        // Emit the message via Socket.IO for real-time delivery
        try {
            io.to(receiverId).emit('receiveMessage', { 
                _id: savedMessage._id,
                senderId, 
                text,
                createdAt: savedMessage.createdAt,
                clientMessageId: messageId // Include the client-generated ID
            });
        } catch (socketError) {
            console.error('Error emitting message via Socket.IO:', socketError);
            // Continue anyway, the message is saved in the database
        }
        
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
}

// **Check for new matches and send notifications**
app.post('/check-for-matches', async (req, res) => {
    try {
        const { lostItemId } = req.body;
        
        if (!lostItemId) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing lost item ID' 
            });
        }
        
        // Get the lost item details
        const lostItem = await LostItem.findById(lostItemId);
        if (!lostItem) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Lost item not found' 
            });
        }
        
        // Find found items created after the lost item was reported
        const query = {
            createdAt: { $gt: lostItem.createdAt }
        };
        
        // Add category for basic filtering
        if (lostItem.category) {
            query.category = lostItem.category;
        }
        
        const newFoundItems = await FoundItem.find(query).sort({ createdAt: -1 });
        
        if (newFoundItems.length === 0) {
            return res.status(200).json({ 
                status: 'success', 
                newMatches: 0,
                message: 'No new matches found'
            });
        }
        
        // Use the advanced matching system
        const goodMatches = await findMatches(lostItem, newFoundItems);
        
        if (goodMatches.length === 0) {
            return res.status(200).json({ 
                status: 'success', 
                newMatches: 0,
                message: 'No good matches found among new items'
            });
        }
        
        // Create notifications for good matches
        const notifications = [];
        for (const match of goodMatches) {
            // Check if a notification already exists for this match
            const existingNotification = await Notification.findOne({
                lostItemId: lostItem._id,
                foundItemId: match._id
            });
            
            if (!existingNotification) {
                // Create a new notification
                const notification = new Notification({
                    userId: lostItem.userId,
                    type: 'match',
                    title: 'New Match Found',
                    message: `We found a ${match.matchScore}% match for your lost ${lostItem.itemName || 'item'}`,
                    lostItemId: lostItem._id,
                    foundItemId: match._id,
                    matchScore: match.matchScore,
                    read: false,
                    createdAt: new Date()
                });
                
                await notification.save();
                notifications.push(notification);
            }
        }
        
        res.status(200).json({ 
            status: 'success', 
            newMatches: goodMatches.length,
            notifications: notifications.length,
            matches: goodMatches
        });
    } catch (error) {
        console.error('Error checking for new matches:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Error checking for new matches',
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
app.put('/notifications/:notificationId/read', async (req, res) => {
    try {
        const { notificationId } = req.params;
        
        if (!notificationId) {
            return res.status(400).json({
                status: 'error',
                message: 'Notification ID is required'
            });
        }
        
        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { $set: { read: true } },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).json({
                status: 'error',
                message: 'Notification not found'
            });
        }
        
        res.status(200).json({
            status: 'success',
            notification
        });
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error marking notification as read',
            details: error.message
        });
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
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID is required'
            });
        }
        
        console.log(`Fetching matches for user: ${userId}`);
        
        // Find all lost items by this user
        const userLostItems = await LostItem.find({ userId: userId });
        
        console.log(`Found ${userLostItems.length} lost items for user ${userId}`);
        
        if (userLostItems.length === 0) {
            // If no lost items, try to find all lost items (for testing)
            console.log("No lost items found for this user. Fetching all lost items for testing...");
            const allLostItems = await LostItem.find({});
            
            if (allLostItems.length > 0) {
                console.log(`Found ${allLostItems.length} lost items in total`);
                userLostItems.push(...allLostItems);
            } else {
                return res.json({
                    status: 'success',
                    matches: [],
                    message: 'No lost items found in the system'
                });
            }
        }
        
        // Array to store all matches
        let allMatches = [];
        
        // Find all users to get their names
        const users = await User.find({});
        console.log(`Found ${users.length} users for name mapping`);
        
        // Create a map of user IDs to user info
        const userMap = {};
        users.forEach(user => {
            // Ensure we have a valid user ID as the key
            if (user && user._id) {
                const userId = user._id.toString();
                
                // Process the profile image
                let avatarUrl = null;
                
                // If profileImage is a base64 string
                if (user.profileImage && typeof user.profileImage === 'string') {
                    // If it's already a data URI or URL, use it as is
                    if (user.profileImage.startsWith('data:') || user.profileImage.startsWith('http')) {
                        avatarUrl = user.profileImage;
                    } else {
                        // It's a base64 string without prefix, add the prefix
                        const imageType = user.profileImageType || 'image/jpeg';
                        avatarUrl = `data:${imageType};base64,${user.profileImage}`;
                    }
                } else if (user.profileImage && Buffer.isBuffer(user.profileImage)) {
                    // If it's a Buffer, convert to base64
                    const imageType = user.profileImageType || 'image/jpeg';
                    avatarUrl = `data:${imageType};base64,${user.profileImage.toString('base64')}`;
                }
                
                // Use a default avatar if none is provided
                if (!avatarUrl) {
                    avatarUrl = 'https://randomuser.me/api/portraits/lego/1.jpg';
                }
                
                userMap[userId] = {
                    name: user.name || user.email || 'Unknown User',
                    email: user.email || '',
                    profileImage: avatarUrl
                };
                
                console.log(`User ${userId} mapped to name: ${userMap[userId].name}, avatar: ${avatarUrl ? 'Valid avatar URL' : 'No avatar'}`);
            }
        });
        
        // For each lost item, find potential matches
        for (const lostItem of userLostItems) {
            console.log(`Processing lost item: ${lostItem._id}, description: ${lostItem.description}`);
            
            // Build query for matching found items
            const query = {};
            
            // Description matching
            if (lostItem.description) {
                const keywords = lostItem.description.split(/\s+/).filter(word => word.length > 3);
                if (keywords.length > 0) {
                    const keywordPattern = keywords.join('|');
                    query.description = { $regex: keywordPattern, $options: 'i' };
                } else {
                    query.description = { $regex: lostItem.description, $options: 'i' };
                }
            }
            
            // Category matching
            if (lostItem.category) {
                query.category = lostItem.category;
            }
            
            // IMPORTANT: For testing, don't exclude items from the same user
            // This will show all potential matches regardless of user ID
            // query.userId = { $ne: userId }; // Only match items from other users
            
            console.log(`Searching for matches with query:`, JSON.stringify(query));
            
            const matchedItems = await FoundItem.find(query);
            
            console.log(`Found ${matchedItems.length} potential matches`);
            
            if (matchedItems.length > 0) {
                // Calculate match score for each item
                const scoredMatches = matchedItems.map(foundItem => {
                    let score = 0;
                    const maxScore = 100;
                    
                    // Description similarity (50%)
                    if (lostItem.description && foundItem.description) {
                        const similarityScore = calculateTextSimilarity(lostItem.description, foundItem.description);
                        score += similarityScore * 50;
                        
                        // Bonus points for very similar descriptions
                        if (similarityScore > 0.5) {
                            score += 10; // Bonus points for high similarity
                        }
                    }
                    
                    // Location similarity (30%)
                    if (lostItem.location && foundItem.location) {
                        const locParts = lostItem.location.toLowerCase().split(/,|\s+/);
                        const foundLocParts = foundItem.location.toLowerCase().split(/,|\s+/);
                        
                        const matchingParts = locParts.filter(part => 
                            part.length > 2 && foundLocParts.includes(part)
                        ).length;
                        
                        const matchPercentage = matchingParts / Math.max(locParts.length, 1);
                        score += matchPercentage * 30;
                    }
                    
                    // Category exact match (20%)
                    if (lostItem.category && foundItem.category && 
                        lostItem.category.toLowerCase() === foundItem.category.toLowerCase()) {
                        score += 20;
                    }
                    
                    // Get user info from the map
                    const foundByUserId = foundItem.userId ? foundItem.userId.toString() : 'unknown';
                    const userInfo = userMap[foundByUserId] || {
                        name: `User ${foundByUserId.substring(0, 5)}`,
                        email: '',
                        profileImage: 'https://randomuser.me/api/portraits/lego/1.jpg'
                    };
                    
                    console.log(`Match found: Item ${foundItem._id} by user ${foundByUserId}, avatar: ${userInfo.profileImage}`);
                    
                    // Create match object with foundByUser info
                    return {
                        id: `${lostItem._id}-${foundItem._id}`,
                        lostItemId: lostItem._id,
                        foundItemId: foundItem._id,
                        lostItemDescription: lostItem.description,
                        foundItemDescription: foundItem.description,
                        foundDate: foundItem.date,
                        foundLocation: foundItem.location,
                        matchConfidence: Math.min(Math.round(score), maxScore),
                        status: 'pending', // Default status
                        foundByUser: {
                            id: foundByUserId,
                            name: userInfo.name,
                            email: userInfo.email,
                            avatar: userInfo.profileImage
                        }
                    };
                });
                
                // Lower the threshold for testing
                const goodMatches = scoredMatches.filter(match => match.matchConfidence > 20);
                
                console.log(`Found ${goodMatches.length} good matches with score > 20`);
                
                // Add to all matches
                allMatches = [...allMatches, ...goodMatches];
            }
        }
        
        // Sort by match confidence (highest first)
        allMatches.sort((a, b) => b.matchConfidence - a.matchConfidence);
        
        // Return matches
        return res.json({
            status: 'success',
            matches: allMatches,
            totalMatches: allMatches.length
        });
        
    } catch (error) {
        console.error('Error fetching user matches:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error fetching user matches',
            details: error.message
        });
    }
});

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
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
        .trim();
}

// Helper function to calculate similarity between two texts
function calculateTextSimilarity(text1, text2) {
    const normalizedText1 = normalizeText(text1);
    const normalizedText2 = normalizeText(text2);
    
    if (!normalizedText1 || !normalizedText2) return 0;
    
    // Split into words
    const words1 = normalizedText1.split(/\s+/);
    const words2 = normalizedText2.split(/\s+/);
    
    // Count matching words
    const matchingWords = words1.filter(word => 
        word.length > 2 && words2.includes(word)
    ).length;
    
    // Calculate percentage
    return matchingWords / Math.max(words1.length, 1);
}