class ApiError extends Error {
  statusCode: number;
  error: string;
  multiLangMessage?: string;

  isOperational: boolean;

  override message: string;
  override stack?: string;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    stack = '',
    error?: string,
    multiLangMessage?: string
  ) {
    super();
    this.message = message;
    this.error = error || message;
    this.multiLangMessage = multiLangMessage || message;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
