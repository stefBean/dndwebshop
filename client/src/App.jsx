import { useEffect } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import ShopProvider from "./state/ShopProvider.jsx";
import { useShop } from "./state/shop-context.js";
import { api } from "./lib/api.js";
import { EmptyState, Icon } from "./components/ui.jsx";
import ShopPage from "./pages/ShopPage.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";

function Brand({ light = false }) {
  return (
    <Link
      to="/"
      aria-label="Dice and Lore home"
      className={`flex shrink-0 items-center gap-2.5 ${light ? "text-paper" : "text-forest"}`}
    >
      <Icon name="dice" size={36} />
      <span className="font-serif text-[27px] tracking-[-1px]">
        Dice <span className="text-rust italic">&</span> Lore
        <span className="mt-[-4px] block text-center font-sans text-[8px] font-semibold tracking-[.29em]">
          SUPPLIES FOR THE STORY
        </span>
      </span>
    </Link>
  );
}
function Header() {
  const { user, authLoading, cartCount, setUser, notify } = useShop();
  const navigate = useNavigate();
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      notify("You have signed out. See you next adventure!");
      navigate("/");
    } catch (error) {
      notify(error.message);
    }
  }
  const navClass = ({ isActive }) =>
    `border-b-2 py-7 text-[13px] transition-colors hover:text-rust ${isActive ? "border-rust font-semibold text-forest" : "border-transparent text-ink/70"}`;
  return (
    <>
      <div className="flex items-center justify-center gap-2 bg-forest py-2 text-[9px] font-medium tracking-[.16em] text-paper/90 sm:text-[10px]">
        <Icon name="sparkles" size={12} /> A LITTLE MAGIC FOR YOUR NEXT
        ADVENTURE <Icon name="sparkles" size={12} />
      </div>
      <header className="sticky top-0 z-30 border-b border-forest/10 bg-paper/95 backdrop-blur-lg">
        <div className="shell flex min-h-[88px] flex-wrap items-center justify-between gap-x-5">
          <Brand />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-8 md:flex"
          >
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/products" className={navClass}>
              The collection
            </NavLink>
            <NavLink to="/about" className={navClass}>
              Our story
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              to={user ? "/account/orders" : "/login"}
              className="flex items-center gap-2 text-[12px] hover:text-rust"
            >
              <Icon name="user" size={19} />
              <span className="hidden sm:inline">
                {authLoading
                  ? "Account"
                  : user
                    ? `Hi, ${user.name.split(" ")[0]}`
                    : "Sign in"}
              </span>
              <span className="sr-only sm:hidden">
                {user ? "My account" : "Sign in"}
              </span>
            </Link>
            {user && (
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                className="hover:text-rust"
              >
                <Icon name="logout" size={17} />
              </button>
            )}
            <span className="h-5 border-l border-forest/15" />
            <Link
              to="/cart"
              aria-label={`Shopping bag, ${cartCount} items`}
              className="flex items-center gap-2 text-[12px] hover:text-rust"
            >
              <Icon name="bag" size={20} />
              <span className="hidden lg:inline">Your bag</span>
              <span className="flex h-[21px] min-w-[21px] items-center justify-center rounded-full bg-forest px-1 text-[10px] text-white">
                {cartCount}
              </span>
            </Link>
          </div>
        </div>
        <nav
          aria-label="Mobile navigation"
          className="shell flex gap-6 border-t border-forest/5 py-2 text-xs md:hidden"
        >
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/products">The collection</NavLink>
          <NavLink to="/about">Our story</NavLink>
        </nav>
      </header>
    </>
  );
}
function Footer() {
  return (
    <footer className="mt-16 bg-forest text-paper">
      <div className="shell grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Brand light />
          <p className="mt-5 max-w-xs text-[13px] leading-6 text-paper/65">
            For the storytellers, the dice rollers,
            <br />
            and the ones who always take the side quest.
          </p>
        </div>
        <div>
          <p className="eyebrow text-paper/50">YOUR NEXT CHAPTER</p>
          <div className="mt-5 flex flex-col items-start gap-3 text-sm">
            <Link to="/products" className="hover:text-[#e8ad82]">
              Explore the collection
            </Link>
            <Link to="/cart" className="hover:text-[#e8ad82]">
              Your adventure bag
            </Link>
            <Link to="/account/orders" className="hover:text-[#e8ad82]">
              Your orders
            </Link>
          </div>
        </div>
        <div>
          <p className="eyebrow text-paper/50">AROUND THE TABLE</p>
          <div className="mt-5 flex flex-col items-start gap-3 text-sm">
            <Link to="/about" className="hover:text-[#e8ad82]">
              The Dice & Lore story
            </Link>
            <Link to="/login" className="hover:text-[#e8ad82]">
              Join the party
            </Link>
          </div>
          <p className="mt-5 text-xs leading-5 text-paper/50">
            A fictional shop for real imaginations.
            <br />
            All orders and payments are simulated.
          </p>
        </div>
      </div>
      <div className="shell flex flex-wrap justify-between gap-3 border-t border-white/15 py-5 text-[10px] text-paper/50">
        <span>
          © {new Date().getFullYear()} Dice & Lore. Every adventure begins
          somewhere.
        </span>
        <span className="flex items-center gap-2">
          <Icon name="dice" size={13} /> May your rolls be kind.
        </span>
      </div>
    </footer>
  );
}
function AboutPage() {
  return (
    <main className="shell py-16">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <p className="eyebrow text-rust">
            A TABLE. A PARTY. A LITTLE POSSIBILITY.
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-tight md:text-6xl">
            Every great story
            <br />
            starts with a little lore.
          </h1>
          <p className="mt-7 max-w-lg text-sm leading-8 text-ink/65">
            Dice & Lore is a small fictional general store for big imaginations.
            We believe the best adventures begin around a table, with a few
            friends and a roll of the dice.
          </p>
          <p className="mt-4 max-w-lg text-sm leading-8 text-ink/65">
            Discover six carefully imagined treasures, from shimmering dice sets
            to bottled starlight. Browse, build your bag, and try a simulated
            order. Nothing is charged or shipped.
          </p>
          <Link
            to="/products"
            className="mt-8 inline-flex items-center gap-3 rounded bg-forest px-6 py-3 text-sm text-white"
          >
            Find your next adventure <Icon name="arrowRight" size={17} />
          </Link>
        </div>
        <img
          src="/images/hero-supplies.svg"
          alt="Illustrated fantasy potions, a spellbook, and dice"
          className="w-full"
        />
      </div>
    </main>
  );
}
function PageFrame() {
  const { toast } = useShop();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 bg-white p-3 focus:not-sr-only focus:absolute"
      >
        Skip to content
      </a>
      <Header />
      <div id="main-content" className="flex-1">
        <Routes>
          <Route path="/" element={<ShopPage featured />} />
          <Route path="/products" element={<ShopPage />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/account/orders" element={<OrdersPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="*"
            element={
              <main className="shell py-16">
                <EmptyState
                  title="A path yet to be discovered"
                  icon="dice"
                  action={
                    <Link to="/products" className="inline-flex items-center gap-2 rounded bg-forest px-5 py-3 text-sm font-semibold text-white">
                        Back to the collection <Icon name="arrowRight" />
                    </Link>
                  }
                >
                  This page does not exist. Your next adventure is back in the
                  shop.
                </EmptyState>
              </main>
            }
          />
        </Routes>
      </div>
      <Footer />
      <div
        aria-live="polite"
        role="status"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100%-32px)] -translate-x-1/2 transition-all ${toast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        <div className="flex items-center gap-3 rounded-lg bg-forest px-5 py-4 text-sm text-white shadow-xl">
          <Icon name="check" size={18} />
          <span>{toast}</span>
        </div>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <ShopProvider>
        <PageFrame />
      </ShopProvider>
    </BrowserRouter>
  );
}
