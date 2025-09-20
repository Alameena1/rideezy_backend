import { z } from 'zod';

/**
 * DTO for subscribing to a plan request
 * @property {string} userId - ID of the user subscribing to the plan
 * @property {string} planId - ID of the subscription plan
 */
export const SubscribeRequestDto = z.object({
  userId: z.string().min(1, 'User ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
});

/**
 * DTO for creating payment order request
 * @property {string} planId - ID of the subscription plan for payment
 */
export const CreateOrderRequestDto = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

/**
 * DTO for verifying payment and subscribing request
 * @property {string} userId - ID of the user
 * @property {string} planId - ID of the subscription plan
 * @property {string} paymentId - Payment ID from payment gateway
 * @property {string} orderId - Order ID from payment gateway
 * @property {string} signature - Payment verification signature
 */
export const VerifySubscribeRequestDto = z.object({
  userId: z.string().min(1, 'User ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  signature: z.string().min(1, 'Signature is required'),
});

/**
 * DTO for wallet subscription request
 * @property {string} userId - ID of the user
 * @property {string} planId - ID of the subscription plan
 */
export const WalletSubscribeRequestDto = z.object({
  userId: z.string().min(1, 'User ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
});

// Infer TypeScript types from Zod schemas
export type SubscribeRequest = z.infer<typeof SubscribeRequestDto>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestDto>;
export type VerifySubscribeRequest = z.infer<typeof VerifySubscribeRequestDto>;
export type WalletSubscribeRequest = z.infer<typeof WalletSubscribeRequestDto>;