import { useState } from 'react';
import { Markdown } from './Markdown';

interface SearchResult {
  id: number;
  channel_id: number;
  guild_id: number;
  author_id: number;
  content: string;
  timestamp: number;
}

interface Props {
  guildId: string;
  onClose: () => void;
  onJumpToMessage?: (channelId: string, messageId: string) => void;
}

export function SearchPanel({ guildId, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({ content: query, limit: '25' });
      const res = await fetch(`/api/v1/guilds/${guildId}/messages/search?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      setResults(data.hits || []);
      setTotalHits(data.estimatedTotalHits || 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <input
          className="search-input"
          placeholder="Nachrichten durchsuchen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button className="search-close" onClick={onClose}>x</button>
      </div>

      <div className="search-results">
        {loading && (
          <div className="search-status">Suche läuft...</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="search-status">Keine Ergebnisse gefunden</div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="search-status">{totalHits} Ergebnis{totalHits !== 1 ? 'se' : ''}</div>
            {results.map((r) => (
              <div key={r.id} className="search-result-item">
                <div className="search-result-meta">
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(r.timestamp * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="search-result-content">
                  <Markdown content={r.content} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
