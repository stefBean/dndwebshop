import { Icon } from "./Icon.jsx";
import { OrderItems, OrderTotal } from "./OrderSummary.jsx";
export function OrderCard({ order }) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-raised px-5 py-5 sm:px-7">
        <div className="min-w-0">
          <h2 className="break-all text-sm font-semibold text-ink">
            {order.number}
          </h2>
          <p className="mt-1.5 text-xs text-muted">
            {new Date(order.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-[10px] font-medium text-gold">
          <Icon name="check" className="size-3" />
          Simulation complete
        </span>
      </header>
      <div className="px-5 sm:px-7">
        <OrderItems items={order.items} />
        <OrderTotal label="Order total" cents={order.total_cents} />
      </div>
    </article>
  );
}
