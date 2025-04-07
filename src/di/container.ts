import { Container } from "inversify";
import { TYPES } from "./types";


import { IAdminController } from "../controllers/interface/admin/interface";
import { IAdminService } from "../services/interfaces/admin/interface";
import { IAdminRepository } from "../repositories/interface/admin/interface";
import { AdminController } from "../controllers/implimentation/admin.controller";
import { AdminService } from "../services/implementation/admin.service";
import { AdminRepository } from "../repositories/implimentation/admin.repository";


import { IAuthController } from "../controllers/interface/auth/interface";
import { IAuthService } from "../services/interfaces/auth/iauthService";
import { IAuthRepository } from "../repositories/interface/user/iauthRepository";
import { AuthController } from "../controllers/implimentation/auth.controller";
import  AuthService  from "../services/implementation/auth.service";
import  AuthRepository  from "../repositories/implimentation/auth.repository";
import { ITokenRepository } from "../repositories/interface/user/itokenRepository";
import  TokenRepository  from "../repositories/implimentation/token.repository";
import { ITempUserRepository } from "../repositories/interface/user/itempUserRepository";
import  TempUserRepository  from "../repositories/implimentation/tempUser.repository";


const container = new Container();


container.bind<IAdminController>(TYPES.IAdminController).to(AdminController).inSingletonScope();
container.bind<IAdminService>(TYPES.IAdminService).to(AdminService).inSingletonScope();
container.bind<IAdminRepository>(TYPES.IAdminRepository).to(AdminRepository).inSingletonScope();

-
container.bind<IAuthController>(TYPES.IAuthController).to(AuthController).inSingletonScope();
container.bind<IAuthService>(TYPES.IAuthService).to(AuthService).inSingletonScope();
container.bind<IAuthRepository>(TYPES.IAuthRepository).to(AuthRepository).inSingletonScope();
container.bind<ITokenRepository>(TYPES.ITokenRepository).to(TokenRepository).inSingletonScope();
container.bind<ITempUserRepository>(TYPES.ITempUserRepository).to(TempUserRepository).inSingletonScope();
export default container;