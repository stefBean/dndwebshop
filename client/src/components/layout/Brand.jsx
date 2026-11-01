import { Link } from "react-router-dom";

export default function Brand({ className = "", ...props }) {
  return (
    <Link
      to="/"
      aria-label="Dungeons & Dragons Shop home"
      className={`group inline-flex shrink-0 items-center gap-2 text-white sm:gap-3 ${className}`}
      aria-label="D&D"
      className={`group inline-flex shrink-0 items-center gap-2 text-ink sm:gap-2.5 ${className}`}
      {...props}
    >
      <img
        src="/images/dnd-symbol.svg"
        alt=""
        aria-hidden="true"
        className="size-8 shrink-0 sm:size-10"
      />
      <span className="flex flex-col items-center">
        <span className="font-serif text-[11px] font-bold leading-[1.05] tracking-[.06em] sm:text-[16px]">
          <span className="block">DUNGEONS</span>
          <span className="block">&amp; DRAGONS</span>
        </span>
        <span className="mt-1.5 text-[7px] font-medium tracking-[.35em] text-white/65 sm:text-[8px]">
          SHOP
        </span>
      </span>
    </Link>
  );
}
