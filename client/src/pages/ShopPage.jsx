import { useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
} from "../components/ui.jsx";
import ProductDetails from "../components/ProductDetails.jsx";
import Hero from "../components/catalog/Hero.jsx";
import ShopBenefits from "../components/catalog/ShopBenefits.jsx";
import CategoryFilter from "../components/catalog/CategoryFilter.jsx";
import CollectionToolbar from "../components/catalog/CollectionToolbar.jsx";
import ProductGrid from "../components/catalog/ProductGrid.jsx";
import { useShop } from "../state/shop-context.js";
export default function ShopPage({ featured = false }) {
  const { products, loading, error, reloadProducts } = useShop();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(term),
    );
    return sort === "low"
      ? list.sort((a, b) => a.price_cents - b.price_cents)
      : sort === "high"
        ? list.sort((a, b) => b.price_cents - a.price_cents)
        : sort === "name"
          ? list.sort((a, b) => a.name.localeCompare(b.name))
          : list;
  }, [products, category, search, sort]);
  function reset() {
    setSearch("");
    setCategory("all");
    setSort("featured");
  }
  return (
    <main>
      {featured && (
        <>
          <Hero />
          <ShopBenefits />
        </>
      )}
      <section id="collection" className="shell py-12 md:py-16">
        <PageHeader
          as={featured ? "h2" : "h1"}
          eyebrow="THE COLLECTION"
          title="Treasures worth the quest."
          aside={
            <span className="flex items-center gap-2">
              <Icon name="sparkles" size={15} className="text-gold" />
              {products.length} items in the vault
            </span>
          }
        >
          Rare finds. Arcane essentials. A little something for every
          adventurer.
        </PageHeader>
        <div className="mt-8 grid gap-7 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-8">
          <CategoryFilter
            products={products}
            value={category}
            onChange={setCategory}
          />
          <div className="min-w-0">
            <CollectionToolbar
              search={search}
              onSearch={setSearch}
              sort={sort}
              onSort={setSort}
              count={filtered.length}
            />
            {(search || category !== "all") && (
              <p className="mb-5 text-xs leading-6 text-muted">
                {filtered.length}{" "}
                {filtered.length === 1 ? "treasure" : "treasures"} found
                {search && <> for “{search}”</>}
                <button
                  type="button"
                  className="ml-3 text-gold underline underline-offset-4"
                  onClick={reset}
                >
                  Clear filters
                </button>
              </p>
            )}
            {loading ? (
              <ProductGrid loading />
            ) : error ? (
              <EmptyState
                title="Our vault is taking a moment"
                icon="package"
                action={
                  <Button onClick={() => reloadProducts()}>Try again</Button>
                }
              >
                {error}
              </EmptyState>
            ) : filtered.length ? (
              <ProductGrid
                products={filtered}
                onQuickView={setSelectedProduct}
              />
            ) : (
              <EmptyState
                title="No treasures found"
                icon="search"
                action={
                  <Button variant="secondary" onClick={reset}>
                    Show all supplies
                  </Button>
                }
              >
                Try another search or explore a different category. Your next
                discovery is still out there.
              </EmptyState>
            )}
            <p className="mt-8 flex items-center justify-center gap-3 text-[10px] tracking-wider text-muted/75">
              <span className="h-px w-8 bg-line" />
              {loading
                ? "Opening the vault…"
                : `Showing ${filtered.length} of ${products.length} treasures`}
              <span className="h-px w-8 bg-line" />
            </p>
          </div>
        </div>
      </section>
      {selectedProduct && (
        <Modal
          title={selectedProduct.name}
          onClose={() => setSelectedProduct(null)}
        >
          <ProductDetails
            product={selectedProduct}
            compact
            onClose={() => setSelectedProduct(null)}
          />
        </Modal>
      )}
    </main>
  );
}
