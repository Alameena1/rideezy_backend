import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IRideController } from "../interface/ride/irideController";
import { IRideService } from "../../services/interfaces/ride/irideService";
import { CreateRideSchema, CreateRideDto } from "../../dtos/create-ride.dto";
import { JoinRideSchema, JoinRideDto } from "../../dtos/join-ride.dto";
import { EditRideSchema, EditRideDto } from "../../dtos/edit-ride.dto";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";

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
        res.status(StatusCode.BAD_REQUEST).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto = validationResult.data;
      if (dto.driverId && dto.driverId !== req.user?.userId) {
        res.status(StatusCode.FORBIDDEN).json({ success: false, message: "Driver ID does not match authenticated user" });
        return;
      }

      const completeDto: CreateRideDto = {
        ...dto,
        driverId: req.user?.userId!,
        totalFuelCost: undefined,
        totalRideCost: undefined,
        costPerPerson: undefined,
        endPlaceName: "",
        startPlaceName: ""
      };

      const ride = await this.rideService.startRide(completeDto);
      res.status(StatusCode.CREATED).json({
        success: true,
        message: "Ride started successfully",
        data: ride,
      });
    } catch (error: any) {
      console.error("[RideController] Error starting ride:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
      next(error);
    }
  }

  async joinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      console.log("Joining ride with userId:", userId);

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const validationResult = JoinRideSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto: JoinRideDto = validationResult.data;
      const ride = await this.rideService.joinRide(dto.rideId, userId, dto.pickupLocation, dto.dropoffLocation);

      res.status(StatusCode.OK).json({
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
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const rides = await this.rideService.getRides(userId);
      res.status(StatusCode.OK).json({ success: true, data: rides });
    } catch (error) {
      next(error);
    }
  }

  async getJoinedRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const rides = await this.rideService.getJoinedRides(userId);
      res.status(StatusCode.OK).json({ success: true, data: rides });
    } catch (error) {
      next(error);
    }
  }

  async findNearestRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { userLocation, destination } = req.body;
      if (!userLocation || !destination) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const rides = await this.rideService.findNearestRides(userLocation, destination);
      res.status(StatusCode.OK).json({ success: true, data: rides });
    } catch (error) {
      next(error);
    }
  }

  async createRidePaymentOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { rideId } = req.body;
      if (!rideId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const order = await this.rideService.createRidePaymentOrder(rideId, userId);
      res.status(StatusCode.OK).json({ success: true, order });
    } catch (error: any) {
      console.error("Error in createRidePaymentOrder:", error);
      const errorMessage = error.message || "Internal Server Error";
      const isClientError =
        errorMessage.includes("Ride not found") ||
        errorMessage.includes("Ride has already started") ||
        errorMessage.includes("Ride is full") ||
        errorMessage.includes("Amount must be");
      res.status(isClientError ? StatusCode.BAD_REQUEST : StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  async verifyAndJoinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { rideId, pickupLocation, dropoffLocation, paymentId, orderId, signature } = req.body;
      if (!rideId || !pickupLocation || !dropoffLocation || !paymentId || !orderId || !signature) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
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
      res.status(StatusCode.OK).json({ success: true, message: "Payment verified and joined ride successfully", data: ride });
    } catch (error: any) {
      console.error("Error in verifyAndJoinRide:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async editRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { rideId } = req.params;
      if (!rideId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const validationResult = EditRideSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto: EditRideDto = validationResult.data;
      const updatedRide = await this.rideService.editRide(rideId, userId, dto);
      console.log("edit ride controller updatedRide", updatedRide);

      res.status(StatusCode.OK).json({ success: true, message: "Ride updated successfully", data: updatedRide });
    } catch (error) {
      next(error);
    }
  }

  async cancelRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { rideId } = req.params;
      if (!rideId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      await this.rideService.cancelRide(rideId, userId);
      res.status(StatusCode.OK).json({ success: true, message: "Ride cancelled successfully" });
    } catch (error) {
      next(error);
    }
  }

  async cancelJoinedRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }
      const { rideId } = req.params;
      if (!rideId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      await this.rideService.cancelJoinedRide(rideId, userId);
      res.status(StatusCode.OK).json({ success: true, message: "Ride cancellation request processed successfully" });
    } catch (error: any) {
      console.error(`[RideController] Error cancelling joined ride ${req.params.rideId}: ${error.message}`);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async startTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { rideId } = req.params;
      if (!rideId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const ride = await this.rideService.startTracking(rideId, userId);
      res.status(StatusCode.OK).json({
        success: true,
        message: "Ride tracking started successfully",
        data: ride,
      });
    } catch (error: any) {
      console.error("[RideController] Error starting tracking:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async updateRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { passengerId, action, currentPosition } = req.body;
      const driverId = req.user?.userId;

      if (!id || !passengerId || !action || !driverId) {
        console.error(`[RideController] Missing required fields: id=${id}, passengerId=${passengerId}, action=${action}, driverId=${driverId}`);
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      if (action !== "picked" && action !== "dropped") {
        console.error(`[RideController] Invalid action: ${action}`);
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Invalid action" });
        return;
      }

      const ride = await this.rideService.findById(id);
      if (!ride) {
        console.error(`[RideController] Ride not found for id: ${id}`);
        res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Ride not found" });
        return;
      }
      if (ride.driverId !== driverId) {
        console.error(`[RideController] Unauthorized: driverId ${driverId} does not match ride.driverId ${ride.driverId}`);
        res.status(StatusCode.FORBIDDEN).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const updates = {
        passengerId,
        action,
        ...(currentPosition && { currentPosition }),
      };

      const updatedRide = await this.rideService.updateRide(id, updates, driverId);
      res.status(StatusCode.OK).json({
        success: true,
        message: "Ride updated successfully",
        data: updatedRide,
      });
    } catch (error: any) {
      console.error(`[RideController] Error updating ride: ${error.message}`);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async handleJoinRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { rideId, passengerId } = req.params;
    const { action } = req.body;
    const driverId = req.user?.userId;

    if (!driverId) {
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
      return;
    }
    if (!["accept", "reject"].includes(action)) {
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Invalid action" });
      return;
    }
    if (!rideId || !passengerId) {
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
      return;
    }

    try {
      await this.rideService.handleJoinRequest(rideId, driverId, passengerId, action as "accept" | "reject");
      res.status(StatusCode.OK).json({ success: true, message: `${action === "accept" ? "Accepted" : "Rejected"} join request successfully` });
    } catch (error: any) {
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }
}