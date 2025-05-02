import { z } from 'zod';

export const CreateRideSchema = z.object({
  driverId: z.string().min(1, 'driverId is required').optional(),
  vehicleId: z.string().min(1, 'vehicleId is required'),
  date: z.string().min(10, 'date is required and must be a valid ISO string'),
  time: z.string().min(1, 'time is required'),
  startPoint: z.string().min(1, 'startPoint is required'),
  endPoint: z.string().min(1, 'endPoint is required'),
  passengerCount: z.number().int().min(1, 'passengerCount must be at least 1').max(4, 'passengerCount must not exceed 4'),
  fuelPrice: z.number().min(0, 'fuelPrice must be a positive number'),
  distance: z.number().min(0, 'distance must be a positive number'),
  fuelCost: z.number().min(0, 'fuelCost must be a positive number'),
  costPerPerson: z.number().min(0, 'costPerPerson must be a positive number'),
  routeGeometry: z.string().min(1, 'routeGeometry is required'),
});

export type CreateRideDto = z.infer<typeof CreateRideSchema>;  