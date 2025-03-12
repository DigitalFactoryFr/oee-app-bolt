import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config({ path: '../.env' });

const app = express();
app.use(express.json());
app.use(cors());



// Initialise Resend
const RESEND_API_KEY = new Resend(process.env.RESEND_API_KEY);

app.post("/send-email", async (req, res) => {
  console.log("📩 Requête reçue :", req.body);

  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ message: "Paramètres manquants" });
  }

  try {
    console.log("📨 Envoi de l'email via Resend...");
    const response = await resend.emails.send({
      from: "Pilot <hello@i40pilot.app>",
      to: [to],
      subject,
      html,
    });
    console.log("✅ Email envoyé :", response);
    res.status(200).json({ message: "Email envoyé avec succès", response });
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email :", error);
    res.status(500).json({ message: "Erreur lors de l'envoi de l'email", error });
  }
});

// Lancer le serveur sur le port spécifié (ou 4000 par défaut)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
