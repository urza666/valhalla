import { useState } from 'react';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

interface PollOption {
  id: string; text: string; votes: number; voted: boolean;
}

interface Poll {
  id: string; question: string; options: PollOption[];
  allow_multiselect: boolean; total_votes: number;
  expires_at?: string;
}

interface Props {
  poll: Poll;
  onUpdate?: (poll: Poll) => void;
}

export function PollCard({ poll: initialPoll, onUpdate }: Props) {
  const [poll, setPoll] = useState(initialPoll);
  const [voting, setVoting] = useState(false);

  const vote = async (optionId: string) => {
    setVoting(true);
    try {
      const res = await fetch(`/api/v1/polls/${poll.id}/options/${optionId}/vote`, {
        method: 'PUT', headers: headers(),
      });
      const updated = await res.json();
      setPoll(updated);
      if (onUpdate) onUpdate(updated);
    } catch { /* ignore */ }
    setVoting(false);
  };

  const unvote = async (optionId: string) => {
    setVoting(true);
    try {
      const res = await fetch(`/api/v1/polls/${poll.id}/options/${optionId}/vote`, {
        method: 'DELETE', headers: headers(),
      });
      const updated = await res.json();
      setPoll(updated);
      if (onUpdate) onUpdate(updated);
    } catch { /* ignore */ }
    setVoting(false);
  };

  const isExpired = poll.expires_at && new Date(poll.expires_at) < new Date();

  return (
    <div className="poll-card">
      <div className="poll-question">📊 {poll.question}</div>

      <div className="poll-options">
        {(poll.options || []).map((opt) => {
          const pct = poll.total_votes > 0 ? Math.round((opt.votes / poll.total_votes) * 100) : 0;
          return (
            <button
              key={opt.id}
              className={`poll-option ${opt.voted ? 'voted' : ''}`}
              onClick={() => opt.voted ? unvote(opt.id) : vote(opt.id)}
              disabled={voting || !!isExpired}
            >
              <div className="poll-option-bar" style={{ width: `${pct}%` }} />
              <span className="poll-option-text">{opt.text}</span>
              <span className="poll-option-count">{opt.votes} ({pct}%)</span>
            </button>
          );
        })}
      </div>

      <div className="poll-footer">
        {poll.total_votes} Stimme{poll.total_votes !== 1 ? 'n' : ''}
        {poll.allow_multiselect && ' · Mehrfachauswahl'}
        {poll.expires_at && (
          isExpired
            ? ' · Abgelaufen'
            : ` · Endet ${new Date(poll.expires_at).toLocaleDateString()}`
        )}
      </div>
    </div>
  );
}

// Create poll dialog
export function CreatePollDialog({ onClose }: { onClose: () => void; onCreated?: (poll: any) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiselect, setMultiselect] = useState(false);
  const [hours, setHours] = useState(24);

  const addOption = () => { if (options.length < 10) setOptions([...options, '']); };

  const create = async () => {
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim() || validOptions.length < 2) return;

    // TODO: Create poll via message + poll endpoint
    // For now this is a placeholder
    alert('Poll erstellt (Backend-Integration in Arbeit)');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-form" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
        <h1 style={{ fontSize: 20 }}>Umfrage erstellen</h1>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Frage</label>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Was moechtest du wissen?" />
        </div>

        {options.map((opt, i) => (
          <div className="form-group" key={i}>
            <label>Option {i + 1}</label>
            <input value={opt} onChange={(e) => {
              const newOpts = [...options];
              newOpts[i] = e.target.value;
              setOptions(newOpts);
            }} placeholder={`Option ${i + 1}`} />
          </div>
        ))}

        {options.length < 10 && (
          <button className="btn-small" onClick={addOption} style={{ marginBottom: 12 }}>+ Option hinzufuegen</button>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={multiselect} onChange={(e) => setMultiselect(e.target.checked)} />
          Mehrfachauswahl erlauben
        </label>

        <div className="form-group">
          <label>Dauer (Stunden, 0 = kein Ablauf)</label>
          <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} min={0} max={720} />
        </div>

        <button className="btn" onClick={create}>Umfrage erstellen</button>
      </div>
    </div>
  );
}
