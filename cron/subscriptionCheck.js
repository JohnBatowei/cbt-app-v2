const cron = require("node-cron");
const mongoose = require("mongoose");
const User = require("../models/admin"); // adjust path to your model
const sendEmail = require("../utils/sendEmail"); // your email helper
const dotEnd = require('dotenv');
dotEnd.config();

// Connect to MongoDB
const uri = process.env.mongodb_URI || process.env.mongodb_url;

mongoose.connect(uri)
  .then(() => console.log("Worker connected to MongoDB"))
  .catch(err => console.error("Worker DB connection error:", err));

function calculateDaysLeft(subscriptionEnd) {
  const now = new Date();
  const expiry = new Date(subscriptionEnd);
  const diff = expiry - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)); // days left
}

// 🕛 Run every midnight
cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Running daily subscription check...");

  // ✅ Fetch only users or triers, not admins
  const users = await User.find({
    subscriptionActive: true,
    role: { $in: ["user", "trier"] },
  });

  for (const user of users) {
    const daysLeft = calculateDaysLeft(user.subscriptionEnd);

    if (daysLeft === 5) {
      await sendEmail(
        user.email,
        "Your subscription will expire in 5 days",
        "Please renew your subscription to avoid service interruption."
      );
    }

    if (daysLeft === 0) {
      await sendEmail(
        user.email,
        "Your subscription has expired",
        "Your account will be disabled within hours if not renewed."
      );
    }

    if (daysLeft < 0 && Math.abs(daysLeft) >= 1) {
      user.subscriptionActive = false;
      user.isSuspended = true;
      await user.save();
      console.log(`❌ Disabled account: ${user.email}`);
    }
  }
});

console.log("✅ Cron worker started and running...");
