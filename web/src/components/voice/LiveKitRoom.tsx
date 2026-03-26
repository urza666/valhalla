import { useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  Participant,
  VideoPresets,
} from 'livekit-client';
import { useVoiceStore } from '../../stores/voice';

// LiveKitRoom handles the actual WebRTC connection via LiveKit.
export function LiveKitRoom() {
  const {
    connected, lkToken, lkEndpoint,
    selfMute, outputVolume,
    audioInputDevice, videoInputDevice,
    setLkRoom,
  } = useVoiceStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [screenShareTrack, setScreenShareTrack] = useState<RemoteTrackPublication | null>(null);

  // Connect to LiveKit room when token is available
  useEffect(() => {
    if (!connected || !lkToken || !lkEndpoint) return;

    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
        deviceId: videoInputDevice || undefined,
      },
      audioCaptureDefaults: {
        deviceId: audioInputDevice !== 'default' ? audioInputDevice : undefined,
      },
    });

    const connectRoom = async () => {
      try {
        await newRoom.connect(lkEndpoint, lkToken);
        setRoom(newRoom);
        setLkRoom(newRoom); // Store room in voice store for direct access
        updateParticipants(newRoom);
      } catch (err) {
        console.error('[LiveKit] Connection failed:', err);
      }
    };

    connectRoom();

    return () => {
      newRoom.disconnect();
      setRoom(null);
      setLkRoom(null);
      setParticipants([]);
    };
  }, [connected, lkToken, lkEndpoint]);

  // Subscribe to room events
  useEffect(() => {
    if (!room) return;

    const onParticipantChange = () => updateParticipants(room);

    room.on(RoomEvent.ParticipantConnected, onParticipantChange);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantChange);
    room.on(RoomEvent.TrackSubscribed, onParticipantChange);
    room.on(RoomEvent.TrackUnsubscribed, onParticipantChange);
    room.on(RoomEvent.TrackMuted, onParticipantChange);
    room.on(RoomEvent.TrackUnmuted, onParticipantChange);
    room.on(RoomEvent.ActiveSpeakersChanged, onParticipantChange);
    room.on(RoomEvent.LocalTrackPublished, onParticipantChange);
    room.on(RoomEvent.LocalTrackUnpublished, onParticipantChange);

    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantChange);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantChange);
      room.off(RoomEvent.TrackSubscribed, onParticipantChange);
      room.off(RoomEvent.TrackUnsubscribed, onParticipantChange);
      room.off(RoomEvent.TrackMuted, onParticipantChange);
      room.off(RoomEvent.TrackUnmuted, onParticipantChange);
      room.off(RoomEvent.ActiveSpeakersChanged, onParticipantChange);
      room.off(RoomEvent.LocalTrackPublished, onParticipantChange);
      room.off(RoomEvent.LocalTrackUnpublished, onParticipantChange);
    };
  }, [room]);

  // Sync mute state to LiveKit
  useEffect(() => {
    if (!room?.localParticipant) return;
    room.localParticipant.setMicrophoneEnabled(!selfMute);
  }, [room, selfMute]);

  // Sync output volume to all remote audio elements
  useEffect(() => {
    if (!room) return;
    const vol = Math.max(0, Math.min(2, outputVolume / 100));
    // Find all audio elements in the LiveKit room and set volume
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          const elements = pub.track.attachedElements;
          if (elements) {
            for (const el of elements) {
              if (el instanceof HTMLMediaElement) {
                el.volume = vol;
              }
            }
          }
        }
      });
    });
  }, [room, outputVolume, participants]);

  // Camera and screen share are controlled directly via voice store toggleVideo/toggleStream
  // which call room.localParticipant methods in the user-gesture context (click handler)

  // Update participants list
  const updateParticipants = (r: Room) => {
    const all: Participant[] = [r.localParticipant, ...Array.from(r.remoteParticipants.values())];
    setParticipants([...all]);

    // Check for screen share
    let foundScreen: RemoteTrackPublication | null = null;
    r.remoteParticipants.forEach((p) => {
      p.trackPublications.forEach((pub) => {
        if (pub.source === Track.Source.ScreenShare && pub.track) {
          foundScreen = pub as RemoteTrackPublication;
        }
      });
    });
    setScreenShareTrack(foundScreen);
  };

  if (!connected || !room) return null;

  const hasVideo = participants.some((p) =>
    Array.from(p.trackPublications.values()).some(
      (pub) => (pub.source === Track.Source.Camera || pub.source === Track.Source.ScreenShare) && pub.track
    )
  );

  // Show at minimum a connected indicator with participant list, video when available
  return (
    <div className="lk-room">
      {/* Screen share takes priority view */}
      {screenShareTrack && (
        <div className="lk-screenshare">
          <VideoTrackView publication={screenShareTrack} />
        </div>
      )}

      {/* Video grid - show when video/screen active */}
      {hasVideo && (
        <div className={`lk-grid ${screenShareTrack ? 'with-screenshare' : ''}`}>
          {participants.map((p) => (
            <ParticipantTile key={p.identity} participant={p} />
          ))}
        </div>
      )}

      {/* Audio-only participant list when no video */}
      {!hasVideo && participants.length > 0 && (
        <div className="lk-audio-grid">
          {participants.map((p) => (
            <div key={p.identity} className={`lk-audio-tile ${p.isSpeaking ? 'speaking' : ''}`}>
              <div className="lk-avatar">
                {(p.name || p.identity || '?')[0].toUpperCase()}
              </div>
              <span className="lk-audio-name">
                {p.name || p.identity}
                {p.isMicrophoneEnabled === false && ' 🔇'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ParticipantTile shows a single participant's video or avatar
function ParticipantTile({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = participant.isSpeaking;
  const isMuted = participant.isMicrophoneEnabled === false;

  // Find camera track
  const cameraTrack = Array.from(participant.trackPublications.values()).find(
    (pub) => pub.source === Track.Source.Camera && pub.track
  );

  useEffect(() => {
    if (!cameraTrack?.track || !videoRef.current) return;
    cameraTrack.track.attach(videoRef.current);
    return () => {
      cameraTrack.track?.detach(videoRef.current!);
    };
  }, [cameraTrack]);

  return (
    <div className={`lk-tile ${isSpeaking ? 'speaking' : ''}`}>
      {cameraTrack?.track ? (
        <video ref={videoRef} autoPlay playsInline className="lk-video" />
      ) : (
        <div className="lk-avatar">
          {(participant.name || participant.identity || '?')[0].toUpperCase()}
        </div>
      )}
      <div className="lk-tile-info">
        <span className="lk-tile-name">
          {participant.name || participant.identity}
          {isMuted && ' 🔇'}
        </span>
      </div>
    </div>
  );
}

// VideoTrackView attaches a remote track to a video element
function VideoTrackView({ publication }: { publication: RemoteTrackPublication }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!publication.track || !videoRef.current) return;
    publication.track.attach(videoRef.current);
    return () => {
      publication.track?.detach(videoRef.current!);
    };
  }, [publication]);

  return <video ref={videoRef} autoPlay playsInline className="lk-video screenshare" />;
}
