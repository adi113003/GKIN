import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Analyzer from "./Analyzer.tsx";
import "./analyzer.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Analyzer />
  </StrictMode>
);
