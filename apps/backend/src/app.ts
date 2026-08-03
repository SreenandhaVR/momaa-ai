import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import type { HealthStatus } from '@momaa/types';

import { ApiError, errorHandler } from './errors.js';
import { authRouter } from './routes/auth.routes.js';
import { babyRouter } from './routes/baby.routes.js';
import { chatRouter } from './routes/chat.routes.js';
import { eventRouter } from './routes/event.routes.js';
import { expressionRouter } from './routes/expression.routes.js';
import { supportRouter } from './routes/support.routes.js';
import { whatsappRouter } from './whatsapp/routes.js';

export const app: Express = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_request, response) => {
  const body: { status: HealthStatus } = { status: 'ok' };
  response.status(200).json(body);
});

app.use('/api/auth', authRouter);
app.use('/api/babies', babyRouter);
app.use('/api', whatsappRouter);
app.use('/api', chatRouter);
app.use('/api', eventRouter);
app.use('/api', expressionRouter);
app.use('/api', supportRouter);

app.use((_request, _response, next) =>
  next(new ApiError(404, 'NOT_FOUND', 'Route not found.'))
);

app.use(errorHandler);
