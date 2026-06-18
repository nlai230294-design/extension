import { createSession, stopSession } from "../services/analysis.service.js";
import { createSessionSchema } from "../validators/analysis.schema.js";

export async function postSession(req, res, next) {
  try {
    const body = createSessionSchema.parse(req.body ?? {});
    const result = await createSession(body.source_url);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postSessionStop(req, res, next) {
  try {
    const result = await stopSession(req.params.session_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
