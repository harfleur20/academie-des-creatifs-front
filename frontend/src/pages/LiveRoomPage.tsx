import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchLiveRoom, type LiveRoomInfo } from "../lib/teacherApi";

interface JitsiAPI {
  addEventListener: (event: string, listener: () => void) => void;
  dispose: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JitsiMeetExternalAPI: any;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiAPI | null>(null);

  const [room, setRoom] = useState<LiveRoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    fetchLiveRoom(Number(sessionId))
      .then(setRoom)
      .catch(() => setError("Accès refusé ou session introuvable."));
  }, [sessionId]);

  // Load Jitsi external API script once
  useEffect(() => {
    if (document.getElementById("jitsi-external-api")) {
      setScriptReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "jitsi-external-api";
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
  }, []);

  // Mount Jitsi once both script and room data are ready
  useEffect(() => {
    if (!scriptReady || !room || !containerRef.current || !user) return;
    if (apiRef.current) return; // already mounted

    apiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", {
      roomName: room.jitsi_room,
      parentNode: containerRef.current,
      userInfo: {
        displayName: user.full_name,
        email: user.email,
      },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        prejoinPageEnabled: false,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          "microphone",
          "camera",
          "desktop",
          "chat",
          "raisehand",
          "tileview",
          "fullscreen",
          "hangup",
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRAND_WATERMARK: false,
        DEFAULT_BACKGROUND: "#1a1a2e",
      },
    });

    apiRef.current?.addEventListener("readyToClose", () => {
      handleLeave();
    });

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [scriptReady, room, user]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLeave() {
    apiRef.current?.dispose();
    apiRef.current = null;
    if (user?.role === "teacher") {
      navigate("/espace/enseignant");
    } else {
      navigate("/espace/etudiant");
    }
  }

  if (error) {
    return (
      <div className="live-room live-room--error">
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="btn btn--outline">
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="live-room">
      <div className="live-room__bar">
        <div className="live-room__bar-left">
          <span className="live-room__badge">LIVE</span>
          {room ? (
            <>
              <strong className="live-room__title">{room.formation_title}</strong>
              <span className="live-room__label">{room.label}</span>
              <span className="live-room__date">{room ? formatDate(room.start_date) : ""}</span>
            </>
          ) : (
            <span className="live-room__loading">Connexion en cours…</span>
          )}
        </div>
        <button className="live-room__leave" onClick={handleLeave}>
          Quitter
        </button>
      </div>

      <div className="live-room__stage" ref={containerRef} />
    </div>
  );
}
