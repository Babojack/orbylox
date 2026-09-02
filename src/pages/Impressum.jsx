import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import OrbyloxMark from "@/components/OrbyloxMark";

const ADDRESS = ['Jeyhun Afandiyev', 'c/o Online-Impressum #6833', 'Europaring 90', '53757 Sankt Augustin', 'Deutschland'];
const ODR_URL = 'https://ec.europa.eu/consumers/odr/';

/** Rechtstexte in beiden Sprachen. Adressen und Namen bleiben unübersetzt. */
function sections(de) {
  return de
    ? [
        { h: 'Angaben gemäß § 5 TMG', lines: ADDRESS },
        { h: 'Kontakt', mail: true },
        { h: 'Zweiter Kontaktweg', p: ['Kontaktaufnahme ist zusätzlich über die in der Anwendung bereitgestellten Kontaktwege möglich.'] },
        { h: 'Zuständige Regulierungs- und Aufsichtsbehörde', lines: ['Medienanstalt Hessen', 'Sitz: Deutschland'] },
        { h: 'Verantwortlich für den Inhalt', lines: ADDRESS },
        {
          h: 'Hinweis zur Verarbeitung personenbezogener Daten',
          p: [
            'Diese Anwendung verarbeitet personenbezogene Daten nur im erforderlichen Umfang, um die Plattform bereitzustellen, die Sicherheit zu gewährleisten und Funktionen auszuführen.',
          ],
        },
        {
          h: 'Verarbeitete Datenkategorien',
          lines: [
            '– Konto- und Identifikationsdaten (z. B. E-Mail-Adresse, User-ID, Profilangaben)',
            '– Inhaltsdaten (z. B. Projekte, Aufgaben, Kommentare, Nachrichten, hochgeladene Dateien)',
            '– Nutzungs- und technische Daten (z. B. Zeitstempel, Geräte- und Browserinformationen, Protokolle)',
            '– Kommunikationsdaten bei Kontaktanfragen',
          ],
        },
        {
          h: 'Zwecke und Rechtsgrundlagen',
          p: [
            'Die Verarbeitung erfolgt zur Vertragserfüllung und Bereitstellung der Plattform (Art. 6 Abs. 1 lit. b DSGVO), zur Wahrung berechtigter Interessen wie Sicherheit und stabilem Betrieb (Art. 6 Abs. 1 lit. f DSGVO), aufgrund gesetzlicher Pflichten (Art. 6 Abs. 1 lit. c DSGVO) sowie – soweit erforderlich – auf Grundlage einer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).',
          ],
        },
        {
          h: 'Eingesetzte Dienste und Empfänger',
          lines: [
            'Zur technischen Bereitstellung werden folgende Dienste eingesetzt:',
            '– Google Firebase (Authentifizierung, Datenbank)',
            '– Hostinger (Webhosting, Dateispeicher, E-Mail-Versand)',
            '– Jitsi / 8x8 (Videokonferenzen)',
          ],
          p: [
            'Dabei kann eine Verarbeitung in Drittstaaten stattfinden. In solchen Fällen werden geeignete Garantien wie Standardvertragsklauseln verwendet.',
          ],
        },
        {
          h: 'Speicherdauer',
          p: [
            'Personenbezogene Daten werden nur so lange gespeichert, wie es für die jeweiligen Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen. Danach werden Daten gelöscht oder anonymisiert.',
          ],
        },
        {
          h: 'Betroffenenrechte',
          p: [
            'Betroffene Personen haben nach DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie – bei Einwilligungen – auf Widerruf mit Wirkung für die Zukunft. Zudem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.',
          ],
        },
        {
          h: 'Datensicherheit',
          p: [
            'Es werden angemessene technische und organisatorische Maßnahmen umgesetzt, um personenbezogene Daten vor Verlust, Manipulation und unberechtigtem Zugriff zu schützen.',
          ],
        },
        {
          h: 'EU-Streitschlichtung',
          odr: true,
          p: ['Unsere E-Mail-Adresse findest du oben im Impressum.'],
        },
        {
          h: 'Verbraucherstreitbeilegung',
          p: [
            'Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
          ],
        },
        {
          h: 'Haftung für Inhalte',
          p: [
            'Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.',
            'Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden entsprechender Rechtsverletzungen entfernen wir diese Inhalte umgehend.',
          ],
        },
        {
          h: 'Haftung für Links',
          p: [
            'Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.',
          ],
        },
        {
          h: 'Urheberrecht',
          p: [
            'Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors oder Erstellers.',
          ],
        },
        {
          h: 'Wichtiger Hinweis',
          p: [
            'Diese Angaben dienen der transparenten Information und ersetzen keine individuelle Rechtsberatung.',
          ],
        },
      ]
    : [
        { h: 'Information pursuant to § 5 TMG', lines: ADDRESS },
        { h: 'Contact', mail: true },
        { h: 'Second contact channel', p: ['You can also reach us through the contact options provided inside the application.'] },
        { h: 'Competent supervisory authority', lines: ['Medienanstalt Hessen', 'Based in Germany'] },
        { h: 'Responsible for the content', lines: ADDRESS },
        {
          h: 'Note on processing personal data',
          p: [
            'This application processes personal data only to the extent required to provide the platform, ensure security and run its features.',
          ],
        },
        {
          h: 'Categories of data processed',
          lines: [
            '– Account and identification data (e.g. email address, user ID, profile details)',
            '– Content data (e.g. projects, tasks, comments, messages, uploaded files)',
            '– Usage and technical data (e.g. timestamps, device and browser information, logs)',
            '– Communication data from contact requests',
          ],
        },
        {
          h: 'Purposes and legal bases',
          p: [
            'Processing takes place to fulfil the contract and provide the platform (Art. 6(1)(b) GDPR), to protect legitimate interests such as security and stable operation (Art. 6(1)(f) GDPR), to comply with legal obligations (Art. 6(1)(c) GDPR) and — where required — on the basis of consent (Art. 6(1)(a) GDPR).',
          ],
        },
        {
          h: 'Services and recipients',
          lines: [
            'The following services are used to run the platform:',
            '– Google Firebase (authentication, database)',
            '– Hostinger (web hosting, file storage, email delivery)',
            '– Jitsi / 8x8 (video conferencing)',
          ],
          p: [
            'This may involve processing in third countries. In such cases appropriate safeguards such as standard contractual clauses are used.',
          ],
        },
        {
          h: 'Storage period',
          p: [
            'Personal data is stored only as long as necessary for the respective purpose or as required by statutory retention obligations. After that, data is deleted or anonymised.',
          ],
        },
        {
          h: 'Your rights',
          p: [
            'Under the GDPR you have the right to information, rectification, erasure, restriction of processing, data portability and objection, and — where consent was given — the right to withdraw it with effect for the future. You also have the right to lodge a complaint with a data protection authority.',
          ],
        },
        {
          h: 'Data security',
          p: [
            'Appropriate technical and organisational measures are in place to protect personal data against loss, manipulation and unauthorised access.',
          ],
        },
        {
          h: 'EU dispute resolution',
          odr: true,
          p: ['Our email address can be found above in this legal notice.'],
        },
        {
          h: 'Consumer dispute resolution',
          p: [
            'We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.',
          ],
        },
        {
          h: 'Liability for content',
          p: [
            'As a service provider we are responsible for our own content on these pages under general law pursuant to § 7(1) TMG. Under §§ 8 to 10 TMG, however, we are not obliged to monitor transmitted or stored third-party information, or to investigate circumstances that indicate illegal activity.',
            'Obligations to remove or block the use of information under general law remain unaffected. Liability in this respect is only possible from the moment a specific infringement becomes known. We will remove such content immediately once we become aware of it.',
          ],
        },
        {
          h: 'Liability for links',
          p: [
            'Our site contains links to external third-party websites whose content we cannot influence. We therefore cannot accept any liability for this external content. The respective provider or operator of the linked pages is always responsible for their content.',
          ],
        },
        {
          h: 'Copyright',
          p: [
            'Content and works created by the site operators on these pages are subject to German copyright law. Reproduction, editing, distribution and any kind of use beyond the limits of copyright law require the written consent of the respective author or creator.',
          ],
        },
        {
          h: 'Please note',
          p: [
            'This information is provided for transparency and does not replace individual legal advice. The German version of this legal notice is authoritative.',
          ],
        },
      ];
}

function ImpressumContent() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const de = language === 'de';

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:py-12 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {de ? 'Zurück' : 'Back'}
        </Button>

        <div className="flex items-center gap-2 mb-6">
          <OrbyloxMark className="w-9 h-9" />
          <span className="text-lg font-extrabold tracking-tight text-slate-900">RBYLOX</span>
        </div>

        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-8">
          {de ? 'Impressum' : 'Legal notice'}
        </h1>

        <div className="space-y-8">
          {sections(de).map((s) => (
            <section key={s.h}>
              <h2 className="text-xl font-bold text-slate-900 mb-3">{s.h}</h2>

              {s.lines && (
                <p className="text-slate-600 leading-relaxed">
                  {s.lines.map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
                </p>
              )}

              {s.mail && (
                <p className="text-slate-600">
                  {de ? 'E-Mail: ' : 'Email: '}
                  <a href="mailto:info@orbylox.de" className="text-[#ef5a24] hover:underline">
                    info@orbylox.de
                  </a>
                </p>
              )}

              {s.odr && (
                <p className="text-slate-600 leading-relaxed">
                  {de
                    ? 'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit: '
                    : 'The European Commission provides a platform for online dispute resolution: '}
                  <a href={ODR_URL} target="_blank" rel="noopener noreferrer" className="text-[#ef5a24] hover:underline">
                    {ODR_URL}
                  </a>
                </p>
              )}

              {s.p?.map((text, i) => (
                <p key={i} className="text-slate-600 leading-relaxed mt-2">
                  {text}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t-2 border-black text-center text-sm text-slate-500">
          © {new Date().getFullYear()} ORBYLOX
        </div>
      </div>
    </div>
  );
}

export default function Impressum() {
  return (
    <LanguageProvider>
      <ImpressumContent />
    </LanguageProvider>
  );
}
