import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    image: String,
    role: {
      type: String,
      enum: ["Secretary", "OC", "Core Team", "Member"],
      default: "Member",
    },
    moduleRoles: [
      {
        module: {
          type: String,
          enum: [
            "Software Development",
            "Competitive Programming",
            "Machine Learning",
            "Cybersecurity",
            "Design",
          ],
        },
        role: {
          type: String,
          enum: ["Head", "Senior Coordinator", "Coordinator", "Member"],
        },
      },
    ],
    codeforcesId: { type: String, default: "" },
    githubId: { type: String, default: "" },
    bio: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    msAccessToken: { type: String, default: "" },
    msRefreshToken: { type: String, default: "" },
    msTokenExpiresAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
