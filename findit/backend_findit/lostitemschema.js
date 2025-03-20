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
    enum: ['Electronics', 'Accessories', 'Clothing', 'Documents', 'Others']
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
  
  // Category-specific attributes
  // Electronics
  brand: {
    type: String,
    required: false,
    trim: true
  },
  model: {
    type: String,
    required: false,
    trim: true
  },
  color: {
    type: String,
    required: false,
    trim: true
  },
  uniquePoint: {
    type: String,
    required: true,
    trim: true
  },
  
  // Accessories and Clothing
  material: {
    type: String,
    required: false,
    trim: true
  },
  size: {
    type: String,
    required: false,
    trim: true
  },
  
  // Documents
  documentType: {
    type: String,
    required: false,
    trim: true
  },
  issuingAuthority: {
    type: String,
    required: false,
    trim: true
  },
  nameOnDocument: {
    type: String,
    required: false,
    trim: true
  },
  
  // Dynamic attributes storage (for future extensibility)
  attributes: {
    type: Map,
    of: String,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for efficient querying
lostItemSchema.index({ category: 1 });
lostItemSchema.index({ createdAt: -1 });

const LostItem = mongoose.model('LostItem', lostItemSchema);
export default LostItem;