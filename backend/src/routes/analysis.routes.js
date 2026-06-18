import { Router } from "express";

import { getSessionResults, postBatch } from "../controllers/analysis.controller.js";

const router = Router();

router.post("/batch", postBatch);
router.get("/results/:session_id", getSessionResults);

export default router;
