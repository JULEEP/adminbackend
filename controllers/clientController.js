import Client from "../models/Client.js";
import crypto from 'crypto';

import jwt from 'jsonwebtoken';
import Product from "../models/Product.js";

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




// Get all products
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching products', 
      error: error.message 
    });
  }
};



// Create product
export const createProduct = async (req, res) => {
  try {
    const { name, code, description, price, category, status, features, addedBy } = req.body;

    // Check if product with same code exists
    const existingProduct = await Product.findOne({ code });
    if (existingProduct) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product with this code already exists' 
      });
    }

    const product = new Product({
      name,
      code: code.toUpperCase(),
      description,
      price,
      category,
      status,
      features,
      addedBy: addedBy || 'Admin'
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};



// Update product
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, price, category, status, features, addedBy } = req.body;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if code is being changed and if it already exists
    if (code && code !== product.code) {
      const existingProduct = await Product.findOne({ code });
      if (existingProduct) {
        return res.status(400).json({ 
          success: false, 
          message: 'Product with this code already exists' 
        });
      }
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name: name || product.name,
        code: code ? code.toUpperCase() : product.code,
        description: description !== undefined ? description : product.description,
        price: price !== undefined ? price : product.price,
        category: category || product.category,
        status: status || product.status,
        features: features !== undefined ? features : product.features,
        addedBy: addedBy || product.addedBy
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};


