package embed

import (
	"context"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// Embed represents a rich embed extracted from a URL.
type Embed struct {
	Type        string  `json:"type"` // "rich", "image", "video", "link"
	URL         string  `json:"url"`
	Title       string  `json:"title,omitempty"`
	Description string  `json:"description,omitempty"`
	Color       int     `json:"color,omitempty"`
	Thumbnail   *Media  `json:"thumbnail,omitempty"`
	Image       *Media  `json:"image,omitempty"`
	Provider    *Provider `json:"provider,omitempty"`
	SiteName    string  `json:"site_name,omitempty"`
}

type Media struct {
	URL    string `json:"url"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
}

type Provider struct {
	Name string `json:"name,omitempty"`
	URL  string `json:"url,omitempty"`
}

var urlRegex = regexp.MustCompile(`https?://[^\s<]+`)

// Service extracts embeds from message content.
type Service struct {
	client *http.Client
}

func NewService() *Service {
	return &Service{
		client: &http.Client{
			Timeout: 5 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 3 {
					return http.ErrUseLastResponse
				}
				return nil
			},
		},
	}
}

// ExtractEmbeds finds URLs in content and fetches OpenGraph data.
func (s *Service) ExtractEmbeds(ctx context.Context, content string) []Embed {
	urls := urlRegex.FindAllString(content, 5) // max 5 embeds per message
	if len(urls) == 0 {
		return nil
	}

	var embeds []Embed
	for _, url := range urls {
		embed, err := s.fetchOpenGraph(ctx, url)
		if err != nil || embed == nil {
			continue
		}
		embeds = append(embeds, *embed)
	}
	return embeds
}

func (s *Service) fetchOpenGraph(ctx context.Context, rawURL string) (*Embed, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Valhalla/1.0 (Embed Fetcher)")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, nil
	}

	contentType := resp.Header.Get("Content-Type")

	// Direct image
	if strings.HasPrefix(contentType, "image/") {
		return &Embed{
			Type: "image",
			URL:  rawURL,
			Image: &Media{URL: rawURL},
		}, nil
	}

	// HTML — parse OpenGraph tags
	if !strings.Contains(contentType, "text/html") {
		return nil, nil
	}

	// Read limited body (max 64KB for OG parsing)
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return nil, err
	}

	html := string(body)
	embed := &Embed{
		Type: "link",
		URL:  rawURL,
	}

	embed.Title = extractMeta(html, "og:title")
	if embed.Title == "" {
		embed.Title = extractHTMLTitle(html)
	}
	embed.Description = extractMeta(html, "og:description")
	if embed.Description == "" {
		embed.Description = extractMeta(html, "description")
	}
	embed.SiteName = extractMeta(html, "og:site_name")

	if img := extractMeta(html, "og:image"); img != "" {
		if strings.HasPrefix(img, "/") {
			// Resolve relative URL
			parts := strings.SplitN(rawURL, "/", 4)
			if len(parts) >= 3 {
				img = parts[0] + "//" + parts[2] + img
			}
		}
		embed.Thumbnail = &Media{URL: img}
	}

	if embed.Title == "" && embed.Description == "" {
		return nil, nil // No useful data
	}

	// Truncate description
	if len(embed.Description) > 300 {
		embed.Description = embed.Description[:297] + "..."
	}

	return embed, nil
}

// Simple regex-based meta tag extraction (avoids full HTML parser dependency)
func extractMeta(html, property string) string {
	// Try og: property
	patterns := []string{
		`<meta\s+property="` + property + `"\s+content="([^"]*)"`,
		`<meta\s+content="([^"]*)"\s+property="` + property + `"`,
		`<meta\s+name="` + property + `"\s+content="([^"]*)"`,
		`<meta\s+content="([^"]*)"\s+name="` + property + `"`,
	}
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		match := re.FindStringSubmatch(html)
		if len(match) > 1 {
			return strings.TrimSpace(match[1])
		}
	}
	return ""
}

func extractHTMLTitle(html string) string {
	re := regexp.MustCompile(`<title[^>]*>([^<]+)</title>`)
	match := re.FindStringSubmatch(html)
	if len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}
