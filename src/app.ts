import "reflect-metadata";
import express from "express";
import connectDB from "./config/dbconfig";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import routeRoutes from "./routes/route.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import walletRoutes from "./routes/wallet.routes";
import trackingRoutes from "./routes/tracking.routes";
import notificationRoutes from "./routes/notification.routes";
import chatRoutes from "./routes/chat.routes";
import { errorMiddleware } from "./middlewares/errorMiddleware";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { initializeSocket } from "./websocket/socket.io";
import initiateRideRoutes from "./routes/initiate-ride.routes";
import joinRideRoutes from "./routes/join-ride.routes";
import logger from "./config/logger";
import cron from 'node-cron';
import  container  from "./di/container"; // Adjust path as needed
import { DocumentExpiryCron } from "./cron/document-expiry.cron"; // Adjust path as needed

dotenv.config();

const app = express();

const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Driver-Id"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/admin", adminRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes); 
app.use("/api/initiate-rides", initiateRideRoutes);
app.use("/api/join-rides", joinRideRoutes);

app.use(errorMiddleware);

const PORT = process.env.PORT || 3001;

connectDB();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT"],
    credentials: true,
  },
});

initializeSocket(io);

// Setup Cron Jobs
const setupCronJobs = () => {
  try {
    // Run daily at 9 AM for document expiry checks
    cron.schedule('0 9 * * *', async () => {
      logger.info('Running document expiry cron job');
      const documentExpiryCron = container.get<DocumentExpiryCron>(DocumentExpiryCron);
      await documentExpiryCron.checkDocumentExpiry();
    });

    logger.info('Cron jobs initialized successfully');
  } catch (error) {
    logger.error('Error initializing cron jobs:', error);
  }
};

httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT} with WebSocket`);
  setupCronJobs();
});

export { app, io, httpServer };