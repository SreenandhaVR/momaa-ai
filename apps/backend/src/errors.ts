import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: error.issues
      }
    });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
      }
    });
    return;
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    response.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with one of those unique values already exists.'
      }
    });
    return;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'CastError'
  ) {
    response.status(400).json({
      error: { code: 'INVALID_ID', message: 'One or more identifiers are invalid.' }
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }
  });
};
