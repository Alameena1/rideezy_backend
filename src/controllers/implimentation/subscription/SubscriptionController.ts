import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../../di/types";
import { ISubscriptionService } from "../../../services/interfaces/subscription/isubscriptionService";
import { ISubscriptionController } from "./isubscriptionController";
import { StatusCode } from "../../../constants/status-codes.enum";
import { ResponseMessages } from "../../../constants/response-messages.const";
import {
  SubscribeRequestDto,
  CreateOrderRequestDto,
  VerifySubscribeRequestDto,
  WalletSubscribeRequestDto,
} from "./request.dto";
import {
  PlansResponseDto,
  SubscriptionStatusResponseDto,
  OrderResponseDto,
  SubscribeResponseDto,
} from "./reponse.dto";
import { z } from "zod";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

@injectable()
export class SubscriptionController implements ISubscriptionController {
  private _subscriptionService: ISubscriptionService;

  constructor(
    @inject(TYPES.ISubscriptionService) subscriptionService: ISubscriptionService
  ) {
    this._subscriptionService = subscriptionService;
  }

  /**
   * Get all subscription plans
   * Validates response using PlansResponseDto
   */
  async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = await this._subscriptionService.getAllPlans();
      // Validate response against DTO
      const response = PlansResponseDto.parse({
        success: true,
        data: plans,
      });
      res.status(StatusCode.OK).json(response);
    } catch (error: any) {
      console.error("[SubscriptionController] Error fetching plans:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
        success: false, 
        message: error.message || "Failed to fetch plans" 
      });
    }
  }

  /**
   * Subscribe user to a plan
   * Validates request using SubscribeRequestDto and response using SubscribeResponseDto
   */
  async subscribe(req: Request, res: Response): Promise<void> {
    try {
      // Validate request against DTO
      const validatedRequest = SubscribeRequestDto.parse(req.body);
      const { userId, planId } = validatedRequest;

      const user = await this._subscriptionService.subscribeUser(userId, planId);
      
      // Validate response against DTO
      const response = SubscribeResponseDto.parse({
        success: true,
        message: "Subscribed successfully",
        user,
      });
      
      res.status(StatusCode.OK).json(response);
    } catch (error: any) {
      console.error("[SubscriptionController] Error subscribing:", error);
      
      if (error instanceof z.ZodError) {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      } else {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: error.message 
        });
      }
    }
  }

  /**
   * Subscribe using wallet balance
   * Validates request using WalletSubscribeRequestDto
   */
  async subscribeWithWallet(req: Request, res: Response): Promise<void> {
    try {
      // Validate request against DTO
      const validatedRequest = WalletSubscribeRequestDto.parse(req.body);
      const { userId, planId } = validatedRequest;

      const user = await this._subscriptionService.verifyAndSubscribe(userId, planId, "", "", "");
      
      // Validate response against DTO
      const response = SubscribeResponseDto.parse({
        success: true,
        message: "Subscribed successfully using wallet",
        user,
      });
      
      res.status(StatusCode.OK).json(response);
    } catch (error: any) {
      console.error("[SubscriptionController] Error subscribing with wallet:", error);
      
      if (error instanceof z.ZodError) {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      } else {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: error.message 
        });
      }
    }
  }

  /**
   * Check user subscription status
   * Validates response using SubscriptionStatusResponseDto
   */
  async checkSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: ResponseMessages.MISSING_FIELDS 
        });
        return;
      }

      const result = await this._subscriptionService.isSubscribed(userId);
      
      // Validate response against DTO
      const response = SubscriptionStatusResponseDto.parse({
        success: true,
        ...result,
      });
      
      res.status(StatusCode.OK).json(response);
    } catch (error: any) {
      console.error("[SubscriptionController] Error in checkSubscription:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
        success: false, 
        message: error.message || "Failed to check subscription" 
      });
    }
  }

  /**
   * Create payment order
   * Validates request using CreateOrderRequestDto and response using OrderResponseDto
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      // Validate request against DTO
      const validatedRequest = CreateOrderRequestDto.parse(req.body);
      const { planId } = validatedRequest;

      const order = await this._subscriptionService.createPaymentOrder(planId);
      
      // Validate response against DTO
      const response = OrderResponseDto.parse({
        success: true,
        order,
      });
      
      res.status(StatusCode.OK).json(response);
    } catch (error: any) {
      console.error("[SubscriptionController] Error in createOrder:", error);
      
      if (error instanceof z.ZodError) {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      } else {
        const errorMessage = error.message || (error.error && error.error.description) || "Internal Server Error";
        const isClientError =
          errorMessage.includes("plan not found") ||
          errorMessage.includes("status") ||
          errorMessage.includes("Amount must be") ||
          errorMessage.includes("receipt");
        
        res.status(isClientError ? StatusCode.BAD_REQUEST : StatusCode.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }

  /**
   * Verify payment and subscribe user
   * Validates request using VerifySubscribeRequestDto
   */
  async verifyAndSubscribe(req: Request, res: Response): Promise<void> {
    try {
      // Validate request against DTO
      const validatedRequest = VerifySubscribeRequestDto.parse(req.body);
      const { userId, planId, paymentId, orderId, signature } = validatedRequest;

      const result = await this._subscriptionService.verifyAndSubscribe(
        userId, planId, paymentId, orderId, signature
      );
      
      // Validate response against DTO
      const response = SubscribeResponseDto.parse({
        success: true,
        message: "Payment verified and subscription activated",
        user: result,
      });
      
      res.status(StatusCode.OK).json(response);
    } catch (error: any) {
      console.error("[SubscriptionController] Error in verifyAndSubscribe:", error);
      
      if (error instanceof z.ZodError) {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      } else {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: error.message 
        });
      }
    }
  }

  /**
   * Get subscription status for authenticated user
   * Validates response using SubscriptionStatusResponseDto
   */
  async getSubscriptionStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ 
          success: false, 
          message: ResponseMessages.UNAUTHORIZED 
        });
        return;
      }

      const result = await this._subscriptionService.isSubscribed(userId);
      
      // Validate response against DTO
      const response = SubscriptionStatusResponseDto.parse({
        success: true,
        isSubscribed: result.isSubscribed,
      });
      
      res.status(StatusCode.OK).json(response);
    } catch (error: any) {
      console.error(`[SubscriptionController] Error fetching subscription status: ${error.message}`);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
        success: false, 
        message: "Failed to fetch subscription status" 
      });
      next(error);
    }
  }
}