import { formatPrice } from "../../lib/api.js";
export function OrderItems({ items }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li
          key={item.product_id}
          className="flex justify-between gap-5 py-5 text-sm"
        >
          <div>
            <p className="font-medium text-ink">{item.name}</p>
            <p className="mt-1.5 text-xs text-muted">
              {item.quantity} × {formatPrice(item.price_cents)}
            </p>
          </div>
          <span className="whitespace-nowrap font-medium text-gold">
            {formatPrice(item.price_cents * item.quantity)}
          </span>
        </li>
      ))}
    </ul>
  );
}
export function OrderTotal({ label = "Total", cents }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-5 font-semibold">
      <span className="text-sm text-ink">{label}</span>
      <span className="text-xl text-gold">{formatPrice(cents)}</span>
    </div>
  );
}
