import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    senderId: {
        type: String,
        required: true
    },
    receiverId: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    read: {
        type: Boolean,
        default: false
    },
    clientMessageId: {
        type: String,
        index: true,
        sparse: true
    },
    matchId: {
        type: String,
        index: true,
        sparse: true
    }
});

// Create a compound index for efficient querying of conversations
messageSchema.index({ senderId: 1, receiverId: 1 });

// Create an index for matchId for efficient querying of conversations by match
messageSchema.index({ matchId: 1 });

// Create an index for client message ID for duplicate detection
messageSchema.index({ clientMessageId: 1 }, { unique: true, sparse: true });

const Message = mongoose.model('Message', messageSchema);

export default Message; 