import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui.jsx";

const challenges = [
  {
    id: "xss",
    title: "Search preview XSS",
    category: "A05:2025 — Injection",
    goal: "Show that untrusted search input can run JavaScript inside the isolated search preview.",
    entry: "Product search",
    to: "/products",
    success: "Demonstrate JavaScript execution in the preview to your instructor. Manual verification; this page does not mark completion automatically.",
  },
  {
    id: "weak-password",
    title: "Weak password protection",
    category: "A04:2025 — Cryptographic Failures",
    goal: "Investigate the weak password protection of the prepared admin test account and demonstrate its impact.",
    entry: "Shop login",
    to: "/login",
    success: "Sign in as admin while the weak-password challenge is enabled. Show the successful login to your instructor.",
  },
  {
    id: "log-flood",
    title: "Excessive logging",
    category: "A09:2025 — Security Logging and Alerting Failures",
    goal: "Show how normal catalogue requests can create excessive audit logs while the logging challenge is enabled.",
    entry: "GET /api/products",
    success: "The audit log reaches at least 10 MiB (10,485,760 bytes). Verify its size using GET /api/audit-log/status.",
  },
];

export default function ChallengesPage() {
  return (
    <main className="shell py-12 sm:py-20">
      <PageHeader eyebrow="SECURITY QUESTS" title="Challenges">
        Three short tasks for the shop's learning environment.
      </PageHeader>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {challenges.map(({ id, title, category, goal, entry, to, success }) => (
          <article
            key={id}
            aria-labelledby={`challenge-${id}`}
            className="min-w-0 rounded-xl border border-line bg-surface p-6"
          >
            <h2 id={`challenge-${id}`} className="font-serif text-xl text-ink">
              {title}
            </h2>
            <p className="mt-2 text-xs leading-5 text-accent">{category}</p>
            <p className="mt-4 text-sm leading-6 text-muted">{goal}</p>
            <dl className="mt-5 space-y-4 border-t border-line pt-5 text-sm leading-6">
              <div>
                <dt className="font-medium text-ink">Entry point</dt>
                <dd className="mt-1 break-words text-muted">
                  {to ? (
                    <Link to={to} className="underline underline-offset-4 hover:text-accent">
                      {entry}
                    </Link>
                  ) : entry}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Success criterion</dt>
                <dd className="mt-1 break-words text-muted">{success}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </main>
  );
}
