import { useState } from "react";
import { useShop } from "../state/shop-context.js";
import { formatPrice } from "../lib/api.js";
import {
  Button,
  Icon,
  LinkButton,
  ProductArtwork,
  QuantityInput,
} from "./ui.jsx";
export default function ProductDetails({ product, compact = false, onClose }) {
  const { addToCart } = useShop();
  const [quantity, setQuantity] = useState(1);
  return (
    <div className="grid overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-2">
      <ProductArtwork
        product={product}
        className="aspect-square h-full max-h-[560px] border-b border-line md:border-b-0 md:border-r"
        imageClassName="p-8 sm:p-12"
      />
      <div className={compact ? "p-6 sm:p-8" : "p-6 sm:p-10 lg:p-12"}>
        <p className="eyebrow text-gold">
          {product.category} / NO. {String(product.id).padStart(3, "0")}
        </p>
        <h1 className="mt-5 font-serif text-4xl leading-tight text-ink">
          {product.name}
        </h1>
        <p className="mt-5 text-2xl font-medium text-gold">
          {formatPrice(product.price_cents)}
        </p>
        <p className="mt-5 text-sm leading-7 text-muted">
          {product.description}
        </p>
        <p className="mt-7 flex items-center gap-2 text-xs text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${product.stock > 0 ? "bg-gold" : "bg-primary"}`}
          />
          {product.stock > 0
            ? `${product.stock} available for your next adventure`
            : "Currently out of stock"}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <QuantityInput
            value={quantity}
            onChange={setQuantity}
            max={Math.max(1, Math.min(99, product.stock))}
          />
          <Button
            disabled={product.stock <= 0}
            onClick={() => addToCart(product, quantity)}
          >
            <Icon name="bag" size={17} />
            Add to bag
          </Button>
        </div>
        <p className="mt-7 flex items-start gap-2 border-t border-line pt-5 text-xs leading-6 text-muted">
          <Icon name="dice" size={17} className="mt-1 shrink-0 text-gold" />
          Fictional equipment for legendary campaigns. All orders are
          simulations.
        </p>
        {compact && (
          <LinkButton
            to={`/products/${product.id}`}
            variant="ghost"
            onClick={onClose}
            className="mt-3 px-0 text-xs"
          >
            View full details <Icon name="arrowRight" size={14} />
          </LinkButton>
        )}
      </div>
    </div>
  );
}
