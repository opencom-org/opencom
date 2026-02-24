import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";
import { Resend as ResendAPI } from "resend";
import { DataModel } from "./_generated/dataModel";
import type { DatabaseWriter } from "./_generated/server";

// Custom Password provider with workspace creation on signup
const CustomPassword = Password<DataModel>({
  id: "password",
  profile(params) {
    const rawWorkspaceName = params.workspaceName as string | undefined;
    const workspaceName = rawWorkspaceName?.trim();
    return {
      email: (params.email as string).trim().toLowerCase(),
      name: (params.name as string | undefined)?.trim(),
      workspaceName: workspaceName && workspaceName.length > 0 ? workspaceName : undefined,
    };
  },
});

// Resend OTP provider for passwordless email authentication
const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY,
  maxAge: 60 * 10, // 10 minutes
  async generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Opencom <noreply@support.opencom.dev>",
      to: [email],
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
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111;">${token}</span>
              </div>
              <p style="margin: 0; color: #888; font-size: 14px;">
                If you didn't request this code, you can safely ignore it.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});

// Convex Auth setup with Password and Resend OTP providers
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [CustomPassword, ResendOTP],
  callbacks: {
    // Create workspace and membership when a new user signs up
    async createOrUpdateUser(ctx, args) {
      // Check if user already exists via this auth method
      if (args.existingUserId) {
        // Update existing user if needed
        const existingUser = await ctx.db.get(args.existingUserId);
        const profileName = args.profile.name as string | undefined; // profile.name is Record<string, unknown>
        if (existingUser && profileName && !existingUser.name) {
          await ctx.db.patch(args.existingUserId, { name: profileName });
        }
        return args.existingUserId;
      }

      const email = args.profile.email;
      if (!email) {
        throw new Error("Email is required for signup");
      }
      const normalizedEmail = email.toLowerCase().trim();
      const rawName = args.profile.name as string | undefined;
      const name = rawName?.trim() || undefined;
      const rawWorkspaceName = args.profile.workspaceName as string | undefined;
      const workspaceName = rawWorkspaceName?.trim() || undefined;

      // Typed database writer for schema-aware index queries
      const db = ctx.db as DatabaseWriter;

      // Check if user exists with same email (different auth method)
      // This enables linking OTP sign-in to existing password accounts
      const existingUserByEmail = await db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();

      if (existingUserByEmail) {
        // Link to existing user - update name if not set
        if (name && !existingUserByEmail.name) {
          await ctx.db.patch(existingUserByEmail._id, { name });
        }
        return existingUserByEmail._id;
      }

      // New user - create workspace and membership
      const now = Date.now();
      const defaultWorkspaceName = name
        ? `${name}'s Workspace`
        : `${normalizedEmail.split("@")[0]}'s Workspace`;
      const resolvedWorkspaceName =
        workspaceName && workspaceName.length > 0 ? workspaceName : defaultWorkspaceName;

      // Create workspace
      const workspaceId = await ctx.db.insert("workspaces", {
        name: resolvedWorkspaceName,
        createdAt: now,
        helpCenterAccessPolicy: "public",
      });

      // Create user
      const userId = await ctx.db.insert("users", {
        email: normalizedEmail,
        name,
        workspaceId,
        role: "admin",
        createdAt: now,
      });

      // Create workspace membership
      await ctx.db.insert("workspaceMembers", {
        userId,
        workspaceId,
        role: "admin",
        createdAt: now,
      });

      // Process any pending invitations using index-based lookup
      const pendingInvitations = await db
        .query("workspaceInvitations")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();

      for (const invitation of pendingInvitations) {
        await ctx.db.insert("workspaceMembers", {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
          createdAt: now,
        });
        await ctx.db.patch(invitation._id, { status: "accepted" });
      }

      return userId;
    },
  },
});
