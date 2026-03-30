import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Impressum() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Legal Notice (Impressum)</h1>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Angaben gemaess Paragraf 5 TMG</h2>
            <p className="text-slate-600">
              Jeyhun Afandiyev<br />
              c/o Online-Impressum #6833<br />
              Europaring 90<br />
              53757 Sankt Augustin<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Kontakt</h2>
            <p className="text-slate-600">
              E-Mail: jeyhun.afandiyev@mail.online-impressum.de
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Zweiter Kontaktweg</h2>
            <p className="text-slate-600">
              Kontaktaufnahme ist zusaetzlich ueber die in der Anwendung bereitgestellten Kontaktwege moeglich.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Zustaendige Regulierungs- und Aufsichtsbehoerde</h2>
            <p className="text-slate-600">
              Medienanstalt Hessen<br />
              Sitz: Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Verantwortlich fuer den Inhalt</h2>
            <p className="text-slate-600">
              Jeyhun Afandiyev<br />
              c/o Online-Impressum #6833<br />
              Europaring 90<br />
              53757 Sankt Augustin<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Hinweis zur Verarbeitung personenbezogener Daten (Datenschutz-Info)</h2>
            <p className="text-slate-600">
              Diese Anwendung verarbeitet personenbezogene Daten nur im erforderlichen Umfang, um die Plattform bereitzustellen, die Sicherheit zu gewaehrleisten und Funktionen auszufuehren.
              Die nachfolgenden Informationen geben einen Ueberblick ueber Datenkategorien, Zwecke und eingesetzte Dienste.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Verarbeitete Datenkategorien</h2>
            <p className="text-slate-600">
              - Konto- und Identifikationsdaten (z. B. E-Mail-Adresse, User-ID, Profilangaben)<br />
              - Inhaltsdaten (z. B. Projekte, Aufgaben, Kommentare, Nachrichten, hochgeladene Dateien/Bilder)<br />
              - Nutzungs- und technische Daten (z. B. Zeitstempel, Geraete-/Browserinformationen, Sicherheits- und Fehlerprotokolle)<br />
              - Kommunikationsdaten bei Kontaktanfragen
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Zwecke und Rechtsgrundlagen</h2>
            <p className="text-slate-600">
              Die Verarbeitung erfolgt insbesondere zur Vertragserfuellung und Bereitstellung der Plattform (Art. 6 Abs. 1 lit. b DSGVO),
              zur Wahrung berechtigter Interessen wie Sicherheit, Missbrauchspraevention und stabilem Betrieb (Art. 6 Abs. 1 lit. f DSGVO),
              auf Basis gesetzlicher Pflichten (Art. 6 Abs. 1 lit. c DSGVO) sowie - soweit erforderlich - auf Grundlage einer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Eingesetzte Dienste und Empfaenger</h2>
            <p className="text-slate-600">
              Zur technischen Bereitstellung koennen insbesondere folgende Auftragsverarbeiter bzw. externe Dienste eingesetzt werden:<br />
              - Google Firebase (z. B. Authentifizierung, Datenbank, ggf. weitere Plattformdienste)<br />
              - Cloudinary (Datei- und Medienverarbeitung/Speicherung)<br />
              - KI-/API-Dienste fuer optionale Funktionen (z. B. Textverarbeitung), sofern vom Nutzer aktiv genutzt
            </p>
            <p className="text-slate-600 mt-2">
              Dabei kann eine Verarbeitung in Drittstaaten (z. B. ausserhalb der EU/EWR) stattfinden. In solchen Faellen werden geeignete Garantien
              wie Standardvertragsklauseln (SCC) oder vergleichbare Schutzmechanismen verwendet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Speicherdauer</h2>
            <p className="text-slate-600">
              Personenbezogene Daten werden nur so lange gespeichert, wie dies fuer die jeweiligen Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
              Danach werden Daten geloescht oder anonymisiert.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Betroffenenrechte</h2>
            <p className="text-slate-600">
              Betroffene Personen haben nach DSGVO insbesondere das Recht auf Auskunft, Berichtigung, Loeschung, Einschraenkung der Verarbeitung, Datenuebertragbarkeit,
              Widerspruch sowie - bei Einwilligungen - Widerruf mit Wirkung fuer die Zukunft. Zudem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehoerde.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Datensicherheit</h2>
            <p className="text-slate-600">
              Es werden angemessene technische und organisatorische Massnahmen umgesetzt, um personenbezogene Daten vor Verlust, Manipulation und unberechtigtem Zugriff zu schuetzen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">EU dispute resolution</h2>
            <p className="text-slate-600">
              The European Commission provides a platform for online dispute resolution (ODR):{' '}
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                https://ec.europa.eu/consumers/odr/
              </a>
              <br />
              Our email address can be found above in the legal notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Consumer dispute resolution</h2>
            <p className="text-slate-600">
              We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Liability for content</h2>
            <p className="text-slate-600">
              As a service provider we are responsible for our own content on these pages in accordance with general laws pursuant to § 7 para. 1 TMG. According to §§ 8 to 10 TMG we are not obliged to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity.
            </p>
            <p className="text-slate-600 mt-2">
              Obligations to remove or block the use of information under general law remain unaffected. However, liability in this regard is only possible from the time of knowledge of a specific legal violation. Upon becoming aware of corresponding legal violations we will remove this content immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Liability for links</h2>
            <p className="text-slate-600">
              Our site contains links to external third-party websites over whose content we have no influence. Therefore we cannot assume any liability for this external content. The respective provider or operator of the linked pages is always responsible for the content of the linked pages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Copyright</h2>
            <p className="text-slate-600">
              The content and works created by the site operators on these pages are subject to copyright law. Reproduction, editing, distribution and any kind of use outside the limits of copyright law require the written consent of the respective author or creator.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Wichtiger Hinweis</h2>
            <p className="text-slate-600">
              Diese Angaben dienen der transparenten Information und ersetzen keine individuelle Rechtsberatung.
              Fuer eine abschliessende rechtliche Absicherung wird eine Pruefung durch eine qualifizierte Rechtsberatung empfohlen.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-sm text-slate-400">
          © 2024 ORBYLOX. All rights reserved.
        </div>
      </div>
    </div>
  );
}
