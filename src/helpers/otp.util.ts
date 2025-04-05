class OTPUtil {
    static generateOTP(): string {
      return Math.floor(100000 + Math.random() * 900000).toString(); 
    }
  }
  
  export default OTPUtil;
  