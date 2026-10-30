import { Icon } from "../ui.jsx";
const features = [
  {
    icon: "dice",
    title: "Made for your next campaign",
    text: "First roll or final boss. Come prepared.",
  },
  {
    icon: "book",
    title: "Every item has a story",
    text: "A curated collection of arcane essentials.",
  },
  {
    icon: "bag",
    title: "Your loot stays with you",
    text: "Build your bag. Pick up where you left off.",
  },
];
function FeatureItem({ icon, title, text }) {
  return (
    <div className="flex items-center gap-3 py-2 sm:justify-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-gold/80">
        <Icon name={icon} size={20} />
      </div>
      <div>
        <p className="text-xs font-medium text-ink">{title}</p>
        <p className="mt-1.5 text-[11px] text-muted">{text}</p>
      </div>
    </div>
  );
}
export default function ShopBenefits() {
  return (
    <div className="border-b border-line bg-surface">
      <div className="shell grid gap-2 py-5 sm:grid-cols-3 sm:gap-6">
        {features.map((feature) => (
          <FeatureItem key={feature.title} {...feature} />
        ))}
      </div>
    </div>
  );
}
