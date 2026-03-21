// server.ts
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import connectDB from './db.js';
import CourseRepository from './repositories/CourseRepository.js';
import LogRepository from './repositories/LogRepository.js';
// Initialize the Express application
const app = express();
// Connect to the MongoDB database
connectDB();
// Middleware
app.use(cors()); // allows cross-origin requests
app.use(express.json()); // Parses incoming JSON data from POST/PUT requests
app.use(express.static('public')); // Serves static files from the 'public' directory
// --- Course Routes ---
app.get('/api/v1/courses', async (_req, res) => {
    try {
        const courses = await CourseRepository.getAllCourses();
        res.json(courses);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching courses' });
    }
});
app.post('/api/v1/courses', async (req, res) => {
    try {
        const newCourse = await CourseRepository.addCourse(req.body);
        res.status(201).json(newCourse);
    }
    catch (error) {
        res.status(400).json({ message: 'Error adding course' });
    }
});
app.put('/api/v1/courses/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const updatedCourse = await CourseRepository.updateCourse(id, req.body);
        if (!updatedCourse)
            return res.status(404).json({ message: 'Course not found' });
        res.json(updatedCourse);
    }
    catch (error) {
        res.status(400).json({ message: 'Error updating course' });
    }
});
// --- Log Routes ---
app.get('/api/v1/logs', async (req, res) => {
    try {
        // Extract the query parameters (e.g., ?courseId=cs3380&uvuId=10111111)
        const { courseId, uvuId } = req.query;
        if (!courseId || !uvuId) {
            return res.status(400).json({ message: 'Missing courseId or uvuId' });
        }
        const logs = await LogRepository.getLogs(courseId, uvuId);
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching logs' });
    }
});
app.post('/api/v1/logs', async (req, res) => {
    try {
        const newLog = await LogRepository.addLog(req.body);
        res.status(201).json(newLog);
    }
    catch (error) {
        res.status(400).json({ message: 'Error adding log' });
    }
});
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map