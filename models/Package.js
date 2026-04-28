import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    min: 0
  },
  duration: {
    type: String,
    enum: ['monthly', 'quarterly', 'half_yearly', 'yearly', 'lifetime'],
    default: 'monthly',
  },
  loginCount: {
    type: Number,
    min: 1,
    default: 1
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  features: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  addedBy: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true
});

const Package = mongoose.model('Package', packageSchema);
export default Package;