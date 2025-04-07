import AuthRepository from "../../repositories/implimentation/auth.repository";
import TokenRepository from "../../repositories/implimentation/token.repository";
import TempUserRepository from "../../repositories/implimentation/tempUser.repository";
import PasswordUtil from "../../helpers/password.util";
import { sendOTP } from "../../helpers/sendOTP.util";
import { IAuthService, IGoogleAuthUser } from "../interfaces/auth/iauthService";
// Removed IUser import to avoid confusion
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../helpers/jwt.util'; 

export default class AuthService implements IAuthService {
  constructor(
    private authRepository = AuthRepository,
    private tokenRepository = TokenRepository,
    private tempUserRepository = TempUserRepository
  ) {}

  async signup(userData: any) {
    const existingUser = await this.authRepository.findUserByEmail(userData.email);
    if (existingUser) {
      throw new Error("User already exists.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.tempUserRepository.upsertTempUser({
      fullName: userData.fullName,
      email: userData.email,
      phoneNumber: userData.phoneNumber || "",
      password: userData.password || "",
      otp,
      otpExpiresAt,
    });

    await sendOTP(userData.email, otp);
    return { success: true, message: "OTP sent. Verify before registration." };
  }

  async resendOTP(email: string) {
    const tempUser = await this.tempUserRepository.findTempUserByEmail(email);
    if (!tempUser) {
      throw new Error("No pending registration found for this email.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.tempUserRepository.updateTempUserOTP(email, otp, otpExpiresAt);

    await sendOTP(email, otp);
    return { success: true, message: "OTP resent successfully." };
  }

  async verifyOTP(email: string, otp: string) {
    const tempUser = await this.tempUserRepository.findTempUserByEmail(email);
    if (!tempUser || new Date() > tempUser.otpExpiresAt || tempUser.otp !== otp) {
      throw new Error("Invalid or expired OTP.");
    }

    const hashedPassword = await PasswordUtil.hashPassword(tempUser.password);
    const newUser = await this.authRepository.createUser({
      fullName: tempUser.fullName,
      email: tempUser.email,
      phoneNumber: tempUser.phoneNumber,
      password: hashedPassword,
    });

    await this.tempUserRepository.deleteTempUser(email);
    return { success: true, message: "User registered successfully", user: newUser };
  }

  async login(email: string, password: string) {
    const user = await this.authRepository.findUserByEmail(email);
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

    await this.tokenRepository.replaceToken(user._id.toString(), refreshToken);
    return { accessToken, refreshToken };
  }

  async refreshToken(token: string) {
    const decoded: any = verifyRefreshToken(token);
    const existingToken = await this.tokenRepository.findToken(token);
    if (!existingToken) {
      throw new Error("Invalid refresh token");
    }

    await this.tokenRepository.deleteToken(token);
    const newAccessToken = generateAccessToken(decoded.userId, decoded.email);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    await this.tokenRepository.replaceToken(decoded.userId, newRefreshToken);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await this.tokenRepository.deleteToken(refreshToken);
    return { message: "Logged out successfully" };
  }

  async handleGoogleAuth(googleUser: IGoogleAuthUser) {
    let user = await this.authRepository.findUserByEmail(googleUser.email);

    if (!user) {
      user = await this.authRepository.createUser({
        fullName: googleUser.fullName,
        email: googleUser.email,
        phoneNumber: "",
        password: "",
        image: googleUser.image,
      });
    }

    const accessToken = generateAccessToken(user._id.toString(), user.email);
    const refreshToken = generateRefreshToken(user._id.toString());

    await this.tokenRepository.replaceToken(user._id.toString(), refreshToken);
    return { user, accessToken, refreshToken };
  }
}