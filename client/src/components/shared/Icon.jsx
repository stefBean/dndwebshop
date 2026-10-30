const paths = {
  menu: "M4 6h16M4 12h16M4 18h16",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  swords:
    "m4 3 15 15m-4 0 3-3m-1 4 3 3M20 3 5 18m0-3 3 3m-1-1-3 5M4 3l1 5 3-3-4-2Zm16 0-1 5-3-3 4-2Z",
  arrowRight: "M4 12h16m-6-6 6 6-6 6",
  arrowLeft: "M20 12H4m6-6-6 6 6 6",
  bag: "M5 7h14l1 14H4L5 7Zm3 0V6a4 4 0 0 1 8 0v1",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  check: "m5 12 4 4L19 6",
  chevronRight: "m9 5 7 7-7 7",
  shield: "m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6",
  sparkles:
    "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM21 2v4m-2-2h4",
  package: "m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7.5 4.5l9 5v4",
  dice: "m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 3 9-3M12 2v8m0 0-7 8m7-8 7 8M5 18h14m-7-8v12",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  logout: "M9 3H4v18h5m6-14 5 5-5 5M8 12h12",
  mail: "M3 5h18v14H3V5Zm0 0 9 8 9-8",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  filter: "M4 6h16M7 12h10m-7 6h4",
  book: "M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2V4Zm9 2v15",
  potion: "M9 3h6m-5 0v6l-5 8c-1 2 0 4 2 4h10c2 0 3-2 2-4l-5-8V3M7 14h10",
};
export function Icon({ name, size = 20, className = "", ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.sparkles} />
    </svg>
  );
}
