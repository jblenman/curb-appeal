import type { SiteConfig } from "../types";
import { Hero } from "./blocks/Hero";
import { FeaturedListings } from "./blocks/FeaturedListings";
import { AgentBio } from "./blocks/AgentBio";
import { Testimonials } from "./blocks/Testimonials";
import { Contact } from "./blocks/Contact";

export function SiteRenderer({ config }: { config: SiteConfig }) {
  return (
    <div className={`site theme-${config.themeSlug}`}>
      {config.blocks.map((block) => {
        switch (block.type) {
          case "hero":
            return <Hero key={block.id} content={block.content} />;
          case "featured-listings":
            return <FeaturedListings key={block.id} content={block.content} />;
          case "agent-bio":
            return <AgentBio key={block.id} content={block.content} />;
          case "testimonials":
            return <Testimonials key={block.id} content={block.content} />;
          case "contact":
            return <Contact key={block.id} content={block.content} />;
        }
      })}
    </div>
  );
}
