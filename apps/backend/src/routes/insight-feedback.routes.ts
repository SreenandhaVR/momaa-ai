import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../errors.js';
import { createInsightFeedback } from '../services/insight-feedback.service.js';
import { validateBody } from '../validation.js';

const body = z
  .object({
    insightId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    type: z.enum(['helpful', 'not_helpful', 'correction']),
    comment: z.string().trim().min(1).max(2_000).optional(),
    timestamp: z.string().datetime({ offset: true }).optional()
  })
  .strict();

function serialize(feedback: {
  _id?: unknown;
  babyId: unknown;
  parentId: unknown;
  insightId?: unknown;
  type: string;
  comment?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(feedback._id),
    babyId: String(feedback.babyId),
    parentId: String(feedback.parentId),
    insightId: feedback.insightId ? String(feedback.insightId) : undefined,
    type: feedback.type,
    comment: feedback.comment,
    timestamp: feedback.timestamp.toISOString(),
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString()
  };
}

export const insightFeedbackRouter: Router = Router();
insightFeedbackRouter.use(requireAuth);
insightFeedbackRouter.post(
  '/babies/:babyId/insight-feedback',
  validateBody(body),
  asyncHandler(async (request, response) => {
    const input = request.body as z.infer<typeof body>;
    const feedback = await createInsightFeedback({
      babyId: String(request.params.babyId),
      parentId: request.auth!.parentId,
      insightId: input.insightId,
      type: input.type,
      comment: input.comment,
      timestamp: input.timestamp ? new Date(input.timestamp) : undefined
    });
    response.status(201).json({ data: serialize(feedback) });
  })
);
