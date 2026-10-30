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


    </div>
  );
}
