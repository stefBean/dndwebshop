import { useEffect, useRef } from "react";
import { api } from "../../lib/api.js";
import { useShop } from "../../state/shop-context.js";
import { Button, Notice } from "../ui.jsx";

export default function SearchChallengeFrame({ search, onReset }) {
  const frameRef = useRef(null);
  const completedRef = useRef(false);
  const challengeActiveRef = useRef(false);
  const challengeStatusLoadedRef = useRef(false);
  const pendingAlertRef = useRef(false);
  const { completeChallenge } = useShop();
  const tooLong = search.length > 4096;
  const url = new URL('/xss-preview/', window.location.origin);
  url.searchParams.set("search", search);
  useEffect(() => {
    let mounted = true;
    api("/api/challenges/xss/config")
      .then((config) => {
        if (!mounted) return;
        challengeActiveRef.current = config.isActive === true;
        challengeStatusLoadedRef.current = true;
        if (challengeActiveRef.current && pendingAlertRef.current && !completedRef.current) {
          completedRef.current = true;
          completeChallenge("xss");
        }
      })
      .catch(() => { challengeStatusLoadedRef.current = true; });

    const onMessage = (event) => {
      if (
        event.source !== frameRef.current?.contentWindow ||
        event.data?.type !== "dice-lore-xss-alert"
      ) return;
      if (!challengeStatusLoadedRef.current) {
        pendingAlertRef.current = true;
        return;
      }
      if (!challengeActiveRef.current || completedRef.current) return;
      completedRef.current = true;
      completeChallenge("xss");
    };
    window.addEventListener("message", onMessage);
    return () => {
      mounted = false;
      window.removeEventListener("message", onMessage);
    };
  }, [completeChallenge]);
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-center">
      {tooLong ? (
        <Notice variant="error">Search preview supports up to 4096 characters.</Notice>
      ) : (
        <iframe
          ref={frameRef}
          key={url.href}
          src={url.href}
          title="Dice & Lore search preview"
          sandbox="allow-scripts allow-modals"
          referrerPolicy="no-referrer"
          allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'"
          className="h-80 w-full rounded-lg border-0"
        />
      )}
      <div className="mt-4">
        <Button variant="secondary" onClick={onReset}>Clear search</Button>
      </div>
    </div>
  );
}
