const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
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
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

const voterSchema = new mongoose.Schema(
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
      trim: true,
      lowercase: true,
    },
    voterId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    aadhaar: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      default: "",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationOtp: {
      type: String,
      default: "",
    },
    otpExpiresAt: {
      type: Date,
      default: null,
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

const voteSchema = new mongoose.Schema(
  {
    party: { type: String, required: true, trim: true },
    voterEmail: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

const electionSchema = new mongoose.Schema({
  title: { type: String, default: "National General Election 2026" },
  status: {
    type: String,
    enum: ["draft", "live", "closed"],
    default: "live",
  },
  createdAt: { type: Date, default: Date.now },
});

const Voter = mongoose.models.Voter || mongoose.model("Voter", voterSchema);
const Vote = mongoose.models.Vote || mongoose.model("Vote", voteSchema);
const Election =
  mongoose.models.Election || mongoose.model("Election", electionSchema);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const sendOtpEmail = async (toEmail, otp, name) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "Online Voting System - Email Verification OTP",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Email Verification</h2>
        <p>Hello ${name || "User"},</p>
        <p>Your verification OTP for Online Voting System is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
      </div>
    `,
  });
};

const validateEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateAadhaar = (aadhaar) =>
  /^\d{12}$/.test(aadhaar);

const validateMobile = (mobile) =>
  /^\d{10}$/.test(mobile);

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
    const { name, email, voterId, password, aadhaar, mobile } = req.body;

    if (!name || !email || !voterId || !aadhaar || !mobile) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanVoterId = String(voterId).trim();
    const cleanPassword = password ? String(password).trim() : "";
    const cleanAadhaar = String(aadhaar).trim();
    const cleanMobile = String(mobile).trim();

    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!validateAadhaar(cleanAadhaar)) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar number must be exactly 12 digits",
      });
    }

    if (!validateMobile(cleanMobile)) {
      return res.status(400).json({
        success: false,
        message: "Mobile number must be exactly 10 digits",
      });
    }

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

    const existingAadhaar = await Voter.findOne({ aadhaar: cleanAadhaar });
    if (existingAadhaar) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar already registered",
      });
    }

    const existingMobile = await Voter.findOne({ mobile: cleanMobile });
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already registered",
      });
    }

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    // mail pehle bhejo
    await sendOtpEmail(cleanEmail, otp, cleanName);

    // mail successful ho tabhi save karo
    const newVoter = new Voter({
      name: cleanName,
      email: cleanEmail,
      voterId: cleanVoterId,
      password: cleanPassword,
      aadhaar: cleanAadhaar,
      mobile: cleanMobile,
      emailVerified: false,
      verificationOtp: otp,
      otpExpiresAt: expiry,
      isApproved: false,
      hasVoted: false,
      votedParty: "",
    });

    await newVoter.save();

    return res.status(201).json({
      success: true,
      message: "Registration successful. OTP sent to email.",
      email: cleanEmail,
    });
  } catch (error) {
    console.log("Register error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});
app.post("/api/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const voter = await Voter.findOne({ email: cleanEmail });

    if (!voter) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (voter.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    if (!voter.verificationOtp || voter.verificationOtp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (!voter.otpExpiresAt || voter.otpExpiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    voter.emailVerified = true;
    voter.verificationOtp = "";
    voter.otpExpiresAt = null;
    await voter.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. Wait for admin approval.",
    });
  } catch (error) {
    console.log("Verify email error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/resend-otp", async (req, res) => {
  try {
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

    if (voter.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await sendOtpEmail(voter.email, otp, voter.name);

    voter.verificationOtp = otp;
    voter.otpExpiresAt = expiry;
    await voter.save();

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    console.log("Resend OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});
app.post("/api/login", async (req, res) => {
  try {
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

    if (!voter.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    if (!voter.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Your account is pending admin approval",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      voter: {
        name: voter.name,
        email: voter.email,
        voterId: voter.voterId,
        aadhaar: voter.aadhaar,
        mobile: voter.mobile,
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

app.post("/api/admin/login", (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password required",
      });
    }

    if (String(password).trim() === "admin123") {
      return res.status(200).json({
        success: true,
        message: "Login successful",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Wrong password",
    });
  } catch (error) {
    console.log("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/admin/approve", async (req, res) => {
  try {
    const { email } = req.body;

    const voter = await Voter.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!voter) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    voter.isApproved = true;
    await voter.save();

    return res.json({
      success: true,
      message: "User approved successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/vote", async (req, res) => {
  try {
    const { email, party } = req.body || {};

    if (!email || !party) {
      return res.status(400).json({
        success: false,
        message: "Email and party are required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanParty = String(party).trim();

    const voter = await Voter.findOne({ email: cleanEmail });

    if (!voter) {
      return res.status(404).json({
        success: false,
        message: "Voter not found",
      });
    }

    if (!voter.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email not verified",
      });
    }

    if (!voter.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Admin approval pending",
      });
    }

    if (voter.hasVoted) {
      return res.status(400).json({
        success: false,
        message: "You have already voted",
      });
    }

    let election = await Election.findOne().sort({ createdAt: -1 });

    if (!election) {
      election = await Election.create({
        title: "National General Election 2026",
        status: "live",
      });
    }

    if (election.status !== "live") {
      return res.status(400).json({
        success: false,
        message: "Voting is currently closed",
      });
    }

    const newVote = new Vote({
      party: cleanParty,
      voterEmail: cleanEmail,
    });

    await newVote.save();

    voter.hasVoted = true;
    voter.votedParty = cleanParty;
    await voter.save();

    return res.status(200).json({
      success: true,
      message: "Vote submitted successfully",
    });
  } catch (error) {
    console.error("Vote route crash:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Vote submit failed",
    });
  }
});

app.get("/api/results", async (req, res) => {
  try {
    const results = await Vote.aggregate([
      { $group: { _id: "$party", votes: { $sum: 1 } } },
      { $project: { _id: 0, party: "$_id", votes: 1 } },
      { $sort: { votes: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      results,
    });
  } catch (error) {
    console.log("Results error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.get("/api/voters", async (req, res) => {
  try {
    const voters = await Voter.find().select("-password -verificationOtp");
    return res.status(200).json({
      success: true,
      voters,
    });
  } catch (error) {
    console.log("Fetch voters error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/admin/election", async (req, res) => {
  try {
    const { title, status } = req.body || {};

    let election = await Election.findOne().sort({ createdAt: -1 });

    if (!election) {
      election = new Election({
        title: title ? String(title).trim() : "National General Election 2026",
        status: status || "live",
      });
    } else {
      if (title) election.title = String(title).trim();
      if (status) election.status = String(status).trim();
    }

    await election.save();

    return res.status(200).json({
      success: true,
      message: "Election updated successfully",
      election,
    });
  } catch (error) {
    console.error("Admin election route crash:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Election update failed",
    });
  }
});

app.post("/api/admin/reset", async (req, res) => {
  try {
    await Vote.deleteMany({});

    await Voter.updateMany(
      {},
      {
        $set: {
          hasVoted: false,
          votedParty: "",
        },
      }
    );

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
    console.error("Admin reset route crash:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Election reset failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});