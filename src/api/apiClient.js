// Lightweight local API stub so the app works without any external backend.
// You can later replace these methods with real Firebase or your own server.

const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

const STORAGE_KEY_PREFIX = "orbylox_";

const readCollection = (name) => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + name);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeCollection = (name, items) => {
  if (typeof window === "undefined") return;
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
      const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + "user");
      if (raw) {
        try {
          return JSON.parse(raw);
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
      window.localStorage.setItem(
        STORAGE_KEY_PREFIX + "user",
        JSON.stringify(updated),
      );
      return updated;
    },
    logout() {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(STORAGE_KEY_PREFIX + "user");
    },
    redirectToLogin(targetUrl) {
      if (typeof window === "undefined") return;
      // Simple demo login: set a fake user and redirect into the app
      const demoUser = { email: "demo@orbylox.local" };
      try {
        window.localStorage.setItem(
          STORAGE_KEY_PREFIX + "user",
          JSON.stringify(demoUser),
        );
      } catch {
        // ignore storage errors
      }
      const redirect = targetUrl || "/ProjectsList";
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
