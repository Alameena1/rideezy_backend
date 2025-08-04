import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { ITrackingController } from "../interface/tracking/itrackingController";
import { ITrackingService } from "../../services/interfaces/tracking/itrackingService";
import { IRideService } from "../../services/interfaces/ride/irideService";
import { AuthenticatedRequest } from "../../types/express";

@injectable()
export class TrackingController implements ITrackingController {
  private trackingService: ITrackingService;
  private rideService: IRideService;

  constructor(
    @inject(TYPES.ITrackingService) trackingService: ITrackingService,
    @inject(TYPES.IRideService) rideService: IRideService
  ) {
    this.trackingService = trackingService;
    this.rideService = rideService;
  }

  async startTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rideId } = req.params;
      const driverId = req.user?.userId;

      if (!rideId || !driverId) {
        res.status(400).json({ success: false, message: "Ride ID and driver ID are required" });
        return;
      }

      const ride = await this.rideService.findById(rideId);
      if (!ride) {
        res.status(404).json({ success: false, message: "Ride not found" });
        return;
      }
      if (ride.driverId !== driverId) {
        res.status(403).json({ success: false, message: "Unauthorized" });
        return;
      }

      const initialPosition = req.body.initialPosition as [number, number] | undefined;
      if (!initialPosition) {
        res.status(400).json({ success: false, message: "Initial position is required" });
        return;
      }

      const tracking = await this.trackingService.startTracking(rideId, driverId, initialPosition);
      
      // Update ride status to "Started"
      await this.rideService.updateRide(ride.rideId || ride._id.toString(), { status: "Started" }, ride.driverId);

      res.status(200).json({
        success: true,
        message: "Tracking started successfully",
        data: tracking,
      });
    } catch (error: any) {
      console.error("[TrackingController] Error starting tracking:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async updateTrackingPosition(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { rideId } = req.params; // MongoDB _id
      if (!rideId) {
        res.status(400).json({ success: false, message: "Ride ID is required" });
        return;
      }

      const ride = await this.rideService.findById(rideId);
      if (!ride) {
        res.status(404).json({ success: false, message: "Ride not found" });
        return;
      }

      if (ride.driverId !== userId) {
        res.status(403).json({ success: false, message: "Unauthorized: User is not the driver" });
        return;
      }

      const { position } = req.body;
      if (!position || !Array.isArray(position) || position.length !== 2 || position.some(isNaN)) {
        res.status(400).json({ success: false, message: "Invalid position data" });
        return;
      }

      await this.trackingService.updateTrackingPosition(rideId, position as [number, number]);
      res.status(200).json({ success: true, message: "Tracking position updated successfully" });
    } catch (error: any) {
      console.error("[TrackingController] Error updating tracking position:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getTrackingPosition(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rideId } = req.params; // MongoDB _id
      if (!rideId) {
        res.status(400).json({ success: false, message: "Ride ID is required" });
        return;
      }

      const ride = await this.rideService.findById(rideId);
      if (!ride) {
        res.status(404).json({ success: false, message: "Ride not found" });
        return;
      }

      const position = await this.trackingService.getTrackingPosition(rideId);
      res.status(200).json({ success: true, data: position });
    } catch (error: any) {
      console.error("[TrackingController] Error fetching tracking position:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

 async stopTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rideId } = req.params;
      const driverId = req.user?.userId;

      if (!rideId || !driverId) {
        res.status(400).json({ success: false, message: "Ride ID and driver ID are required" });
        return;
      }

      const ride = await this.rideService.findById(rideId);
      if (!ride) {
        res.status(404).json({ success: false, message: "Ride not found" });
        return;
      }
      if (ride.driverId !== driverId) {
        res.status(403).json({ success: false, message: "Unauthorized" });
        return;
      }

      await this.trackingService.stopTracking(rideId);
      
      // Update ride status to "Completed"
      await this.rideService.updateRide(ride._id.toString(), { status: "Completed" }, ride.driverId);

      res.status(200).json({
        success: true,
        message: "Tracking stopped successfully",
      });
    } catch (error: any) {
      console.error("[TrackingController] Error stopping tracking:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getTrackingStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      console.log("[TrackingController] User ID from token:", userId);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { rideId } = req.params; // MongoDB _id
      console.log("[TrackingController] Received rideId for status:", rideId);

      const ride = await this.rideService.findById(rideId);
      if (!ride) {
        res.status(404).json({ success: false, message: "Ride not found" });
        return;
      }

      const tracking = await this.trackingService.getTrackingStatus(rideId);

      res.status(200).json({
        success: true,
        message: "Tracking status retrieved successfully",
        data: tracking,
      });
    } catch (error: any) {
      console.error("[TrackingController] Error fetching tracking status:", error);
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }
}