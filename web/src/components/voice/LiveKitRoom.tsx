import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalParticipant,
  Participant,
  VideoPresets,
  createLocalTracks,
} from 'livekit-client';
import { useVoiceStore } from '../../stores/voice';

// LiveKitRoom handles the actual WebRTC connection via LiveKit.
export function LiveKitRoom() {
  const { connected, lkToken, lkEndpoint, selfMute, selfDeaf, channelId } = useVoiceStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [screenShareTrack, setScreenShareTrack] = useState<RemoteTrackPublication | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);

  // Connect to LiveKit room when token is available
  useEffect(() => {
    if (!connected || !lkToken || !lkEndpoint) return;

    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });

    const connectRoom = async () => {
      try {
        await newRoom.connect(lkEndpoint, lkToken);
        setRoom(newRoom);
        updateParticipants(newRoom);
      } catch (err) {
        console.error('[LiveKit] Connection failed:', err);
      }
    };

    connectRoom();

    return () => {
      newRoom.disconnect();
      setRoom(null);
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

    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantChange);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantChange);
      room.off(RoomEvent.TrackSubscribed, onParticipantChange);
      room.off(RoomEvent.TrackUnsubscribed, onParticipantChange);
      room.off(RoomEvent.TrackMuted, onParticipantChange);
      room.off(RoomEvent.TrackUnmuted, onParticipantChange);
      room.off(RoomEvent.ActiveSpeakersChanged, onParticipantChange);
    };
  }, [room]);

  // Sync mute state to LiveKit
  useEffect(() => {
    if (!room?.localParticipant) return;
    room.localParticipant.setMicrophoneEnabled(!selfMute);
  }, [room, selfMute]);

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

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (!room) return;
    if (isCameraOn) {
      room.localParticipant.setCameraEnabled(false);
      setIsCameraOn(false);
    } else {
      room.localParticipant.setCameraEnabled(true);
      setIsCameraOn(true);
    }
  }, [room, isCameraOn]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (!room) return;
    if (isScreenSharing) {
      room.localParticipant.setScreenShareEnabled(false);
      setIsScreenSharing(false);
    } else {
      room.localParticipant.setScreenShareEnabled(true);
      setIsScreenSharing(true);
    }
  }, [room, isScreenSharing]);

  if (!connected || !room) return null;

  const hasVideo = participants.some((p) =>
    Array.from(p.trackPublications.values()).some(
      (pub) => (pub.source === Track.Source.Camera || pub.source === Track.Source.ScreenShare) && pub.track
    )
  );

  // Only show video panel if someone has video/screenshare active
  if (!hasVideo) return null;

  return (
    <div className="lk-room">
      {/* Screen share takes priority view */}
      {screenShareTrack && (
        <div className="lk-screenshare">
          <VideoTrackView publication={screenShareTrack} />
        </div>
      )}

      {/* Video grid */}
      <div className={`lk-grid ${screenShareTrack ? 'with-screenshare' : ''}`}>
        {participants.map((p) => (
          <ParticipantTile key={p.identity} participant={p} />
        ))}
      </div>

      {/* Media controls */}
      <div className="lk-controls">
        <button className={`lk-btn ${isCameraOn ? 'active' : ''}`} onClick={toggleCamera}>
          {isCameraOn ? '📷' : '📷'}
          <span>{isCameraOn ? 'Camera Off' : 'Camera On'}</span>
        </button>
        <button className={`lk-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare}>
          🖥️
          <span>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>
      </div>
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
