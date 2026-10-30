import { useState } from "react";
import { useShop } from "../state/shop-context.js";
import { api, formatPrice } from "../lib/api.js";
import {
  BackLink,
  Button,
  EmptyState,
  Icon,
  LinkButton,
  Notice,
  OrderCard,
  OrderTotal,
  PageHeader,
} from "../components/ui.jsx";
import CartItem from "../components/CartItem.jsx";
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
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-20">
        <div className="mb-8 flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/5 text-gold">
          <Icon name="check" className="size-8" />
        </div>
        <PageHeader
          eyebrow="QUEST CONFIRMED"
          title="Your next chapter is equipped."
        >
          Your simulated order has been saved to your adventure journal.
        </PageHeader>
        <Notice className="mt-6">
          This was a simulation. No payment was taken and no products will be
          shipped.
        </Notice>
        <div className="mt-8">
          <OrderCard order={order} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton to="/products">
            Keep exploring <Icon name="arrowRight" className="size-4" />
          </LinkButton>
          <LinkButton to="/account/orders" variant="secondary">
            View your orders <Icon name="chevronRight" className="size-4" />
          </LinkButton>
        </div>
      </section>
    );
  if (loading)
    return (
      <section className="shell py-20" aria-busy="true">
        <p className="text-muted">Gathering your equipment…</p>
      </section>
    );
  if (productsError)
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <EmptyState
          icon="bag"
          title="We couldn’t open your inventory."
          action={<Button onClick={() => reloadProducts()}>Try again</Button>}
        >
          {productsError}
        </EmptyState>
      </section>
    );
  if (!cartItems.length && !cart.length)
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <EmptyState
          icon="bag"
          title="Your inventory awaits its first treasure."
          action={
            <LinkButton to="/products">
              Explore the collection{" "}
              <Icon name="arrowRight" className="size-4" />
            </LinkButton>
          }
        >
          Your cart is empty. Find the equipment for your next great quest.
        </EmptyState>
      </section>
    );
  const unavailable =
    cartItems.length !== cart.length ||
    cartItems.some(({ product, quantity }) => product.stock < quantity);
  return (
    <section className="shell py-10 sm:py-16">
      <BackLink />
      <PageHeader eyebrow="YOUR INVENTORY" title="Ready for the next quest.">
        {cartCount} {cartCount === 1 ? "treasure" : "treasures"} gathered for
        the adventures ahead.
      </PageHeader>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              Equipment
            </h2>
            <span className="text-xs text-gold">
              {cartCount} {cartCount === 1 ? "item" : "items"}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {cartItems.map((item) => (
              <CartItem
                key={item.product_id}
                item={item}
                onQuantityChange={(value) =>
                  setQuantity(item.product_id, value)
                }
                onRemove={() => removeFromCart(item.product_id)}
                disabled={submitting}
              />
            ))}
          </ul>
          {cartItems.length !== cart.length && (
            <div className="border-t border-line p-5">
              <Notice variant="error">
                Some equipment is no longer available. Clear your cart to begin
                a new collection.
              </Notice>
              <Button
                variant="secondary"
                onClick={clearCart}
                disabled={submitting}
                className="mt-4"
              >
                Clear cart
              </Button>
            </div>
          )}
        </div>
        <aside className="rounded-xl border border-line bg-surface p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <Icon name="dice" className="size-5 text-gold" />
            <h2 className="font-serif text-2xl text-ink">Quest summary</h2>
          </div>
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Equipment subtotal</dt>
              <dd className="text-ink">{formatPrice(totalCents)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Order type</dt>
              <dd className="text-gold">Simulation</dd>
            </div>
          </dl>
          <OrderTotal cents={totalCents} />
          <Notice className="mt-4">
            <strong className="mb-1 block font-semibold text-ink">
              A practice quest.
            </strong>
            No real payment or delivery. Your order will be saved to your
            account.
          </Notice>
          {error && (
            <Notice variant="error" className="mt-4">
              {error}
            </Notice>
          )}
          {authLoading ? (
            <p className="mt-6 text-sm text-muted">
              Checking your guild account…
            </p>
          ) : user ? (
            <>
              <p className="mt-5 text-xs text-muted">
                Ordering as{" "}
                <strong className="font-medium text-ink">{user.name}</strong>
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
            <LinkButton
              to="/login"
              state={{ from: "/cart" }}
              className="mt-6 w-full justify-center"
            >
              Sign in to check out <Icon name="arrowRight" className="size-4" />
            </LinkButton>
          )}
          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted">
            <Icon name="shield" className="size-3.5 text-gold/70" />
            Your session stays private
          </div>
        </aside>
      </div>
    </section>
  );
}
