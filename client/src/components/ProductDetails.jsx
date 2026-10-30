import { useState } from "react";
import { Link } from "react-router-dom";
import { useShop } from "../state/shop-context.js";
import { formatPrice } from "../lib/api.js";
import { Button, Icon, QuantityInput } from "./ui.jsx";

export default function ProductDetails({ product, compact = false, onClose }) {
  const { addToCart } = useShop();
  const [quantity, setQuantity] = useState(1);
  return (
    <div className="grid items-center md:grid-cols-2">
      <div className="product-stage m-4 rounded-lg md:m-0">
        <img
          src={product.image}
          alt={product.name}
          className="aspect-square w-full object-contain p-6 md:p-8"
        />
      </div>
      <div className={compact ? "p-7 md:p-9" : "px-6 py-8 md:pl-14"}>
        <p className="eyebrow text-rust">
          {product.category} / NO. {String(product.id).padStart(3, "0")}
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-tight">
          {product.name}
        </h1>
        <p className="mt-4 text-2xl text-forest">
          {formatPrice(product.price_cents)}
        </p>
        <p className="mt-5 text-sm leading-7 text-ink/65">
          {product.description}
        </p>
        <p className="mt-6 flex items-center gap-2 text-xs text-forest">
          <span
            className={`h-1.5 w-1.5 rounded-full ${product.stock > 0 ? "bg-forest" : "bg-rust"}`}
          />
          {product.stock > 0
            ? `${product.stock} available for your next adventure`
            : "Currently out of stock"}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <QuantityInput
            value={quantity}
            onChange={setQuantity}
            max={Math.min(99, product.stock)}
          />
          <Button
            disabled={product.stock <= 0}
            onClick={() => addToCart(product, quantity)}
          >
            <Icon name="bag" size={17} />
            Add to bag
          </Button>
        </div>
        <div className="mt-7 flex items-center gap-2 border-t border-forest/15 pt-5 text-[11px] text-ink/50">
          <Icon name="sparkles" size={15} /> A fictional treasure. A very real
          sense of adventure.
        </div>
        {compact && (
          <Link
            to={`/products/${product.id}`}
            onClick={onClose}
            className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-forest underline underline-offset-4"
          >
            View full details <Icon name="arrowRight" size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
