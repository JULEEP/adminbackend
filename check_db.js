import dotenv from 'dotenv';
import connectDB from './config/db.js';
import User from './models/User.js';

dotenv.config();

const checkDb = async () => {
  try {
    await connectDB();
    const count = await User.countDocuments();
    console.log(`Total Users: ${count}`);
    
    if (count > 0) {
      const users = await User.find({}, 'name email role');
      console.log('Users found:', users);
    } else {
      console.log('No users found. Database is empty.');
    }
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

checkDb();
