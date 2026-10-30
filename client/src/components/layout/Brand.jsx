import { Link } from "react-router-dom";
import { Icon } from "../ui.jsx";
export default function Brand({ className = "", ...props }) {
  return (
    <Link
      to="/"
      aria-label="Dice and Lore home"
      className={`group inline-flex shrink-0 items-center gap-2 text-ink sm:gap-2.5 ${className}`}
      {...props}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/5 text-gold transition-colors group-hover:border-gold/60 sm:size-11">
        <Icon name="dice" size={25} />
      </span>
      <span>
        <span className="block font-serif text-[20px] leading-none tracking-tight sm:text-[27px]">
          Dice <span className="text-gold italic">&</span> Lore
        </span>
        <span className="mt-1.5 hidden text-[6px] min-[380px]:block font-semibold tracking-[.23em] text-muted sm:text-[7px]">
          THE ADVENTURER’S EMPORIUM
        </span>
      </span>
    </Link>
  );
}
