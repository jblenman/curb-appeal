import type { AgentBioBlockContent } from "../../types";

export function AgentBio({ content }: { content: AgentBioBlockContent }) {
  return (
    <section className="block-bio">
      {content.headshotUrl && <img src={content.headshotUrl} alt="" />}
      <div>
        <h2>{content.headline}</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{content.bodyMarkdown}</p>
        {content.yearsExperience && (
          <p style={{ color: "var(--color-muted)", marginTop: "0.5rem" }}>
            {content.yearsExperience} years in real estate
          </p>
        )}
        {content.credentials && content.credentials.length > 0 && (
          <div className="credentials">
            {content.credentials.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
