import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/SpeakSwap',
  osrmBaseUrl: process.env.OSRM_BASE_URL || 'http://router.project-osrm.org',
};

export const connectDB = async (): Promise<void> => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not defined');
    }
    
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'SpeakSwap',
    });
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error);
    process.exit(1);
  }
};

export default connectDB;