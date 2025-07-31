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
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { rideId } = req.params; // MongoDB _id (e.g., 686fad459a92e92788360517)
      const { initialPosition } = req.body;

      const ride = await this.rideService.findById(rideId);
      if (!ride) {
        res.status(404).json({ success: false, message: "Ride not found" });
        return;
      }

      // Validate driver
      if (ride.driverId !== userId) {
        res.status(403).json({ success: false, message: "Unauthorized: User is not the driver" });
        return;
      }

      // Validate ride status
      if (ride.status !== "Pending") {
        res.status(400).json({ success: false, message: "Only Pending rides can be started" });
        return;
      }

      // Validate ride time
      const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
      if (new Date() < rideDateTime) {
        res.status(400).json({ success: false, message: "Ride cannot be started before scheduled time" });
        return;
      }

      const tracking = await this.trackingService.startTracking(rideId, userId, initialPosition);

      // Update the ride status to "Started"
      await this.rideService.updateRide(ride.rideId, { status: "Started" });

      res.status(201).json({
        success: true,
        message: "Tracking started successfully",
        data: tracking,
      });
    } catch (error: any) {
      console.error("[TrackingController] Error starting tracking:", error);
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
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

    await this.trackingService.stopTracking(rideId);
    await this.rideService.updateRide(ride._id.toString(), { status: "Completed" }); // Use ride._id instead of ride.rideId
    res.status(200).json({ success: true, message: "Tracking stopped successfully" });
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