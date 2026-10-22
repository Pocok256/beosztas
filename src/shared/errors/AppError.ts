/**
 * Base application error carrying a timestamp for diagnostics.
 */
export class AppError extends Error {
  public readonly timestamp: Date;

  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}