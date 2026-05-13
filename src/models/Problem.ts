import mongoose from "mongoose";

const ProblemSchema = new mongoose.Schema(
  {
    cfContestId: { type: Number, required: true },
    cfIndex: { type: String, required: true }, // e.g. "A", "B1"
    name: { type: String, required: true },
    rating: { type: Number, default: 0 },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

// Unique compound index — same problem can't be cached twice
ProblemSchema.index({ cfContestId: 1, cfIndex: 1 }, { unique: true });

export default mongoose.models.Problem ||
  mongoose.model("Problem", ProblemSchema);
