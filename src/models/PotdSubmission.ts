import mongoose from "mongoose";

const POTDSubmissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyChallenge",
      required: true,
    },
    // Lifecycle:
    //   Pending   → not yet verified by manual sync or cron
    //   Accepted  → solved within main OR grace window (points > 0, streak++)
    //   Late      → solved after graceEnd (0 points, streak unaffected)
    //   NotSolved → cron confirmed no solve after grace + health-check cycle
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Late", "NotSolved"],
      default: "Pending",
    },
    solvedInGrace: { type: Boolean, default: false },
    pointsAwarded: { type: Number, default: 0 },
    solvedAt: { type: Date, default: null }, // CF submission timestamp (UTC)
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Ensure one record per (user, challenge) pair
POTDSubmissionSchema.index({ userId: 1, challengeId: 1 }, { unique: true });

// For cron: quickly fetch Pending submissions for a challenge
POTDSubmissionSchema.index({ challengeId: 1, status: 1 });

// For leaderboard aggregation
POTDSubmissionSchema.index({ challengeId: 1, pointsAwarded: 1 });

// For user profile solve history
POTDSubmissionSchema.index({ userId: 1, solvedAt: 1 });

export default mongoose.models.POTDSubmission ||
  mongoose.model("POTDSubmission", POTDSubmissionSchema);
