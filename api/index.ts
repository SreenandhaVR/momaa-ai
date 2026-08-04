
import type { Request, Response } from 'express';
// NodeNext emits these files from apps/backend/src during `pnpm build`.
import { app } from '../apps/backend/dist/app.js';
import { connectDatabase } from '../apps/backend/dist/database.js';

/** Vercel Node.js serverless entry point. No listener is created here. */
export default async function handler(request: Request, response: Response): Promise<void> {
  try {
    await connectDatabase();
    app(request, response);
  } catch (error) {
    console.error('[vercel] Failed to initialise MongoDB:', error);
    response.status(500).json({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection could not be established.' }
    });
  }
}
