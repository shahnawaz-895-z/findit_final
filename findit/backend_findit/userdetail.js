import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  profileImage: {
    type: Buffer, // Store image as buffer
  },
  profileImageType: {
    type: String, // Store MIME type of image (e.g., 'image/jpeg')
  },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);

export { User };  // This is how you export the User model using ES Module syntax
