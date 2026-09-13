import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/index.css';
import '@/styles/theme-retro.css';
import '@/styles/theme-halloween.css';
import TaskFocus from '@/components/focus/TaskFocus';
import LiegengebliebenBand from '@/components/projects/LiegengebliebenBand';

const P = new URLSearchParams(location.search);
const theme = P.get('theme');
if (theme && theme !== 'default') {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.add('theme-scope');
}

const task = {
  id: 't1',
  title: 'Dönersorten für die neue Karte festlegen',
  description:
    'Für die Herbstkarte brauchen wir drei feste Sorten plus eine vegetarische.\n\n'
    + 'Wichtig: Der Wareneinsatz darf 32 % nicht überschreiten, sonst rechnet sich die Mittagskarte nicht. '
    + 'Die Verkostung machen wir gemeinsam, damit hinterher niemand sagt, er sei nicht gefragt worden.',
};

const projekte = [
  { id: 'p1', name: 'Main Ufer Döner', created_date: '2026-06-01T09:00:00Z' },
  { id: 'p2', name: 'Website-Relaunch', created_date: '2026-05-02T09:00:00Z' },
  { id: 'p3', name: 'Umzug Lager Süd', created_date: '2026-08-20T09:00:00Z' },
];
const eintraege = [
  { projekt: projekte[0], tage: 9 },
  { projekt: projekte[1], tage: 34 },
  { projekt: projekte[2], tage: 7 },
];

function Probe() {
  const was = P.get('was') || 'fokus';
  if (was === 'band') {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <LiegengebliebenBand eintraege={eintraege} de onOeffnen={() => {}} onWeg={() => {}} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projekte.map((p) => (
            <div key={p.id} className="bg-white border-2 border-black p-4 h-32">
              <p className="font-bold">{p.name}</p>
              <p className="text-sm text-slate-500">Beispielkachel</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <TaskFocus task={task} projectId="p1" offen onClose={() => {}} onDone={() => {}} de />;
}

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <Probe />
  </QueryClientProvider>,
);
