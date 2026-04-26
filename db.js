import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
// Open the MongoDB connection for either the provided URI or the configured
// environment variable so both production code and tests can share one helper.
const connectDB = async (mongoUri) => {
    const connectionString = mongoUri || process.env.MONGO_URI || '';
    if (!connectionString) {
        throw new Error('MONGO_URI is not configured');
    }
    const conn = await mongoose.connect(connectionString);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
};
export default connectDB;
//# sourceMappingURL=db.js.map