import mongoose from 'mongoose';

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
    lostItemOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    foundItemOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'matched', 'returned', 'claimed', 'unclaimed'],
        default: 'pending'
    },
    matchConfidence: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    matchDetails: {
        stringSimilarity: Number,
        tfidfScore: Number,
        featureScore: Number,
        attributeScore: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
matchSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Create indexes for efficient querying
matchSchema.index({ lostItemOwner: 1, createdAt: -1 });
matchSchema.index({ foundItemOwner: 1, createdAt: -1 });
matchSchema.index({ status: 1 });

const Match = mongoose.model('Match', matchSchema);

export default Match; 