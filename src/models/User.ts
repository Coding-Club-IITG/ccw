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
    
    // POTD & CF Verification
    cfVerified: { type: Boolean, default: false },
    cfVerificationToken: { type: String, default: "" },
    cfVerificationRequestedAt: { type: Date },
    potdTotalPoints: { type: Number, default: 0 },
    potdCurrentStreak: { type: Number, default: 0 },
    potdLongestStreak: { type: Number, default: 0 },
    potdTotalSolved: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
