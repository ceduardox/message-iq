import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// In local development, kill any leftover service worker / caches from a previous
// production build so the browser always loads the fresh dev bundle (avoids stale
// "404" pages for new routes).
if (import.meta.env.DEV && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {});
  if (typeof caches !== "undefined") {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(<App />);

const splash = document.getElementById("splash");
if (splash) {
  splash.classList.add("hide");
  const fastConversationLaunch =
    typeof window !== "undefined" &&
    Boolean((window as typeof window & { __FAST_CONVERSATION_LAUNCH__?: boolean }).__FAST_CONVERSATION_LAUNCH__);
  setTimeout(() => splash.remove(), fastConversationLaunch ? 0 : 400);
}
