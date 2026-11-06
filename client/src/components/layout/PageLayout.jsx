import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useShop } from "../../state/shop-context.js";
import Header from "./Header.jsx";
import { Notice } from "../ui.jsx";

export default function PageLayout() {
  const { toast, challengeBanner, clearChallengeBanner } = useShop();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col bg-void text-ink">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-accent px-5 py-3 font-semibold text-void focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Header />
      {challengeBanner && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-2xl">
          <Notice variant="success" className="flex items-center justify-between gap-4 bg-surface shadow-xl">
            <span>{challengeBanner}</span>
            <button type="button" className="shrink-0 underline" onClick={clearChallengeBanner}>
              Dismiss
            </button>
          </Notice>
        </div>
      )}
      <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {toast}
      </p>
    </div>
  );
}
