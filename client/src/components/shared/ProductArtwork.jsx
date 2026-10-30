export function ProductArtwork({
  product,
  className = "",
  imageClassName = "",
  ...props
}) {
  return (
    <div
      className={`product-stage relative overflow-hidden ${className}`}
      {...props}
    >
      <img
        src={product.image}
        alt={product.name}
        className={`h-full w-full object-contain ${imageClassName}`}
        loading="lazy"
      />
    </div>
  );
}
