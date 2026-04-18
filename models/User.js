const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    mobile: {
      type: String,
      default: "",
    },

    aadhaar: {
      type: String,
      default: "",
    },

    voterId: {
      type: String,
      default: "",
    },

    otp: {
      type: String,
      default: "",
    },

    otpExpiry: {
      type: Date,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    hasVoted: {
      type: Boolean,
      default: false,
    },

    votedParty: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);