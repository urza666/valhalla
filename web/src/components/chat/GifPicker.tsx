import { useState, useEffect } from 'react';

// Using Tenor API v2 (free tier, no key needed for basic search)
const TENOR_API = 'https://tenor.googleapis.com/v2';
const TENOR_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Public web key

interface GifResult {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

interface Props {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<GifResult[]>([]);
  const [consent, setConsent] = useState(() => localStorage.getItem('gif_consent') === 'true');

  // Show consent banner if not yet accepted
  if (!consent) {
    return (
      <div className="gif-picker">
        <div style={{ padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Die GIF-Suche wird von <strong>Google Tenor</strong> bereitgestellt.
            Bei Nutzung werden Suchanfragen an Google-Server übermittelt.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Mehr Infos in unserer <a href="/datenschutz.html" target="_blank" style={{ color: 'var(--text-link)' }}>Datenschutzerklärung</a>.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn-primary" style={{ width: 'auto', fontSize: 13 }} onClick={() => {
              localStorage.setItem('gif_consent', 'true');
              setConsent(true);
            }}>
              Akzeptieren
            </button>
            <button className="btn-small" onClick={onClose}>Abbrechen</button>
          </div>
        </div>
      </div>
    );
  }

  // Load trending on mount
  useEffect(() => {
    fetchTrending();
  }, []);

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => searchGifs(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchTrending = async () => {
    try {
      const res = await fetch(`${TENOR_API}/featured?key=${TENOR_KEY}&limit=20&media_filter=gif,tinygif`);
      const data = await res.json();
      setTrending(parseResults(data.results || []));
    } catch {
      // Fallback: show nothing
    }
  };

  const searchGifs = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${TENOR_API}/search?key=${TENOR_KEY}&q=${encodeURIComponent(q)}&limit=20&media_filter=gif,tinygif`);
      const data = await res.json();
      setResults(parseResults(data.results || []));
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const parseResults = (items: any[]): GifResult[] => {
    return items.map((item) => {
      const gif = item.media_formats?.gif || item.media_formats?.tinygif;
      const preview = item.media_formats?.tinygif || item.media_formats?.gif;
      return {
        id: item.id,
        url: gif?.url || '',
        preview: preview?.url || '',
        width: preview?.dims?.[0] || 200,
        height: preview?.dims?.[1] || 150,
      };
    }).filter((g) => g.url);
  };

  const displayResults = query.trim() ? results : trending;

  return (
    <div className="gif-picker" onClick={(e) => e.stopPropagation()}>
      <div className="gif-search">
        <input
          placeholder="GIFs suchen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="gif-grid">
        {loading && <div className="gif-loading">Suche...</div>}
        {displayResults.map((gif) => (
          <img
            key={gif.id}
            src={gif.preview}
            alt="GIF"
            className="gif-item"
            loading="lazy"
            onClick={() => {
              onSelect(gif.url);
              onClose();
            }}
          />
        ))}
        {!loading && displayResults.length === 0 && query && (
          <div className="gif-loading">Keine Ergebnisse</div>
        )}
      </div>

      <div className="gif-footer">
        Powered by Tenor
      </div>
    </div>
  );
}
