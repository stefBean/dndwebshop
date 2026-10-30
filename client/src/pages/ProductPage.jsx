import { Link, useParams } from "react-router-dom";
import { useShop } from "../state/shop-context.js";
import ProductDetails from "../components/ProductDetails.jsx";
import { Button, EmptyState, Icon } from "../components/ui.jsx";

export default function ProductPage() {
  const { id } = useParams();
  const { products, loading, error, reloadProducts } = useShop();
  const product = products.find((item) => item.id === Number(id));
  return (
    <main className="shell py-10">
      <Link
        to="/products"
        className="mb-8 inline-flex items-center gap-2 text-xs text-ink/60 hover:text-rust"
      >
        <Icon name="arrowLeft" size={16} /> Back to the collection
      </Link>
      {loading ? (
        <p role="status" className="py-20 text-center text-sm">
          Finding your treasure…
        </p>
      ) : error ? (
        <EmptyState
          title="We could not load this treasure"
          action={<Button onClick={() => reloadProducts()}>Try again</Button>}
        >
          {error}
        </EmptyState>
      ) : product ? (
        <ProductDetails key={product.id} product={product} />
      ) : (
        <EmptyState
          title="This treasure could not be found"
          icon="search"
          action={
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-sm text-forest underline underline-offset-4"
            >
              Back to the collection <Icon name="arrowRight" size={16} />
            </Link>
          }
        >
          This product does not exist. There are still plenty of good things on
          our shelves.
        </EmptyState>
      )}
    </main>
  );
}
