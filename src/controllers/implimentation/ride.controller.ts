import { Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import { IRideController } from '../interface/ride/irideController';
import { IRideService } from '../../services/interfaces/ride/irideService';
import { CreateRideSchema, CreateRideDto } from '../../dtos/create-ride.dto';
import { JoinRideSchema, JoinRideDto } from '../../dtos/join-ride.dto';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

@injectable()
export class RideController implements IRideController {
  private rideService: IRideService;

  constructor(@inject(TYPES.IRideService) rideService: IRideService) {
    this.rideService = rideService;
  }

  async startRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const validationResult = CreateRideSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto: CreateRideDto = {
        ...validationResult.data,
        driverId: userId,
      };

      const ride = await this.rideService.startRide(dto);
      res.status(201).json({ success: true, message: 'Ride started successfully', data: ride });
    } catch (error) {
      next(error);
    }
  }

  async joinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const validationResult = JoinRideSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto: JoinRideDto = validationResult.data;
      const ride = await this.rideService.joinRide(dto.rideId, userId, dto.pickupLocation);
      res.status(200).json({ success: true, message: 'Joined ride successfully', data: ride });
    } catch (error) {
      next(error);
    }
  }

  async getRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const rides = await this.rideService.getRides(userId);
      res.status(200).json({ success: true, data: rides });
    } catch (error) {
      next(error);
    }
  }
}