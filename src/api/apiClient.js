// Lightweight local API stub; auth uses Firebase when configured.
import {
  auth as firebaseAuth,
  hasFirebaseConfig,
  onAuthStateChanged,
  firebaseSignOut,
  mapFirebaseUser,
} from "@/lib/firebase";

const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

const STORAGE_KEY_PREFIX = "orbylox_";
const DEMO_EMAIL = "demo@orbylox.local";

// Demo mode: nothing is persisted. All data lives only in memory and is lost on refresh/close.
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

const readCollection = (name) => {
  if (typeof window === "undefined") return [];
  if (isDemoUser()) {
    return demoMemoryStore[name] || [];
  }
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

function createEntityApi(entityName) {
  return {
    async list(orderBy = "-created_date") {
      await delay();
      const items = readCollection(entityName);
      if (orderBy === "-created_date") {
        return items.sort(
          (a, b) => new Date(b.created_date) - new Date(a.created_date),
        );
      }
      if (orderBy === "created_date") {
        return items.sort(
          (a, b) => new Date(a.created_date) - new Date(b.created_date),
        );
      }
      return items;
    },
    async filter(where = {}, orderBy = "-created_date") {
      const items = await this.list(orderBy);
      return items.filter((item) =>
        Object.entries(where).every(([k, v]) => item[k] === v),
      );
    },
    async create(data) {
      await delay();
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
    },
    async update(id, data) {
      await delay();
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
    },
    async delete(id) {
      await delay();
      const items = readCollection(entityName);
      const filtered = items.filter((i) => i.id !== id);
      writeCollection(entityName, filtered);
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
