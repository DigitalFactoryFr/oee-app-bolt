import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config({ path: '../.env' }); 

const app = express();
app.use(express.json());
app.use(cors());

const resend = new Resend(process.env.RESEND_API_KEY);

// Email sending endpoint
app.post("/send-email", async (req, res) => {
  console.log("📩 Request received:", req.body);

  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ message: "Missing parameters" });
  }

  try {
    console.log("📨 Sending email via Resend...");
    const response = await resend.emails.send({
      from: "Pilot <hello@i40pilot.app>",
      to: [to],
      subject,
      html,
    });
    console.log("✅ Email sent:", response);
    res.status(200).json({ message: "Email sent successfully", response });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({ message: "Error sending email", error });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});