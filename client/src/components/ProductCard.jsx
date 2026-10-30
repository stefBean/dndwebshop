import { Link } from "react-router-dom";
import { formatPrice } from "../lib/api.js";
import { useShop } from "../state/shop-context.js";
import { Icon } from "./ui.jsx";

export default function ProductCard({ product, onQuickView }) {
  const { addToCart } = useShop();
  return (
    <article className="product-card group min-w-0" data-testid="product-card">
      <div className="product-stage relative overflow-hidden rounded-md">
        <Link
          to={`/products/${product.id}`}
          className="block"
          aria-label={`View ${product.name}`}
        >
          <img
            src={product.image}
            alt={product.name}
            className="aspect-[1.2] w-full object-contain p-2 sm:p-4"
            loading="lazy"
          />
        </Link>
        {product.tag && (
          <span
            className={`absolute left-2 top-2 rounded-sm px-2 py-1 text-[7px] font-bold tracking-[.07em] sm:left-3 sm:top-3 sm:text-[8px] ${product.tag.toLowerCase().includes("best") ? "bg-[#e8dcbf] text-[#75592f]" : "bg-white/80 text-forest"}`}
          >
            {product.tag.toUpperCase()}
          </span>
        )}
        <button
          type="button"
          aria-label={`Quick view ${product.name}`}
          onClick={() => onQuickView(product)}
          className="absolute bottom-2 right-2 rounded-full bg-white/90 p-2 text-forest shadow-sm transition-all hover:bg-forest hover:text-white sm:bottom-3 sm:right-3 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus:translate-y-0 sm:focus:opacity-100"
        >
          <Icon name="eye" size={16} />
        </button>
      </div>
      <div className="pt-3 sm:pt-4">
        <p className="eyebrow truncate text-[7px] text-ink/45 sm:text-[9px]">
          {product.category}
        </p>
        <Link
          to={`/products/${product.id}`}
          className="mt-1 block min-h-10 font-serif text-[15px] leading-[1.3] text-ink hover:text-rust sm:min-h-7 sm:text-[20px] lg:text-[21px]"
        >
          {product.name}
        </Link>
        <p className="mt-1 hidden truncate text-[11px] text-ink/55 sm:block">
          {product.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-forest/10 pt-3">
          <span className="text-[12px] font-semibold text-forest sm:text-sm">
            {formatPrice(product.price_cents)}
          </span>
          <button
            type="button"
            aria-label={`Add ${product.name} to bag`}
            disabled={product.stock <= 0}
            onClick={() => addToCart(product)}
            className="flex items-center gap-1.5 rounded border border-forest/20 bg-transparent px-2 py-1.5 text-[10px] font-semibold text-forest transition-colors hover:border-forest hover:bg-forest hover:text-white disabled:opacity-40 sm:px-2.5"
          >
            <Icon name="plus" size={13} />
            <span className="hidden sm:inline">
              {product.stock > 0 ? "Add to bag" : "Sold out"}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
