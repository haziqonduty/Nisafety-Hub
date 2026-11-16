import { describe, expect, it } from "vitest";

/**
 * Black-box access control checks against a RUNNING copy of the app
 * (`npm run build && npm start`, or a preview URL). Needs no credentials
 * and touches no data: every request is anonymous (or carries a forged
 * header) and must be refused before any work is done. The ids used don't
 * exist, so even a regression couldn't change real records.
 *
 * TEST_BASE_URL defaults to http://localhost:3000.
 */
const BASE = (process.env.TEST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const NOBODY = "00000000-0000-4000-8000-000000000abc";

// The header src/proxy.ts sets for page renders. It was once trusted by API
// routes, so a client could forge it and act as an admin (fixed 2026-11-16).
const FORGED_ADMIN = {
  "x-nisafety-profile": JSON.stringify({ id: NOBODY, email: "x@example.com", fullName: "Forged", role: "admin", status: "approved" }),
};

const PROTECTED_API: [method: string, path: string][] = [
  ["GET", "/api/admin/clients/export"],
  ["GET", "/api/admin/analytics/report"],
  ["PATCH", `/api/admin/clients/${NOBODY}`],
  ["DELETE", `/api/admin/clients/${NOBODY}`],
  ["DELETE", `/api/admin/documents/${NOBODY}`],
  ["PATCH", `/api/admin/staff/${NOBODY}`],
  ["DELETE", `/api/admin/staff/${NOBODY}`],
  ["POST", "/api/admin/recycle-bin"],
  ["GET", "/api/admin/backup"],
  ["POST", "/api/uploads"],
  ["POST", "/api/submissions"],
  ["POST", `/api/clients/${NOBODY}/reports`],
  ["GET", "/api/clients/search?q=a"],
  ["PATCH", `/api/records/${NOBODY}`],
  ["POST", `/api/records/${NOBODY}/service-date`],
  ["GET", "/api/directory"],
  ["GET", "/api/documents/search?q=a"],
  ["GET", "/api/places?q=Muar"],
  ["POST", "/api/places/resolve"],
  ["PUT", `/api/clients/${NOBODY}/location`],
  ["DELETE", `/api/clients/${NOBODY}/location`],
];

const PROTECTED_PAGES = ["/", "/ms", "/submit", "/renewals", "/map", `/records/${NOBODY}`, "/admin", "/admin/staff", "/admin/analytics", "/admin/recycle-bin"];

function call(method: string, path: string, headers: Record<string, string> = {}) {
  const hasBody = method !== "GET" && method !== "DELETE";
  return fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: hasBody ? { "Content-Type": "application/json", ...headers } : headers,
    body: hasBody ? JSON.stringify({ status: "approved", role: "admin", serviceDate: "2026-01-01", clientName: "x", telephone: "1", email: "x@example.com" }) : undefined,
  });
}

describe("API routes refuse anonymous callers", () => {
  it.each(PROTECTED_API)("%s %s → 401", async (method, path) => {
    expect((await call(method, path)).status).toBe(401);
  });
});

describe("API routes ignore a forged admin header", () => {
  it.each(PROTECTED_API)("%s %s → 401", async (method, path) => {
    expect((await call(method, path, FORGED_ADMIN)).status).toBe(401);
  });
});

describe("pages send anonymous visitors to /login", () => {
  it.each(PROTECTED_PAGES)("%s", async (path) => {
    for (const headers of [{}, FORGED_ADMIN]) {
      const response = await call("GET", path, headers);
      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      expect(new URL(response.headers.get("location") ?? "", BASE).pathname).toBe("/login");
    }
  });
});

describe("sign-in pages stay reachable", () => {
  it.each(["/login", "/signup", "/forgot-password"])("%s → 200", async (path) => {
    expect((await call("GET", path)).status).toBe(200);
  });
});

describe("security headers", () => {
  it("are sent on every page", async () => {
    const response = await call("GET", "/login");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=");
  });
});
