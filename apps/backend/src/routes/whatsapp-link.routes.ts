import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../errors.js';
import { WhatsAppLinkModel } from '../models/index.js';
import {
  createWhatsAppLink,
  unlinkWhatsAppLink,
  updateWhatsAppLink,
  verifyWhatsAppLink
} from '../services/whatsapp-link.service.js';
import { createWhatsAppPairingCode } from '../services/whatsapp-pairing.service.js';
import { validateBody } from '../validation.js';

const phoneNumberBody = z.object({ phoneNumber: z.string().trim().min(8).max(30) }).strict();
const verifyBody = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

function serializeLink(link: {
  _id?: unknown;
  phoneE164: string;
  status: string;
  verifiedAt?: Date;
  verificationExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(link._id),
    phoneNumber: link.phoneE164,
    status: link.status,
    verifiedAt: link.verifiedAt?.toISOString(),
    verificationExpiresAt: link.verificationExpiresAt?.toISOString(),
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString()
  };
}

export const whatsappLinkRouter: Router = Router();
whatsappLinkRouter.use(requireAuth);

whatsappLinkRouter.get(
  '/',
  asyncHandler(async (request, response) => {
    const links = await WhatsAppLinkModel.find({
      userId: request.auth!.userId,
      parentId: request.auth!.parentId
    }).sort({ createdAt: -1 });
    response.json({ data: links.map(serializeLink) });
  })
);

/**
 * Generates a short-lived code that the caregiver sends from WhatsApp as
 * `link 123456`. This avoids sending an outbound OTP template during MVP use.
 */
whatsappLinkRouter.post(
  '/pairing-code',
  asyncHandler(async (request, response) => {
    const pairing = await createWhatsAppPairingCode({
      userId: request.auth!.userId,
      parentId: request.auth!.parentId
    });
    response.status(201).json({
      data: { code: pairing.code, expiresAt: pairing.expiresAt.toISOString() }
    });
  })
);

whatsappLinkRouter.post(
  '/',
  validateBody(phoneNumberBody),
  asyncHandler(async (request, response) => {
    const link = await createWhatsAppLink({
      userId: request.auth!.userId,
      parentId: request.auth!.parentId,
      phoneNumber: (request.body as z.infer<typeof phoneNumberBody>).phoneNumber
    });
    response.status(201).json({ data: serializeLink(link) });
  })
);

whatsappLinkRouter.post(
  '/:id/verify',
  validateBody(verifyBody),
  asyncHandler(async (request, response) => {
    const link = await verifyWhatsAppLink({
      linkId: String(request.params.id),
      userId: request.auth!.userId,
      parentId: request.auth!.parentId,
      code: (request.body as z.infer<typeof verifyBody>).code
    });
    response.json({ data: serializeLink(link) });
  })
);

whatsappLinkRouter.patch(
  '/:id',
  validateBody(phoneNumberBody),
  asyncHandler(async (request, response) => {
    const link = await updateWhatsAppLink({
      linkId: String(request.params.id),
      userId: request.auth!.userId,
      parentId: request.auth!.parentId,
      phoneNumber: (request.body as z.infer<typeof phoneNumberBody>).phoneNumber
    });
    response.json({ data: serializeLink(link) });
  })
);

whatsappLinkRouter.delete(
  '/:id',
  asyncHandler(async (request, response) => {
    await unlinkWhatsAppLink({
      linkId: String(request.params.id),
      userId: request.auth!.userId,
      parentId: request.auth!.parentId
    });
    response.sendStatus(204);
  })
);
