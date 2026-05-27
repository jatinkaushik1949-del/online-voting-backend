const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
require("dotenv").config();

const Candidate = require("./models/Candidate");
const Election = require("./models/Election");
const User = require("./models/User");
const Vote = require("./models/Vote");

const app = express();

const getEmailUser = () => String(process.env.EMAIL_USER || "").trim();
const getEmailPass = () =>
  String(process.env.EMAIL_PASS || "")
    .trim()
    .replace(/\s+/g, "");
const getResendApiKey = () => String(process.env.RESEND_API_KEY || "").trim();
const getResendFromEmail = () =>
  String(process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev").trim();
const getGoogleMailScriptUrl = () =>
  String(process.env.GOOGLE_MAIL_SCRIPT_URL || "").trim();
const getGoogleMailScriptSecret = () =>
  String(process.env.GOOGLE_MAIL_SCRIPT_SECRET || "").trim();
const getAdminPassword = () => String(process.env.ADMIN_PASSWORD || "admin123").trim();
const getAdminTokenSecret = () =>
  String(process.env.ADMIN_TOKEN_SECRET || getAdminPassword()).trim();
const getAdminEmail = () =>
  String(process.env.ADMIN_EMAIL || "jatinkaushik1949@gmail.com").trim().toLowerCase();

const adminOtpStore = new Map();

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
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: getEmailUser(),
    pass: getEmailPass(),
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
});
transporter.verify((error, success) => {
  if (error) {
    console.log("Mail Error:", error);
  } else {
    console.log("Mail server ready");
  }
});

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const sendOtpEmail = async (toEmail, otp, name) => {
  if (getGoogleMailScriptUrl()) {
    const googleMailResponse = await fetch(getGoogleMailScriptUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: getGoogleMailScriptSecret(),
        to: toEmail,
        subject: "OTP Verification",
        text: `Hello ${name}, your OTP is ${otp}`,
      }),
    });

    if (!googleMailResponse.ok) {
      const errorText = await googleMailResponse.text();
      throw new Error(`Google mail script failed: ${errorText}`);
    }

    const googleMailData = await googleMailResponse.json();

    if (!googleMailData.success) {
      throw new Error(
        googleMailData.message || "Google mail script returned failure"
      );
    }

    return;
  }

  if (getResendApiKey()) {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getResendApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getResendFromEmail(),
        to: toEmail,
        subject: "OTP Verification",
        text: `Hello ${name}, your OTP is ${otp}`,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      throw new Error(`Resend email failed: ${errorText}`);
    }

    return;
  }

  const emailUser = getEmailUser();

  if (!emailUser || !getEmailPass()) {
    throw new Error("EMAIL_USER or EMAIL_PASS is missing");
  }

  await transporter.sendMail({
    from: emailUser,
    to: toEmail,
    subject: "OTP Verification",
    text: `Hello ${name}, your OTP is ${otp}`,
  });
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateAadhaar = (aadhaar) => /^\d{12}$/.test(aadhaar);
const validateMobile = (mobile) => /^\d{10}$/.test(mobile);

const getVoterPayload = (user) => ({
  name: user.name,
  email: user.email,
  voterId: user.voterId,
  aadhaar: user.aadhaar,
  mobile: user.mobile,
  hasVoted: user.hasVoted,
  votedParty: user.votedParty,
});

const getLatestElection = async () => {
  let election = await Election.findOne().sort({ createdAt: -1 });

  if (!election) {
    election = await Election.create({
      title: "National General Election 2026",
      status: "live",
      resultsPublished: false,
    });
  }

  return election;
};

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/api/test-route", (req, res) => {
  res.json({ success: true, message: "New backend code is live" });
});

app.get("/api/mail-status", async (req, res) => {
  try {
    if (getGoogleMailScriptUrl()) {
      return res.status(200).json({
        success: true,
        message: "Google mail script configured",
        provider: "google-mail-script",
        googleMailScriptUrlPresent: true,
        googleMailScriptSecretPresent: Boolean(getGoogleMailScriptSecret()),
      });
    }

    if (getResendApiKey()) {
      return res.status(200).json({
        success: true,
        message: "Resend email API configured",
        provider: "resend",
        resendFromEmailPresent: Boolean(getResendFromEmail()),
      });
    }

    const emailUser = getEmailUser();
    const emailPass = getEmailPass();

    if (!emailUser || !emailPass) {
      return res.status(500).json({
        success: false,
        message: "EMAIL_USER or EMAIL_PASS is missing",
        emailUserPresent: Boolean(emailUser),
        emailPassLength: emailPass.length,
      });
    }

    await transporter.verify();

    return res.status(200).json({
      success: true,
      message: "Mail server ready",
      provider: "gmail-smtp",
      emailUserPresent: true,
      emailPassLength: emailPass.length,
    });
  } catch (error) {
    console.log("Mail status error:", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message,
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Mail verification failed",
      code: error.code || "",
      responseCode: error.responseCode || "",
      provider: "gmail-smtp",
      googleMailScriptUrlPresent: Boolean(getGoogleMailScriptUrl()),
      resendApiKeyPresent: Boolean(getResendApiKey()),
      emailUserPresent: Boolean(getEmailUser()),
      emailPassLength: getEmailPass().length,
    });
  }
});

app.get("/api/election", async (req, res) => {
  try {
    const election = await getLatestElection();

    return res.status(200).json({
      success: true,
      election,
    });
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
    const cleanPassword = password ? String(password).trim() : "not-set";
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

    const existingUser = await User.findOne({
      $or: [
        { email: cleanEmail },
        { voterId: cleanVoterId },
        { aadhaar: cleanAadhaar },
        { mobile: cleanMobile },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email, Voter ID, Aadhaar or Mobile already registered",
      });
    }

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    let otpMessage = "OTP sent to your email. Please verify your email first.";

    try {
      await sendOtpEmail(cleanEmail, otp, cleanName);
    } catch (mailError) {
      console.log("OTP mail send error:", {
        code: mailError.code,
        responseCode: mailError.responseCode,
        message: mailError.message,
      });

      otpMessage = `OTP email could not be sent from the deployed server. Use this OTP to continue: ${otp}`;
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
      message: otpMessage,
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

    let otpMessage = "OTP resent successfully";

    try {
      await sendOtpEmail(user.email, otp, user.name);
    } catch (mailError) {
      console.log("Resend OTP mail error:", {
        code: mailError.code,
        responseCode: mailError.responseCode,
        message: mailError.message,
      });

      otpMessage = `OTP email could not be sent from the deployed server. Use this OTP to continue: ${otp}`;
    }

    user.otp = otp;
    user.otpExpiry = expiry;

    await user.save();

    return res.status(200).json({
      success: true,
      message: otpMessage,
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
      voter: getVoterPayload(user),
    });
  } catch (error) {
    console.log("Login error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/login/request-otp", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

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

    const loginOtp = generateOtp();
    const loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    let otpMessage = "Login OTP sent to your email";

    try {
      await sendOtpEmail(user.email, loginOtp, user.name);
    } catch (mailError) {
      console.log("Login OTP mail error:", {
        code: mailError.code,
        responseCode: mailError.responseCode,
        message: mailError.message,
      });

      otpMessage = `Login OTP email could not be sent from the deployed server. Use this OTP to continue: ${loginOtp}`;
    }

    user.loginOtp = loginOtp;
    user.loginOtpExpiry = loginOtpExpiry;

    await user.save();

    return res.status(200).json({
      success: true,
      message: otpMessage,
      email: user.email,
    });
  } catch (error) {
    console.log("Login OTP request error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/login/verify-otp", async (req, res) => {
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

    if (!user.loginOtp || user.loginOtp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid login OTP",
      });
    }

    if (!user.loginOtpExpiry || user.loginOtpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Login OTP expired",
      });
    }

    user.loginOtp = "";
    user.loginOtpExpiry = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login successful",
      voter: getVoterPayload(user),
    });
  } catch (error) {
    console.log("Login OTP verify error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password required",
      });
    }

    if (String(password).trim() === getAdminPassword()) {
      const otp = generateOtp();
      const expiresAt = Date.now() + 10 * 60 * 1000;
      let message = `Admin OTP sent to ${getAdminEmail()}`;

      adminOtpStore.set(getAdminEmail(), {
        otp,
        expiresAt,
      });

      try {
        await sendOtpEmail(getAdminEmail(), otp, "Admin");
      } catch (mailError) {
        console.log("Admin OTP mail error:", {
          code: mailError.code,
          responseCode: mailError.responseCode,
          message: mailError.message,
        });

        message = `Admin OTP email could not be sent. Use this OTP to continue: ${otp}`;
      }

      return res.status(200).json({
        success: true,
        message,
        otpRequired: true,
        adminEmail: getAdminEmail(),
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

app.get("/api/voters", requireAdminAuth, async (req, res) => {
  try {
    const voters = await User.find().select("-password -otp -loginOtp");

    return res.status(200).json({
      success: true,
      voters,
    });
  } catch (error) {
    console.log("Fetch voters error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.get("/api/admin/pending-voters", requireAdminAuth, async (req, res) => {
  try {
    const voters = await User.find({
      emailVerified: true,
      isApproved: false,
    }).select("-password -otp -loginOtp");

    return res.status(200).json({
      success: true,
      voters,
    });
  } catch (error) {
    console.log("Pending voters error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.post("/api/admin/approve", requireAdminAuth, async (req, res) => {
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
      message: "Server error",
    });
  }
});

app.post("/api/admin/candidates", requireAdminAuth, async (req, res) => {
  try {
    const { candidateName, partyName, symbolUrl, photoUrl, description } =
      req.body || {};

    if (!candidateName || !partyName) {
      return res.status(400).json({
        success: false,
        message: "Candidate name and party name are required",
      });
    }

    const election = await getLatestElection();

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
  try {
    const candidates = await Candidate.find({
      isActive: true,
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      candidates,
    });
  } catch (error) {
    console.error("Fetch candidates error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.get("/api/debug/all-candidates", requireAdminAuth, async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error("Debug all candidates error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.delete("/api/admin/candidates/:id", requireAdminAuth, async (req, res) => {
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
      message: "Server error",
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

    const existingVote = await Vote.findOne({ voterEmail: cleanEmail });

    if (existingVote) {
      if (existingUser.hasVoted) {
        return res.status(400).json({
          success: false,
          message: "You have already voted",
        });
      }

      await Vote.deleteOne({ _id: existingVote._id });
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
      message: "Server error",
    });
  }
});

const getElectionResults = async () => {
  return Vote.aggregate([
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
};

function createAdminToken() {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      exp: Date.now() + 12 * 60 * 60 * 1000,
    })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAdminTokenSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function isValidAdminToken(token) {
  if (!token || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", getAdminTokenSecret())
    .update(payload)
    .digest("base64url");

  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return false;
    }

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "admin" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!isValidAdminToken(token)) {
    return res.status(401).json({
      success: false,
      message: "Admin authentication required",
    });
  }

  next();
}

app.post("/api/public-results", async (req, res) => {
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

    if (!user || !user.emailVerified || !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Only verified approved voters can view published results",
      });
    }

    const election = await getLatestElection();

    if (!election.resultsPublished) {
      return res.status(403).json({
        success: false,
        message: "Results are not published yet",
        election,
      });
    }

    const results = await getElectionResults();
    const totalVotes = results.reduce(
      (sum, item) => sum + Number(item.votes || 0),
      0
    );
    const winner = results.length ? results[0] : null;

    return res.status(200).json({
      success: true,
      election,
      results,
      totalVotes,
      winner,
    });
  } catch (error) {
    console.log("Public results error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.post("/api/admin/verify-otp", (req, res) => {
  try {
    const { otp } = req.body || {};

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Admin OTP is required",
      });
    }

    const savedOtp = adminOtpStore.get(getAdminEmail());

    if (!savedOtp) {
      return res.status(400).json({
        success: false,
        message: "Admin OTP not requested",
      });
    }

    if (savedOtp.expiresAt < Date.now()) {
      adminOtpStore.delete(getAdminEmail());
      return res.status(400).json({
        success: false,
        message: "Admin OTP expired",
      });
    }

    if (String(otp).trim() !== savedOtp.otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin OTP",
      });
    }

    adminOtpStore.delete(getAdminEmail());

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token: createAdminToken(),
    });
  } catch (error) {
    console.log("Admin OTP verify error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

app.post("/api/admin/election", requireAdminAuth, async (req, res) => {
  try {
    const { title, status, resultsPublished } = req.body || {};

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
        resultsPublished: Boolean(resultsPublished),
      });
    } else {
      if (title) election.title = String(title).trim();
      if (status) election.status = String(status).trim();
      if (typeof resultsPublished === "boolean") {
        election.resultsPublished = resultsPublished;
      }
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
      message: "Election update failed",
    });
  }
});

app.post("/api/admin/reset", requireAdminAuth, async (req, res) => {
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
        status: "closed",
        resultsPublished: false,
      });
    } else {
      election.status = "closed";
      election.resultsPublished = false;
      await election.save();
    }

    return res.status(200).json({
      success: true,
      message: "Election reset successfully",
      election,
    });
  } catch (error) {
    console.error("Admin reset route crash:", error);

    return res.status(500).json({
      success: false,
      message: "Election reset failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
