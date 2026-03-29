import mongoose from 'mongoose';

const couponSchema = mongoose.Schema(
  {
    // 🔹 Basic Info
    code: { 
      type: String, 
    },
    description: { 
      type: String, 
    },

    // 🔹 Discount Details
    discountType: { 
      type: String, 
    },
    discountValue: { 
      type: Number, 
      min: 0 
    },
    minPurchase: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    maxDiscount: { 
      type: Number, 
      default: 0,
      min: 0 
    },

    // 🔹 Validity
    startDate: { 
      type: Date, 
    },
    endDate: { 
      type: Date, 
    },

    // 🔹 Usage Limits
    usageLimit: { 
      type: Number, 
      default: 0, // 0 means unlimited
      min: 0 
    },
    usedCount: { 
      type: Number, 
      default: 0,
      min: 0 
    },

    // 🔹 Applicability
    applicableProducts: { 
      type: [String], 
      default: [] // Empty array means applicable to all products
    },
    applicableClients: { 
      type: [String], 
      default: [] // Empty array means applicable to all clients
    },

    // 🔹 Status
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'expired'], 
      default: 'active' 
    },

    // 🔹 Metadata
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    couponId: { 
      type: String, 
    }
  },
  {
    timestamps: true,
  }
);

// Generate coupon ID before saving
couponSchema.pre('save', async function(next) {
  if (!this.couponId) {
    const count = await mongoose.model('Coupon').countDocuments();
    this.couponId = `CPN${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Check if coupon is expired
couponSchema.methods.isExpired = function() {
  const now = new Date();
  return now > this.endDate;
};

// Check if coupon has reached usage limit
couponSchema.methods.isUsageLimitReached = function() {
  return this.usageLimit > 0 && this.usedCount >= this.usageLimit;
};

// Check if coupon is valid for a client
couponSchema.methods.isValidForClient = function(clientId) {
  return this.applicableClients.length === 0 || this.applicableClients.includes(clientId);
};

// Check if coupon is valid for a product
couponSchema.methods.isValidForProduct = function(productId) {
  return this.applicableProducts.length === 0 || this.applicableProducts.includes(productId);
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function(purchaseAmount) {
  if (purchaseAmount < this.minPurchase) return 0;
  
  let discount = 0;
  if (this.discountType === 'percentage') {
    discount = (purchaseAmount * this.discountValue) / 100;
    if (this.maxDiscount > 0) {
      discount = Math.min(discount, this.maxDiscount);
    }
  } else {
    discount = Math.min(this.discountValue, purchaseAmount);
  }
  
  return discount;
};

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;