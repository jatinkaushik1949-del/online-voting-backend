<<<<<<< HEAD
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    aadhaar: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    hasVoted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
=======
import express from "express";
import User from "../models/User.js";
import Vote from "../models/Vote.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    let { email, party } = req.body;

    if (!email || !party) {
      return res.status(400).json({ message: "Email and party are required" });
    }

    email = email.trim().toLowerCase();
    party = party.trim().toUpperCase();

    const allowedParties = ["CONGRESS", "BJP", "BSP", "INLD"];

    if (!allowedParties.includes(party)) {
      return res.status(400).json({ message: "Invalid party" });
    }

    // Atomic update: only one request can flip hasVoted from false to true
    const user = await User.findOneAndUpdate(
      { email, hasVoted: false },
      { $set: { hasVoted: true } },
      { new: true }
    );

    if (!user) {
      const existingUser = await User.findOne({ email });

      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(400).json({ message: "User has already voted" });
    }

    await Vote.findOneAndUpdate(
      { party },
      { $inc: { count: 1 } },
      { upsert: true, new: true }
    );

    res.json({ message: "Vote submitted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/results", async (req, res) => {
  try {
    const votes = await Vote.find();
    const users = await User.find();

    res.json({
      votes,
      totalVoters: users.length,
      votedUsers: users.filter((u) => u.hasVoted).map((u) => u.email),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/reset", async (req, res) => {
  try {
    await Vote.deleteMany({});
    await User.updateMany({}, { hasVoted: false });

    res.json({ message: "Election reset successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
>>>>>>> b0792a61 (connect frontend with backend and fix duplicate voting)
