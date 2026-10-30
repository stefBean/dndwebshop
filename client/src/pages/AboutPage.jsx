import { Icon, LinkButton, PageHeader } from "../components/ui.jsx";
const values = [
  {
    icon: "dice",
    title: "Made for the table",
    description:
      "Dice worth rolling. Relics worth discovering. A collection inspired by the stories we tell together.",
  },
  {
    icon: "book",
    title: "A little more lore",
    description:
      "From a first encounter to a final quest, every adventurer deserves a few extraordinary essentials.",
  },
  {
    icon: "shield",
    title: "An imagined world",
    description:
      "This is a fictional shop. Explore, fill your bag, and place a simulated order. Nothing is charged or shipped.",
  },
];
function StoryValue({ icon, title, description }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-6 sm:p-7">
      <Icon name={icon} size={25} className="text-gold" />
      <h2 className="mt-5 font-serif text-2xl text-ink">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
    </section>
  );
}
export default function AboutPage() {
  return (
    <main className="shell py-12 sm:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <PageHeader
            eyebrow="A TABLE. A PARTY. AN OPEN WORLD."
            title={
              <>
                Every great story
                <br />
                starts with a little lore.
              </>
            }
          >
            Dice & Lore is an emporium for adventurers, world builders, and the
            ones who never leave a dungeon unexplored.
          </PageHeader>
          <p className="mt-5 max-w-lg text-sm leading-8 text-muted">
            We believe the best adventures begin around a table, with a few
            friends, a character sheet, and a roll of the dice. Discover six
            carefully imagined treasures, from shimmering dice sets to bottled
            starlight, and find something for your next chapter.
          </p>
          <LinkButton to="/products" className="mt-8">
            Explore the collection <Icon name="arrowRight" size={17} />
          </LinkButton>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <img
            src="/images/hero-supplies.svg"
            alt="Fantasy potions, an ancient spellbook, and adventure dice"
            className="w-full"
          />
        </div>
      </div>
      <div className="mt-16 grid gap-5 border-t border-line pt-10 md:grid-cols-3">
        {values.map((value) => (
          <StoryValue key={value.title} {...value} />
        ))}
      </div>
    </main>
  );
}
