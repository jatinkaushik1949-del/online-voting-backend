const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.log("MongoDB connection error:", err);
  });

const voterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  voterId: { type: String, required: true, unique: true, trim: true },
  password: { type: String, default: "" },
  hasVoted: { type: Boolean, default: false },
  votedParty: { type: String, default: "" },
});

const voteSchema = new mongoose.Schema(
  {
    party: { type: String, required: true, trim: true },
    voterEmail: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

const electionSchema = new mongoose.Schema({
  title: { type: String, default: "National General Election 2026" },
  status: { type: String, enum: ["draft", "live", "closed"], default: "live" },
  createdAt: { type: Date, default: Date.now },
});

const Voter = mongoose.models.Voter || mongoose.model("Voter", voterSchema);
const Vote = mongoose.models.Vote || mongoose.model("Vote", voteSchema);
const Election = mongoose.models.Election || mongoose.model("Election", electionSchema);

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/api/election", async (req, res) => {
  try {
    let election = await Election.findOne().sort({ createdAt: -1 });

    if (!election) {
      election = await Election.create({
        title: "National General Election 2026",
        status: "live",
      });
    }

    return res.status(200).json({ success: true, election });
  } catch (error) {
    console.log("Election fetch error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/register", async (req, res) => {
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
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const existingVoterId = await Voter.findOne({ voterId: cleanVoterId });
    if (existingVoterId) {
      return res.status(400).json({ success: false, message: "Voter ID already registered" });
    }

    const newVoter = new Voter({
      name: cleanName,
      email: cleanEmail,
      voterId: cleanVoterId,
      password: cleanPassword,
    });

    await newVoter.save();

    return res.status(201).json({ success: true, message: "Registration successful" });
  } catch (error) {
    console.log("Register error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const voter = await Voter.findOne({ email: cleanEmail });

    if (!voter) {
      return res.status(404).json({ success: false, message: "User not found" });
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
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

app.post("/api/admin/login", (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: "Password required" });
    }

    if (String(password).trim() === "admin123") {
      return res.status(200).json({ success: true, message: "Login successful" });
    }

    return res.status(401).json({ success: false, message: "Wrong password" });
  } catch (error) {
    console.log("Admin login error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

app.post("/api/vote", async (req, res) => {
  try {
    const { email, party } = req.body;

    if (!email || !party) {
      return res.status(400).json({ success: false, message: "Email and party are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanParty = String(party).trim();

    const voter = await Voter.findOne({ email: cleanEmail });

    if (!voter) {
      return res.status(404).json({ success: false, message: "Voter not found" });
    }

    if (voter.hasVoted) {
      return res.status(400).json({ success: false, message: "You have already voted" });
    }

    let election = await Election.findOne().sort({ createdAt: -1 });

    if (!election) {
      election = await Election.create({
        title: "National General Election 2026",
        status: "live",
      });
    }

    if (election.status !== "live") {
      return res.status(400).json({ success: false, message: "Voting is currently closed" });
    }

    const newVote = new Vote({
      party: cleanParty,
      voterEmail: cleanEmail,
    });

    await newVote.save();

    voter.hasVoted = true;
    voter.votedParty = cleanParty;
    await voter.save();

    return res.status(200).json({ success: true, message: "Vote submitted successfully" });
  } catch (error) {
    console.log("Vote error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

app.get("/api/results", async (req, res) => {
  try {
    const results = await Vote.aggregate([
      { $group: { _id: "$party", votes: { $sum: 1 } } },
      { $project: { _id: 0, party: "$_id", votes: 1 } },
      { $sort: { votes: -1 } },
    ]);

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.log("Results error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

app.get("/api/voters", async (req, res) => {
  try {
    const voters = await Voter.find().select("-password");
    return res.status(200).json({ success: true, voters });
  } catch (error) {
    console.log("Fetch voters error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

app.post("/api/admin/election", async (req, res) => {
  try {
    const { title, status } = req.body;

    let election = await Election.findOne().sort({ createdAt: -1 });

    if (!election) {
      election = new Election({
        title: title ? String(title).trim() : "National General Election 2026",
        status: status || "live",
      });
    } else {
      if (title) election.title = String(title).trim();
      if (status) election.status = status;
    }

    await election.save();

    return res.status(200).json({
      success: true,
      message: "Election updated successfully",
      election,
    });
  } catch (error) {
    console.log("Election update error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

app.post("/api/admin/reset", async (req, res) => {
  try {
    await Vote.deleteMany({});
    await Voter.updateMany({}, { $set: { hasVoted: false, votedParty: "" } });

    let election = await Election.findOne().sort({ createdAt: -1 });

    if (!election) {
      election = await Election.create({
        title: "National General Election 2026",
        status: "draft",
      });
    } else {
      election.status = "draft";
      await election.save();
    }

    return res.status(200).json({
      success: true,
      message: "Election reset successfully",
    });
  } catch (error) {
    console.log("Election reset error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});