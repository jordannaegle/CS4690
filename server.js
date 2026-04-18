import dotenv from 'dotenv';
import { createApp } from './app.js';
import connectDB from './db.js';
import { ensureSeedData } from './seed.js';
dotenv.config();
export const app = createApp();
async function startServer() {
    await connectDB();
    await ensureSeedData();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
startServer().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown startup error';
    console.error(message);
    process.exit(1);
});
//# sourceMappingURL=server.js.map