import mongoose from 'mongoose';

const foundItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  itemName: {
    type: String,
    required: false
  },
  contact: { 
    type: String, 
    required: true 
  },
  location: { 
    type: String, 
    required: true 
  },
  category: {
    type: String,
    required: true,
    enum: ['Electronics', 'Bags', 'Clothing', 'Accessories', 'Documents', 'Others']
  },
  time: { 
    type: String, 
    required: true 
  },
  date: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  photo: { 
    type: Buffer 
  },
  photoContentType: {
    type: String,
    required: false
  },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  _embedding: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
    select: false // Don't include in normal queries
  }
}, { timestamps: true });

// Create a text index on the description field for better text search
foundItemSchema.index({ description: 'text' });

const FoundItem = mongoose.model('FoundItem', foundItemSchema);

export default FoundItem;