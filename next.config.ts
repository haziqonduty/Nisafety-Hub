import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Supabase project origin — the only third party this app actually talks to
// (REST/Storage over https, Realtime over wss, plus the PDF iframe preview
// on /records/[id]).
const SUPABASE_ORIGIN = "https://lkxelyxwfsmpaflifppk.supabase.co";
const SUPABASE_REALTIME_ORIGIN = "wss://lkxelyxwfsmpaflifppk.supabase.co";

// No nonce-based strict CSP here deliberately: nonces require every page to
// opt into dynamic rendering (next.config docs, "Static vs Dynamic Rendering
// with CSP"), which would disable static optimization across the whole app
// just to tighten script-src — disproportionate for this app's risk profile
// (no dangerouslySetInnerHTML anywhere; all user-submitted text renders
// through normal JSX, which React escapes by default). 'unsafe-inline' on
// script-src is required regardless — confirmed directly that Next's RSC
// bootstrap payload and next-themes' flash-prevention script are both
// legitimate inline <script> tags with no src attribute.
const isDev = process.env.NODE_ENV === "development";

// 'unsafe-eval' is dev-only, per Next's own CSP docs: React uses eval() in
// development for debugging features like reconstructing server-side error
// stacks in the browser. Confirmed directly — omitting it broke local dev
// with "eval() is not supported in this environment". React never uses
// eval() in production, so it's correctly left out there.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_REALTIME_ORIGIN}`,
  `frame-src ${SUPABASE_ORIGIN}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
  // Legacy fallback for browsers that don't honor frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing on this site uses camera/microphone/geolocation/payment APIs.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
