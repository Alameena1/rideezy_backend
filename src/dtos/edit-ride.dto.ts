import { z } from 'zod';

const rideStatus = z.enum(["Pending", "Started", "Completed", "Cancelled"]);

export const EditRideSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }).optional(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Time must be in HH:MM format (24-hour)",
  }).optional(),
  status: rideStatus.optional(),
}).refine((data) => {
  return data.date || data.time || data.status;
}, {
  message: "At least one of date, time, or status must be provided",
});

export type EditRideDto = z.infer<typeof EditRideSchema>;