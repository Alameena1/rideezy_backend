
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import { IAuthService, IGoogleAuthUser } from "../interfaces/auth/iauthService";
import { IAuthRepository } from "../../repositories/interface/user/iauthRepository";
import { ITokenRepository } from "../../repositories/interface/user/itokenRepository";
import { ITempUserRepository } from "../../repositories/interface/user/itempUserRepository";
import { ITempUserInput } from "../../repositories/interface/user/itempUserRepository"; 
import PasswordUtil from "../../helpers/password.util";
import { sendOTP } from "../../helpers/sendOTP.util";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../helpers/jwt.util";

@injectable()
export default class AuthService implements IAuthService {
  constructor(
    @inject(TYPES.IAuthRepository) private authRepository: IAuthRepository,
    @inject(TYPES.ITokenRepository) private tokenRepository: ITokenRepository,
    @inject(TYPES.ITempUserRepository)
    private tempUserRepository: ITempUserRepository
  ) {}

  async signup(userData: ITempUserInput) {
   
    if (
      !userData.fullName ||
      !userData.email ||
      !userData.password ||
      userData.password.trim() === ""
    ) {
      throw new Error(
        "Full name, email, and a non-empty password are required."
      );
    }

    const existingUser = await this.authRepository.findUserByEmail(
      userData.email
    );
    if (existingUser) {
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

    await this.tempUserRepository.upsertTempUser(tempUserData);
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

  if (!tempUser || !tempUser.otp || !tempUser.otpExpiresAt || new Date() > tempUser.otpExpiresAt || tempUser.otp !== otp) {
    throw new Error("Invalid or expired OTP.");
  }

  if (!tempUser.password || tempUser.password.trim() === "") {
    throw new Error("No valid password found for registration.");
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
    console.log("ijijijj",user)

    if (!user || !user.password) {
      throw new Error("Invalid email or password");
    }
    if (user.status === "Blocked") {
      throw new Error("Your account has been blocked. Contact support.");
    }

    const isPasswordValid = await PasswordUtil.comparePasswords(
      password,
      user.password
    );
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
