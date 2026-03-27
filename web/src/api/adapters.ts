/**
 * API Adapter Layer — maps between LPP-style data shapes and Valhalla's Go API types.
 * Used by ported LPP components that expect LPP-shaped data.
 */

import type { Message, DMChannel, Guild, Channel, Member } from './client';

// ─── LPP-compatible types (used by ported UI components) ────────────────────

export interface ConvSummary {
  id: string;
  title: string;
  type: 'dm' | 'group';
  unread_count: number;
  participant_names: string[];
  participants?: ConvParticipant[];
  last_message: { content: string; sender_name: string; created_at: string } | null;
}

export interface ConvParticipant {
  id: string;
  username: string;
  display_name: string;
  avatar_path?: string;
  online_status?: string;
}

export interface ChatMsg {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  is_system: boolean;
  is_pinned?: boolean;
  is_deleted?: boolean;
  is_edited?: boolean;
  reply_to?: { id: string; sender_name: string; content: string } | null;
  reactions?: { emoji: string; count: number; user_ids: string[]; users: string[] }[];
  reply_count?: number;
  created_at: string;
  attachments?: { id: string; filename: string; url: string; content_type: string | null; width: number | null; height: number | null }[];
}

export interface ChatServerSummary {
  id: string;
  name: string;
  icon: string;
  owner_id: string;
  my_role: string;
  member_count: number;
}

export interface ServerMember {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string;
  online_status: string;
  status_message: string;
  status_emoji: string;
  role: string;
  joined_at: string;
}

export interface ServerDetail {
  id: string;
  name: string;
  icon: string;
  owner_id: string;
  my_role: string;
  text_channels: { id: string; title: string }[];
  voice_channels: { id: string; name: string; max_users: number; is_locked: boolean; user_count: number; participants: VoiceParticipant[] }[];
  members: ServerMember[];
}

export interface VoiceParticipant {
  id: string;
  display_name: string;
  username: string;
  is_muted: boolean;
  is_deafened: boolean;
  avatar_path?: string;
}

// Channel types in Valhalla Go API
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_VOICE = 2;
export const CHANNEL_TYPE_CATEGORY = 4;

// ─── Adapter functions ──────────────────────────────────────────────────────

/** Convert a Valhalla DMChannel to LPP ConvSummary */
export function dmToConversation(dm: DMChannel): ConvSummary {
  const name = dm.recipient.display_name || dm.recipient.username;
  return {
    id: dm.id,
    title: name,
    type: 'dm',
    unread_count: 0,
    participant_names: [name],
    participants: [{
      id: dm.recipient.id,
      username: dm.recipient.username,
      display_name: dm.recipient.display_name || dm.recipient.username,
      avatar_path: dm.recipient.avatar || undefined,
    }],
    last_message: null,
  };
}

/** Convert a Valhalla Message to LPP ChatMsg */
export function messageToChat(msg: Message): ChatMsg {
  return {
    id: msg.id,
    sender_id: msg.author.id,
    sender_name: msg.author.display_name || msg.author.username,
    sender_avatar: msg.author.avatar || undefined,
    content: msg.content,
    is_system: msg.type !== 0 && msg.type !== 19,
    is_pinned: msg.pinned,
    is_deleted: false,
    is_edited: !!msg.edited_timestamp,
    reply_to: msg.message_reference ? { id: msg.message_reference, sender_name: '', content: '' } : null,
    reactions: msg.reactions?.map(r => ({
      emoji: r.emoji,
      count: r.count,
      user_ids: [],
      users: [],
    })) || [],
    reply_count: 0,
    created_at: msg.timestamp,
    attachments: msg.attachments?.map(a => ({
      id: a.id,
      filename: a.filename,
      url: a.url,
      content_type: a.content_type,
      width: a.width,
      height: a.height,
    })),
  };
}

/** Convert a Valhalla Guild to LPP ChatServerSummary */
export function guildToServer(guild: Guild): ChatServerSummary {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon || '',
    owner_id: guild.owner_id,
    my_role: 'member',
    member_count: guild.member_count || 0,
  };
}

/** Build LPP ServerDetail from Valhalla guild + channels + members */
export function buildServerDetail(
  guild: Guild,
  channels: Channel[],
  members: Member[],
  currentUserId?: string,
): ServerDetail {
  const textChannels = channels
    .filter(c => c.type === CHANNEL_TYPE_TEXT)
    .sort((a, b) => a.position - b.position)
    .map(c => ({ id: c.id, title: c.name || 'general' }));

  const voiceChannels = channels
    .filter(c => c.type === CHANNEL_TYPE_VOICE)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      id: c.id,
      name: c.name || 'Voice',
      max_users: c.user_limit || 0,
      is_locked: false,
      user_count: 0,
      participants: [] as VoiceParticipant[],
    }));

  const serverMembers: ServerMember[] = members.map(m => ({
    id: m.user_id,
    username: m.user?.username || '',
    display_name: m.user?.display_name || m.user?.username || '',
    avatar_path: m.user?.avatar || '',
    online_status: 'offline',
    status_message: '',
    status_emoji: '',
    role: m.user_id === guild.owner_id ? 'owner' : 'member',
    joined_at: m.joined_at,
  }));

  let myRole = 'member';
  if (currentUserId === guild.owner_id) myRole = 'owner';

  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon || '',
    owner_id: guild.owner_id,
    my_role: myRole,
    text_channels: textChannels,
    voice_channels: voiceChannels,
    members: serverMembers,
  };
}

/** Emoji list for picker */
export const EMOJI_LIST = [
  '\u{1F600}', '\u{1F602}', '\u{1F60D}', '\u{1F914}', '\u{1F44D}', '\u{1F44E}', '\u{1F3AE}', '\u{1F3C6}', '\u{1F525}', '\u{1F4AA}',
  '\u{2764}\u{FE0F}', '\u{1F60E}', '\u{1F923}', '\u{1F62D}', '\u{1F64C}', '\u{2705}', '\u{274C}', '\u{2694}\u{FE0F}', '\u{1F3AF}', '\u{1F4AC}',
  '\u{1F631}', '\u{1F355}', '\u{1F389}', '\u{1F91D}',
];

/** Slash commands (client-side only) */
export const SLASH_COMMANDS = [
  { command: '/roll', description: 'Roll a number between 1 and 100', icon: '\u{1F3B2}' },
  { command: '/flip', description: 'Flip a coin', icon: '\u{1FA99}' },
  { command: '/shrug', description: 'Append a shrug', icon: '\u{1F937}' },
  { command: '/tableflip', description: 'Flip the table', icon: '\u{1F4A2}' },
];
