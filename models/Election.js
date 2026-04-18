const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "National General Election 2026",
    },

    status: {
      type: String,
      enum: ["draft", "live", "closed"],
      default: "draft",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Election", electionSchema);