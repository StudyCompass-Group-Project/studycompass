export function validateId(req, res, next, value, name) {
  if (!/^[1-9]\d{0,8}$/.test(value)) {
    return res.status(400).json({ error: `Invalid ${name}` });
  }
  next();
}