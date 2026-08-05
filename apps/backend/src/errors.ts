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

  // Meta delivery failures are expected integration failures, not server crashes.
  // Return a useful, safe response to clients while retaining the complete Meta
  // response in the server logs emitted by the WhatsApp client.
  if (
    error instanceof Error &&
    error.name === 'WhatsAppSendError' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    const details = 'details' in error ? error.details : undefined;
    console.error(
      JSON.stringify({
        scope: 'api.error',
        event: 'whatsapp_delivery_failed',
        status: error.status,
        message: error.message,
        details,
        stack: error.stack
      })
    );
    response.status(502).json({
      error: {
        code: 'WHATSAPP_DELIVERY_FAILED',
        message:
          'We could not send the WhatsApp verification code. Check the WhatsApp template and recipient configuration.',
        ...(details === undefined ? {} : { details })
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
