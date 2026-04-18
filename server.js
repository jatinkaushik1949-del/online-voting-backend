const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const Candidate = require("./models/Candidate");
const Election = require("./models/Election");
const User = require("./models/User");
const Vote = require("./models/Vote");

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

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateAadhaar = (aadhaar) => /^\d{12}$/.test(aadhaar);
const validateMobile = (mobile) => /^\d{10}$/.test(mobile);

const getLatestElection = async () => {
  let election = await Election.findOne().sort({ createdAt: -1 });

  if (!election) {
    election = await Election.create({
      title: "National General Election 2026",
      status: "live",
    });
  }

  return election;
};

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/api/election", async (req, res) => {
  try {
    const election = await getLatestElection();
    return res.status(200).json({ success: true, election });
  } catch (error) {
    console.log("Election fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, voterId, password, aadhaar, mobile } = req.body || {};

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

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const existingVoterId = await User.findOne({ voterId: cleanVoterId });
    if (existingVoterId) {
      return res.status(400).json({
        success: false,
        message: "Voter ID already registered",
      });
    }

    const existingAadhaar = await User.findOne({ aadhaar: cleanAadhaar });
    if (existingAadhaar) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar already registered",
      });
    }

    const existingMobile = await User.findOne({ mobile: cleanMobile });
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already registered",
      });
    }

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    try {
      await sendOtpEmail(cleanEmail, otp, cleanName);
    } catch (mailError) {
      console.log("OTP mail send error:", mailError);
      return res.status(500).json({
        success: false,
        message: "OTP email could not be sent. Check EMAIL_USER / EMAIL_PASS.",
      });
    }

    const newUser = new User({
      name: cleanName,
      email: cleanEmail,
      voterId: cleanVoterId,
      password: cleanPassword,
      aadhaar: cleanAadhaar,
      mobile: cleanMobile,
      otp,
      otpExpiry: expiry,
      emailVerified: false,
      isApproved: false,
      hasVoted: false,
      votedParty: "",
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "OTP sent to your email. Please verify your email first.",
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
    const { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    if (!user.otp || user.otp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    user.emailVerified = true;
    user.otp = "";
    user.otpExpiry = null;
    await user.save();

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
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    try {
      await sendOtpEmail(user.email, otp, user.name);
    } catch (mailError) {
      console.log("Resend OTP mail error:", mailError);
      return res.status(500).json({
        success: false,
        message: "OTP email could not be sent. Check EMAIL_USER / EMAIL_PASS.",
      });
    }

    user.otp = otp;
    user.otpExpiry = expiry;
    await user.save();

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
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Your account is pending admin approval",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      voter: {
        name: user.name,
        email: user.email,
        voterId: user.voterId,
        aadhaar: user.aadhaar,
        mobile: user.mobile,
        hasVoted: user.hasVoted,
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
    const { password } = req.body || {};

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
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "User email is not verified yet",
      });
    }

    user.isApproved = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User approved successfully",
    });
  } catch (error) {
    console.log("Approve error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/admin/candidates", async (req, res) => {
  try {
    const { candidateName, partyName, symbolUrl, photoUrl, description } =
      req.body || {};

    console.log("ADD CANDIDATE BODY:", req.body);

    if (!candidateName || !partyName) {
      return res.status(400).json({
        success: false,
        message: "Candidate name and party name are required",
      });
    }

    const election = await getLatestElection();
    console.log("LATEST ELECTION FOR ADD:", election);

    const candidate = new Candidate({
      electionId: election._id,
      candidateName: String(candidateName).trim(),
      partyName: String(partyName).trim(),
      symbolUrl: symbolUrl ? String(symbolUrl).trim() : "",
      photoUrl: photoUrl ? String(photoUrl).trim() : "",
      description: description ? String(description).trim() : "",
      isActive: true,
    });

    await candidate.save();
    console.log("CANDIDATE SAVED:", candidate);

    return res.status(201).json({
      success: true,
      message: "Candidate added successfully",
      candidate,
    });
  } catch (error) {
    console.error("Add candidate error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.get("/api/candidates", async (req, res) => {
  console.log("CANDIDATES API HIT");

  try {
    const election = await getLatestElection();
    console.log("Election found:", election);

    const candidates = await Candidate.find({
      electionId: election._id,
      isActive: true,
    }).sort({ createdAt: 1 });

    console.log("Candidates found:", candidates);

    return res.status(200).json({
      success: true,
      candidates,
    });
  } catch (error) {
    console.error("Fetch candidates error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});
app.get("/api/debug/all-candidates", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error("Debug all candidates error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.delete("/api/admin/candidates/:id", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    await Candidate.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Candidate deleted successfully",
    });
  } catch (error) {
    console.error("Delete candidate error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/vote", async (req, res) => {
  try {
    const { email, candidateId } = req.body || {};

    if (!email || !candidateId) {
      return res.status(400).json({
        success: false,
        message: "Email and candidate are required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const election = await getLatestElection();

    if (election.status !== "live") {
      return res.status(400).json({
        success: false,
        message: "Voting is currently closed",
      });
    }

    const candidate = await Candidate.findById(candidateId);

    if (!candidate || !candidate.isActive) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        email: cleanEmail,
        emailVerified: true,
        isApproved: true,
        hasVoted: false,
      },
      {
        $set: {
          hasVoted: true,
          votedParty: candidate.partyName,
        },
      },
      { new: true }
    );

    if (!user) {
      const existingUser = await User.findOne({ email: cleanEmail });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "Voter not found",
        });
      }

      if (!existingUser.emailVerified) {
        return res.status(403).json({
          success: false,
          message: "Email not verified",
        });
      }

      if (!existingUser.isApproved) {
        return res.status(403).json({
          success: false,
          message: "Admin approval pending",
        });
      }

      if (existingUser.hasVoted) {
        return res.status(400).json({
          success: false,
          message: "You have already voted",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Voting failed",
      });
    }

    try {
      const newVote = new Vote({
        candidateId: candidate._id,
        candidateName: candidate.candidateName,
        partyName: candidate.partyName,
        voterEmail: cleanEmail,
      });

      await newVote.save();
    } catch (voteError) {
      await User.updateOne(
        { email: cleanEmail },
        {
          $set: {
            hasVoted: false,
            votedParty: "",
          },
        }
      );

      if (voteError && voteError.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "You have already voted",
        });
      }

      throw voteError;
    }

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
      {
        $group: {
          _id: {
            candidateId: "$candidateId",
            candidateName: "$candidateName",
            partyName: "$partyName",
          },
          votes: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          candidateId: "$_id.candidateId",
          candidateName: "$_id.candidateName",
          partyName: "$_id.partyName",
          votes: 1,
        },
      },
      { $sort: { votes: -1, candidateName: 1 } },
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
    const voters = await User.find().select("-password -otp");
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

    if (status && !["draft", "live", "closed"].includes(String(status).trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid election status",
      });
    }

    let election = await Election.findOne().sort({ createdAt: -1 });

    if (!election) {
      election = new Election({
        title: title ? String(title).trim() : "National General Election 2026",
        status: status ? String(status).trim() : "live",
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

    await User.updateMany(
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
app.get("/api/test-route", (req, res) => {
  res.json({ success: true, message: "New backend code is live" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});