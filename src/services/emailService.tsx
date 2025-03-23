import { EmailTemplate } from '../types';

// Pour les tests, on fixe directement les URL (sans condition d'environnement)
const API_URL = 'https://oee-app-bolt.onrender.com/send-email';
const SITE_URL = 'https://i40pilot.app'; // Remplacez par votre URL de test si nécessaire

console.log('[emailService] Using fixed API_URL:', API_URL);
console.log('[emailService] Using fixed SITE_URL:', SITE_URL);

export const sendEmail = async (
  to: string,
  subject: string,
  template: EmailTemplate,
  data: any
): Promise<boolean> => {
  try {
    console.log('[sendEmail] Preparing email for:', to);
    console.log('[sendEmail] inviteUrl:', data.inviteUrl || '❌ MISSING');

    // Génération du HTML en injectant SITE_URL dans les données
    const html = generateEmailHtml(template, { ...data, siteUrl: SITE_URL });
    console.log('[sendEmail] Generated HTML:', html);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });

    console.log('[sendEmail] Email request sent, awaiting response...');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sendEmail] API Error:', response.status, errorText);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    console.log('[sendEmail] Email sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('[sendEmail] Error sending email:', error);
    return false;
  }
};

const generateEmailHtml = (template: EmailTemplate, data: any): string => {
  const { siteUrl } = data;
  console.log('[generateEmailHtml] Using siteUrl:', siteUrl);

  switch (template) {
    case 'WELCOME':
      return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome to Pilot!</h1>
          <p>Hi ${data.email},</p>
          <p>Welcome to Pilot! We're excited to help you optimize your industrial production.</p>
          <p>Get started by:</p>
          <ul>
            <li>Creating your first project</li>
            <li>Setting up your production lines</li>
            <li>Adding your machines and products</li>
          </ul>
          <p>
            <a href="${siteUrl}/projects/new" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Create Your First Project
            </a>
          </p>
          <p>Need help? Contact our support team anytime.</p>
        </div>
      `;



      
case 'TEAM_INVITE':
  // Construction du lien complet d'invitation
  const inviteLink = `${siteUrl}/invite/${data.inviteUrl}`;
  console.log('[generateEmailHtml] Final invite link:', inviteLink);
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">You've Been Invited!</h1>
      <p>Hi ${data.email || ''},</p>
      <p>
        You've been invited to join 
        <strong>${data.projectName || 'this project'}</strong> 
        as a <strong>${data.role || 'member'}</strong>
        ${data.team_name ? ' - Team: ' + data.team_name : ''}.
      </p>
      <p>Click the link below to accept your invitation:</p>
      <p>
        <a href="${inviteLink}" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Accept Invitation
        </a>
      </p>
    </div>
  `;



    case 'SUBSCRIPTION_STARTED':
      return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome to Pilot Pro!</h1>
          <p>Hi,</p>
          <p>Your Pro subscription has been activated for ${data.machineCount} machines.</p>
          <p>You now have access to:</p>
          <ul>
            <li>Unlimited production lines</li>
            <li>Advanced analytics</li>
            <li>Priority support</li>
          </ul>
          <p>Your next billing date is: ${new Date(data.nextBillingDate).toLocaleDateString()}</p>
          <p>
            <a href="${siteUrl}/dashboard" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Go to Dashboard
            </a>
          </p>
        </div>
      `;
    default:
      return '<p>No template found</p>';
  }
};
