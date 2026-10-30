import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useShop } from "../state/shop-context.js";
import { api } from "../lib/api.js";
import {
  BackLink,
  Button,
  Field,
  Icon,
  LinkButton,
  Notice,
  PageHeader,
} from "../components/ui.jsx";
export default function AuthPage({ mode = "login" }) {
  const register = mode === "register";
  const { user, setUser, notify } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const redirect =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/") &&
    !location.state.from.startsWith("//")
      ? location.state.from
      : "/products";
  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api(`/api/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: {
          ...(register ? { name: name.trim() } : {}),
          email: email.trim(),
          password,
        },
      });
      setUser(result.user);
      notify(
        `Welcome${register ? " to the guild" : " back"}, ${result.user.name}!`,
      );
      navigate(redirect, { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }
  function fillDemo(account) {
    setEmail(`${account}@diceandlore.test`);
    setPassword("RollForAdventure!24");
    setError("");
  }
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-16">
      <BackLink />
      <div className="grid overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-2">
        <div className="min-w-0 px-5 py-9 sm:px-12 sm:py-12">
          <div className="mb-7 flex size-12 items-center justify-center rounded-lg border border-gold/20 bg-gold/5 text-gold">
            <Icon name="user" className="size-5" />
          </div>
          <PageHeader
            eyebrow="THE ADVENTURER’S GUILD"
            title={
              user
                ? "You’re already in the guild."
                : register
                  ? "Forge your own legend."
                  : "Welcome back, adventurer."
            }
          >
            {user
              ? `You’re signed in as ${user.name}. Your next quest is waiting.`
              : register
                ? "Create an account to keep a record of your treasures and the adventures ahead."
                : "Sign in to gather your equipment and open your adventure journal."}
          </PageHeader>
          {user ? (
            <LinkButton to={redirect} className="mt-7">
              Continue your adventure{" "}
              <Icon name="arrowRight" className="size-4" />
            </LinkButton>
          ) : (
            <>
              <form className="mt-8 space-y-5" onSubmit={submit}>
                {register && (
                  <Field
                    label="Adventurer name"
                    id="account-name"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={80}
                    minLength={2}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="What shall the bards call you?"
                    disabled={submitting}
                  />
                )}
                <Field
                  label="Email address"
                  id="account-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@yourguild.com"
                  disabled={submitting}
                />
                <div>
                  <Field
                    label="Password"
                    id="account-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    required
                    minLength={register ? 12 : undefined}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      register
                        ? "At least 12 characters"
                        : "Your secret incantation"
                    }
                    disabled={submitting}
                    hint={
                      register
                        ? "At least 12 characters, including uppercase and lowercase letters and a number."
                        : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-controls="account-password"
                    aria-pressed={showPassword}
                    className="mt-2 inline-flex min-h-9 items-center gap-2 text-xs text-muted transition hover:text-gold"
                  >
                    <Icon name="eye" className="size-4" />
                    {showPassword ? "Hide password" : "Show password"}
                  </button>
                </div>
                {error && <Notice variant="error">{error}</Notice>}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full justify-center"
                >
                  {submitting
                    ? "Opening the guild gates…"
                    : register
                      ? "Join the guild"
                      : "Sign in"}
                  {!submitting && <Icon name="arrowRight" className="size-4" />}
                </Button>
              </form>
              <p className="mt-6 text-center text-xs leading-6 text-muted">
                {register ? "Already part of the party?" : "New to the guild?"}{" "}
                <Link
                  to={register ? "/login" : "/register"}
                  state={{ from: redirect }}
                  className="font-semibold text-gold underline decoration-gold/30 underline-offset-4 hover:decoration-gold"
                >
                  {register ? "Sign in" : "Create an account"}
                </Link>
              </p>
              {!register && (
                <div className="mt-8 rounded-lg border border-line bg-void p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-gold">
                    <Icon name="dice" className="size-4" />
                    Choose a test adventurer
                  </p>
                  <p className="mt-2 text-xs leading-6 text-muted">
                    Development demo accounts. Choose one to fill the form, then
                    sign in.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => fillDemo("aria")}
                      disabled={submitting}
                      className="px-3 text-xs"
                    >
                      Try Aria’s account
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => fillDemo("finn")}
                      disabled={submitting}
                      className="px-3 text-xs"
                    >
                      Try Finn’s account
                    </Button>
                  </div>
                  <p className="mt-4 break-all font-mono text-[10px] leading-6 text-muted">
                    aria@diceandlore.test
                    <br />
                    finn@diceandlore.test
                    <br />
                    <span className="text-ink/80">
                      Password: RollForAdventure!24
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
          <p className="mt-7 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-muted">
            <Icon name="shield" className="size-3.5 shrink-0 text-gold/70" />A
            secure session for the adventures ahead.
          </p>
        </div>
        <div className="relative hidden flex-col justify-between overflow-hidden border-l border-line bg-void lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#2a1218,transparent_70%)]" />
          <div className="relative z-10 px-10 pt-12">
            <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-gold">
              <Icon name="dice" className="size-4" />
              YOUR NEXT CHAPTER AWAITS
            </span>
            <h2 className="mt-7 max-w-sm font-serif text-5xl leading-[1.12] text-ink">
              Every legend
              <br />
              needs a party.
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-7 text-muted">
              Rare finds. Trusted equipment. Everything you need when the
              dungeon calls.
            </p>
          </div>
          <img
            src="/images/hero-supplies.svg"
            alt="Magical potions, a spellbook, and dice for a dungeon adventure"
            className="relative my-auto w-full object-contain"
          />
          <p className="relative border-t border-line px-10 py-6 text-[10px] tracking-[0.2em] text-muted">
            DICE & LORE <span className="px-2 text-gold">✦</span> EQUIP YOUR
            LEGEND
          </p>
        </div>
      </div>
    </section>
  );
}
