import type { FeaturedListingsBlockContent } from "../../types";

export function FeaturedListings({ content }: { content: FeaturedListingsBlockContent }) {
  return (
    <section className="block-featured">
      <h2>{content.headline}</h2>
      <div className="listings-grid">
        {content.items.map((item, i) => (
          <article className="listing-card" key={i}>
            {item.imageUrl && <img src={item.imageUrl} alt={item.address} />}
            <div className="body">
              <p className="price">{item.price}</p>
              <p className="address">{item.address}</p>
              <p className="stats">
                {item.beds} bed · {item.baths} bath · {item.sqft.toLocaleString()} sqft
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
