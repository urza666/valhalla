interface Embed {
  type: string;
  url: string;
  title?: string;
  description?: string;
  thumbnail?: { url: string };
  image?: { url: string };
  site_name?: string;
}

interface Props {
  embed: Embed;
}

export function EmbedCard({ embed }: Props) {
  if (embed.type === 'image' && embed.image) {
    return (
      <div className="embed-image">
        <a href={embed.url} target="_blank" rel="noopener noreferrer">
          <img src={embed.image.url} alt="" loading="lazy" style={{ maxWidth: 400, maxHeight: 300, borderRadius: 4 }} />
        </a>
      </div>
    );
  }

  if (!embed.title && !embed.description) return null;

  return (
    <div className="embed-card">
      <div className="embed-accent" />
      <div className="embed-content">
        {embed.site_name && (
          <div className="embed-provider">{embed.site_name}</div>
        )}
        {embed.title && (
          <a href={embed.url} target="_blank" rel="noopener noreferrer" className="embed-title">
            {embed.title}
          </a>
        )}
        {embed.description && (
          <div className="embed-description">{embed.description}</div>
        )}
        {embed.thumbnail && (
          <img
            src={embed.thumbnail.url}
            alt=""
            className="embed-thumbnail"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}
