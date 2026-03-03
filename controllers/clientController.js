import Client from "../models/Client.js";
import crypto from 'crypto';

import jwt from 'jsonwebtoken';

// Generate JWT
const generateToken = (client) => {
  return jwt.sign(
    { id: client._id, clientId: client.clientId, email: client.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // token valid for 7 days
  );
};




// Add client
export const addClient = async (req, res) => {
  try {
    const { name, email, mobile, password, companyName, accessibleProducts, noOfEmployees, location } = req.body;

    // Convert comma-separated string to array
    const productsArray = Array.isArray(accessibleProducts)
      ? accessibleProducts
      : accessibleProducts?.split(',').map(item => item.trim()) || [];

    // Set uploads path to /uploads/clients
    const aadhaarCardUrl = req.files?.aadhaarCard
      ? `/uploads/clients/${req.files.aadhaarCard[0].filename}`
      : undefined;

    const panCardUrl = req.files?.panCard
      ? `/uploads/clients/${req.files.panCard[0].filename}`
      : undefined;

    // Generate custom client ID
    const customClientId = `CLIENT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`; // e.g., CLIENT-A1B2C3

    const newClient = new Client({
      clientId: customClientId, // ✅ add field
      name,
      email,
      mobile,
      password,
      companyName,
      accessibleProducts: productsArray,
      employeesCount: noOfEmployees, 
      aadhaarCardUrl,
      panCardUrl,
      location
    });

    await newClient.save();
    res.status(201).json({ message: 'Client added successfully', client: newClient });
  } catch (error) {
    console.error('Error adding client:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Get all clients
export const getAllClients = async (req, res) => {
  try {
    // Sort by creation date descending (newest first)
    const clients = await Client.find().sort({ createdAt: -1 });

    res.status(200).json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Update client
export const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { name, email, mobile, companyName, accessibleProducts, status, noOfEmployees, location } = req.body;

    // Convert comma-separated string to array
    const productsArray = Array.isArray(accessibleProducts)
      ? accessibleProducts
      : accessibleProducts?.split(',').map(item => item.trim()) || [];

    const updatedData = {
      name,
      email,
      mobile,
      companyName,
      accessibleProducts: productsArray,
      status,
      employeesCount: noOfEmployees,
      location
    };

    // Update document URLs if uploaded
    if (req.files) {
      if (req.files.aadhaarCard) updatedData.aadhaarCardUrl = `/uploads/clients/${req.files.aadhaarCard[0].filename}`;
      if (req.files.panCard) updatedData.panCardUrl = `/uploads/clients/${req.files.panCard[0].filename}`;
    }

    const updatedClient = await Client.findByIdAndUpdate(clientId, updatedData, { new: true });
    if (!updatedClient) return res.status(404).json({ message: 'Client not found' });

    res.status(200).json({ message: 'Client updated successfully', client: updatedClient });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete client
export const deleteClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const deletedClient = await Client.findByIdAndDelete(clientId);
    if (!deletedClient) return res.status(404).json({ message: 'Client not found' });

    res.status(200).json({ message: 'Client deleted', client: deletedClient });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const clientLogin = async (req, res) => {
  try {
    const { clientId, email, password } = req.body;

    if (!password || (!clientId && !email)) {
      return res.status(400).json({ message: 'Please provide clientId/email and password' });
    }

    // Find client by clientId or email
    const client = await Client.findOne({
      $or: [{ clientId }, { email }]
    });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Compare password (plain vs hashed)
    const isMatch = client.password === password; // simple match, because we removed bcrypt
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate JWT
    const token = generateToken(client);

    res.status(200).json({
      message: 'Login successful',
      client: {
        _id: client._id,
        clientId: client.clientId,
        name: client.name,
        email: client.email,
        mobile: client.mobile,
        companyName: client.companyName,
        employeesCount: client.employeesCount,
        accessibleProducts: client.accessibleProducts,
        aadhaarCardUrl: client.aadhaarCardUrl,
        panCardUrl: client.panCardUrl,
        location: client.location,
        status: client.status
      },
      token
    });
  } catch (error) {
    console.error('Error in client login:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};