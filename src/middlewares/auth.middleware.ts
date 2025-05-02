import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

const authMiddleware: RequestHandler = (req, res, next) => {
  try {
    console.log("ride come in middle")
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ message: "Authorization header missing or incorrect" });
      return;
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      console.log("err?.message", err?.message);
      if (err) {
        if (err.name === "TokenExpiredError") {
          res
            .status(401)
            .json({ message: "Access token expired, please refresh" });
          return;
        }
        res.status(401).json({ message: "Invalid token" });
        return;
      }

      (req as any).user = decoded;

      next();
    });
  } catch (error) {
    res.status(401).json({ message: "Authentication failed" });
  }
};

export default authMiddleware;