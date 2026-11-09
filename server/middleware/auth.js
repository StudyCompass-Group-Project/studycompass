import jwt from "jsonwebtoken";
import { COOKIE_NAME } from "../config/cookies.js";
 
// Put this in front of any route that needs a logged-in user:
//   router.get("/courses", requireAuth, handler)
// Inside the handler, req.userId is the logged-in user's id.
function requireAuth(req, res, next) {
  // cookie-parser fills req.cookies from the request's Cookie header.
  const token = req.cookies[COOKIE_NAME];
 
  if (!token) {
    return res.status(401).json({ error: "No token found" });
  }
 
  let decoded;
  try {
    // verify() checks the signature AND the expiry; it throws if either fails.
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
 
  // A correctly signed token without a userId (for example, one issued before
  // the payload format changed) is still not usable, so reject it too.
  if (!decoded.userId) {
    return res.status(401).json({ error: "Invalid token payload" });
  }
 
  req.userId = decoded.userId;
  // next() sits OUTSIDE the try block on purpose: an error thrown later by the
  // route handler must not be caught above and mislabelled as a bad token.
  next();
}
 
export default requireAuth;