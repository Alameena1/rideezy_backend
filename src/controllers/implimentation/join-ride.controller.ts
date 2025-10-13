import { inject, injectable } from "inversify";
import { Response, NextFunction } from "express";
import { TYPES } from "../../di/types";
import { IJoinRideController } from "../interface/ride/ijoin-ride.controller";
import { IJoinRideService } from "../../services/interfaces/ride/ijoin-ride.service";
import { JoinRideDto, JoinRideSchema } from "../../dtos/join-ride.dto";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";
import { AuthenticatedRequest } from "../../types/express";
import logger from "../../config/logger";

@injectable()
export class JoinRideController implements IJoinRideController {
  constructor(
    @inject(TYPES.IJoinRideService) private _joinRideService: IJoinRideService
  ) {}

  async joinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      logger.debug(`Joining ride with userId: ${userId}`);

      if (!userId) {
        logger.warn(`Unauthorized access attempt for join ride`);
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const validationResult = JoinRideSchema.safeParse(req.body);
      if (!validationResult.success) {
        logger.warn(`Invalid join ride request from user ${userId}:`, { errors: validationResult.error.errors });
        res.status(StatusCode.BAD_REQUEST).json({ success: false, errors: validationResult.error.errors });
        return;
      }

      const dto: JoinRideDto = validationResult.data;
      const ride = await this._joinRideService.joinRide(dto.rideId, userId, dto.pickupLocation, dto.dropoffLocation);

      logger.info(`User ${userId} successfully joined ride ${dto.rideId}`);
      res.status(StatusCode.OK).json({
        success: true,
        message: "Joined ride successfully",
        data: ride
      });
    } catch (error) {
      logger.error(`Error in joinRide controller for user ${req.user?.userId}: ${(error as Error).message}`);
      next(error);
    }
  }

  async getJoinedRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        logger.warn(`Unauthorized access attempt for getJoinedRides`);
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      logger.debug(`Fetching joined rides for user: ${userId}`);
      const rides = await this._joinRideService.getJoinedRides(userId);
      
      logger.info(`Retrieved ${rides.length} joined rides for user ${userId}`);
      res.status(StatusCode.OK).json({ success: true, data: rides });
    } catch (error) {
      logger.error(`Error in getJoinedRides controller for user ${req.user?.userId}: ${(error as Error).message}`);
      next(error);
    }
  }

  async findNearestRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        logger.warn(`Unauthorized access attempt for findNearestRides`);
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { userLocation, destination } = req.body;
      if (!userLocation || !destination) {
        logger.warn(`Missing fields in findNearestRides request from user ${userId}`);
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      logger.debug(`Finding nearest rides for user ${userId} from ${userLocation} to ${destination}`);
      const rides = await this._joinRideService.findNearestRides(userLocation, destination);
      
      logger.info(`Found ${rides.length} nearest rides for user ${userId}`);
      res.status(StatusCode.OK).json({ success: true, data: rides });
    } catch (error) {
      logger.error(`Error in findNearestRides controller for user ${req.user?.userId}: ${(error as Error).message}`);
      next(error);
    }
  }

  async createRidePaymentOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        logger.warn(`Unauthorized access attempt for createRidePaymentOrder`);
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { rideId } = req.body;
      if (!rideId) {
        logger.warn(`Missing rideId in createRidePaymentOrder request from user ${userId}`);
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      logger.info(`Creating payment order for ride ${rideId} by user ${userId}`);
      const order = await this._joinRideService.createRidePaymentOrder(rideId, userId);
      
      logger.info(`Payment order created successfully for ride ${rideId} by user ${userId}`);
      res.status(StatusCode.OK).json({ success: true, order });
    } catch (error: any) {
      logger.error(`Error in createRidePaymentOrder for user ${req.user?.userId}: ${error.message}`);
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
        logger.warn(`Unauthorized access attempt for verifyAndJoinRide`);
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { rideId, pickupLocation, dropoffLocation, paymentId, orderId, signature } = req.body;
      if (!rideId || !pickupLocation || !dropoffLocation || !paymentId || !orderId || !signature) {
        logger.warn(`Missing fields in verifyAndJoinRide request from user ${userId}`);
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      logger.info(`Verifying and joining ride ${rideId} for user ${userId}`);
      const ride = await this._joinRideService.verifyAndJoinRide(
        rideId,
        userId,
        pickupLocation,
        dropoffLocation,
        paymentId,
        orderId,
        signature
      );
      
      logger.info(`Payment verified and ride joined successfully for user ${userId} on ride ${rideId}`);
      res.status(StatusCode.OK).json({ success: true, message: "Payment verified and joined ride successfully", data: ride });
    } catch (error: any) {
      logger.error(`Error in verifyAndJoinRide for user ${req.user?.userId}: ${error.message}`);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async cancelJoinedRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        logger.warn(`Unauthorized access attempt for cancelJoinedRide`);
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }
      
      const { rideId } = req.params;
      if (!rideId) {
        logger.warn(`Missing rideId in cancelJoinedRide request from user ${userId}`);
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      logger.info(`Cancelling joined ride ${rideId} for user ${userId}`);
      await this._joinRideService.cancelJoinedRide(rideId, userId);
      
      logger.info(`Ride cancellation processed successfully for user ${userId} on ride ${rideId}`);
      res.status(StatusCode.OK).json({ success: true, message: "Ride cancellation request processed successfully" });
    } catch (error: any) {
      logger.error(`Error cancelling joined ride ${req.params.rideId} for user ${req.user?.userId}: ${error.message}`);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async handleJoinRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { rideId, passengerId } = req.params;
    const { action } = req.body;
    const driverId = req.user?.userId;

    if (!driverId) {
      logger.warn(`Unauthorized access attempt for handleJoinRequest`);
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
      return;
    }
    
    if (!["accept", "reject"].includes(action)) {
      logger.warn(`Invalid action in handleJoinRequest from driver ${driverId}: ${action}`);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Invalid action" });
      return;
    }
    
    if (!rideId || !passengerId) {
      logger.warn(`Missing parameters in handleJoinRequest from driver ${driverId}`);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
      return;
    }

    try {
      logger.info(`Driver ${driverId} ${action}ing join request for passenger ${passengerId} on ride ${rideId}`);
      await this._joinRideService.handleJoinRequest(rideId, driverId, passengerId, action as "accept" | "reject");
      
      logger.info(`Join request ${action}ed successfully by driver ${driverId} for passenger ${passengerId}`);
      res.status(StatusCode.OK).json({ success: true, message: `${action === "accept" ? "Accepted" : "Rejected"} join request successfully` });
    } catch (error: any) {
      logger.error(`Error handling join request for ride ${rideId} by driver ${driverId}: ${error.message}`);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }
}