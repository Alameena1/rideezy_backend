import { inject, injectable } from "inversify";
import { Response, NextFunction } from "express";
import { TYPES } from "../../di/types";
import { IJoinRideController } from "../interface/ride/ijoin-ride.controller";
import { IJoinRideService } from "../../services/interfaces/ride/ijoin-ride.service";
import { JoinRideDto, JoinRideSchema } from "../../dtos/join-ride.dto";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";
import { AuthenticatedRequest } from "../../types/express";

@injectable()
export class JoinRideController implements IJoinRideController {
  constructor(
    @inject(TYPES.IJoinRideService) private joinRideService: IJoinRideService
  ) {}

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
        const ride = await this.joinRideService.joinRide(dto.rideId, userId, dto.pickupLocation, dto.dropoffLocation);
  
        res.status(StatusCode.OK).json({
          success: true,
          message: "Joined ride successfully",
          data: ride
        });
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
  
        const rides = await this.joinRideService.getJoinedRides(userId);
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
  
        const rides = await this.joinRideService.findNearestRides(userLocation, destination);
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
  
        const order = await this.joinRideService.createRidePaymentOrder(rideId, userId);
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
  
        const ride = await this.joinRideService.verifyAndJoinRide(
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
 
       await this.joinRideService.cancelJoinedRide(rideId, userId);
       res.status(StatusCode.OK).json({ success: true, message: "Ride cancellation request processed successfully" });
     } catch (error: any) {
       console.error(`[RideController] Error cancelling joined ride ${req.params.rideId}: ${error.message}`);
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
        await this.joinRideService.handleJoinRequest(rideId, driverId, passengerId, action as "accept" | "reject");
        res.status(StatusCode.OK).json({ success: true, message: `${action === "accept" ? "Accepted" : "Rejected"} join request successfully` });
      } catch (error: any) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
      }
    }
}