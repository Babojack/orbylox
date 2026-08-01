import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, X, Minus, Maximize2, Minimize2, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";

import { JITSI_DOMAIN, projectRoomName, ensureMediaPermission, allowMediaInFrame } from '@/lib/meetingRoom';

const SCRIPT_URL = `https://${JITSI_DOMAIN}/external_api.js`;

let scriptPromise = null;
function loadJitsiScript() {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Jitsi konnte nicht geladen werden.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function VideoCall({ isOpen, onClose, currentUser, projectId, projectName }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState(null);
  const [permissionHint, setPermissionHint] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const apiRef = useRef(null);

  const room = projectRoomName(projectId, projectName);
  const directLink = `https://${JITSI_DOMAIN}/${room}`;

  const disposeCall = useCallback(() => {
    try {
      apiRef.current?.dispose();
    } catch {
      /* already gone */
    }
    apiRef.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;

    setError(null);
    setIsLoading(true);

    // Grant camera/mic on our own origin first — a cross-origin frame cannot ask.
    Promise.resolve()
      .then(async () => {
        const permission = await ensureMediaPermission();
        if (!cancelled && !permission.ok) setPermissionHint(permission.error);
      })
      .then(loadJitsiScript)
      .then(() => {
        if (cancelled || !frameRef.current) return;
        disposeCall();

        const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: room,
          parentNode: frameRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName: currentUser?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Gast',
            email: currentUser?.email || undefined,
          },
          configOverwrite: {
            prejoinPageEnabled: true,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
            MOBILE_APP_PROMO: false,
            DEFAULT_BACKGROUND: '#0f172a',
          },
        });

        apiRef.current = api;
        allowMediaInFrame(api);
        api.addEventListener('videoConferenceLeft', () => onClose?.());
        api.addEventListener('readyToClose', () => onClose?.());
        api.addEventListener('videoConferenceJoined', () => setIsLoading(false));
        // Some builds never fire the join event when the prejoin screen shows.
        setTimeout(() => !cancelled && setIsLoading(false), 2500);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Videokonferenz konnte nicht gestartet werden.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      disposeCall();
    };
  }, [isOpen, room, currentUser, onClose, disposeCall]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const handleClose = () => {
    disposeCall();
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed z-[100] ${
          isMinimized
            ? 'bottom-4 right-4 w-72 h-44'
            : 'inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6'
        }`}
      >
        <div
          ref={containerRef}
          className={`bg-slate-900 overflow-hidden flex flex-col shadow-2xl ${
            isMinimized
              ? 'w-full h-full rounded-xl border border-slate-700'
              : 'w-full h-full sm:rounded-2xl sm:max-w-6xl sm:h-[85vh]'
          }`}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Video className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-sm text-slate-200 font-medium truncate">
                {projectName ? `Videokonferenz · ${projectName}` : 'Videokonferenz'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={directLink}
                target="_blank"
                rel="noopener noreferrer"
                title="In neuem Tab öffnen"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized((v) => !v)}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                title={isMinimized ? 'Vergrößern' : 'Verkleinern'}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              </Button>
              {!isMinimized && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Vollbild"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-red-600"
                title="Konferenz verlassen"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {permissionHint && !isMinimized && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 shrink-0">
              {permissionHint}
            </div>
          )}

          {/* Meeting */}
          <div className="relative flex-1 min-h-0 bg-slate-900">
            <div ref={frameRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />

            {isLoading && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 pointer-events-none">
                <div className="w-8 h-8 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-sm">Konferenz wird geladen…</span>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
                <p className="text-slate-200 font-medium">{error}</p>
                <p className="text-slate-400 text-sm max-w-md">
                  Möglicherweise blockiert ein Werbeblocker oder das Netzwerk {JITSI_DOMAIN}. Du kannst den Raum
                  direkt im Browser öffnen:
                </p>
                <a
                  href={directLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500"
                >
                  <ExternalLink className="w-4 h-4" />
                  Konferenz im neuen Tab starten
                </a>
              </div>
            )}
          </div>

          {!isMinimized && (
            <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-500 shrink-0">
              Alle Projektmitglieder erreichen denselben Raum über diesen Knopf. Link zum Teilen: {directLink}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
