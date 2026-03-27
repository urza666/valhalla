/** Shared types for the voice/chat feature */

export interface VoiceParticipant {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  self_mute: boolean;
  self_deaf: boolean;
  self_video: boolean;
  self_stream: boolean;
}

export const EMOJI_LIST = [
  '😀','😂','😍','🤔','👍','👎','🎮','🏆','🔥','💪',
  '❤️','😎','🤣','😭','🙌','✅','❌','⚔️','🎯','💬',
  '😱','🍕','🎉','🤝','👀','💯','🫡','🤡',
];

export const SLASH_COMMANDS = [
  { name: 'roll', description: 'Zufallszahl (1-99)', usage: '/roll oder /roll 20' },
  { name: 'flip', description: 'Muenze werfen', usage: '/flip' },
  { name: 'shrug', description: '¯\\_(ツ)_/¯', usage: '/shrug [Text]' },
  { name: 'tableflip', description: '(╯°□°)╯︵ ┻━┻', usage: '/tableflip [Text]' },
  { name: 'unflip', description: '┬─┬ ノ( ゜-゜ノ)', usage: '/unflip [Text]' },
  { name: 'lenny', description: '( ͡° ͜ʖ ͡°)', usage: '/lenny [Text]' },
  { name: 'me', description: 'Aktion-Nachricht', usage: '/me [Aktion]' },
  { name: 'spoiler', description: 'Spoiler-Text', usage: '/spoiler [Text]' },
  { name: 'poll', description: 'Umfrage erstellen', usage: '/poll' },
];
