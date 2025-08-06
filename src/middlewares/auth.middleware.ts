  // src/middlewares/authMiddleware.ts
  import { Request, Response, NextFunction, RequestHandler } from "express";
  import jwt from "jsonwebtoken";

  const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

  // Define the AuthenticatedRequest interface
  export interface AuthenticatedRequest extends Request {
    user?: {
      userId: string;
      email: string;
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

      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        console.log("Verification Error:", err?.message);
        if (err) {
          if (err.name === "TokenExpiredError") {
            res.status(401).json({ success: false, message: "Access token expired, please refresh" });
            return;
          }
          res.status(401).json({ success: false, message: "Invalid token" });
          return;
        }

        req.user = decoded as { userId: string; email: string };
        next();
      });
    } catch (error) {
      console.error("Auth Middleware Error:", error);
      res.status(401).json({ success: false, message: "Authentication failed" });
    }
  };

  export default authMiddleware;