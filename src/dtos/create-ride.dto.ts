import { z } from 'zod';

export const CreateRideSchema = z.object({
  driverId: z.string().min(1, 'driverId is required').optional(),
  vehicleId: z.string().min(1, 'vehicleId is required'),
  date: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(val);
    },
    { message: 'date must be a valid ISO string (YYYY-MM-DD)' }
  ),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be in HH:mm format'),
  startPoint: z.string().refine(
    (val) => {
      const [lat, lng] = val.split(',').map(Number);
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    },
    { message: 'startPoint must be valid coordinates (lat,lng)' }
  ),
  endPoint: z.string().refine(
    (val) => {
      const [lat, lng] = val.split(',').map(Number);
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    },
    { message: 'endPoint must be valid coordinates (lat,lng)' }
  ),
  passengerCount: z.number().int().min(0, 'passengerCount must be at least 0').max(4, 'passengerCount must not exceed 4'),
  fuelPrice: z.number().min(0, 'fuelPrice must be a positive number'),
  distanceKm: z.number().min(0, 'distance must be a positive number'),
  totalFuelCost: z.number().min(0, 'totalFuelCost must be a positive number'),
  costPerPerson: z.number().min(0, 'costPerPerson must be a positive number'),
  routeGeometry: z.string().refine(
  (val) => {
    try {
      const parsed = JSON.parse(val);
      return parsed.type === 'LineString' && Array.isArray(parsed.coordinates);
    } catch {
      return false;
    }
  },
  { message: 'routeGeometry must be a valid GeoJSON LineString' }
),
});

export type CreateRideDto = z.infer<typeof CreateRideSchema>;