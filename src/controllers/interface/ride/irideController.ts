import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

export interface IRideController {
  startRide(req: Request, res: Response, next: NextFunction): Promise<void>;
  joinRide(req: Request, res: Response, next: NextFunction): Promise<void>;
  getRides(req: Request, res: Response, next: NextFunction): Promise<void>;
  findNearestRides(req: Request, res: Response, next: NextFunction): Promise<void>;
  createRidePaymentOrder(req: Request, res: Response, next: NextFunction): Promise<void>;
  verifyAndJoinRide(req: Request, res: Response, next: NextFunction): Promise<void>;
  getJoinedRides(req: Request, res: Response, next: NextFunction): Promise<void>;
  editRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  cancelRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  cancelJoinedRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  startTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  handleJoinRequest(req: Request, res: Response): Promise<void>; 
}