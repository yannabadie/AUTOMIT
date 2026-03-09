import { Request, Response } from "express";
import { setEmergencyStop, isEmergencyStop } from "../policy-engine.js";

export async function killHandler(req: Request, res: Response): Promise<void> {
  const stop = req.body.stop ?? true;
  setEmergencyStop(Boolean(stop));
  console.log(`[EMERGENCY] Stop = ${isEmergencyStop()}`);
  res.json({ emergency_stop: isEmergencyStop() });
}
