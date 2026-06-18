import { getResults, ingestBatch } from "../services/analysis.service.js";
import { batchSchema } from "../validators/analysis.schema.js";

export async function postBatch(req, res, next) {
  try {
    const body = batchSchema.parse(req.body);
    const result = await ingestBatch(body.session_id, body.items);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSessionResults(req, res, next) {
  try {
    const result = await getResults(req.params.session_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
