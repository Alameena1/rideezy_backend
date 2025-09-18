import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IRideController } from "../interface/ride/irideController";
import { IRideService } from "../../services/interfaces/ride/irideService";
import { CreateRideSchema, CreateRideDto } from "../../dtos/create-ride.dto";
import { JoinRideSchema, JoinRideDto } from "../../dtos/join-ride.dto";
import { EditRideSchema, EditRideDto } from "../../dtos/edit-ride.dto";

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
      console.log("[RideController] Received body:", JSON.stringify(req.body, null, 2));
      const validationResult = CreateRideSchema.safeParse(req.body);
      console.log("[RideController] Validation result:", JSON.stringify(validationResult, null, 2));
      if (!validationResult.success) {
        res.status(400).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto = validationResult.data;
      if (dto.driverId && dto.driverId !== req.user?.userId) {
        res.status(403).json({ success: false, message: "Driver ID does not match authenticated user" });
        return;
      }

      // Pass only necessary fields, let service calculate totalFuelCost, totalRideCost, and perKmRate
      const completeDto: CreateRideDto = {
        ...dto,
        driverId: req.user?.userId!,
        totalFuelCost: undefined, // Let service calculate
        totalRideCost: undefined, // Let service calculate
        costPerPerson: undefined,
        endPlaceName: "",
        startPlaceName: ""
      };

      const ride = await this.rideService.startRide(completeDto);
      res.status(201).json({
        success: true,
        message: "Ride started successfully",
        data: ride,
      });
    } catch (error: any) {
      console.error("[RideController] Error starting ride:", error);
      res.status(400).json({ success: false, message: error.message });
      next(error);
    }
  }

 async joinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    console.log("Joining ride with userId:", userId);
    
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
    
    // Return the ride with the pending request that contains the calculated distance
    res.status(200).json({ 
      success: true, 
      message: "Joined ride successfully", 
      data: ride 
    });
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

  async getJoinedRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const rides = await this.rideService.getJoinedRides(userId);
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

      const order = await this.rideService.createRidePaymentOrder(rideId, userId); // Updated to pass userId as passengerId
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

  async editRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }    

      const { rideId } = req.params;
      if (!rideId) {
        res.status(400).json({ success: false, message: "Ride ID is required" });
        return;
      }

      const validationResult = EditRideSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto: EditRideDto = validationResult.data;
      const updatedRide = await this.rideService.editRide(rideId, userId, dto);
      console.log("edit ride controller updatedRide", updatedRide);

      res.status(200).json({ success: true, message: "Ride updated successfully", data: updatedRide });
    } catch (error) {
      next(error);
    }
  }

  async cancelRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { rideId } = req.params;
      if (!rideId) {
        res.status(400).json({ success: false, message: "Ride ID is required" });
        return;
      }

      await this.rideService.cancelRide(rideId, userId);
      res.status(200).json({ success: true, message: "Ride cancelled successfully" });
    } catch (error) {
      next(error);
    }
  }

  async cancelJoinedRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const { rideId } = req.params;
      await this.rideService.cancelJoinedRide(rideId, userId);
      res.status(200).json({ success: true, message: "Ride cancellation request processed successfully" });
    } catch (error: any) {
      console.error(`[RideController] Error cancelling joined ride ${req.params.rideId}: ${error.message} at ${new Date().toISOString()}`);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async startTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { rideId } = req.params;
      if (!rideId) {
        res.status(400).json({ success: false, message: "Ride ID is required" });
        return;
      }

      const ride = await this.rideService.startTracking(rideId, userId);
      res.status(200).json({
        success: true,
        message: "Ride tracking started successfully",
        data: ride,
      });
    } catch (error: any) {
      console.error("[RideController] Error starting tracking:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async updateRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { passengerId, action, currentPosition } = req.body;
      const driverId = req.user?.userId; // Use authenticated user ID instead of headers

      console.log(`[RideController] Received updateRide request: id=${id}, passengerId=${passengerId}, action=${action}, driverId=${driverId}, currentPosition=${currentPosition}`);

      if (!id || !passengerId || !action || !driverId) {
        console.error(`[RideController] Missing required fields: id=${id}, passengerId=${passengerId}, action=${action}, driverId=${driverId}`);
        res.status(400).json({ success: false, message: "Missing required fields" });
        return;
      }

      if (action !== "picked" && action !== "dropped") {
        console.error(`[RideController] Invalid action: ${action}`);
        res.status(400).json({ success: false, message: "Invalid action" });
        return;
      }

      // Verify driverId matches the ride's driver
      const ride = await this.rideService.findById(id);
      if (!ride) {
        console.error(`[RideController] Ride not found for id: ${id}`);
        res.status(404).json({ success: false, message: "Ride not found" });
        return;
      }
      if (ride.driverId !== driverId) {
        console.error(`[RideController] Unauthorized: driverId ${driverId} does not match ride.driverId ${ride.driverId}`);
        res.status(403).json({ success: false, message: "Unauthorized" });
        return;
      }

      // Include currentPosition in updates if provided
      const updates = {
        passengerId,
        action,
        ...(currentPosition && { currentPosition }), // Conditionally include currentPosition
      };

      const updatedRide = await this.rideService.updateRide(id, updates, driverId);
      res.status(200).json({
        success: true,
        message: "Ride updated successfully",
        data: updatedRide,
      });
    } catch (error: any) {
      console.error(`[RideController] Error updating ride: ${error.message}`);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async handleJoinRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { rideId, passengerId } = req.params;
    const { action } = req.body;
    const driverId = req.user?.userId;

    if (!driverId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!["accept", "reject"].includes(action)) {
      res.status(400).json({ success: false, message: "Invalid action" });
      return;
    }

    try {
      await this.rideService.handleJoinRequest(rideId, driverId, passengerId, action as "accept" | "reject");
      res.status(200).json({ success: true, message: `${action === "accept" ? "Accepted" : "Rejected"} join request successfully` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}