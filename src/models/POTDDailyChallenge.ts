import mongoose from "mongoose";

const DailyChallengeSchema = new mongoose.Schema(
  {
    // Window: 12:00 AM IST (18:30 UTC prev day) -> 11:59 PM IST (18:29 UTC)
    // Grace:  11:59 PM IST -> ~1:00 AM IST next day (19:29 UTC)
    windowStart: { type: Date, required: true }, // 18:30 UTC on day-1
    windowEnd: { type: Date, required: true }, // 18:29 UTC on challenge date
    graceEnd: { type: Date, required: true }, // 19:29 UTC on challenge date
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
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

// Each difficulty level can appear at most once per day
DailyChallengeSchema.index({ windowStart: 1, difficulty: 1 }, { unique: true });

export default mongoose.models.DailyChallenge ||
  mongoose.model("DailyChallenge", DailyChallengeSchema);
