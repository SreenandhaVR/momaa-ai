import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import type { HealthStatus } from '@momaa/types';

import { ApiError, errorHandler } from './errors.js';
import { authRouter } from './routes/auth.routes.js';
import { babyRouter } from './routes/baby.routes.js';
import { chatRouter } from './routes/chat.routes.js';
import { eventRouter } from './routes/event.routes.js';
import { parentRouter } from './routes/parent.routes.js';
import { expressionRouter } from './routes/expression.routes.js';
import { insightFeedbackRouter } from './routes/insight-feedback.routes.js';
import { supportRouter } from './routes/support.routes.js';
import { whatsappLinkRouter } from './routes/whatsapp-link.routes.js';
import { whatsappRouter } from './whatsapp/routes.js';

export const app: Express = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_request, response) => {
  const body: { status: HealthStatus } = { status: 'ok' };
  response.status(200).json(body);
});

app.use('/api/auth', authRouter);
app.use('/api/parents', parentRouter);
app.use('/api/babies', babyRouter);
app.use('/api/whatsapp-links', whatsappLinkRouter);
app.use('/api', whatsappRouter);
app.use('/api', chatRouter);
// This must precede the generic /babies/:babyId/:collection event route.
app.use('/api', expressionRouter);
// This must precede the generic /babies/:babyId/:collection event route.
app.use('/api', insightFeedbackRouter);
app.use('/api', eventRouter);
app.use('/api', supportRouter);

app.use((_request, _response, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')));

app.use(errorHandler);
