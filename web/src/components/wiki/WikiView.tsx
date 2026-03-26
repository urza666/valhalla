import { useEffect, useState } from 'react';
import { Markdown } from '../chat/Markdown';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

interface WikiPage {
  id: string; title: string; content: string;
  created_by: string; last_edited_by?: string;
  created_at: string; updated_at: string;
}

interface Props {
  guildId: string;
}

export function WikiView({ guildId }: Props) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/guilds/${guildId}/wiki`, { headers: headers() })
      .then((r) => r.json())
      .then((p) => { setPages(p || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [guildId]);

  const loadPage = async (pageId: string) => {
    const res = await fetch(`/api/v1/wiki/${pageId}`, { headers: headers() });
    const page = await res.json();
    setActivePage(page);
    setEditing(false);
  };

  const createPage = async () => {
    const res = await fetch(`/api/v1/guilds/${guildId}/wiki`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ title: 'Neue Seite', content: '# Neue Seite\n\nInhalt hier...' }),
    });
    const page = await res.json();
    setPages([...pages, page]);
    setActivePage(page);
    startEdit(page);
  };

  const startEdit = (page: WikiPage) => {
    setEditTitle(page.title);
    setEditContent(page.content);
    setEditing(true);
  };

  const savePage = async () => {
    if (!activePage) return;
    await fetch(`/api/v1/wiki/${activePage.id}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ title: editTitle, content: editContent }),
    });
    const updated = { ...activePage, title: editTitle, content: editContent };
    setActivePage(updated);
    setPages(pages.map((p) => p.id === updated.id ? { ...p, title: updated.title } : p));
    setEditing(false);
  };

  const deletePage = async (pageId: string) => {
    if (!confirm('Seite wirklich loschen?')) return;
    await fetch(`/api/v1/wiki/${pageId}`, { method: 'DELETE', headers: headers() });
    setPages(pages.filter((p) => p.id !== pageId));
    if (activePage?.id === pageId) setActivePage(null);
  };

  return (
    <div className="wiki-container">
      {/* Sidebar */}
      <div className="wiki-sidebar">
        <div className="wiki-sidebar-header">
          <span>📖 Wiki</span>
          <button className="btn-small" onClick={createPage}>+ Neu</button>
        </div>
        <div className="wiki-page-list">
          {pages.map((p) => (
            <div
              key={p.id}
              className={`wiki-page-item ${activePage?.id === p.id ? 'active' : ''}`}
              onClick={() => loadPage(p.id)}
            >
              {p.title}
            </div>
          ))}
          {!loaded && <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>Lade...</div>}
          {loaded && pages.length === 0 && (
            <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Seiten.</div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="wiki-content">
        {!activePage ? (
          <div className="empty-state">
            <h2>Wiki</h2>
            <p>Waehle eine Seite oder erstelle eine neue.</p>
          </div>
        ) : editing ? (
          <div className="wiki-editor">
            <input
              className="wiki-title-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Seitentitel"
            />
            <textarea
              className="wiki-content-input"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Inhalt (Markdown)"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" style={{ width: 'auto' }} onClick={savePage}>Speichern</button>
              <button className="btn-small" onClick={() => setEditing(false)}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <div className="wiki-reader">
            <div className="wiki-reader-header">
              <h1>{activePage.title}</h1>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-small" onClick={() => startEdit(activePage)}>Bearbeiten</button>
                <button className="btn-small danger" onClick={() => deletePage(activePage.id)}>Loschen</button>
              </div>
            </div>
            <div className="wiki-reader-meta">
              Zuletzt bearbeitet: {new Date(activePage.updated_at).toLocaleDateString()}
            </div>
            <div className="wiki-reader-body">
              <Markdown content={activePage.content} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
