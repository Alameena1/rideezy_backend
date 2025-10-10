import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IUserService } from "../../services/interfaces/user/iuserService";
import { IUserController } from "../interface/user/interface";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";
import { updateProfileRequestSchema } from "../../dtos/updateProfileRequest.dto";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

@injectable()
export class UserController implements IUserController {
  private _userService: IUserService;

  constructor(@inject(TYPES.IUserService) userService: IUserService) {
    this._userService = userService;
  }

  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }
      const user = await this._userService.getProfile(userId);
      res.status(StatusCode.OK).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    const updatedData = req.body;
    
    if (!userId) {
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
      return;
    }

    // Validate with Zod DTO - allow partial updates
    const validationResult = updateProfileRequestSchema.safeParse(updatedData);
    if (!validationResult.success) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.issues,
      });
      return;
    }

    // Only update fields that are provided
    const updatePayload: any = {};
    if (updatedData.fullName !== undefined) updatePayload.fullName = updatedData.fullName;
    if (updatedData.email !== undefined) updatePayload.email = updatedData.email;
    if (updatedData.phoneNumber !== undefined) updatePayload.phoneNumber = updatedData.phoneNumber;
    if (updatedData.gender !== undefined) updatePayload.gender = updatedData.gender;
    if (updatedData.country !== undefined) updatePayload.country = updatedData.country;
    if (updatedData.state !== undefined) updatePayload.state = updatedData.state;
    if (updatedData.govId !== undefined) updatePayload.govId = updatedData.govId;

    const updatedUser = await this._userService.updateProfile(userId, updatePayload);
    res.status(StatusCode.OK).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

  async submitGovId(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    const govIdData = req.body; // Changed from req.body.govId
        console.log("popopopopopooopopopopopopop",govIdData)

    if (!userId) {
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
      return;
    }
    console.log("popopopopopooopopopopopopop")

    // Validate govId data structure
    if (!govIdData || !govIdData.idNumber || !govIdData.documentUrl) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "Government ID data is required",
      });
      return;
    }

    // Ensure verificationStatus is set to Pending
    const updateData = {
      govId: {
        ...govIdData,
        verificationStatus: "Pending",
        reason: govIdData.reason || ""
      }
    };

    const updatedUser = await this._userService.updateProfile(userId, updateData);
    res.status(StatusCode.OK).json({
      success: true,
      message: "Government ID submitted successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}
}