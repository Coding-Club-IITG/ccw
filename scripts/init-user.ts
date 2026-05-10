import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as readline from "readline";
import path from "path";

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in .env.local");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    role: {
      type: String,
      enum: ["Secretary", "OC", "Core Team", "Member"],
      default: "Member",
    },
    moduleRoles: { type: Array, default: [] },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function init() {
  try {
    console.log("🚀 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI!);
    console.log("✅ Connected.");

    rl.question("Enter email: ", async (email) => {
      rl.question("Enter name: ", async (name) => {
        rl.question("Enter role: ", async (role) => {
          const userData = {
            email: email.trim(),
            name: name.trim(),
            role: role.trim() || "Member",
            moduleRoles: [],
          };

          try {
            const user = await User.findOneAndUpdate(
              { email: userData.email },
              userData,
              { upsert: true, new: true },
            );
            console.log("\n✅ Success!");
            console.log("User Whitelisted:", user);
            console.log("\nYou can now log in via Microsoft with this email.");
          } catch (err) {
            console.error("❌ Error saving user:", err);
          } finally {
            mongoose.disconnect();
            rl.close();
          }
        });
      });
    });
  } catch (err) {
    console.error("❌ Connection error:", err);
    process.exit(1);
  }
}

init();
