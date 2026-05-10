import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
  title: string;
  description: string;
  date: Date;
  module:
    | "Software Development"
    | "Competitive Programming"
    | "Machine Learning"
    | "Cybersecurity"
    | "Design"
    | "General";
  status: "Upcoming" | "Completed";
  link?: string;
  tags: string[];
}

const ProjectSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    module: {
      type: String,
      enum: [
        "Software Development",
        "Competitive Programming",
        "Machine Learning",
        "Cybersecurity",
        "Design",
        "General",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["Upcoming", "Completed"],
      required: true,
    },
    link: { type: String },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

export default mongoose.models.Project ||
  mongoose.model<IProject>("Project", ProjectSchema);
