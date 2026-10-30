import { Link } from "react-router-dom";
import { formatPrice } from "../lib/api.js";
import { useShop } from "../state/shop-context.js";
import { Button, Icon, ProductArtwork } from "./ui.jsx";

export default function ProductCard({ product, onQuickView }) {
  const { addToCart } = useShop();
  return (
    <article
      className="product-card group flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-gold/35"
      data-testid="product-card"
    >
      <div className="relative border-b border-line">
        <Link
          to={`/products/${product.id}`}
          className="block"
          aria-label={`View ${product.name}`}
        >
          <ProductArtwork
            product={product}
            className="aspect-[1.35]"
            imageClassName="p-6 sm:p-5"
          />
        </Link>
        {product.tag && (
          <span className="absolute left-4 top-4 rounded border border-gold/25 bg-void/80 px-2.5 py-1.5 text-[9px] font-semibold tracking-widest text-gold">
            {product.tag.toUpperCase()}
          </span>
        )}
        <button
          type="button"
          aria-label={`Quick view ${product.name}`}
          onClick={() => onQuickView(product)}
          className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-void/80 text-muted transition-colors hover:border-gold/50 hover:text-gold"
        >
          <Icon name="eye" size={18} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-[9px] text-gold/80">{product.category}</p>
          <span className="text-[9px] tracking-wider text-muted/65">
            NO. {String(product.id).padStart(3, "0")}
          </span>
        </div>
        <Link
          to={`/products/${product.id}`}
          className="mt-3 line-clamp-2 min-h-14 font-serif text-[23px] leading-tight text-ink transition-colors hover:text-gold"
        >
          {product.name}
        </Link>
        <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
          <span className="text-lg font-semibold tabular-nums text-gold">
            {formatPrice(product.price_cents)}
          </span>
          <Button
            aria-label={`Add ${product.name} to bag`}
            disabled={product.stock <= 0}
            onClick={() => addToCart(product)}
            className="px-3.5 text-xs"
          >
            <Icon name="plus" size={15} />
            {product.stock > 0 ? "Add to bag" : "Sold out"}
          </Button>
        </div>
      </div>
    </article>
  );
}
