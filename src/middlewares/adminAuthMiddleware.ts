// src/middlewares/adminAuthMiddleware.ts
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      admin?: {
        userId: string;
        email: string;
        [key: string]: any;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

const adminAuthMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.adminAuthToken;
    console.log("Extracted token from cookie:", token);

    if (!token) {
      console.log("No token found in cookie"  );
      res.status(401).json({ message: "Admin authorization token missing" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email?: string;
      [key: string]: any;
    };
    console.log("Decoded token:", decoded);

    // Check if userId exists in the decoded token
    if (!decoded.userId) {
      console.log("userId not found in decoded token");
      res.status(401).json({ message: "Invalid token payload" });
      return;
    }

    // Assign req.admin without redundant userId assignment
    req.admin = {
      email: decoded.email || decoded.userId, // Use email if present, otherwise userId (which is the email)
      ...decoded,
    };
    console.log("Admin authentication successful, proceeding...");
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      console.log("Token expired:", error.message);
      res.status(401).json({ success: false, message: "Admin access token expired, please refresh" });
      return;
    } else if (error instanceof JsonWebTokenError) {
      console.log("Invalid token:", error.message);
      res.status(401).json({ success: false, message: "Invalid admin token" });
      return;
    }
    console.log("Authentication error:", error);
    res.status(401).json({ success: false, message: "Admin authentication failed" });
    return;
  }
};

export default adminAuthMiddleware;