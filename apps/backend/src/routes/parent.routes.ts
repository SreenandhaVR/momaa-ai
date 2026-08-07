import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { ApiError, asyncHandler } from '../errors.js';
import { ParentModel, WhatsAppLinkModel } from '../models/index.js';
import { serializeParent } from '../serializers.js';
import {
  createWhatsAppLink,
  updateWhatsAppLink,
  verifyWhatsAppLink
} from '../services/whatsapp-link.service.js';
import { normalizeE164PhoneNumber } from '../whatsapp/phone.js';
import { validateBody } from '../validation.js';

const phoneBody = z.object({ phoneNumber: z.string().trim().min(8).max(30) }).strict();
const codeBody = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

export const parentRouter: Router = Router();
parentRouter.use(requireAuth);

parentRouter.get(
  '/me',
  asyncHandler(async (request, response) => {
    const parent = await ParentModel.findOne({
      _id: request.auth!.parentId,
      userId: request.auth!.userId
    });
    if (!parent) throw new ApiError(404, 'NOT_FOUND', 'Parent profile not found.');
    response.json({ data: serializeParent(parent) });
  })
);

/** Starts (or restarts) verification for the authenticated parent's WhatsApp number. */
parentRouter.post(
  '/me/phone',
  validateBody(phoneBody),
  asyncHandler(async (request, response) => {
    const parent = await ParentModel.findOne({
      _id: request.auth!.parentId,
      userId: request.auth!.userId
    });
    if (!parent) throw new ApiError(404, 'NOT_FOUND', 'Parent profile not found.');

    const phoneE164 = normalizeE164PhoneNumber(
      (request.body as z.infer<typeof phoneBody>).phoneNumber
    );
    const phoneNumber = phoneE164.slice(1);
    const parentConflict = await ParentModel.exists({ phoneNumber, _id: { $ne: parent._id } });
    if (parentConflict)
      throw new ApiError(
        409,
        'WHATSAPP_NUMBER_IN_USE',
        'This WhatsApp number is already linked to another Momaa account.'
      );

    const currentLink = await WhatsAppLinkModel.findOne({
      userId: request.auth!.userId,
      parentId: parent._id
    }).sort({ updatedAt: -1 });
    const link = currentLink
      ? await updateWhatsAppLink({
          linkId: String(currentLink._id),
          userId: request.auth!.userId,
          parentId: request.auth!.parentId,
          phoneNumber: phoneE164
        })
      : await createWhatsAppLink({
          userId: request.auth!.userId,
          parentId: request.auth!.parentId,
          phoneNumber: phoneE164
        });

    parent.phoneNumber = phoneNumber;
    parent.isPhoneVerified = false;
    await parent.save();
    response.status(202).json({
      data: {
        parent: serializeParent(parent),
        verificationExpiresAt: link.verificationExpiresAt?.toISOString()
      }
    });
  })
);

parentRouter.post(
  '/me/phone/verify',
  validateBody(codeBody),
  asyncHandler(async (request, response) => {
    const parent = await ParentModel.findOne({
      _id: request.auth!.parentId,
      userId: request.auth!.userId
    });
    if (!parent?.phoneNumber)
      throw new ApiError(404, 'NOT_FOUND', 'No phone number is awaiting verification.');
    const link = await WhatsAppLinkModel.findOne({
      userId: request.auth!.userId,
      parentId: parent._id,
      phoneE164: `+${parent.phoneNumber}`
    });
    if (!link) throw new ApiError(404, 'NOT_FOUND', 'No phone number is awaiting verification.');
    await verifyWhatsAppLink({
      linkId: String(link._id),
      userId: request.auth!.userId,
      parentId: request.auth!.parentId,
      code: (request.body as z.infer<typeof codeBody>).code
    });
    parent.isPhoneVerified = true;
    await parent.save();
    response.json({ data: { parent: serializeParent(parent) } });
  })
);
