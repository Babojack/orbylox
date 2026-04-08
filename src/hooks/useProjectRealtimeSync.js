import { useEffect, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db, hasFirebaseConfig } from "@/lib/firebase";
import { toast } from "@/components/ui/use-toast";

const SCOPED_COLLECTIONS = [
  "Post",
  "Message",
  "Task",
  "Document",
  "FileRecord",
  "Folder",
  "CustomIntegration",
  "CanvasItem",
  "CanvasConnection",
  "ProjectBackup",
  "RestoreRequest",
  "StartupStep",
  "StartupJourney",
  "Event",
  "ProductIdea",
  "PostComment",
  "TaskComment",
  "Subtask",
];

const TOAST_SILENT = new Set(["ProjectBackup", "RestoreRequest"]);

function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

function isActorSelf(data, user) {
  if (!user || !data) return false;
  const email = normalizeEmail(user.email);
  const uid = user.uid || null;
  if (uid && data.userId === uid) return true;
  if (email && normalizeEmail(data.created_by) === email) return true;
  if (email && normalizeEmail(data.author_email) === email) return true;
  return false;
}

function projectNonTimerSignature(data) {
  if (!data || typeof data !== "object") return "";
  const {
    tracked_time_ms: _t,
    last_worked_at: _l,
    ...rest
  } = data;
  try {
    return JSON.stringify(rest);
  } catch {
    return String(Math.random());
  }
}

function invalidateForEntity(queryClient, projectId, entityName) {
  switch (entityName) {
    case "Post":
      queryClient.invalidateQueries({ queryKey: ["posts", projectId] });
      break;
    case "PostComment":
      queryClient.invalidateQueries({ queryKey: ["postComments", projectId] });
      break;
    case "Message":
      queryClient.invalidateQueries({ queryKey: ["messages", projectId] });
      break;
    case "Task":
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["mindmapNodes", projectId] });
      break;
    case "TaskComment":
      queryClient.invalidateQueries({ queryKey: ["allComments", projectId] });
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "taskComments",
      });
      break;
    case "Subtask":
      queryClient.invalidateQueries({ queryKey: ["allSubtasks", projectId] });
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "subtasks",
      });
      break;
    case "Document":
      queryClient.invalidateQueries({ queryKey: ["docs", projectId] });
      break;
    case "FileRecord":
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === "files" && q.queryKey[1] === projectId,
      });
      break;
    case "Folder":
      queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === "files" && q.queryKey[1] === projectId,
      });
      break;
    case "CustomIntegration":
      queryClient.invalidateQueries({
        queryKey: ["customIntegrations", projectId],
      });
      break;
    case "CanvasItem":
      queryClient.invalidateQueries({ queryKey: ["mindmapNodes", projectId] });
      break;
    case "CanvasConnection":
      queryClient.invalidateQueries({
        queryKey: ["mindmapConnections", projectId],
      });
      break;
    case "Event":
      queryClient.invalidateQueries({ queryKey: ["events", projectId] });
      break;
    case "StartupStep":
      queryClient.invalidateQueries({ queryKey: ["startupSteps", projectId] });
      break;
    case "StartupJourney":
      queryClient.invalidateQueries({
        queryKey: ["startupJourneys", projectId],
      });
      break;
    case "ProductIdea":
      queryClient.invalidateQueries({ queryKey: ["productIdeas", projectId] });
      break;
    case "ProjectBackup":
      queryClient.invalidateQueries({ queryKey: ["backups", projectId] });
      break;
    case "RestoreRequest":
      queryClient.invalidateQueries({
        queryKey: ["restoreRequests", projectId],
      });
      break;
    default:
      break;
  }
}

function toastTranslationKey(entityName) {
  switch (entityName) {
    case "Post":
      return "liveNotifyFeed";
    case "PostComment":
      return "liveNotifyComment";
    case "Message":
      return "liveNotifyChat";
    case "Task":
    case "Subtask":
    case "TaskComment":
      return "liveNotifyBoard";
    case "Document":
      return "liveNotifyDocs";
    case "FileRecord":
    case "Folder":
      return "liveNotifyFiles";
    case "CanvasItem":
    case "CanvasConnection":
      return "liveNotifyCanvas";
    case "CustomIntegration":
      return "liveNotifyTools";
    case "Event":
      return "liveNotifyCalendar";
    case "StartupStep":
    case "StartupJourney":
      return "liveNotifyStartup";
    case "ProductIdea":
      return "liveNotifyValidation";
    default:
      return "liveNotifyGeneric";
  }
}

/**
 * Keeps TanStack Query in sync with Firestore for the current project and shows
 * toasts for changes made by other collaborators (Firebase auth with uid only).
 */
export function useProjectRealtimeSync({
  queryClient,
  projectId,
  currentUser,
  enabled,
  t,
}) {
  const projectDataRef = useRef(null);
  const toastTimerRef = useRef(null);
  const pendingToastRef = useRef(null);
  const suppressToastsUntilRef = useRef(0);
  const timerOnlyDebounceRef = useRef(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    projectDataRef.current = null;
    suppressToastsUntilRef.current = Date.now() + 900;
  }, [projectId]);

  useEffect(() => {
    if (!enabled || !hasFirebaseConfig || !db || !projectId || !currentUser?.uid) {
      return undefined;
    }

    const unsubs = [];

    const scheduleToast = (entityName) => {
      if (TOAST_SILENT.has(entityName)) return;
      const key = toastTranslationKey(entityName);
      pendingToastRef.current = key;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        toastTimerRef.current = null;
        const k = pendingToastRef.current;
        pendingToastRef.current = null;
        if (!k || Date.now() < suppressToastsUntilRef.current) return;
        const tr = tRef.current;
        toast({
          title: tr("liveNotifyTitle"),
          description: tr(k),
        });
      }, 450);
    };

    const attachEntity = (entityName) => {
      const coll = collection(db, entityName);
      const qy = query(coll, where("project_id", "==", projectId));
      const unsub = onSnapshot(
        qy,
        (snap) => {
          if (snap.metadata.fromCache) return;
          const changes = snap.docChanges();
          if (!changes.length) return;

          const remote = changes.filter((c) => !c.doc.metadata.hasPendingWrites);
          if (!remote.length) return;

          invalidateForEntity(queryClient, projectId, entityName);

          const fromOthers = remote.filter(
            (c) => !isActorSelf(c.doc.data(), currentUser),
          );
          if (!fromOthers.length) return;
          scheduleToast(entityName);
        },
        (err) => {
          console.warn("[Realtime]", entityName, err?.message || err);
        },
      );
      unsubs.push(unsub);
    };

    SCOPED_COLLECTIONS.forEach(attachEntity);

    const projectRef = doc(db, "Project", projectId);
    const unsubProject = onSnapshot(
      projectRef,
      (snap) => {
        if (snap.metadata.fromCache || !snap.exists()) return;
        const data = snap.data();
        const prev = projectDataRef.current;
        projectDataRef.current = data;

        const restChanged =
          projectNonTimerSignature(prev) !== projectNonTimerSignature(data);
        const timerTick =
          Number(prev?.tracked_time_ms) !== Number(data?.tracked_time_ms);

        if (restChanged) {
          queryClient.invalidateQueries({ queryKey: ["project", projectId] });
          return;
        }

        if (timerTick) {
          if (timerOnlyDebounceRef.current) {
            clearTimeout(timerOnlyDebounceRef.current);
          }
          timerOnlyDebounceRef.current = setTimeout(() => {
            timerOnlyDebounceRef.current = null;
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
          }, 2000);
        }
      },
      (err) => {
        console.warn("[Realtime] Project", err?.message || err);
      },
    );
    unsubs.push(unsubProject);

    return () => {
      unsubs.forEach((u) => u());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (timerOnlyDebounceRef.current) {
        clearTimeout(timerOnlyDebounceRef.current);
      }
    };
  }, [queryClient, projectId, currentUser, enabled]);
}
