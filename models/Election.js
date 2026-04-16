const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["draft", "live", "closed"],
      default: "draft"
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Election", electionSchema);