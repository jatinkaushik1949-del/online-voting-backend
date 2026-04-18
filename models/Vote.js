const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
    },

    candidateName: {
      type: String,
      required: true,
      trim: true,
    },

    partyName: {
      type: String,
      required: true,
      trim: true,
    },

    voterEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vote", voteSchema);