import { Router } from "express";

import { getUserDetailHandler, getUserPostsHandler, getUsers } from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/", getUsers);
router.get("/:user_id", getUserDetailHandler);
router.get("/:user_id/posts", getUserPostsHandler);

export default router;
