import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { Button, Notice } from "../ui.jsx";

export default function SearchChallengeFrame({ search, onReset }) {
  const frame = useRef(null);
  const [config, setConfig] = useState(null);
  const current = config?.search === search ? config : null;
  const isActive = current?.isActive === true;
  const origin = current?.origin || "";
  const error = current?.error || "";
  useEffect(() => {
    const controller = new AbortController();
    api("/api/challenges/xss/config", { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.isActive !== true) {
          setConfig({ search, isActive: false });
          return;
        }
        const url = new URL(data.previewOrigin);
        if (!["http:", "https:"].includes(url.protocol) ||
            url.origin !== data.previewOrigin ||
            url.hostname === window.location.hostname) {
          throw new Error("The search preview needs a separate cookie host.");
        }
        setConfig({search, isActive: true, origin: url.origin});
      })
      .catch((err) => {
        if (!controller.signal.aborted) setConfig({ search, error: err.message });
      });
    return () => controller.abort();
  }, [search]);

  useEffect(() => {
    const onMessage = (event) => {
      if (isActive && event.source === frame.current?.contentWindow &&
          event.data?.type === "xss-preview-alert" && typeof event.data.message === "string") {
        window.alert(event.data.message);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isActive]);

  const tooLong = search.length > 4096;
  const url = isActive && origin ? new URL("/", origin) : null;
  if (url) url.searchParams.set("search", search);
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-center">
        {!current ? (
                <p role="status" className="py-12 text-sm text-muted">Loading search preview…</p>
        ) : !isActive && !error ? (
        <p className="py-12 text-sm text-muted">No products found for: {search}</p>
      ) : error || tooLong ? (
        <Notice variant="error">
          {tooLong ? "Search preview supports up to 4096 characters." : error}
        </Notice>
      ) : url ? (
        <iframe
          ref={frame}
          key={url.href}
          src={url.href}
          title="Dice & Lore search preview"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'"
          className="h-80 w-full rounded-lg border-0"
        />
      ) : (
        <p role="status" className="py-12 text-sm text-muted">Loading search preview…</p>
      )}
      <div className="mt-4">
        <Button variant="secondary" onClick={onReset}>Clear search</Button>
      </div>
    </div>
  );
}
