import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import ProductDetails from "../components/ProductDetails.jsx";
import { Button, EmptyState, Icon, Modal } from "../components/ui.jsx";
import { useShop } from "../state/shop-context.js";

const categories = [
  { name: "All supplies", value: "all", icon: "sparkles" },
  { name: "Dice sets", value: "Dice", icon: "dice" },
  { name: "Potions & elixirs", value: "Potions", icon: "potion" },
  { name: "Spellbooks", value: "Spellbooks", icon: "book" },
  { name: "Adventure gear", value: "Gear", icon: "bag" },
];
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-forest/10">
      <div className="shell relative grid items-center gap-2 py-10 md:min-h-[440px] md:grid-cols-[.95fr_1.05fr] md:py-10">
        <div className="relative z-10 py-5">
          <p className="eyebrow flex items-center gap-2 text-rust">
            <span className="h-px w-6 bg-rust" /> THE ADVENTURER’S GENERAL STORE
          </p>
          <h1 className="mt-5 font-serif text-[49px] leading-[1.06] tracking-[-1.7px] sm:text-6xl lg:text-[72px]">
            Good gear.
            <br />
            <span className="italic text-forest">Great adventures.</span>
          </h1>
          <p className="mt-6 max-w-[360px] text-[13px] leading-6 text-ink/65">
            For your first roll, your final boss, and every side quest in
            between. A little extraordinary for your everyday.
          </p>
          <a
            href="#collection"
            className="mt-7 inline-flex items-center gap-5 rounded-[4px] bg-rust px-6 py-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#ad4a28]"
          >
            Explore the collection <Icon name="arrowRight" size={17} />
          </a>
          <p className="mt-6 flex items-center gap-2 text-[10px] text-ink/45">
            <Icon name="dice" size={13} /> Curated for curious souls & legendary
            parties.
          </p>
        </div>
        <div className="relative -mx-4 hidden self-stretch md:flex md:items-center">
          <div className="absolute left-[13%] top-[10%] h-[85%] w-[80%] rounded-[50%] bg-[#e6e9da]/70" />
          <img
            src="/images/hero-supplies.svg"
            alt="An illustrated collection of enchanted potions, a leather spellbook, and adventurer's dice"
            className="relative z-10 w-full scale-110 object-contain"
            fetchPriority="high"
          />
          <span className="absolute bottom-0 right-3 z-20 flex h-24 w-24 -rotate-12 flex-col items-center justify-center rounded-full border border-dashed border-forest/35 bg-paper/95 text-center text-[9px] font-semibold leading-4 tracking-wider text-forest">
            <Icon name="sparkles" size={20} /> A LITTLE
            <br />
            EVERYDAY MAGIC
          </span>
        </div>
      </div>
    </section>
  );
}
function Benefits() {
  return (
    <div className="border-b border-forest/10 bg-[#eeeee5]/60">
      <div className="shell grid grid-cols-3 divide-x divide-forest/10 py-5">
        {[
          {
            icon: "dice",
            title: "Made for your next campaign",
            text: "Small treasures. Big possibilities.",
          },
          {
            icon: "sparkles",
            title: "A carefully curated collection",
            text: "Every item has a story to tell.",
          },
          {
            icon: "package",
            title: "For every kind of adventurer",
            text: "First-timer or forever dungeon master.",
          },
        ].map(({ icon, title, text }) => (
          <div
            key={title}
            className="flex items-center justify-center gap-3 px-2"
          >
            <Icon
              name={icon}
              size={23}
              className="hidden shrink-0 text-forest/70 sm:block"
            />
            <div>
              <p className="text-center text-[9px] font-medium sm:text-left sm:text-[11px]">
                {title}
              </p>
              <p className="mt-1 hidden text-[10px] text-ink/50 lg:block">
                {text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShopPage({ featured = false }) {
  const { products, loading, error, reloadProducts } = useShop();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const location = useLocation();
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
          <Benefits />
        </>
      )}
      <section id="collection" className="shell pt-12 pb-6 md:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-rust">THE LOOT ROOM</p>
            <h2 className="mt-2 font-serif text-4xl tracking-[-.6px] md:text-[42px]">
              Find your next favorite.
            </h2>
            <p className="mt-3 text-xs leading-6 text-ink/55">
              A few good things to take along on your next great story.
            </p>
          </div>
          <span className="mb-1 flex items-center gap-2 text-[11px] text-ink/50">
            <Icon name="sparkles" size={14} /> {products.length} treasures.
            Endless possibilities.
          </span>
        </div>
        <div className="mt-8 grid gap-7 lg:grid-cols-[200px_1fr] lg:gap-10">
          <aside className="lg:pt-2">
            <h3 className="eyebrow hidden text-ink/50 lg:block">
              BROWSE BY CATEGORY
            </h3>
            <div className="flex flex-wrap gap-1.5 lg:mt-5 lg:flex-col lg:gap-1">
              {categories.map(({ name, value, icon }) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                  className={`flex items-center gap-2.5 rounded-[4px] px-3 py-3 text-left text-[11px] transition-colors lg:text-xs ${category === value ? "bg-forest text-white" : "text-ink/65 hover:bg-forest/5"}`}
                >
                  <Icon name={icon} size={16} />
                  <span className="flex-1">{name}</span>
                  <span
                    className={`ml-3 text-[10px] ${category === value ? "text-white/65" : "text-ink/35"}`}
                  >
                    {value === "all"
                      ? products.length
                      : products.filter((p) => p.category === value).length}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-9 hidden rounded bg-[#eaeadd] p-5 lg:block">
              <Icon name="dice" size={25} className="text-forest" />
              <h3 className="mt-4 font-serif text-[21px] leading-tight">
                Leave room
                <br />
                for a little magic.
              </h3>
              <p className="mt-3 text-[11px] leading-6 text-ink/60">
                The best loot isn’t always the rarest. Sometimes, it’s the thing
                that starts a story.
              </p>
              <span className="mt-5 block text-[9px] font-semibold tracking-widest text-rust">
                — THE DICE & LORE GUILD
              </span>
            </div>
          </aside>
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 pb-5">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded border border-forest/15 bg-white px-3 py-2.5 sm:max-w-[330px]">
                <Icon
                  name="search"
                  size={16}
                  className="shrink-0 text-ink/40"
                />
                <input
                  type="search"
                  aria-label="Search products"
                  placeholder="Search for a little magic…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-[11px] outline-none placeholder:text-ink/40"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </label>
              <label className="flex items-center gap-2 text-[10px] text-ink/50">
                Sort by:
                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="max-w-32 bg-transparent py-2 text-[11px] font-medium text-ink"
                >
                  <option value="featured">Featured</option>
                  <option value="low">Price: low to high</option>
                  <option value="high">Price: high to low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </label>
            </div>
            {(search || category !== "all") && (
              <p className="mb-5 text-xs text-ink/60">
                {filtered.length}{" "}
                {filtered.length === 1 ? "treasure" : "treasures"} found
                {search && <> for “{search}”</>}
                <button
                  type="button"
                  className="ml-3 text-rust underline underline-offset-4"
                  onClick={reset}
                >
                  Clear filters
                </button>
              </p>
            )}
            {loading ? (
              <div
                aria-label="Loading products"
                role="status"
                className="grid grid-cols-3 gap-4 sm:gap-6"
              >
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[1.2] rounded bg-forest/7" />
                    <div className="mt-4 h-4 w-3/4 rounded bg-forest/7" />
                    <div className="mt-3 h-3 w-1/2 rounded bg-forest/7" />
                  </div>
                ))}
                <span className="sr-only">Finding your next treasure…</span>
              </div>
            ) : error ? (
              <EmptyState
                title="Our shelves are taking a moment"
                icon="package"
                action={
                  <Button onClick={() => reloadProducts()}>Try again</Button>
                }
              >
                {error}
              </EmptyState>
            ) : filtered.length ? (
              <div
                key={location.pathname}
                className="grid grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-10"
                data-testid="product-grid"
              >
                {filtered.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onQuickView={setSelectedProduct}
                  />
                ))}
              </div>
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
                Try another search or browse a different category. There is
                still a little magic waiting for you.
              </EmptyState>
            )}
            <p className="mt-8 flex items-center justify-center gap-3 text-[10px] text-ink/40">
              <span className="h-px w-8 bg-forest/15" />
              {loading
                ? "A little magic is on its way"
                : `Showing ${filtered.length} of ${products.length} treasures`}
              <span className="h-px w-8 bg-forest/15" />
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
