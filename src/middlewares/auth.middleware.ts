import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model"; // Adjust path to your User model

const USER_JWT_SECRET = process.env.USER_JWT_SECRET || "usersecret123";

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    status?: string;
  };
}

const authMiddleware: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Authorization header missing or incorrect" });
      return; 
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, USER_JWT_SECRET) as JwtPayload;
    
    if (!decoded.userId || decoded.role !== "user") {
      res.status(403).json({ success: false, message: "User access required" });
      return;
    }

    const user = await User.findById(decoded.userId).select("status email fullName");
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (user.status === "Blocked") {
      res.status(403).json({
        success: false,
        message: "You have been blocked by the admin, please contact support",
        isBlocked: true,
        user: {
          email: user.email,
          name: user.fullName || user.email,
        },
      });
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      status: user.status,
    };
    next();
  } catch (error: any) {
    console.error("Auth Middleware Error:", error);
    if (error.name === "TokenExpiredError") {
      res.status(401).json({ success: false, message: "Access token expired, please refresh" });
      return;
    }
    if (error.name === "JsonWebTokenError") {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }
    res.status(401).json({ success: false, message: "Authentication failed" });
  }
};

export default authMiddleware;