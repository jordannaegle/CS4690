// server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import connectDB from './db';

// Initialize the Express application
const app = express();

// Connect to the MongoDB database
connectDB();

// Middleware
app.use(cors()); // allows cross-origin requests
app.use(express.json()); // Parses incoming JSON data from POST/PUT requests
app.use(express.static('public')); // Serves static files from the 'public' directory

// API Routes 
app.get('/api/v1/courses', (req: Request, res: Response) => {
    res.send('GET all courses - Route is working!');
});

app.post('/api/v1/courses', (req: Request, res: Response) => {
    res.send('POST a new course - Route is working!');
});

app.put('/api/v1/courses/:id', (req: Request, res: Response) => {
    res.send('PUT update course - Route is working!');
});

// Log Routes
app.get('/api/v1/logs', (req: Request, res: Response) => {
    // This will eventually expect ?courseId=... & uvuId=...
    res.send('GET logs - Route is working!');
});

app.post('/api/v1/logs', (req: Request, res: Response) => {
    res.send('POST new log - Route is working!');
});

// Start the server
const PORT: string | number = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});