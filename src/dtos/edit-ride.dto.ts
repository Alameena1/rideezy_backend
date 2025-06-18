import { z } from 'zod';

export const EditRideSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Time must be in HH:MM format (24-hour)",
  }),
});

export type EditRideDto = z.infer<typeof EditRideSchema>;