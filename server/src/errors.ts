export class ApiError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function found<T>(value: T | null | undefined): T {
  if (value == null) throw new ApiError(404, 'NOT_FOUND', 'This item is unavailable.');
  return value;
}
