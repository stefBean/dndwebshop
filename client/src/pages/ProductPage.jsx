import { useParams } from "react-router-dom";
import { useShop } from "../state/shop-context.js";
import ProductDetails from "../components/ProductDetails.jsx";
import {
  BackLink,
  Button,
  EmptyState,
  Icon,
  LinkButton,
} from "../components/ui.jsx";
export default function ProductPage() {
  const { id } = useParams();
  const { products, loading, error, reloadProducts } = useShop();
  const product = products.find((item) => item.id === Number(id));
  return (
    <main className="shell py-10">
      <BackLink />
      {loading ? (
        <p role="status" className="py-20 text-center text-sm text-muted">
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
            <LinkButton to="/products" variant="secondary">
              Back to the collection <Icon name="arrowRight" size={16} />
            </LinkButton>
          }
        >
          This product does not exist. There are still plenty of good things in
          the vault.
        </EmptyState>
      )}
    </main>
  );
}
