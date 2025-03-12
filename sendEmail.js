import { Resend } from 'resend';

const resend = new Resend('re_JvV4qh9G_rCsWahN9FDQdWQyWNd55rARz'); // Remplace par ta vraie clé API Resend

async function sendTestEmail() {
  try {
    const response = await resend.emails.send({
      from: 'Acme <hello@i40pilot.app>', // Remplace par ton email validé sur Resend
      to: ['bagdadi.adam@gmail.com'], // Adresse du destinataire
      subject: 'Test depuis le terminal Bolt',
      html: '<p>Bonjour Adam, ceci est un test d\'envoi d\'email avec Resend 🚀</p>',
    });

    console.log("✅ Email envoyé avec succès :", response);
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi :", error);
  }
}

sendTestEmail();
