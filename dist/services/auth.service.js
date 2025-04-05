"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_repository_1 = __importDefault(require("../repositories/user.repository"));
const password_util_1 = __importDefault(require("../util/password.util"));
const sendOTP_util_1 = require("../util/sendOTP.util");
const tempUser_model_1 = __importDefault(require("../models/tempUser.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt_util_1 = require("../util/jwt.util");
class AuthService {
    // SIGNUP METHOD
    static signup(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("User Signup Data:", userData);
                // Check if user already exists in the main collection
                const existingUser = yield user_repository_1.default.findUserByEmail(userData.email);
                if (existingUser) {
                    throw new Error("User already exists.");
                }
                // Generate a 6-digit OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes
                // Store OTP in temp collection
                yield tempUser_model_1.default.findOneAndUpdate({ email: userData.email }, Object.assign(Object.assign({}, userData), { otp, otpExpiresAt }), // Update OTP & expiration time
                { upsert: true, new: true } // Create if not exists
                );
                // Send OTP to user email
                yield (0, sendOTP_util_1.sendOTP)(userData.email, otp);
                return { success: true, message: "OTP sent. Verify before registration." };
            }
            catch (error) {
                console.error("Signup Error:", error);
                throw new Error("Error during signup.");
            }
        });
    }
    // VERIFY OTP METHOD
    static verifyOTP(email, otp) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("OTP received:", otp);
                // Find user in temp collection
                const tempUser = yield tempUser_model_1.default.findOne({ email });
                if (!tempUser) {
                    throw new Error("OTP expired or user not found.");
                }
                // Check OTP expiration first
                if (new Date() > tempUser.otpExpiresAt) {
                    yield tempUser_model_1.default.deleteOne({ email });
                    throw new Error("OTP expired. Please request a new one.");
                }
                if (tempUser.otp.toString() !== otp.toString()) {
                    throw new Error("Invalid OTP.");
                }
                // Hash password before saving
                const hashedPassword = yield password_util_1.default.hashPassword(tempUser.password);
                // Move user to main collection
                const newUser = yield user_model_1.default.create({
                    fullName: tempUser.fullName,
                    email: tempUser.email,
                    phoneNumber: tempUser.phoneNumber,
                    password: hashedPassword,
                });
                // Delete temporary user
                yield tempUser_model_1.default.deleteOne({ email });
                return { success: true, message: "User registered successfully", user: newUser };
            }
            catch (error) {
                if (error instanceof Error) {
                    throw new Error(error.message);
                }
                throw new Error("Error verifying OTP.");
            }
        });
    }
    static login(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield user_repository_1.default.findUserByEmail(email);
            if (!user)
                return null;
            const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
            if (!isPasswordValid)
                return null;
            return (0, jwt_util_1.generateToken)(user._id.toString(), user.email);
        });
    }
}
exports.default = AuthService;
