import { getUserDetail, getUserPosts, listSessions, listUsers } from "../services/dashboard.service.js";
import { paginationSchema } from "../validators/analysis.schema.js";

export async function getSessions(req, res, next) {
  try {
    const query = paginationSchema.parse(req.query);
    const result = await listSessions(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUsers(req, res, next) {
  try {
    const query = paginationSchema.parse(req.query);
    const result = await listUsers(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUserDetailHandler(req, res, next) {
  try {
    const result = await getUserDetail(req.params.user_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUserPostsHandler(req, res, next) {
  try {
    const query = paginationSchema.parse(req.query);
    const result = await getUserPosts(req.params.user_id, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
