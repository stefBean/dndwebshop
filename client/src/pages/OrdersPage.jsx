import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useShop } from "../state/shop-context.js";
import { api, formatPrice } from "../lib/api.js";
import { Button, EmptyState, Icon } from "../components/ui.jsx";

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
      <section className="mx-auto max-w-7xl px-5 py-20" aria-busy="true">
        <p className="text-[#6e756b]">Opening your adventure journal…</p>
      </section>
    );
  if (!user)
    return (
      <section className="mx-auto max-w-3xl px-5 py-20">
        <EmptyState
          icon="user"
          title="Your adventures, all in one place."
          action={
            <Link
              to="/login"
              state={{ from: "/account/orders" }}
              className="inline-flex items-center gap-2 rounded-md bg-[#204f49] px-6 py-3 text-sm font-medium text-white"
            >
              Sign in to view orders{" "}
              <Icon name="arrowRight" className="size-4" />
            </Link>
          }
        >
          Sign in to see the simulated orders saved to your account.
        </EmptyState>
      </section>
    );

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <Link
        to="/products"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[#6e756b] hover:text-[#204f49]"
      >
        <Icon name="arrowLeft" className="size-4" /> Back to the collection
      </Link>
      <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-[#c65c36]">
        THE ADVENTURE JOURNAL
      </p>
      <h1 className="font-serif text-4xl text-[#204f49] sm:text-5xl">
        Your past adventures.
      </h1>
      <p className="mt-4 text-sm leading-7 text-[#6e756b]">
        A record of every treasure gathered, {user.name}. These orders are
        simulations; no payment or shipping takes place.
      </p>
      {result.ownerId !== user.id ? (
        <p className="py-16 text-sm text-[#6e756b]" role="status">
          Loading your orders…
        </p>
      ) : result.error ? (
        <div className="mt-10">
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
        </div>
      ) : !result.orders.length ? (
        <div className="mt-10">
          <EmptyState
            icon="package"
            title="A fresh page is waiting."
            action={
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-md bg-[#204f49] px-6 py-3 text-sm font-medium text-white"
              >
                Find your first treasure{" "}
                <Icon name="arrowRight" className="size-4" />
              </Link>
            }
          >
            You haven’t placed any simulated orders yet. Your next great story
            starts in the collection.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-10 space-y-6">
          {result.orders.map((order) => (
            <article
              key={order.id}
              className="overflow-hidden rounded-xl border border-[#dde1d4] bg-white"
            >
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6e9df] bg-[#f0f2e9] px-5 py-5 sm:px-7">
                <div>
                  <h2 className="text-sm font-semibold text-[#204f49]">
                    {order.number}
                  </h2>
                  <p className="mt-1 text-xs text-[#788071]">
                    {new Date(order.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d5dfcb] bg-[#e6edde] px-3 py-1.5 text-[10px] font-medium text-[#46664d]">
                  <Icon name="check" className="size-3" /> Simulation complete
                </span>
              </header>
              <ul className="divide-y divide-[#edf0e8] px-5 sm:px-7">
                {order.items.map((item) => (
                  <li
                    key={item.product_id}
                    className="flex justify-between gap-5 py-5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-[#204f49]">{item.name}</p>
                      <p className="mt-1 text-xs text-[#788071]">
                        {item.quantity} × {formatPrice(item.price_cents)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-[#204f49]">
                      {formatPrice(item.price_cents * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <footer className="flex items-center justify-between border-t border-[#e6e9df] px-5 py-5 font-medium text-[#204f49] sm:px-7">
                <span className="text-sm">Order total</span>
                <span>{formatPrice(order.total_cents)}</span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
