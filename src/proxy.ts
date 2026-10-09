import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Runs on every public page but skips /admin, /api, Next internals, and
  // static/image assets — admin stays entirely outside the i18n system.
  // icon-192/icon-512/apple-icon/manifest/opengraph-image are code-generated
  // metadata routes with no dot in their pathname, so they'd otherwise slip
  // past the ".*\\..*" file-extension exclusion and get wrongly rewritten to
  // /en/.... robots.txt and sitemap.xml already have a dot, so no entry
  // needed for those.
  matcher: ["/((?!admin|api|_next|_vercel|icon-192|icon-512|apple-icon|manifest|opengraph-image|.*\\..*).*)"],
};
