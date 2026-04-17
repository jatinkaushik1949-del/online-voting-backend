const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
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
    symbolUrl: {
      type: String,
      default: "",
      trim: true,
    },
    photoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Candidate || mongoose.model("Candidate", candidateSchema);