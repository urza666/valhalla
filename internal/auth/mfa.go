package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"time"
)

// TOTP implements RFC 6238 Time-Based One-Time Password.
// Parameters: SHA1, 6 digits, 30-second period (standard Google Authenticator settings).

const (
	totpDigits = 6
	totpPeriod = 30 // seconds
)

// GenerateTOTPSecret creates a random 20-byte secret, base32-encoded.
func GenerateTOTPSecret() (string, error) {
	secret := make([]byte, 20)
	if _, err := rand.Read(secret); err != nil {
		return "", err
	}
	return strings.TrimRight(base32.StdEncoding.EncodeToString(secret), "="), nil
}

// ValidateTOTP checks if the given code matches the current or adjacent time periods.
// Allows ±1 period (30s) of clock skew.
func ValidateTOTP(secret, code string) bool {
	now := time.Now().Unix()
	for _, offset := range []int64{-1, 0, 1} {
		t := (now / totpPeriod) + offset
		expected := generateTOTPCode(secret, t)
		if expected == code {
			return true
		}
	}
	return false
}

// GenerateTOTPCode generates the current TOTP code for display/testing.
func GenerateTOTPCode(secret string) string {
	t := time.Now().Unix() / totpPeriod
	return generateTOTPCode(secret, t)
}

func generateTOTPCode(secret string, counter int64) string {
	// Decode base32 secret
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		return ""
	}

	// Convert counter to 8-byte big-endian
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(counter))

	// HMAC-SHA1
	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	hash := mac.Sum(nil)

	// Dynamic truncation (RFC 4226 section 5.4)
	offset := hash[len(hash)-1] & 0x0f
	code := binary.BigEndian.Uint32(hash[offset:offset+4]) & 0x7fffffff

	// Modulo to get N digits
	otp := code % uint32(math.Pow10(totpDigits))
	return fmt.Sprintf("%0*d", totpDigits, otp)
}

// GenerateTOTPURI creates an otpauth:// URI for QR code generation.
// Standard format for Google Authenticator, Authy, etc.
func GenerateTOTPURI(secret, email, issuer string) string {
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d",
		issuer, email, secret, issuer, totpDigits, totpPeriod)
}

// GenerateBackupCodes creates 8 random 8-character backup codes.
func GenerateBackupCodes() ([]string, error) {
	codes := make([]string, 8)
	for i := range codes {
		b := make([]byte, 4)
		if _, err := rand.Read(b); err != nil {
			return nil, err
		}
		codes[i] = fmt.Sprintf("%08x", b)
	}
	return codes, nil
}
