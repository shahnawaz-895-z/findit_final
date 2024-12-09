import mongoose from 'mongoose';

const lostItemSchema = new mongoose.Schema({
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
  photo: {
    type: Buffer,
    required: false
  },
  photoContentType: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const LostItem = mongoose.model('LostItem', lostItemSchema);
export default LostItem;