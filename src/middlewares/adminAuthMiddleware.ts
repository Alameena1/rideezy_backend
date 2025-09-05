import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../helpers/jwt.util";

interface AuthenticatedRequest extends Request {
  admin?: { userId: string; email: string; role: string };
}

export const adminAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  try {
    const decoded = verifyAccessToken(token, "admin");
    req.admin = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
