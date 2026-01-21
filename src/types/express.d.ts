// types/express.d.ts
import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    role: string; userId: string; email: string 
};
}