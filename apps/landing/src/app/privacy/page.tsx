import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { createLandingPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createLandingPageMetadata({
  title: "Privacy Policy | Opencom",
  description:
    "Opencom privacy policy covering hosted web, mobile apps, widget, and React Native SDK data handling.",
  path: "/privacy",
});

const effectiveDate = "February 21, 2026";

export default function PrivacyPage() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="mx-auto w-full max-w-5xl px-6 lg:px-8">
        <header className="mb-10 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.6)] backdrop-blur md:p-10 dark:border-white/10 dark:bg-card/85">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Privacy
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective date: {effectiveDate}</p>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
            This policy explains how Opencom collects, uses, and protects information when you use
            Opencom products, including the hosted web app, mobile admin app, website widget, and
            React Native SDK.
          </p>
        </header>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">1. Scope</h2>
            <p className="mt-2">
              This policy applies to information processed by Opencom in connection with product
              operation, customer support workflows, and service reliability. It also describes
              responsibility boundaries for self-hosted deployments.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <p className="mt-2">Depending on usage, Opencom may process:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Account and workspace details (name, email, role, workspace configuration).</li>
              <li>
                Conversation data (messages, ticket content, help-center interactions, related
                metadata).
              </li>
              <li>
                Visitor profile data (email if provided, display name, custom attributes configured
                by workspace admins).
              </li>
              <li>
                Device and usage metadata (app/device type, browser/OS details, timestamps,
                diagnostics, and activity events).
              </li>
              <li>
                Network and routing context (IP-derived region/country, referrer, page/app context).
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">
              3. Mobile App and Push Notification Data
            </h2>
            <p className="mt-2">
              For mobile features, Opencom may process device-app identifiers and push notification
              tokens to deliver message alerts and support operational notifications.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Push tokens and platform metadata may be stored to route notifications.</li>
              <li>
                Notification payload metadata (for example conversation or ticket context IDs) may
                be processed to support deep linking in-app.
              </li>
              <li>You can control notification permissions through device-level settings.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">4. How We Use Information</h2>
            <p className="mt-2">Opencom uses information to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide messaging, inbox, campaigns, and support features.</li>
              <li>Authenticate users, protect accounts, and secure workspace access.</li>
              <li>Operate, maintain, and improve service reliability and performance.</li>
              <li>Generate aggregate reporting and operational insights for workspace teams.</li>
              <li>Comply with legal obligations and respond to lawful requests when required.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">
              5. Sharing and Service Providers
            </h2>
            <p className="mt-2">
              Opencom uses infrastructure and service providers to operate the platform (for example
              hosting, messaging, analytics, and notification delivery). Information may be shared
              with subprocessors strictly to provide product functionality and service operations.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">
              6. Data Retention and Deletion
            </h2>
            <p className="mt-2">
              Data retention depends on workspace configuration, legal requirements, and product
              operational needs. Opencom supports data deletion and export workflows as described by
              platform capabilities and workspace controls.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">7. Security</h2>
            <p className="mt-2">
              Opencom applies technical and organizational safeguards designed to protect data in
              transit and at rest, enforce authentication and authorization, and monitor service
              integrity. No internet-based system can be guaranteed to be fully secure.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">
              8. International Data Transfers
            </h2>
            <p className="mt-2">
              Depending on deployment and provider region, information may be processed in countries
              other than your own. Where applicable, transfer safeguards are used according to
              contractual and legal requirements.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">9. Your Rights and Choices</h2>
            <p className="mt-2">
              Depending on location and role, you may have rights to access, correct, delete, or
              export certain personal data. Requests should be directed to your workspace
              administrator or submitted to Opencom using the contact details below.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">10. Self-Hosted Deployments</h2>
            <p className="mt-2">
              If you self-host Opencom, you are responsible for your own hosting infrastructure,
              storage, security configuration, legal notices, and compliance obligations. This
              policy primarily describes the hosted Opencom service model.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">11. Children&apos;s Privacy</h2>
            <p className="mt-2">
              Opencom is not intended for children under the age required by applicable law, and we
              do not knowingly collect personal information from children in violation of applicable
              law.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">12. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this policy from time to time. Updates will be posted on this page with
              a revised effective date.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 text-sm leading-7 text-muted-foreground shadow-[0_20px_45px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h2 className="text-xl font-semibold text-foreground">13. Contact</h2>
            <p className="mt-2">
              For privacy questions or requests, contact{" "}
              <a
                className="text-primary underline underline-offset-4"
                href="mailto:privacy@opencom.dev"
              >
                privacy@opencom.dev
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
