import Demo from "../models/Demo.js";

// ✅ POST - Book Demo
export const createDemo = async (req, res) => {
  try {
    const { fullName, workEmail, mobileNumber, companySize, industryType } =
      req.body;

    // Basic validation
    if (!fullName || !workEmail || !mobileNumber || !companySize || !industryType) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const demo = new Demo({
      fullName,
      workEmail,
      mobileNumber,
      companySize,
      industryType,
    });

    const savedDemo = await demo.save();

    res.status(201).json({
      success: true,
      message: "Demo booked successfully",
      data: savedDemo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error saving demo",
      error: error.message,
    });
  }
};

// ✅ GET - Fetch all demo requests
export const getAllDemos = async (req, res) => {
  try {
    const demos = await Demo.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: demos.length,
      data: demos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching demos",
      error: error.message,
    });
  }
};