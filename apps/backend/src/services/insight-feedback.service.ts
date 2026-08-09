import { ApiError } from '../errors.js';
import { AIInsightModel, BabyModel, InsightFeedbackModel } from '../models/index.js';
import type { InsightFeedbackRecord, InsightFeedbackType } from '../models/insight-feedback.model.js';

export type CreateInsightFeedbackInput = {
  babyId: string;
  parentId: string;
  insightId?: string;
  type: InsightFeedbackType;
  comment?: string;
  timestamp?: Date;
};

export interface InsightFeedbackRepository {
  parentOwnsBaby(babyId: string, parentId: string): Promise<boolean>;
  insightBelongsToBaby(insightId: string, babyId: string): Promise<boolean>;
  create(input: Required<Pick<CreateInsightFeedbackInput, 'babyId' | 'parentId' | 'type' | 'timestamp'>> &
    Pick<CreateInsightFeedbackInput, 'insightId' | 'comment'>): Promise<InsightFeedbackRecord>;
}

export const mongoInsightFeedbackRepository: InsightFeedbackRepository = {
  async parentOwnsBaby(babyId, parentId) {
    return Boolean(await BabyModel.exists({ _id: babyId, parentIds: parentId }));
  },
  async insightBelongsToBaby(insightId, babyId) {
    return Boolean(await AIInsightModel.exists({ _id: insightId, babyId }));
  },
  async create(input) {
    return InsightFeedbackModel.create(input);
  }
};

/** Creates feedback only after verifying the authenticated parent owns the baby. */
export async function createInsightFeedback(
  input: CreateInsightFeedbackInput,
  repository: InsightFeedbackRepository = mongoInsightFeedbackRepository
): Promise<InsightFeedbackRecord> {
  if (!(await repository.parentOwnsBaby(input.babyId, input.parentId)))
    throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
  if (input.insightId && !(await repository.insightBelongsToBaby(input.insightId, input.babyId)))
    throw new ApiError(404, 'NOT_FOUND', 'AI insight not found for this baby.');
  return repository.create({ ...input, timestamp: input.timestamp ?? new Date() });
}
