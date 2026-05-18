import mongoose from "mongoose";

const CFUserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Codeforces profile
    handle: {
      type: String,
      required: true,
      unique: true,
    },
    rating: {
      type: Number,
      default: 0,
    },
    rank: {
      type: String,
      default: "Unrated",
    },
    maxRating: {
      type: Number,
      default: 0,
    },
    maxRank: {
      type: String,
      default: "Unrated",
    },
    avatar: {
      type: String,
      default: "",
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },

    // CF handle verification
    cfVerified: {
      type: Boolean,
      default: false,
    },
    cfVerificationToken: {
      type: String,
      default: "",
    },
    cfVerificationRequestedAt: {
      type: Date,
      default: null,
    },

    // POTD stats
    potdTotalPoints: {
      type: Number,
      default: 0,
    },
    potdCurrentStreak: {
      type: Number,
      default: 0,
    },
    potdLongestStreak: {
      type: Number,
      default: 0,
    },
    potdTotalSolved: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

export default mongoose.models.CFUser || mongoose.model("CFUser", CFUserSchema);
