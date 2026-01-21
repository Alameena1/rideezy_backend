import { z } from 'zod';
import { ISubscriptionPlan } from '../../../models/SubscriptionPlan';

/**
 * Base response DTO structure
 */
const BaseResponseDto = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

/**
 * DTO for subscription plans response
 * @property {ISubscriptionPlan[]} data 
 */
export const PlansResponseDto = BaseResponseDto.extend({
  data: z.array(z.any()), 
});

/**
 * DTO for subscription status response
 * @property {boolean} isSubscribed 
 * @property {object} subscription 
 */
export const SubscriptionStatusResponseDto = BaseResponseDto.extend({
  isSubscribed: z.boolean(),
  subscription: z.object({
    plan: z.object({
      _id: z.string(),
      name: z.string(),
      price: z.number(),
      durationMonths: z.number(),
      description: z.string(),
    }),
    originalPrice: z.number(),
    startDate: z.date(),
    endDate: z.date(),
  }).optional(),
});

/**
 * DTO for payment order response
 * @property {object} order 
 */
export const OrderResponseDto = BaseResponseDto.extend({
  order: z.object({
    id: z.string(),
    amount: z.number(),
    currency: z.string(),
  }),
});

/**
 * DTO for subscription response
 * @property {object} user -
 */
export const SubscribeResponseDto = BaseResponseDto.extend({
  user: z.any(), 
});


export type PlansResponse = z.infer<typeof PlansResponseDto>;
export type SubscriptionStatusResponse = z.infer<typeof SubscriptionStatusResponseDto>;
export type OrderResponse = z.infer<typeof OrderResponseDto>;
export type SubscribeResponse = z.infer<typeof SubscribeResponseDto>;