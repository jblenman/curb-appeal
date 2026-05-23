import type { TestimonialsBlockContent } from "../../types";

export function Testimonials({ content }: { content: TestimonialsBlockContent }) {
  return (
    <section className="block-testimonials">
      <div className="inner">
        <h2>{content.headline}</h2>
        <div className="testimonials-grid">
          {content.items.map((t, i) => (
            <div className="testimonial" key={i}>
              <blockquote>"{t.quote}"</blockquote>
              <cite>— {t.attribution}</cite>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
