// The fixed internal identity behind the username/password admin sign-in at
// /login (see src/app/api/admin/sign-in/route.ts). Not a real mailbox, never
// shown to or typed by anyone — exported so other code (e.g. the staff list)
// can recognize and exclude this synthetic account.
export const ADMIN_LOGIN_EMAIL = "admin@nisafetyhub.internal";
