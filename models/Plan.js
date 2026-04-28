import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
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
    min: 0,
    default: 0
  },
  priceType: {
    type: String,
    enum: ['free', 'monthly', 'yearly', 'lifetime'],
    default: 'monthly'
  },
  planType: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    default: 'basic'
  },
  popular: {
    type: Boolean,
    default: false
  },
  buttonText: {
    type: String,
    default: 'Get Started'
  },
  features: [{
    type: String
  }],
  // Core Features Toggle
  coreHRM: {
    type: Boolean,
    default: true
  },
  recruitment: {
    type: Boolean,
    default: true
  },
  jobPostManagement: {
    type: Boolean,
    default: true
  },
  applicationReports: {
    type: Boolean,
    default: true
  },
  unifiedDashboardAccess: {
    type: Boolean,
    default: true
  },
  endToEndRecruitment: {
    type: Boolean,
    default: true
  },
  emailSupport: {
    type: Boolean,
    default: true
  },
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

const Plan = mongoose.model('Plan', planSchema);
export default Plan;