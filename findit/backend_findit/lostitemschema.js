import mongoose from 'mongoose';

const lostItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  itemName: {
    type: String,
    required: false
  },
  time: {
    type: Date,
    required: true
  },
  contact: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Electronics', 'Bags', 'Clothing', 'Accessories', 'Documents', 'Others']
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  photo: {
    type: Buffer,
    required: false
  },
  photoContentType: {
    type: String,
    required: false
  },
  _embedding: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
    select: false // Don't include in normal queries
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create a text index on the description field for better text search
lostItemSchema.index({ description: 'text' });

const LostItem = mongoose.model('LostItem', lostItemSchema);
export default LostItem;