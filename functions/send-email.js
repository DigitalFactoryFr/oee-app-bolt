import express from 'express';
import { Resend } from 'resend';
import cors from 'cors';
import dotenv from 'dotenv';
import serverless from 'serverless-http';

dotenv.config();  // ✅ Charge les variables d’environnement

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Initialise Resend avec l'API Key stockée sur Netlify
const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/send-email', async (req, res) => {
  console.log("📩 Requête reçue :", req.body);

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
  }

  try {
    console.log("📨 Envoi de l'email via Resend...");
    const response = await resend.emails.send({
      from: 'Pilot <hello@i40pilot.app>',
      to: [to],
      subject,
      html,
    });

    console.log("✅ Email envoyé avec succès :", response);
    res.status(200).json({ message: 'Email envoyé avec succès', response });
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email :", error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email', error });
  }
});

// ✅ Exporte la fonction serverless
export const handler = serverless(app);
