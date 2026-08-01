import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Video, AlertTriangle, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JITSI_DOMAIN, projectRoomName, roomUrl, ensureMediaPermission, allowMediaInFrame } from '@/lib/meetingRoom';

let scriptPromise = null;
function loadJitsiScript() {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error(`${JITSI_DOMAIN} konnte nicht geladen werden.`));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function Meeting() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project');
  const roomParam = params.get('room');

  const frameRef = useRef(null);
  const apiRef = useRef(null);
  const containerRef = useRef(null);

  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [permissionHint, setPermissionHint] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const all = await api.entities.Project.list();
      return all.find((p) => p.id === projectId) || null;
    },
    enabled: !!projectId,
  });

  const room = roomParam || projectRoomName(projectId, project?.name || '');
  const link = roomUrl(room);

  const dispose = useCallback(() => {
    try {
      apiRef.current?.dispose();
    } catch {
      /* already gone */
    }
    apiRef.current = null;
  }, []);

  useEffect(() => {
    // Wait for the project name so the room matches the one used elsewhere.
    if (projectId && !roomParam && !project) return undefined;

    let cancelled = false;
    setError(null);
    setIsLoading(true);

    // Ask for camera/mic on our own origin first, otherwise the embedded frame
    // shows "Sie müssen den Zugriff erlauben" with no way to grant it.
    Promise.resolve()
      .then(async () => {
        const permission = await ensureMediaPermission();
        if (!cancelled && !permission.ok) setPermissionHint(permission.error);
      })
      .then(loadJitsiScript)
      .then(() => {
        if (cancelled || !frameRef.current) return;
        dispose();

        const jitsi = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: room,
          parentNode: frameRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName:
              currentUser?.full_name ||
              currentUser?.displayName ||
              currentUser?.email?.split('@')[0] ||
              'Gast',
            email: currentUser?.email || undefined,
          },
          configOverwrite: {
            prejoinPageEnabled: true,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
            MOBILE_APP_PROMO: false,
          },
        });

        apiRef.current = jitsi;
        allowMediaInFrame(jitsi);
        jitsi.addEventListener('videoConferenceJoined', () => setIsLoading(false));
        setTimeout(() => !cancelled && setIsLoading(false), 2500);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Konferenz konnte nicht gestartet werden.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      dispose();
    };
  }, [room, projectId, roomParam, project, currentUser, dispose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Video className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Meeting</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
            {roomParam ? 'Termin-Konferenz' : project?.name || 'Projekt-Konferenz'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {roomParam
              ? 'Eigener Raum für diesen Termin.'
              : 'Fester Raum des Projekts — alle Mitglieder landen hier.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Kopiert' : 'Link teilen'}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-2">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            Vollbild
          </Button>
        </div>
      </div>

      {permissionHint && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Kamera und Mikrofon sind noch nicht freigegeben</p>
            <p className="mt-0.5">{permissionHint}</p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 h-[calc(100dvh-260px)] min-h-[420px]"
      >
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
              Vermutlich blockiert ein Werbeblocker oder das Netzwerk {JITSI_DOMAIN}. Deaktiviere den Blocker für
              orbylox.de und lade die Seite neu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
