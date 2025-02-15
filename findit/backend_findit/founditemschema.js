import mongoose from 'mongoose';

const foundItemSchema = new mongoose.Schema({
  contact: { type: String, required: true },
  location: { type: String, required: true },
  time: { type: String, required: true },
  date: { type: String, required: true },
  description: { type: String, required: true },
  photo: { type: Buffer },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  }
}, { timestamps: true });

const FoundItem = mongoose.model('FoundItem', foundItemSchema);

export default FoundItem;