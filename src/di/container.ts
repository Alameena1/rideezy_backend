import { Container } from "inversify";
import { TYPES } from "./types";
import Razorpay from "razorpay";

// Admin
import { IAdminController } from "../controllers/interface/admin/interface";
import { IAdminService } from "../services/interfaces/admin/interface";
import { IAdminRepository } from "../repositories/interface/admin/interface";
import { AdminController } from "../controllers/implimentation/admin.controller";
import { AdminService } from "../services/implementation/admin.service";
import { AdminRepository } from "../repositories/implimentation/admin.repository";

// Auth
import { IAuthController } from "../controllers/interface/auth/interface";
import { IAuthService } from "../services/interfaces/auth/iauthService";
import { IAuthRepository } from "../repositories/interface/user/iauthRepository";
import { AuthController } from "../controllers/implimentation/auth.controller";
import AuthService from "../services/implementation/auth.service"; 
import { AuthRepository } from "../repositories/implimentation/auth.repository"; 
import { ITokenRepository } from "../repositories/interface/user/itokenRepository";
import { TokenRepository } from "../repositories/implimentation/token.repository"; 
import { ITempUserRepository } from "../repositories/interface/user/itempUserRepository";
import { TempUserRepository } from "../repositories/implimentation/tempUser.repository"; 
import { IResetTokenRepository } from "../repositories/interface/user/iresetTokenRepository";
import { ResetTokenRepository } from "../repositories/implimentation/resetToken.repository"; 

// User
import { IUserController } from "../controllers/interface/user/interface";
import { IUserService } from "../services/interfaces/user/iuserService";
import { IUserRepository } from "../repositories/interface/user/iuserRepository";
import { UserController } from "../controllers/implimentation/user.controller";
import UserService from "../services/implementation/user.service";
import { UserRepository } from "../repositories/implimentation/user.repository"; 

// Vehicle
import { IVehicleController } from "../controllers/interface/vehicle/ivehicleController";
import { IVehicleService } from "../services/interfaces/vehicle/ivehicleService";
import { IVehicleRepository } from "../repositories/interface/vehicle/ivehicleRepository";
import { VehicleController } from "../controllers/implimentation/vehicle.controller";
import VehicleService from "../services/implementation/vehicle.service"; 
import { VehicleRepository } from "../repositories/implimentation/vehicle.repository"; 

// OSRM
import { IOSRMClient } from "../infrastructure/map-api/osrm.client";
import { OSRMClient } from "../infrastructure/map-api/osrm.client";

// Subscription
import { ISubscriptionController } from "../controllers/implimentation/subscription/isubscriptionController";
import { ISubscriptionService } from "../services/interfaces/subscription/isubscriptionService";
import { ISubscriptionRepository } from "../repositories/interface/subscription/isubscriptionRepository";
import { SubscriptionController } from "../controllers/implimentation/subscription/SubscriptionController";
import { SubscriptionService } from "../services/implementation/subscriptionService"; 
import { SubscriptionRepository } from "../repositories/implimentation/subscriptionRepository"; 

// Wallet
import { IWalletController } from "../controllers/interface/wallet/iWalletController";
import { IWalletService } from "../services/interfaces/wallet/iWalletService";
import { IWalletRepository } from "../repositories/interface/wallet/iWalletRepository";
import { WalletController } from "../controllers/implimentation/wallet.controller";
import { WalletService } from "../services/implementation/wallet.service"; 
import { WalletRepository } from "../repositories/implimentation/wallet.repository"; 

// Tracking
import { TrackingService } from "../services/implementation/tracking.service"; 
import { TrackingController } from "../controllers/implimentation/tracking.controller";
import { ITrackingService } from "../services/interfaces/tracking/itrackingService";
import { ITrackingController } from "../controllers/interface/tracking/itrackingController";
import { ITrackingRepository } from "../repositories/interface/tracking/itrackingRepository";
import { TrackingRepository } from "../repositories/implimentation/tracking.repository"; 

// Notification
import { INotificationController } from "../controllers/interface/notification/iNotificationController";
import { INotificationService } from "../services/interfaces/notification/iNotificationService";
import { INotificationRepository } from "../repositories/interface/notification/iNotificationRepository";
import { NotificationController } from "../controllers/implimentation/notification.controller";
import { NotificationService } from "../services/implementation/notification.service";
import { NotificationRepository } from "../repositories/implimentation/notification.repository"; 

// Chat
import IChatController from "../controllers/interface/chat/IChatController";
import IChatService from "../services/interfaces/chat/IChatService";
import IChatRepository from "../repositories/interface/chat/IChatRepository";
import ChatController from "../controllers/implimentation/chat.controller";
import { ChatService } from "../services/implementation/chat.service"; 
import { ChatRepository } from "../repositories/implimentation/chat.repository"; 

// Initiate Ride
import { IInitiateRideRepository } from "../repositories/interface/ride/iinitiate-ride-repository";
import { IInitiateRideController } from "../controllers/interface/ride/iinitiate-ride.controller";
import { InitiateRideController } from "../controllers/implimentation/initiate-ride.controller";
import { InitiateRideRepository } from "../repositories/implimentation/initiate-ride.repository";
import { InitiateRideService } from "../services/implementation/initiate-ride.service";
import { IInitiateRideService } from "../services/interfaces/ride/iinitiate-ride.service";

// Join Ride
import { IJoinRideService } from "../services/interfaces/ride/ijoin-ride.service";
import { JoinRideController } from "../controllers/implimentation/join-ride.controller";
import { IJoinRideController } from "../controllers/interface/ride/ijoin-ride.controller";
import { JoinRideRepository } from "../repositories/implimentation/join-ride.repository";
import { IJoinRideRepository } from "../repositories/interface/ride/ijoin-ride-repository";
import { JoinRideService } from "../services/implementation/join-ride.service";

// Cron Jobs
import { DocumentExpiryCron } from "../cron/document-expiry.cron";

const container = new Container();

// NEW: Initiate Ride bindings
container.bind<IInitiateRideRepository>(TYPES.IInitiateRideRepository).to(InitiateRideRepository).inSingletonScope();
container.bind<IInitiateRideService>(TYPES.IInitiateRideService).to(InitiateRideService).inSingletonScope();
container.bind<IInitiateRideController>(TYPES.IInitiateRideController).to(InitiateRideController).inSingletonScope();

// NEW: Join Ride bindings
container.bind<IJoinRideRepository>(TYPES.IJoinRideRepository).to(JoinRideRepository).inSingletonScope();
container.bind<IJoinRideService>(TYPES.IJoinRideService).to(JoinRideService).inSingletonScope();
container.bind<IJoinRideController>(TYPES.IJoinRideController).to(JoinRideController).inSingletonScope();

// Admin bindings
container.bind<IAdminController>(TYPES.IAdminController).to(AdminController).inSingletonScope();
container.bind<IAdminService>(TYPES.IAdminService).to(AdminService).inSingletonScope();
container.bind<IAdminRepository>(TYPES.IAdminRepository).to(AdminRepository).inSingletonScope();

// Auth bindings
container.bind<IAuthController>(TYPES.IAuthController).to(AuthController).inSingletonScope();
container.bind<IAuthService>(TYPES.IAuthService).to(AuthService).inSingletonScope();
container.bind<IAuthRepository>(TYPES.IAuthRepository).to(AuthRepository).inSingletonScope();
container.bind<ITokenRepository>(TYPES.ITokenRepository).to(TokenRepository).inSingletonScope();
container.bind<ITempUserRepository>(TYPES.ITempUserRepository).to(TempUserRepository).inSingletonScope();
container.bind<IResetTokenRepository>(TYPES.IResetTokenRepository).to(ResetTokenRepository).inSingletonScope();

// User bindings
container.bind<IUserController>(TYPES.IUserController).to(UserController).inSingletonScope();
container.bind<IUserService>(TYPES.IUserService).to(UserService).inSingletonScope();
container.bind<IUserRepository>(TYPES.IUserRepository).to(UserRepository).inSingletonScope();

// Vehicle bindings
container.bind<IVehicleController>(TYPES.IVehicleController).to(VehicleController).inSingletonScope();
container.bind<IVehicleService>(TYPES.IVehicleService).to(VehicleService).inSingletonScope();
container.bind<IVehicleRepository>(TYPES.IVehicleRepository).to(VehicleRepository).inSingletonScope();

// OSRM Client binding
container.bind<IOSRMClient>(TYPES.IOSRMClient).to(OSRMClient).inSingletonScope();

// Subscription bindings
container.bind<ISubscriptionController>(TYPES.ISubscriptionController).to(SubscriptionController).inSingletonScope();
container.bind<ISubscriptionService>(TYPES.ISubscriptionService).to(SubscriptionService).inSingletonScope();
container.bind<ISubscriptionRepository>(TYPES.ISubscriptionRepository).to(SubscriptionRepository).inSingletonScope();

// Wallet bindings
container.bind<IWalletController>(TYPES.IWalletController).to(WalletController).inSingletonScope();
container.bind<IWalletService>(TYPES.IWalletService).to(WalletService).inSingletonScope();
container.bind<IWalletRepository>(TYPES.IWalletRepository).to(WalletRepository).inSingletonScope();

// Tracking bindings
container.bind<ITrackingRepository>(TYPES.ITrackingRepository).to(TrackingRepository).inSingletonScope();
container.bind<ITrackingService>(TYPES.ITrackingService).to(TrackingService).inSingletonScope();
container.bind<ITrackingController>(TYPES.ITrackingController).to(TrackingController).inSingletonScope();

// Notification bindings
container.bind<INotificationController>(TYPES.INotificationController).to(NotificationController).inSingletonScope();
container.bind<INotificationService>(TYPES.INotificationService).to(NotificationService).inSingletonScope();
container.bind<INotificationRepository>(TYPES.INotificationRepository).to(NotificationRepository).inSingletonScope();

// Chat bindings
container.bind<IChatController>(TYPES.IChatController).to(ChatController).inSingletonScope();
container.bind<IChatService>(TYPES.IChatService).to(ChatService).inSingletonScope();
container.bind<IChatRepository>(TYPES.IChatRepository).to(ChatRepository).inSingletonScope();

// Cron Jobs bindings
container.bind<DocumentExpiryCron>(DocumentExpiryCron).to(DocumentExpiryCron).inSingletonScope();

// Razorpay binding
container.bind<Razorpay>("Razorpay").toConstantValue(
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_KOCURsj88Mu4Sj",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "64CY4QIGucP0t33gP8JodsqI",
  })
);

export default container;