/** Section 7 of ARCHITECTURE.md — the only two shapes any API response may take. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: string[];
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function apiSuccess<T>(data: T, message = "OK"): ApiSuccessResponse<T> {
  return { success: true, data, message };
}

export function apiError(message: string, errors: string[] = []): ApiErrorResponse {
  return { success: false, message, errors };
}
