import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Video, AlertTriangle, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  JITSI_DOMAIN,
  projectRoomName,
  roomUrl,
  apiRoomName,
  loadJitsiApi,
  ensureMediaPermission,
  allowMediaInFrame,
  mediaPermissionState,
} from '@/lib/meetingRoom';

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
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
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
        if (cancelled) return;
        if (permission.ok) {
          setPermissionHint(null);
          setPermissionBlocked(false);
        } else {
          setPermissionHint(permission.error);
          setPermissionBlocked(!!permission.blocked);
        }
      })
      .then(loadJitsiApi)
      .then(() => {
        if (cancelled || !frameRef.current) return;
        dispose();

        const jitsi = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: apiRoomName(room),
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

  /** Second attempt — works while the browser still shows its prompt. */
  const requestPermission = async () => {
    setRequestingPermission(true);
    const permission = await ensureMediaPermission();
    if (permission.ok) {
      setPermissionHint(null);
      setPermissionBlocked(false);
      window.location.reload();
      return;
    }
    const state = await mediaPermissionState();
    setPermissionHint(permission.error);
    setPermissionBlocked(state === 'denied' || !!permission.blocked);
    setRequestingPermission(false);
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-900 flex-1">
            <p className="font-medium">Kamera und Mikrofon sind noch nicht freigegeben</p>
            <p className="mt-0.5 text-amber-800">{permissionHint}</p>
            {permissionBlocked && (
              <details className="mt-2">
                <summary className="cursor-pointer text-amber-900 font-medium">
                  Schritt für Schritt freigeben
                </summary>
                <p className="mt-1.5 text-amber-800">
                  Am schnellsten geht es über die Chrome-Einstellungen — Adresse kopieren und in einem neuen Tab
                  einfügen (anklickbar sind chrome://-Adressen nicht):
                </p>
                <div className="flex items-center gap-2 mt-1.5 mb-2">
                  <code className="bg-white/70 border border-amber-200 rounded px-2 py-1 text-[12px] text-amber-900">
                    chrome://settings/content/camera
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300"
                    onClick={() => navigator.clipboard?.writeText('chrome://settings/content/camera')}
                  >
                    Kopieren
                  </Button>
                </div>
                <p className="text-amber-800">Dort orbylox.de auf „Zulassen“ stellen — dasselbe unter …/content/microphone.</p>
                <p className="mt-2 font-medium text-amber-900">Oder direkt in der Adressleiste:</p>
                <ol className="list-decimal ml-5 mt-1.5 space-y-1 text-amber-800">
                  <li>Oben links in der Adressleiste auf das Symbol direkt vor „orbylox.de“ klicken (Regler-Symbol).</li>
                  <li>Bei „Kamera“ und „Mikrofon“ jeweils auf „Zulassen“ stellen.</li>
                  <li>Seite neu laden (Cmd+R).</li>
                </ol>
                <p className="mt-2 text-amber-800">
                  Alternativ in Chrome: Einstellungen → Datenschutz und Sicherheit → Website-Einstellungen → Kamera
                  bzw. Mikrofon → orbylox.de auf „Zulassen“.
                </p>
              </details>
            )}
          </div>
          <Button
            size="sm"
            onClick={requestPermission}
            disabled={requestingPermission}
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          >
            {requestingPermission ? 'Wird geprüft…' : 'Zugriff erlauben'}
          </Button>
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
