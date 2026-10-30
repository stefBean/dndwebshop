import { useId } from "react";
export function Field({ label, id, hint, error, className = "", ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const description = [
    hint && `${fieldId}-hint`,
    error && `${fieldId}-error`,
    props["aria-describedby"],
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-2 block text-xs font-medium text-ink"
      >
        {label}
      </label>
      <input
        {...props}
        id={fieldId}
        aria-describedby={description || undefined}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={`field ${className}`}
      />
      {hint && (
        <p id={`${fieldId}-hint`} className="mt-2 text-xs leading-5 text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="mt-2 text-xs text-[#f6b0b6]">
          {error}
        </p>
      )}
    </div>
  );
}
