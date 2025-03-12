import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

// Charge les variables d'environnement dès le début.
dotenv.config({ path: '../.env' });

const app = express();
app.use(express.json());
app.use(cors());

// Forcer le port 5000 (pour le test local)
const PORT = 5000;

const resend = new Resend(process.env.RESEND_API_KEY);

// Route POST /send-email
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

// Démarre le serveur sur l'adresse 0.0.0.0 pour être accessible de l'extérieur
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
