import React from 'react';
import { api } from "@/api/apiClient";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import ModuleShowcase from "@/components/landing/ModuleShowcase";
import OrbyloxMark from "@/components/OrbyloxMark";
import {
  ArrowRight,
  Check,
  Zap,
  Users,
  Shapes,
  FolderOpen,
  Video,
  CalendarDays,
  ListTodo,
  MessageSquare,
  Languages,
  Play,
  LogIn,
  UserPlus,
} from 'lucide-react';

/* --------------------------------------------------------------------------
   TaskNow-Stil: schwarze 2px-Rahmen, eckige Flaechen, ein Orange als Akzent.
   Alle Knoepfe teilen dieselben drei Varianten.
   -------------------------------------------------------------------------- */

function TnButton({ variant = 'solid', className = '', children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wide border-2 transition-colors';
  const variants = {
    solid: 'bg-black text-white border-black hover:bg-[#ef5a24] hover:border-[#ef5a24]',
    accent: 'bg-[#ef5a24] text-white border-[#ef5a24] hover:bg-black hover:border-black',
    outline: 'bg-white text-black border-black hover:bg-black hover:text-white',
  };
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div className="text-center mb-10">
      <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black">{children}</h2>
      {sub && <p className="mt-2 text-slate-600 text-sm sm:text-base">{sub}</p>}
    </div>
  );
}

function FeatureBox({ icon: Icon, title, text }) {
  return (
    <div className="tn-card border-2 border-black bg-white p-5">
      <div className="w-10 h-10 bg-[#ef5a24] text-white flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-black mb-1">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

function BulletRow({ title, text }) {
  return (
    <div className="flex gap-3 mb-4">
      <span className="w-5 h-5 shrink-0 mt-0.5 bg-[#ef5a24] text-white flex items-center justify-center">
        <Check className="w-3 h-3" />
      </span>
      <div>
        <p className="font-bold text-black text-sm">{title}</p>
        <p className="text-sm text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function LandingContent() {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [waitlistEmail, setWaitlistEmail] = React.useState('');
  const [waitlistLoading, setWaitlistLoading] = React.useState(false);
  const [waitlistDone, setWaitlistDone] = React.useState(false);
  const [videoPlaying, setVideoPlaying] = React.useState(false);

  const de = language === 'de';
  const goLogin = () => navigate(createPageUrl('login'));

  // Beim Verlassen des Hero zieht das Geraetebild nach vorne weg und uebergibt
  // an den Rundgang, der die einzelnen Module heranholt.
  const heroRef = React.useRef(null);
  const reduceMotion = useReducedMotion();
  const rm = !!reduceMotion;
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroScale = useTransform(heroProgress, [0, 1], rm ? [1, 1] : [1, 1.14]);
  const heroY = useTransform(heroProgress, [0, 1], rm ? [0, 0] : [0, -70]);
  const heroFade = useTransform(heroProgress, [0, 0.75], rm ? [1, 1] : [1, 0]);

  const submitWaitlist = async () => {
    if (!waitlistEmail.includes('@')) {
      window.alert(de ? 'Bitte eine gültige E-Mail eingeben.' : 'Please enter a valid email.');
      return;
    }
    setWaitlistLoading(true);
    try {
      await api.entities.Waitlist.create({ email: waitlistEmail.toLowerCase(), source: 'landing' });
      setWaitlistDone(true);
      setWaitlistEmail('');
    } catch (err) {
      console.error('[Waitlist]', err);
      window.alert(de ? 'Eintragen fehlgeschlagen.' : 'Could not join the list.');
    } finally {
      setWaitlistLoading(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: de ? 'In 10 Minuten startklar' : 'Ready in 10 minutes',
      text: de ? 'Projekt anlegen, Team einladen, loslegen. Ohne Schulung.' : 'Create a project, invite the team, go. No training needed.',
    },
    {
      icon: Users,
      title: de ? 'Echtes Teamwork' : 'Real teamwork',
      text: de ? 'Aufgaben, Chat und Feed in Echtzeit für alle sichtbar.' : 'Tasks, chat and feed in real time for everyone.',
    },
    {
      icon: Shapes,
      title: de ? 'Visuelles Canvas' : 'Visual canvas',
      text: de ? 'Ideen als Mindmap und Post-its, verbunden per Ziehen.' : 'Ideas as a mind map and sticky notes, connected by dragging.',
    },
    {
      icon: Video,
      title: de ? 'Meetings inklusive' : 'Meetings included',
      text: de ? 'Videokonferenz direkt im Projekt, ohne zweites Werkzeug.' : 'Video conference right in the project, no second tool.',
    },
  ];

  const steps = [
    { n: '01', title: de ? 'Registrieren' : 'Sign up', text: de ? 'Konto in Sekunden erstellen' : 'Create your account in seconds' },
    { n: '02', title: de ? 'Projekt anlegen' : 'Create a project', text: de ? 'Name, Ziel, fertig' : 'Name it, set the goal, done' },
    { n: '03', title: de ? 'Team einladen' : 'Invite the team', text: de ? 'Einladung per E-Mail verschicken' : 'Send an invitation by email' },
    { n: '04', title: de ? 'Loslegen' : 'Get going', text: de ? 'Aufgaben, Dateien, Meetings an einem Ort' : 'Tasks, files and meetings in one place' },
  ];

  // "Dunkelmodus" stand hier, den gibt es nicht mehr — jetzt Videokonferenz.
  const benefits = de
    ? ['Kostenlos starten', 'Keine Kreditkarte', 'Daten in der EU', 'Videokonferenz inklusive', 'Deutsch und Englisch', 'Voll-Backups']
    : ['Free to start', 'No credit card', 'Data in the EU', 'Video meetings included', 'German and English', 'Full backups'];

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Kopfzeile */}
      <header className="border-b-2 border-black">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <OrbyloxMark className="w-8 h-8 shrink-0" />
            <span className="font-extrabold tracking-tight text-base sm:text-lg">RBYLOX</span>
          </div>

          {/* Auf dem Handy nur Sprache + Anmelden — sonst laeuft die Zeile ueber
              den Rand. Registrieren steht direkt darunter im Hero. */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLanguage(de ? 'en' : 'de')}
              aria-label={de ? 'Auf Englisch umschalten' : 'Switch to German'}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
            >
              <Languages className="w-4 h-4" />
              <span className="hidden xs:inline">{de ? 'EN' : 'DE'}</span>
            </button>
            <TnButton variant="outline" className="px-3 sm:px-4 py-2 text-xs" onClick={goLogin}>
              <LogIn className="w-4 h-4" />
              {de ? 'Anmelden' : 'Login'}
            </TnButton>
            <TnButton variant="solid" className="hidden sm:inline-flex px-4 py-2 text-xs" onClick={goLogin}>
              <UserPlus className="w-4 h-4" />
              {de ? 'Registrieren' : 'Register'}
            </TnButton>
          </div>
        </div>
      </header>

      {/* Hero: Text links, Geraetebild rechts */}
      <section ref={heroRef} className="border-b-2 border-black overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter mb-4 flex items-center justify-center lg:justify-start gap-2 sm:gap-3">
            <OrbyloxMark className="w-14 h-14 sm:w-16 sm:h-16 shrink-0" />
            <span>RBYLOX</span>
          </h1>
          <p className="text-xl sm:text-2xl font-bold mb-4">
            {de ? 'Projektmanagement für alle' : 'Project management for everyone'}
          </p>
          <p className="max-w-xl mx-auto lg:mx-0 text-slate-600 mb-8">
            {de
              ? 'Aufgaben, Dateien, Canvas, Chat und Videokonferenz in einem Werkzeug. Ohne Ballast, ohne Abo-Zwang.'
              : 'Tasks, files, canvas, chat and video meetings in one tool. No bloat, no forced subscription.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
            <TnButton variant="accent" onClick={goLogin}>
              {de ? 'Kostenlos starten' : 'Start for free'}
              <ArrowRight className="w-4 h-4" />
            </TnButton>
            <TnButton variant="outline" onClick={goLogin}>
              {de ? 'Anmelden' : 'Login'}
            </TnButton>
          </div>

          <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-sm">
            {(de
              ? ['Kostenlose Registrierung', 'Keine Kreditkarte', 'Sofort startklar']
              : ['Free registration', 'No credit card', 'Ready right away']
            ).map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 text-slate-700">
                <Check className="w-4 h-4 text-[#ef5a24]" />
                {item}
              </span>
            ))}
          </div>
          </div>

          {/* Produktbild — ohne Rahmen, faehrt beim Scrollen nach vorne weg */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <motion.img
              src="/screens/hero-devices.webp"
              alt={
                de
                  ? 'ORBYLOX auf Laptop, Tablet und Handy'
                  : 'ORBYLOX on laptop, tablet and phone'
              }
              width="1800"
              height="825"
              style={{ scale: heroScale, y: heroY, opacity: heroFade }}
              className="w-full h-auto"
            />
          </motion.div>
        </div>
      </section>

      <ModuleShowcase de={de} />

      {/* Video: laedt erst nach dem Klick, damit YouTube nicht ungefragt mitliest */}
      <section className="border-b-2 border-black bg-[#f5f5f5]">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <SectionTitle sub={de ? 'Zwei Minuten, dann weißt du, wie es läuft.' : 'Two minutes and you know how it works.'}>
            {de ? 'ORBYLOX im Überblick' : 'ORBYLOX at a glance'}
          </SectionTitle>

          <div className="border-2 border-black bg-black aspect-video relative">
            {videoPlaying ? (
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/LeRWiWL-Zmk?autoplay=1"
                title="ORBYLOX"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => setVideoPlaying(true)}
                className="group w-full h-full flex flex-col items-center justify-center gap-4"
                aria-label={de ? 'Video abspielen' : 'Play video'}
              >
                <img
                  src="https://img.youtube.com/vi/LeRWiWL-Zmk/maxresdefault.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                />
                <span className="relative w-16 h-16 bg-[#ef5a24] text-white flex items-center justify-center">
                  <Play className="w-7 h-7 ml-0.5" fill="currentColor" />
                </span>
                <span className="relative text-white font-bold uppercase tracking-wide text-sm">
                  {de ? 'Video ansehen' : 'Watch the video'}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Warum */}
      <section className="border-b-2 border-black">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <SectionTitle sub={de ? 'Alles, was ein kleines Team wirklich braucht.' : 'Everything a small team actually needs.'}>
            {de ? 'Warum ORBYLOX?' : 'Why ORBYLOX?'}
          </SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <FeatureBox key={f.title} icon={f.icon} title={f.title} text={f.text} />
            ))}
          </div>
        </div>
      </section>

      {/* Für Teams */}
      <section className="border-b-2 border-black bg-[#f5f5f5]">
        <div className="max-w-6xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="border-2 border-black bg-white p-8">
            <div className="grid grid-cols-2 gap-3">
              {[ListTodo, Shapes, FolderOpen, CalendarDays].map((Icon, i) => (
                <div key={i} className="border-2 border-black aspect-square flex items-center justify-center">
                  <Icon className="w-10 h-10" strokeWidth={1.5} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase mb-4">
              {de ? 'Für Teams' : 'For teams'}
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              {de ? 'Ein Ort statt fünf Werkzeuge' : 'One place instead of five tools'}
            </h2>
            <p className="text-slate-600 mb-6">
              {de
                ? 'Kanban, Notizen, Dateien und Termine liegen im selben Projekt. Kein Suchen, kein Umschalten.'
                : 'Kanban, notes, files and appointments live in the same project. No searching, no switching.'}
            </p>
            <BulletRow
              title={de ? 'Aufgaben mit Zeiterfassung' : 'Tasks with time tracking'}
              text={de ? 'Der Timer läuft automatisch mit, sobald du im Projekt arbeitest.' : 'The timer runs automatically while you work in a project.'}
            />
            <BulletRow
              title={de ? 'Dateien mit Vorschau' : 'Files with preview'}
              text={de ? 'PDFs und Bilder direkt ansehen, ohne Download.' : 'View PDFs and images directly, no download.'}
            />
            <BulletRow
              title={de ? 'Voll-Backups' : 'Full backups'}
              text={de ? 'Projektdaten und Dateien als ZIP, jederzeit wiederherstellbar.' : 'Project data and files as a ZIP, restorable at any time.'}
            />
            <TnButton variant="solid" className="mt-2" onClick={goLogin}>
              {de ? 'Projekt anlegen' : 'Create a project'}
              <ArrowRight className="w-4 h-4" />
            </TnButton>
          </div>
        </div>
      </section>

      {/* Für Einzelne */}
      <section className="border-b-2 border-black">
        <div className="max-w-6xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="order-2 lg:order-1">
            <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase mb-4">
              {de ? 'Für Einzelkämpfer' : 'For solo work'}
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              {de ? 'Aus einer Idee wird ein Plan' : 'Turn an idea into a plan'}
            </h2>
            <p className="text-slate-600 mb-6">
              {de
                ? 'Gedanken aufs Canvas werfen, verbinden, in Aufgaben verwandeln — und den Fortschritt sehen.'
                : 'Throw thoughts on the canvas, connect them, turn them into tasks — and watch the progress.'}
            </p>
            <BulletRow
              title={de ? 'Canvas wie ein Whiteboard' : 'Canvas like a whiteboard'}
              text={de ? 'Post-its kleben, Knoten per Ziehen verbinden, frei skalieren.' : 'Stick notes, connect nodes by dragging, resize freely.'}
            />
            <BulletRow
              title={de ? 'Kommentare am Knoten' : 'Comments on nodes'}
              text={de ? 'Diskussion direkt dort, wo die Idee steht.' : 'Discussion right where the idea sits.'}
            />
            <BulletRow
              title={de ? 'Dunkelmodus' : 'Dark mode'}
              text={de ? 'Für lange Abende am Board.' : 'For long evenings at the board.'}
            />
            <TnButton variant="accent" className="mt-2" onClick={goLogin}>
              {de ? 'Canvas ausprobieren' : 'Try the canvas'}
              <ArrowRight className="w-4 h-4" />
            </TnButton>
          </div>
          <div className="order-1 lg:order-2 border-2 border-black p-8 bg-white">
            <div className="border-2 border-black p-4 mb-3 flex items-center justify-between">
              <span className="font-bold">{de ? 'Aufgabe' : 'Task'}</span>
              <span className="px-2 py-1 bg-[#ef5a24] text-white text-xs font-bold">{de ? 'OFFEN' : 'OPEN'}</span>
            </div>
            <div className="border-2 border-black p-4 mb-3 flex items-center justify-between">
              <span className="font-bold">{de ? 'Post-it' : 'Sticky note'}</span>
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="border-2 border-black p-4 flex items-center justify-between">
              <span className="font-bold">{de ? 'Meeting' : 'Meeting'}</span>
              <Video className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      {/* Ablauf */}
      <section className="border-b-2 border-black bg-[#f5f5f5]">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <SectionTitle sub={de ? 'Vom Konto zum laufenden Projekt.' : 'From account to running project.'}>
            {de ? 'In vier Schritten' : 'In four steps'}
          </SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((s) => (
              <div key={s.n} className="tn-card border-2 border-black bg-white p-5 relative">
                <span className="absolute -top-4 left-5 px-2 py-1 bg-[#ef5a24] text-white text-xs font-black">
                  {s.n}
                </span>
                <h3 className="font-bold mt-3 mb-1">{s.title}</h3>
                <p className="text-sm text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vorteile */}
      <section className="border-b-2 border-black">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <SectionTitle>{de ? 'Deine Vorteile' : 'Your benefits'}</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {benefits.map((b) => (
              <div key={b} className="tn-card border-2 border-black bg-white px-4 py-3 flex items-center gap-3">
                <Check className="w-4 h-4 text-[#ef5a24] shrink-0" />
                <span className="text-sm font-bold">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Abschluss */}
      <section className="bg-black text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            {de ? 'Bereit loszulegen?' : 'Ready to start?'}
          </h2>
          <p className="text-slate-300 mb-10">
            {de ? 'Kostenlos registrieren und das erste Projekt anlegen.' : 'Register for free and create your first project.'}
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto text-black">
            <div className="bg-white border-2 border-white p-6">
              <Users className="w-8 h-8 mx-auto mb-3" />
              <p className="font-bold mb-1">{de ? 'Als Team' : 'As a team'}</p>
              <p className="text-sm text-slate-600 mb-4">
                {de ? 'Gemeinsam an Aufgaben arbeiten' : 'Work on tasks together'}
              </p>
              <TnButton variant="accent" className="w-full" onClick={goLogin}>
                {de ? 'Registrieren' : 'Register'}
              </TnButton>
            </div>
            <div className="bg-white border-2 border-white p-6">
              <Shapes className="w-8 h-8 mx-auto mb-3" />
              <p className="font-bold mb-1">{de ? 'Für dich allein' : 'On your own'}</p>
              <p className="text-sm text-slate-600 mb-4">
                {de ? 'Ideen ordnen und umsetzen' : 'Organise ideas and get them done'}
              </p>
              <TnButton variant="solid" className="w-full" onClick={goLogin}>
                {de ? 'Projekt anlegen' : 'Create a project'}
              </TnButton>
            </div>
          </div>

          {/* Warteliste */}
          <div className="max-w-md mx-auto mt-12">
            <p className="text-sm text-slate-300 mb-3">
              {de ? 'Lieber später informiert werden?' : 'Rather be notified later?'}
            </p>
            {waitlistDone ? (
              <p className="border-2 border-[#ef5a24] text-[#ef5a24] font-bold py-3">
                {de ? 'Eingetragen. Wir melden uns.' : "You're on the list. We'll be in touch."}
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  placeholder="name@beispiel.de"
                  className="flex-1 px-4 py-3 border-2 border-white bg-black text-white placeholder:text-slate-500 outline-none focus:border-[#ef5a24]"
                />
                <TnButton variant="accent" onClick={submitWaitlist} disabled={waitlistLoading}>
                  {waitlistLoading ? (de ? 'Moment…' : 'One moment…') : de ? 'Eintragen' : 'Join'}
                </TnButton>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Fußzeile */}
      <footer className="border-t-2 border-black">
        <div className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <OrbyloxMark className="w-7 h-7 shrink-0" />
              <span className="font-extrabold tracking-tight">RBYLOX</span>
            </div>
            <p className="text-sm text-slate-600">
              {de
                ? 'Projektmanagement für Teams und Einzelkämpfer. Kostenlos in der Beta.'
                : 'Project management for teams and solo makers. Free during beta.'}
            </p>
          </div>
          <div>
            <p className="font-bold uppercase text-xs tracking-wide mb-3">{de ? 'Produkt' : 'Product'}</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><button type="button" onClick={goLogin} className="hover:text-[#ef5a24]">{de ? 'Anmelden' : 'Login'}</button></li>
              <li><button type="button" onClick={goLogin} className="hover:text-[#ef5a24]">{de ? 'Registrieren' : 'Register'}</button></li>
            </ul>
          </div>
          <div>
            <p className="font-bold uppercase text-xs tracking-wide mb-3">{de ? 'Rechtliches' : 'Legal'}</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="/Impressum" className="hover:text-[#ef5a24]">{de ? 'Impressum' : 'Imprint'}</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t-2 border-black">
          <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-slate-500">
            © {new Date().getFullYear()} ORBYLOX
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Landing() {
  return (
    <LanguageProvider>
      <LandingContent />
    </LanguageProvider>
  );
}
