import mongoose from 'mongoose';

const foundItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  time: { type: String, required: true },
  contact: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: String, required: true },
  description: { type: String },
  photo: { type: String }, // This will store the file path or URL of the uploaded image
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const FoundItem = mongoose.model('FoundItem', foundItemSchema);
export default FoundItem;