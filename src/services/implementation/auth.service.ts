import UserRepository from "../../repositories/implimentation/auth.repository";
import TokenRepository from "../../repositories/implimentation/token.repository";
import PasswordUtil from "../../helpers/password.util";
import { sendOTP } from "../../helpers/sendOTP.util";
import TempUserModel from "../../models/tempUser.model";
import UserModel from "../../models/user.model";
import { IAuthService } from "../interfaces/user/iuserService";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../helpers/jwt.util";

interface IUser {
  fullName: string;
  email: string;
  password?: string;
  phoneNumber?: string;
  image?: string;
}

class AuthService implements IAuthService {
  async signup(userData: IUser) {
    const existingUser = await UserRepository.findUserByEmail(userData.email);
    if (existingUser) {
      throw new Error("User already exists.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await TempUserModel.findOneAndUpdate(
      { email: userData.email },
      { ...userData, otp, otpExpiresAt },
      { upsert: true, new: true }
    );

    await sendOTP(userData.email, otp);
    return { success: true, message: "OTP sent. Verify before registration." };
  }

  async resendOTP(email: string) {
    const tempUser = await TempUserModel.findOne({ email });
    if (!tempUser) {
      throw new Error("No pending registration found for this email.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await TempUserModel.updateOne(
      { email },
      { otp, otpExpiresAt }
    );

    await sendOTP(email, otp);
    return { success: true, message: "OTP resent successfully." };
  }

  async verifyOTP(email: string, otp: string) {
    const tempUser = await TempUserModel.findOne({ email });
    if (!tempUser || new Date() > tempUser.otpExpiresAt || tempUser.otp !== otp) {
      throw new Error("Invalid or expired OTP.");
    }

    const hashedPassword = await PasswordUtil.hashPassword(tempUser.password || "");
    const newUser = await UserModel.create({
      fullName: tempUser.fullName,
      email: tempUser.email,
      phoneNumber: tempUser.phoneNumber,
      password: hashedPassword,
    });

    await TempUserModel.deleteOne({ email });
    return { success: true, message: "User registered successfully", user: newUser };
  }

  async login(email: string, password: string) {
    console.log("token",email, password)
    const user = await UserRepository.findUserByEmail(email);
   
    if (!user || !user.password) {
      throw new Error("Invalid email or password");
    }
    if (user.status === "Blocked") { 
    
      throw new Error("Your account has been blocked. Contact support.");
    }

    const isPasswordValid = await PasswordUtil.comparePasswords(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const accessToken = generateAccessToken(user._id.toString(), user.email);
    const refreshToken = generateRefreshToken(user._id.toString());

   let a =  await TokenRepository.replaceToken(user._id.toString(), refreshToken);

    return { accessToken, refreshToken };
  }

  async refreshToken(token: string) {
    const decoded: any = verifyRefreshToken(token);

   
    const existingToken = await TokenRepository.findToken(token);
    if (!existingToken) {   
      throw new Error("Invalid refresh token");
    } 
    


    await TokenRepository.deleteToken(token);
    const newAccessToken = generateAccessToken(decoded.userId, decoded.email);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    await TokenRepository.replaceToken(decoded.userId, newRefreshToken);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await TokenRepository.deleteToken(refreshToken);
    return { message: "Logged out successfully" };
  }

  async handleGoogleAuth(googleUser: IUser) {
    let user = await UserRepository.findUserByEmail(googleUser.email);

    if (!user) {
      user = await UserModel.create({
        fullName: googleUser.fullName,
        email: googleUser.email,
        phoneNumber: googleUser.phoneNumber || "",
        password: "",
      });
    }

    const accessToken = generateAccessToken(user._id.toString(), user.email);
    const refreshToken = generateRefreshToken(user._id.toString());

    await TokenRepository.replaceToken(user._id.toString(), refreshToken);
    return { user, accessToken, refreshToken };
  }

  async getProfile(userId: string) {
    const user = await UserModel.findById(userId).select("-password");
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async updateProfile(userId: string, updatedData: any) {
    if (!userId) {
      throw new Error("User ID is required.");
    }

    const updatedUser = await UserRepository.updateUserProfile(userId, updatedData);
    if (!updatedUser) {
      throw new Error("Failed to update profile.");
    }

    return updatedUser;
  }
}

export default AuthService;