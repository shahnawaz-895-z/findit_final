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
    precomputeItemEmbedding,
    calculateMatchScore,
    stringSimilarity,
    enhancedKeywordMatching,
    calculateCategorySpecificScore
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
            const { receiverId, senderId, text, messageId, matchId } = message;
            console.log(`Received message from ${senderId} to ${receiverId}: ${text}`);
            
            // Check if sender and receiver have a match before allowing messages
            const hasMatch = await checkUsersHaveMatch(senderId, receiverId);
            
            if (!hasMatch) {
                // Emit error back to sender
                socket.emit('messageError', {
                    error: 'Cannot send messages - no match exists between these users',
                    clientMessageId: messageId
                });
                return;
            }
            
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
                clientMessageId: messageId || null, // Store the client-generated ID if provided
                matchId: matchId || null // Store the match ID if provided
            });
            
            const savedMessage = await newMessage.save();
            console.log('Message saved to database:', savedMessage);
            
            // Emit the message to the receiver
            io.to(receiverId).emit('receiveMessage', { 
                _id: savedMessage._id,
                senderId, 
                text,
                createdAt: savedMessage.createdAt,
                clientMessageId: messageId,
                matchId: matchId
            });
            
            // Emit confirmation back to the sender
            io.to(senderId).emit('messageSaved', { 
                _id: savedMessage._id,
                senderId, 
                text,
                createdAt: savedMessage.createdAt,
                clientMessageId: messageId,
                matchId: matchId
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
        const { senderId, receiverId, text, messageId, matchId } = req.body;
        
        if (!senderId || !receiverId || !text) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing required fields: senderId, receiverId, text' 
            });
        }
        
        // Check if sender and receiver have a match before allowing messages
        const hasMatch = await checkUsersHaveMatch(senderId, receiverId);
        
        if (!hasMatch) {
            return res.status(403).json({
                status: 'error',
                message: 'Cannot send messages - no match exists between these users'
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
            clientMessageId: messageId || null, // Store the client-generated ID if provided
            matchId: matchId || null // Store the match ID if provided
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
                clientMessageId: messageId, // Include the client-generated ID
                matchId: matchId // Include the match ID
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
        const userId = req.params.userId;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ status: 'error', message: 'Invalid user ID' });
        }

        console.log(`Fetching matches for user: ${userId}`);

        // Get all lost items and found items for this user
        const lostItems = await LostItem.find({ userId: userId });
        const foundItems = await FoundItem.find({ userId: userId });

        console.log(`Found ${lostItems.length} lost items and ${foundItems.length} found items for user ${userId}`);

        // Create a set to track unique match IDs to avoid duplicates
        const uniqueMatchIds = new Set();
        const allMatches = [];

        // Create a map of user details for efficiency
        const userMap = new Map();

        // Function to get user details (with caching)
        async function getUserDetails(uid) {
            if (!uid) return null;
            
            if (userMap.has(uid)) {
                return userMap.get(uid);
            }
            
            try {
                const user = await User.findById(uid);
                if (user) {
                    const userInfo = {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        profileImage: user.profileImage // Use profileImage consistently
                    };
                    console.log(`Found user: ${user.name} (${user._id}), has profile image: ${!!user.profileImage}`);
                    userMap.set(uid, userInfo);
                    return userInfo;
                }
            } catch (error) {
                console.error(`Error fetching user ${uid}:`, error);
            }
            
            return null;
        }

        // Process lost items to find matching found items
        if (lostItems.length > 0) {
            for (const lostItem of lostItems) {
                // Find potential matches - only look at items from other users in the same category
                const potentialMatches = await FoundItem.find({
                    category: lostItem.category,
                    userId: { $ne: userId } // Don't match with own items
                }).sort({ createdAt: -1 });

                console.log(`Found ${potentialMatches.length} potential matches for lost item ${lostItem._id}`);

                for (const foundItem of potentialMatches) {
                    // Generate a consistent unique ID for this match pair
                    // Using smaller ID first ensures the same ID regardless of order
                    const smallerId = lostItem._id < foundItem._id ? lostItem._id : foundItem._id;
                    const largerId = lostItem._id > foundItem._id ? lostItem._id : foundItem._id;
                    const matchPairId = `${smallerId}_${largerId}`;
                    
                    // Skip if we've already processed this match pair
                    if (uniqueMatchIds.has(matchPairId)) {
                        console.log(`Skipping duplicate match pair: ${matchPairId}`);
                        continue;
                    }

                    // Calculate match score using the improved algorithm
                    let matchDetails = { totalScore: 0, details: {} };
                    let matchScore = 0;
                    
                    try {
                        matchDetails = calculateMatchScore(lostItem, foundItem);
                        matchScore = matchDetails.totalScore;
                        console.log(`Match score between ${lostItem._id} and ${foundItem._id}: ${matchScore.toFixed(2)}`);
                    } catch (error) {
                        console.error(`Error calculating match score between ${lostItem._id} and ${foundItem._id}:`, error);
                        // Fall back to basic matching
                        if (lostItem.category === foundItem.category) {
                            matchScore = 30; // Default match score for category match
                        }
                    }
                    
                    // Only include good matches (above threshold)
                    if (matchScore > 20) {
                        // Get user details for the found item owner
                        const foundByUser = await getUserDetails(foundItem.userId);
                        const lostByUser = await getUserDetails(lostItem.userId);
                        
                        // Create the match object
                        const match = {
                            _id: matchPairId,
                            lostItem: lostItem,
                            foundItem: foundItem,
                            lostItemUser: lostByUser,
                            foundItemUser: foundByUser,
                            matchScore: matchScore,
                            matchDetails: matchDetails.details,
                            createdAt: new Date()
                        };
                        
                        allMatches.push(match);
                        uniqueMatchIds.add(matchPairId);
                    }
                }
            }
        }

        // Process found items to find matching lost items
        // (This allows matches to appear for both the person who lost and the person who found)
        if (foundItems.length > 0) {
            for (const foundItem of foundItems) {
                const potentialMatches = await LostItem.find({
                    category: foundItem.category,
                    userId: { $ne: userId } // Don't match with own items
                }).sort({ createdAt: -1 });

                console.log(`Found ${potentialMatches.length} potential matches for found item ${foundItem._id}`);

                for (const lostItem of potentialMatches) {
                    // Generate a consistent unique ID for this match pair
                    const smallerId = lostItem._id < foundItem._id ? lostItem._id : foundItem._id;
                    const largerId = lostItem._id > foundItem._id ? lostItem._id : foundItem._id;
                    const matchPairId = `${smallerId}_${largerId}`;
                    
                    // Skip if we've already processed this match pair
                    if (uniqueMatchIds.has(matchPairId)) {
                        console.log(`Skipping duplicate match pair: ${matchPairId}`);
                        continue;
                    }

                    // Calculate match score using the improved algorithm
                    let matchDetails = { totalScore: 0, details: {} };
                    let matchScore = 0;
                    
                    try {
                        matchDetails = calculateMatchScore(lostItem, foundItem);
                        matchScore = matchDetails.totalScore;
                        console.log(`Match score between ${lostItem._id} and ${foundItem._id}: ${matchScore.toFixed(2)}`);
                    } catch (error) {
                        console.error(`Error calculating match score between ${lostItem._id} and ${foundItem._id}:`, error);
                        // Fall back to basic matching
                        if (lostItem.category === foundItem.category) {
                            matchScore = 30; // Default match score for category match
                        }
                    }
                    
                    // Only include good matches (above threshold)
                    if (matchScore > 20) {
                        // Get user details
                        const foundByUser = await getUserDetails(foundItem.userId);
                        const lostByUser = await getUserDetails(lostItem.userId);
                        
                        // Create the match object
                        const match = {
                            _id: matchPairId,
                            lostItem: lostItem,
                            foundItem: foundItem,
                            lostItemUser: lostByUser,
                            foundItemUser: foundByUser,
                            matchScore: matchScore,
                            matchDetails: matchDetails.details,
                            createdAt: new Date()
                        };
                        
                        allMatches.push(match);
                        uniqueMatchIds.add(matchPairId);
                    }
                }
            }
        }

        // Sort matches by confidence score (highest first)
        allMatches.sort((a, b) => b.matchScore - a.matchScore);
        
        console.log(`Returning ${allMatches.length} unique matches for user ${userId}`);
        return res.json({
            status: 'success',
            matches: allMatches,
            totalMatches: allMatches.length
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
            return res.status(404).json({ 
                success: false, 
                error: 'Notification not found' 
            });
        }

        res.json({ 
            success: true, 
            notification 
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update notification' 
        });
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
    return text.toLowerCase().replace(/[^\w\s]/g, '');
}

// Add function to check if two users have a match
async function checkUsersHaveMatch(userId1, userId2) {
    try {
        // Find all lost items by user1
        const user1LostItems = await LostItem.find({ userId: userId1 });
        
        // Find all found items by user2
        const user2FoundItems = await FoundItem.find({ userId: userId2 });
        
        // Check for matches between user1's lost items and user2's found items
        for (const lostItem of user1LostItems) {
            for (const foundItem of user2FoundItems) {
                // Check if items match based on category
                if (lostItem.category === foundItem.category) {
                    // Calculate match score
                    let score = 0;
                    
                    // Category match (baseline 20%)
                    score += 20;
                    
                    // Description similarity (50% weight)
                    if (lostItem.description && foundItem.description) {
                        const similarityScore = calculateTextSimilarity(lostItem.description, foundItem.description);
                        score += similarityScore * 50;
                    }
                    
                    // Location similarity (30% weight)
                    if (lostItem.location && foundItem.location) {
                        const locSimilarity = calculateTextSimilarity(lostItem.location, foundItem.location);
                        score += locSimilarity * 30;
                    }
                    
                    // Add category-specific attribute matching
                    switch (lostItem.category) {
                        case 'Electronics':
                            // Brand match (up to 20%)
                            if (lostItem.brand && foundItem.brand && 
                                lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
                                score += 20;
                            }
                            
                            // Model match (up to 30%)
                            if (lostItem.model && foundItem.model && 
                                lostItem.model.toLowerCase() === foundItem.model.toLowerCase()) {
                                score += 30;
                            }
                            
                            // Color match (up to 15%)
                            if (lostItem.color && foundItem.color && 
                                lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
                                score += 15;
                            }
                            
                            // Serial number is a strong indicator if available (up to 35%)
                            if (lostItem.serialNumber && foundItem.serialNumber && 
                                lostItem.serialNumber === foundItem.serialNumber) {
                                score += 35;
                            }
                            break;
                            
                        case 'Accessories':
                            // Brand match (up to 25%)
                            if (lostItem.brand && foundItem.brand && 
                                lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
                                score += 25;
                            }
                            
                            // Material match (up to 25%)
                            if (lostItem.material && foundItem.material && 
                                lostItem.material.toLowerCase() === foundItem.material.toLowerCase()) {
                                score += 25;
                            }
                            
                            // Color match (up to 25%)
                            if (lostItem.color && foundItem.color && 
                                lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
                                score += 25;
                            }
                            break;
                            
                        case 'Clothing':
                            // Brand match (up to 20%)
                            if (lostItem.brand && foundItem.brand && 
                                lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
                                score += 20;
                            }
                            
                            // Size match (up to 25%)
                            if (lostItem.size && foundItem.size && 
                                lostItem.size.toLowerCase() === foundItem.size.toLowerCase()) {
                                score += 25;
                            }
                            
                            // Color match (up to 25%)
                            if (lostItem.color && foundItem.color && 
                                lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
                                score += 25;
                            }
                            
                            // Material match (up to 15%)
                            if (lostItem.material && foundItem.material && 
                                lostItem.material.toLowerCase() === foundItem.material.toLowerCase()) {
                                score += 15;
                            }
                            break;
                            
                        case 'Documents':
                            // Document type match (up to 30%)
                            if (lostItem.documentType && foundItem.documentType && 
                                lostItem.documentType.toLowerCase() === foundItem.documentType.toLowerCase()) {
                                score += 30;
                            }
                            
                            // Issuing authority match (up to 20%)
                            if (lostItem.issuingAuthority && foundItem.issuingAuthority && 
                                lostItem.issuingAuthority.toLowerCase() === foundItem.issuingAuthority.toLowerCase()) {
                                score += 20;
                            }
                            
                            // Name on document match (up to 50% - very strong indicator)
                            if (lostItem.nameOnDocument && foundItem.nameOnDocument && 
                                lostItem.nameOnDocument.toLowerCase() === foundItem.nameOnDocument.toLowerCase()) {
                                score += 50;
                            }
                            break;
                    }
                    
                    // If match score is above threshold, consider it a match
                    if (score > 20) {
                        return true;
                    }
                }
            }
        }
        
        // Check the reverse case - user2's lost items matched with user1's found items
        const user2LostItems = await LostItem.find({ userId: userId2 });
        const user1FoundItems = await FoundItem.find({ userId: userId1 });
        
        for (const lostItem of user2LostItems) {
            for (const foundItem of user1FoundItems) {
                if (lostItem.category === foundItem.category) {
                    let score = 0;
                    
                    // Category match (baseline 20%)
                    score += 20;
                    
                    // Description similarity (50% weight)
                    if (lostItem.description && foundItem.description) {
                        const similarityScore = calculateTextSimilarity(lostItem.description, foundItem.description);
                        score += similarityScore * 50;
                    }
                    
                    // Location similarity (30% weight)
                    if (lostItem.location && foundItem.location) {
                        const locSimilarity = calculateTextSimilarity(lostItem.location, foundItem.location);
                        score += locSimilarity * 30;
                    }
                    
                    // Add category-specific attribute matching
                    switch (lostItem.category) {
                        case 'Electronics':
                            // Brand match (up to 20%)
                            if (lostItem.brand && foundItem.brand && 
                                lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
                                score += 20;
                            }
                            
                            // Model match (up to 30%)
                            if (lostItem.model && foundItem.model && 
                                lostItem.model.toLowerCase() === foundItem.model.toLowerCase()) {
                                score += 30;
                            }
                            
                            // Color match (up to 15%)
                            if (lostItem.color && foundItem.color && 
                                lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
                                score += 15;
                            }
                            
                            // Serial number is a strong indicator if available (up to 35%)
                            if (lostItem.serialNumber && foundItem.serialNumber && 
                                lostItem.serialNumber === foundItem.serialNumber) {
                                score += 35;
                            }
                            break;
                            
                        case 'Accessories':
                            // Brand match (up to 25%)
                            if (lostItem.brand && foundItem.brand && 
                                lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
                                score += 25;
                            }
                            
                            // Material match (up to 25%)
                            if (lostItem.material && foundItem.material && 
                                lostItem.material.toLowerCase() === foundItem.material.toLowerCase()) {
                                score += 25;
                            }
                            
                            // Color match (up to 25%)
                            if (lostItem.color && foundItem.color && 
                                lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
                                score += 25;
                            }
                            break;
                            
                        case 'Clothing':
                            // Brand match (up to 20%)
                            if (lostItem.brand && foundItem.brand && 
                                lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
                                score += 20;
                            }
                            
                            // Size match (up to 25%)
                            if (lostItem.size && foundItem.size && 
                                lostItem.size.toLowerCase() === foundItem.size.toLowerCase()) {
                                score += 25;
                            }
                            
                            // Color match (up to 25%)
                            if (lostItem.color && foundItem.color && 
                                lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
                                score += 25;
                            }
                            
                            // Material match (up to 15%)
                            if (lostItem.material && foundItem.material && 
                                lostItem.material.toLowerCase() === foundItem.material.toLowerCase()) {
                                score += 15;
                            }
                            break;
                            
                        case 'Documents':
                            // Document type match (up to 30%)
                            if (lostItem.documentType && foundItem.documentType && 
                                lostItem.documentType.toLowerCase() === foundItem.documentType.toLowerCase()) {
                                score += 30;
                            }
                            
                            // Issuing authority match (up to 20%)
                            if (lostItem.issuingAuthority && foundItem.issuingAuthority && 
                                lostItem.issuingAuthority.toLowerCase() === foundItem.issuingAuthority.toLowerCase()) {
                                score += 20;
                            }
                            
                            // Name on document match (up to 50% - very strong indicator)
                            if (lostItem.nameOnDocument && foundItem.nameOnDocument && 
                                lostItem.nameOnDocument.toLowerCase() === foundItem.nameOnDocument.toLowerCase()) {
                                score += 50;
                            }
                            break;
                    }
                    
                    // If match score is above threshold, consider it a match
                    if (score > 20) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error checking matches between users:', error);
        return false; // Default to false if there's an error checking
    }
}

// Test endpoint to create a notification
app.post('/api/test/notification', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Create a test notification
        const notification = await createNotification(
            userId,
            'system',
            'Test Notification',
            'This is a test notification to verify the system works.',
            { testData: 'some test data' }
        );

        res.json({ success: true, notification });
    } catch (error) {
        console.error('Error creating test notification:', error);
        res.status(500).json({ error: 'Failed to create test notification' });
    }
});