import { useEffect } from "react";
import { collection, onSnapshot, or, query, where } from "firebase/firestore";
import { db, hasFirebaseConfig } from "@/lib/firebase";

function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/**
 * Invalidates the projects list when Firestore Project docs change (other tabs/browsers).
 */
export function useProjectsListRealtimeSync({ queryClient, currentUser, enabled }) {
  useEffect(() => {
    if (!enabled || !hasFirebaseConfig || !db || !currentUser?.uid) {
      return undefined;
    }

    const emailLower = normalizeEmail(currentUser.email);
    const coll = collection(db, "Project");
    const clauses = [where("userId", "==", currentUser.uid)];
    if (emailLower) {
      clauses.push(where("created_by", "==", emailLower));
      clauses.push(where("members", "array-contains", emailLower));
    }

    const q = query(coll, or(...clauses));
    const unsub = onSnapshot(
      q,
      () => {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
      (err) => {
        console.warn("[Realtime] projects list", err?.message || err);
      },
    );

    return () => unsub();
  }, [queryClient, currentUser?.uid, currentUser?.email, enabled]);
}
