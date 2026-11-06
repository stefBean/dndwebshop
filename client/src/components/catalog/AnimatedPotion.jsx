import { useId, useState, useSyncExternalStore } from "react";
import "./AnimatedPotion.css";

function subscribeToMotion(callback) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", callback);
  return () => preference.removeEventListener("change", callback);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const bottle =
  "M252 112H348V198C348 220 398 238 420 288C456 370 438 468 396 497C364 520 236 520 204 497C162 468 144 370 180 288C202 238 252 220 252 198Z";
const wave =
  "M-300 338C-250 320-200 320-150 338S-50 356 0 338S100 320 150 338S250 356 300 338S400 320 450 338S550 356 600 338S700 320 750 338S850 356 900 338V600H-300Z";

export default function AnimatedPotion({ className = "" }) {
  const id = useId().replaceAll(":", "");
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    prefersReducedMotion,
    () => false,
  );
  const playing = !reducedMotion;
  const ref = (name) => `url(#${id}-${name})`;

  return (
    <figure
      className={`animated-potion ${className}`}
      data-motion={playing ? "playing" : ""}
      data-testid="animated-potion"
    >
      <svg
        viewBox="0 0 600 600"
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
        className="potion__art"
      >
        <title id={`${id}-title`}>Purple potion</title>
        <desc id={`${id}-description`}>
          An illuminated glass bottle with gently moving violet liquid and
          rising bubbles.
        </desc>
        <defs>
          <radialGradient id={`${id}-aura`}>
            <stop stopColor="#8b5cf6" stopOpacity=".2" />
            <stop offset=".55" stopColor="#6d28d9" stopOpacity=".08" />
            <stop offset="1" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`${id}-glass`}
            x1="160"
            y1="300"
            x2="440"
            y2="300"
            gradientUnits="userSpaceOnUse"
          >

          </linearGradient>
          <linearGradient
            id={`${id}-edge`}
            x1="200"
            y1="130"
            x2="420"
            y2="500"
            gradientUnits="userSpaceOnUse"
          >

          </linearGradient>
          <linearGradient
            id={`${id}-liquid`}
            x1="250"
            y1="325"
            x2="370"
            y2="515"
            gradientUnits="userSpaceOnUse"
          >

          </linearGradient>
          <linearGradient
            id={`${id}-cap`}
            x1="253"
            y1="78"
            x2="347"
            y2="114"
            gradientUnits="userSpaceOnUse"
          >

          </linearGradient>
          <radialGradient id={`${id}-pool`}>

          </radialGradient>
          <clipPath id={`${id}-bottle`}>
            <path d={bottle} />
          </clipPath>
        </defs>

        <ellipse cx="300" cy="350" rx="245" ry="230" fill={ref("aura")} />
        <ellipse
          className="potion__shadow"
          cx="300"
          cy="542"
          rx="153"
          ry="22"
          fill={ref("pool")}
        />

        <g className="potion__float">
          <path d={bottle} fill={ref("glass")} />
          <g clipPath={ref("bottle")}>
            <path
              className="potion__wave potion__wave--back"
              d={wave}
              fill="#8d65d5"
              opacity=".65"
            />
            <path
              className="potion__wave potion__wave--front"
              d={wave}
              fill={ref("liquid")}
            />
            <path
              className="potion__surface"
              d="M168 339C226 321 266 356 321 339S400 322 432 341"
              fill="none"
              stroke="#e5d5ff"
              strokeOpacity=".55"
              strokeWidth="2"
            />
            <ellipse
              cx="300"
              cy="489"
              rx="108"
              ry="13"
              fill="#c4a5ff"
              opacity=".1"
            />
            <g fill="#ede5ff">
              <circle
                className="potion__bubble potion__bubble--one"
                cx="236"
                cy="467"
                r="4"
              />
              <circle
                className="potion__bubble potion__bubble--two"
                cx="348"
                cy="475"
                r="2.5"
              />
              <circle
                className="potion__bubble potion__bubble--three"
                cx="286"
                cy="480"
                r="3"
              />
              <circle
                className="potion__bubble potion__bubble--four"
                cx="379"
                cy="467"
                r="3.5"
              />
            </g>
          </g>
          <path d={bottle} fill="none" stroke={ref("edge")} strokeWidth="2" />

          <path
            d="M240 233C217 250 197 280 190 315C181 354 184 400 193 426"
            fill="none"
            stroke="#fff"
            strokeOpacity=".32"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M243 238C225 252 212 272 207 286"
            fill="none"
            stroke="#fff"
            strokeOpacity=".65"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M408 330C419 371 414 427 398 455"
            fill="none"
            stroke="#eee7ff"
            strokeOpacity=".22"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M219 487C254 502 349 506 384 488"
            fill="none"
            stroke="#e6d5ff"
            strokeOpacity=".35"
            strokeWidth="2"
            strokeLinecap="round"
          />

          <rect
            x="251"
            y="78"
            width="98"
            height="40"
            rx="7"
            fill={ref("cap")}
            stroke="#d9d7e0"
            strokeOpacity=".35"
          />
          <path
            d="M258 87H342M258 95H342M258 103H342"
            stroke="#d5d2dc"
            strokeOpacity=".16"
          />
          <rect
            x="246"
            y="111"
            width="108"
            height="14"
            rx="5"
            fill="#24232a"
            stroke="#d4d1dc"
            strokeOpacity=".45"
          />
          <path
            d="M261 139V187M339 139V185"
            stroke="#fff"
            strokeOpacity=".18"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M265 143V177"
            stroke="#fff"
            strokeOpacity=".34"
            strokeWidth="2"
            strokeLinecap="round"
          />

          <rect
            x="254"
            y="374"
            width="92"
            height="78"
            rx="20"
            fill="#130c22"
            fillOpacity=".3"
            stroke="#e9dfff"
            strokeOpacity=".3"
          />
          <path
            d="M300 385L321 413L300 441L279 413Z"
            fill="none"
            stroke="#ede7f7"
            strokeOpacity=".75"
          />
          <path
            d="M300 396V430M288 413H312"
            stroke="#ede7f7"
            strokeOpacity=".75"
            strokeLinecap="round"
          />
        </g>

        <g
          className="potion__sparkles"
          fill="none"
          stroke="#c4b5fd"
          strokeLinecap="round"
        >
          <path d="M159 203V217M152 210H166" opacity=".65" />
          <path d="M434 145V155M429 150H439" opacity=".45" />
          <path d="M455 405V417M449 411H461" opacity=".5" />
        </g>
        <circle cx="164" cy="421" r="1.5" fill="#c4b5fd" opacity=".6" />
        <circle cx="428" cy="253" r="1.5" fill="#fff" opacity=".45" />
      </svg>


    </figure>
  );
}
