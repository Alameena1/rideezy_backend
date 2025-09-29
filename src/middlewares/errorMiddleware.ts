import { Request, Response, NextFunction } from "express";

interface CustomError extends Error {
  status?: number;
  code?: number;
  errors?: Record<string, { message: string }>;
  keyValue?: Record<string, string>;
}

export const errorMiddleware = (err: CustomError, req: Request, res: Response, next: NextFunction) => {
  let statusCode = err.status || 500;
  let message = err.message || "Internal Server Error";

  // Handle Mongoose Validation Errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((e: any) => e.message)
      .join(", ");
  }
  // Handle MongoDB Duplicate Key Errors
  else if (err.name === "MongoError" && err.code === 11000) {
    statusCode = 400;
    message = `Duplicate key error: ${Object.keys(err.keyValue || {}).join(", ")}`;
  }
  // Handle JWT Errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }
  // Handle Syntax Errors (e.g., malformed JSON)
  else if (err instanceof SyntaxError && err.message.includes("JSON")) {
    statusCode = 400;
    message = "Invalid JSON format in request body";
  }
  // Handle TypeError for invalid data
  else if (err instanceof TypeError) {
    statusCode = 400;
    message = "Invalid request data";
  }

  // Log detailed error information (use a logging library like Winston in production)
  if (process.env.NODE_ENV !== "production") {
    console.error("Error Details:", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      headers: req.headers,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Include stack trace only in development
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};