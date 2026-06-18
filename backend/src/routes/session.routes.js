import { Router } from "express";

import { getSessions } from "../controllers/dashboard.controller.js";
import { postSession, postSessionStop } from "../controllers/session.controller.js";

const router = Router();

router.get("/", getSessions);
router.post("/", postSession);
router.post("/:session_id/stop", postSessionStop);

export default router;
