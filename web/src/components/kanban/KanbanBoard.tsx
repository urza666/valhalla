import { useEffect, useState } from 'react';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

interface Task {
  id: string; bucket_id: string; title: string; description?: string;
  position: number; priority: number; completed: boolean;
  assigned_to?: string; labels: string[]; due_date?: string;
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

export function KanbanBoard({ channelId, guildId }: Props) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({});
  const [dragTask, setDragTask] = useState<{ taskId: string; fromBucket: string } | null>(null);

  useEffect(() => {
    fetch(`/api/v1/channels/${channelId}/boards`, { headers: headers() })
      .then((r) => r.json())
      .then((b) => { setBoards(b || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [channelId]);

  const createBoard = async () => {
    try {
      const res = await fetch(`/api/v1/channels/${channelId}/boards`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ name: 'Neues Board', guild_id: guildId }),
      });
      const board = await res.json();
      setBoards([...boards, board]);
      loadBoard(board.id);
    } catch { /* toast would need import */ }
  };

  const loadBoard = async (boardId: string) => {
    try {
      const res = await fetch(`/api/v1/boards/${boardId}`, { headers: headers() });
      const board = await res.json();
      setActiveBoard(board);
    } catch { /* silent */ }
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
    } catch { /* silent */ }
  };

  const moveTask = async (taskId: string, toBucketId: string) => {
    try {
      await fetch(`/api/v1/tasks/${taskId}/move`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ bucket_id: toBucketId, position: 0 }),
      });
      if (activeBoard) loadBoard(activeBoard.id);
    } catch { /* silent */ }
  };

  const toggleComplete = async (taskId: string, completed: boolean) => {
    try {
      await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify({ completed }),
      });
      if (activeBoard) loadBoard(activeBoard.id);
    } catch { /* silent */ }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/v1/tasks/${taskId}`, { method: 'DELETE', headers: headers() });
      if (activeBoard) loadBoard(activeBoard.id);
    } catch { /* silent */ }
  };

  const priorityLabels = ['', '🔵 Niedrig', '🟡 Mittel', '🟠 Hoch', '🔴 Dringend'];

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
        <button className="btn" style={{ width: 'auto' }} onClick={createBoard}>Board erstellen</button>
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
              {(bucket.tasks || []).map((task) => (
                <div
                  key={task.id}
                  className={`kanban-card ${task.completed ? 'completed' : ''}`}
                  draggable
                  onDragStart={() => setDragTask({ taskId: task.id, fromBucket: bucket.id })}
                  onDragEnd={() => setDragTask(null)}
                >
                  <div className="kanban-card-header">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleComplete(task.id, !task.completed)}
                    />
                    <span className="kanban-card-title">{task.title}</span>
                    <button className="kanban-card-delete" onClick={() => deleteTask(task.id)}>×</button>
                  </div>
                  {task.priority > 0 && (
                    <div className="kanban-card-meta">{priorityLabels[task.priority]}</div>
                  )}
                  {task.due_date && (
                    <div className="kanban-card-meta">📅 {new Date(task.due_date).toLocaleDateString()}</div>
                  )}
                </div>
              ))}
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
      </div>
    </div>
  );
}
