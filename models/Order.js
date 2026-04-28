import mongoose from 'mongoose';

const orderItemSchema = mongoose.Schema({
  type: { type: String, enum: ['product', 'package'], },
  itemId: { type: mongoose.Schema.Types.ObjectId,  }
}, { _id: false });

const orderSchema = mongoose.Schema({
  orderId: { type: String, unique: true,  },
  razorpayOrderId: { type: String, unique: true, sparse: true },
  razorpayPaymentId: String,
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  clientEmail: String,
  clientName: String,
  clientMobile: String,
  items: [orderItemSchema],
  subtotal: { type: Number, default: 0 },
  totalAmount: { type: Number,  },
  couponCode: String,
  companyName: String,
  employeesCount: Number,
  location: mongoose.Schema.Types.Mixed,
  paymentStatus: { type: String, enum: ['pending', 'captured', 'failed'], default: 'pending' },
  orderStatus: { type: String, enum: ['payment_pending', 'registration_completed', 'cancelled'], default: 'payment_pending' }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);