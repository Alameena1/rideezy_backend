import { AuthStrategy } from "./auth.strategy";
import UserRepository from "../repositories/implimentation/auth.repository";
import PasswordUtil from "../helpers/password.util";

class EmailAuthStrategy implements AuthStrategy {
  async signup(userData: any) {
    const existingUser = await UserRepository.findUserByEmail(userData.email);
    if (existingUser) {
      throw new Error("User already exists");
    }

    userData.password = await PasswordUtil.hashPassword(userData.password);
    return await UserRepository.createUser(userData);
  }
}

export default new EmailAuthStrategy();
