import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

const app = express();
const PORT = process.env.PORT || 5000;

dotenv.config({ path: '../.env' }); 


app.use(express.json());
app.use(cors());

const resend = new Resend(process.env.RESEND_API_KEY);

// 3. Route POST /send-email
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

// 4. Lance le serveur sur process.env.PORT (assigné par Render ou Heroku)
//    ou 5000 en fallback local.

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
