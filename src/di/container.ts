// src/di/container.ts
import { Container } from "inversify";
import { TYPES } from "./types";

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
import AuthRepository from "../repositories/implimentation/auth.repository";
import { ITokenRepository } from "../repositories/interface/user/itokenRepository";
import TokenRepository from "../repositories/implimentation/token.repository";
import { ITempUserRepository } from "../repositories/interface/user/itempUserRepository";
import TempUserRepository from "../repositories/implimentation/tempUser.repository";

// User
import { IUserController } from "../controllers/interface/user/interface";
import { IUserService } from "../services/interfaces/user/iuserService";
import { IUserRepository } from "../repositories/interface/user/iuserRepository";
import { UserController } from "../controllers/implimentation/user.controller";
import UserService from "../services/implementation/user.service";
import UserRepository from "../repositories/implimentation/user.repository";

// Vehicle
import { IVehicleController } from "../controllers/interface/vehicle/ivehicleController";
import { IVehicleService } from "../services/interfaces/vehicle/ivehicleService";
import { IVehicleRepository } from "../repositories/interface/vehicle/ivehicleRepository";
import { VehicleController } from "../controllers/implimentation/vehicle.controller";
import VehicleService from "../services/implementation/vehicle.service";
import VehicleRepository from "../repositories/implimentation/vehicle.repository";

// Ride
import { RideController } from '../controllers/implimentation/ride.controller';
import { RideService } from '../services/implementation/ride.service';
import { RideRepository } from '../repositories/implimentation/ride.repository';
import { IRideController } from '../controllers/interface/ride/irideController';
import { IRideService } from '../services/interfaces/ride/irideService';
import { IRideRepository } from '../repositories/interface/ride/irideRepository';

const container = new Container();

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

// User bindings
container.bind<IUserController>(TYPES.IUserController).to(UserController).inSingletonScope();
container.bind<IUserService>(TYPES.IUserService).to(UserService).inSingletonScope();
container.bind<IUserRepository>(TYPES.IUserRepository).to(UserRepository).inSingletonScope();

// Vehicle bindings
container.bind<IVehicleController>(TYPES.IVehicleController).to(VehicleController).inSingletonScope();
container.bind<IVehicleService>(TYPES.IVehicleService).to(VehicleService).inSingletonScope();
container.bind<IVehicleRepository>(TYPES.IVehicleRepository).to(VehicleRepository).inSingletonScope();

// Ride bindings
container.bind<IRideController>(TYPES.IRideController).to(RideController).inSingletonScope();
container.bind<IRideService>(TYPES.IRideService).to(RideService).inSingletonScope();
container.bind<IRideRepository>(TYPES.IRideRepository).to(RideRepository).inSingletonScope();

export default container;