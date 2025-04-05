import { Container } from "inversify";
import { TYPES } from "./types";
import { IAdminController } from "../controllers/interface/admin/interface";
import { IAdminService } from "../services/interfaces/admin/interface";
import { IAdminRepository } from "../repositories/interface/admin/interface";
import { AdminController } from "../controllers/implimentation/admin.controller";
import { AdminService } from "../services/implementation/admin.service";
import { AdminRepository } from "../repositories/implimentation/admin.repository";

const container = new Container();

// Bind interfaces to their implementations
container.bind<IAdminController>(TYPES.IAdminController).to(AdminController).inSingletonScope();
container.bind<IAdminService>(TYPES.IAdminService).to(AdminService).inSingletonScope();
container.bind<IAdminRepository>(TYPES.IAdminRepository).to(AdminRepository).inSingletonScope();

export default container;