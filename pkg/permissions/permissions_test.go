package permissions

import "testing"

func TestBitfield_Has(t *testing.T) {
	perms := Bitfield(SendMessages | ViewChannel | AddReactions)

	if !perms.Has(SendMessages) {
		t.Error("should have SendMessages")
	}
	if !perms.Has(ViewChannel) {
		t.Error("should have ViewChannel")
	}
	if perms.Has(Administrator) {
		t.Error("should not have Administrator")
	}
	if perms.Has(ManageChannels) {
		t.Error("should not have ManageChannels")
	}
}

func TestBitfield_AddRemove(t *testing.T) {
	perms := Bitfield(0)
	perms = perms.Add(SendMessages)
	if !perms.Has(SendMessages) {
		t.Error("should have SendMessages after Add")
	}
	perms = perms.Remove(SendMessages)
	if perms.Has(SendMessages) {
		t.Error("should not have SendMessages after Remove")
	}
}

func TestComputeBasePermissions_Owner(t *testing.T) {
	result := ComputeBasePermissions(123, 123, 0, nil)
	if result != All {
		t.Error("owner should have ALL permissions")
	}
}

func TestComputeBasePermissions_Admin(t *testing.T) {
	result := ComputeBasePermissions(999, 123, Bitfield(Administrator), nil)
	if result != All {
		t.Error("admin should have ALL permissions")
	}
}

func TestComputeBasePermissions_Normal(t *testing.T) {
	everyone := Bitfield(ViewChannel | SendMessages)
	rolePerms := []Bitfield{Bitfield(ManageMessages)}

	result := ComputeBasePermissions(999, 123, everyone, rolePerms)

	if !result.Has(ViewChannel) {
		t.Error("should have ViewChannel from everyone")
	}
	if !result.Has(SendMessages) {
		t.Error("should have SendMessages from everyone")
	}
	if !result.Has(ManageMessages) {
		t.Error("should have ManageMessages from role")
	}
	if result.Has(Administrator) {
		t.Error("should not have Administrator")
	}
}

func TestComputeOverwrites_AdminBypass(t *testing.T) {
	result := ComputeOverwrites(All, nil, 123, 1, []Overwrite{
		{ID: 1, Type: 0, Deny: Bitfield(SendMessages)},
	})
	if result != All {
		t.Error("admin should bypass all overwrites")
	}
}

func TestComputeOverwrites_DenyEveryone(t *testing.T) {
	base := Bitfield(ViewChannel | SendMessages)
	overwrites := []Overwrite{
		{ID: 1, Type: 0, Deny: Bitfield(SendMessages)}, // @everyone deny
	}

	result := ComputeOverwrites(base, nil, 123, 1, overwrites)

	if result.Has(SendMessages) {
		t.Error("SendMessages should be denied by @everyone overwrite")
	}
	if !result.Has(ViewChannel) {
		t.Error("ViewChannel should still be allowed")
	}
}

func TestComputeOverwrites_MemberOverridePriority(t *testing.T) {
	base := Bitfield(ViewChannel)
	overwrites := []Overwrite{
		{ID: 1, Type: 0, Deny: Bitfield(SendMessages)},     // @everyone deny
		{ID: 123, Type: 1, Allow: Bitfield(SendMessages)},   // member allow (higher priority)
	}

	result := ComputeOverwrites(base, nil, 123, 1, overwrites)

	if !result.Has(SendMessages) {
		t.Error("member-specific allow should override @everyone deny")
	}
}

func TestApplyImplicitDenies_NoViewChannel(t *testing.T) {
	perms := Bitfield(SendMessages | AddReactions)
	result := ApplyImplicitDenies(perms)
	if result != 0 {
		t.Error("without ViewChannel, all permissions should be denied")
	}
}

func TestApplyImplicitDenies_NoSendMessages(t *testing.T) {
	perms := Bitfield(ViewChannel | MentionEveryone | AttachFiles)
	result := ApplyImplicitDenies(perms)

	if result.Has(MentionEveryone) {
		t.Error("MentionEveryone should be denied without SendMessages")
	}
	if result.Has(AttachFiles) {
		t.Error("AttachFiles should be denied without SendMessages")
	}
	if !result.Has(ViewChannel) {
		t.Error("ViewChannel should still be allowed")
	}
}

func TestDefaultEveryone(t *testing.T) {
	if !DefaultEveryone.Has(ViewChannel) {
		t.Error("default everyone should have ViewChannel")
	}
	if !DefaultEveryone.Has(SendMessages) {
		t.Error("default everyone should have SendMessages")
	}
	if DefaultEveryone.Has(Administrator) {
		t.Error("default everyone should NOT have Administrator")
	}
	if DefaultEveryone.Has(ManageChannels) {
		t.Error("default everyone should NOT have ManageChannels")
	}
}
