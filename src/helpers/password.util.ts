// src/helpers/password.util.ts
import bcrypt from "bcryptjs";

class PasswordUtil {
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.trim() === "") {
      throw new Error("Password cannot be empty or undefined");
    }
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  static async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    if (!plainPassword || !hashedPassword) {
      throw new Error("Password or hashed password cannot be empty or undefined");
    }
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

export default PasswordUtil;