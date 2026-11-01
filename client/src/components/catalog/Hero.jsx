import { Icon, LinkButton } from "../ui.jsx";
import AnimatedPotion from "./AnimatedPotion.jsx";

export default function Hero() {
  return (
    <section className="hero-stage border-b border-line">
      <div className="shell grid items-center gap-3 py-8 md:min-h-[500px] md:grid-cols-2 md:py-10">
        <div className="relative z-10 py-6">
          <p className="eyebrow flex items-center gap-2.5 text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            DUNGEONS & DRAGONS SHOP
          </p>
          <h1 className="mt-6 text-[54px] font-medium leading-[1.04] tracking-[-2.5px] text-white sm:text-7xl lg:text-[82px]">
            Your next
            <br />
            adventure.
          </h1>
          <p className="mt-6 max-w-[360px] text-sm leading-7 text-muted">
            Potions, spellbooks, dice, and gear for the stories you play. Find
            your next item, and make it part of your campaign.
          </p>
          <LinkButton href="#collection" className="mt-8">
            Explore the shop <Icon name="arrowRight" size={17} />
          </LinkButton>
          <p className="mt-5 text-xs text-muted">
            A little magic goes a long way.
          </p>
        </div>
        <AnimatedPotion />
      </div>
    </section>
  );
}
