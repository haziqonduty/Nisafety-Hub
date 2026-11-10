// Shared between src/proxy.ts (Edge middleware) and src/lib/auth/profile.ts
// (Node, "server-only") — deliberately has no "server-only" import of its
// own so middleware can import it too.
export const PROFILE_HEADER_NAME = "x-nisafety-profile";
