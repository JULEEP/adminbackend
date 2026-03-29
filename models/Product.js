import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  code: {
    type: String,
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    default: 'software'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  features: {
    type: [String],
    default: []
  },
  addedBy: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true
});

const Product = mongoose.model('Product', productSchema);

export default Product;