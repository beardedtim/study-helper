import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "@/components/ui/provider";
import { Router } from "wouter";

import "./index.css";
import Routes from "./Routes.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider>
      <Router>
        <Routes />
      </Router>
    </Provider>
  </StrictMode>
);
