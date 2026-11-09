// NOTE: this file reads NODE_ENV when it is first imported, so .env must already
// be loaded by then. server.js does that by importing "dotenv/config" first.
const isProduction = process.env.NODE_ENV === "production";
 
// The name of the cookie that stores the JWT. Defined once here so the login
// route (which sets it) and the auth middleware (which reads it) can't drift apart.
export const COOKIE_NAME = "token";
 
// Options used when SETTING the cookie (on login).
export const cookieOptions = {
  httpOnly: true, // browser JavaScript can't read the cookie (blocks XSS token theft)
  secure: isProduction, // HTTPS only in production (localhost is plain HTTP)
  // "lax" works when client and server share a site, like localhost in dev.
  // Deployed on different domains? Browsers require "none" (plus secure: true).
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms; keep in step with the JWT's expiresIn
};
 
// Options used when CLEARING the cookie (on logout, later). Browsers only delete a
// cookie when these attributes match the ones it was set with, so reuse them.
export const clearCookieOptions = {
  httpOnly: cookieOptions.httpOnly,
  secure: cookieOptions.secure,
  sameSite: cookieOptions.sameSite,
};