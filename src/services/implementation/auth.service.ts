import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import { IAuthService, IGoogleAuthUser } from "../interfaces/auth/iauthService";
import { IAuthRepository } from "../../repositories/interface/user/iauthRepository";
import { ITokenRepository } from "../../repositories/interface/user/itokenRepository";
import { ITempUserRepository } from "../../repositories/interface/user/itempUserRepository";
import { ITempUserInput } from "../../repositories/interface/user/itempUserRepository";
import { IResetTokenRepository } from "../../repositories/interface/user/iresetTokenRepository";
import PasswordUtil from "../../helpers/password.util";
import { sendOTP, sendPasswordResetEmail } from "../../helpers/sendOTP.util";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../helpers/jwt.util";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import logger from "../../config/logger";

@injectable()
export default class AuthService implements IAuthService {
  private _googleClient: OAuth2Client;

  constructor(
    @inject(TYPES.IAuthRepository) private _authRepository: IAuthRepository,
    @inject(TYPES.ITokenRepository) private _tokenRepository: ITokenRepository,
    @inject(TYPES.ITempUserRepository) private _tempUserRepository: ITempUserRepository,
    @inject(TYPES.IResetTokenRepository) private _resetTokenRepository: IResetTokenRepository
  ) {
    this._googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async signup(userData: ITempUserInput) {
    logger.info(`Signup attempt for email: ${userData.email}`);

    if (!userData.fullName || !userData.email || !userData.password || userData.password.trim() === "") {
      logger.warn(`Missing required fields in signup for email: ${userData.email}`);
      throw new Error("Full name, email, and a non-empty password are required.");
    }

    const existingUser = await this._authRepository.findUserByEmail(userData.email);
    if (existingUser) {
      logger.warn(`User already exists during signup: ${userData.email}`);
      throw new Error("User already exists.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const tempUserData = {
      fullName: userData.fullName,
      email: userData.email,
      phoneNumber: userData.phoneNumber || "",
      password: userData.password,
      otp,
      otpExpiresAt,
    };

    await this._tempUserRepository.upsertTempUser(tempUserData);
    await sendOTP(userData.email, otp);
    
    logger.info(`OTP sent successfully for signup: ${userData.email}`);
    return { success: true, message: "OTP sent. Verify before registration." };
  }

  async resendOTP(email: string) {
    logger.info(`Resend OTP request for email: ${email}`);

    const tempUser = await this._tempUserRepository.findTempUserByEmail(email);
    if (!tempUser) {
      logger.warn(`No pending registration found for OTP resend: ${email}`);
      throw new Error("No pending registration found for this email.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this._tempUserRepository.updateTempUserOTP(email, otp, otpExpiresAt);
    await sendOTP(email, otp);
    
    logger.info(`OTP resent successfully for email: ${email}`);
    return { success: true, message: "OTP resent successfully." };
  }

  async verifyOTP(email: string, otp: string) {
    logger.info(`OTP verification attempt for email: ${email}`);

    const tempUser = await this._tempUserRepository.findTempUserByEmail(email);

    if (!tempUser || !tempUser.otp || !tempUser.otpExpiresAt || new Date() > tempUser.otpExpiresAt || tempUser.otp !== otp) {
      logger.warn(`Invalid or expired OTP for email: ${email}`);
      throw new Error("Invalid or expired OTP.");
    }

    if (!tempUser.password || tempUser.password.trim() === "") {
      logger.error(`No valid password found for registration: ${email}`);
      throw new Error("No valid password found for registration.");
    }

    const hashedPassword = await PasswordUtil.hashPassword(tempUser.password);
    const newUser = await this._authRepository.createUser({
      fullName: tempUser.fullName,
      email: tempUser.email,
      phoneNumber: tempUser.phoneNumber,
      password: hashedPassword,
      role: "user",
    });

    await this._tempUserRepository.deleteTempUser(email);
    
    logger.info(`User registered successfully: ${email}`);
    return { success: true, message: "User registered successfully", user: newUser };
  }

  async login(email: string, password: string) {
    logger.info(`Login attempt for email: ${email}`);
    
    const user = await this._authRepository.findUserByEmail(email);

    if (!user) {
      logger.warn(`User not found during login: ${email}`);
      throw new Error("Invalid email or password");
    }
    
    if (!user.password) {
      logger.error(`User has no password set: ${email}, userId: ${user._id}`);
      throw new Error("Invalid email or password");
    }
    
    if (user.status === "Blocked") {
      logger.warn(`Blocked user attempted login: ${email}, userId: ${user._id}`);
      throw new Error("Your account has been blocked. Contact support.");
    }

    const isPasswordValid = await PasswordUtil.comparePasswords(password, user.password);
    logger.debug(`Password verification result for ${email}: ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      logger.warn(`Invalid password for email: ${email}`);
      throw new Error("Invalid email or password");
    }

    const accessToken = generateAccessToken(user._id.toString(), user.email, user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    await this._tokenRepository.replaceToken(user._id.toString(), refreshToken);
    
    logger.info(`Login successful for user: ${user._id}, email: ${user.email}, role: ${user.role}`);
    return { 
      accessToken, 
      refreshToken, 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      } 
    };
  }

  async refreshToken(token: string) {
    logger.debug(`Refresh token attempt`);

    const decoded = verifyRefreshToken(token, "user");
    const existingToken = await this._tokenRepository.findToken(token);
    
    if (!existingToken) {
      logger.warn(`Invalid refresh token provided`);
      throw new Error("Invalid refresh token");
    }

    await this._tokenRepository.deleteToken(token);
    const newAccessToken = generateAccessToken(decoded.userId, decoded.email || "", "user");
    const newRefreshToken = generateRefreshToken(decoded.userId, "user");

    await this._tokenRepository.replaceToken(decoded.userId, newRefreshToken);
    
    logger.info(`Tokens refreshed successfully for user: ${decoded.userId}`);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    logger.info(`Logout request processed`);
    await this._tokenRepository.deleteToken(refreshToken);
    return { message: "Logged out successfully" };
  }

  async handleGoogleAuth(googleUser: IGoogleAuthUser & { idToken: string }) {
    logger.info(`Google auth attempt for email: ${googleUser.email}`);

    try {
      const ticket = await this._googleClient.verifyIdToken({
        idToken: googleUser.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      if (!payload || payload.email !== googleUser.email) {
        logger.warn(`Invalid Google ID token or email mismatch for: ${googleUser.email}`);
        throw new Error("Invalid Google ID token or email mismatch");
      }
    } catch (error) {
      logger.error(`Google ID token verification failed for ${googleUser.email}:`, error);
      throw new Error("Invalid Google ID token");
    }

    let user = await this._authRepository.findUserByEmail(googleUser.email);

    if (!user) {
      logger.info(`Creating new user via Google auth: ${googleUser.email}`);
      user = await this._authRepository.createUser({
        fullName: googleUser.fullName,
        email: googleUser.email,
        phoneNumber: "",
        password: "",
        image: googleUser.image,
        role: "user",
      });
    }

    const accessToken = generateAccessToken(user._id.toString(), user.email, user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    await this._tokenRepository.replaceToken(user._id.toString(), refreshToken);
    
    logger.info(`Google auth successful for user: ${user._id}, email: ${user.email}`);
    return { 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role, 
        fullName: user.fullName, 
        image: user.image 
      }, 
      accessToken, 
      refreshToken 
    };
  }

  async forgotPassword(email: string) {
    logger.info(`Forgot password request for email: ${email}`);

    const user = await this._authRepository.findUserByEmail(email);
    if (!user) {
      logger.warn(`No user found for forgot password: ${email}`);
      throw new Error("No user found with this email.");
    }

    const existingToken = await this._resetTokenRepository.findTokenByUserId(user._id.toString());
    if (existingToken) {
      await this._resetTokenRepository.deleteToken(existingToken.token);
    }

    const token = crypto.randomBytes(32).toString("hex");
    await this._resetTokenRepository.createToken(user._id.toString(), token);

    const resetLink = `${process.env.FRONTEND_URL}/user/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetLink);

    logger.info(`Password reset link sent to: ${email}`);
    return { success: true, message: "Password reset link sent to your email." };
  }

  async resetPassword(token: string, newPassword: string) {
    logger.info(`Reset password attempt with token`);

    if (!newPassword || newPassword.trim() === "") {
      logger.warn(`Empty password provided for reset`);
      throw new Error("New password is required.");
    }

    const resetToken = await this._resetTokenRepository.findToken(token);
    if (!resetToken) {
      logger.warn(`Invalid or expired reset token`);
      throw new Error("Invalid or expired reset token.");
    }

    const hashedPassword = await PasswordUtil.hashPassword(newPassword);
    const user = await this._authRepository.updatePassword(resetToken.userId, hashedPassword);

    if (!user) {
      logger.error(`User not found during password reset for token`);
      throw new Error("User not found.");
    }

    await this._resetTokenRepository.deleteToken(token);
    
    logger.info(`Password reset successfully for user: ${user._id}`);
    return { success: true, message: "Password reset successfully." };
  }
}