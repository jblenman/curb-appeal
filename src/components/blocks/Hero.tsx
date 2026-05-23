import type { HeroBlockContent } from "../../types";

export function Hero({ content }: { content: HeroBlockContent }) {
  return (
    <section className="block-hero">
      {content.imageUrl && <img src={content.imageUrl} alt="" />}
      <div className="hero-content">
        <h1>{content.headline}</h1>
        <p>{content.subheadline}</p>
        {content.ctaText && <button className="cta">{content.ctaText}</button>}
      </div>
    </section>
  );
}
