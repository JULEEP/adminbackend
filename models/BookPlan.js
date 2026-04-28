import mongoose from 'mongoose';

const bookPlanSchema = mongoose.Schema({
  fullName: { type: String, trim: true },
  workEmail: { type: String, trim: true, lowercase: true },
  mobileNumber: { type: String,  trim: true },
  companySize: { type: String, },
  industryType: { type: String,  trim: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', },
  planName: { type: String },
  planPrice: { type: Number, default: 0 },
  planPriceType: { type: String },
  bookingStatus: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentAmount: { type: Number, default: 0 },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  message: { type: String, trim: true },
  adminNotes: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

bookPlanSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    const count = await mongoose.model('BookPlan').countDocuments();
    this.bookingId = `BP-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

const BookPlan = mongoose.model('BookPlan', bookPlanSchema);
export default BookPlan;