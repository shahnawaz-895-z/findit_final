import mongoose from 'mongoose';

const returnedItemSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'itemType'
    },
    itemType: {
        type: String,
        required: true,
        enum: ['LostItem', 'FoundItem']
    },
    originalItem: {
        type: Object,
        required: true
    },
    returnedAt: {
        type: Date,
        default: Date.now
    },
    returnedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    returnNotes: {
        type: String
    },
    itemName: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    photo: {
        type: String
    }
});

const ReturnedItem = mongoose.model('ReturnedItem', returnedItemSchema);

export default ReturnedItem; 