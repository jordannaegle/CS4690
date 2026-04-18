// seed.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import Course from './models/Course.js';
import Log from './models/Log.js';
dotenv.config();
const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || '');
        console.log('Connected to MongoDB for seeding...');
        const data = JSON.parse(fs.readFileSync('./db.json', 'utf-8'));
        await Course.deleteMany({});
        await Log.deleteMany({});
        await Course.insertMany(data.courses);
        await Log.insertMany(data.logs);
        console.log('Database Seeded!');
        process.exit();
    }
    catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};
seedDB();
//# sourceMappingURL=seed.js.map