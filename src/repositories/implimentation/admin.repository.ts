import { injectable } from "inversify";
import UserModel, { IUser } from "../../models/user.model";
import VehicleModel from "../../models/vehicle.modal";
import { IAdminRepository } from "../interface/admin/interface";
import { BaseRepository } from "../base/base.repository";
import { SubscriptionPlanModel, ISubscriptionPlan } from "../../models/SubscriptionPlan";
import { RideModel } from "../../models/ride.model";
import { PaginationQueryDtoType, RideSearchQueryDtoType } from "../../dtos/admin.dto";
import { DashboardMetrics, DashboardParams } from "../../types/dashboard";

@injectable()
export class AdminRepository extends BaseRepository<any> implements IAdminRepository {
  constructor() {
    super(UserModel);
  }

public async getAllUsers(params: PaginationQueryDtoType & { 
  status?: "Active" | "Blocked"; 
  subscriptionStatus?: "subscribed" | "non-subscribed";
  govIdStatus?: "Pending" | "Verified" | "Rejected"; 
}): Promise<{
  data: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  try {
    const { page, limit, search, sortBy, sortOrder, status, subscriptionStatus, govIdStatus } = params;
    const skip = (page - 1) * limit;

    const query: any = {};
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { 'govId.idNumber': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (subscriptionStatus) {
      const currentDate = new Date();
      if (subscriptionStatus === 'subscribed') {
        query['subscription.endDate'] = { $gt: currentDate };
      } else {
        query.$or = [
          { 'subscription.endDate': { $lt: currentDate } },
          { subscription: { $exists: false } },
          { subscription: null }
        ];
      }
    }

    if (govIdStatus) {
      query['govId.verificationStatus'] = govIdStatus;
      query['govId.idNumber'] = { $exists: true, $ne: "" };
    }

    const sortOptions: any = {};
    if (sortBy) {
      if (sortBy.includes('.')) {
        const [parent, child] = sortBy.split('.');
        sortOptions[`${parent}.${child}`] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      }
    } else {
      sortOptions.createdAt = -1;
    }

    const [rawData, totalItems] = await Promise.all([
      UserModel.find(query)
        .select("-password -wallet.transactions -monthlyRideCount -lastRideReset -vehicles -__v")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      UserModel.countDocuments(query)
    ]);

    const data = rawData.map(user => ({
  _id: user._id.toString(),
  fullName: user.fullName || "Unknown",
  email: user.email || "N/A",
  phoneNumber: user.phoneNumber || "N/A",
  status: user.status || "Active",
  govId: user.govId ? {
    verificationStatus: user.govId.verificationStatus || "Pending",
    reason: user.govId.reason || "",
    idNumber: user.govId.idNumber || "",
    documentUrl: user.govId.documentUrl || ""
  } : undefined,
  subscription: user.subscription ? {
    isSubscribed: new Date(user.subscription.endDate) > new Date(),
    planId: user.subscription.planId?.toString() || user.subscription.planId, 
    planName: user.subscription.planName,
    startDate: user.subscription.startDate,
    endDate: user.subscription.endDate,
    remainingJoinRides: user.subscription.remainingJoinRides || 0
  } : { isSubscribed: false },
  wallet: user.wallet ? {
    balance: user.wallet.balance || 0
  } : { balance: 0 },
  totalRides: 0,
  hasOngoingRides: false,
  createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt
}));

    const totalPages = Math.ceil(totalItems / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        hasNext,
        hasPrev,
      },
    };
  } catch (error) {
    throw new Error("Failed to fetch users from the database");
  }
}

  public async getAllVehicles(params: PaginationQueryDtoType & { 
    status?: "Pending" | "Approved" | "Rejected";
    vehicleType?: string;
  }): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const { page, limit, search, sortBy, sortOrder, status, vehicleType } = params;
      const skip = (page - 1) * limit;

      const query: any = {};
      
      if (search) {
        query.$or = [
          { licensePlate: { $regex: search, $options: 'i' } },
          { vehicleModel: { $regex: search, $options: 'i' } },
          { 'user.fullName': { $regex: search, $options: 'i' } }
        ];
      }

      if (status) {
        query.status = status;
      }

      if (vehicleType) {
        query.vehicleType = vehicleType;
      }

      const sortOptions: any = {};
      if (sortBy) {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions.createdAt = -1;
      }

      const [data, totalItems] = await Promise.all([
        VehicleModel.find(query)
          .populate({
            path: 'user',
            select: 'fullName email'
          })
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        VehicleModel.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalItems / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      throw new Error("Failed to fetch vehicles from the database");
    }
  }

  public async getAllRides(params: RideSearchQueryDtoType & { 
    status?: "Pending" | "Started" | "Completed" | "Cancelled" | "EmergencyStopped" | "Blocked";
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const { page, limit, search, sortBy, sortOrder, status, dateFrom, dateTo } = params;
      const skip = (page - 1) * limit;

      const query: any = {};
      
      if (search) {
        query.$or = [
          { startPlaceName: { $regex: search, $options: 'i' } },
          { endPlaceName: { $regex: search, $options: 'i' } },
          { driverName: { $regex: search, $options: 'i' } }
        ];
      }

      if (status) {
        query.status = status;
      }

      if (dateFrom || dateTo) {
        query.date = {};
        if (dateFrom) query.date.$gte = new Date(dateFrom);
        if (dateTo) query.date.$lte = new Date(dateTo);
      }

      const sortOptions: any = {};
      if (sortBy) {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions.createdAt = -1;
      }

      const [data, totalItems] = await Promise.all([
        RideModel.find(query)
          .populate({
            path: 'vehicleId',
            select: 'licensePlate vehicleModel'
          })
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        RideModel.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalItems / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch rides: ${(error as Error).message}`);
    }
  }

  public async updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      await this.updateById(userId, { status } as any);
    } catch (error) {
      throw new Error("Failed to update user status");
    }
  }

  public async updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void> {
    try {
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }
      await VehicleModel.findByIdAndUpdate(vehicleId, { status, note }, { new: true });
    } catch (error) {
      throw new Error("Failed to update vehicle status");
    }
  }

  public async findUserById(userId: string): Promise<IUser | null> {
    try {
      const user = await UserModel.findById(userId).select("-password").lean().exec();
      return user;
    } catch (error) {
      throw new Error(`Failed to find user: ${(error as Error).message}`);
    }
  }

  public async updateUser(userId: string, updatedData: Partial<IUser>): Promise<IUser | null> {
    try {
      const updatedUser = await UserModel.findByIdAndUpdate(userId, updatedData, { new: true })
        .select("-password")
        .lean()
        .exec();
      return updatedUser;
    } catch (error) {
      throw new Error(`Failed to update user: ${(error as Error).message}`);
    }
  }

  public async checkUserOngoingRides(userId: string): Promise<{
    hasOngoingRides: boolean;
    ongoingRides: any[];
    message: string;
  }> {
    try {
      // Check for ongoing rides (rides that are Pending or Started)
      const ongoingRides = await RideModel.find({
        $or: [
          { driverId: userId, status: { $in: ["Pending", "Started"] } },
          { "passengers.passengerId": userId, status: { $in: ["Pending", "Started"] } }
        ]
      })
      .select('rideId driverName startPlaceName endPlaceName status date time passengers')
      .lean()
      .exec();

      const hasOngoingRides = ongoingRides.length > 0;
      
      return {
        hasOngoingRides,
        ongoingRides,
        message: hasOngoingRides 
          ? `User has ${ongoingRides.length} ongoing ride(s)` 
          : "User has no ongoing rides"
      };
    } catch (error) {
      throw new Error(`Failed to check user's ongoing rides: ${(error as Error).message}`);
    }
  }

  async createSubscriptionPlan(planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan> {
    try {
      const plan = await SubscriptionPlanModel.create(planData);
      return plan;
    } catch (error) {
      throw new Error(`Failed to create subscription plan: ${(error as Error).message}`);
    }
  }

  async updateSubscriptionPlan(planId: string, planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan> {
    try {
      const plan = await SubscriptionPlanModel.findByIdAndUpdate(planId, planData, { new: true });
      if (!plan) {
        throw new Error("Subscription plan not found");
      }
      return plan;
    } catch (error) {
      throw new Error(`Failed to update subscription plan: ${(error as Error).message}`);
    }
  }

  async deleteSubscriptionPlan(planId: string): Promise<void> {
    try {
      const plan = await SubscriptionPlanModel.findByIdAndDelete(planId);
      if (!plan) {
        throw new Error("Subscription plan not found");
      }
    } catch (error) {
      throw new Error(`Failed to delete subscription plan: ${(error as Error).message}`);
    }
  }

  async getSubscriptionPlans(): Promise<ISubscriptionPlan[]> {
    try {
      return await SubscriptionPlanModel.find().exec();
    } catch (error) {
      throw new Error(`Failed to fetch subscription plans: ${(error as Error).message}`);
    }
  }

  async updateSubscriptionPlanStatus(planId: string, status: "Active" | "Blocked"): Promise<void> {
    try {
      const plan = await SubscriptionPlanModel.findByIdAndUpdate(planId, { status }, { new: true });
      if (!plan) {
        throw new Error("Subscription plan not found");
      }
    } catch (error) {
      throw new Error(`Failed to update subscription plan status: ${(error as Error).message}`);
    }
  }

  async getRideDetails(rideId: string): Promise<any> {
    try {
      const ride = await RideModel.findById(rideId).lean().exec();
      if (!ride) {
        throw new Error("Ride not found");
      }
      return ride;
    } catch (error) {
      throw new Error(`Failed to fetch ride details: ${(error as Error).message}`);
    }
  }

  async updateRideStatus(rideId: string, status: "Pending" | "Started" | "Completed" | "Cancelled" | "EmergencyStopped" | "Blocked"): Promise<void> {
    try {
      const ride = await RideModel.findById(rideId);
      if (!ride) {
        throw new Error("Ride not found");
      }
      await RideModel.findByIdAndUpdate(rideId, { status }, { new: true });
    } catch (error) {
      throw new Error(`Failed to update ride status: ${(error as Error).message}`);
    }
  }

  // NEW: Block ride with detailed information
  async blockRide(rideId: string, blockData: { reason: string; blockType: string; duration?: string; blockedBy: string }): Promise<void> {
    try {
      const ride = await RideModel.findById(rideId);
      if (!ride) {
        throw new Error("Ride not found");
      }

      // Check if ride is already blocked
      if (ride.status === "Blocked") {
        throw new Error("Ride is already blocked");
      }

      // Check if ride can be blocked (only Pending or Started rides can be blocked)
      if (!["Pending", "Started"].includes(ride.status)) {
        throw new Error(`Cannot block a ride with status: ${ride.status}. Only Pending or Started rides can be blocked.`);
      }

      // Update ride status to Blocked and store block details
      await RideModel.findByIdAndUpdate(rideId, { 
        status: "Blocked",
        blockDetails: {
          reason: blockData.reason,
          blockType: blockData.blockType,
          duration: blockData.duration || "temporary",
          blockedAt: new Date(),
          blockedBy: blockData.blockedBy,
          previousStatus: ride.status // Store previous status for potential unblock
        }
      }, { new: true });

      console.log(`🚫 Ride ${rideId} blocked by admin ${blockData.blockedBy}. Reason: ${blockData.reason}`);
    } catch (error) {
      throw new Error(`Failed to block ride: ${(error as Error).message}`);
    }
  }

  // NEW: Unblock ride
  async unblockRide(rideId: string): Promise<void> {
    try {
      const ride = await RideModel.findById(rideId);
      if (!ride) {
        throw new Error("Ride not found");
      }

      if (ride.status !== "Blocked") {
        throw new Error("Ride is not blocked");
      }

      // Restore previous status or set to Cancelled
      const previousStatus = ride.blockDetails?.previousStatus || "Cancelled";
      
      await RideModel.findByIdAndUpdate(rideId, { 
        status: previousStatus,
        blockDetails: null
      }, { new: true });

      console.log(`✅ Ride ${rideId} unblocked. Status restored to: ${previousStatus}`);
    } catch (error) {
      throw new Error(`Failed to unblock ride: ${(error as Error).message}`);
    }
  }

  async getDashboardMetrics(params: DashboardParams): Promise<DashboardMetrics> {
    console.log("📊 Fetching enhanced dashboard metrics with params:", params);
    
    try {
      const { startDate, endDate, timeRange } = params;
      
      let dateFilter: any = {};
      const currentDate = new Date();
      
      if (startDate && endDate) {
        dateFilter = { $gte: startDate, $lte: endDate };
      } else if (timeRange) {
        const start = new Date();
        switch (timeRange) {
          case "7days":
            start.setDate(start.getDate() - 7);
            break;
          case "30days":
            start.setDate(start.getDate() - 30);
            break;
          case "90days":
            start.setDate(start.getDate() - 90);
            break;
          case "1year":
            start.setFullYear(start.getFullYear() - 1);
            break;
          case "all":
            start.setFullYear(2020);
            break;
        }
        dateFilter = { $gte: start, $lte: currentDate };
      } else {
        dateFilter = {
          $gte: new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1),
          $lte: currentDate,
        };
      }

      console.log("📅 Date filter:", dateFilter);

      // Get basic metrics
      const [
        totalUsers,
        subscribedUsers,
        nonSubscribedUsers,
        totalRides,
        activeRides,
        completedRides,
        monthlyGrowth
      ] = await Promise.all([
        UserModel.countDocuments(),
        UserModel.countDocuments({
          "subscription.endDate": { $gt: currentDate },
        }),
        UserModel.countDocuments({
          $or: [
            { "subscription.endDate": { $lt: currentDate } },
            { subscription: { $exists: false } },
            { subscription: null }
          ]
        }),
        RideModel.countDocuments(),
        RideModel.countDocuments({ status: { $in: ["Pending", "Started"] } }),
        RideModel.countDocuments({ status: "Completed" }),
        this.calculateMonthlyGrowth()
      ]);

      console.log("📈 Basic metrics calculated");

      // Calculate revenue
      const [subscriptionRevenueResult, platformFeeResult] = await Promise.all([
        UserModel.aggregate([
          { $unwind: "$wallet.transactions" },
          {
            $match: {
              "wallet.transactions.type": "SUBSCRIPTION",
              "wallet.transactions.status": "COMPLETED",
              "wallet.transactions.createdAt": dateFilter,
            },
          },
          { $group: { _id: null, total: { $sum: "$wallet.transactions.amount" } } },
        ]),
        RideModel.aggregate([
          { 
            $match: { 
              status: "Completed",
              date: dateFilter
            } 
          },
          { 
            $group: { 
              _id: null, 
              total: { $sum: "$platformFee" } 
            } 
          },
        ])
      ]);

      const subscriptionRevenue = subscriptionRevenueResult[0]?.total || 0;
      const platformFee = platformFeeResult[0]?.total || 0;
      const totalRevenue = subscriptionRevenue + platformFee;

      console.log("💰 Revenue calculated:", { subscriptionRevenue, platformFee, totalRevenue });

      // Get time-based analytics
      const [userGrowth, rideCount, platformRevenue] = await Promise.all([
        this.getUserGrowthAnalytics(dateFilter),
        this.getRideCountAnalytics(dateFilter),
        this.getPlatformRevenueAnalytics(dateFilter)
      ]);

      console.log("📊 Analytics data fetched");

      const revenueDistribution = [
        { name: "Subscriptions", value: subscriptionRevenue, color: "#0088FE" },
        { name: "Platform Fees", value: platformFee, color: "#00C49F" },
        { name: "Other", value: 0, color: "#FFBB28" },
      ].filter(item => item.value > 0);

      return {
        metrics: {
          totalUsers,
          subscribedUsers,
          nonSubscribedUsers,
          totalRides,
          totalRevenue,
          activeRides,
          completedRides,
          monthlyGrowth,
        },
        userGrowth,
        rideCount,
        revenueDistribution,
        platformRevenue,
      };
    } catch (error) {
      console.error("❌ Error in getDashboardMetrics:", (error as Error).message);
      throw new Error(`Failed to fetch dashboard metrics: ${(error as Error).message}`);
    }
  }

  private async calculateMonthlyGrowth(): Promise<number> {
    try {
      const currentDate = new Date();
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const thisMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const [lastMonthUsers, thisMonthUsers] = await Promise.all([
        UserModel.countDocuments({
          createdAt: {
            $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
            $lt: thisMonthStart
          }
        }),
        UserModel.countDocuments({
          createdAt: { $gte: thisMonthStart }
        })
      ]);

      if (lastMonthUsers === 0) return thisMonthUsers > 0 ? 100 : 0;
      
      return ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;
    } catch (error) {
      console.error("Error calculating monthly growth:", error);
      return 0;
    }
  }

  private async getUserGrowthAnalytics(dateFilter: any): Promise<{ month: string; users: number; newUsers: number }[]> {
    try {
      const userGrowth = await UserModel.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: { 
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            totalUsers: { $sum: 1 },
            newUsers: { $sum: 1 }
          },
        },
        { 
          $sort: { "_id.year": 1, "_id.month": 1 } 
        },
        {
          $project: {
            month: {
              $dateToString: {
                format: "%b %Y",
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: 1
                  }
                }
              }
            },
            users: "$totalUsers",
            newUsers: "$newUsers",
            _id: 0
          }
        }
      ]);

      return userGrowth;
    } catch (error) {
      console.error("Error in getUserGrowthAnalytics:", error);
      return [];
    }
  }

  private async getRideCountAnalytics(dateFilter: any): Promise<{ month: string; rides: number; completed: number; cancelled: number }[]> {
    try {
      const rideCount = await RideModel.aggregate([
        { 
          $match: { 
            date: dateFilter 
          } 
        },
        {
          $group: {
            _id: { 
              year: { $year: "$date" },
              month: { $month: "$date" }
            },
            totalRides: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] }
            }
          },
        },
        { 
          $sort: { "_id.year": 1, "_id.month": 1 } 
        },
        {
          $project: {
            month: {
              $dateToString: {
                format: "%b %Y",
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: 1
                  }
                }
              }
            },
            rides: "$totalRides",
            completed: "$completed",
            cancelled: "$cancelled",
            _id: 0
          }
        }
      ]);

      return rideCount;
    } catch (error) {
      console.error("Error in getRideCountAnalytics:", error);
      return [];
    }
  }

  private async getPlatformRevenueAnalytics(dateFilter: any): Promise<{ month: string; revenue: number; rides: number }[]> {
    try {
      const platformRevenue = await RideModel.aggregate([
        { 
          $match: { 
            status: "Completed",
            date: dateFilter
          } 
        },
        {
          $group: {
            _id: { 
              year: { $year: "$date" },
              month: { $month: "$date" }
            },
            revenue: { $sum: "$platformFee" },
            rides: { $sum: 1 }
          },
        },
        { 
          $sort: { "_id.year": 1, "_id.month": 1 } 
        },
        {
          $project: {
            month: {
              $dateToString: {
                format: "%b %Y",
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: 1
                  }
                }
              }
            },
            revenue: 1,
            rides: 1,
            _id: 0
          }
        }
      ]);

      const subscriptionRevenue = await UserModel.aggregate([
        { $unwind: "$wallet.transactions" },
        {
          $match: {
            "wallet.transactions.type": "SUBSCRIPTION",
            "wallet.transactions.status": "COMPLETED",
            "wallet.transactions.createdAt": dateFilter,
          },
        },
        {
          $group: {
            _id: { 
              year: { $year: "$wallet.transactions.createdAt" },
              month: { $month: "$wallet.transactions.createdAt" }
            },
            subscriptionRevenue: { $sum: "$wallet.transactions.amount" }
          },
        }
      ]);

      const combinedRevenue = platformRevenue.map(monthData => {
        const subscription = subscriptionRevenue.find(sub => 
          sub._id.year === monthData._id.year && sub._id.month === monthData._id.month
        );
        return {
          month: monthData.month,
          revenue: monthData.revenue + (subscription?.subscriptionRevenue || 0),
          rides: monthData.rides
        };
      });

      return combinedRevenue;
    } catch (error) {
      console.error("Error in getPlatformRevenueAnalytics:", error);
      return [];
    }
  }

  async getSubscriptionPlansWithPagination(params: PaginationQueryDtoType & { 
    status?: "Active" | "Blocked";
  }): Promise<{
    data: ISubscriptionPlan[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const { page, limit, search, sortBy, sortOrder, status } = params;
      const skip = (page - 1) * limit;

      const query: any = { isDeleted: false };
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (status) {
        query.status = status;
      }

      const sortOptions: any = {};
      if (sortBy) {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions.createdAt = -1;
      }

      const [data, totalItems] = await Promise.all([
        SubscriptionPlanModel.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        SubscriptionPlanModel.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalItems / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch subscription plans: ${(error as Error).message}`);
    }
  }
}

export default AdminRepository;