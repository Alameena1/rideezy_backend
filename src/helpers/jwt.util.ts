import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const USER_JWT_SECRET = process.env.USER_JWT_SECRET || "usersecret123";
const USER_REFRESH_SECRET = process.env.USER_REFRESH_SECRET || "userrefreshsecret123";
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "adminsecret123";
const ADMIN_REFRESH_SECRET = process.env.ADMIN_REFRESH_SECRET || "adminrefreshsecret123";

if (process.env.NODE_ENV === "production") {
  if (!process.env.USER_JWT_SECRET || !process.env.USER_REFRESH_SECRET) {
    throw new Error("User JWT secrets are not defined in environment variables");
  }
  if (!process.env.ADMIN_JWT_SECRET || !process.env.ADMIN_REFRESH_SECRET) {
    throw new Error("Admin JWT secrets are not defined in environment variables");
  }
}

interface AccessTokenPayload {
  userId: string;
  email: string;
  role: "user" | "admin";
  iat?: number;
  exp?: number;
}

interface RefreshTokenPayload {
  userId: string;
  email?: string; // Changed to optional
  role: "user" | "admin";
  iat?: number;
  exp?: number;
}

export const generateAccessToken = (userId: string, email: string, role: "user" | "admin"): string => {
  const payload: AccessTokenPayload = { userId, email, role };
  const secret = role === "admin" ? ADMIN_JWT_SECRET : USER_JWT_SECRET;
  return jwt.sign(payload, secret, { expiresIn: "15000m" });
};

export const generateRefreshToken = (userId: string, role: "user" | "admin"): string => {
  const payload: RefreshTokenPayload = { userId, role }; // No email needed
  const secret = role === "admin" ? ADMIN_REFRESH_SECRET : USER_REFRESH_SECRET;
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};

export const verifyAccessToken = (token: string, role: "user" | "admin"): AccessTokenPayload => {
  try {
    const secret = role === "admin" ? ADMIN_JWT_SECRET : USER_JWT_SECRET;
    const decoded = jwt.verify(token, secret) as AccessTokenPayload;
    if (decoded.role !== role) {
      throw new Error("Invalid role in token");
    }
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Access token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid access token");
    }
    throw error;
  }
};

export const verifyRefreshToken = (token: string, role: "user" | "admin"): RefreshTokenPayload => {
  try {
    const secret = role === "admin" ? ADMIN_REFRESH_SECRET : USER_REFRESH_SECRET;
    const decoded = jwt.verify(token, secret) as RefreshTokenPayload;
    if (decoded.role !== role) {
      throw new Error("Invalid role in token");
    }
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Refresh token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
};
