package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// IndexedMessage is what gets stored in the search index.
type IndexedMessage struct {
	ID        int64  `json:"id"`
	ChannelID int64  `json:"channel_id"`
	GuildID   int64  `json:"guild_id"`
	AuthorID  int64  `json:"author_id"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

// SearchResult represents a search hit.
type SearchResult struct {
	ID        int64  `json:"id"`
	ChannelID int64  `json:"channel_id"`
	GuildID   int64  `json:"guild_id"`
	AuthorID  int64  `json:"author_id"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

// SearchResponse from Meilisearch.
type SearchResponse struct {
	Hits             []SearchResult `json:"hits"`
	EstimatedTotal   int            `json:"estimatedTotalHits"`
	ProcessingTimeMs int            `json:"processingTimeMs"`
}

// Service handles search indexing and querying via Meilisearch.
type Service struct {
	baseURL string
	apiKey  string
	client  *http.Client
	index   string
}

func NewService(baseURL, apiKey string) *Service {
	s := &Service{
		baseURL: baseURL,
		apiKey:  apiKey,
		client:  &http.Client{Timeout: 10 * time.Second},
		index:   "messages",
	}
	// Ensure index exists with correct settings
	go s.ensureIndex()
	return s
}

// IndexMessage adds or updates a message in the search index.
func (s *Service) IndexMessage(ctx context.Context, msg IndexedMessage) error {
	body, _ := json.Marshal([]IndexedMessage{msg})
	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/indexes/%s/documents", s.baseURL, s.index),
		bytes.NewReader(body))
	if err != nil {
		return err
	}
	s.setHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// DeleteMessage removes a message from the search index.
func (s *Service) DeleteMessage(ctx context.Context, messageID int64) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE",
		fmt.Sprintf("%s/indexes/%s/documents/%d", s.baseURL, s.index, messageID), nil)
	if err != nil {
		return err
	}
	s.setHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// Search performs a full-text search across messages.
func (s *Service) Search(ctx context.Context, query string, guildID int64, channelID *int64, authorID *int64, limit, offset int) (*SearchResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	// Build filter
	filter := fmt.Sprintf("guild_id = %d", guildID)
	if channelID != nil {
		filter += fmt.Sprintf(" AND channel_id = %d", *channelID)
	}
	if authorID != nil {
		filter += fmt.Sprintf(" AND author_id = %d", *authorID)
	}

	searchReq := map[string]any{
		"q":      query,
		"filter": filter,
		"limit":  limit,
		"offset": offset,
		"sort":   []string{"timestamp:desc"},
	}

	body, _ := json.Marshal(searchReq)
	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/indexes/%s/search", s.baseURL, s.index),
		bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	s.setHeaders(req)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result SearchResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}
}

func (s *Service) ensureIndex() {
	// Create index
	body, _ := json.Marshal(map[string]any{
		"uid":        s.index,
		"primaryKey": "id",
	})
	req, _ := http.NewRequest("POST", s.baseURL+"/indexes", bytes.NewReader(body))
	s.setHeaders(req)
	s.client.Do(req)

	// Configure filterable and sortable attributes
	settings := map[string]any{
		"filterableAttributes": []string{"guild_id", "channel_id", "author_id"},
		"sortableAttributes":   []string{"timestamp"},
		"searchableAttributes": []string{"content"},
	}
	body, _ = json.Marshal(settings)
	req, _ = http.NewRequest("PATCH",
		fmt.Sprintf("%s/indexes/%s/settings", s.baseURL, s.index),
		bytes.NewReader(body))
	s.setHeaders(req)
	s.client.Do(req)
}
