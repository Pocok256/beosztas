import type { Response } from "express";

type HttpError = Error & {
  statusCode?: number;
};

/**
 * Sends a normalized API error response.
 *
 * @param response - Express response object.
 * @param error - Thrown error from route or service code.
 */
export function sendError(response: Response, error: HttpError): void {
  const statusCode: number = Number.isInteger(error?.statusCode) ? Number(error.statusCode) : 500;
  const message = statusCode >= 500 ? "A szerver oldalon hiba tortent." : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({ error: message });
}