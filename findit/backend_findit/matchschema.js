import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
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
    }
});

// Create a compound index for efficient querying of matches
matchSchema.index({ senderId: 1, receiverId: 1 });

const Match = mongoose.model('Match', matchSchema);

export default Match;