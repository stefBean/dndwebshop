import { Icon, LinkButton } from "../ui.jsx";
export default function Hero() {
  return (
    <section className="hero-stage relative overflow-hidden border-b border-line">
      <div className="shell relative grid items-center gap-3 py-9 md:min-h-[470px] md:grid-cols-2 md:py-10">
        <div className="relative z-10 py-5">
          <p className="eyebrow flex items-center gap-2 text-gold">
            <span className="h-px w-7 bg-gold/60" />
            FOR THE ONES WHO ANSWER THE CALL
          </p>
          <h1 className="mt-6 font-serif text-[49px] leading-[1.06] tracking-[-1.5px] text-ink sm:text-6xl lg:text-[76px]">
            Your next quest.
            <br />
            <span className="text-gold italic">Better equipped.</span>
          </h1>
          <p className="mt-6 max-w-[390px] text-sm leading-7 text-muted">
            From your first roll to your final boss. Discover enchanted
            essentials for your Dungeons & Dragons adventures.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="#collection">
              Enter the collection <Icon name="arrowRight" size={17} />
            </LinkButton>
            <LinkButton to="/about" variant="ghost" className="px-3">
              Behind the lore <Icon name="chevronRight" size={15} />
            </LinkButton>
          </div>
          <p className="mt-7 flex items-center gap-2 text-[10px] tracking-widest text-muted/75">
            <Icon name="dice" size={15} className="text-gold/60" /> FOR
            ADVENTURERS. BY ADVENTURERS.
          </p>
        </div>
        <div className="relative -mx-3 flex items-center justify-center md:-mr-8">
          <img
            src="/images/hero-supplies.svg"
            alt="Arcane potions, an enchanted spellbook, and dice surrounded by magical rune circles"
            className="relative z-10 w-full max-w-[600px] object-contain md:scale-110"
            fetchPriority="high"
          />
          <div className="absolute bottom-2 right-4 z-20 rounded-lg border border-gold/20 bg-void/80 px-4 py-3 backdrop-blur-sm md:bottom-8">
            <p className="eyebrow text-[8px] text-muted">
              YOUR CAMPAIGN. YOUR STORY.
            </p>
            <p className="mt-1.5 flex items-center gap-2 font-serif text-base text-gold">
              <Icon name="sparkles" size={14} /> Make it legendary.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
