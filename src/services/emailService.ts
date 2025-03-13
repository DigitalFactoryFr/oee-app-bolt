import { EmailTemplate } from '../types';

const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://oee-app-bolt.onrender.com/send-email'
  : 'http://localhost:5000/send-email';

export const sendEmail = async (to: string, subject: string, template: EmailTemplate, data: any) => {
  try {
    const html = generateEmailHtml(template, data);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html })
    });

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${await response.text()}`);
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

const generateEmailHtml = (template: EmailTemplate, data: any): string => {
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
          <p>Need help? Contact our support team anytime.</p>
        </div>
      `;

    case 'TEAM_INVITE':
      return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">You've Been Invited!</h1>
          <p>Hi,</p>
          <p>You've been invited to join the ${data.projectName} team as a ${data.role}.</p>
          <p>Click the link below to accept your invitation:</p>
          <a href="${data.inviteUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Accept Invitation
          </a>
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
        </div>
      `;

    case 'MACHINE_LIMIT_WARNING':
      return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #eab308;">Machine Limit Warning</h1>
          <p>Hi,</p>
          <p>You're approaching your machine limit on the free plan (${data.currentCount}/${data.limit} machines).</p>
          <p>To add more machines, please upgrade to our Pro plan.</p>
          <a href="${data.upgradeUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Upgrade Now
          </a>
        </div>
      `;

    case 'PAYMENT_FAILED':
      return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Payment Failed</h1>
          <p>Hi,</p>
          <p>We were unable to process your latest payment for Pilot Pro.</p>
          <p>Please update your payment method to avoid service interruption.</p>
          <a href="${data.billingUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Update Payment Method
          </a>
        </div>
      `;

    default:
      return '';
  }
};