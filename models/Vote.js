<<<<<<< HEAD
const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema(
  {
    voterEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    party: {
      type: String,
      required: true,
      enum: ["BJP", "CONGRESS", "BSP", "INLD"]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vote", voteSchema);
=======
import mongoose from "mongoose";

const voteSchema = new mongoose.Schema({
  party: {
    type: String,
    required: true,
    unique: true,
  },
  count: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model("Vote", voteSchema);
>>>>>>> b0792a61 (connect frontend with backend and fix duplicate voting)
