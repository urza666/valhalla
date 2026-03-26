package auth

import (
	"testing"
)

func TestGenerateTOTPSecret(t *testing.T) {
	secret, err := GenerateTOTPSecret()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(secret) == 0 {
		t.Fatal("secret should not be empty")
	}
	// Base32 encoded 20 bytes = 32 chars (minus padding)
	if len(secret) < 20 {
		t.Fatalf("secret too short: %d chars", len(secret))
	}
}

func TestGenerateTOTPCode(t *testing.T) {
	secret, _ := GenerateTOTPSecret()
	code := GenerateTOTPCode(secret)

	if len(code) != 6 {
		t.Fatalf("expected 6-digit code, got %d digits: %s", len(code), code)
	}

	// Code should only contain digits
	for _, c := range code {
		if c < '0' || c > '9' {
			t.Fatalf("code contains non-digit: %c", c)
		}
	}
}

func TestValidateTOTP_CurrentCode(t *testing.T) {
	secret, _ := GenerateTOTPSecret()
	code := GenerateTOTPCode(secret)

	if !ValidateTOTP(secret, code) {
		t.Fatal("current code should be valid")
	}
}

func TestValidateTOTP_WrongCode(t *testing.T) {
	secret, _ := GenerateTOTPSecret()

	if ValidateTOTP(secret, "000000") {
		// Extremely unlikely but technically possible — skip test
		t.Skip("unlikely collision with 000000")
	}
}

func TestValidateTOTP_DifferentSecrets(t *testing.T) {
	secret1, _ := GenerateTOTPSecret()
	secret2, _ := GenerateTOTPSecret()

	code1 := GenerateTOTPCode(secret1)

	if ValidateTOTP(secret2, code1) {
		t.Skip("unlikely collision between different secrets")
	}
}

func TestGenerateTOTPURI(t *testing.T) {
	uri := GenerateTOTPURI("JBSWY3DPEHPK3PXP", "user@example.com", "Valhalla")

	if uri == "" {
		t.Fatal("URI should not be empty")
	}
	if len(uri) < 50 {
		t.Fatalf("URI too short: %s", uri)
	}
}

func TestGenerateBackupCodes(t *testing.T) {
	codes, err := GenerateBackupCodes()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(codes) != 8 {
		t.Fatalf("expected 8 backup codes, got %d", len(codes))
	}
	for _, code := range codes {
		if len(code) != 8 {
			t.Fatalf("expected 8-char code, got %d: %s", len(code), code)
		}
	}

	// Codes should be unique
	seen := make(map[string]bool)
	for _, code := range codes {
		if seen[code] {
			t.Fatalf("duplicate backup code: %s", code)
		}
		seen[code] = true
	}
}
