import mongoose from 'mongoose';

const clientSchema = mongoose.Schema(
  {
    // 🔹 Basic Info
    name: { type: String, },
    email: { type: String, },
    mobile: { type: String, },
    password: { type: String, },
    companyName: { type: String },

    // 🔹 Documents
    aadhaarCardUrl: { type: String },
    panCardUrl: { type: String },
       location: { type: String },

    // 🔹 Number of employees/clients
    employeesCount: { type: Number, default: 0 },
    clientId: { type: String, }, // DB me store hoga

    // 🔹 Product Access
    accessibleProducts: { type: [String], default: [] },

    // 🔹 Status
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  {
    timestamps: true,
  }
);

const Client = mongoose.model('Client', clientSchema);

export default Client;
