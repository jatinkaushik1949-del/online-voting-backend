<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const Vote = require("../models/Vote");
const User = require("../models/User");

// Cast vote
router.post("/cast", async (req, res) => {
  try {
    const { email, party } = req.body;
=======
import express from "express";
import User from "../models/User.js";
import Vote from "../models/Vote.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    let { email, party } = req.body;
>>>>>>> b0792a61 (connect frontend with backend and fix duplicate voting)

    if (!email || !party) {
      return res.status(400).json({ message: "Email and party are required" });
    }

<<<<<<< HEAD
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.hasVoted) {
      return res.status(400).json({ message: "You have already voted" });
    }

    const newVote = new Vote({
      email,
      party,
    });

    await newVote.save();

    user.hasVoted = true;
    await user.save();

    res.status(201).json({ message: "Vote cast successfully" });
=======
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
>>>>>>> b0792a61 (connect frontend with backend and fix duplicate voting)
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

<<<<<<< HEAD
// Get results
router.get("/results", async (req, res) => {
  try {
    const results = await Vote.aggregate([
      {
        $group: {
          _id: "$party",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          party: "$_id",
          count: 1,
        },
      },
    ]);

    res.json({ results });
=======
router.get("/results", async (req, res) => {
  try {
    const votes = await Vote.find();
    const users = await User.find();

    res.json({
      votes,
      totalVoters: users.length,
      votedUsers: users.filter((u) => u.hasVoted).map((u) => u.email),
    });
>>>>>>> b0792a61 (connect frontend with backend and fix duplicate voting)
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

<<<<<<< HEAD
module.exports = router;
=======
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
