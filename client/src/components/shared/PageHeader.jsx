import { Link } from "react-router-dom";
import { Icon } from "./Icon.jsx";
export function PageHeader({
  eyebrow,
  title,
  children,
  aside,
  as: Heading = "h1",
}) {
  return (
    <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow && <p className="eyebrow mb-3 text-gold">{eyebrow}</p>}
        <Heading className="font-serif text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
          {title}
        </Heading>
        {children && (
          <div className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            {children}
          </div>
        )}
      </div>
      {aside && <div className="text-xs text-muted">{aside}</div>}
    </div>
  );
}
export function BackLink({
  to = "/products",
  children = "Back to the collection",
}) {
  return (
    <Link
      to={to}
      className="mb-8 inline-flex min-h-10 items-center gap-2 text-sm text-muted transition-colors hover:text-gold"
    >
      <Icon name="arrowLeft" size={16} />
      {children}
    </Link>
  );
}
