import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validateBody<TSchema extends ZodType>(schema: TSchema): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) return next(result.error);

    request.body = result.data;
    next();
  };
}
