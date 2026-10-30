import { Icon } from "../ui.jsx";
export default function CollectionToolbar({
  search,
  onSearch,
  sort,
  onSort,
  count,
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3">
      <label className="flex min-h-10 min-w-0 flex-1 items-center gap-3 px-2">
        <Icon name="search" size={18} className="shrink-0 text-muted" />
        <input
          type="search"
          aria-label="Search products"
          placeholder="Search your next treasure…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-muted/70 sm:text-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Clear search"
            className="p-2 text-muted hover:text-gold"
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </label>
      <div className="flex w-full items-center justify-between gap-4 border-t border-line pt-3 sm:w-auto sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <span className="text-xs text-muted sm:hidden">{count} items</span>
        <label className="flex items-center gap-2 text-xs text-muted">
          Sort by:
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            className="max-w-40 rounded bg-surface py-2 pr-1 text-xs font-medium text-ink"
          >
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </label>
      </div>
    </div>
  );
}
