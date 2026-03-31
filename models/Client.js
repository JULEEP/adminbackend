import mongoose from 'mongoose';

const clientSchema = mongoose.Schema(
  {
    // 🔹 Basic Info
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },
    password: { type: String, required: true },
    companyName: { type: String, required: true },

    // 🔹 Documents
    aadhaarCardUrl: { type: String },
    panCardUrl: { type: String },
    location: { type: String },

    // 🔹 Number of employees
    employeesCount: { type: Number, default: 0 },
    clientId: { type: String, unique: true },

    // 🔹 Product Access with full details
    accessibleProducts: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name: { type: String },
      price: { type: Number },
      code: { type: String },
      category: { type: String },
      isPaid: { type: Boolean, default: false },
      transactionId: { type: String },
      paymentStatus: { type: String, enum: ['pending', 'captured', 'failed'], default: 'pending' },
      purchaseDate: { type: Date }
    }],

    // 🔹 Payment details
    paymentDetails: {
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      amount: { type: Number },
      currency: { type: String, default: 'INR' },
      status: { type: String, enum: ['pending', 'captured', 'failed'], default: 'pending' },
      capturedAt: { type: Date }
    },

    // 🔹 Total amount paid
    totalPaidAmount: { type: Number, default: 0 },

    // 🔹 Status
    status: { 
      type: String, 
      enum: ['pending', 'active', 'inactive', 'rejected'], 
      default: 'pending' 
    },
    
    // 🔹 Admin remarks
    adminRemarks: { type: String },
    activationDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

const Client = mongoose.model('Client', clientSchema);

export default Client;