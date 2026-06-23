// Một nguồn duy nhất cho domain backend production, dùng chung bởi
// vite.config.js (build manifest) và src/utils/constants.js (runtime).
// TODO: thay bằng domain HTTPS thật sau khi deploy backend production.
export const PRODUCTION_BACKEND_ORIGIN = "https://extension-fb.xyz";
