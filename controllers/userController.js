import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

export const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email });

  // Plain text password match
  if (user && user.password === password) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      accessibleProducts: user.accessibleProducts,
      token: generateToken(user._id), // JWT token
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// REGISTER
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, accessibleProducts } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    accessibleProducts,
  });

  res.status(201).json(user);
});

// SEED ADMIN
export const seedAdmin = asyncHandler(async (req, res) => {
  const adminExists = await User.findOne({ role: 'admin' });

  if (adminExists) {
    res.status(400);
    throw new Error('Admin already exists');
  }

  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@gmail.com',
    password: '123456',
    role: 'admin',
    accessibleProducts: ['attendance', 'coworking', 'camp'],
  });

  res.status(201).json({ message: 'Admin created', email: admin.email });
});

// DELETE USER
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  await user.deleteOne();
  res.json({ message: 'User deleted successfully' });
});

// GET ALL USERS (ADMIN)
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password');
  res.json(users);
});

// GET USER BY ID (ADMIN)
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json(user);
});

// UPDATE USER (ADMIN)
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.role = req.body.role || user.role;
  user.accessibleProducts =
    req.body.accessibleProducts || user.accessibleProducts;

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
    accessibleProducts: updatedUser.accessibleProducts,
  });
});

// UPDATE OWN PROFILE (USER)
export const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;

  if (req.body.password) {
    user.password = req.body.password;
  }

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    token: generateToken(updatedUser._id),
  });
});
