export const TYPES = {
  // Admin
  IAdminController: Symbol.for("IAdminController"),
  IAdminService: Symbol.for("IAdminService"),
  IAdminRepository: Symbol.for("IAdminRepository"),
  
  // Auth
  IAuthController: Symbol.for("IAuthController"),
  IAuthService: Symbol.for("IAuthService"),
  IAuthRepository: Symbol.for("IAuthRepository"),
  ITokenRepository: Symbol.for("ITokenRepository"),
  ITempUserRepository: Symbol.for("ITempUserRepository"),
  IResetTokenRepository: Symbol.for("IResetTokenRepository"),
  
  // User
  IUserController: Symbol.for("IUserController"),
  IUserService: Symbol.for("IUserService"),
  IUserRepository: Symbol.for("IUserRepository"),
  
  // Vehicle
  IVehicleController: Symbol.for("IVehicleController"),
  IVehicleService: Symbol.for("IVehicleService"),
  IVehicleRepository: Symbol.for("IVehicleRepository"),
  
  // OSRM Client
  IOSRMClient: Symbol.for("IOSRMClient"),
  
  // Subscription
  ISubscriptionController: Symbol.for("ISubscriptionController"),
  ISubscriptionService: Symbol.for("ISubscriptionService"),
  ISubscriptionRepository: Symbol.for("ISubscriptionRepository"),
  
  // Wallet
  IWalletController: Symbol.for("IWalletController"),
  IWalletService: Symbol.for("IWalletService"),
  IWalletRepository: Symbol.for("IWalletRepository"),
  
  // Tracking
  ITrackingService: Symbol.for("ITrackingService"),
  ITrackingController: Symbol.for("ITrackingController"),
  ITrackingRepository: Symbol.for("ITrackingRepository"),
  
  // Notification
  INotificationController: Symbol.for("INotificationController"),
  INotificationService: Symbol.for("INotificationService"),
  INotificationRepository: Symbol.for("INotificationRepository"),
  
  // Chat
  IChatController: Symbol.for("IChatController"),
  IChatService: Symbol.for("IChatService"),
  IChatRepository: Symbol.for("IChatRepository"),
  
  // Initiate Ride (NEW)
  IInitiateRideRepository: Symbol.for("IInitiateRideRepository"),
  IInitiateRideService: Symbol.for("IInitiateRideService"),
  IInitiateRideController: Symbol.for("IInitiateRideController"),
  
  // Join Ride (NEW)
  IJoinRideRepository: Symbol.for("IJoinRideRepository"),
  IJoinRideService: Symbol.for("IJoinRideService"),
  IJoinRideController: Symbol.for("IJoinRideController"),
};