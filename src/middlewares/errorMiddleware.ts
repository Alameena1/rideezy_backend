import { Request, Response, NextFunction } from "express";

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("defhsdhfhgyd",err.stack);
  let statusCode = err.status || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e: any) => e.message)
      .join(", ");
  } else if (err.name === "MongoError" && err.code === 11000) {
    statusCode = 400;
    message = "Duplicate key error: " + Object.keys(err.keyValue).join(", ");
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};