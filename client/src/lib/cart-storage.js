export const CART_STORAGE_KEY = "dice-and-lore.cart.v1";
// Persist only references and quantities. Product data and identity stay elsewhere.
export function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];
  const items = new Map();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { product_id, quantity } = item;
    if (
      Number.isSafeInteger(product_id) &&
      product_id > 0 &&
      Number.isSafeInteger(quantity) &&
      quantity >= 1 &&
      quantity <= 99
    )
      items.set(product_id, { product_id, quantity });
  }
  return [...items.values()].slice(0, 100);
}
export function parseCart(serialized) {
  if (typeof serialized !== "string") return [];
  try {
    return sanitizeCart(JSON.parse(serialized));
  } catch {
    return [];
  }
}
export function readCart(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return parseCart(target?.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}
export function writeCart(cart, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return false;
    target.setItem(CART_STORAGE_KEY, JSON.stringify(sanitizeCart(cart)));
    return true;
  } catch {
    return false;
  }
}
