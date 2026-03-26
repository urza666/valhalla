package message

import "context"

// MessageRepository defines the data access interface for messages.
// This enables unit testing with mocks and decouples handlers from the database.
type MessageRepository interface {
	Create(ctx context.Context, id, channelID, authorID int64, req CreateMessageRequest) (*Message, error)
	Get(ctx context.Context, id int64) (*Message, error)
	GetMessages(ctx context.Context, channelID int64, q MessagesQuery) ([]Message, error)
	Update(ctx context.Context, id int64, content string) (*Message, error)
	Delete(ctx context.Context, id int64) error
	GetAuthorID(ctx context.Context, id int64) (int64, error)
	AddReaction(ctx context.Context, messageID, userID int64, emoji string) error
	RemoveReaction(ctx context.Context, messageID, userID int64, emoji string) error
	GetReactions(ctx context.Context, messageID int64, viewerID int64) ([]Reaction, error)
	AckMessage(ctx context.Context, userID, channelID, messageID int64) error
	GetChannelGuildID(ctx context.Context, channelID int64) int64
	SavePendingAttachment(ctx context.Context, att Attachment) error
	LinkPendingAttachment(ctx context.Context, attachmentID, messageID int64) error
	GetAttachments(ctx context.Context, messageIDs []int64) (map[int64][]Attachment, error)
}

// Ensure Repository implements MessageRepository at compile time.
var _ MessageRepository = (*Repository)(nil)
