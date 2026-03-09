import express from "express";
import { verifySignature } from "./middleware/auth.js";
import { analyzeHandler } from "./routes/analyze.js";
import { proposeHandler } from "./routes/propose.js";
import { executeHandler } from "./routes/execute.js";
import { statusHandler } from "./routes/status.js";
import { killHandler } from "./routes/kill.js";

const app = express();
app.use(express.json());

// Health check (no auth)
app.get("/health", (_req, res) => res.json({ status: "ok", service: "automit-control-plane" }));

// All other routes require HMAC signature
app.use(verifySignature);

app.post("/analyze", analyzeHandler);
app.post("/draft", analyzeHandler);
app.post("/propose_actions", proposeHandler);
app.post("/execute", executeHandler);
app.get("/status/:action_id", statusHandler);
app.post("/kill", killHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[AutomIT Control Plane] listening on :${PORT}`);
});
