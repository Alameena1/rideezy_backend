// src/types/dashboard.ts
export interface DashboardMetrics {
  metrics: {
    totalUsers: number;
    subscribedUsers: number;
    nonSubscribedUsers: number;
    totalRides: number;
    totalRevenue: number;
    activeRides: number;
    completedRides: number;
    monthlyGrowth: number;
  };
  userGrowth: { month: string; users: number; newUsers: number }[];
  rideCount: { month: string; rides: number; completed: number; cancelled: number }[];
  revenueDistribution: { name: string; value: number; color: string }[];
  platformRevenue: { month: string; revenue: number; rides: number }[];
}

export interface DashboardParams {
  startDate?: Date;
  endDate?: Date;
  timeRange?: "7days" | "30days" | "90days" | "1year" | "all";
}