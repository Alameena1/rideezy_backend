import { z } from 'zod';

export const WalletResponseDto = z.object({
  data: z.object({
    balance: z.number().nonnegative(),
    currency: z.string().default('INR'),
    transactions: z.array(
      z.object({
        id: z.string(),
        amount: z.number().nonnegative(),
        type: z.enum(['Credit', 'Debit']),
        date: z.string().datetime(),
      })
    ).default([]),
  }),
});

export const AddFundsRequestDto = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().default('INR'),
});

// Add Funds Response DTO
export const AddFundsResponseDto = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Export types for TypeScript
export type WalletResponse = z.infer<typeof WalletResponseDto>;
export type AddFundsRequest = z.infer<typeof AddFundsRequestDto>;
export type AddFundsResponse = z.infer<typeof AddFundsResponseDto>;