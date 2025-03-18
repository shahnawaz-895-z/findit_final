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
    enum: ['Electronics', 'Accessories', 'Clothing', 'Documents', 'Others']
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
  }
}, { timestamps: true });

// Create indexes for efficient querying
foundItemSchema.index({ description: 'text' });
foundItemSchema.index({ brand: 1 });
foundItemSchema.index({ model: 1 });
foundItemSchema.index({ category: 1 });
foundItemSchema.index({ createdAt: -1 });
foundItemSchema.index({ documentType: 1 });
foundItemSchema.index({ material: 1 });

const FoundItem = mongoose.model('FoundItem', foundItemSchema);

export default FoundItem;