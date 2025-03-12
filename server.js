import express from 'express';
import { Resend } from 'resend';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();  // ✅ Charge les variables d’environnement

const app = express();
app.use(express.json());
app.use(cors());

const resend = new Resend(process.env.RESEND_API_KEY);  // ✅ Sécurisé avec .env

// 🛠 Ajoute cette ligne pour voir si la route est bien enregistrée
console.log("📢 Routes disponibles avant l'ajout de la route :");
app._router?.stack?.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`➡️ ${r.route.path}`);
  }
});

// ✅ Enregistre bien la route `/api/send-email`
app.post('/api/send-email', async (req, res) => {
  console.log("📩 Requête reçue sur /api/send-email :", req.body);

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    console.log("❌ Champs manquants !");
    return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
  }

  try {
    console.log("📨 Envoi de l'email via Resend...");
    const response = await resend.emails.send({
      from: 'Pilot <hello@i40pilot.app>',  // ✅ Vérifie que ce domaine est validé sur Resend
      to: [to],  // ✅ Resend attend un tableau ici
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

// 🛠 Vérifie à nouveau si la route est bien enregistrée après l'ajout
console.log("📢 Routes disponibles après l'ajout de la route :");
app._router?.stack?.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`➡️ ${r.route.path}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur API démarré sur http://localhost:${PORT}`);
});

require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { priceId } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/cancel`,
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
