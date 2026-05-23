import type { ContactBlockContent } from "../../types";

export function Contact({ content }: { content: ContactBlockContent }) {
  return (
    <section className="block-contact">
      <h2>{content.headline}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          alert("Contact form is a demo — no backend wired.");
        }}
      >
        {content.fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name}>{field.label}</label>
            {field.type === "textarea" ? (
              <textarea id={field.name} name={field.name} rows={4} required={field.required} />
            ) : (
              <input
                id={field.name}
                name={field.name}
                type={field.type || "text"}
                required={field.required}
              />
            )}
          </div>
        ))}
        <button type="submit">{content.ctaText}</button>
      </form>
    </section>
  );
}
