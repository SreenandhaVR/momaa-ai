import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { ApiError, asyncHandler } from '../errors.js';
import {
  AIInsightModel,
  BabyModel,
  GrowthModel,
  MemoryModel,
  ParentModel,
  TimelineEventModel,
  VaccinationModel
} from '../models/index.js';
import { serializeBaby } from '../serializers.js';
import { buildRhythm } from '../services/rhythm.service.js';
import { uploadImageToCloudinary, uploadToCloudinary } from '../services/cloudinary.service.js';
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
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('image/'))
});
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

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

babyRouter.post(
  '/:id/photo',
  photoUpload.single('photo'),
  asyncHandler(async (request, response) => {
    if (!request.file) throw new ApiError(400, 'VALIDATION_ERROR', 'An image file is required.');
    const baby = await BabyModel.findOne({
      _id: request.params.id,
      parentIds: request.auth!.parentId
    });
    if (!baby) throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
    baby.photoUrl = await uploadImageToCloudinary(request.file.buffer, request.file.mimetype);
    await baby.save();
    response.json({ data: serializeBaby(baby) });
  })
);

babyRouter.post(
  '/:id/media',
  mediaUpload.single('media'),
  asyncHandler(async (request, response) => {
    if (!request.file)
      throw new ApiError(400, 'VALIDATION_ERROR', 'A photo or voice note is required.');
    if (!request.file.mimetype.startsWith('image/') && !request.file.mimetype.startsWith('audio/'))
      throw new ApiError(400, 'VALIDATION_ERROR', 'Only images and audio are supported.');
    const baby = await BabyModel.findOne({
      _id: request.params.id,
      parentIds: request.auth!.parentId
    });
    if (!baby) throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
    const mediaUrl = await uploadToCloudinary(request.file.buffer, request.file.mimetype, 'auto');
    const title = request.file.mimetype.startsWith('audio/') ? 'Voice note' : 'Photo memory';
    const memory = await MemoryModel.create({
      babyId: baby._id,
      title,
      mediaUrls: [mediaUrl],
      occurredAt: new Date(),
      source: 'app'
    });
    response.status(201).json({ data: { id: String(memory._id), title, mediaUrl } });
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
  '/:babyId/dashboard',
  asyncHandler(async (request, response) => {
    const baby = await BabyModel.findOne({
      _id: request.params.babyId,
      parentIds: request.auth!.parentId
    });
    if (!baby) throw new ApiError(404, 'NOT_FOUND', 'Baby profile not found.');
    const [insight, vaccinations, growth, timeline] = await Promise.all([
      AIInsightModel.findOne({ babyId: baby._id }).sort({ generatedAt: -1 }),
      VaccinationModel.find({ babyId: baby._id, nextDueAt: { $gte: new Date() } })
        .sort({ nextDueAt: 1 })
        .limit(3),
      GrowthModel.find({ babyId: baby._id }).sort({ recordedAt: -1 }).limit(2),
      TimelineEventModel.find({ babyId: baby._id }).sort({ occurredAt: -1 }).limit(3)
    ]);
    const serialize = (value: { _id: unknown; toObject: () => Record<string, unknown> } | null) => {
      if (!value) return null;
      const raw = value.toObject();
      return Object.fromEntries(
        Object.entries(raw).map(([key, item]) => [
          key === '_id' ? 'id' : key,
          item instanceof Date ? item.toISOString() : key === '_id' ? String(item) : item
        ])
      );
    };
    response.json({
      data: {
        baby: serializeBaby(baby),
        insight: serialize(insight),
        upcomingVaccinations: vaccinations.map(serialize),
        growth: growth.map(serialize),
        recentTimeline: timeline.map(serialize)
      }
    });
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
