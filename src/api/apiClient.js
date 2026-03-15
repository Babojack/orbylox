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
} from "firebase/firestore";

const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

const STORAGE_KEY_PREFIX = "orbylox_";
const DEMO_EMAIL = "demo@orbylox.local";

const demoMemoryStore = {};

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
  const q = query(coll, where("userId", "==", userId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortItems(items, orderBy);
}

async function firestoreCreate(db, collectionName, userId, userEmail, data) {
  const now = new Date().toISOString();
  const id = generateId();
  const docRef = doc(db, collectionName, id);
  const payload = stripUndefined({
    userId,
    created_by: userEmail || null,
    created_date: now,
    updated_date: now,
    ...data,
  });
  await setDoc(docRef, payload);
  return { id, ...payload };
}

async function firestoreUpdate(db, collectionName, id, data) {
  const docRef = doc(db, collectionName, id);
  const updated = stripUndefined({
    ...data,
    updated_date: new Date().toISOString(),
  });
  await updateDoc(docRef, updated);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function firestoreDelete(db, collectionName, id) {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
  return { id };
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
      return firestoreList(firestoreDb, entityName, userId, orderBy);
    },
    async filter(whereClause = {}, orderBy = "-created_date") {
      const items = await this.list(orderBy);
      return items.filter((item) =>
        Object.entries(whereClause).every(([k, v]) => item[k] === v),
      );
    },
    async create(data) {
      await delay();
      const user = await getStorageUser();
      if (user?.demo) {
        const items = readCollection(entityName);
        const now = new Date().toISOString();
        const item = {
          id: generateId(),
          created_date: now,
          updated_date: now,
          ...data,
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
          ...data,
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
          ...data,
        };
        items.push(item);
        writeCollection(entityName, items);
        return item;
      }
      return firestoreCreate(firestoreDb, entityName, userId, user.email, data);
    },
    async update(id, data) {
      await delay();
      const user = await getStorageUser();
      if (user?.demo) {
        const items = readCollection(entityName);
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return null;
        const updated = {
          ...items[idx],
          ...data,
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
          ...data,
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
          ...data,
          updated_date: new Date().toISOString(),
        };
        items[idx] = updated;
        writeCollection(entityName, items);
        return updated;
      }
      return firestoreUpdate(firestoreDb, entityName, id, data);
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
      await firestoreDelete(firestoreDb, entityName, id);
      return { id };
    },
  };
}

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
            resolve(mapFirebaseUser(u));
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
      const user = { email, password, plan: "basic" };
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
      const found = users.find((u) => u.email === email && u.password === password);
      if (!found) {
        throw new Error("Invalid email or password");
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
    Project: createEntityApi("Project"),
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
        if (typeof window === "undefined") {
          return { file_url: "" };
        }
        const url = URL.createObjectURL(file);
        return { file_url: url };
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
      async SendEmail() {
        await delay();
        return { status: "ok" };
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
