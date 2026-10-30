import { useEffect, useState } from "react";
import { useShop } from "../state/shop-context.js";
import { api } from "../lib/api.js";
import {
  BackLink,
  Button,
  EmptyState,
  Icon,
  LinkButton,
  OrderCard,
  PageHeader,
} from "../components/ui.jsx";
export default function OrdersPage() {
  const { user, setUser, authLoading } = useShop();
  const [result, setResult] = useState({
    orders: [],
    error: "",
    ownerId: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api("/api/orders", { signal: controller.signal })
      .then(({ orders }) => {
        if (!controller.signal.aborted)
          setResult({ orders, error: "", ownerId: user.id });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          if (failure.status === 401) setUser(null);
          setResult({ orders: [], error: failure.message, ownerId: user.id });
        }
      });
    return () => controller.abort();
  }, [user, setUser, attempt]);
  if (authLoading)
    return (
      <section className="shell py-20" aria-busy="true">
        <p className="text-muted">Opening your adventure journal…</p>
      </section>
    );
  if (!user)
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <EmptyState
          icon="user"
          title="Every adventurer has a story."
          action={
            <LinkButton to="/login" state={{ from: "/account/orders" }}>
              Sign in to view orders{" "}
              <Icon name="arrowRight" className="size-4" />
            </LinkButton>
          }
        >
          Sign in to see the simulated orders saved to your guild account.
        </EmptyState>
      </section>
    );
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-16">
      <BackLink />
      <PageHeader
        eyebrow="THE ADVENTURE JOURNAL"
        title="A record of your quests."
      >
        Every treasure gathered, {user.name}. These orders are simulations; no
        payment or shipping takes place.
      </PageHeader>
      {result.ownerId !== user.id ? (
        <p className="py-16 text-sm text-muted" role="status">
          Loading your orders…
        </p>
      ) : result.error ? (
        <EmptyState
          icon="package"
          title="The journal won’t open just yet."
          action={
            <Button onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </Button>
          }
        >
          {result.error}
        </EmptyState>
      ) : !result.orders.length ? (
        <EmptyState
          icon="book"
          title="Your legend is yet to be written."
          action={
            <LinkButton to="/products">
              Find your first treasure{" "}
              <Icon name="arrowRight" className="size-4" />
            </LinkButton>
          }
        >
          You haven’t placed any simulated orders yet. Equip yourself for a new
          adventure in the collection.
        </EmptyState>
      ) : (
        <div className="mt-10 space-y-6">
          {result.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </section>
  );
}
