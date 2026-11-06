import Link from "next/link";
import { BrandLogo } from "@/app/_components/brand-logo";
import { ThemeToggle } from "@/app/_components/theme-toggle";

export const metadata = {
  title: "Terms & Conditions — Nisafety Hub",
};

const LAST_UPDATED = "6 November 2026";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. About this platform",
    body: [
      "Nisafety Hub is an internal system operated by Nisafety Consultancy for its staff to submit, organise, and manage client safety and compliance records and documents. It is not a public service — access is restricted to staff accounts that an administrator has reviewed and approved.",
    ],
  },
  {
    title: "2. Accounts and approval",
    body: [
      "Creating an account requires accurate information, including your real name and a work-reachable email address. Every new account is reviewed by an administrator before it can be used — sign-up alone does not grant access.",
      "You are responsible for everything done under your account. Do not share your login with anyone else, and do not use an account that was not issued to you.",
    ],
  },
  {
    title: "3. Acceptable use",
    body: [
      "Use this platform only for legitimate Nisafety Consultancy business — submitting, reviewing, editing, or retrieving client records and the documents attached to them.",
      "Do not attempt to bypass the account-approval process, access another staff member's account, or retrieve client information you have no business reason to see. Do not upload, copy, or share any document or client detail outside the platform except as your role requires.",
    ],
  },
  {
    title: "4. Client data and confidentiality",
    body: [
      "Client records on this platform — company details, contact names, phone numbers, email addresses, and any attached documents — are confidential and may include personal data belonging to client representatives. Where that is the case, this data is subject to Malaysia's Personal Data Protection Act 2010 (PDPA).",
      "Collect, use, and retain client data only for the purpose of delivering consultancy services. Do not disclose it to anyone outside Nisafety Consultancy except where the client has authorised it or the law requires it.",
    ],
  },
  {
    title: "5. Document storage and retention",
    body: [
      "Documents you attach to a client record are stored in access-controlled storage and are only reachable by approved staff and administrators through this platform. Records are retained for as long as the client relationship and applicable regulatory record-keeping requirements call for, after which they may be archived or removed in line with company policy.",
    ],
  },
  {
    title: "6. Account security",
    body: [
      "Keep your password confidential and choose one that is not reused from another service. If you suspect your account has been accessed without your knowledge, tell an administrator immediately so your access can be reviewed.",
    ],
  },
  {
    title: "7. Availability and changes to the platform",
    body: [
      "Nisafety Hub is provided on an as-is, as-available basis. Features, categories, and workflows may change over time as the platform is improved, and we do not guarantee uninterrupted availability.",
    ],
  },
  {
    title: "8. Suspension and termination",
    body: [
      "An administrator may suspend or revoke your access at any time, including on resignation or role change, a breach of these terms, or any use of the platform that puts client data or the organisation at risk.",
    ],
  },
  {
    title: "9. Changes to these terms",
    body: [
      "These terms may be updated from time to time as the platform or company policy changes. Continuing to use the platform after an update means you accept the revised terms.",
    ],
  },
  {
    title: "10. Governing law",
    body: ["These terms are governed by the laws of Malaysia."],
  },
  {
    title: "11. Questions",
    body: ["If anything here is unclear, ask your system administrator before creating an account or submitting client data."],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-canvas px-6 py-12 text-ink sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <BrandLogo height={40} />
          <ThemeToggle />
        </div>

        <p className="mt-10 font-mono text-xs font-semibold tracking-[0.14em] text-accent">LEGAL</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-sm leading-7 text-ink-muted">
          These terms govern the use of Nisafety Hub by Nisafety Consultancy staff. By creating an account or signing in, you agree to
          them.
        </p>

        <div className="mt-6 rounded-2xl border border-line bg-surface-soft p-4 text-xs leading-6 text-ink-muted">
          This page is an operational description of how this internal platform is meant to be used — not a substitute for legal
          advice. Nisafety Consultancy should have it reviewed by qualified legal counsel, particularly the data-protection section,
          before relying on it for compliance purposes.
        </div>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold tracking-[-0.02em] text-ink">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-7 text-ink-muted">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-line pt-6">
          <Link href="/signup" className="text-sm font-semibold text-accent hover:text-accent-hover">
            ← Back to sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
