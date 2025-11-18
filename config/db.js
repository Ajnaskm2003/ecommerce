const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    // Prevent index get/drop errors before connection
    mongoose.set("autoIndex", false);
    mongoose.set("strictQuery", true);

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000,  // 15 sec timeout (recommended for EC2)
    });

    console.log("📌 MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
