import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

export interface IRideController {
  startRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}