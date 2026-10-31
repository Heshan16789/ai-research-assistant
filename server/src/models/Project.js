import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Project title is required."],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters."],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters."],
      default: "",
    },

    researchQuestion: {
      type: String,
      trim: true,
      maxlength: [1000, "Research question cannot exceed 1000 characters."],
      default: "",
    },

    status: {
      type: String,
      enum: ["Planning", "In Progress", "Completed"],
      default: "Planning",
    },

    tags: {
      type: [String],
      default: [],
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ owner: 1, updatedAt: -1 });

const Project = mongoose.model("Project", projectSchema);

export default Project;