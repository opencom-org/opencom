import { Resend } from "resend";

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      // from: "Opencom <noreply@support.opencom.dev>",
      from: process.env.EMAIL_FROM || "Opencom <noreply@support.opencom.dev>",
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error: "Failed to send email" };
  }
}

export const emailTemplates = {
  otpCode: (code: string) => ({
    subject: "Your Opencom verification code",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f5f5f5;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; color: #111;">Your verification code</h1>
            <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
              Enter this code to sign in to Opencom. It will expire in 10 minutes.
            </p>
            <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111;">${code}</span>
            </div>
            <p style="margin: 0; color: #888; font-size: 14px;">
              If you didn't request this code, you can safely ignore it.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  invitation: (workspaceName: string, inviterName: string, link: string) => ({
    subject: `You've been invited to ${workspaceName} on Opencom`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f5f5f5;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; color: #111;">You're invited!</h1>
            <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
              <strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on Opencom.
            </p>
            <a href="${link}" style="display: inline-block; background: #111; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
              Accept Invitation
            </a>
            <p style="margin: 24px 0 0; color: #888; font-size: 14px;">
              If you didn't expect this invitation, you can safely ignore it.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  passwordReset: (resetLink: string) => ({
    subject: "Reset your Opencom password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f5f5f5;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; color: #111;">Reset your password</h1>
            <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
              Click the button below to reset your password. This link will expire in 1 hour.
            </p>
            <a href="${resetLink}" style="display: inline-block; background: #111; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
              Reset Password
            </a>
            <p style="margin: 24px 0 0; color: #888; font-size: 14px;">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  workspaceAdded: (workspaceName: string, inviterName: string) => ({
    subject: `You've been added to ${workspaceName} on Opencom`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f5f5f5;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; color: #111;">You've been added to a workspace</h1>
            <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
              <strong>${inviterName}</strong> has added you to <strong>${workspaceName}</strong> on Opencom. You can now access this workspace from your account.
            </p>
            <p style="margin: 24px 0 0; color: #888; font-size: 14px;">
              Log in to Opencom to start collaborating.
            </p>
          </div>
        </body>
      </html>
    `,
  }),
};
