import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: ['match_found', 'message_received', 'system', 'lost_item_report', 'lost_item_repost', 'item_returned']
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    lostItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LostItem',
        required: false
    },
    foundItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoundItem',
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // Fields for match notifications
    matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match',
        required: false
    },
    // Lost item details
    lostItemName: String,
    lostItemDescription: String,
    lostLocation: String,
    lostDate: Date,
    lostTime: String,
    lostCategory: String,
    // Found item details
    foundItemName: String,
    foundItemDescription: String,
    foundLocation: String,
    foundDate: Date,
    foundTime: String,
    foundCategory: String,
    // Match details
    matchDate: Date,
    similarityScore: Number,
    // General notification display fields
    location: String,
    date: Date,
    time: String,
    category: String,
    itemName: String
});

// Create indexes for efficient querying
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification; 