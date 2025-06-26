import { z } from "zod";

export interface CreateRideDto {
  endPlaceName: string;
  startPlaceName: string;
  date: string;
  time: string;
  startPoint: string;
  endPoint: string;
  passengerCount: number;
  fuelPrice: number;
  vehicleId: string;
  driverId?: string;
  distance: number;
  routeGeometry?: string;
  platformFee?: number;
  totalFuelCost?: number; // Optional, calculated in service
  totalRideCost?: number; // Optional, calculated in service
  costPerPerson?: number; // Optional, calculated in service
}

export const CreateRideSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid datetime",
    path: ["date"],
  }),
  time: z.string(),
  startPoint: z.string(),
  endPoint: z.string(),
  passengerCount: z.number().min(0),
  fuelPrice: z.number().min(0),
  vehicleId: z.string(),
  driverId: z.string().optional(),
  distance: z.number().min(0),
  routeGeometry: z.string().optional(),
  platformFee: z.number().min(0).optional(),
  totalFuelCost: z.number().min(0).optional(), // Optional, validated if present
  totalRideCost: z.number().min(0).optional(), // Optional, validated if present
  costPerPerson: z.number().min(0).optional(), // Optional, validated if present
}).refine((data) => {
  // Optional refine for consistency if these fields are provided
  if (data.totalRideCost && data.totalFuelCost && data.platformFee) {
    const expectedTotal = data.totalFuelCost + (data.platformFee || 0);
    if (data.totalRideCost !== expectedTotal) {
      return false;
    }
  }
  if (data.costPerPerson && data.totalRideCost && data.passengerCount !== undefined) {
    const totalPeople = data.passengerCount + 1;
    const expectedCostPerPerson = data.totalRideCost / totalPeople;
    if (Math.abs(data.costPerPerson - expectedCostPerPerson) > 0.01) { // Allow small rounding differences
      return false;
    }
  }
  return true;
}, {
  message: "Total ride cost and cost per person must be consistent with fuel cost and platform fee",
  path: ["totalRideCost", "costPerPerson"],
});