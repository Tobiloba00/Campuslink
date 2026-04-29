import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker. We register in dev too so push notifications can be
// tested locally — the SW itself skips fetch caching on localhost so it doesn't
// fight Vite's HMR.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Notification click → focus the existing tab and route to data.url
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'navigate' && typeof event.data.url === 'string') {
      const url = event.data.url;
      if (window.location.pathname + window.location.search !== url) {
        window.history.pushState({}, '', url);
        // React Router listens to popstate; trigger it manually
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  });
}
