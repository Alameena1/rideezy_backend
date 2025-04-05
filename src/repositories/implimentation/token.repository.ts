import mongoose from "mongoose";

const TokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

TokenSchema.index({ expiresAt: 1 });

const TokenModel = mongoose.model("Token", TokenSchema);

class TokenRepository {
 
  static async replaceToken(userId: string, newToken: string) {
  
    const updatedToken = await TokenModel.findOneAndUpdate(
      { userId }, 
      { 
        token: newToken, 
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
      },
      { upsert: true, new: true }
    );
  
    return updatedToken;
  }
  


  static async findToken(token: string) {
  
    let storedToken = await TokenModel.findOne({ token, expiresAt: { $gt: new Date() } });
  
    if (!storedToken) {
      console.log(await TokenModel.find({})); 
      return null;
    }
  
    return storedToken;
  }
  


  static async deleteToken(token: string) {
    console.log("🗑 Deleting token:", token);
  
    const deleted = await TokenModel.deleteOne({ token });
    console.log("🛑 Token deletion result:", deleted);
    
    return deleted;
  }
  

  
  static async deleteUserTokens(userId: string) {
    return TokenModel.deleteMany({ userId });
  }
}

export default TokenRepository;
