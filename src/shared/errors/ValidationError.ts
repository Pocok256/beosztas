import { AppError } from "./AppError";

/**
 * Validation-focused error exposed by scheduler input parsing.
 */
export class ValidationError extends AppError {
  public readonly statusCode: number;
  public readonly field: string;
  public readonly value: unknown;
  public readonly constraint: string;

  public constructor(params: {
    message: string;
    field?: string;
    value?: unknown;
    constraint?: string;
    statusCode?: number;
  }) {
    super(params.message);
    this.statusCode = params.statusCode ?? 400;
    this.field = params.field ?? "unknown";
    this.value = params.value;
    this.constraint = params.constraint ?? "validation";
  }
}