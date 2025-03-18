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
  serialNumber: {
    type: String,
    required: false,
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

// Create indexes for efficient querying
lostItemSchema.index({ description: 'text' });
lostItemSchema.index({ brand: 1 });
lostItemSchema.index({ model: 1 });
lostItemSchema.index({ category: 1 });
lostItemSchema.index({ createdAt: -1 });
lostItemSchema.index({ documentType: 1 });
lostItemSchema.index({ material: 1 });

const LostItem = mongoose.model('LostItem', lostItemSchema);
export default LostItem;