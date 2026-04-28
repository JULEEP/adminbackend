import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns'; // Add this
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import demoRoutes from './routes/demoRoutes.js'; // Import demo routes


// 🔥 DNS FIX - Sabse pehle yeh line
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

dotenv.config();

// MongoDB connect
connectDB();

const app = express();
const PORT = process.env.PORT || 5005;

// For __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files in uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/demos', demoRoutes); // ✅ ADD THIS


// Root route
app.get('/', (req, res) => {
  res.send('Admin Panel API is running...');
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});