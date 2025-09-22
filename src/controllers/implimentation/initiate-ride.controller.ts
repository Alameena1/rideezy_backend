import { inject, injectable } from "inversify";
import { Response, NextFunction } from "express";
import { TYPES } from "../../di/types";
import { IInitiateRideController } from "../interface/ride/iinitiate-ride.controller";
import { IInitiateRideService } from "../../services/interfaces/ride/iinitiate-ride.service";
import { CreateRideDto, CreateRideSchema } from "../../dtos/create-ride.dto";
import { EditRideDto, EditRideSchema } from "../../dtos/edit-ride.dto";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";
import { AuthenticatedRequest } from "../../types/express";

@injectable()
export class InitiateRideController implements IInitiateRideController {
  constructor(
    @inject(TYPES.IInitiateRideService) private initiateRideService: IInitiateRideService
  ) {}

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

            // FIX: Use initiateRideService instead of rideService
            const ride = await this.initiateRideService.startRide(completeDto);
            
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
        const updatedRide = await this.initiateRideService.editRide(rideId, userId, dto);
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
  
        await this.initiateRideService.cancelRide(rideId, userId);
        res.status(StatusCode.OK).json({ success: true, message: "Ride cancelled successfully" });
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
  
        const rides = await this.initiateRideService.getRides(userId);
        res.status(StatusCode.OK).json({ success: true, data: rides });
      } catch (error) {
        next(error);
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
  
        const ride = await this.initiateRideService.startTracking(rideId, userId);
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

    // Get updates directly from req.body (not req.body.updates)
    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Updates are required" });
      return;
    }

    const updatedRide = await this.initiateRideService.updateRide(rideId, userId, updates);
    res.status(StatusCode.OK).json({ success: true, message: "Ride updated successfully", data: updatedRide });
  } catch (error) {
    console.error("[RideController] Error updating ride:", error);
    res.status(StatusCode.BAD_REQUEST).json({ success: false, message: (error as Error).message });
    next(error);
  }
}


}