import { Icon } from "./Icon.jsx";
export function EmptyState({ icon = "bag", title, children, action }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-gold/15 bg-gold/5 text-gold">
        <Icon name={icon} size={28} />
      </div>
      <h2 className="font-serif text-3xl text-ink">{title}</h2>
      <div className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">
        {children}
      </div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
export function Notice({ children, variant = "info", className = "" }) {
  const styles = {
    info: "border-line bg-raised text-muted",
    error: "border-primary/40 bg-primary/10 text-[#f6b0b6]",
    success: "border-gold/30 bg-gold/5 text-gold",
  };
  return (
    <div
      role={
        variant === "error"
          ? "alert"
          : variant === "success"
            ? "status"
            : undefined
      }
      className={`rounded-lg border p-4 text-sm leading-6 ${styles[variant] || styles.info} ${className}`}
    >
      {children}
    </div>
  );
}
