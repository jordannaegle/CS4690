import dotenv from 'dotenv';
import { createApp } from './app.js';
import connectDB from './db.js';
import { ensureSeedData } from './seed.js';

dotenv.config();

export const app = createApp();

async function startServer(): Promise<void> {
  await connectDB();
  await ensureSeedData();

  const PORT: string | number = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error(message);
  process.exit(1);
});
