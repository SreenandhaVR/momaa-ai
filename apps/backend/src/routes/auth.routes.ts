import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { issueTokens, verifyRefreshToken } from '../auth.js';
import { ApiError, asyncHandler } from '../errors.js';
import { ParentModel, UserModel } from '../models/index.js';
import { serializeParent, serializeUser } from '../serializers.js';
import { validateBody } from '../validation.js';

const registerBody = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().optional(),
    phoneNumber: z.string().trim().min(7).max(30).optional(),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100).optional(),
    relationshipToBaby: z.string().trim().min(1).max(100).optional(),
    timezone: z.string().trim().min(1).max(100).default('UTC')
  })
  .strict()
  .refine((value) => value.email || value.phoneNumber, {
    message: 'Either email or phoneNumber is required.',
    path: ['email']
  });

const loginBody = z
  .object({
    email: z.string().trim().email().optional(),
    phoneNumber: z.string().trim().min(7).max(30).optional(),
    password: z.string().min(1).max(128)
  })
  .strict()
  .refine((value) => value.email || value.phoneNumber, {
    message: 'Either email or phoneNumber is required.',
    path: ['email']
  });

const refreshBody = z.object({ refreshToken: z.string().min(1) }).strict();
export const authRouter: Router = Router();

authRouter.post(
  '/register',
  validateBody(registerBody),
  asyncHandler(async (request, response) => {
    const {
      password,
      email,
      phoneNumber,
      firstName,
      lastName,
      relationshipToBaby,
      timezone,
      ...userInput
    } = request.body as z.infer<typeof registerBody>;
    const normalizedEmail = email?.toLowerCase();
    const identities = [
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(phoneNumber ? [{ phoneNumber }] : [])
    ];
    if (await UserModel.exists({ $or: identities }))
      throw new ApiError(
        409,
        'CONFLICT',
        'An account with that email or phone number already exists.'
      );

    const user = await UserModel.create({
      ...userInput,
      email: normalizedEmail,
      phoneNumber,
      passwordHash: await bcrypt.hash(password, 12),
      lastActiveAt: new Date()
    });
    let parent;
    try {
      parent = await ParentModel.create({
        userId: user._id,
        firstName,
        lastName,
        relationshipToBaby,
        phoneNumber: phoneNumber?.replace(/\D/g, ''),
        timezone,
        babyIds: []
      });
      user.parentId = parent._id;
      await user.save();
    } catch (error) {
      await user.deleteOne();
      throw error;
    }

    response.status(201).json({
      data: {
        user: serializeUser(user),
        parent: serializeParent(parent),
        tokens: issueTokens(String(user._id), String(parent._id))
      }
    });
  })
);

authRouter.post(
  '/login',
  validateBody(loginBody),
  asyncHandler(async (request, response) => {
    const { email, phoneNumber, password } = request.body as z.infer<typeof loginBody>;
    const query = email ? { email: email.toLowerCase() } : { phoneNumber };
    const user = await UserModel.findOne(query).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        'Email/phone number or password is incorrect.'
      );
    const parent = await ParentModel.findOne({ userId: user._id });
    if (!parent)
      throw new ApiError(401, 'INVALID_ACCOUNT', 'The account does not have a parent profile.');
    user.lastActiveAt = new Date();
    await user.save();
    response.json({
      data: {
        user: serializeUser(user),
        parent: serializeParent(parent),
        tokens: issueTokens(String(user._id), String(parent._id))
      }
    });
  })
);

authRouter.post(
  '/refresh',
  validateBody(refreshBody),
  asyncHandler(async (request, response) => {
    const { refreshToken } = request.body as z.infer<typeof refreshBody>;
    const auth = verifyRefreshToken(refreshToken);
    const parent = await ParentModel.findOne({ _id: auth.parentId, userId: auth.userId });
    if (!parent) throw new ApiError(401, 'INVALID_TOKEN', 'The supplied token is no longer valid.');
    response.json({ data: { tokens: issueTokens(auth.userId, auth.parentId) } });
  })
);
