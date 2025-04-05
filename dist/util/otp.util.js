"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class OTPUtil {
    static generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
}
exports.default = OTPUtil;
