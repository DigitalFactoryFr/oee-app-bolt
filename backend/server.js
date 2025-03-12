import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config({ path: '../.env' }); // Charge le fichier .env depuis la racine

const app = express();
app.use(express.json());
app.use(cors());

// Initialise Resend avec la clé API
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

// Pour Render, le serveur doit écouter sur le port donné par Render (process.env.PORT)
// Si la variable PORT n'est pas définie (en local), on utilise 5000 par défaut
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
