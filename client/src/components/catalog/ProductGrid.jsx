import ProductCard from "../ProductCard.jsx";
export default function ProductGrid({
  products,
  loading = false,
  onQuickView,
}) {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="product-grid"
      role={loading ? "status" : undefined}
      aria-label={loading ? "Loading products" : undefined}
    >
      {loading ? (
        <>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-line bg-surface"
            >
              <div className="aspect-[1.35] rounded-t-xl bg-raised" />
              <div className="p-5">
                <div className="h-3 w-1/3 rounded bg-raised" />
                <div className="mt-5 h-5 w-3/4 rounded bg-raised" />
                <div className="mt-4 h-3 w-full rounded bg-raised" />
                <div className="mt-8 h-10 rounded bg-raised" />
              </div>
            </div>
          ))}
          <span className="sr-only">Finding your next treasure…</span>
        </>
      ) : (
        products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onQuickView={onQuickView}
          />
        ))
      )}
    </div>
  );
}
