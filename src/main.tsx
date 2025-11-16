import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";
import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';
import { registerServiceWorker } from './utils/registerServiceWorker';

// Performance monitoring
if (import.meta.env.PROD) {
  onCLS(metric => console.log('CLS:', metric.value));
  onINP(metric => console.log('INP:', metric.value));
  onFCP(metric => console.log('FCP:', metric.value));
  onLCP(metric => console.log('LCP:', metric.value));
  onTTFB(metric => console.log('TTFB:', metric.value));
}

// Register service worker for offline support
if (import.meta.env.PROD) {
  registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
