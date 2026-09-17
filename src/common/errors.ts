export interface FieldError {
  code: string;
  field?: string;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(errors: FieldError[]): Result<T> {
  return { ok: false, errors };
}
