import { EmailTemplate } from '../types';

const API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://oee-app-bolt.onrender.com/send-email'
    : 'http://localhost:3000/send-email';

const SITE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://i40pilot.app'
    : 'http://localhost:5173';

console.log('[emailService] ✅ NODE_ENV:', process.env.NODE_ENV);
console.log('[emailService] ✅ API_URL:', API_URL);
console.log('[emailService] ✅ SITE_URL:', SITE_URL);

export const sendEmail = async (
  to: string,
  subject: string,
  template: EmailTemplate,
  data: any
) => {
  try {
    console.log('[sendEmail] 🔹 Preparing email for:', to);
    console.log('[sendEmail] 🔹 inviteUrl:', data.inviteUrl || '❌ MISSING');

    // Vérification de `inviteUrl`
    if (template === 'TEAM_INVITE' && !data.inviteUrl) {
      console.error('❌ [sendEmail] ERROR: `inviteUrl` is missing in request data.');
      return false;
    }

    // Génération du contenu HTML de l’email
    const html = generateEmailHtml(template, { ...data, siteUrl: SITE_URL });
    console.log('[sendEmail] ✅ Generated HTML:', html);

    // Envoi de l'email via l'API externe
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });

    console.log('[sendEmail] ⏳ Email request sent, awaiting response...');

    if (!response.ok) {
      const errorMessage = await response.text();
      console.error('[sendEmail] ❌ API Error:', response.status, errorMessage);
      throw new Error(`API Error ${response.status}: ${errorMessage}`);
    }

    console.log('[sendEmail] ✅ Email successfully sent to:', to);
    return true;
  } catch (error) {
    console.error('[sendEmail] ❌ Error sending email:', error);
    return false;
  }
};

// Génération du contenu HTML des emails
const generateEmailHtml = (template: EmailTemplate, data: any): string => {
  const { siteUrl } = data;
  console.log('[generateEmailHtml] 🔹 Using siteUrl:', siteUrl);

  switch (template) {
    case 'TEAM_INVITE':
      console.log('[generateEmailHtml] 🔹 inviteUrl:', data.inviteUrl || '❌ MISSING');
      return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">You've Been Invited!</h1>
          <p>Hi ${data.email || ''},</p>
          <p>
            You've been invited to join 
            <strong>${data.teamName || 'this project'}</strong> 
            as a <strong>${data.role || 'member'}</strong>.
          </p>
          <p>Click the link below to acceptt your invitation:</p>
          <p>
            <a href="/invite/${data.inviteUrl}" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Accept Invitation
            </a>
          </p>
          <p>If the button doesn't work, copy and paste this URL in your browser:</p>
          <p style="word-break: break-all; color: #555;">
            ${siteUrl}/invite/${data.inviteUrl}
          </p>
        </div>
      `;
    default:
      return '<p>No template found</p>';
  }
};
