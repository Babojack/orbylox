/* Steht per Alias anstelle von @/api/apiClient. Feste Daten, keine Cloud. */
const jetzt = Date.now();
const vor = (min) => new Date(jetzt - min * 60000).toISOString();

const teilaufgaben = [
  { id: 's1', task_id: 't1', title: 'Lieferantenliste zusammenstellen', completed: true, sort_order: 0 },
  { id: 's2', task_id: 't1', title: 'Drei Angebote einholen und vergleichen', completed: true, sort_order: 1 },
  { id: 's3', task_id: 't1', title: 'Probeverkostung mit dem Team ansetzen', completed: false, sort_order: 2 },
  { id: 's4', task_id: 't1', title: 'Preise kalkulieren (Wareneinsatz max. 32 %)', completed: false, sort_order: 3 },
  { id: 's5', task_id: 't1', title: 'Karte neu setzen lassen', completed: false, sort_order: 4 },
];
const kommentare = [
  { id: 'c1', task_id: 't1', author_email: 'jey.afandiyev@gmail.com', created_date: vor(4),
    content: 'Der zweite Lieferant liefert nur ab Dienstag — das passt nicht zur Anlieferung. Siehe https://example.com/lieferbedingungen' },
  { id: 'c2', task_id: 't1', author_email: 'marek@orbylox.de', created_date: vor(95),
    content: 'Verkostung würde ich auf nächste Woche legen, dann ist Sara wieder da.' },
  { id: 'c3', task_id: 't1', author_email: 'sara@orbylox.de', created_date: vor(60 * 27),
    content: 'Bin dabei. Bitte auch die vegetarische Variante mitdenken.' },
];

export const api = {
  auth: { me: async () => ({ email: 'jey.afandiyev@gmail.com', uid: 'u1' }) },
  entities: {
    Subtask: {
      list: async () => teilaufgaben,
      create: async (d) => ({ id: 's' + Math.random(), ...d }),
      update: async () => ({}),
    },
    TaskComment: {
      list: async () => kommentare,
      create: async (d) => ({ id: 'c' + Math.random(), ...d }),
    },
  },
};
export default api;
