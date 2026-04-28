import Client from "../models/Client.js";
import crypto from 'crypto';

import jwt from 'jsonwebtoken';
import Product from "../models/Product.js";
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import Package from "../models/Package.js";
import bcrypt from 'bcryptjs';
import Order from "../models/Order.js";
import Plan from "../models/Plan.js";
dotenv.config();



// Generate JWT
const generateToken = (client) => {
  return jwt.sign(
    { id: client._id, clientId: client.clientId, email: client.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // token valid for 7 days
  );
};




const razorpay = new Razorpay({
  key_id: 'rzp_test_BxtRNvflG06PTV',
  key_secret: 'RecEtdcenmR7Lm4AIEwo4KFr',
});

const generateClientId = () => {
  return `CLIENT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

const generateOrderId = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${year}${month}-${random}`;
};

const getDurationInMs = (duration) => {
  switch(duration) {
    case 'monthly': return 30 * 24 * 60 * 60 * 1000;
    case 'quarterly': return 90 * 24 * 60 * 60 * 1000;
    case 'half_yearly': return 180 * 24 * 60 * 60 * 1000;
    case 'yearly': return 365 * 24 * 60 * 60 * 1000;
    case 'lifetime': return 100 * 365 * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
};

// Add this helper function at the top of your controller file
const calculateProfileCompletion = (clientData) => {
  let completedFields = 0;
  let totalFields = 0;
  
  if (clientData.name && clientData.name.trim()) completedFields++;
  totalFields++;
  
  if (clientData.email && clientData.email.trim()) completedFields++;
  totalFields++;
  
  if (clientData.mobile && clientData.mobile.trim()) completedFields++;
  totalFields++;
  
  if (clientData.password && clientData.password.trim()) completedFields++;
  totalFields++;
  
  if (clientData.companyName && clientData.companyName.trim()) completedFields++;
  totalFields++;
  
  if (clientData.noOfEmployees > 0) completedFields++;
  totalFields++;
  
  if (clientData.location) {
    try {
      const loc = typeof clientData.location === 'string' ? JSON.parse(clientData.location) : clientData.location;
      if (loc.address || loc.city || loc.state || loc.pincode) {
        completedFields++;
      }
    } catch(e) { }
    totalFields++;
  }
  
  return Math.round((completedFields / totalFields) * 100);
};

// Updated addClient function
export const addClient = async (req, res) => {
  try {
    const {
      name, email, mobile, password, companyName, noOfEmployees,
      location, selectedProducts, selectedPackages, couponCode,
      transactionId
    } = req.body;

    console.log('📦 Received Data:', { 
      name, email, mobile, password, companyName, noOfEmployees, 
      selectedProducts, selectedPackages, couponCode, transactionId 
    });

    // Parse data
    let productsList = [];
    let packagesList = [];
    let locationObj = {};
    
    try {
      productsList = typeof selectedProducts === 'string' ? JSON.parse(selectedProducts) : (selectedProducts || []);
      packagesList = typeof selectedPackages === 'string' ? JSON.parse(selectedPackages) : (selectedPackages || []);
      locationObj = typeof location === 'string' ? JSON.parse(location) : (location || {});
    } catch (e) {
      console.error('Parse error:', e);
    }

    console.log('📋 Products IDs:', productsList);
    console.log('📦 Packages IDs:', packagesList);

    // Get products details
    let allAccessibleProducts = [];
    let selectedPackageDetails = [];
    let subtotal = 0;

    // Fetch products
    if (productsList.length > 0) {
      const products = await Product.find({ _id: { $in: productsList } });
      for (const product of products) {
        const productPrice = product.price || 0;
        allAccessibleProducts.push({
          productId: product._id,
          name: product.name,
          price: productPrice,
          code: product.code,
          category: product.category,
          isPaid: productPrice > 0,
          paymentStatus: 'pending'
        });
        subtotal += productPrice;
      }
      console.log('✅ Products added, subtotal:', subtotal);
    }

    // Fetch packages with products populated
    if (packagesList.length > 0) {
      for (const pkgId of packagesList) {
        const pkg = await Package.findById(pkgId).populate('products');
        if (pkg) {
          const packagePrice = pkg.price || 0;
          console.log(`📦 Package: ${pkg.name}, Price: ${packagePrice}, Products: ${pkg.products?.length || 0}`);
          
          selectedPackageDetails.push({
            packageId: pkg._id,
            name: pkg.name,
            price: packagePrice,
            duration: pkg.duration,
            loginCount: pkg.loginCount,
            purchaseDate: new Date(),
            // expiryDate will be set when status becomes active
          });
          
          subtotal += packagePrice;
          
          // Add products from package
          if (pkg.products && pkg.products.length > 0) {
            for (const product of pkg.products) {
              const productPrice = product.price || 0;
              allAccessibleProducts.push({
                productId: product._id,
                name: product.name,
                price: productPrice,
                code: product.code,
                category: product.category,
                isPaid: productPrice > 0,
                paymentStatus: 'pending',
                sourcePackageId: pkg._id,
                sourcePackageName: pkg.name
              });
            }
          }
        } else {
          console.log(`⚠️ Package not found: ${pkgId}`);
        }
      }
    }

    const totalAmount = subtotal;
    console.log('💰 Total Amount:', totalAmount);
    
    const customClientId = generateClientId();
    
    // PREPARE CLIENT DATA
    const clientDataForCompletion = {
      name, email, mobile, password, companyName, noOfEmployees, location
    };
    const profileCompletionPercentage = calculateProfileCompletion(clientDataForCompletion);
    console.log('📊 Profile Completion Percentage:', profileCompletionPercentage + '%');

    // CASE 1: Free registration (totalAmount = 0)
    if (totalAmount === 0) {
      console.log('🎉 Free registration - No payment needed');
      
      const newClient = new Client({
        clientId: customClientId,
        name, email, mobile,
        password: password,
        companyName,
        employeesCount: noOfEmployees,
        location: JSON.stringify(locationObj),
        profileCompletionPercentage: profileCompletionPercentage, // NEW FIELD
        accessibleProducts: allAccessibleProducts.map(p => ({ ...p, paymentStatus: 'captured', purchaseDate: new Date() })),
        selectedPackages: selectedPackageDetails,
        totalPaidAmount: 0,
        paymentDetails: { status: 'captured', amount: 0, capturedAt: new Date() },
        status: 'pending'
      });
      await newClient.save();

      const newOrder = new Order({
        orderId: generateOrderId(),
        clientId: newClient._id,
        clientEmail: email,
        clientName: name,
        clientMobile: mobile,
        items: [
          ...productsList.map(p => ({ type: 'product', itemId: p })),
          ...packagesList.map(p => ({ type: 'package', itemId: p }))
        ],
        subtotal, totalAmount: 0,
        couponCode: couponCode || null,
        companyName, employeesCount: noOfEmployees, location: locationObj,
        paymentStatus: 'captured',
        orderStatus: 'registration_completed'
      });
      await newOrder.save();
      newClient.orderId = newOrder._id;
      await newClient.save();

      return res.status(201).json({ 
        success: true, 
        message: 'Registration successful! Your account is pending admin approval.', 
        client: newClient, 
        requiresPayment: false 
      });
    }

    // CASE 2: Payment done (transactionId provided)
    if (transactionId && totalAmount > 0) {
      console.log('💰 Payment done, verifying transaction:', transactionId);
      
      try {
        const payment = await razorpay.payments.fetch(transactionId);
        
        if (!payment) {
          return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        console.log('Payment status:', payment.status);

        if (payment.status !== 'captured') {
          if (payment.status === 'authorized') {
            console.log('Capturing authorized payment...');
            await razorpay.payments.capture(transactionId, Math.round(totalAmount * 100), 'INR');
          } else {
            return res.status(400).json({ 
              success: false, 
              message: `Payment not captured. Status: ${payment.status}` 
            });
          }
        }

        const newClient = new Client({
          clientId: customClientId,
          name, email, mobile,
          password: password,
          companyName,
          employeesCount: noOfEmployees,
          location: JSON.stringify(locationObj),
          profileCompletionPercentage: profileCompletionPercentage, // NEW FIELD
          accessibleProducts: allAccessibleProducts.map(p => ({ 
            ...p, 
            paymentStatus: 'captured', 
            purchaseDate: new Date(), 
            transactionId 
          })),
          selectedPackages: selectedPackageDetails.map(pkg => ({ ...pkg, purchaseDate: new Date() })),
          paymentDetails: { 
            razorpayPaymentId: transactionId, 
            amount: totalAmount, 
            currency: 'INR', 
            status: 'captured', 
            capturedAt: new Date() 
          },
          totalPaidAmount: totalAmount,
          status: 'pending'
        });
        await newClient.save();

        const newOrder = new Order({
          orderId: generateOrderId(),
          razorpayPaymentId: transactionId,
          clientId: newClient._id,
          clientEmail: email,
          clientName: name,
          clientMobile: mobile,
          items: [
            ...productsList.map(p => ({ type: 'product', itemId: p })),
            ...packagesList.map(p => ({ type: 'package', itemId: p }))
          ],
          subtotal, totalAmount,
          couponCode: couponCode || null,
          companyName, employeesCount: noOfEmployees, location: locationObj,
          paymentStatus: 'captured',
          orderStatus: 'registration_completed'
        });
        await newOrder.save();
        newClient.orderId = newOrder._id;
        await newClient.save();

        return res.status(201).json({ 
          success: true, 
          message: 'Registration successful! Payment captured. Your account is pending admin approval.', 
          client: newClient, 
          requiresPayment: false, 
          paymentCaptured: true 
        });

      } catch (error) {
        console.error('Payment verification error:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Payment verification failed', 
          error: error.message 
        });
      }
    }

    // CASE 3: Payment required - Create Razorpay order
    if (totalAmount > 0 && !transactionId) {
      console.log('💰 Creating Razorpay order for amount:', totalAmount);
      
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        notes: { 
          email, 
          products: productsList.length, 
          packages: packagesList.length,
          clientName: name,
          totalAmount: totalAmount
        }
      });

      console.log('✅ Razorpay order created:', razorpayOrder.id);

      const newOrder = new Order({
        orderId: generateOrderId(),
        razorpayOrderId: razorpayOrder.id,
        clientEmail: email,
        clientName: name,
        clientMobile: mobile,
        items: [
          ...productsList.map(p => ({ type: 'product', itemId: p })),
          ...packagesList.map(p => ({ type: 'package', itemId: p }))
        ],
        subtotal, totalAmount,
        couponCode: couponCode || null,
        companyName, employeesCount: noOfEmployees, location: locationObj,
        paymentStatus: 'pending',
        orderStatus: 'payment_pending'
      });
      await newOrder.save();

      const newClient = new Client({
        clientId: customClientId,
        name, email, mobile,
        password: password,
        companyName,
        employeesCount: noOfEmployees,
        location: JSON.stringify(locationObj),
        profileCompletionPercentage: profileCompletionPercentage, // NEW FIELD
        accessibleProducts: allAccessibleProducts,
        selectedPackages: selectedPackageDetails,
        totalPaidAmount: totalAmount,
        paymentDetails: { 
          razorpayOrderId: razorpayOrder.id, 
          status: 'pending', 
          amount: totalAmount 
        },
        orderId: newOrder._id,
        status: 'pending'
      });
      await newClient.save();

      newOrder.clientId = newClient._id;
      await newOrder.save();

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

    return res.status(400).json({ 
      success: false, 
      message: 'Invalid request' 
    });

  } catch (error) {
    console.error('❌ Error in addClient:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message,
      stack: error.stack 
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

    // password liya hai but check nahi kar rahe
    if ((!clientId && !email) || !password) {
      return res.status(400).json({ 
        message: 'Please provide clientId/email and password' 
      });
    }

    // Find client
    const query = clientId ? { clientId } : { email };
    const client = await Client.findOne(query);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // ❌ NO PASSWORD VALIDATION

    const token = generateToken(client);

    return res.status(200).json({
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
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
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


// Helper function to calculate expiry date based on duration
const calculateExpiryDate = (duration, purchaseDate) => {
  const expiryDate = new Date(purchaseDate);
  
  switch(duration) {
    case 'monthly':
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      break;
    case 'quarterly':
      expiryDate.setMonth(expiryDate.getMonth() + 3);
      break;
    case 'half_yearly':
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      break;
    case 'yearly':
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      break;
    case 'lifetime':
      // 100 years expiry
      expiryDate.setFullYear(expiryDate.getFullYear() + 100);
      break;
    default:
      expiryDate.setMonth(expiryDate.getMonth() + 1); // default monthly
  }
  
  return expiryDate;
};

export const updateClientStatusSimple = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    let updatedClient = await Client.findById(clientId);
    
    if (!updatedClient) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // If status is being set to 'active', calculate expiry dates
    if (status === 'active' && updatedClient.status !== 'active') {
      const activationDate = new Date();
      
      // Calculate expiry for all accessible products
      updatedClient.accessibleProducts = updatedClient.accessibleProducts.map(product => ({
        ...product.toObject ? product.toObject() : product,
        expiryDate: calculateExpiryDate('monthly', activationDate), // Products default to monthly
        purchaseDate: activationDate
      }));
      
      // Calculate expiry for all selected packages based on their duration
      if (updatedClient.selectedPackages && updatedClient.selectedPackages.length > 0) {
        updatedClient.selectedPackages = updatedClient.selectedPackages.map(pkg => ({
          ...pkg.toObject ? pkg.toObject() : pkg,
          expiryDate: calculateExpiryDate(pkg.duration, activationDate),
          purchaseDate: activationDate
        }));
        
        // Also update products that came from packages
        // Get all package product IDs to update their expiry
        const packageProductIds = [];
        for (const pkg of updatedClient.selectedPackages) {
          // Fetch full package details if needed
          const fullPackage = await Package.findById(pkg.packageId).populate('products');
          if (fullPackage && fullPackage.products) {
            for (const product of fullPackage.products) {
              packageProductIds.push(product._id.toString());
            }
          }
        }
        
        // Update expiry for package products
        updatedClient.accessibleProducts = updatedClient.accessibleProducts.map(product => {
          const productId = product.productId?._id?.toString() || product.productId?.toString();
          if (packageProductIds.includes(productId)) {
            // Find which package this product belongs to
            const parentPackage = updatedClient.selectedPackages.find(pkg => 
              pkg.products?.some(p => p._id?.toString() === productId)
            );
            return {
              ...product.toObject ? product.toObject() : product,
              expiryDate: parentPackage ? calculateExpiryDate(parentPackage.duration, activationDate) : calculateExpiryDate('monthly', activationDate),
              purchaseDate: activationDate
            };
          }
          return product;
        });
      }
      
      updatedClient.activationDate = activationDate;
      updatedClient.status = status;
      
    } else {
      updatedClient.status = status;
    }
    
    await updatedClient.save();
    
    // Fetch fresh client data with populated fields
    updatedClient = await Client.findById(clientId)
      .populate('accessibleProducts.productId')
      .populate('selectedPackages.packageId');

    // 📦 Products HTML with expiry info
    const productsHtml = updatedClient.accessibleProducts.map((p, index) => {
      const expiryDateStr = p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN') : 'N/A';
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${p.name}</td>
          <td>${p.category || 'N/A'}</td>
          <td>₹${p.price || 0}</td>
          <td>${p.paymentStatus}</td>
          <td>${expiryDateStr}</td>
        </tr>
      `;
    }).join('');
    
    // 📦 Packages HTML with expiry info
    const packagesHtml = updatedClient.selectedPackages && updatedClient.selectedPackages.length > 0 
      ? updatedClient.selectedPackages.map((pkg, index) => {
          const expiryDateStr = pkg.expiryDate ? new Date(pkg.expiryDate).toLocaleDateString('en-IN') : 'N/A';
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${pkg.name}</td>
              <td>₹${pkg.price || 0}</td>
              <td>${pkg.duration || 'N/A'}</td>
              <td>${expiryDateStr}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="5" style="text-align:center">No packages purchased</td></tr>';

    // 📧 Transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // ✉️ Email HTML with expiry information
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: updatedClient.email,
      subject: '🎉 Your Account Has Been Verified - Timely Health Care',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
            <h2>Welcome to Timely Health Care!</h2>
            <p>Your account has been successfully verified</p>
          </div>
          
          <div style="padding: 20px;">
            <h3>Dear ${updatedClient.name},</h3>
            
            <p>✅ <b>Your account has been successfully verified and activated.</b></p>
            <p>You can now login and start using our services.</p>
            
            <div style="background-color: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>🔐 Login Credentials:</h3>
              <p><b>Client ID:</b> ${updatedClient.clientId}</p>
              <p><b>Email:</b> ${updatedClient.email}</p>
              <p><b>Password:</b> ${updatedClient.password}</p>
              <p><b>Login Link:</b> <a href="${process.env.LOGIN_URL || 'http://localhost:3000/login'}">Click here to login</a></p>
            </div>
            
            <div style="margin: 20px 0;">
              <h3>📦 Your Purchased Products & Services:</h3>
              <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                <thead style="background-color: #4CAF50; color: white;">
                  <tr>
                    <th>#</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Expiry Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsHtml}
                </tbody>
              </table>
            </div>
            
            ${updatedClient.selectedPackages && updatedClient.selectedPackages.length > 0 ? `
            <div style="margin: 20px 0;">
              <h3>📦 Your Purchased Packages:</h3>
              <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                <thead style="background-color: #2196F3; color: white;">
                  <tr>
                    <th>#</th>
                    <th>Package Name</th>
                    <th>Price</th>
                    <th>Duration</th>
                    <th>Expiry Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${packagesHtml}
                </tbody>
              </table>
            </div>
            ` : ''}
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404;">⚠️ Important Information:</h3>
              <ul>
                <li>Your products and packages will expire on the dates mentioned above</li>
                <li>You will receive renewal reminders 7 days before expiry</li>
                <li>For any support, please contact our support team</li>
              </ul>
            </div>
            
            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>📊 Your Profile Completion: ${updatedClient.profileCompletionPercentage || 0}%</h3>
              <div style="background-color: #ddd; border-radius: 5px; overflow: hidden;">
                <div style="background-color: #4CAF50; width: ${updatedClient.profileCompletionPercentage || 0}%; height: 20px;"></div>
              </div>
              <p style="margin-top: 10px;">Complete your profile to get better service recommendations!</p>
            </div>
            
            <hr />
            
            <p>If you have any questions, feel free to contact us.</p>
            
            <p>Best Regards,</p>
            <h4>Timely Health Care Team</h4>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Status updated to active, expiry dates calculated & email sent successfully',
      data: updatedClient
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// Create package
export const createPackage = async (req, res) => {
  try {
    const { name, description, price, duration, loginCount, products, features, status, addedBy } = req.body;

    // Check if package with same name exists
    const existingPkg = await Package.findOne({ name });
    if (existingPkg) {
      return res.status(400).json({ 
        success: false, 
        message: 'Package with this name already exists' 
      });
    }

    const newPackage = new Package({
      name,
      description,
      price,
      duration,
      loginCount: parseInt(loginCount),
      products: products || [],
      features: features || [],
      status,
      addedBy: addedBy || 'Admin'
    });

    await newPackage.save();

    // Populate products before sending response
    const populatedPackage = await Package.findById(newPackage._id).populate('products', 'name code price description');

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      package: populatedPackage
    });
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get all packages
export const getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find().populate('products', 'name code price description category');
    
    res.status(200).json({
      success: true,
      count: packages.length,
      packages
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get single package by ID
export const getPackageById = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('products', 'name code price description category features');
    
    if (!pkg) {
      return res.status(404).json({ 
        success: false, 
        message: 'Package not found' 
      });
    }

    res.status(200).json({
      success: true,
      package: pkg
    });
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Update package
export const updatePackage = async (req, res) => {
  try {
    const { name, description, price, duration, loginCount, products, features, status, addedBy } = req.body;

    // Check if another package with same name exists (excluding current package)
    if (name) {
      const existingPkg = await Package.findOne({ name, _id: { $ne: req.params.id } });
      if (existingPkg) {
        return res.status(400).json({ 
          success: false, 
          message: 'Package with this name already exists' 
        });
      }
    }

    const updatedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        duration,
        loginCount: loginCount ? parseInt(loginCount) : undefined,
        products: products || [],
        features: features || [],
        status,
        addedBy: addedBy || 'Admin'
      },
      { new: true, runValidators: true }
    ).populate('products', 'name code price description');

    if (!updatedPackage) {
      return res.status(404).json({ 
        success: false, 
        message: 'Package not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Package updated successfully',
      package: updatedPackage
    });
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Delete package
export const deletePackage = async (req, res) => {
  try {
    const deletedPackage = await Package.findByIdAndDelete(req.params.id);
    
    if (!deletedPackage) {
      return res.status(404).json({ 
        success: false, 
        message: 'Package not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Update package status
export const updatePackageStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const updatedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updatedPackage) {
      return res.status(404).json({ 
        success: false, 
        message: 'Package not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Package status updated successfully',
      package: updatedPackage
    });
  } catch (error) {
    console.error('Error updating package status:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get packages by duration
export const getPackagesByDuration = async (req, res) => {
  try {
    const { duration } = req.params;
    const packages = await Package.find({ duration, status: 'active' }).populate('products', 'name code price');
    
    res.status(200).json({
      success: true,
      count: packages.length,
      packages
    });
  } catch (error) {
    console.error('Error fetching packages by duration:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get active packages
export const getActivePackages = async (req, res) => {
  try {
    const packages = await Package.find({ status: 'active' }).populate('products', 'name code price');
    
    res.status(200).json({
      success: true,
      count: packages.length,
      packages
    });
  } catch (error) {
    console.error('Error fetching active packages:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};


export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('clientId', 'name email mobile companyName')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'All orders fetched successfully',
      data: orders
    });

  } catch (error) {
    console.error('❌ Error in getAllOrders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};


export const getSingleClient = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 Requested Client ID:', id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Client _id is required'
      });
    }

    // Find client by Mongo _id
    const client = await Client.findById(id);

    console.log('📦 DB Result:', client);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Client fetched successfully',
      data: client
    });

  } catch (error) {
    console.error('❌ Error in getSingleClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};




export const createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      priceType,
      planType,
      popular,
      buttonText,
      features,
      coreHRM,
      recruitment,
      jobPostManagement,
      applicationReports,
      unifiedDashboardAccess,
      endToEndRecruitment,
      emailSupport,
      status,
      addedBy
    } = req.body;

    // Check if plan with same name already exists
    const existingPlan = await Plan.findOne({ name });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: 'Plan with this name already exists'
      });
    }

    const plan = new Plan({
      name,
      description,
      price: priceType === 'free' ? 0 : price,
      priceType,
      planType,
      popular: popular || false,
      buttonText: buttonText || 'Get Started',
      features: features || [],
      coreHRM: coreHRM !== undefined ? coreHRM : true,
      recruitment: recruitment !== undefined ? recruitment : true,
      jobPostManagement: jobPostManagement !== undefined ? jobPostManagement : true,
      applicationReports: applicationReports !== undefined ? applicationReports : true,
      unifiedDashboardAccess: unifiedDashboardAccess !== undefined ? unifiedDashboardAccess : true,
      endToEndRecruitment: endToEndRecruitment !== undefined ? endToEndRecruitment : true,
      emailSupport: emailSupport !== undefined ? emailSupport : true,
      status: status || 'active',
      addedBy: addedBy || 'Admin'
    });

    await plan.save();

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      plan
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating plan',
      error: error.message
    });
  }
};

// @desc    Get all plans
// @route   GET /api/plans/allplans
// @access  Private (Admin)
export const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    
    res.status(200).json({
      success: true,
      count: plans.length,
      plans
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching plans',
      error: error.message
    });
  }
};

// @desc    Get single plan by ID
// @route   GET /api/plans/plan/:id
// @access  Private (Admin)
export const getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }
    
    res.status(200).json({
      success: true,
      plan
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching plan',
      error: error.message
    });
  }
};

// @desc    Update plan
// @route   PUT /api/plans/updateplan/:id
// @access  Private (Admin)
export const updatePlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      priceType,
      planType,
      popular,
      buttonText,
      features,
      coreHRM,
      recruitment,
      jobPostManagement,
      applicationReports,
      unifiedDashboardAccess,
      endToEndRecruitment,
      emailSupport,
      status,
      addedBy
    } = req.body;

    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Check if another plan with same name exists (excluding current plan)
    if (name && name !== plan.name) {
      const existingPlan = await Plan.findOne({ name });
      if (existingPlan) {
        return res.status(400).json({
          success: false,
          message: 'Plan with this name already exists'
        });
      }
    }

    // Update fields
    plan.name = name || plan.name;
    plan.description = description !== undefined ? description : plan.description;
    plan.price = priceType === 'free' ? 0 : (price !== undefined ? price : plan.price);
    plan.priceType = priceType || plan.priceType;
    plan.planType = planType || plan.planType;
    plan.popular = popular !== undefined ? popular : plan.popular;
    plan.buttonText = buttonText || plan.buttonText;
    plan.features = features !== undefined ? features : plan.features;
    plan.coreHRM = coreHRM !== undefined ? coreHRM : plan.coreHRM;
    plan.recruitment = recruitment !== undefined ? recruitment : plan.recruitment;
    plan.jobPostManagement = jobPostManagement !== undefined ? jobPostManagement : plan.jobPostManagement;
    plan.applicationReports = applicationReports !== undefined ? applicationReports : plan.applicationReports;
    plan.unifiedDashboardAccess = unifiedDashboardAccess !== undefined ? unifiedDashboardAccess : plan.unifiedDashboardAccess;
    plan.endToEndRecruitment = endToEndRecruitment !== undefined ? endToEndRecruitment : plan.endToEndRecruitment;
    plan.emailSupport = emailSupport !== undefined ? emailSupport : plan.emailSupport;
    plan.status = status || plan.status;
    plan.addedBy = addedBy || plan.addedBy;

    await plan.save();

    res.status(200).json({
      success: true,
      message: 'Plan updated successfully',
      plan
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating plan',
      error: error.message
    });
  }
};

// @desc    Delete plan
// @route   DELETE /api/plans/deleteplan/:id
// @access  Private (Admin)
export const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    await plan.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting plan',
      error: error.message
    });
  }
};

// @desc    Update plan status (activate/deactivate)
// @route   PUT /api/plans/updateplanstatus/:id
// @access  Private (Admin)
export const updatePlanStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (active/inactive) is required'
      });
    }

    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    plan.status = status;
    await plan.save();

    res.status(200).json({
      success: true,
      message: `Plan ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      plan
    });
  } catch (error) {
    console.error('Error updating plan status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating plan status',
      error: error.message
    });
  }
};

// @desc    Get active plans only
// @route   GET /api/plans/activeplans
// @access  Public
export const getActivePlans = async (req, res) => {
  try {
    const plans = await Plan.find({ status: 'active' }).sort({ price: 1 });
    
    res.status(200).json({
      success: true,
      count: plans.length,
      plans
    });
  } catch (error) {
    console.error('Error fetching active plans:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active plans',
      error: error.message
    });
  }
};



// @desc    Book a plan
// @route   POST /api/bookplan/create
// @access  Public
export const bookPlan = async (req, res) => {
  try {
    const {
      fullName,
      workEmail,
      mobileNumber,
      companySize,
      industryType,
      planId,
      transactionId
    } = req.body;

    // Validation
    if (!fullName || !workEmail || !mobileNumber || !companySize || !industryType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: fullName, workEmail, mobileNumber, companySize, industryType'
      });
    }

    // Get plan details
    let plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Check if email already has a pending booking
    const existingBooking = await BookPlan.findOne({ 
      workEmail: workEmail.toLowerCase(),
      bookingStatus: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active booking with this email'
      });
    }

    const isPlanFree = plan.priceType === 'free' || plan.price === 0;
    let paymentStatus = 'pending';
    let bookingStatus = 'pending';
    let razorpayOrder = null;

    // Handle payment for paid plans
    if (!isPlanFree && transactionId) {
      try {
        const payment = await razorpay.payments.fetch(transactionId);
        if (payment.status === 'captured') {
          paymentStatus = 'completed';
          bookingStatus = 'confirmed';
        }
      } catch (error) {
        console.error('Payment verification failed:', error);
      }
    } else if (!isPlanFree && !transactionId) {
      // Create Razorpay order
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(plan.price * 100),
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        notes: {
          email: workEmail,
          plan: plan.name,
          fullName: fullName
        }
      });
    }

    // Create booking entry
    const bookPlanEntry = new BookPlan({
      fullName,
      workEmail: workEmail.toLowerCase(),
      mobileNumber,
      companySize,
      industryType,
      planId: plan._id,
      planName: plan.name,
      planPrice: plan.price,
      planPriceType: plan.priceType,
      bookingStatus: isPlanFree ? 'confirmed' : bookingStatus,
      paymentStatus: isPlanFree ? 'completed' : paymentStatus,
      paymentAmount: isPlanFree ? 0 : plan.price,
      razorpayOrderId: razorpayOrder?._id,
      razorpayPaymentId: transactionId,
      isActive: true
    });

    await bookPlanEntry.save();

    // For FREE plan OR payment completed - Create client account
    if (isPlanFree || paymentStatus === 'completed') {
      const newClientId = generateClientId();
      const tempPassword = Math.random().toString(36).slice(-8);

      // Create client account with default accessible products from plan
      const newClient = new Client({
        clientId: newClientId,
        name: fullName,
        email: workEmail.toLowerCase(),
        mobile: mobileNumber,
        password: tempPassword,
        companyName: industryType,
        employeesCount: parseInt(companySize.split('-')[0]) || 1,
        location: JSON.stringify({ industry: industryType }),
        profileCompletionPercentage: 60,
        accessibleProducts: [],
        selectedPackages: [{
          packageId: plan._id,
          name: plan.name,
          price: plan.price,
          duration: plan.priceType,
          loginCount: 1,
          purchaseDate: new Date(),
          expiryDate: isPlanFree ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null
        }],
        totalPaidAmount: isPlanFree ? 0 : plan.price,
        paymentDetails: {
          status: paymentStatus,
          amount: isPlanFree ? 0 : plan.price,
          razorpayPaymentId: transactionId,
          capturedAt: paymentStatus === 'completed' ? new Date() : null
        },
        status: 'active',
        activationDate: new Date()
      });

      await newClient.save();
      
      bookPlanEntry.clientId = newClient._id;
      bookPlanEntry.bookingStatus = 'completed';
      await bookPlanEntry.save();

      return res.status(201).json({
        success: true,
        message: isPlanFree ? 'Free plan booked successfully!' : 'Plan booked and payment completed!',
        booking: {
          _id: bookPlanEntry._id,
          bookingId: bookPlanEntry.bookingId,
          fullName: bookPlanEntry.fullName,
          workEmail: bookPlanEntry.workEmail,
          planName: bookPlanEntry.planName,
          bookingStatus: bookPlanEntry.bookingStatus
        },
        client: {
          clientId: newClient.clientId,
          name: newClient.name,
          email: newClient.email,
          tempPassword: tempPassword
        },
        requiresPayment: false
      });
    }

    // For paid plans waiting for payment
    return res.status(201).json({
      success: true,
      message: 'Booking created. Please complete payment.',
      booking: {
        _id: bookPlanEntry._id,
        bookingId: bookPlanEntry.bookingId,
        fullName: bookPlanEntry.fullName,
        workEmail: bookPlanEntry.workEmail,
        planName: bookPlanEntry.planName,
        planPrice: bookPlanEntry.planPrice,
        bookingStatus: bookPlanEntry.bookingStatus
      },
      requiresPayment: true,
      razorpayOrder: razorpayOrder ? {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      } : null
    });

  } catch (error) {
    console.error('Error in bookPlan:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
