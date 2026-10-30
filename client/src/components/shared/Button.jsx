import { Link } from "react-router-dom";
const styles = {
  primary:
    "border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover shadow-[0_4px_20px_#b8323e18]",
  secondary:
    "border-line bg-raised text-ink hover:border-gold/50 hover:bg-surface",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-raised hover:text-ink",
  accent: "border-gold bg-gold text-void hover:bg-gold/90",
};
function buttonClass(variant, className) {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant] || styles.primary} ${className}`;
}
export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...props}>
      {children}
    </button>
  );
}
export function LinkButton({
  to,
  href,
  variant = "primary",
  className = "",
  children,
  ...props
}) {
  if (href)
    return (
      <a href={href} className={buttonClass(variant, className)} {...props}>
        {children}
      </a>
    );
  return (
    <Link to={to} className={buttonClass(variant, className)} {...props}>
      {children}
    </Link>
  );
}
