import connectDB from "../config/dbconfig";
import { SubscriptionPlanModel } from "../models/SubscriptionPlan";
import mongoose from "mongoose";

const seedPlans = async () => {
  try {
    // Use the existing connectDB function to establish the connection
    await connectDB();

    const plans = [
      {
        name: "1 Month Plan",
        durationMonths: 1,
        price: 299,
        description: "Unlimited rides for 1 month",
      },
      {
        name: "6 Month Plan",
        durationMonths: 6,
        price: 1599,
        description: "Unlimited rides for 6 months",
      },
      {
        name: "1 Year Plan",
        durationMonths: 12,
        price: 2999,
        description: "Unlimited rides for 1 year",
      },
    ];

    await SubscriptionPlanModel.deleteMany({});
    await SubscriptionPlanModel.insertMany(plans);

    console.log("Subscription plans seeded successfully");
    mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding subscription plans:", error);
    mongoose.connection.close();
  }
};

seedPlans();