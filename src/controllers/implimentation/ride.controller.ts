import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IRideController } from "../interface/ride/irideController";
import { IRideService } from "../../services/interfaces/ride/irideService";
import { CreateRideSchema, CreateRideDto } from "../../dtos/create-ride.dto";
import { JoinRideSchema, JoinRideDto } from "../../dtos/join-ride.dto";

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
        res.status(401).json({ success: false, message: "Unauthorized" });
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
      res.status(201).json({ success: true, message: "Ride started successfully", data: ride });
    } catch (error) {
      next(error);
    }
  }

  async joinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const validationResult = JoinRideSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto: JoinRideDto = validationResult.data;
      const ride = await this.rideService.joinRide(dto.rideId, userId, dto.pickupLocation, dto.dropoffLocation);
      res.status(200).json({ success: true, message: "Joined ride successfully", data: ride });
    } catch (error) {
      next(error);
    }
  }

  async getRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const rides = await this.rideService.getRides(userId);
      res.status(200).json({ success: true, data: rides });
    } catch (error) {
      next(error);
    }
  }

  async findNearestRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { userLocation, destination } = req.body;
      if (!userLocation || !destination) {
        res.status(400).json({ success: false, message: "User location and destination are required" });
        return;
      }

      const rides = await this.rideService.findNearestRides(userLocation, destination);
      res.status(200).json({ success: true, data: rides });
    } catch (error) {
      next(error);
    }
  }

  // New endpoint to create a payment order for joining a ride
  async createRidePaymentOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { rideId } = req.body;
      if (!rideId) {
        res.status(400).json({ success: false, message: "Ride ID is required" });
        return;
      }

      const order = await this.rideService.createRidePaymentOrder(rideId);
      res.status(200).json({ success: true, order });
    } catch (error: any) {
      console.error("Error in createRidePaymentOrder:", error);
      const errorMessage = error.message || "Internal Server Error";
      const isClientError =
        errorMessage.includes("Ride not found") ||
        errorMessage.includes("Ride has already started") ||
        errorMessage.includes("Ride is full") ||
        errorMessage.includes("Amount must be");
      res.status(isClientError ? 400 : 500).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  // New endpoint to verify payment and join the ride
  async verifyAndJoinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { rideId, pickupLocation, dropoffLocation, paymentId, orderId, signature } = req.body;
      if (!rideId || !pickupLocation || !dropoffLocation || !paymentId || !orderId || !signature) {
        res.status(400).json({ success: false, message: "All payment and ride details are required" });
        return;
      }

      const ride = await this.rideService.verifyAndJoinRide(
        rideId,
        userId,
        pickupLocation,
        dropoffLocation,
        paymentId,
        orderId,
        signature
      );
      res.status(200).json({ success: true, message: "Payment verified and joined ride successfully", data: ride });
    } catch (error: any) {
      console.error("Error in verifyAndJoinRide:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }
}