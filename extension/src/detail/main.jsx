import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import Detail from "./Detail.jsx";
import "./detail.scss";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Detail />
  </StrictMode>
);
