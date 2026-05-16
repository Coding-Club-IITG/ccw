import mongoose from "mongoose";

const DailyChallengeSchema = new mongoose.Schema(
  {
    // Main window:  5:00 PM IST (11:30 UTC) → 4:59 PM IST next day (11:29 UTC)
    // Grace window: 4:59 PM IST next day    → 5:59 PM IST next day (12:29 UTC)
    windowStart: { type: Date, required: true }, // 11:30 UTC on challenge date
    windowEnd: { type: Date, required: true }, // 11:29 UTC next calendar day
    graceEnd: { type: Date, required: true }, // 12:29 UTC next calendar day
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

DailyChallengeSchema.index({ windowStart: 1 }, { unique: true });

export default mongoose.models.DailyChallenge ||
  mongoose.model("DailyChallenge", DailyChallengeSchema);
