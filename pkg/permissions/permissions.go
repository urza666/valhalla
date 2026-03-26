package permissions

// Permission represents a single permission bit.
type Permission int64

// Bitfield represents a set of permissions as a 64-bit integer.
type Bitfield int64

// All permission flags — mirrors Discord's permission system.
// See docs/12-discord-rechtestruktur.md for full documentation.
const (
	CreateInstantInvite          Permission = 1 << 0
	KickMembers                  Permission = 1 << 1
	BanMembers                   Permission = 1 << 2
	Administrator                Permission = 1 << 3
	ManageChannels               Permission = 1 << 4
	ManageGuild                  Permission = 1 << 5
	AddReactions                 Permission = 1 << 6
	ViewAuditLog                 Permission = 1 << 7
	PrioritySpeaker              Permission = 1 << 8
	Stream                       Permission = 1 << 9
	ViewChannel                  Permission = 1 << 10
	SendMessages                 Permission = 1 << 11
	SendTTSMessages              Permission = 1 << 12
	ManageMessages               Permission = 1 << 13
	EmbedLinks                   Permission = 1 << 14
	AttachFiles                  Permission = 1 << 15
	ReadMessageHistory           Permission = 1 << 16
	MentionEveryone              Permission = 1 << 17
	UseExternalEmojis            Permission = 1 << 18
	ViewGuildInsights            Permission = 1 << 19
	Connect                      Permission = 1 << 20
	Speak                        Permission = 1 << 21
	MuteMembers                  Permission = 1 << 22
	DeafenMembers                Permission = 1 << 23
	MoveMembers                  Permission = 1 << 24
	UseVAD                       Permission = 1 << 25
	ChangeNickname               Permission = 1 << 26
	ManageNicknames              Permission = 1 << 27
	ManageRoles                  Permission = 1 << 28
	ManageWebhooks               Permission = 1 << 29
	ManageGuildExpressions       Permission = 1 << 30
	UseApplicationCommands       Permission = 1 << 31
	RequestToSpeak               Permission = 1 << 32
	ManageEvents                 Permission = 1 << 33
	ManageThreads                Permission = 1 << 34
	CreatePublicThreads          Permission = 1 << 35
	CreatePrivateThreads         Permission = 1 << 36
	UseExternalStickers          Permission = 1 << 37
	SendMessagesInThreads        Permission = 1 << 38
	UseEmbeddedActivities        Permission = 1 << 39
	ModerateMembers              Permission = 1 << 40
	ViewCreatorMonetization      Permission = 1 << 41
	UseSoundboard                Permission = 1 << 42
	CreateGuildExpressions       Permission = 1 << 43
	CreateEvents                 Permission = 1 << 44
	UseExternalSounds            Permission = 1 << 45
	SendVoiceMessages            Permission = 1 << 46
	SendPolls                    Permission = 1 << 49
	UseExternalApps              Permission = 1 << 50
	PinMessages                  Permission = 1 << 51
	BypassSlowmode               Permission = 1 << 52

	// Valhalla-specific permissions (beyond Discord)
	ManageKanban                 Permission = 1 << 53
	ManageWiki                   Permission = 1 << 54
	ManageCalendar               Permission = 1 << 55
	ViewAnalytics                Permission = 1 << 56

	// All permissions combined
	All Bitfield = Bitfield(^Permission(0))
)

// Default permissions for @everyone in a new guild.
var DefaultEveryone = Bitfield(
	ViewChannel |
		SendMessages |
		ReadMessageHistory |
		AddReactions |
		UseExternalEmojis |
		Connect |
		Speak |
		UseVAD |
		Stream |
		CreateInstantInvite |
		CreatePublicThreads |
		SendMessagesInThreads |
		EmbedLinks |
		AttachFiles |
		UseApplicationCommands |
		ChangeNickname |
		SendVoiceMessages |
		SendPolls,
)

// Has checks if the bitfield contains the given permission.
func (b Bitfield) Has(p Permission) bool {
	return b&Bitfield(p) == Bitfield(p)
}

// Add adds permissions to the bitfield.
func (b Bitfield) Add(p Permission) Bitfield {
	return b | Bitfield(p)
}

// Remove removes permissions from the bitfield.
func (b Bitfield) Remove(p Permission) Bitfield {
	return b &^ Bitfield(p)
}

// Overwrite holds an allow/deny pair for a channel permission overwrite.
type Overwrite struct {
	ID    int64    // Role ID or User ID
	Type  int      // 0 = role, 1 = member
	Allow Bitfield // Explicitly allowed permissions
	Deny  Bitfield // Explicitly denied permissions
}

// ComputeBasePermissions calculates a member's server-level permissions.
// ownerID: the guild owner's user ID
// userID: the member's user ID
// everyonePerms: the @everyone role's permissions
// rolePerms: permissions of all roles the member has
func ComputeBasePermissions(ownerID, userID int64, everyonePerms Bitfield, rolePerms []Bitfield) Bitfield {
	// Server owner always has all permissions
	if ownerID == userID {
		return All
	}

	perms := everyonePerms
	for _, rp := range rolePerms {
		perms |= rp
	}

	// Administrator grants all permissions
	if perms.Has(Administrator) {
		return All
	}

	return perms
}

// ComputeOverwrites applies channel-level permission overwrites.
// basePerms: the member's server-level permissions
// memberRoleIDs: IDs of all roles the member has
// memberID: the member's user ID
// guildID: the guild ID (= @everyone role ID)
// overwrites: channel permission overwrites
func ComputeOverwrites(basePerms Bitfield, memberRoleIDs []int64, memberID, guildID int64, overwrites []Overwrite) Bitfield {
	// Administrator bypasses all overwrites
	if basePerms.Has(Administrator) {
		return All
	}

	perms := basePerms

	// Step 1: Apply @everyone overwrite
	for _, ow := range overwrites {
		if ow.Type == 0 && ow.ID == guildID {
			perms = Bitfield((int64(perms) &^ int64(ow.Deny)) | int64(ow.Allow))
			break
		}
	}

	// Step 2: Collect and apply role overwrites
	var roleAllow, roleDeny Bitfield
	roleSet := make(map[int64]struct{}, len(memberRoleIDs))
	for _, rid := range memberRoleIDs {
		roleSet[rid] = struct{}{}
	}

	for _, ow := range overwrites {
		if ow.Type == 0 && ow.ID != guildID {
			if _, ok := roleSet[ow.ID]; ok {
				roleAllow |= ow.Allow
				roleDeny |= ow.Deny
			}
		}
	}
	perms = Bitfield((int64(perms) &^ int64(roleDeny)) | int64(roleAllow))

	// Step 3: Apply member-specific overwrite (highest priority)
	for _, ow := range overwrites {
		if ow.Type == 1 && ow.ID == memberID {
			perms = Bitfield((int64(perms) &^ int64(ow.Deny)) | int64(ow.Allow))
			break
		}
	}

	return perms
}

// ApplyImplicitDenies removes permissions that depend on gate permissions.
func ApplyImplicitDenies(perms Bitfield) Bitfield {
	// If VIEW_CHANNEL is denied, deny everything channel-related
	if !perms.Has(ViewChannel) {
		return 0
	}

	// If SEND_MESSAGES is denied, deny dependent permissions
	if !perms.Has(SendMessages) {
		perms = perms.Remove(MentionEveryone)
		perms = perms.Remove(SendTTSMessages)
		perms = perms.Remove(AttachFiles)
		perms = perms.Remove(EmbedLinks)
	}

	// If CONNECT is denied, deny voice permissions
	if !perms.Has(Connect) {
		perms = perms.Remove(Speak)
		perms = perms.Remove(MuteMembers)
		perms = perms.Remove(DeafenMembers)
		perms = perms.Remove(MoveMembers)
		perms = perms.Remove(UseVAD)
		perms = perms.Remove(PrioritySpeaker)
		perms = perms.Remove(Stream)
		perms = perms.Remove(UseSoundboard)
		perms = perms.Remove(UseEmbeddedActivities)
	}

	return perms
}
