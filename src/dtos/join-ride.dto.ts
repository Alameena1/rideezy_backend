import { z } from 'zod';

export const JoinRideSchema = z.object({
  rideId: z.string().min(1, 'Ride ID is required'),
  pickupLocation: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'pickupLocation must be in the format "lat,lng"'),
});

export type JoinRideDto = z.infer<typeof JoinRideSchema>;