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
        enum: ['match_found', 'message_received', 'system']
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
    }
});

// Create indexes for efficient querying
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification; 