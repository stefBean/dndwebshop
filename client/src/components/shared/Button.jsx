import { Link } from "react-router-dom";
const styles = {
  primary:
    "border-primary bg-primary text-black hover:border-primary-hover hover:bg-primary-hover",
  secondary:
    "border-line bg-raised text-ink hover:border-accent/50 hover:bg-surface",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-raised hover:text-ink",
  accent: "border-accent bg-accent text-black hover:bg-[#c4b5fd]",
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
