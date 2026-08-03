import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { respondToBabyChat } from '../services/chat.service.js';
import { validateBody } from '../validation.js';

const chatBody = z.object({ message: z.string().trim().min(1).max(4_000) }).strict();
export const chatRouter: Router = Router();
chatRouter.use(requireAuth);
chatRouter.post(
  '/babies/:babyId/chat',
  validateBody(chatBody),
  async (request, response, next) => {
    try {
      const { message } = request.body as z.infer<typeof chatBody>;

      const result = await respondToBabyChat({
        babyId: String(request.params.babyId),
        parentId: request.auth!.parentId,
        message
      });

      response.json({ data: result });
    } catch (error) {
      console.error('CHAT ERROR:', error);
      next(error);
    }
  }
);
