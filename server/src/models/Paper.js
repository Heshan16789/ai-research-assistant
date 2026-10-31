import mongoose from "mongoose";

const paperSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Paper title is required."],
      trim: true,
      maxlength: 300,
    },

    authors: {
      type: [String],
      default: [],
    },

    abstract: {
      type: String,
      default: "",
      maxlength: 10000,
    },

    publicationYear: {
      type: Number,
      min: 1900,
      max: 2100,
    },

    venue: {
      type: String,
      trim: true,
      default: "",
    },

    doi: {
      type: String,
      trim: true,
      default: "",
    },

    keywords: {
      type: [String],
      default: [],
    },

    pdfUrl: {
      type: String,
      trim: true,
      default: "",
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
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

paperSchema.index({ owner: 1, project: 1 });

const Paper = mongoose.model("Paper", paperSchema);

export default Paper;