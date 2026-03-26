package user

import (
	"context"
	"errors"
)

// Relationship types
const (
	RelFriend          = 1
	RelBlocked         = 2
	RelPendingIncoming = 3
	RelPendingOutgoing = 4
)

var (
	ErrAlreadyFriends = errors.New("already friends")
	ErrNotFriends     = errors.New("not friends")
	ErrSelfRelation   = errors.New("cannot add yourself")
	ErrTargetNotFound = errors.New("user not found")
	ErrAlreadyBlocked = errors.New("user is blocked")
)

type Relationship struct {
	UserID    int64  `json:"user_id,string"`
	TargetID  int64  `json:"id,string"` // shown as "id" to match Discord convention
	Type      int    `json:"type"`
	Username  string `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarHash *string `json:"avatar"`
}

// GetRelationships returns all relationships for a user.
func (s *Service) GetRelationships(ctx context.Context, userID int64) ([]Relationship, error) {
	rows, err := s.db.Query(ctx, `
		SELECT r.user_id, r.target_id, r.type,
		       u.username, u.display_name, u.avatar_hash
		FROM relationships r
		INNER JOIN users u ON u.id = r.target_id
		WHERE r.user_id = $1
		ORDER BY u.username
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rels []Relationship
	for rows.Next() {
		var r Relationship
		rows.Scan(&r.UserID, &r.TargetID, &r.Type, &r.Username, &r.DisplayName, &r.AvatarHash)
		rels = append(rels, r)
	}
	return rels, nil
}

// SendFriendRequest sends a friend request by username.
func (s *Service) SendFriendRequest(ctx context.Context, userID int64, targetUsername string) error {
	// Find target
	var targetID int64
	err := s.db.QueryRow(ctx, `SELECT id FROM users WHERE username = $1`, targetUsername).Scan(&targetID)
	if err != nil {
		return ErrTargetNotFound
	}
	if targetID == userID {
		return ErrSelfRelation
	}

	// Check if blocked
	var blocked bool
	s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = $3)`,
		targetID, userID, RelBlocked).Scan(&blocked)
	if blocked {
		return ErrAlreadyBlocked
	}

	// Check existing relationship
	var existingType int
	err = s.db.QueryRow(ctx, `SELECT type FROM relationships WHERE user_id = $1 AND target_id = $2`,
		userID, targetID).Scan(&existingType)
	if err == nil {
		if existingType == RelFriend {
			return ErrAlreadyFriends
		}
		if existingType == RelPendingOutgoing {
			return errors.New("friend request already sent")
		}
		if existingType == RelPendingIncoming {
			// Accept the pending request
			return s.AcceptFriend(ctx, userID, targetID)
		}
	}

	// Create outgoing request for sender, incoming for receiver
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tx.Exec(ctx, `INSERT INTO relationships (user_id, target_id, type) VALUES ($1, $2, $3) ON CONFLICT (user_id, target_id) DO UPDATE SET type = $3`,
		userID, targetID, RelPendingOutgoing)
	tx.Exec(ctx, `INSERT INTO relationships (user_id, target_id, type) VALUES ($1, $2, $3) ON CONFLICT (user_id, target_id) DO UPDATE SET type = $3`,
		targetID, userID, RelPendingIncoming)

	return tx.Commit(ctx)
}

// AcceptFriend accepts a pending friend request.
func (s *Service) AcceptFriend(ctx context.Context, userID, targetID int64) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tx.Exec(ctx, `UPDATE relationships SET type = $3 WHERE user_id = $1 AND target_id = $2`, userID, targetID, RelFriend)
	tx.Exec(ctx, `UPDATE relationships SET type = $3 WHERE user_id = $1 AND target_id = $2`, targetID, userID, RelFriend)

	return tx.Commit(ctx)
}

// RemoveFriend removes a friendship or cancels/denies a request.
func (s *Service) RemoveFriend(ctx context.Context, userID, targetID int64) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tx.Exec(ctx, `DELETE FROM relationships WHERE user_id = $1 AND target_id = $2`, userID, targetID)
	tx.Exec(ctx, `DELETE FROM relationships WHERE user_id = $1 AND target_id = $2`, targetID, userID)

	return tx.Commit(ctx)
}

// BlockUser blocks a target user.
func (s *Service) BlockUser(ctx context.Context, userID, targetID int64) error {
	if targetID == userID {
		return ErrSelfRelation
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Remove any existing relationship from both sides
	tx.Exec(ctx, `DELETE FROM relationships WHERE user_id = $1 AND target_id = $2`, userID, targetID)
	tx.Exec(ctx, `DELETE FROM relationships WHERE user_id = $1 AND target_id = $2`, targetID, userID)

	// Add block
	tx.Exec(ctx, `INSERT INTO relationships (user_id, target_id, type) VALUES ($1, $2, $3)`, userID, targetID, RelBlocked)

	return tx.Commit(ctx)
}

// UnblockUser removes a block.
func (s *Service) UnblockUser(ctx context.Context, userID, targetID int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = $3`,
		userID, targetID, RelBlocked)
	return err
}

// GetUserByUsername looks up a user by username.
func (s *Service) GetUserByUsername(ctx context.Context, username string) (map[string]any, error) {
	var id int64
	var uname string
	var displayName, avatarHash, bio *string
	err := s.db.QueryRow(ctx, `
		SELECT id, username, display_name, avatar_hash, bio FROM users WHERE username = $1
	`, username).Scan(&id, &uname, &displayName, &avatarHash, &bio)
	if err != nil {
		return nil, ErrTargetNotFound
	}
	return map[string]any{
		"id": id, "username": uname, "display_name": displayName,
		"avatar": avatarHash, "bio": bio,
	}, nil
}
