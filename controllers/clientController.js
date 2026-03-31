import Client from "../models/Client.js";
import crypto from 'crypto';

import jwt from 'jsonwebtoken';
import Product from "../models/Product.js";
import Razorpay from 'razorpay';


// Generate JWT
const generateToken = (client) => {
  return jwt.sign(
    { id: client._id, clientId: client.clientId, email: client.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // token valid for 7 days
  );
};




// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: 'rzp_test_BxtRNvflG06PTV',
  key_secret: 'RecEtdcenmR7Lm4AIEwo4KFr',
});

// Add client with document upload and payment
export const addClient = async (req, res) => {
  try {
    const { name, email, mobile, password, companyName, noOfEmployees, location, accessibleProducts, transactionId } = req.body;

    // Parse accessibleProducts if it's a string
    let productsArray = [];
    if (accessibleProducts) {
      try {
        productsArray = typeof accessibleProducts === 'string' 
          ? JSON.parse(accessibleProducts)
          : accessibleProducts;
      } catch (e) {
        console.error('Error parsing accessibleProducts:', e);
        productsArray = [];
      }
    }

    // Fetch full product details from database
    const fullProducts = await Product.find({
      name: { $in: productsArray }
    });

    // Prepare accessible products with full details
    const accessibleProductsWithDetails = fullProducts.map(product => ({
      productId: product._id,
      name: product.name,
      price: product.price,
      code: product.code,
      category: product.category,
      isPaid: product.price > 0,
      paymentStatus: 'pending'
    }));

    // Calculate total amount
    const totalAmount = accessibleProductsWithDetails.reduce((sum, p) => sum + p.price, 0);

    // Set uploads path
    const aadhaarCardUrl = req.files?.aadhaarCard
      ? `/uploads/clients/${req.files.aadhaarCard[0].filename}`
      : undefined;

    const panCardUrl = req.files?.panCard
      ? `/uploads/clients/${req.files.panCard[0].filename}`
      : undefined;

    // Generate custom client ID
    const customClientId = `CLIENT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // If total amount is 0, create client directly
    if (totalAmount === 0) {
      const newClient = new Client({
        clientId: customClientId,
        name,
        email,
        mobile,
        password,
        companyName,
        employeesCount: noOfEmployees,
        aadhaarCardUrl,
        panCardUrl,
        location,
        accessibleProducts: accessibleProductsWithDetails.map(p => ({ ...p, paymentStatus: 'captured' })),
        status: 'pending',
        totalPaidAmount: 0
      });

      await newClient.save();
      
      return res.status(201).json({ 
        success: true,
        message: 'Registration successful! Your account is pending admin approval.', 
        client: newClient,
        requiresPayment: false
      });
    }

    // If there are paid products and transactionId is provided, verify and capture payment
    if (transactionId && totalAmount > 0) {
      try {
        // Fetch payment details from Razorpay
        let paymentInfo = await razorpay.payments.fetch(transactionId);
        
        if (!paymentInfo) {
          return res.status(404).json({ 
            success: false, 
            message: "Payment not found" 
          });
        }

        // Capture payment if not already captured
        let paymentStatus = paymentInfo.status;
        if (paymentInfo.status === "authorized" || paymentInfo.status === "created") {
          try {
            await razorpay.payments.capture(transactionId, Math.round(totalAmount * 100), "INR");
            paymentInfo = await razorpay.payments.fetch(transactionId);
            paymentStatus = paymentInfo.status;
          } catch (err) {
            console.error("Payment capture failed:", err);
            return res.status(500).json({ 
              success: false, 
              message: "Payment capture failed" 
            });
          }
        }

        // Check if payment is captured
        if (paymentStatus !== "captured") {
          return res.status(400).json({
            success: false,
            message: `Payment not captured. Status: ${paymentStatus}`,
          });
        }

        // Create client with captured payment
        const newClient = new Client({
          clientId: customClientId,
          name,
          email,
          mobile,
          password,
          companyName,
          employeesCount: noOfEmployees,
          aadhaarCardUrl,
          panCardUrl,
          location,
          accessibleProducts: accessibleProductsWithDetails.map(p => ({ 
            ...p, 
            paymentStatus: 'captured',
            transactionId: transactionId,
            purchaseDate: new Date()
          })),
          paymentDetails: {
            razorpayPaymentId: transactionId,
            amount: totalAmount,
            currency: "INR",
            status: "captured",
            capturedAt: new Date()
          },
          totalPaidAmount: totalAmount,
          status: 'pending' // Still pending admin approval
        });

        await newClient.save();

        return res.status(201).json({ 
          success: true,
          message: 'Registration successful! Payment captured. Your account is pending admin approval.', 
          client: newClient,
          requiresPayment: false,
          paymentCaptured: true
        });

      } catch (error) {
        console.error("Payment verification error:", error);
        return res.status(500).json({ 
          success: false, 
          message: "Payment verification failed",
          error: error.message 
        });
      }
    }

    // If there are paid products but no transactionId, create order and return payment info
    if (totalAmount > 0 && !transactionId) {
      const newClient = new Client({
        clientId: customClientId,
        name,
        email,
        mobile,
        password,
        companyName,
        employeesCount: noOfEmployees,
        aadhaarCardUrl,
        panCardUrl,
        location,
        accessibleProducts: accessibleProductsWithDetails,
        status: 'pending',
        totalPaidAmount: totalAmount
      });

      await newClient.save();

      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: 'INR',
        receipt: `receipt_${newClient._id}`,
        notes: {
          clientId: newClient._id.toString(),
          clientEmail: email,
          products: productsArray.join(', ')
        }
      });

      return res.status(201).json({ 
        success: true,
        message: 'Please complete payment to activate your account',
        client: newClient,
        requiresPayment: true,
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        },
        totalAmount
      });
    }

  } catch (error) {
    console.error('Error adding client:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
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



// Alternative: Simple version with just status change confirmation
export const updateClientStatusSimple = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Update status
    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      { $set: { status } },
      { new: true }
    ).select('name email status'); // Only return these fields

    if (!updatedClient) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: updatedClient
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

