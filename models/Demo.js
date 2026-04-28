import mongoose from "mongoose";

const demoSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    workEmail: {
      type: String,
      required: true,
    },
    mobileNumber: {
      type: String,
      required: true,
    },
    companySize: {
      type: String,
      required: true,
      enum: ["1-10", "11-50", "50-200", "200-500", "500-1k"],
    },
    industryType: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Demo = mongoose.model("Demo", demoSchema);

export default Demo;