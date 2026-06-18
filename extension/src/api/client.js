import axios from "axios";

import { BACKEND_BASE_URL } from "../utils/constants.js";

const LOG_PREFIX = "[SCA:api]";

const http = axios.create({
  baseURL: BACKEND_BASE_URL,
  timeout: 5000,
});

http.interceptors.request.use((config) => {
  console.log(`${LOG_PREFIX} -> ${config.method.toUpperCase()} ${config.url}`, config.data ?? "");
  return config;
});

http.interceptors.response.use(
  (response) => {
    console.log(`${LOG_PREFIX} <- ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(
        `${LOG_PREFIX} <- ${error.response.status} ${error.config?.url}`,
        error.response.data
      );
    } else {
      console.error(`${LOG_PREFIX} request failed: ${error.message} (${error.config?.url})`);
    }
    return Promise.reject(error);
  }
);

export async function createSession(sourceUrl) {
  const { data } = await http.post("/api/sessions", { source_url: sourceUrl });
  return data;
}

export async function stopSession(sessionId) {
  const { data } = await http.post(`/api/sessions/${sessionId}/stop`);
  return data;
}

export async function submitBatch(sessionId, items) {
  const { data } = await http.post("/api/analysis/batch", {
    session_id: sessionId,
    items,
  });
  return data;
}

export async function getResults(sessionId) {
  const { data } = await http.get(`/api/analysis/results/${sessionId}`);
  return data;
}
