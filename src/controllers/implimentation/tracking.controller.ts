import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { ITrackingController } from "../interface/tracking/itrackingController";
import { ITrackingService } from "../../services/interfaces/tracking/itrackingService";
import { IInitiateRideService } from "../../services/interfaces/ride/iinitiate-ride.service";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";
import { EditRideDto } from "../../dtos/edit-ride.dto";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

@injectable()
export class TrackingController implements ITrackingController {
  private _trackingService: ITrackingService;
  private _rideService: IInitiateRideService;

  constructor(
    @inject(TYPES.ITrackingService) trackingService: ITrackingService,
    @inject(TYPES.IInitiateRideService) rideService: IInitiateRideService
  ) {
    this._trackingService = trackingService;
    this._rideService = rideService;
  }

  async startTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rideId } = req.params;
      const driverId = req.user?.userId;

      if (!rideId || !driverId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const ride = await this._rideService.findById(rideId);
      if (!ride) {
        res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Ride not found" });
        return;
      }
      if (ride.driverId !== driverId) {
        res.status(StatusCode.FORBIDDEN).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const initialPosition = req.body.initialPosition as [number, number] | undefined;
      if (!initialPosition) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const tracking = await this._trackingService.startTracking(rideId, driverId, initialPosition);
      
      const editRideDto: EditRideDto = { status: "Started" };
      await this._rideService.editRide(ride.rideId || ride._id.toString(), driverId, editRideDto);

      res.status(StatusCode.OK).json({
        success: true,
        message: "Tracking started successfully",
        data: tracking,
      });
    } catch (error: any) {
      console.error("[TrackingController] Error starting tracking:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async updateTrackingPosition(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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

      const ride = await this._rideService.findById(rideId);
      if (!ride) {
        res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Ride not found" });
        return;
      }

      if (ride.driverId !== userId) {
        res.status(StatusCode.FORBIDDEN).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { position } = req.body;
      if (!position || !Array.isArray(position) || position.length !== 2 || position.some(isNaN)) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Invalid position data" });
        return;
      }

      await this._trackingService.updateTrackingPosition(rideId, position as [number, number]);
      res.status(StatusCode.OK).json({ success: true, message: "Tracking position updated successfully" });
    } catch (error: any) {
      console.error("[TrackingController] Error updating tracking position:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async getTrackingPosition(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rideId } = req.params;
      if (!rideId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const ride = await this._rideService.findById(rideId);
      if (!ride) {
        res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Ride not found" });
        return;
      }

      const position = await this._trackingService.getTrackingPosition(rideId);
      res.status(StatusCode.OK).json({ success: true, data: position });
    } catch (error: any) {
      console.error("[TrackingController] Error fetching tracking position:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async stopTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rideId } = req.params;
      const driverId = req.user?.userId;

      if (!rideId || !driverId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const ride = await this._rideService.findById(rideId);
      if (!ride) {
        res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Ride not found" });
        return;
      }
      if (ride.driverId !== driverId) {
        res.status(StatusCode.FORBIDDEN).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      await this._trackingService.stopTracking(rideId);
      
      const editRideDto: EditRideDto = { status: "Completed" };
      await this._rideService.editRide(ride._id.toString(), driverId, editRideDto);

      res.status(StatusCode.OK).json({
        success: true,
        message: "Tracking stopped successfully",
      });
    } catch (error: any) {
      console.error("[TrackingController] Error stopping tracking:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async getTrackingStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      console.log("[TrackingController] User ID from token:", userId);
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      const { rideId } = req.params;
      if (!rideId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const ride = await this._rideService.findById(rideId);
      if (!ride) {
        res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Ride not found" });
        return;
      }

      const tracking = await this._trackingService.getTrackingStatus(rideId);

      res.status(StatusCode.OK).json({
        success: true,
        message: "Tracking status retrieved successfully",
        data: tracking,
      });
    } catch (error: any) {
      console.error("[TrackingController] Error fetching tracking status:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }
}