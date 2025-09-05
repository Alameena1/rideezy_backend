import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";

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
  };
}

const authMiddleware: RequestHandler = (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Authorization header missing or incorrect" });
      return;
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, USER_JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log("Verification Error:", err.message);
        if (err.name === "TokenExpiredError") {
          res.status(401).json({ success: false, message: "Access token expired, please refresh" });
          return;
        }
        res.status(401).json({ success: false, message: "Invalid token" });
        return;
      }

      const payload = decoded as JwtPayload;
      if (!payload.userId || payload.role !== "user") {
        res.status(403).json({ success: false, message: "User access required" });
        return;
      }

      req.user = payload;
      next();
    });
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(401).json({ success: false, message: "Authentication failed" });
  }
};

export default authMiddleware;
