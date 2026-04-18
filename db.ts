import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async (mongoUri?: string) => {
  const connectionString: string = mongoUri || process.env.MONGO_URI || '';

  if (!connectionString) {
    throw new Error('MONGO_URI is not configured');
  }

  const conn = await mongoose.connect(connectionString);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
  return conn;
};

export default connectDB;
