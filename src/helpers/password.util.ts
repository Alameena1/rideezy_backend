import bcrypt from "bcryptjs";

class PasswordUtil {
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  static async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
 
    
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

export default PasswordUtil;
