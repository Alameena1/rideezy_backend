import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      admin?: {
        userId?: string;
        email?: string;
        [key: string]: any;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

const adminAuthMiddleware: RequestHandler = (req, res, next): void => {
  console.log("fivdsifgdibfpiwbfihwbfiyhwedbfiwdbfpihwevf")
  try {

    const authHeader = req.headers.authorization;
    const tokenFromCookie = req.cookies?.accessToken; 
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : tokenFromCookie;
    if (!token) {
      res.status(401).json({ message: "Admin authorization token missing" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId?: string;
      email?: string;
      [key: string]: any;
    };

    req.admin = decoded; 
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ message: "Admin access token expired, please refresh" });
      return;
    } else if (error instanceof JsonWebTokenError) {
      res.status(401).json({ message: "Invalid admin token" });
      return;
    }
    res.status(401).json({ message: "Admin authentication failed" });
    return;
  }
};

export default adminAuthMiddleware;