<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");const express = require("express");
const router = express.Router();

module.exports = router;


const voterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  voterId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    default: "",
  },
  hasVoted: {
    type: Boolean,
    default: false,
  },
  votedParty: {
    type: String,
    default: "",
  },
});

const Voter = mongoose.models.Voter || mongoose.model("Voter", voterSchema);

router.post("/register", async (req, res) => {
  try {
    const { name, email, voterId, password } = req.body;

    if (!name || !email || !voterId) {
      return res.status(400).json({
        success: false,
        message: "Name, email and voter ID are required",
      });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanVoterId = String(voterId).trim();
    const cleanPassword = password ? String(password).trim() : "";

    const existingEmail = await Voter.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const existingVoterId = await Voter.findOne({ voterId: cleanVoterId });
    if (existingVoterId) {
      return res.status(400).json({
        success: false,
        message: "Voter ID already registered",
      });
    }

    const newVoter = new Voter({
      name: cleanName,
      email: cleanEmail,
      voterId: cleanVoterId,
      password: cleanPassword,
    });

    await newVoter.save();

    return res.status(201).json({
      success: true,
      message: "Registration successful",
    });
  } catch (error) {
    console.log("Register error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    console.log("AUTH EMAIL ONLY LOGIN HIT");

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const voter = await Voter.findOne({ email: cleanEmail });

    if (!voter) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      voter: {
        name: voter.name,
        email: voter.email,
        voterId: voter.voterId,
        hasVoted: voter.hasVoted,
      },
    });
  } catch (error) {
    console.log("Login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

module.exports = router;
=======
import express from "express";
import User from "../models/User.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    email = email.trim().toLowerCase();

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ email });
    }

    res.json({
      message: "Login successful",
      user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
>>>>>>> b0792a61 (connect frontend with backend and fix duplicate voting)
