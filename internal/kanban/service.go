package kanban

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var (
	ErrBoardNotFound  = errors.New("board not found")
	ErrBucketNotFound = errors.New("bucket not found")
	ErrTaskNotFound   = errors.New("task not found")
)

type Board struct {
	ID        int64     `json:"id,string"`
	ChannelID int64     `json:"channel_id,string"`
	GuildID   int64     `json:"guild_id,string"`
	Name      string    `json:"name"`
	CreatedBy int64     `json:"created_by,string"`
	CreatedAt time.Time `json:"created_at"`
	Buckets   []Bucket  `json:"buckets,omitempty"`
}

type Bucket struct {
	ID        int64  `json:"id,string"`
	BoardID   int64  `json:"board_id,string"`
	Name      string `json:"name"`
	Position  int    `json:"position"`
	Color     *string `json:"color"`
	Tasks     []Task `json:"tasks,omitempty"`
}

type Task struct {
	ID          int64     `json:"id,string"`
	BucketID    int64     `json:"bucket_id,string"`
	BoardID     int64     `json:"board_id,string"`
	Title       string    `json:"title"`
	Description *string   `json:"description"`
	Position    int       `json:"position"`
	Priority    int       `json:"priority"`
	DueDate     *time.Time `json:"due_date"`
	CreatedBy   int64     `json:"created_by,string"`
	AssignedTo  *int64    `json:"assigned_to,string"`
	Labels      []string  `json:"labels"`
	Completed   bool      `json:"completed"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Service struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

func NewService(db *pgxpool.Pool, idGen *snowflake.Generator) *Service {
	return &Service{db: db, idGen: idGen}
}

// --- Boards ---

func (s *Service) CreateBoard(ctx context.Context, channelID, guildID, userID int64, name string) (*Board, error) {
	id := s.idGen.Generate().Int64()
	var b Board
	err := s.db.QueryRow(ctx, `
		INSERT INTO kanban_boards (id, channel_id, guild_id, name, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, channel_id, guild_id, name, created_by, created_at
	`, id, channelID, guildID, name, userID).Scan(
		&b.ID, &b.ChannelID, &b.GuildID, &b.Name, &b.CreatedBy, &b.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Create default buckets
	defaults := []struct{ name, color string }{
		{"To Do", "#6d6f78"},
		{"In Progress", "#f0b232"},
		{"Done", "#23a55a"},
	}
	for i, d := range defaults {
		bucketID := s.idGen.Generate().Int64()
		s.db.Exec(ctx, `
			INSERT INTO kanban_buckets (id, board_id, name, position, color)
			VALUES ($1, $2, $3, $4, $5)
		`, bucketID, id, d.name, i, d.color)
	}

	return &b, nil
}

func (s *Service) GetBoard(ctx context.Context, boardID int64) (*Board, error) {
	var b Board
	err := s.db.QueryRow(ctx, `
		SELECT id, channel_id, guild_id, name, created_by, created_at
		FROM kanban_boards WHERE id = $1
	`, boardID).Scan(&b.ID, &b.ChannelID, &b.GuildID, &b.Name, &b.CreatedBy, &b.CreatedAt)
	if err != nil {
		return nil, ErrBoardNotFound
	}

	// Load buckets with tasks
	b.Buckets, _ = s.GetBuckets(ctx, boardID)
	return &b, nil
}

func (s *Service) GetChannelBoards(ctx context.Context, channelID int64) ([]Board, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, channel_id, guild_id, name, created_by, created_at
		FROM kanban_boards WHERE channel_id = $1 ORDER BY created_at
	`, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var boards []Board
	for rows.Next() {
		var b Board
		rows.Scan(&b.ID, &b.ChannelID, &b.GuildID, &b.Name, &b.CreatedBy, &b.CreatedAt)
		boards = append(boards, b)
	}
	return boards, nil
}

// --- Buckets ---

func (s *Service) GetBuckets(ctx context.Context, boardID int64) ([]Bucket, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, board_id, name, position, color FROM kanban_buckets
		WHERE board_id = $1 ORDER BY position
	`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buckets []Bucket
	for rows.Next() {
		var b Bucket
		rows.Scan(&b.ID, &b.BoardID, &b.Name, &b.Position, &b.Color)

		// Load tasks for this bucket
		b.Tasks, _ = s.GetBucketTasks(ctx, b.ID)
		buckets = append(buckets, b)
	}
	return buckets, nil
}

func (s *Service) CreateBucket(ctx context.Context, boardID int64, name string, position int) (*Bucket, error) {
	id := s.idGen.Generate().Int64()
	var b Bucket
	err := s.db.QueryRow(ctx, `
		INSERT INTO kanban_buckets (id, board_id, name, position)
		VALUES ($1, $2, $3, $4) RETURNING id, board_id, name, position, color
	`, id, boardID, name, position).Scan(&b.ID, &b.BoardID, &b.Name, &b.Position, &b.Color)
	return &b, err
}

// --- Tasks ---

func (s *Service) GetBucketTasks(ctx context.Context, bucketID int64) ([]Task, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, bucket_id, board_id, title, description, position, priority,
		       due_date, created_by, assigned_to, labels, completed, created_at, updated_at
		FROM kanban_tasks WHERE bucket_id = $1 ORDER BY position
	`, bucketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		rows.Scan(&t.ID, &t.BucketID, &t.BoardID, &t.Title, &t.Description,
			&t.Position, &t.Priority, &t.DueDate, &t.CreatedBy, &t.AssignedTo,
			&t.Labels, &t.Completed, &t.CreatedAt, &t.UpdatedAt)
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (s *Service) CreateTask(ctx context.Context, boardID, bucketID, userID int64, title string) (*Task, error) {
	id := s.idGen.Generate().Int64()
	var t Task
	err := s.db.QueryRow(ctx, `
		INSERT INTO kanban_tasks (id, bucket_id, board_id, title, created_by, position)
		VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(position)+1 FROM kanban_tasks WHERE bucket_id = $2), 0))
		RETURNING id, bucket_id, board_id, title, description, position, priority,
		          due_date, created_by, assigned_to, labels, completed, created_at, updated_at
	`, id, bucketID, boardID, title, userID).Scan(
		&t.ID, &t.BucketID, &t.BoardID, &t.Title, &t.Description,
		&t.Position, &t.Priority, &t.DueDate, &t.CreatedBy, &t.AssignedTo,
		&t.Labels, &t.Completed, &t.CreatedAt, &t.UpdatedAt,
	)
	return &t, err
}

func (s *Service) UpdateTask(ctx context.Context, taskID int64, updates map[string]any) (*Task, error) {
	// Build dynamic SET clause for partial updates
	// For simplicity, handle common fields
	if title, ok := updates["title"].(string); ok {
		s.db.Exec(ctx, `UPDATE kanban_tasks SET title = $2 WHERE id = $1`, taskID, title)
	}
	if desc, ok := updates["description"].(string); ok {
		s.db.Exec(ctx, `UPDATE kanban_tasks SET description = $2 WHERE id = $1`, taskID, desc)
	}
	if bucketID, ok := updates["bucket_id"]; ok {
		s.db.Exec(ctx, `UPDATE kanban_tasks SET bucket_id = $2 WHERE id = $1`, taskID, bucketID)
	}
	if position, ok := updates["position"]; ok {
		s.db.Exec(ctx, `UPDATE kanban_tasks SET position = $2 WHERE id = $1`, taskID, position)
	}
	if priority, ok := updates["priority"]; ok {
		s.db.Exec(ctx, `UPDATE kanban_tasks SET priority = $2 WHERE id = $1`, taskID, priority)
	}
	if completed, ok := updates["completed"].(bool); ok {
		s.db.Exec(ctx, `UPDATE kanban_tasks SET completed = $2 WHERE id = $1`, taskID, completed)
	}
	if assignedTo, ok := updates["assigned_to"]; ok {
		s.db.Exec(ctx, `UPDATE kanban_tasks SET assigned_to = $2 WHERE id = $1`, taskID, assignedTo)
	}

	// Return updated task
	var t Task
	err := s.db.QueryRow(ctx, `
		SELECT id, bucket_id, board_id, title, description, position, priority,
		       due_date, created_by, assigned_to, labels, completed, created_at, updated_at
		FROM kanban_tasks WHERE id = $1
	`, taskID).Scan(
		&t.ID, &t.BucketID, &t.BoardID, &t.Title, &t.Description,
		&t.Position, &t.Priority, &t.DueDate, &t.CreatedBy, &t.AssignedTo,
		&t.Labels, &t.Completed, &t.CreatedAt, &t.UpdatedAt,
	)
	return &t, err
}

func (s *Service) MoveTask(ctx context.Context, taskID, newBucketID int64, newPosition int) error {
	_, err := s.db.Exec(ctx, `
		UPDATE kanban_tasks SET bucket_id = $2, position = $3 WHERE id = $1
	`, taskID, newBucketID, newPosition)
	return err
}

func (s *Service) DeleteTask(ctx context.Context, taskID int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM kanban_tasks WHERE id = $1`, taskID)
	return err
}
