import { Icon } from "../ui.jsx";
const categories = [
  { name: "All supplies", value: "all", icon: "sparkles" },
  { name: "Dice sets", value: "Dice", icon: "dice" },
  { name: "Potions & elixirs", value: "Potions", icon: "potion" },
  { name: "Spellbooks", value: "Spellbooks", icon: "book" },
  { name: "Adventure gear", value: "Gear", icon: "bag" },
];
export default function CategoryFilter({ products, value, onChange }) {
  return (
    <aside className="min-w-0">
      <h3 className="eyebrow mb-4 flex items-center gap-2 text-muted">
        <Icon name="filter" size={14} /> THE INVENTORY
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] lg:flex-col lg:gap-1.5 lg:overflow-visible">
        {categories.map(({ name, value: category, icon }) => (
          <button
            type="button"
            key={category}
            aria-pressed={value === category}
            onClick={() => onChange(category)}
            className={`flex min-h-12 shrink-0 items-center gap-2.5 rounded-md border px-3 py-3 text-left text-xs transition-colors ${value === category ? "border-gold/25 bg-gold/8 text-gold" : "border-line bg-surface text-muted hover:border-gold/20 hover:text-ink"}`}
          >
            <Icon name={icon} size={16} />
            <span className="whitespace-nowrap lg:flex-1">{name}</span>
            <span className="ml-2 text-[10px] text-muted">
              {category === "all"
                ? products.length
                : products.filter((p) => p.category === category).length}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-8 hidden rounded-lg border border-line bg-surface p-5 lg:block">
        <Icon name="dice" size={27} className="text-gold" />
        <h3 className="mt-5 font-serif text-2xl leading-tight text-ink">
          Every legend
          <br />
          starts somewhere.
        </h3>
        <p className="mt-4 text-xs leading-7 text-muted">
          A lucky roll. A well-timed spell. A treasure you couldn’t leave
          behind. Find what calls to you.
        </p>
        <div className="mt-6 h-px w-9 bg-gold/40" />
        <p className="eyebrow mt-4 text-[8px] text-gold/70">
          THE DICE & LORE GUILD
        </p>
      </div>
    </aside>
  );
}
