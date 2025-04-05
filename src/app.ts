
import "reflect-metadata";
import express from "express";
const app = express();
import connectDB from "./config/dbconfig"; 
import userRoute from './routes/auth.routes';
import adminRoutes from "./routes/admin.routes";
const cors = require("cors");
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();


app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));


app.use(cookieParser());
app.use(express.json()); 

const PORT = process.env.PORT || 5000;

connectDB();

app.use("/admin", adminRoutes);
app.use("/api", userRoute);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});