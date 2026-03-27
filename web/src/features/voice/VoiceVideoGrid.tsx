/**
 * VoiceVideoGrid — LPP-identical participant grid with speaking indicators.
 * Uses Valhalla voice store for LiveKit room state.
 */
import { useState, useEffect } from 'react';
import { useVoiceStore } from '../../stores/voice';
import { useAuthStore } from '../../stores/auth';
import { UserAvatar } from '../../components/ui/UserAvatar';

export function VoiceVideoGrid() {
  const { connected, lkRoom, selfMute, selfDeaf, selfVideo } = useVoiceStore();
  const user = useAuthStore((s) => s.user);
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});

  // Track speaking via LiveKit events
  useEffect(() => {
    if (!lkRoom) return;
    const handleSpeakers = () => {
      const map: Record<string, boolean> = {};
      if (lkRoom.localParticipant?.isSpeaking) {
        map[lkRoom.localParticipant.identity] = true;
      }
      for (const [, p] of lkRoom.remoteParticipants) {
        if (p.isSpeaking) map[p.identity] = true;
      }
      setSpeakingMap(map);
    };
    const interval = setInterval(handleSpeakers, 200);
    return () => clearInterval(interval);
  }, [lkRoom]);

  if (!connected || !lkRoom) return null;

  const remotes = Array.from(lkRoom.remoteParticipants.values());
  const totalCount = remotes.length + 1;
  const cols = totalCount <= 2 ? totalCount : totalCount <= 4 ? 2 : totalCount <= 9 ? 3 : 4;

  return (
    <div style={{
      padding: 16,
      background: 'var(--bg-primary, #0e1218)',
      borderBottom: '1px solid var(--color-voice-border, rgba(255,255,255,0.06))',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        fontSize: 13, color: 'var(--color-voice-online, #3ba55d)', fontWeight: 600,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
        </svg>
        Sprachverbunden · {totalCount} Teilnehmer
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
      }}>
        {/* Local */}
        <ParticipantTile
          name={user?.display_name || user?.username || 'Du'}
          avatar={user?.avatar}
          isMuted={selfMute}
          isDeafened={selfDeaf}
          hasVideo={selfVideo}
          isSelf
          speaking={speakingMap[lkRoom.localParticipant?.identity || ''] || false}
        />

        {/* Remotes */}
        {remotes.map((p: any) => (
          <ParticipantTile
            key={p.sid}
            name={p.name || p.identity}
            isMuted={!p.isMicrophoneEnabled}
            isDeafened={false}
            hasVideo={p.isCameraEnabled || false}
            speaking={speakingMap[p.identity] || false}
          />
        ))}
      </div>
    </div>
  );
}

function ParticipantTile({ name, avatar, isMuted, isDeafened, hasVideo, isSelf, speaking }: {
  name: string; avatar?: string | null; isMuted: boolean; isDeafened: boolean;
  hasVideo: boolean; isSelf?: boolean; speaking: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 6, padding: 12,
      background: 'var(--color-voice-surface, #1e1f22)',
      borderRadius: 8,
      border: speaking ? '2px solid var(--color-voice-online, #3ba55d)' : '2px solid transparent',
      transition: 'border-color 0.2s',
      position: 'relative',
    }}>
      <UserAvatar
        user={{ username: name, display_name: name, avatar: avatar || null }}
        size={48}
        speaking={speaking}
      />
      <div style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', textAlign: 'center',
      }}>
        {name}{isSelf ? ' (Du)' : ''}
      </div>

      {/* Status badges */}
      <div style={{ display: 'flex', gap: 3, position: 'absolute', bottom: 4, right: 4 }}>
        {isMuted && <Badge color="#ed4245" icon="🔇" title="Stumm" />}
        {isDeafened && <Badge color="#ed4245" icon="🔈" title="Taub" />}
        {hasVideo && <Badge color="#3ba55d" icon="📹" title="Kamera" />}
      </div>
    </div>
  );
}

function Badge({ color, icon, title }: { color: string; icon: string; title: string }) {
  return (
    <span title={title} style={{
      fontSize: 10, background: `${color}33`, borderRadius: 4,
      padding: '1px 4px', color,
    }}>
      {icon}
    </span>
  );
}
