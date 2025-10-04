import { z } from "zod";

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
});

// Explicit type that matches service expectations
export type UserSearchQueryDtoType = z.infer<typeof UserSearchQueryDto>;

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

export type VehicleSearchQueryDtoType = z.infer<typeof VehicleSearchQueryDto>;

// Ride Management DTOs
export const RideStatusDto = z.object({
  rideId: z.string().min(1, "Ride ID is required"),
  status: z.enum(["Active", "Blocked", "Cancelled"]),
});

export const RideSearchQueryDto = PaginationQueryDto.extend({
  status: z.enum(["Active", "Completed", "Cancelled", "Blocked"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type RideSearchQueryDtoType = z.infer<typeof RideSearchQueryDto>;

// Emergency Stop DTO
export const EmergencyStopSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
  currentPosition: z.tuple([z.number(), z.number()]),
});


// Dashboard DTOs
export const DashboardMetricsQueryDto = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type DashboardMetricsQueryDtoType = {
  startDate?: string;
  endDate?: string;
};

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

// Response DTOs for entities
export const UserResponseDto = z.object({
  _id: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  status: z.enum(["Active", "Blocked"]),
  subscription: z.object({
    isSubscribed: z.boolean(),
    planId: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }).optional(),
  govId: z.object({
    verificationStatus: z.enum(["Pending", "Verified", "Rejected"]),
    reason: z.string().optional(),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const VehicleResponseDto = z.object({
  _id: z.string(),
  user: z.object({
    _id: z.string(),
    fullName: z.string(),
  }),
  vehicleType: z.string(),
  licensePlate: z.string(),
  status: z.enum(["Pending", "Approved", "Rejected"]),
  note: z.string().optional(),
  createdAt: z.date(),
});

export const RideResponseDto = z.object({
  _id: z.string(),
  driver: z.object({
    _id: z.string(),
    fullName: z.string(),
  }),
  passengers: z.array(z.object({
    user: z.string(),
    status: z.string(),
  })),
  from: z.string(),
  to: z.string(),
  date: z.date(),
  status: z.enum(["Active", "Completed", "Cancelled", "Blocked"]),
  fare: z.number(),
  createdAt: z.date(),
});

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
  createdAt: z.date(),
  updatedAt: z.date(),
});

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

// Export types for all DTOs - REMOVE DUPLICATES
export type UserStatusDtoType = z.infer<typeof UserStatusDto>;
export type VehicleStatusDtoType = z.infer<typeof VehicleStatusDto>;
export type RideStatusDtoType = z.infer<typeof RideStatusDto>;
export type EmergencyStopDtoType = z.infer<typeof EmergencyStopSchema>; // KEEP ONLY ONE
export type AdminLoginDtoType = z.infer<typeof AdminLoginDto>;
export type RefreshTokenDtoType = z.infer<typeof RefreshTokenDto>;
export type LogoutDtoType = z.infer<typeof LogoutDto>;
export type GovIdVerificationDtoType = z.infer<typeof GovIdVerificationDto>;
export type CreateSubscriptionPlanDtoType = z.infer<typeof CreateSubscriptionPlanDto>;
export type UpdateSubscriptionPlanDtoType = z.infer<typeof UpdateSubscriptionPlanDto>;
export type SubscriptionPlanStatusDtoType = z.infer<typeof SubscriptionPlanStatusDto>;
export type UserResponseDtoType = z.infer<typeof UserResponseDto>;
export type VehicleResponseDtoType = z.infer<typeof VehicleResponseDto>;
export type RideResponseDtoType = z.infer<typeof RideResponseDto>;
export type SubscriptionPlanResponseDtoType = z.infer<typeof SubscriptionPlanResponseDto>;