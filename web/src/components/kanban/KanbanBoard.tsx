import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { toast } from '../../stores/toast';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

interface Subtask {
  text: string;
  done: boolean;
}

interface Task {
  id: string; bucket_id: string; title: string; description?: string;
  position: number; priority: number; completed: boolean;
  assigned_to?: string; labels: string[]; due_date?: string;
  subtasks?: Subtask[];
}

interface Bucket {
  id: string; name: string; position: number; color?: string; tasks: Task[];
}

interface Board {
  id: string; name: string; buckets: Bucket[];
}

interface Props {
  channelId: string;
  guildId: string;
}

const PRIORITY_OPTIONS = [
  { value: 0, label: 'Keine', color: '' },
  { value: 1, label: 'Niedrig', color: '#3b82f6', icon: '🔵' },
  { value: 2, label: 'Mittel', color: '#eab308', icon: '🟡' },
  { value: 3, label: 'Hoch', color: '#f97316', icon: '🟠' },
  { value: 4, label: 'Dringend', color: '#ef4444', icon: '🔴' },
];

export function KanbanBoard({ channelId, guildId }: Props) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({});
  const [dragTask, setDragTask] = useState<{ taskId: string; fromBucket: string } | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [newBucketName, setNewBucketName] = useState('');

  useEffect(() => {
    fetch(`/api/v1/channels/${channelId}/boards`, { headers: headers() })
      .then((r) => r.json())
      .then((b) => { setBoards(b || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [channelId]);

  // Load guild members for assignee picker
  useEffect(() => {
    api.getGuildMembers(guildId).then((m) => {
      setMembers((m || []).map((mem) => ({
        id: mem.user_id,
        name: mem.nick || mem.user?.display_name || mem.user?.username || mem.user_id.slice(-4),
      })));
    }).catch(() => {});
  }, [guildId]);

  const createBoard = async () => {
    try {
      const res = await fetch(`/api/v1/channels/${channelId}/boards`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ name: 'Neues Board', guild_id: guildId }),
      });
      const board = await res.json();
      setBoards([...boards, board]);
      loadBoard(board.id);
    } catch { toast.error('Board konnte nicht erstellt werden'); }
  };

  const loadBoard = async (boardId: string) => {
    try {
      const res = await fetch(`/api/v1/boards/${boardId}`, { headers: headers() });
      const board = await res.json();
      setActiveBoard(board);
    } catch { toast.error('Board konnte nicht geladen werden'); }
  };

  const addBucket = async () => {
    if (!activeBoard || !newBucketName.trim()) return;
    try {
      await fetch(`/api/v1/boards/${activeBoard.id}/buckets`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ name: newBucketName.trim() }),
      });
      setNewBucketName('');
      loadBoard(activeBoard.id);
    } catch { toast.error('Spalte konnte nicht erstellt werden'); }
  };

  const addTask = async (bucketId: string) => {
    const title = newTaskTitle[bucketId]?.trim();
    if (!title || !activeBoard) return;
    try {
      const res = await fetch(`/api/v1/boards/${activeBoard.id}/tasks`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ bucket_id: bucketId, title }),
      });
      const task = await res.json();
      setActiveBoard({
        ...activeBoard,
        buckets: activeBoard.buckets.map((b) =>
          b.id === bucketId ? { ...b, tasks: [...(b.tasks || []), task] } : b
        ),
      });
      setNewTaskTitle({ ...newTaskTitle, [bucketId]: '' });
    } catch { toast.error('Aufgabe konnte nicht erstellt werden'); }
  };

  const moveTask = async (taskId: string, toBucketId: string) => {
    try {
      await fetch(`/api/v1/tasks/${taskId}/move`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ bucket_id: toBucketId, position: 0 }),
      });
      if (activeBoard) loadBoard(activeBoard.id);
    } catch { toast.error('Verschieben fehlgeschlagen'); }
  };

  const updateTask = async (taskId: string, data: Partial<Task>) => {
    try {
      await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify(data),
      });
      if (activeBoard) loadBoard(activeBoard.id);
      toast.success('Aufgabe aktualisiert');
    } catch { toast.error('Aktualisierung fehlgeschlagen'); }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Aufgabe wirklich löschen?')) return;
    try {
      await fetch(`/api/v1/tasks/${taskId}`, { method: 'DELETE', headers: headers() });
      if (activeBoard) loadBoard(activeBoard.id);
      setEditTask(null);
    } catch { toast.error('Löschen fehlgeschlagen'); }
  };

  if (!loaded) return <div className="kanban-loading">Lade Boards...</div>;

  // Board selection
  if (!activeBoard) {
    return (
      <div className="kanban-empty">
        <h3>Kanban Boards</h3>
        {boards.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Noch kein Board in diesem Kanal.</p>
        ) : (
          <div className="kanban-board-list">
            {boards.map((b) => (
              <button key={b.id} className="kanban-board-card" onClick={() => loadBoard(b.id)}>
                📋 {b.name}
              </button>
            ))}
          </div>
        )}
        <button className="btn-primary" style={{ width: 'auto' }} onClick={createBoard}>Board erstellen</button>
      </div>
    );
  }

  return (
    <div className="kanban-container">
      <div className="kanban-header">
        <button className="btn-small" onClick={() => setActiveBoard(null)}>← Zurück</button>
        <h3>{activeBoard.name}</h3>
      </div>

      <div className="kanban-columns">
        {(activeBoard.buckets || []).map((bucket) => (
          <div
            key={bucket.id}
            className={`kanban-column ${dragTask ? 'drop-target' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragTask && dragTask.fromBucket !== bucket.id) {
                moveTask(dragTask.taskId, bucket.id);
              }
              setDragTask(null);
            }}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-dot" style={{ background: bucket.color || 'var(--text-muted)' }} />
              <span>{bucket.name}</span>
              <span className="kanban-count">{(bucket.tasks || []).length}</span>
            </div>

            <div className="kanban-cards">
              {(bucket.tasks || []).map((task) => {
                const subtasks = parseSubtasks(task.description);
                const subtasksDone = subtasks.filter(s => s.done).length;
                const progress = subtasks.length > 0 ? Math.round((subtasksDone / subtasks.length) * 100) : (task.completed ? 100 : 0);
                const assigneeName = task.assigned_to ? members.find(m => m.id === task.assigned_to)?.name : null;
                const prio = PRIORITY_OPTIONS[task.priority] || PRIORITY_OPTIONS[0];
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;

                return (
                  <div
                    key={task.id}
                    className={`kanban-card ${task.completed ? 'completed' : ''}`}
                    draggable
                    onDragStart={() => setDragTask({ taskId: task.id, fromBucket: bucket.id })}
                    onDragEnd={() => setDragTask(null)}
                    onClick={() => setEditTask(task)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Priority bar */}
                    {prio.color && (
                      <div style={{ height: 3, background: prio.color, borderRadius: '4px 4px 0 0', margin: '-8px -10px 6px' }} />
                    )}

                    <div className="kanban-card-header">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => { e.stopPropagation(); updateTask(task.id, { completed: !task.completed }); }}
                      />
                      <span className="kanban-card-title">{task.title}</span>
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, fontSize: 11 }}>
                      {prio.icon && <span title={`Priorität: ${prio.label}`}>{prio.icon}</span>}
                      {task.due_date && (
                        <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }} title="Fälligkeitsdatum">
                          📅 {new Date(task.due_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                      {assigneeName && (
                        <span style={{ color: 'var(--text-muted)' }} title={`Zugewiesen: ${assigneeName}`}>
                          👤 {assigneeName}
                        </span>
                      )}
                      {subtasks.length > 0 && (
                        <span style={{ color: 'var(--text-muted)' }} title={`${subtasksDone}/${subtasks.length} Subtasks`}>
                          ☑ {subtasksDone}/{subtasks.length}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {(subtasks.length > 0 || task.completed) && (
                      <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, marginTop: 6 }}>
                        <div style={{
                          height: '100%', borderRadius: 2, transition: 'width 0.2s',
                          width: `${progress}%`,
                          background: progress === 100 ? 'var(--status-online)' : 'var(--brand-primary)',
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add task */}
            <div className="kanban-add">
              <input
                placeholder="+ Aufgabe..."
                value={newTaskTitle[bucket.id] || ''}
                onChange={(e) => setNewTaskTitle({ ...newTaskTitle, [bucket.id]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addTask(bucket.id)}
              />
            </div>
          </div>
        ))}

        {/* Add column */}
        <div className="kanban-column" style={{ minWidth: 200, opacity: 0.7 }}>
          <div className="kanban-add" style={{ marginTop: 0 }}>
            <input
              placeholder="+ Neue Spalte..."
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBucket()}
            />
          </div>
        </div>
      </div>

      {/* Task detail modal */}
      {editTask && (
        <TaskDetailModal
          task={editTask}
          members={members}
          onClose={() => setEditTask(null)}
          onSave={(data) => { updateTask(editTask.id, data); setEditTask(null); }}
          onDelete={() => deleteTask(editTask.id)}
        />
      )}
    </div>
  );
}

// Task Detail Modal with priority, assignee, due date, subtasks, description
function TaskDetailModal({ task, members, onClose, onSave, onDelete }: {
  task: Task;
  members: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority);
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(parseSubtasks(task.description));
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { text: newSubtask.trim(), done: false }]);
    setNewSubtask('');
  };

  const toggleSubtask = (idx: number) => {
    setSubtasks(subtasks.map((s, i) => i === idx ? { ...s, done: !s.done } : s));
  };

  const removeSubtask = (idx: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    // Encode subtasks into description field
    const subtaskText = subtasks.map(s => `${s.done ? '[x]' : '[ ]'} ${s.text}`).join('\n');
    const fullDesc = description ? `${description}\n---\n${subtaskText}` : subtaskText;

    onSave({
      title: title.trim() || task.title,
      description: fullDesc || undefined,
      priority,
      assigned_to: assignedTo || undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      completed: subtasks.length > 0 ? subtasks.every(s => s.done) : task.completed,
    });
  };

  const subtasksDone = subtasks.filter(s => s.done).length;
  const progress = subtasks.length > 0 ? Math.round((subtasksDone / subtasks.length) * 100) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="settings-content" style={{ padding: 24 }}>
          <button className="settings-close" onClick={onClose}>ESC</button>

          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontSize: 20, fontWeight: 700, background: 'none', border: 'none', color: 'var(--text-primary)', width: '100%', marginBottom: 16, outline: 'none', fontFamily: 'var(--font-primary)' }}
            placeholder="Aufgabentitel"
          />

          {/* Meta row: Priority, Assignee, Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {/* Priority */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Priorität</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.icon || '⚪'} {p.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Zugewiesen an</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}
              >
                <option value="">Nicht zugewiesen</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fällig am</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-primary)' }}
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notizen, Details, Kontext..."
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-primary)', resize: 'vertical' }}
            />
          </div>

          {/* Subtasks / Checklist */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Checkliste</label>
              {subtasks.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {subtasksDone}/{subtasks.length} ({progress}%)
                </span>
              )}
            </div>

            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 3, transition: 'width 0.2s',
                  width: `${progress}%`,
                  background: progress === 100 ? 'var(--status-online)' : 'var(--brand-primary)',
                }} />
              </div>
            )}

            {/* Subtask items */}
            {subtasks.map((st, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <input type="checkbox" checked={st.done} onChange={() => toggleSubtask(idx)} />
                <span style={{
                  flex: 1, fontSize: 14, color: 'var(--text-primary)',
                  textDecoration: st.done ? 'line-through' : 'none',
                  opacity: st.done ? 0.6 : 1,
                }}>
                  {st.text}
                </span>
                <button
                  onClick={() => removeSubtask(idx)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                >×</button>
              </div>
            ))}

            {/* Add subtask */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="+ Unterpunkt hinzufügen..."
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                style={{ flex: 1, padding: '6px 10px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <button className="btn-small" onClick={addSubtask} disabled={!newSubtask.trim()}>+</button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button className="btn-small danger" onClick={onDelete}>Aufgabe löschen</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ width: 'auto' }} onClick={onClose}>
                Abbrechen
              </button>
              <button className="btn-primary" style={{ width: 'auto' }} onClick={handleSave}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Parse subtasks from description field (format: "[ ] text" or "[x] text")
function parseSubtasks(description?: string): Subtask[] {
  if (!description) return [];
  const lines = description.split('\n');
  const subtasks: Subtask[] = [];
  for (const line of lines) {
    const match = line.match(/^\[([ x])\]\s*(.+)/);
    if (match) {
      subtasks.push({ done: match[1] === 'x', text: match[2] });
    }
  }
  return subtasks;
}
