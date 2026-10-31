import { Icon } from "../ui.jsx";

const categoryPresentation = {
  Dice: { name: "Dice sets", icon: "dice" },
  Potions: { name: "Potions & elixirs", icon: "potion" },
  Spellbooks: { name: "Spellbooks", icon: "book" },
  Gear: { name: "Adventure gear", icon: "bag" },
};

export default function CategoryFilter({ products, value, onChange }) {
  const storedCategories = [
    ...new Set(products.map((product) => product.category)),
  ];
  const categories = [
    { name: "All supplies", value: "all", icon: "sparkles" },
    ...storedCategories.map((category) => ({
      value: category,
      ...(Object.hasOwn(categoryPresentation, category)
        ? categoryPresentation[category]
        : { name: category, icon: "package" }),
    })),
  ];
  return (
    <aside className="min-w-0">
      <h3 className="eyebrow mb-4 flex items-center gap-2 text-muted">
        <Icon name="filter" size={14} /> CATEGORIES
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] lg:flex-col lg:gap-1.5 lg:overflow-visible">
        {categories.map(({ name, value: category, icon }) => (
          <button
            type="button"
            key={category}
            aria-pressed={value === category}
            onClick={() => onChange(category)}
            className={`flex min-h-12 shrink-0 items-center gap-2.5 rounded-md border px-3 py-3 text-left text-xs transition-colors ${value === category ? "border-accent/35 bg-accent/5 text-ink" : "border-line bg-surface text-muted hover:border-accent/50 hover:text-ink"}`}
          >
            <Icon name={icon} size={16} />
            <span className="whitespace-nowrap lg:flex-1">{name}</span>
            <span className="ml-2 text-[10px] text-muted">
              {category === "all"
                ? products.length
                : products.filter((product) => product.category === category)
                    .length}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
