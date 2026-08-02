/**
 * The only error type you should throw on purpose.
 *
 *   throw ApiError.notFound("User not found");
 *
 * The error handler in core/error-handler.ts turns it into a JSON response
 * with the right status code. Anything else that reaches the handler is
 * treated as an unexpected bug and becomes a 500.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, "bad_request", message, details);
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(401, "unauthorized", message);
  }

  static forbidden(message = "You do not have access to this resource") {
    return new ApiError(403, "forbidden", message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, "not_found", message);
  }

  static conflict(message = "Resource already exists", details?: unknown) {
    return new ApiError(409, "conflict", message, details);
  }

  /**
   * For an endpoint that exists in the route map but has not been written yet.
   * Delete the throw as soon as you implement the handler.
   */
  static notImplemented(message = "This endpoint is not built yet") {
    return new ApiError(501, "not_implemented", message);
  }
}
