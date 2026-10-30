import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useShop } from "../../state/shop-context.js";
import { Icon } from "../ui.jsx";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
export default function PageLayout() {
  const { toast } = useShop();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col bg-void text-ink">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-gold px-5 py-3 font-semibold text-void focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Header />
      <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </div>
      <Footer />
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100%-32px)] -translate-x-1/2 transition-all ${toast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        {toast && (
          <div className="flex items-center gap-3 rounded-lg border border-gold/30 bg-raised px-5 py-4 text-sm text-ink shadow-2xl shadow-black/50">
            <Icon name="check" size={18} className="shrink-0 text-gold" />
            <span>{toast}</span>
          </div>
        )}
      </div>
    </div>
  );
}
