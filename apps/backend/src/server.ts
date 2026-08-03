import { app } from './app.js';
import { connectDatabase } from './database.js';

const port = Number(process.env.PORT ?? 3000);
async function start(): Promise<void> {
  await connectDatabase();
  app.listen(port, () => console.log(`Backend listening at http://localhost:${port}`));
}
start().catch((error: unknown) => {
  console.error('Failed to start backend:', error);
  process.exitCode = 1;
});
