import { z } from 'zod';

export const JoinRideSchema = z.object({
  rideId: z.string().min(1, 'Ride ID is required'),
  pickupLocation: z.string().min(1, 'Pickup location is required').regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'Invalid coordinates format (lat,lng)'),
  dropoffLocation: z.string().min(1, 'Drop-off location is required').regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'Invalid coordinates format (lat,lng)'),
});

export type JoinRideDto = z.infer<typeof JoinRideSchema>;