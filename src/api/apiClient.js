// Local API: uses Firestore when Firebase is configured, else localStorage. Demo users: in-memory only.
import {
  auth as firebaseAuth,
  db as firestoreDb,
  hasFirebaseConfig,
  onAuthStateChanged,
  firebaseSignOut,
  mapFirebaseUser,
} from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  or,
  increment,
} from "firebase/firestore";

const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));
const UPLOAD_TIMEOUT_MS = 30000;
const MAX_INLINE_IMAGE_BYTES = 850000;

const STORAGE_KEY_PREFIX = "orbylox_";
const DEMO_EMAIL = "demo@orbylox.local";
const DEFAULT_ADMIN_EMAILS = ["gudfransen@gmail.com", "jey.afandiyev@gmail.com"];
const USER_PLANS_KEY = STORAGE_KEY_PREFIX + "user_plans";

const demoMemoryStore = {};

function getAdminEmails() {
  const fromEnv = (import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const merged = new Set([...DEFAULT_ADMIN_EMAILS, ...fromEnv]);
  return [...merged];
}

function isAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(String(email).toLowerCase());
}

function readUserPlansMap() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USER_PLANS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeUserPlansMap(map) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_PLANS_KEY, JSON.stringify(map || {}));
}

function isDemoUser() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "user");
    if (!raw) return false;
    const user = JSON.parse(raw);
    return user && user.email === DEMO_EMAIL;
  } catch {
    return false;
  }
}

/** Returns { demo: true } for demo user, or current user { uid, email } for storage, or null. */
async function getStorageUser() {
  if (typeof window === "undefined") return null;
  if (isDemoUser()) return { demo: true };
  if (hasFirebaseConfig && firebaseAuth) {
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(firebaseAuth, (u) => {
        unsub();
        resolve(u ? mapFirebaseUser(u) : null);
      });
    });
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Firestore is only used when user is signed in with Firebase (has uid). Local email users keep using localStorage. */
function getStorageUserId(user) {
  if (!user || user.demo) return null;
  return user.uid || null;
}

const readCollection = (name) => {
  if (typeof window === "undefined") return [];
  if (isDemoUser()) return demoMemoryStore[name] || [];
  const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + name);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeCollection = (name, items) => {
  if (typeof window === "undefined") return;
  if (isDemoUser()) {
    demoMemoryStore[name] = items;
    return;
  }
  window.localStorage.setItem(STORAGE_KEY_PREFIX + name, JSON.stringify(items));
};

const generateId = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Removes keys with undefined values so Firestore doesn't reject the document. */
function stripUndefined(obj) {
  if (!obj || typeof obj !== "object") return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

/**
 * Firestore rules + queries use lowercase email for `members` / `created_by`.
 * If admins enter mixed case, invited users get no list match and permission-denied.
 */
function normalizeProjectPayloadForSave(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const o = { ...obj };
  if (Array.isArray(o.members)) {
    o.members = [
      ...new Set(
        o.members.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean),
      ),
    ];
  }
  if (o.created_by != null && typeof o.created_by === "string") {
    const t = o.created_by.trim().toLowerCase();
    o.created_by = t || null;
  }
  return o;
}

function sortItems(items, orderBy) {
  if (orderBy === "-created_date") {
    return [...items].sort(
      (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0),
    );
  }
  if (orderBy === "created_date") {
    return [...items].sort(
      (a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0),
    );
  }
  return items;
}

async function firestoreList(db, collectionName, userId, orderBy) {
  const coll = collection(db, collectionName);
  if (collectionName === "Project") {
    const user = await getStorageUser();
    const emailLower = (user?.email || "").toLowerCase();
    const clauses = [where("userId", "==", userId)];
    if (emailLower) {
      clauses.push(where("created_by", "==", emailLower));
      clauses.push(where("members", "array-contains", emailLower));
    }
    const q = query(coll, or(...clauses));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return sortItems(items, orderBy);
  }

  const q = query(coll, where("userId", "==", userId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortItems(items, orderBy);
}

async function firestoreCreate(db, collectionName, userId, userEmail, data) {
  const now = new Date().toISOString();
  const id = generateId();
  const docRef = doc(db, collectionName, id);
  let raw = {
    userId,
    created_by: userEmail || null,
    created_date: now,
    updated_date: now,
    ...data,
  };
  if (collectionName === "Project") {
    raw = normalizeProjectPayloadForSave(raw);
  }
  const payload = stripUndefined(raw);
  await setDoc(docRef, payload);
  return { id, ...payload };
}

async function firestoreUpdate(db, collectionName, id, data) {
  const docRef = doc(db, collectionName, id);
  let merged = {
    ...data,
    updated_date: new Date().toISOString(),
  };
  if (collectionName === "Project") {
    merged = normalizeProjectPayloadForSave(merged);
  }
  const updated = stripUndefined(merged);
  await updateDoc(docRef, updated);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Adds completed session time to a project (atomic on Firestore for multi-device sync). */
async function mergeProjectTrackedTimeLocal(id, deltaMs, lastWorkedAtIso) {
  const items = readCollection("Project");
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const prev = Number(items[idx].tracked_time_ms) || 0;
  const updated = {
    ...items[idx],
    tracked_time_ms: prev + deltaMs,
    last_worked_at: lastWorkedAtIso || new Date().toISOString(),
    updated_date: new Date().toISOString(),
  };
  items[idx] = updated;
  writeCollection("Project", items);
  return updated;
}

async function firestoreAddProjectTrackedTime(db, projectId, deltaMs, lastWorkedAtIso) {
  const docRef = doc(db, "Project", projectId);
  await updateDoc(docRef, {
    tracked_time_ms: increment(deltaMs),
    last_worked_at: lastWorkedAtIso || new Date().toISOString(),
    updated_date: new Date().toISOString(),
  });
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function firestoreDelete(db, collectionName, id) {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
  return { id };
}

function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

async function uploadToCloudinary(file, userId = "anon") {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary env vars fehlen (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET).");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `orbylox/uploads/${userId || "anon"}`);

  const response = await withTimeout(
    fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      body: formData,
    }),
    UPLOAD_TIMEOUT_MS,
    "Datei-Upload Timeout (Cloudinary)."
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary Upload fehlgeschlagen (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (!data?.secure_url) {
    throw new Error("Cloudinary Antwort enthaelt keine secure_url.");
  }
  return { file_url: data.secure_url };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Bild konnte nicht als Data-URL gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Bild konnte nicht geladen werden."));
    };
    img.src = objectUrl;
  });
}

async function imageFileToOptimizedDataUrl(file, maxBytes = MAX_INLINE_IMAGE_BYTES) {
  const img = await loadImageElement(file);
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  const maxDimension = 1600;
  const initialScale = Math.min(1, maxDimension / Math.max(width, height));
  width = Math.max(1, Math.round(width * initialScale));
  height = Math.max(1, Math.round(height * initialScale));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return fileToDataUrl(file);

  let quality = 0.9;
  let attempts = 0;
  let dataUrl = "";

  while (attempts < 8) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlBytes(dataUrl) <= maxBytes) {
      return dataUrl;
    }
    if (quality > 0.45) {
      quality -= 0.1;
    } else {
      width = Math.max(320, Math.round(width * 0.82));
      height = Math.max(240, Math.round(height * 0.82));
    }
    attempts += 1;
  }

  return dataUrl || fileToDataUrl(file);
}

async function sha256Hex(input) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return null;
  }
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password) {
  // Frontend-only fallback auth: hash to avoid plaintext password storage.
  const hashed = await sha256Hex(password);
  if (!hashed) {
    throw new Error("Secure password hashing is unavailable in this environment.");
  }
  return `sha256:${hashed}`;
}

function createEntityApi(entityName) {
  return {
    async list(orderBy = "-created_date") {
      await delay();
      const user = await getStorageUser();
      if (user?.demo) {
        const items = readCollection(entityName);
        return sortItems(items, orderBy);
      }
      if (!hasFirebaseConfig || !firestoreDb || !user) {
        const items = readCollection(entityName);
        return sortItems(items, orderBy);
      }
      const userId = getStorageUserId(user);
      if (!userId) return [];
      try {
        return await firestoreList(firestoreDb, entityName, userId, orderBy);
      } catch (err) {
        console.error(`[Firestore] ${entityName}.list fehlgeschlagen:`, err.message);
        if (err.code === "permission-denied" || err.message?.includes("permissions")) {
          throw new Error(
            "Missing or insufficient permissions. Bitte Firestore-Regeln in der Firebase Console deployen (siehe firestore.rules)."
          );
        }
        throw err;
      }
    },
    async filter(whereClause = {}, orderBy = "-created_date") {
      const items = await this.list(orderBy);
      return items.filter((item) =>
        Object.entries(whereClause).every(([k, v]) => item[k] === v),
      );
    },
    async create(data) {
      await delay();
      const payload =
        entityName === "Project" ? normalizeProjectPayloadForSave({ ...data }) : data;
      const user = await getStorageUser();
      if (user?.demo) {
        const items = readCollection(entityName);
        const now = new Date().toISOString();
        const item = {
          id: generateId(),
          created_date: now,
          updated_date: now,
          ...payload,
        };
        items.push(item);
        writeCollection(entityName, items);
        return item;
      }
      if (!hasFirebaseConfig || !firestoreDb || !user) {
        const items = readCollection(entityName);
        const now = new Date().toISOString();
        const item = {
          id: generateId(),
          created_date: now,
          updated_date: now,
          ...payload,
        };
        items.push(item);
        writeCollection(entityName, items);
        return item;
      }
      const userId = getStorageUserId(user);
      // Nur Firebase-Auth-Nutzer (z. B. Google) haben uid → Daten in Firestore. Sonst localStorage.
      if (!userId) {
        const items = readCollection(entityName);
        const now = new Date().toISOString();
        const item = {
          id: generateId(),
          created_date: now,
          updated_date: now,
          ...payload,
        };
        items.push(item);
        writeCollection(entityName, items);
        return item;
      }
      try {
        return await firestoreCreate(firestoreDb, entityName, userId, user.email, payload);
      } catch (err) {
        console.error(`[Firestore] ${entityName}.create fehlgeschlagen:`, err.message);
        if (err.code === "permission-denied" || err.message?.includes("permissions")) {
          throw new Error(
            "Missing or insufficient permissions. Bitte Firestore-Regeln in der Firebase Console deployen (siehe firestore.rules)."
          );
        }
        throw err;
      }
    },
    async update(id, data) {
      await delay();
      const patch =
        entityName === "Project" ? normalizeProjectPayloadForSave({ ...data }) : data;
      const user = await getStorageUser();
      if (user?.demo) {
        const items = readCollection(entityName);
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return null;
        const updated = {
          ...items[idx],
          ...patch,
          updated_date: new Date().toISOString(),
        };
        items[idx] = updated;
        writeCollection(entityName, items);
        return updated;
      }
      if (!hasFirebaseConfig || !firestoreDb || !user) {
        const items = readCollection(entityName);
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return null;
        const updated = {
          ...items[idx],
          ...patch,
          updated_date: new Date().toISOString(),
        };
        items[idx] = updated;
        writeCollection(entityName, items);
        return updated;
      }
      const userId = getStorageUserId(user);
      if (!userId) {
        const items = readCollection(entityName);
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return null;
        const updated = {
          ...items[idx],
          ...patch,
          updated_date: new Date().toISOString(),
        };
        items[idx] = updated;
        writeCollection(entityName, items);
        return updated;
      }
      try {
        return await firestoreUpdate(firestoreDb, entityName, id, patch);
      } catch (err) {
        console.error(`[Firestore] ${entityName}.update fehlgeschlagen:`, err.message);
        if (err.code === "permission-denied" || err.message?.includes("permissions")) {
          throw new Error(
            "Missing or insufficient permissions. Bitte Firestore-Regeln in der Firebase Console deployen (siehe firestore.rules)."
          );
        }
        throw err;
      }
    },
    async delete(id) {
      await delay();
      const user = await getStorageUser();
      if (user?.demo) {
        const items = readCollection(entityName);
        const filtered = items.filter((i) => i.id !== id);
        writeCollection(entityName, filtered);
        return { id };
      }
      if (!hasFirebaseConfig || !firestoreDb || !user) {
        const items = readCollection(entityName);
        const filtered = items.filter((i) => i.id !== id);
        writeCollection(entityName, filtered);
        return { id };
      }
      const userId = getStorageUserId(user);
      if (!userId) {
        const items = readCollection(entityName);
        const filtered = items.filter((i) => i.id !== id);
        writeCollection(entityName, filtered);
        return { id };
      }
      try {
        await firestoreDelete(firestoreDb, entityName, id);
        return { id };
      } catch (err) {
        console.error(`[Firestore] ${entityName}.delete fehlgeschlagen:`, err.message);
        if (err.code === "permission-denied" || err.message?.includes("permissions")) {
          throw new Error(
            "Missing or insufficient permissions. Bitte Firestore-Regeln in der Firebase Console deployen (siehe firestore.rules)."
          );
        }
        throw err;
      }
    },
  };
}

const projectEntityBase = createEntityApi("Project");

export const api = {
  // Simple local auth: one demo user kept in localStorage
  auth: {
    async me() {
      await delay();
      if (typeof window === "undefined") return null;
      if (hasFirebaseConfig && firebaseAuth) {
        return new Promise((resolve) => {
          const unsub = onAuthStateChanged(firebaseAuth, (u) => {
            unsub();
            const mapped = mapFirebaseUser(u);
            if (!mapped) return resolve(null);
            const plans = readUserPlansMap();
            const emailKey = (mapped.email || "").toLowerCase();
            resolve({
              ...mapped,
              plan: plans[emailKey] || mapped.plan || "basic",
            });
          });
        });
      }
      const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "user");
      if (raw) {
        try {
          const u = JSON.parse(raw);
          return { ...u, plan: u.plan || "basic" };
        } catch {
          return null;
        }
      }
      return null;
    },
    async updateMe(data) {
      await delay();
      if (typeof window === "undefined") return null;
      const current = (await this.me()) || {};
      const updated = { ...current, ...data };
      if (current.email === DEMO_EMAIL) return updated; // demo: never persist
      window.localStorage.setItem(
        STORAGE_KEY_PREFIX + "user",
        JSON.stringify(updated),
      );
      return updated;
    },
    async register({ email, password }) {
      await delay();
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "users");
      const users = raw ? JSON.parse(raw) : [];
      if (users.some((u) => u.email === email)) {
        throw new Error("User already exists");
      }
      const password_hash = await hashPassword(password);
      const user = { email, password_hash, plan: "basic" };
      users.push(user);
      window.localStorage.setItem(
        STORAGE_KEY_PREFIX + "users",
        JSON.stringify(users),
      );
      // Auto-login after registration
      window.localStorage.setItem(
        STORAGE_KEY_PREFIX + "user",
        JSON.stringify({ email, plan: "basic" }),
      );
      return { email, plan: "basic" };
    },
    async login({ email, password }) {
      await delay();
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "users");
      const users = raw ? JSON.parse(raw) : [];
      const password_hash = await hashPassword(password);
      let changed = false;
      const found = users.find((u) => {
        if (u.email !== email) return false;
        if (u.password_hash && u.password_hash === password_hash) return true;
        // Legacy plaintext migration path.
        if (u.password && u.password === password) {
          u.password_hash = password_hash;
          delete u.password;
          changed = true;
          return true;
        }
        return false;
      });
      if (!found) {
        throw new Error("Invalid email or password");
      }
      if (changed) {
        window.localStorage.setItem(
          STORAGE_KEY_PREFIX + "users",
          JSON.stringify(users),
        );
      }
      window.localStorage.setItem(
        STORAGE_KEY_PREFIX + "user",
        JSON.stringify({ email, plan: found.plan || "basic" }),
      );
      return { email, plan: found.plan || "basic" };
    },
    async isAuthenticated() {
      const user = await this.me();
      return !!user;
    },
    async isAdmin() {
      const user = await this.me();
      return isAdminEmail(user?.email);
    },
    async listUsers() {
      await delay();
      if (typeof window === "undefined") return [];
      const current = await this.me();
      if (!isAdminEmail(current?.email)) {
        throw new Error("Nur Admins koennen Benutzer verwalten.");
      }

      const usersRaw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "users");
      const users = usersRaw ? JSON.parse(usersRaw) : [];
      const plans = readUserPlansMap();
      const emails = new Set();

      users.forEach((u) => u?.email && emails.add(String(u.email).toLowerCase()));
      Object.keys(plans || {}).forEach((e) => emails.add(String(e).toLowerCase()));
      if (current?.email) emails.add(String(current.email).toLowerCase());

      return [...emails]
        .filter(Boolean)
        .map((email) => {
          const localUser = users.find((u) => String(u.email).toLowerCase() === email);
          return {
            id: email,
            email,
            plan: plans[email] || localUser?.plan || "basic",
          };
        })
        .sort((a, b) => a.email.localeCompare(b.email));
    },
    async setUserPlan({ email, plan }) {
      await delay();
      if (typeof window === "undefined") return null;
      const current = await this.me();
      if (!isAdminEmail(current?.email)) {
        throw new Error("Nur Admins koennen Benutzer verwalten.");
      }
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        throw new Error("Ungueltige E-Mail.");
      }
      const normalizedPlan = plan === "premium" ? "premium" : "basic";

      // Persist plan override map (also works for Firebase-auth users by email).
      const plans = readUserPlansMap();
      plans[normalizedEmail] = normalizedPlan;
      writeUserPlansMap(plans);

      // Update local auth users list when present.
      const usersRaw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "users");
      const users = usersRaw ? JSON.parse(usersRaw) : [];
      const idx = users.findIndex((u) => String(u.email).toLowerCase() === normalizedEmail);
      if (idx >= 0) {
        users[idx] = { ...users[idx], plan: normalizedPlan };
        window.localStorage.setItem(STORAGE_KEY_PREFIX + "users", JSON.stringify(users));
      }

      // If currently logged-in local profile matches, update it immediately.
      try {
        const activeRaw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "user");
        if (activeRaw) {
          const active = JSON.parse(activeRaw);
          if (String(active?.email || "").toLowerCase() === normalizedEmail) {
            window.localStorage.setItem(
              STORAGE_KEY_PREFIX + "user",
              JSON.stringify({ ...active, plan: normalizedPlan })
            );
          }
        }
      } catch {
        // ignore malformed local profile
      }

      return { email: normalizedEmail, plan: normalizedPlan };
    },
    logout() {
      if (typeof window === "undefined") return;
      if (hasFirebaseConfig && firebaseAuth) {
        firebaseSignOut(firebaseAuth);
      }
      window.localStorage.removeItem(STORAGE_KEY_PREFIX + "user");
    },
    redirectToLogin(targetUrl) {
      if (typeof window === "undefined") return;
      // Store desired redirect and navigate to login form
      try {
        if (targetUrl) {
          window.localStorage.setItem(
            STORAGE_KEY_PREFIX + "redirect_after_login",
            targetUrl,
          );
        }
      } catch {
        // ignore storage errors
      }
      window.location.href = "/login";
    },
    demoLogin(targetUrl) {
      if (typeof window === "undefined") return;
      const demoUser = { email: DEMO_EMAIL };
      try {
        window.localStorage.setItem(
          STORAGE_KEY_PREFIX + "user",
          JSON.stringify(demoUser),
        );
      } catch {
        // ignore storage errors
      }
      const redirect =
        targetUrl ||
        window.localStorage.getItem(
          STORAGE_KEY_PREFIX + "redirect_after_login",
        ) ||
        "/ProjectsList";
      window.localStorage.removeItem(
        STORAGE_KEY_PREFIX + "redirect_after_login",
      );
      window.location.href = redirect;
    },
  },
  entities: {
    Project: {
      ...projectEntityBase,
      /**
       * Persists a finished timer session so totals sync across devices (Firestore increment).
       * @param {string} id project id
       * @param {number} elapsedMs session length in ms
       * @param {string} [lastWorkedAtIso]
       */
      async addTrackedTimeSession(id, elapsedMs, lastWorkedAtIso) {
        const ms = Math.max(0, Math.floor(Number(elapsedMs) || 0));
        if (!id || ms <= 0) return null;
        await delay();
        const user = await getStorageUser();
        if (user?.demo) {
          return mergeProjectTrackedTimeLocal(id, ms, lastWorkedAtIso);
        }
        if (!hasFirebaseConfig || !firestoreDb || !user) {
          return mergeProjectTrackedTimeLocal(id, ms, lastWorkedAtIso);
        }
        const userId = getStorageUserId(user);
        if (!userId) {
          return mergeProjectTrackedTimeLocal(id, ms, lastWorkedAtIso);
        }
        try {
          return await firestoreAddProjectTrackedTime(firestoreDb, id, ms, lastWorkedAtIso);
        } catch (err) {
          console.error("[Firestore] Project.addTrackedTimeSession fehlgeschlagen:", err.message);
          if (err.code === "permission-denied" || err.message?.includes("permissions")) {
            throw new Error(
              "Missing or insufficient permissions. Bitte Firestore-Regeln in der Firebase Console deployen (siehe firestore.rules).",
            );
          }
          throw err;
        }
      },
    },
    ProductIdea: createEntityApi("ProductIdea"),
    Post: createEntityApi("Post"),
    Task: createEntityApi("Task"),
    Subtask: createEntityApi("Subtask"),
    TaskComment: createEntityApi("TaskComment"),
    Document: createEntityApi("Document"),
    FileRecord: createEntityApi("FileRecord"),
    Folder: createEntityApi("Folder"),
    Message: createEntityApi("Message"),
    CustomIntegration: createEntityApi("CustomIntegration"),
    Event: createEntityApi("Event"),
    StartupStep: createEntityApi("StartupStep"),
    StartupJourney: createEntityApi("StartupJourney"),
    Waitlist: createEntityApi("Waitlist"),
    User: createEntityApi("User"),
    PostComment: createEntityApi("PostComment"),
    CanvasItem: createEntityApi("CanvasItem"),
    CanvasConnection: createEntityApi("CanvasConnection"),
    ProjectBackup: createEntityApi("ProjectBackup"),
    RestoreRequest: createEntityApi("RestoreRequest"),
  },
  integrations: {
    Core: {
      // For now we just echo back some basic structures;
      // you can replace these with real backend calls later.
      async UploadFile({ file }) {
        await delay();
        if (typeof window === "undefined" || !file) {
          return { file_url: "" };
        }
        const user = await getStorageUser();
        const userId = getStorageUserId(user);

        // Primary: Cloudinary direct browser upload.
        try {
          return await uploadToCloudinary(file, userId);
        } catch (err) {
          console.error("[UploadFile] Cloudinary upload failed:", err?.message || err);
          // Fallback for images: persistent inline data URL (compressed).
          if (file.type?.startsWith("image/")) {
            const inlineDataUrl = await imageFileToOptimizedDataUrl(file);
            return { file_url: inlineDataUrl };
          }
          // Last-resort for non-images (session-local only).
          return { file_url: URL.createObjectURL(file) };
        }
      },
      async InvokeLLM({ prompt }) {
        await delay(50);
        // Dummy response – replace with real AI backend later
        return {
          summary: prompt.slice(0, 120),
          phases: [],
          keyMetrics: [],
        };
      },
      async GenerateImage({ prompt }) {
        await delay(50);
        // Placeholder image
        return {
          url: "https://via.placeholder.com/800x450.png?text=Roadmap",
        };
      },
      async SendEmail(payload = {}) {
        const url =
          import.meta.env.VITE_INVITE_EMAIL_URL ||
          (typeof window !== "undefined" ? `${window.location.origin}/api/send-invite.php` : "");
        const apiKey = import.meta.env.VITE_INVITE_API_KEY || "";
        if (!url) {
          throw new Error("Invite email URL missing (VITE_INVITE_EMAIL_URL).");
        }
        if (!apiKey) {
          throw new Error("Invite API key missing (VITE_INVITE_API_KEY).");
        }
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Invite-Api-Key": apiKey,
          },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(text || `Invite email failed (${res.status})`);
        }
        if (!res.ok) {
          throw new Error(data.error || text || `Invite email failed (${res.status})`);
        }
        return data;
      },
      async SendSMS() {
        await delay();
        return { status: "ok" };
      },
    },
  },
  functions: {
    async invoke(name, payload) {
      console.warn("[api.functions.invoke] Not implemented:", name, payload);
      return null;
    },
  },
  appLogs: {
    async logUserInApp(pageName) {
      await delay();
      // No-op logging
      return { pageName };
    },
  },
};
