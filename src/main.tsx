// src/main.tsx
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./app/App.tsx";
import "./styles/index.css";
import { setupGlobalErrorHandlers } from "./app/utils/globalErrorHandler";

// 🚀 Iniciar manejadores globales de errores ANTES de renderizar
setupGlobalErrorHandlers();

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);