import { Link } from "react-router-dom";
import { formatPrice } from "../lib/api.js";
import { Icon, Notice, ProductArtwork, QuantityInput } from "./ui.jsx";
export default function CartItem({
  item,
  onQuantityChange,
  onRemove,
  disabled = false,
}) {
  const { product_id, quantity, product } = item;
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 gap-y-4 p-4 sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:gap-6 sm:p-6">
      <Link
        to={`/products/${product_id}`}
        className="size-[72px] sm:row-span-2 sm:size-[100px]"
      >
        <ProductArtwork
          product={product}
          className="size-full rounded-lg border border-line"
          imageClassName="p-2"
        />
      </Link>
      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-gold">
          {product.category}
        </p>
        <Link
          to={`/products/${product_id}`}
          className="break-words font-serif text-lg leading-6 text-ink transition hover:text-gold"
        >
          {product.name}
        </Link>
        <p className="mt-2 text-xs text-muted">
          {formatPrice(product.price_cents)} each
        </p>
      </div>
      <p className="col-start-2 hidden whitespace-nowrap font-medium text-ink sm:col-start-3 sm:block">
        {formatPrice(product.price_cents * quantity)}
      </p>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-4 sm:col-span-2 sm:col-start-2">
        <fieldset disabled={disabled} className={disabled ? "opacity-50" : ""}>
          <legend className="sr-only">Quantity for {product.name}</legend>
          <QuantityInput
            value={quantity}
            max={Math.min(product.stock || 1, 99)}
            onChange={onQuantityChange}
          />
        </fieldset>
        <span className="ml-auto font-medium text-ink sm:hidden">
          {formatPrice(product.price_cents * quantity)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="inline-flex min-h-10 items-center gap-1.5 text-xs text-muted transition hover:text-red-300 disabled:opacity-40"
        >
          <Icon name="trash" className="size-3.5" />
          Remove
        </button>
      </div>
      {quantity > product.stock && (
        <Notice variant="error" className="col-span-full">
          Only {product.stock} available. Update the quantity or remove this
          item.
        </Notice>
      )}
    </li>
  );
}
