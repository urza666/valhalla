package sso

import (
	"encoding/base64"
	"encoding/xml"
	"fmt"
)

// SAMLAssertion holds the parsed attributes from a SAML response.
type SAMLAssertion struct {
	NameID      string
	Email       string
	DisplayName string
}

// SPMetadata is a minimal SAML Service Provider metadata structure.
type SPMetadata struct {
	XMLName          xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntityDescriptor"`
	EntityID         string   `xml:"entityID,attr"`
	SPSSODescriptor  SPSSODescriptor
}

type SPSSODescriptor struct {
	XMLName                    xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata SPSSODescriptor"`
	AuthnRequestsSigned        bool     `xml:"AuthnRequestsSigned,attr"`
	WantAssertionsSigned       bool     `xml:"WantAssertionsSigned,attr"`
	ProtocolSupportEnumeration string   `xml:"protocolSupportEnumeration,attr"`
	NameIDFormat               NameIDFormat
	AssertionConsumerService   AssertionConsumerService
}

type NameIDFormat struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata NameIDFormat"`
	Value   string   `xml:",chardata"`
}

type AssertionConsumerService struct {
	XMLName  xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata AssertionConsumerService"`
	Binding  string   `xml:"Binding,attr"`
	Location string   `xml:"Location,attr"`
	Index    int      `xml:"index,attr"`
}

// buildSPMetadata creates a minimal SAML SP metadata document.
func buildSPMetadata(entityID, acsURL string) SPMetadata {
	return SPMetadata{
		EntityID: entityID,
		SPSSODescriptor: SPSSODescriptor{
			AuthnRequestsSigned:        false,
			WantAssertionsSigned:       true,
			ProtocolSupportEnumeration: "urn:oasis:names:tc:SAML:2.0:protocol",
			NameIDFormat: NameIDFormat{
				Value: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
			},
			AssertionConsumerService: AssertionConsumerService{
				Binding:  "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
				Location: acsURL,
				Index:    0,
			},
		},
	}
}

// parseSAMLResponse does a basic parse of a base64-encoded SAML response.
// NOTE: This is an MVP implementation. Production use requires full XML signature
// validation against the IdP certificate.
func parseSAMLResponse(samlResponseB64 string) (*SAMLAssertion, error) {
	decoded, err := base64.StdEncoding.DecodeString(samlResponseB64)
	if err != nil {
		return nil, fmt.Errorf("failed to base64 decode SAML response: %w", err)
	}

	// Minimal XML structure to extract the key fields
	type samlAttribute struct {
		Name   string `xml:"Name,attr"`
		Values []struct {
			Value string `xml:",chardata"`
		} `xml:"AttributeValue"`
	}

	type samlSubject struct {
		NameID struct {
			Value string `xml:",chardata"`
		} `xml:"NameID"`
	}

	type samlAssertion struct {
		Subject          samlSubject      `xml:"Subject"`
		AttributeStatement struct {
			Attributes []samlAttribute `xml:"Attribute"`
		} `xml:"AttributeStatement"`
	}

	type samlResponse struct {
		XMLName   xml.Name        `xml:"Response"`
		Assertion []samlAssertion `xml:"Assertion"`
	}

	var resp samlResponse
	if err := xml.Unmarshal(decoded, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse SAML response XML: %w", err)
	}

	if len(resp.Assertion) == 0 {
		return nil, fmt.Errorf("SAML response contains no assertions")
	}

	assertion := resp.Assertion[0]
	result := &SAMLAssertion{
		NameID: assertion.Subject.NameID.Value,
	}

	// Extract common attributes
	for _, attr := range assertion.AttributeStatement.Attributes {
		if len(attr.Values) == 0 {
			continue
		}
		val := attr.Values[0].Value
		switch attr.Name {
		case "email", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
			"urn:oid:0.9.2342.19200300.100.1.3":
			result.Email = val
		case "displayName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
			"urn:oid:2.16.840.1.113730.3.1.241":
			result.DisplayName = val
		}
	}

	// If no email attribute, use NameID as email (common pattern)
	if result.Email == "" {
		result.Email = result.NameID
	}

	return result, nil
}
