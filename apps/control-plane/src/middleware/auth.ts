import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const HMAC_SECRET = process.env.AUTOMIT_HMAC_SECRET || "";
const ADMIN_TOKEN = process.env.AUTOMIT_ADMIN_TOKEN || "";

export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  // Kill endpoint uses admin token
  if (req.path === "/kill") {
    const token = req.headers["x-automit-admin-token"] as string;
    if (!token || token !== ADMIN_TOKEN) {
      res.status(403).json({ error: "Invalid admin token" });
      return;
    }
    return next();
  }

  const signature = req.headers["x-automit-signature"] as string;
  if (!signature || !HMAC_SECRET) {
    res.status(401).json({ error: "Missing signature or HMAC secret" });
    return;
  }

  const payload = JSON.stringify(req.body);
  const expected = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");

  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Timestamp freshness (5 min window)
  const ts = req.body?.timestamp;
  if (ts && Math.abs(Date.now() / 1000 - ts) > 300) {
    res.status(401).json({ error: "Request expired" });
    return;
  }

  next();
}
