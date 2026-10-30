import { useState } from "react";
import { Link } from "react-router-dom";
import { useShop } from "../state/shop-context.js";
import { api, formatPrice } from "../lib/api.js";
import { Button, EmptyState, Icon, QuantityInput } from "../components/ui.jsx";

export default function CartPage() {
  const {
    cart,
    cartItems,
    cartCount,
    totalCents,
    user,
    setUser,
    authLoading,
    loading,
    error: productsError,
    setQuantity,
    removeFromCart,
    clearCart,
    reloadProducts,
  } = useShop();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  async function checkout() {
    if (submitting || !user || !cartItems.length) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api("/api/orders", {
        method: "POST",
        body: {
          items: cart.map(({ product_id, quantity }) => ({
            product_id,
            quantity,
          })),
        },
      });
      setOrder(result.order);
      clearCart();
      await reloadProducts();
    } catch (failure) {
      if (failure.status === 401) setUser(null);
      if (failure.status === 409) await reloadProducts();
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (order)
    return (
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mb-7 flex size-16 items-center justify-center rounded-full bg-[#e4ece5] text-[#204f49]">
          <Icon name="check" className="size-8" />
        </div>
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-[#c65c36]">
          ADVENTURE, CONFIRMED
        </p>
        <h1 className="font-serif text-4xl text-[#204f49] sm:text-5xl">
          Your next chapter is packed.
        </h1>
        <p className="mt-5 leading-7 text-[#6e756b]">
          Your simulated order has been saved. No payment was taken and no
          products will be shipped.
        </p>
        <div className="mt-9 overflow-hidden rounded-xl border border-[#dedfd5] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ecece4] px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#788071]">
                Order number
              </p>
              <p className="mt-1 font-semibold text-[#204f49]">
                {order.number}
              </p>
            </div>
            <span className="rounded-full bg-[#edf1e9] px-3 py-1 text-xs font-medium text-[#46664d]">
              Simulation complete
            </span>
          </div>
          <ul className="divide-y divide-[#ecece4] px-6">
            {order.items.map((item) => (
              <li
                key={item.product_id}
                className="flex justify-between gap-4 py-4 text-sm"
              >
                <span>
                  {item.name}{" "}
                  <span className="text-[#788071]">× {item.quantity}</span>
                </span>
                <span className="whitespace-nowrap font-medium">
                  {formatPrice(item.price_cents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-[#ecece4] bg-[#fafaf5] px-6 py-5 font-semibold text-[#204f49]">
            <span>Total</span>
            <span>{formatPrice(order.total_cents)}</span>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-5">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 rounded-md bg-[#204f49] px-6 py-3 text-sm font-medium text-white"
          >
            Keep exploring <Icon name="arrowRight" className="size-4" />
          </Link>
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#204f49]"
          >
            View your orders <Icon name="chevronRight" className="size-4" />
          </Link>
        </div>
      </section>
    );

  if (loading)
    return (
      <section className="mx-auto max-w-7xl px-5 py-20" aria-busy="true">
        <p className="text-[#6e756b]">Gathering your supplies…</p>
      </section>
    );
  if (productsError)
    return (
      <section className="mx-auto max-w-3xl px-5 py-20">
        <EmptyState
          icon="bag"
          title="We couldn’t unpack your cart."
          action={<Button onClick={() => reloadProducts()}>Try again</Button>}
        >
          {productsError}
        </EmptyState>
      </section>
    );
  if (!cartItems.length && !cart.length)
    return (
      <section className="mx-auto max-w-3xl px-5 py-20">
        <EmptyState
          icon="bag"
          title="Every adventure starts with an empty bag."
          action={
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-md bg-[#204f49] px-6 py-3 text-sm font-medium text-white"
            >
              Explore the collection{" "}
              <Icon name="arrowRight" className="size-4" />
            </Link>
          }
        >
          Your cart is empty. A little magic is waiting in the collection.
        </EmptyState>
      </section>
    );

  const unavailable =
    cartItems.length !== cart.length ||
    cartItems.some(({ product, quantity }) => product.stock < quantity);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <Link
        to="/products"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[#6e756b] hover:text-[#204f49]"
      >
        <Icon name="arrowLeft" className="size-4" /> Back to the collection
      </Link>
      <div className="mb-10">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-[#c65c36]">
          YOUR INVENTORY
        </p>
        <h1 className="font-serif text-4xl text-[#204f49] sm:text-5xl">
          A bag full of possibility.
        </h1>
        <p className="mt-3 text-sm text-[#6e756b]">
          {cartCount} {cartCount === 1 ? "treasure" : "treasures"} for your next
          adventure.
        </p>
      </div>
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border border-[#dedfd5] bg-white">
          <ul className="divide-y divide-[#e8e9e0]">
            {cartItems.map(({ product_id, quantity, product }) => (
              <li
                key={product_id}
                className="flex flex-wrap items-center gap-4 p-5 sm:gap-6 sm:p-6"
              >
                <Link
                  to={`/products/${product_id}`}
                  className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-[#f1f1e8] sm:size-28"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="size-full object-contain p-2"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#788071]">
                    {product.category}
                  </p>
                  <Link
                    to={`/products/${product_id}`}
                    className="font-serif text-lg text-[#204f49] hover:underline"
                  >
                    {product.name}
                  </Link>
                  <p className="mt-2 text-sm text-[#6e756b]">
                    {formatPrice(product.price_cents)} each
                  </p>
                  <button
                    type="button"
                    onClick={() => removeFromCart(product_id)}
                    disabled={submitting}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#8a5743] hover:underline disabled:opacity-40"
                  >
                    <Icon name="trash" className="size-3.5" /> Remove
                  </button>
                </div>
                <div className="ml-auto flex items-center gap-5 sm:flex-col sm:items-end sm:gap-4">
                  <span className="font-medium text-[#204f49]">
                    {formatPrice(product.price_cents * quantity)}
                  </span>
                  <fieldset
                    disabled={submitting}
                    className={submitting ? "opacity-50" : ""}
                  >
                    <legend className="sr-only">
                      Quantity for {product.name}
                    </legend>
                    <QuantityInput
                      value={quantity}
                      max={Math.min(product.stock || 1, 99)}
                      onChange={(value) => setQuantity(product_id, value)}
                    />
                  </fieldset>
                </div>
                {quantity > product.stock && (
                  <p className="w-full text-sm text-[#a43f30]" role="alert">
                    Only {product.stock} available. Update the quantity or
                    remove this item.
                  </p>
                )}
              </li>
            ))}
          </ul>
          {cartItems.length !== cart.length && (
            <div className="border-t border-[#e8e9e0] p-5">
              <p className="mb-3 text-sm text-[#a43f30]">
                Some items are no longer available. Clear your cart to start a
                new collection.
              </p>
              <Button
                variant="secondary"
                onClick={clearCart}
                disabled={submitting}
              >
                Clear cart
              </Button>
            </div>
          )}
        </div>
        <aside className="rounded-xl border border-[#dedfd5] bg-[#efefe5] p-6 sm:p-7">
          <h2 className="font-serif text-2xl text-[#204f49]">
            The adventure so far
          </h2>
          <dl className="mt-7 space-y-4 text-sm">
            <div className="flex justify-between gap-5">
              <dt className="text-[#6e756b]">Subtotal</dt>
              <dd>{formatPrice(totalCents)}</dd>
            </div>
            <div className="flex justify-between gap-5">
              <dt className="text-[#6e756b]">Payment & shipping</dt>
              <dd className="text-right text-xs leading-5">Simulated only</dd>
            </div>
            <div className="flex justify-between border-t border-[#d8dbce] pt-5 text-lg font-semibold text-[#204f49]">
              <dt>Total</dt>
              <dd>{formatPrice(totalCents)}</dd>
            </div>
          </dl>
          <p className="mt-5 rounded-md bg-white/60 px-3 py-3 text-xs leading-5 text-[#63705e]">
            <strong className="block font-semibold text-[#204f49]">
              This is a practice adventure.
            </strong>
            No real payment or delivery. Your order will be saved to your
            account.
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md bg-[#f9e9e3] p-3 text-sm text-[#a43f30]"
            >
              {error}
            </p>
          )}
          {authLoading ? (
            <p className="mt-6 text-sm text-[#6e756b]">
              Checking your account…
            </p>
          ) : user ? (
            <>
              <p className="mt-5 text-xs text-[#6e756b]">
                Ordering as{" "}
                <strong className="font-medium text-[#204f49]">
                  {user.name}
                </strong>
              </p>
              <Button
                className="mt-4 w-full justify-center"
                onClick={checkout}
                disabled={submitting || unavailable}
              >
                {submitting ? "Saving your order…" : "Place simulated order"}
                {!submitting && <Icon name="arrowRight" className="size-4" />}
              </Button>
            </>
          ) : (
            <Link
              to="/login"
              state={{ from: "/cart" }}
              className="mt-6 flex items-center justify-center gap-2 rounded-md bg-[#204f49] px-4 py-3.5 text-sm font-medium text-white"
            >
              Sign in to check out <Icon name="arrowRight" className="size-4" />
            </Link>
          )}
          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#6e756b]">
            <Icon name="shield" className="size-3.5" /> Your session stays
            private
          </div>
        </aside>
      </div>
    </section>
  );
}
