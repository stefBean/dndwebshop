import { Button, Notice } from "../ui.jsx";

export default function SearchChallengeFrame({ search, onReset }) {
  const tooLong = search.length > 4096;
  const url = new URL('/xss-preview/', window.location.origin);
  url.searchParams.set("search", search);
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-center">
      {tooLong ? (
        <Notice variant="error">Search preview supports up to 4096 characters.</Notice>
      ) : (
        <iframe
          key={url.href}
          src={url.href}
          title="Dice & Lore search preview"
          sandbox="allow-scripts"
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
