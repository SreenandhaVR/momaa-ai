import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { ApiError, asyncHandler } from '../errors.js';
import { BabyModel, ParentModel } from '../models/index.js';
import { serializeBaby } from '../serializers.js';
import { buildRhythm } from '../services/rhythm.service.js';
import { validateBody } from '../validation.js';

const babyFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: z.string().datetime({ offset: true }),
  sex: z.enum(['female', 'male', 'intersex', 'unspecified']).optional(),
  photoUrl: z.string().trim().url().max(2_000).optional(),
  medicalNotes: z.string().trim().max(5_000).optional()
};
const createBabyBody = z.object(babyFields).strict();
const updateBabyBody = z
  .object({
    firstName: babyFields.firstName.optional(),
    lastName: babyFields.lastName,
    dateOfBirth: babyFields.dateOfBirth.optional(),
    sex: babyFields.sex,
    photoUrl: babyFields.photoUrl,
    medicalNotes: babyFields.medicalNotes
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const babyRouter: Router = Router();
babyRouter.use(requireAuth);

babyRouter.get(
  '/',
  asyncHandler(async (request, response) => {
    const babies = await BabyModel.find({ parentIds: request.auth!.parentId }).sort({
      dateOfBirth: -1
    });
    response.json({ data: babies.map(serializeBaby) });
  })
);

babyRouter.post(
  '/',
  validateBody(createBabyBody),
  asyncHandler(async (request, response) => {
    const parent = await ParentModel.findById(request.auth!.parentId);
    if (!parent)
      throw new ApiError(401, 'INVALID_ACCOUNT', 'The account does not have a parent profile.');
    const input = request.body as z.infer<typeof createBabyBody>;
    const baby = await BabyModel.create({
      ...input,
      dateOfBirth: new Date(input.dateOfBirth),
      parentIds: [parent._id]
    });
    try {
      await ParentModel.updateOne({ _id: parent._id }, { $addToSet: { babyIds: baby._id } });
    } catch (error) {
      await baby.deleteOne();
      throw error;
    }
    response.status(201).json({ data: serializeBaby(baby) });
  })
);

babyRouter.get(
  '/:babyId/rhythm',
  asyncHandler(async (request, response) => {
    const baby = await BabyModel.findOne({
      _id: request.params.babyId,
      parentIds: request.auth!.parentId
    });
    if (!baby) throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
    const parent = await ParentModel.findById(request.auth!.parentId).select('timezone');
    const rhythm = await buildRhythm({
      babyId: String(baby._id),
      babyName: baby.firstName,
      timeZone: parent?.timezone ?? 'UTC'
    });
    response.json({ data: rhythm.insights, meta: { feedingFrequency: rhythm.feedingFrequency } });
  })
);

babyRouter.get(
  '/:id',
  asyncHandler(async (request, response) => {
    const baby = await BabyModel.findOne({
      _id: request.params.id,
      parentIds: request.auth!.parentId
    });
    if (!baby) throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
    response.json({ data: serializeBaby(baby) });
  })
);

babyRouter.patch(
  '/:id',
  validateBody(updateBabyBody),
  asyncHandler(async (request, response) => {
    const input = request.body as z.infer<typeof updateBabyBody>;
    const update = {
      ...input,
      ...(input.dateOfBirth ? { dateOfBirth: new Date(input.dateOfBirth) } : {})
    };
    const baby = await BabyModel.findOneAndUpdate(
      { _id: request.params.id, parentIds: request.auth!.parentId },
      update,
      { returnDocument: 'after', runValidators: true, includeResultMetadata: false }
    );
    if (!baby) throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
    response.json({ data: serializeBaby(baby) });
  })
);
