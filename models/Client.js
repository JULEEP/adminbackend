import mongoose from 'mongoose';

const clientSchema = mongoose.Schema(
  {
    // 🔹 Basic Info
    name: { type: String },
    email: { type: String, unique: true },
    mobile: { type: String },
    password: { type: String },
    companyName: { type: String },

    // 🔹 Documents
    aadhaarCardUrl: { type: String },
    panCardUrl: { type: String },
    location: { type: String },

    // 🔹 Number of employees
    employeesCount: { type: Number, default: 0 },
    clientId: { type: String, unique: true },

    // 🔹 Profile completion percentage (0-100)
    profileCompletionPercentage: { type: Number, default: 0 },

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
      purchaseDate: { type: Date },
      expiryDate: { type: Date }  // NEW FIELD: When this product will expire
    }],

    // 🔹 Selected Packages with expiry
    selectedPackages: [{
      packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
      name: { type: String },
      price: { type: Number },
      duration: { type: String },
      loginCount: { type: Number },
      purchaseDate: { type: Date },
      expiryDate: { type: Date }  // NEW FIELD: When this package will expire
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

// Helper function to calculate profile completion percentage
clientSchema.methods.calculateProfileCompletion = function() {
  let completedFields = 0;
  let totalFields = 0;
  
  // Check each field and add to completion
  if (this.name && this.name.trim() !== '') { completedFields++; }
  totalFields++;
  
  if (this.email && this.email.trim() !== '') { completedFields++; }
  totalFields++;
  
  if (this.mobile && this.mobile.trim() !== '') { completedFields++; }
  totalFields++;
  
  if (this.password && this.password.trim() !== '') { completedFields++; }
  totalFields++;
  
  if (this.companyName && this.companyName.trim() !== '') { completedFields++; }
  totalFields++;
  
  if (this.employeesCount > 0) { completedFields++; }
  totalFields++;
  
  if (this.location && this.location !== '{}' && this.location !== '') { 
    try {
      const loc = typeof this.location === 'string' ? JSON.parse(this.location) : this.location;
      if (loc.address || loc.city || loc.state || loc.pincode) {
        completedFields++;
      }
    } catch(e) { }
    totalFields++;
  }
  
  // Calculate percentage
  const percentage = Math.round((completedFields / totalFields) * 100);
  this.profileCompletionPercentage = percentage;
  return percentage;
};

const Client = mongoose.model('Client', clientSchema);

export default Client;