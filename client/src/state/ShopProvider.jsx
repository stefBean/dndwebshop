import { useCallback, useEffect, useRef, useState } from "react";
import { ShopContext } from "./shop-context.js";
import { api } from "../lib/api.js";
import { CART_STORAGE_KEY, readCartForVersion, writeCartForVersion } from "../lib/cart-storage.js";

export default function ShopProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [resetVersion, setResetVersion] = useState(null);
  const versionRef = useRef(null);
  const resetRequest = useRef(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef();
  const notify = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  const reloadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/products");
      setProducts(Array.isArray(data) ? data : data.products);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  const checkResetVersion = useCallback(() => {
    if (resetRequest.current) return resetRequest.current;
    resetRequest.current = (async () => {
      const data = await api('/api/shop/state');
      if (typeof data.resetVersion !== 'string' || !data.resetVersion) throw new Error('Shop status unavailable.');
      const previous = versionRef.current;
      if (previous !== data.resetVersion) {
        const items = previous === null ? readCartForVersion(data.resetVersion) : [];
        versionRef.current = data.resetVersion;
        writeCartForVersion(items, data.resetVersion);
        setCart(items);
        setResetVersion(data.resetVersion);
        if (previous !== null) {
          setUser(null);
          await reloadProducts();
          notify('Der Shop wurde zurückgesetzt. Dein Warenkorb ist jetzt leer. Bitte erneut anmelden.');
        }
      }
      return previous === null || previous === data.resetVersion;
    })().finally(() => { resetRequest.current = null; });
    return resetRequest.current;
  }, [notify, reloadProducts]);
  const ensureCurrentCart = useCallback(async () => {
    try { return await checkResetVersion(); }
    catch {
      notify('Shop-Status nicht erreichbar. Bitte erneut versuchen. Dein Warenkorb bleibt erhalten.');
      return false;
    }
  }, [checkResetVersion, notify]);
  useEffect(() => {
    const refresh = () => { void ensureCurrentCart(); };
    const storageChanged = (event) => { if (event.key === CART_STORAGE_KEY) refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', storageChanged);
    };
  }, [ensureCurrentCart]);
  useEffect(() => {
    const controller = new AbortController();
    api("/api/products", { signal: controller.signal })
      .then((data) => setProducts(Array.isArray(data) ? data : data.products))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    api("/api/auth/me", { signal: controller.signal })
      .then((data) => setUser(data.user))
      .catch((err) => {
        if (err.name !== "AbortError")
          notify(
            "Account connection unavailable. Please try signing in again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuthLoading(false);
      });
    return () => {
      controller.abort();
      clearTimeout(toastTimer.current);
    };
  }, [notify]);
  useEffect(() => {
    let timer;
    if (!resetVersion || resetVersion !== versionRef.current) return;
    if (!writeCartForVersion(cart, resetVersion)) {
      timer = setTimeout(
        () =>
          notify(
            "Your browser could not save the cart. Keep this tab open while shopping.",
          ),
        0,
      );
    }
    return () => clearTimeout(timer);
  }, [cart, resetVersion, notify]);
  async function addToCart(product, quantity = 1) {
    if (!await ensureCurrentCart()) return;
    if (!Number.isSafeInteger(quantity) || quantity < 1) return;
    if (product.stock <= 0)
      return notify("This treasure is currently out of stock.");
    const current =
      cart.find((item) => item.product_id === product.id)?.quantity || 0;
    const max = Math.min(99, product.stock ?? 99);
    if (current + quantity > max)
      return notify(`You can add up to ${max} of this item.`);
    setCart((items) => {
      const existing = items.find((item) => item.product_id === product.id);
      return existing
        ? items.map((item) =>
            item.product_id === product.id
              ? { ...item, quantity: Math.min(item.quantity + quantity, max) }
              : item,
          )
        : [
            ...items,
            { product_id: product.id, quantity: Math.min(quantity, max) },
          ];
    });
    notify(`${product.name} added to your bag.`);
  }
  async function setQuantity(id, quantity) {
    if (!await ensureCurrentCart()) return;
    const product = products.find((p) => p.id === id);
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > Math.min(99, product?.stock ?? 99)
    )
      return;
    setCart((items) =>
      items.map((item) =>
        item.product_id === id ? { ...item, quantity } : item,
      ),
    );
  }
  const cartItems = cart
    .map((item) => ({
      ...item,
      product: products.find((p) => p.id === item.product_id),
    }))
    .filter((item) => item.product);
  const value = {
    products,
    loading,
    error,
    user,
    authLoading,
    cart,
    resetVersion,
    ensureCurrentCart,
    cartItems,
    toast,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: cartItems.reduce(
      (sum, item) => sum + (item.product?.price_cents || 0) * item.quantity,
      0,
    ),
    addToCart,
    setQuantity,
    setUser,
    notify,
    reloadProducts,
    removeFromCart: async (id) => {
      if (await ensureCurrentCart()) setCart((items) => items.filter((item) => item.product_id !== id));
    },
    clearCart: () => setCart([]),
  };
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
