package channel

import "context"

// ChannelRepository defines the data access interface for channels.
type ChannelRepository interface {
	Create(ctx context.Context, id int64, guildID *int64, req CreateChannelRequest) (*Channel, error)
	Get(ctx context.Context, id int64) (*Channel, error)
	GetGuildChannels(ctx context.Context, guildID int64) ([]Channel, error)
	Update(ctx context.Context, id int64, req UpdateChannelRequest) (*Channel, error)
	Delete(ctx context.Context, id int64) error
	UpdateLastMessage(ctx context.Context, channelID, messageID int64) error
	GetOverwrites(ctx context.Context, channelID int64) ([]Overwrite, error)
	SetOverwrite(ctx context.Context, channelID, targetID int64, targetType int, allow, deny int64) error
	DeleteOverwrite(ctx context.Context, channelID, targetID int64) error
}

var _ ChannelRepository = (*Repository)(nil)
