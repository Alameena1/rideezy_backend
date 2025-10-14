import * as z from "zod";

export const updateProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: z.any(),
});