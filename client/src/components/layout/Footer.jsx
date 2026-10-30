import { Link } from "react-router-dom";
import { Icon } from "../ui.jsx";
import Brand from "./Brand.jsx";
const links = [
  { to: "/products", label: "The collection" },
  { to: "/about", label: "Our story" },
  { to: "/account/orders", label: "Your orders" },
];
export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-void">
      <div className="shell grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <Brand />
          <p className="mt-4 max-w-sm text-xs leading-6 text-muted">
            For the storytellers, the dice rollers, and the ones who always take
            the side quest.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted"
        >
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="transition-colors hover:text-gold"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="shell flex flex-col justify-between gap-3 border-t border-line py-5 text-[10px] leading-5 text-muted sm:flex-row sm:items-center">
        <span>
          © {new Date().getFullYear()} Dice & Lore. A fictional shop for real
          imaginations.
        </span>
        <span className="flex items-center gap-2">
          <Icon name="shield" size={13} className="shrink-0 text-gold" />
          Simulated orders. No payments. No shipping.
        </span>
      </div>
    </footer>
  );
}
