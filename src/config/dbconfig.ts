import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './logger'; // Import the logger

dotenv.config();

export const config = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/SpeakSwap',
  osrmBaseUrl: process.env.OSRM_BASE_URL || 'http://router-project-osrm.org',
};

export const connectDB = async (): Promise<void> => {
  try {
    if (!process.env.MONGO_URI) {
      logger.error('MONGO_URI environment variable is not defined'); // Replace console.error
      throw new Error('MONGO_URI environment variable is not defined');
    }
    
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'SpeakSwap',
    });
    logger.info('✅ MongoDB Connected Successfully'); // Replace console.log
  } catch (error) {
    logger.error('❌ MongoDB Connection Failed:', error); // Replace console.error
    process.exit(1);
  }
};

export default connectDB;