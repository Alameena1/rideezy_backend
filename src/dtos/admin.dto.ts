import { z } from "zod";

// Helper to handle both string and Date types
const dateSchema = z.union([z.string(), z.date()]).transform((val) => {
  if (val instanceof Date) {
    return val.toISOString();
  }
  return val;
});

// Helper to handle ObjectId (both string and object)
const objectIdSchema = z.union([z.string(), z.object({ 
  toString: z.function().returns(z.string()) 
})]).transform((val) => {
  if (typeof val === 'object' && val !== null && 'toString' in val) {
    return val.toString();
  }
  return val;
});

// Base query parameters with proper transformation and required types
export const PaginationQueryDto = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().min(1))
    .default("1"),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().min(1).max(100))
    .default("10"),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z
    .enum(["asc", "desc"])
    .default("desc")
    .transform((val) => val as "asc" | "desc"),
});

// Explicit output types that match what your service expects
export type PaginationQueryDtoType = {
  page: number;
  limit: number;
  sortOrder: "asc" | "desc";
  search?: string;
  sortBy?: string;
};

// User Management DTOs
export const UserStatusDto = z.object({
  status: z.enum(["Active", "Blocked"]),
});

export const UserSearchQueryDto = PaginationQueryDto.extend({
  status: z.enum(["Active", "Blocked"]).optional(),
  subscriptionStatus: z.enum(["subscribed", "non-subscribed"]).optional(),
  govIdStatus: z.enum(["Pending", "Verified", "Rejected"]).optional(),
});

// User Response DTO - UPDATED with proper planId handling
export const UserResponseDto = z.object({
  _id: z.string(),
  fullName: z.string(),
  email: z.string(),
  phoneNumber: z.string().optional(),
  status: z.enum(["Active", "Blocked"]),
  govId: z.object({
    verificationStatus: z.enum(["Pending", "Verified", "Rejected"]),
    reason: z.string().optional(),
    idNumber: z.string().optional(),
    documentUrl: z.string().optional(),
  }).optional(),
  subscription: z.object({
    isSubscribed: z.boolean(),
    planId: objectIdSchema.optional(),
    planName: z.string().optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    remainingJoinRides: z.number().optional(),
  }).optional(),
  wallet: z.object({
    balance: z.number(),
  }).optional(),
  totalRides: z.number().optional(),
  hasOngoingRides: z.boolean().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema.optional(),
});

// Explicit type that matches service expectations
export type UserSearchQueryDtoType = z.infer<typeof UserSearchQueryDto>;
export type UserResponseDtoType = z.infer<typeof UserResponseDto>;

// Vehicle Management DTOs
export const VehicleStatusDto = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  status: z.enum(["Approved", "Rejected"]),
  note: z.string().optional(),
});

export const VehicleSearchQueryDto = PaginationQueryDto.extend({
  status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
  vehicleType: z.string().optional(),
});

// Vehicle Response DTO - UPDATED with proper date handling
export const VehicleResponseDto = z.object({
  _id: z.string(),
  user: z.object({
    _id: z.string(),
    fullName: z.string(),
    email: z.string(),
  }),
  vehicleName: z.string(),
  vehicleType: z.string(),
  licensePlate: z.string(),
  color: z.string(),
  insurance: z.object({
    number: z.string(),
    image: z.string(),
    startDate: dateSchema,
    endDate: dateSchema,
    status: z.enum(["Active", "Expired", "Pending"]),
  }),
  pollution: z.object({
    number: z.string(),
    image: z.string(),
    startDate: dateSchema,
    endDate: dateSchema,
    status: z.enum(["Active", "Expired", "Pending"]),
  }),
  vehicleImage: z.string(),
  status: z.enum(["Pending", "Approved", "Rejected"]),
  note: z.string().optional(),
  mileage: z.number(),
  seatCapacity: z.number(),
  createdAt: dateSchema,
  updatedAt: dateSchema.optional(),
});

export type VehicleSearchQueryDtoType = z.infer<typeof VehicleSearchQueryDto>;
export type VehicleResponseDtoType = z.infer<typeof VehicleResponseDto>;

// Ride Management DTOs - UPDATED with both EmergencyStopped and Blocked
export const RideStatusDto = z.object({
  rideId: z.string().min(1, "Ride ID is required"),
  status: z.enum(["Pending", "Started", "Completed", "Cancelled", "EmergencyStopped", "Blocked"]),
});

export const RideSearchQueryDto = PaginationQueryDto.extend({
  status: z.enum(["Pending", "Started", "Completed", "Cancelled", "EmergencyStopped", "Blocked"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// Ride Response DTO - UPDATED with proper date handling
export const RideResponseDto = z.object({
  _id: z.string(),
  rideId: z.string(),
  driverId: z.string(),
  driverName: z.string(),
  vehicleId: z.string().or(z.object({
    _id: z.string(),
    licensePlate: z.string(),
  })),
  date: dateSchema,
  time: z.string(),
  startPoint: z.string(),
  startPlaceName: z.string(),
  endPoint: z.string(),
  endPlaceName: z.string(),
  distanceKm: z.number(),
  fuelPrice: z.number(),
  passengerCount: z.number(),
  totalFuelCost: z.number(),
  costPerPerson: z.number(),
  totalPeople: z.number(),
  status: z.enum(["Pending", "Started", "Completed", "Cancelled", "EmergencyStopped", "Blocked"]),
  platformFee: z.number().optional(),
  passengers: z.array(z.object({
    passengerId: z.string(),
    passengerName: z.string(),
    pickedUp: z.boolean().optional(),
    droppedOff: z.boolean().optional(),
  })),
  pickupPoints: z.array(z.object({
    passengerId: z.string(),
    location: z.string(),
    placeName: z.string(),
  })),
  dropoffPoints: z.array(z.object({
    passengerId: z.string(),
    location: z.string(),
    placeName: z.string(),
  })),
  routeGeometry: z.string().optional(),
  blockDetails: z.object({
    reason: z.string(),
    blockType: z.string(),
    duration: z.string(),
    blockedAt: dateSchema,
    blockedBy: z.string(),
  }).optional(),
  createdAt: dateSchema,
});

export type RideSearchQueryDtoType = z.infer<typeof RideSearchQueryDto>;
export type RideResponseDtoType = z.infer<typeof RideResponseDto>;

// Block Ride DTO (for admins)
export const BlockRideSchema = z.object({
  reason: z.string().min(1, "Block reason is required"),
  blockType: z.enum(["safety_concern", "policy_violation", "suspicious_activity", "other"]),
  duration: z.enum(["temporary", "permanent"]).optional().default("temporary"),
});

// Unblock Ride DTO
export const UnblockRideSchema = z.object({
  reason: z.string().optional().default("Ride unblocked by admin"),
});

// Dashboard DTOs
export const DashboardMetricsQueryDto = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timeRange: z.enum(["7days", "30days", "90days", "1year", "all"]).optional(),
});

export type DashboardMetricsQueryDtoType = z.infer<typeof DashboardMetricsQueryDto>;

// Auth DTOs
export const AdminLoginDto = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const LogoutDto = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Government ID Verification DTOs
export const GovIdVerificationDto = z.object({
  userId: z.string().min(1, "User ID is required"),
  status: z.enum(["Verified", "Rejected"]),
  rejectionNote: z.string().optional(),
});

// Subscription Plan DTOs
export const CreateSubscriptionPlanDto = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price cannot be negative"),
  durationMonths: z.number().min(1, "Duration must be at least 1 month").max(120, "Duration cannot exceed 120 months"),
  maxStartingRides: z.number().min(0, "Max starting rides cannot be negative").max(1000, "Cannot exceed 1000"),
  maxJoiningRides: z.number().min(0, "Max joining rides cannot be negative").max(1000, "Cannot exceed 1000"),
  features: z.array(z.string()).optional(),
});

export const UpdateSubscriptionPlanDto = CreateSubscriptionPlanDto.partial();

export const SubscriptionPlanStatusDto = z.object({
  status: z.enum(["Active", "Blocked"]),
});

// Subscription Plan Response DTO - UPDATED with proper date handling
export const SubscriptionPlanResponseDto = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  durationMonths: z.number(),
  maxStartingRides: z.number(),
  maxJoiningRides: z.number(),
  features: z.array(z.string()),
  status: z.enum(["Active", "Blocked"]),
  isDeleted: z.boolean(),
  createdAt: dateSchema,
  updatedAt: dateSchema.optional(),
});

// Response DTOs for paginated responses
export const PaginatedResponseDto = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(dataSchema),
    pagination: z.object({
      currentPage: z.number(),
      totalPages: z.number(),
      totalItems: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });

export const EmergencyStopSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
  currentPosition: z.tuple([z.number(), z.number()]),
  issueType: z.enum(["breakdown", "puncture", "accident", "medical", "other"]),
});

// Dashboard Response DTO
export const DashboardMetricsResponseDto = z.object({
  success: z.boolean(),
  metrics: z.object({
    totalUsers: z.number(),
    subscribedUsers: z.number(),
    nonSubscribedUsers: z.number(),
    totalRides: z.number(),
    totalRevenue: z.number(),
    activeRides: z.number(),
    completedRides: z.number(),
    monthlyGrowth: z.number(),
  }),
  userGrowth: z.array(z.object({
    month: z.string(),
    users: z.number(),
    newUsers: z.number(),
  })),
  rideCount: z.array(z.object({
    month: z.string(),
    rides: z.number(),
    completed: z.number(),
    cancelled: z.number(),
  })),
  revenueDistribution: z.array(z.object({
    name: z.string(),
    value: z.number(),
    color: z.string(),
  })),
  platformRevenue: z.array(z.object({
    month: z.string(),
    revenue: z.number(),
    rides: z.number(),
  })),
});

// Ongoing Rides Response DTO
export const OngoingRidesResponseDto = z.object({
  success: z.boolean(),
  hasOngoingRides: z.boolean(),
  ongoingRides: z.array(z.object({
    _id: z.string(),
    rideId: z.string(),
    driverName: z.string(),
    startPlaceName: z.string(),
    endPlaceName: z.string(),
    status: z.string(),
    date: dateSchema,
    time: z.string(),
  })),
  message: z.string(),
  length: z.number(),
});

// Export types for all DTOs
export type UserStatusDtoType = z.infer<typeof UserStatusDto>;
export type VehicleStatusDtoType = z.infer<typeof VehicleStatusDto>;
export type RideStatusDtoType = z.infer<typeof RideStatusDto>;
export type BlockRideDtoType = z.infer<typeof BlockRideSchema>;
export type UnblockRideDtoType = z.infer<typeof UnblockRideSchema>;
export type AdminLoginDtoType = z.infer<typeof AdminLoginDto>;
export type RefreshTokenDtoType = z.infer<typeof RefreshTokenDto>;
export type LogoutDtoType = z.infer<typeof LogoutDto>;
export type GovIdVerificationDtoType = z.infer<typeof GovIdVerificationDto>;
export type CreateSubscriptionPlanDtoType = z.infer<typeof CreateSubscriptionPlanDto>;
export type UpdateSubscriptionPlanDtoType = z.infer<typeof UpdateSubscriptionPlanDto>;
export type SubscriptionPlanStatusDtoType = z.infer<typeof SubscriptionPlanStatusDto>;
export type SubscriptionPlanResponseDtoType = z.infer<typeof SubscriptionPlanResponseDto>;
export type EmergencyStopDtoType = z.infer<typeof EmergencyStopSchema>;
export type DashboardMetricsResponseDtoType = z.infer<typeof DashboardMetricsResponseDto>;
export type OngoingRidesResponseDtoType = z.infer<typeof OngoingRidesResponseDto>;