import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useShop } from "../../state/shop-context.js";
import { api } from "../../lib/api.js";
import { Icon } from "../ui.jsx";
import Brand from "./Brand.jsx";
const navigation = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "The collection" },
  { to: "/about", label: "Our story" },
];
function Navigation({ mobile = false, onNavigate }) {
  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      className={
        mobile
          ? "shell grid gap-1 py-4 md:hidden"
          : "hidden items-center gap-7 self-stretch md:flex lg:gap-9"
      }
    >
      {navigation.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center text-[13px] font-medium transition-colors hover:text-gold ${mobile ? "rounded-md border px-4 py-3" : "border-b-2"} ${isActive ? (mobile ? "border-gold/20 bg-gold/5 text-gold" : "border-gold text-gold") : "border-transparent text-muted"}`
          }
        >
          {label}
          {mobile && <Icon name="chevronRight" size={16} className="ml-auto" />}
        </NavLink>
      ))}
    </nav>
  );
}
export default function Header() {
  const { user, authLoading, cartCount, setUser, notify } = useShop();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const closeMenu = () => setMenuOpen(false);
  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      closeMenu();
      notify("You have signed out. See you next adventure!");
      navigate("/");
    } catch (error) {
      notify(error.message);
    } finally {
      setSigningOut(false);
    }
  }
  const actionClass =
    "inline-flex min-h-11 min-w-8 items-center justify-center gap-2 rounded-md text-sm text-muted transition-colors hover:text-gold";
  return (
    <header
      className="sticky top-0 z-30 border-b border-line bg-void/95 backdrop-blur-xl"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          closeMenu();
          event.currentTarget
            .querySelector("[aria-controls='mobile-navigation']")
            ?.focus();
        }
      }}
    >
      <div className="shell flex min-h-20 items-center justify-between gap-3 lg:min-h-[88px]">
        <Brand onClick={closeMenu} />
        <Navigation onNavigate={closeMenu} />
        <div className="flex shrink-0 items-center gap-1 sm:gap-3 lg:gap-4">
          <Link
            to={user ? "/account/orders" : "/login"}
            onClick={closeMenu}
            className={actionClass}
            aria-label={user ? `My account, ${user.name}` : "Sign in"}
          >
            <Icon name="user" size={19} />
            <span className="hidden lg:inline">
              {authLoading
                ? "Account"
                : user
                  ? user.name.split(" ")[0]
                  : "Sign in"}
            </span>
          </Link>
          {user && (
            <button
              type="button"
              onClick={logout}
              disabled={signingOut}
              aria-label="Sign out"
              className={`${actionClass} max-sm:hidden disabled:opacity-40`}
            >
              <Icon name="logout" size={17} />
            </button>
          )}
          <span
            aria-hidden="true"
            className="mx-1 hidden h-5 border-l border-line sm:block"
          />
          <Link
            to="/cart"
            onClick={closeMenu}
            aria-label={`Shopping bag, ${cartCount} items`}
            className={`${actionClass} gap-1.5`}
          >
            <Icon name="bag" size={19} />
            <span className="flex size-[19px] items-center justify-center rounded-full border border-gold/25 bg-gold/10 text-[10px] font-semibold text-gold">
              {cartCount}
            </span>
          </Link>
          <button
            type="button"
            className={`${actionClass} ml-1 md:hidden`}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={21} />
          </button>
        </div>
      </div>
      <div
        id="mobile-navigation"
        hidden={!menuOpen}
        className="border-t border-line bg-surface md:hidden"
      >
        <Navigation mobile onNavigate={closeMenu} />
        {user && (
          <div className="shell pb-4 sm:hidden">
            <button
              type="button"
              onClick={logout}
              disabled={signingOut}
              className="flex min-h-11 w-full items-center gap-2 rounded-md border border-line px-4 text-sm text-muted hover:text-gold disabled:opacity-40"
            >
              <Icon name="logout" size={17} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
