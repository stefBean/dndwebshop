import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useShop } from "../state/shop-context.js";
import { api } from "../lib/api.js";
import { Button, Icon } from "../components/ui.jsx";

const inputStyle =
  "w-full rounded-md border border-[#d9ddd2] bg-white px-4 py-3 text-sm text-[#204f49] outline-none transition placeholder:text-[#9a9f93] focus:border-[#204f49] focus:ring-2 focus:ring-[#204f49]/10";

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
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <Link
        to="/products"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[#6e756b] hover:text-[#204f49]"
      >
        <Icon name="arrowLeft" className="size-4" /> Back to the collection
      </Link>
      <div className="grid overflow-hidden rounded-2xl border border-[#dfe2d7] bg-white lg:grid-cols-2">
        <div className="px-6 py-10 sm:px-12 sm:py-12">
          <div className="mb-6 flex size-11 items-center justify-center rounded-full bg-[#eaf0e7] text-[#204f49]">
            <Icon name="user" className="size-5" />
          </div>
          <p className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-[#c65c36]">
            THE ADVENTURER’S GUILD
          </p>
          <h1 className="font-serif text-4xl text-[#204f49]">
            {user
              ? "You’re already in the guild."
              : register
                ? "Your story starts here."
                : "Welcome back, adventurer."}
          </h1>
          {user ? (
            <>
              <p className="mt-4 text-sm leading-7 text-[#6e756b]">
                You’re signed in as {user.name}. Your next adventure is waiting.
              </p>
              <Link
                to={redirect}
                className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#204f49] px-5 py-3 text-sm text-white"
              >
                Continue your adventure{" "}
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm leading-6 text-[#6e756b]">
                {register
                  ? "Make yourself at home. Create an account to save your simulated orders and keep the adventure going."
                  : "Sign in to gather your supplies and revisit your past adventures."}
              </p>
              <form className="mt-8 space-y-5" onSubmit={submit}>
                {register && (
                  <div>
                    <label
                      htmlFor="account-name"
                      className="mb-2 block text-xs font-medium text-[#204f49]"
                    >
                      Adventurer name
                    </label>
                    <input
                      id="account-name"
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={80}
                      minLength={2}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="What should we call you?"
                      className={inputStyle}
                      disabled={submitting}
                    />
                  </div>
                )}
                <div>
                  <label
                    htmlFor="account-email"
                    className="mb-2 block text-xs font-medium text-[#204f49]"
                  >
                    Email address
                  </label>
                  <input
                    id="account-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@yourguild.com"
                    className={inputStyle}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label
                    htmlFor="account-password"
                    className="mb-2 block text-xs font-medium text-[#204f49]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
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
                          : "Your secret spell"
                      }
                      className={`${inputStyle} pr-12`}
                      disabled={submitting}
                      aria-describedby={register ? "password-help" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#788071] hover:text-[#204f49]"
                    >
                      <Icon name="eye" className="size-4" />
                    </button>
                  </div>
                  {register && (
                    <p
                      id="password-help"
                      className="mt-2 text-xs leading-5 text-[#788071]"
                    >
                      Use at least 12 characters, including an uppercase letter,
                      a lowercase letter, and a number.
                    </p>
                  )}
                </div>
                {error && (
                  <p
                    role="alert"
                    className="rounded-md border border-[#e8b9aa] bg-[#fff4ee] px-4 py-3 text-sm text-[#9b3f2b]"
                  >
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full justify-center"
                >
                  {submitting
                    ? "Preparing your adventure…"
                    : register
                      ? "Join the guild"
                      : "Sign in"}
                  {!submitting && <Icon name="arrowRight" className="size-4" />}
                </Button>
              </form>
              <p className="mt-6 text-center text-xs leading-6 text-[#6e756b]">
                {register ? "Already part of the party?" : "New to the guild?"}{" "}
                <Link
                  to={register ? "/login" : "/register"}
                  state={{ from: redirect }}
                  className="font-semibold text-[#204f49] underline decoration-[#c8d4c7] underline-offset-4"
                >
                  {register ? "Sign in" : "Create an account"}
                </Link>
              </p>
              {!register && (
                <div className="mt-8 rounded-lg border border-dashed border-[#d6ddce] bg-[#f8f9f3] p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-[#204f49]">
                    <Icon name="sparkles" className="size-4" /> Just exploring?
                    Meet the test adventurers.
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-[#788071]">
                    Development demo accounts. Choose one to fill the form, then
                    sign in.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => fillDemo("aria")}
                      disabled={submitting}
                      className="rounded-md border border-[#d9dfd1] bg-white px-4 py-2 text-xs font-medium text-[#204f49] hover:bg-[#eaf0e7]"
                    >
                      Try Aria’s account
                    </button>
                    <button
                      type="button"
                      onClick={() => fillDemo("finn")}
                      disabled={submitting}
                      className="rounded-md border border-[#d9dfd1] bg-white px-4 py-2 text-xs font-medium text-[#204f49]"
                    >
                      Try Finn’s account
                    </button>
                  </div>
                  <p className="mt-3 break-all text-[10px] leading-5 text-[#788071]">
                    aria@diceandlore.test · finn@diceandlore.test
                    <br />
                    Password: RollForAdventure!24
                  </p>
                </div>
              )}
            </>
          )}
          <p className="mt-7 flex items-center justify-center gap-2 text-[10px] text-[#8a9282]">
            <Icon name="shield" className="size-3.5" /> Secure session. A little
            less worry, a little more wonder.
          </p>
        </div>
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[#e8eddf] px-10 py-12 lg:flex">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#c5d1bc] px-3 py-1.5 text-[10px] font-semibold tracking-[0.13em] text-[#4e6c4b]">
              <Icon name="sparkles" className="size-3.5" /> A LITTLE EVERYDAY
              MAGIC
            </span>
            <h2 className="mt-6 max-w-sm font-serif text-[42px] leading-[1.15] text-[#204f49]">
              Every great story
              <br />
              starts with a good party.
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-7 text-[#6a7960]">
              Well-chosen supplies. Unforgettable quests. A place for every kind
              of adventurer.
            </p>
          </div>
          <img
            src="/images/hero-supplies.svg"
            alt="A spellbook, magical potions, and dice ready for an adventure"
            className="-mx-10 -mb-4 mt-4 w-[calc(100%+5rem)] max-w-none object-contain"
          />
          <p className="mt-5 text-center text-[10px] tracking-[0.18em] text-[#68815d]">
            DICE & LORE · FOR THE STORIES AHEAD
          </p>
        </div>
      </div>
    </section>
  );
}
