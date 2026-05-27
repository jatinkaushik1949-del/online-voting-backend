const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: "" },
    mobile: { type: String, unique: true, sparse: true, trim: true },
    aadhaar: { type: String, unique: true, sparse: true, trim: true },
    voterId: { type: String, unique: true, sparse: true, trim: true },
    otp: { type: String, default: "" },
    otpExpiry: { type: Date, default: null },
    loginOtp: { type: String, default: "" },
    loginOtpExpiry: { type: Date, default: null },
    emailVerified: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    hasVoted: { type: Boolean, default: false },
    votedParty: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
