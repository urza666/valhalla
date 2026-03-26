import { useState } from 'react';
import { Markdown } from './Markdown';
import { toast } from '../../stores/toast';

interface SearchResult {
  id: string | number;
  channel_id: string | number;
  guild_id?: string | number;
  author_id?: string | number;
  author?: { username: string; display_name?: string | null };
  content: string;
  timestamp: string | number;
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

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Handle different response formats from MeiliSearch / fallback
      let hits: SearchResult[] = [];
      if (Array.isArray(data)) {
        hits = data;
      } else if (data.hits && Array.isArray(data.hits)) {
        hits = data.hits;
      } else if (data.messages && Array.isArray(data.messages)) {
        hits = data.messages;
      }

      setResults(hits);
      setTotalHits(data.estimatedTotalHits || data.total || hits.length);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
      toast.error('Suche fehlgeschlagen — MeiliSearch evtl. nicht erreichbar');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') onClose();
  };

  const formatTimestamp = (ts: string | number) => {
    try {
      if (typeof ts === 'number') {
        // Could be seconds or milliseconds
        const d = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
        return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      }
      return new Date(ts).toLocaleDateString('de-DE') + ' ' + new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
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
          <div className="search-status">
            <div className="loading-spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }} />
            Suche läuft...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="search-status">Keine Ergebnisse gefunden</div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="search-status">{totalHits} Ergebnis{totalHits !== 1 ? 'se' : ''}</div>
            {results.map((r) => (
              <div key={String(r.id)} className="search-result-item">
                <div className="search-result-meta">
                  {r.author?.username && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginRight: 8 }}>
                      {r.author.display_name || r.author.username}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatTimestamp(r.timestamp)}
                  </span>
                </div>
                <div className="search-result-content">
                  <Markdown content={r.content} />
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && !searched && (
          <div className="search-status" style={{ opacity: 0.6 }}>
            Tippe einen Suchbegriff ein und drücke Enter
          </div>
        )}
      </div>
    </div>
  );
}
