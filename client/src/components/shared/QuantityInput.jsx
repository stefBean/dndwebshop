import { Icon } from "./Icon.jsx";
export function QuantityInput({ value, onChange, max = 99 }) {
  return (
    <div className="inline-flex min-h-11 items-center rounded-md border border-line bg-void text-ink">
      <button
        type="button"
        aria-label="Decrease quantity"
        className="min-h-11 px-3 text-muted hover:text-gold disabled:opacity-25"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Icon name="minus" size={15} />
      </button>
      <input
        aria-label="Quantity"
        className="w-10 bg-transparent text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        type="number"
        min="1"
        max={max}
        step="1"
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isInteger(next) && next >= 1 && next <= max)
            onChange(next);
        }}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        className="min-h-11 px-3 text-muted hover:text-gold disabled:opacity-25"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Icon name="plus" size={15} />
      </button>
    </div>
  );
}
