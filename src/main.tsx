import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";
import { isWeb } from '@/lib/platform';
import { registerServiceWorker } from './utils/registerServiceWorker';
import { prefetchRoutes } from '@/hooks/use-prefetch';
import { logRejection, logCaughtError } from '@/lib/errorLogger';

// Performance monitoring — Web Vitals
import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';
import { logError } from '@/lib/errorLogger';

function sendToAnalytics(metric: { name: string; delta: number; id: string; value: number }) {
  logError({
    error_type: 'runtime',
    error_message: `WebVitals:${metric.name}`,
    error_stack: undefined,
    metadata: { name: metric.name, delta: metric.delta, id: metric.id, value: metric.value },
  });
}

// Register service worker for offline support (web only — SW crashes in Capacitor WebView)
if (import.meta.env.PROD && isWeb()) {
  registerServiceWorker();
}

// Global error handlers — log uncaught errors to Supabase
if (import.meta.env.PROD) {
  window.onerror = (message, _source, _lineno, _colno, error) => {
    logCaughtError(error || new Error(String(message)));
  };
  window.onunhandledrejection = (event) => {
    logRejection(event);
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);

// Report Web Vitals after mount
onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onFCP(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);

// Preload remaining lazy chunks after initial paint
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    prefetchRoutes([
      'verification',
      'help',
      'terms',
      'privacy',
      'earnings',
      'notificationSettings',
      'savedSearches',
    ]);
  }, { timeout: 5000 });
} else {
  setTimeout(() => {
    prefetchRoutes([
      'verification',
      'help',
      'terms',
      'privacy',
      'earnings',
      'notificationSettings',
      'savedSearches',
    ]);
  }, 3000);
}
