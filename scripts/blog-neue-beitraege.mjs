/**
 * Drei neue Ratgeber in die Saatdatei legen — deutsch und englisch.
 *
 *   node scripts/blog-neue-beitraege.mjs
 *
 * WARUM EIN SKRIPT UND NICHT VON HAND IN DIE JSON
 * Die Saatdatei ist eine einzige lange JSON-Zeile je Beitrag. Markdown mit
 * Tabellen und Anführungszeichen direkt hineinzuschreiben geht beim ersten
 * Zeilenumbruch schief, und der Fehler fällt erst auf dem Server auf. Hier
 * steht der Text als normaler Text, und `JSON.stringify` kümmert sich ums
 * Maskieren.
 *
 * Das Skript ist idempotent: Beiträge, deren `slug` schon in der Datei steht,
 * werden übersprungen. Zweimal laufen lassen schadet nicht.
 *
 * NACH DEM AUSLIEFERN muss auf dem Server einmal
 *   php blog-seed.php
 * laufen, sonst kennt der Blog die neuen Beiträge nicht.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datei = path.join(wurzel, 'public/api/blog-posts.seed.json');

const AUTOR = { author: 'JeyJey', author_email: 'jey.afandiyev@gmail.com' };
const WANN = '2026-09-16T09:00:00+00:00';

/* ------------------------------------------------------------------ 1 / DE */

const raciDe = `Die häufigste Antwort auf die Frage „wer macht das?" ist Schweigen. Nicht, weil niemand will — sondern weil vier Leute annehmen, einer der anderen drei sei gemeint.

Aufgabenverteilung ist kein Organigramm. Sie ist eine Liste von Sätzen der Form: **Diese Aufgabe, diese Person, dieses Datum.** Alles, was unbestimmter ist, ist keine Verteilung, sondern eine Hoffnung.

## Warum Aufgaben liegen bleiben

Drei Ursachen, in dieser Reihenfolge:

1. **Niemand ist genannt.** Die Aufgabe steht auf dem Board, aber ohne Namen. Jeder sieht sie, keiner besitzt sie.
2. **Zu viele sind genannt.** „Das machen Lena und Tom zusammen" heisst in der Praxis oft: keiner fängt an, weil jeder auf den anderen wartet.
3. **Der Genannte weiss es nicht.** Zugewiesen im Werkzeug, nie ausgesprochen. Wer seinen Namen nicht gesehen hat, hat die Aufgabe nicht.

Keine dieser Ursachen ist ein Motivationsproblem. Alle drei sind Zuordnungsprobleme, und die lassen sich lösen.

## Die eine Regel

**Eine Aufgabe hat genau einen Verantwortlichen.**

Nicht einen Bearbeiter — daran können mehrere sitzen. Einen Verantwortlichen: die Person, die man fragt, wenn man wissen will, wie es steht. Sie muss die Arbeit nicht selbst tun. Sie muss wissen, wo die Arbeit steht.

Sobald zwei Namen an einer Aufgabe stehen, ist die Frage „wie steht es?" nicht mehr eindeutig beantwortbar. Genau daran stirbt die Aufgabe.

## RACI, ohne den Beraterballast

RACI ist vier Buchstaben für vier Rollen. Es hat einen schlechten Ruf, weil es oft als Tabelle mit sechzig Zeilen auftritt, die niemand pflegt. In klein ist es nützlich:

| Buchstabe | Rolle | Wie viele |
|---|---|---|
| **R** — Responsible | tut die Arbeit | eine oder mehrere |
| **A** — Accountable | verantwortet das Ergebnis | **immer genau eine** |
| **C** — Consulted | wird vorher gefragt | wenige |
| **I** — Informed | wird nachher informiert | beliebig |

Die einzige Zeile, die wirklich zählt, ist **A**. Wenn ihr die anderen drei weglasst und nur festhaltet, wer für jedes Arbeitspaket geradesteht, habt ihr neunzig Prozent des Nutzens.

## Vorlage zum Abschreiben

Für ein kleines Team reicht diese Tabelle. Eine Zeile je Arbeitspaket, nicht je Aufgabe — sonst wird sie zu lang und niemand pflegt sie.

| Arbeitspaket | Verantwortlich (A) | Beteiligt (R) | Vorher fragen (C) | Fertig bis |
|---|---|---|---|---|
| Entwurf Startseite | Lena | Lena, Tom | Kundin | 24.09. |
| Texte Speisekarte | Tom | Tom | Küche | 27.09. |
| Tischreservierung | Jey | Jey, Lena | — | 04.10. |
| Impressum prüfen | Jey | Steuerberater | — | 06.10. |

Vier Spalten, die man in fünf Minuten ausfüllt. Wenn eine Zeile nicht befüllbar ist, weil unklar ist, wer verantwortet — dann habt ihr genau das gefunden, wonach diese Tabelle sucht.

## Wie viel darf eine Person tragen?

Eine Faustregel, die sich bewährt hat: **niemand ist gleichzeitig für mehr als drei laufende Arbeitspakete verantwortlich.**

Das ist keine Aussage über Fleiss. Es ist eine Aussage über Aufmerksamkeit: Wer vier Dinge gleichzeitig verantwortet, verliert bei einem davon den Überblick, und man weiss vorher nicht, bei welchem.

Zählt die A-Spalte einmal durch. Steht ein Name siebenmal, ist das kein Verteilungsplan, sondern ein Engpass mit Tabellenformatierung.

## Der Satz, der beim Verteilen fehlt

Zuweisen ist nicht dasselbe wie übergeben. Die Übergabe braucht drei Angaben, und wenn eine fehlt, kommt die Aufgabe zurück:

- **Was genau ist fertig?** Nicht „Texte schreiben", sondern „18 Gerichte beschrieben, Allergene geprüft, im Dokument abgelegt".
- **Bis wann?** Ein Datum, kein „diese Woche".
- **Was, wenn es klemmt?** An wen wendet man sich, ohne warten zu müssen.

Diese drei Angaben passen in zwei Sätze. Sie sparen die Rückfrage, die sonst drei Tage später kommt.

## Wann neu verteilt wird

Aufgabenverteilung ist kein einmaliger Akt. Zwei Anlässe, an denen sie überprüft gehört:

**Wenn jemand ausfällt.** Krankheit, Urlaub, Kündigung. Die A-Spalte sagt sofort, was ohne diese Person stillsteht — das ist ihr zweiter Nutzen.

**Wenn eine Aufgabe zweimal verschoben wurde.** Zweimal verschoben heisst fast nie „zu wenig Zeit". Es heisst meistens: falsch geschnitten, falsch zugeordnet, oder blockiert durch etwas, das niemand aufgeschrieben hat.

## In ORBYLOX

Jedes Ticket hat genau ein Feld für die verantwortliche Person und ein Fälligkeitsdatum. Wer zugewiesen wird, bekommt eine E-Mail — die Übergabe passiert also nicht nur im Werkzeug, sondern erreicht den Menschen.

Über die Filterleiste seht ihr das Board nach Person gefiltert: Das ist die A-Spalte in Kartenform, und sie zeigt Engpässe schneller als jede Tabelle. Bleibt ein Projekt länger als eine Woche unberührt, meldet sich die Liste von selbst.

Aufgabenverteilung ist am Ende unspektakulär: ein Name, ein Datum, ein klarer Satz, was fertig heisst. Der Aufwand liegt nicht im Werkzeug, sondern darin, die Unklarheit auszuhalten, die beim Ausfüllen sichtbar wird.`;

/* ------------------------------------------------------------------ 1 / EN */

const raciEn = `The most common answer to "who is doing this?" is silence. Not because nobody wants to — but because four people each assume one of the other three was meant.

Task allocation is not an org chart. It is a list of sentences in the form: **this task, this person, this date.** Anything vaguer than that is not an allocation, it is a hope.

## Why tasks stall

Three causes, in this order:

1. **Nobody is named.** The task is on the board, but without a name. Everyone sees it, nobody owns it.
2. **Too many are named.** "Lena and Tom will do it together" often means in practice: neither starts, because each waits for the other.
3. **The named person does not know.** Assigned in the tool, never said out loud. Someone who has not seen their own name does not have the task.

None of these is a motivation problem. All three are assignment problems, and those can be fixed.

## The one rule

**A task has exactly one accountable person.**

Not one worker — several people can work on it. One accountable person: the one you ask when you want to know where it stands. They do not have to do the work themselves. They have to know where the work is.

The moment two names sit on a task, "how is it going?" no longer has one clear answer. That is exactly where the task dies.

## RACI, without the consultant baggage

RACI is four letters for four roles. It has a bad reputation because it usually shows up as a sixty-row table nobody maintains. Kept small, it is useful:

| Letter | Role | How many |
|---|---|---|
| **R** — Responsible | does the work | one or more |
| **A** — Accountable | owns the outcome | **always exactly one** |
| **C** — Consulted | asked beforehand | few |
| **I** — Informed | told afterwards | any number |

The only row that really matters is **A**. If you drop the other three and record only who answers for each work package, you have ninety percent of the value.

## Template to copy

For a small team this table is enough. One row per work package, not per task — otherwise it grows too long and nobody maintains it.

| Work package | Accountable (A) | Working on it (R) | Ask first (C) | Done by |
|---|---|---|---|---|
| Homepage design | Lena | Lena, Tom | Client | Sep 24 |
| Menu copy | Tom | Tom | Kitchen | Sep 27 |
| Table booking | Jey | Jey, Lena | — | Oct 4 |
| Legal pages review | Jey | Accountant | — | Oct 6 |

Four columns you can fill in five minutes. If a row cannot be filled because it is unclear who is accountable — you have found exactly what this table is looking for.

## How much can one person carry?

A rule of thumb that holds up: **nobody is accountable for more than three running work packages at once.**

This is not a statement about diligence. It is a statement about attention: whoever owns four things at once loses track of one of them, and you cannot tell in advance which one.

Count the A column. If one name appears seven times, that is not an allocation plan, it is a bottleneck with table formatting.

## The sentence missing from most handovers

Assigning is not the same as handing over. A handover needs three things, and if one is missing the task comes back:

- **What exactly is done?** Not "write the copy", but "18 dishes described, allergens checked, filed in the document".
- **By when?** A date, not "this week".
- **What if it gets stuck?** Who to turn to without waiting.

Those three fit into two sentences. They save the follow-up question that otherwise arrives three days later.

## When to reallocate

Task allocation is not a one-off act. Two occasions call for a review:

**When someone drops out.** Illness, holiday, resignation. The A column tells you immediately what stops without that person — that is its second use.

**When a task has been postponed twice.** Twice postponed almost never means "not enough time". It usually means: cut wrong, assigned wrong, or blocked by something nobody wrote down.

## In ORBYLOX

Every ticket has exactly one field for the accountable person and one due date. Whoever gets assigned receives an email — so the handover does not only happen in the tool, it reaches the human.

The filter bar shows the board filtered by person: that is the A column in card form, and it exposes bottlenecks faster than any table. If a project goes untouched for more than a week, the list says so on its own.

Task allocation is ultimately unspectacular: a name, a date, a clear sentence about what done means. The effort is not in the tool. It is in sitting with the uncertainty that becomes visible while you fill it in.`;

/* ------------------------------------------------------------------ 2 / DE */

const statusDe = `Ein Statusbericht, den niemand liest, ist teurer als gar keiner: Er kostet die Zeit beim Schreiben und erzeugt trotzdem keine Klarheit.

Das Problem ist fast immer dasselbe. Der Bericht erzählt, was das Team **getan** hat. Interessant ist aber, wo das Projekt **steht** — und ob jemand etwas tun muss.

## Was ein Statusbericht beantworten muss

Genau drei Fragen. Wer eine vierte einbaut, verlängert den Bericht, ohne ihn nützlicher zu machen.

1. **Sind wir im Plan?** Ja, nein, oder knapp — mit Zahl, nicht mit Gefühl.
2. **Was blockiert?** Und wer muss es lösen.
3. **Was ändert sich?** Termin, Umfang oder Kosten — oder ausdrücklich: nichts.

Ein Bericht, der auf alle drei antwortet, passt auf eine halbe Seite. Alles darüber hinaus ist Protokoll, und Protokolle gehören woandershin.

## Die Ampel, richtig benutzt

Grün, Gelb, Rot sind nützlich, wenn sie definiert sind — und nutzlos, wenn jeder sie anders meint. Legt einmal fest, was sie heissen:

| Farbe | Heisst | Und verlangt |
|---|---|---|
| **Grün** | im Plan, keine Hilfe nötig | nichts |
| **Gelb** | Termin wackelt, wir lösen es selbst | Kenntnisnahme |
| **Rot** | Termin fällt, wir lösen es nicht allein | eine Entscheidung |

Die entscheidende Spalte ist die dritte. Rot ohne eine konkrete Bitte ist kein Alarm, sondern Jammern — und wird beim dritten Mal ignoriert.

**Gelb ist die wichtigste Farbe.** Projekte springen selten von Grün auf Rot. Sie stehen wochenlang auf Gelb, und niemand handelt, weil Gelb wie „läuft schon" aussieht. Wer zweimal hintereinander Gelb meldet, sollte beim dritten Mal Rot melden.

## Vorlage zum Abschreiben

**Projekt:** Webseite Café Morgen
**Woche:** KW 38 · **Status:** 🟡 Gelb (zweite Woche)

**Im Plan?**
14 von 20 Arbeitspaketen fertig. Geplant waren 16. Rückstand: zwei Pakete, rund vier Tage.

**Was blockiert?**
Die Tischreservierung wartet auf die Freigabe des Startseiten-Entwurfs. Der liegt seit Montag bei der Kundin. → *Bitte: Rückmeldung bis Mittwoch, sonst verschiebt sich die Eröffnung.*

**Was ändert sich?**
Termin: unverändert 15.10., aber ohne Puffer.
Umfang: Die englische Fassung fällt raus (abgestimmt mit der Kundin am 12.09.).
Kosten: unverändert.

**Nächste Woche:**
Reservierung fertigstellen, Fotos einbauen, Impressum vom Steuerberater zurück.

---

Das ist der ganze Bericht. Fünf Minuten Schreibarbeit, und jede Zeile beantwortet eine der drei Fragen.

## Die drei häufigsten Fehler

**Tätigkeiten statt Stand.** „Wir haben an der Reservierung gearbeitet" sagt nichts. „Reservierung: Formular fertig, Bestätigungsmail offen, 60 Prozent" sagt etwas. Der Unterschied ist, ob man daraus einen Termin ableiten kann.

**Blocker ohne Adressat.** „Warten auf Freigabe" ist eine Feststellung. „Warten auf Freigabe von Frau Berger, seit Montag, blockiert vier Tage Arbeit" ist eine Bitte. Nur die zweite Form löst etwas aus.

**Grün bis zum Knall.** Wer Woche für Woche Grün meldet und dann zwei Wochen vor dem Termin Rot, hat nicht schlecht berichtet — er hat gar nicht berichtet. Ein Statusbericht ist ein Frühwarnsystem oder er ist Dekoration.

## Wie oft?

Wöchentlich, wenn das Projekt kürzer als ein halbes Jahr läuft. Alle zwei Wochen darüber hinaus.

Täglich ist kein Statusbericht, sondern ein Standup — der ist mündlich und geht an das Team, nicht an die Leitung. Monatlich ist zu selten: Ein Problem, das vier Wochen unbemerkt wächst, ist keines mehr, sondern ein Termin.

## Wer bekommt ihn?

Je kleiner der Verteiler, desto ehrlicher der Bericht. Wer weiss, dass zwölf Leute mitlesen, schreibt vorsichtiger — und vorsichtige Berichte sind die unbrauchbaren.

Faustregel: der Verteiler besteht aus den Personen, die auf „Rot" reagieren könnten. Alle anderen bekommen den Bericht auf Nachfrage.

## In ORBYLOX

Die Zahlen für „Sind wir im Plan?" stehen schon auf dem Board: erledigte gegen offene Tickets, Story Points je Spalte. Blockaden sind als Abhängigkeit hinterlegt und damit sichtbar, statt im Kopf einer Person zu stecken.

Wer den Bericht als Notiz im Projekt ablegt, hat ihn nächste Woche als Vorlage — und die Reihe der letzten acht Berichte zeigt auf einen Blick, ob „Gelb" die Ausnahme war oder der Normalzustand.`;

/* ------------------------------------------------------------------ 2 / EN */

const statusEn = `A status report nobody reads is more expensive than no report at all: it costs the time to write and still produces no clarity.

The problem is almost always the same. The report describes what the team **did**. What matters is where the project **stands** — and whether anyone needs to act.

## What a status report has to answer

Exactly three questions. Adding a fourth makes the report longer without making it more useful.

1. **Are we on plan?** Yes, no, or barely — with a number, not a feeling.
2. **What is blocked?** And who has to unblock it.
3. **What changes?** Date, scope or cost — or explicitly: nothing.

A report that answers all three fits on half a page. Anything beyond that is minutes, and minutes belong somewhere else.

## Traffic lights, used properly

Green, amber, red are useful when they are defined — and useless when everyone means something different. Agree once on what they mean:

| Colour | Means | And asks for |
|---|---|---|
| **Green** | on plan, no help needed | nothing |
| **Amber** | date is wobbling, we will fix it | acknowledgement |
| **Red** | date will slip, we cannot fix it alone | a decision |

The decisive column is the third. Red without a concrete request is not an alarm, it is complaining — and by the third time it gets ignored.

**Amber is the most important colour.** Projects rarely jump from green to red. They sit on amber for weeks and nobody acts, because amber looks like "it's fine". Anyone reporting amber twice in a row should report red the third time.

## Template to copy

**Project:** Café Morgen website
**Week:** W38 · **Status:** 🟡 Amber (second week)

**On plan?**
14 of 20 work packages done. 16 were planned. Behind by two packages, roughly four days.

**What is blocked?**
Table booking is waiting on sign-off for the homepage design. It has been with the client since Monday. → *Request: response by Wednesday, otherwise the opening moves.*

**What changes?**
Date: unchanged, Oct 15, but with no buffer left.
Scope: the English version is dropped (agreed with the client on Sep 12).
Cost: unchanged.

**Next week:**
Finish booking, add photos, legal pages back from the accountant.

---

That is the whole report. Five minutes of writing, and every line answers one of the three questions.

## The three most common mistakes

**Activities instead of position.** "We worked on the booking form" says nothing. "Booking: form done, confirmation email open, 60 percent" says something. The difference is whether you can derive a date from it.

**Blockers without an addressee.** "Waiting for sign-off" is an observation. "Waiting for sign-off from Ms Berger, since Monday, blocking four days of work" is a request. Only the second form triggers anything.

**Green until the bang.** Reporting green week after week and then red two weeks before the deadline is not bad reporting — it is no reporting. A status report is an early warning system, or it is decoration.

## How often?

Weekly if the project runs shorter than six months. Every two weeks beyond that.

Daily is not a status report but a standup — that one is spoken and goes to the team, not to management. Monthly is too rare: a problem that grows unnoticed for four weeks is no longer a problem, it is a date.

## Who gets it?

The smaller the distribution list, the more honest the report. Someone who knows twelve people are reading writes more carefully — and careful reports are the useless ones.

Rule of thumb: the list consists of people who could react to "red". Everyone else gets the report on request.

## In ORBYLOX

The numbers for "are we on plan?" are already on the board: done versus open tickets, story points per column. Blockers are recorded as dependencies and therefore visible, instead of living in one person's head.

Filing the report as a note inside the project gives you next week's template — and the run of the last eight reports shows at a glance whether amber was the exception or the normal state.`;

/* ------------------------------------------------------------------ 3 / DE */

const meilensteinDe = `Meilensteine sind das am häufigsten missbrauchte Werkzeug der Projektplanung. In den meisten Plänen sind sie gleichmässig über die Zeitachse verteilte Fähnchen mit Namen wie „Phase 2 abgeschlossen" — und sagen genau nichts.

Ein Meilenstein ist kein Zeitpunkt. Er ist ein **überprüfbarer Zustand**, an dem eine Entscheidung möglich wird.

## Der Unterschied, an dem alles hängt

| Kein Meilenstein | Meilenstein |
|---|---|
| „Konzeptphase abgeschlossen" | „Entwurf von der Kundin freigegeben" |
| „50 % fertig" | „Alle 18 Gerichte beschrieben und geprüft" |
| „Entwicklung läuft" | „Reservierung nimmt echte Buchungen an" |
| „Abstimmung Ende September" | „Termin für die Eröffnung steht schriftlich fest" |

Links steht jeweils eine Tätigkeit oder ein Prozentwert. Beides lässt sich nicht überprüfen — man kann darüber streiten. Rechts steht ein Zustand: Er ist eingetreten oder nicht, und zwei Leute kommen zum selben Ergebnis.

Der Test ist einfach: **Könnten zwei Personen unabhängig voneinander feststellen, ob der Meilenstein erreicht ist?** Wenn nein, ist es keiner.

## Wie viele?

Weniger, als ihr denkt. Für ein Projekt von drei Monaten reichen vier bis sechs.

Der Grund ist nicht Sparsamkeit. Meilensteine sind Haltepunkte, an denen jemand hinschaut und entscheidet — und Aufmerksamkeit ist die knappe Ressource. Zwölf Meilensteine in drei Monaten heisst: jede Woche einer, also wird keiner ernst genommen.

Faustregel: ein Meilenstein alle zwei bis vier Wochen. Häufiger ist Fortschrittskontrolle, und die gehört aufs Board, nicht in den Meilensteinplan.

## Wo Meilensteine hingehören

Nicht gleichmässig verteilt. An genau drei Sorten von Stellen:

**Vor einer teuren Entscheidung.** Bevor Geld ausgegeben oder etwas Unumkehrbares getan wird. Beispiel: „Entwurf freigegeben" steht vor dem Bauen — danach kostet eine Änderung ein Vielfaches.

**Nach einer riskanten Annahme.** Überall dort, wo der Plan auf einer Vermutung steht, gehört ein Meilenstein hin, der sie prüft. „Die Schnittstelle des Zahlungsanbieters funktioniert wie dokumentiert" ist so einer — und man setzt ihn früh, nicht spät.

**Wo eine Übergabe stattfindet.** Immer, wenn Arbeit von einer Person oder einem Gewerk zum nächsten wandert. Genau dort gehen Dinge verloren.

## Vorlage zum Abschreiben

| Meilenstein | Woran erkennbar | Wer bestätigt | Datum | Hängt davon ab |
|---|---|---|---|---|
| Entwurf freigegeben | Kundin hat schriftlich zugestimmt | Frau Berger | 24.09. | — |
| Inhalte vollständig | 18 Gerichte, Allergene, 11 Fotos abgelegt | Tom | 30.09. | — |
| Reservierung nimmt Buchungen an | Testbuchung erzeugt Bestätigungsmail | Jey | 08.10. | Entwurf freigegeben |
| Seite ist öffentlich | Adresse erreichbar, alte Links leiten weiter | Jey | 14.10. | alle oben |

Fünf Spalten. Die zweite ist die wichtigste und wird am häufigsten weggelassen — dann ist der Meilenstein wieder ein Fähnchen.

Die dritte Spalte verhindert den zweithäufigsten Fehler: Ein Meilenstein, den niemand bestätigt, ist nach zwei Wochen „ungefähr erreicht".

## Was passiert, wenn einer gerissen wird

Nichts Dramatisches — aber etwas Bestimmtes. Ein gerissener Meilenstein verlangt eine von drei Entscheidungen, und sie muss innerhalb weniger Tage fallen:

1. **Termin verschieben.** Der Rest bleibt, alles wandert nach hinten.
2. **Umfang kürzen.** Der Termin bleibt, etwas fällt raus — und zwar ausgesprochen, nicht stillschweigend.
3. **Mehr Leute.** Funktioniert nur früh im Projekt und selten so gut wie gehofft.

Was **nicht** zur Auswahl steht: weitermachen und hoffen. Das ist die vierte Option, die in der Praxis am häufigsten gewählt wird, und sie verschiebt den Meilenstein nur bis zum nächsten.

Ein Meilenstein, der reisst, ohne dass eine dieser drei Entscheidungen fällt, war keiner. Er war ein Wunsch mit Datum.

## Der Puffer gehört ans Ende

Verteilt keinen Puffer auf die einzelnen Meilensteine. Er wird sonst aufgebraucht, ob er gebraucht wird oder nicht — jede Aufgabe dehnt sich auf die Zeit aus, die für sie da ist.

Legt die Meilensteine ohne Puffer und hängt zehn bis zwanzig Prozent der Gesamtdauer als einen Block hinter den letzten. Dann seht ihr nach jedem Meilenstein, wie viel davon noch übrig ist — und das ist die ehrlichste Kennzahl, die ein Projekt hat.

## In ORBYLOX

Meilensteine liegen als Termine im Kalender, mit dem Bestätigenden als Teilnehmer — so bekommt er eine Einladung und weiss, dass er gefragt wird.

Die Bedingung „hängt davon ab" steht als Abhängigkeit am Ticket: Das Board sperrt dann, was noch nicht dran ist, statt dass jemand zu früh anfängt und die Arbeit später wegwirft.

Was ihr nicht braucht, ist ein Gantt-Diagramm mit vierzig Balken. Vier bis sechs überprüfbare Zustände, jeweils mit einem Namen daneben, tragen ein Projekt weiter als jede Balkengrafik.`;

/* ------------------------------------------------------------------ 3 / EN */

const meilensteinEn = `Milestones are the most misused tool in project planning. In most plans they are evenly spaced flags on a timeline with names like "Phase 2 complete" — and they say precisely nothing.

A milestone is not a point in time. It is a **verifiable state** at which a decision becomes possible.

## The distinction everything hangs on

| Not a milestone | Milestone |
|---|---|
| "Concept phase complete" | "Design signed off by the client" |
| "50 % done" | "All 18 dishes described and checked" |
| "Development underway" | "Booking form accepts real reservations" |
| "Review end of September" | "Opening date confirmed in writing" |

On the left there is an activity or a percentage. Neither can be verified — you can argue about both. On the right there is a state: it has happened or it has not, and two people reach the same answer.

The test is simple: **could two people independently determine whether the milestone is reached?** If not, it is not one.

## How many?

Fewer than you think. For a three-month project, four to six is enough.

The reason is not thrift. Milestones are stopping points where someone looks and decides — and attention is the scarce resource. Twelve milestones in three months means one a week, so none is taken seriously.

Rule of thumb: one milestone every two to four weeks. More often than that is progress tracking, and that belongs on the board, not in the milestone plan.

## Where milestones belong

Not evenly spaced. At exactly three kinds of place:

**Before an expensive decision.** Before money is spent or something irreversible is done. Example: "design signed off" comes before building — after that, a change costs many times more.

**After a risky assumption.** Wherever the plan rests on a guess, put a milestone that tests it. "The payment provider's API works as documented" is one of those — and you place it early, not late.

**Where a handover happens.** Whenever work passes from one person or trade to the next. That is exactly where things get lost.

## Template to copy

| Milestone | How you can tell | Who confirms | Date | Depends on |
|---|---|---|---|---|
| Design signed off | Client agreed in writing | Ms Berger | Sep 24 | — |
| Content complete | 18 dishes, allergens, 11 photos filed | Tom | Sep 30 | — |
| Booking accepts reservations | Test booking produces confirmation email | Jey | Oct 8 | Design signed off |
| Site is public | Address reachable, old links redirect | Jey | Oct 14 | all above |

Five columns. The second is the most important and the most often left out — and then the milestone is a flag again.

The third column prevents the second most common mistake: a milestone nobody confirms is "roughly reached" two weeks later.

## What happens when one is missed

Nothing dramatic — but something definite. A missed milestone demands one of three decisions, and it has to be made within days:

1. **Move the date.** Everything else stays, the whole thing shifts back.
2. **Cut scope.** The date stays, something drops out — said out loud, not silently.
3. **Add people.** Works only early in a project, and rarely as well as hoped.

What is **not** on the list: carry on and hope. That is the fourth option, the one most often chosen in practice, and it only postpones the milestone to the next one.

A milestone that slips without one of those three decisions was not a milestone. It was a wish with a date.

## The buffer belongs at the end

Do not spread buffer across individual milestones. It gets consumed whether it is needed or not — every task expands to fill the time available to it.

Set the milestones without buffer and hang ten to twenty percent of the total duration as one block behind the last one. Then after each milestone you can see how much of it is left — and that is the most honest metric a project has.

## In ORBYLOX

Milestones live as calendar events with the confirming person as an attendee — so they get an invitation and know they will be asked.

The "depends on" condition is recorded as a dependency on the ticket: the board then locks what is not ready yet, instead of someone starting early and throwing the work away later.

What you do not need is a Gantt chart with forty bars. Four to six verifiable states, each with a name beside it, will carry a project further than any bar graph.`;

/* ------------------------------------------------------------------ Einträge */

const neu = [
  {
    id: 'p9de',
    locale: 'de',
    slug: 'aufgaben-im-team-verteilen',
    title: 'Aufgaben im Team verteilen: eine Regel, eine Vorlage',
    seo_title: 'Aufgabenverteilung im Team: Anleitung, RACI, Vorlage',
    meta_description:
      'Warum Aufgaben liegen bleiben, die eine Regel, die es verhindert, und eine RACI-Vorlage zum Abschreiben. Mit Faustregel, wie viel eine Person tragen kann.',
    excerpt:
      'Die häufigste Antwort auf „wer macht das?" ist Schweigen — nicht aus Unwillen, sondern weil vier Leute annehmen, einer der anderen drei sei gemeint.',
    category: 'Projektmanagement',
    tags: ['Aufgabenverteilung', 'RACI', 'Team', 'Verantwortung', 'Vorlage'],
    featured_image: '/screens/tasks.webp',
    featured_alt: 'Aufgaben mit Zuständigen auf dem Kanban-Board in ORBYLOX',
    translation_of: 'sharing-out-work-in-a-team',
    related_slugs: ['projektplan-erstellen-schritt-fuer-schritt', 'kanban-board-richtig-aufsetzen'],
    content: raciDe,
  },
  {
    id: 'p9en',
    locale: 'en',
    slug: 'sharing-out-work-in-a-team',
    title: 'Sharing out work in a team: one rule, one template',
    seo_title: 'Task allocation in a team: guide, RACI, template',
    meta_description:
      'Why tasks stall, the one rule that prevents it, and a RACI template to copy. Including a rule of thumb for how much one person can carry.',
    excerpt:
      'The most common answer to "who is doing this?" is silence — not from unwillingness, but because four people each assume one of the other three was meant.',
    category: 'Project management',
    tags: ['Task allocation', 'RACI', 'Team', 'Accountability', 'Template'],
    featured_image: '/screens/tasks.webp',
    featured_alt: 'Tasks with owners on the kanban board in ORBYLOX',
    translation_of: 'aufgaben-im-team-verteilen',
    related_slugs: ['how-to-create-a-project-plan', 'setting-up-a-kanban-board'],
    content: raciEn,
  },
  {
    id: 'p10de',
    locale: 'de',
    slug: 'projektstatusbericht-schreiben',
    title: 'Projektstatusbericht: drei Fragen, eine halbe Seite',
    seo_title: 'Projektstatusbericht schreiben: Vorlage und Beispiel',
    meta_description:
      'Ein Statusbericht beantwortet drei Fragen: Sind wir im Plan, was blockiert, was ändert sich. Mit Ampel-Definition, Vorlage zum Abschreiben und den drei häufigsten Fehlern.',
    excerpt:
      'Ein Statusbericht, den niemand liest, ist teurer als gar keiner. Das Problem ist fast immer dasselbe: Er erzählt, was getan wurde, statt wo das Projekt steht.',
    category: 'Projektmanagement',
    tags: ['Statusbericht', 'Projektstatus', 'Ampel', 'Berichtswesen', 'Vorlage'],
    featured_image: '/screens/feed.webp',
    featured_alt: 'Projekt-Feed mit Statusmeldungen in ORBYLOX',
    translation_of: 'writing-a-project-status-report',
    related_slugs: ['meilensteine-planen', 'projektplan-erstellen-schritt-fuer-schritt'],
    content: statusDe,
  },
  {
    id: 'p10en',
    locale: 'en',
    slug: 'writing-a-project-status-report',
    title: 'Project status report: three questions, half a page',
    seo_title: 'Writing a project status report: template and example',
    meta_description:
      'A status report answers three questions: are we on plan, what is blocked, what changes. With traffic-light definitions, a template to copy and the three most common mistakes.',
    excerpt:
      'A status report nobody reads is more expensive than no report at all. The problem is almost always the same: it says what was done instead of where the project stands.',
    category: 'Project management',
    tags: ['Status report', 'Project status', 'Traffic light', 'Reporting', 'Template'],
    featured_image: '/screens/feed.webp',
    featured_alt: 'Project feed with status updates in ORBYLOX',
    translation_of: 'projektstatusbericht-schreiben',
    related_slugs: ['planning-milestones', 'how-to-create-a-project-plan'],
    content: statusEn,
  },
  {
    id: 'p11de',
    locale: 'de',
    slug: 'meilensteine-planen',
    title: 'Meilensteine planen: Zustände statt Fähnchen',
    seo_title: 'Meilensteine planen: Definition, Beispiele, Vorlage',
    meta_description:
      'Ein Meilenstein ist kein Zeitpunkt, sondern ein überprüfbarer Zustand. Wie viele ihr braucht, wo sie hingehören, was bei einem gerissenen zu entscheiden ist — mit Vorlage.',
    excerpt:
      'In den meisten Plänen sind Meilensteine gleichmässig verteilte Fähnchen mit Namen wie „Phase 2 abgeschlossen" — und sagen genau nichts.',
    category: 'Projektmanagement',
    tags: ['Meilensteine', 'Meilensteinplan', 'Projektplanung', 'Puffer', 'Vorlage'],
    featured_image: '/screens/canvas.webp',
    featured_alt: 'Meilensteine und Abhängigkeiten auf dem Canvas in ORBYLOX',
    translation_of: 'planning-milestones',
    related_slugs: ['projektplan-erstellen-schritt-fuer-schritt', 'abhaengigkeiten-sichtbar-machen'],
    content: meilensteinDe,
  },
  {
    id: 'p11en',
    locale: 'en',
    slug: 'planning-milestones',
    title: 'Planning milestones: states, not flags',
    seo_title: 'Planning milestones: definition, examples, template',
    meta_description:
      'A milestone is not a point in time but a verifiable state. How many you need, where they belong, what to decide when one slips — with a template to copy.',
    excerpt:
      'In most plans, milestones are evenly spaced flags with names like "Phase 2 complete" — and they say precisely nothing.',
    category: 'Project management',
    tags: ['Milestones', 'Milestone plan', 'Project planning', 'Buffer', 'Template'],
    featured_image: '/screens/canvas.webp',
    featured_alt: 'Milestones and dependencies on the canvas in ORBYLOX',
    translation_of: 'meilensteine-planen',
    related_slugs: ['how-to-create-a-project-plan', 'making-dependencies-visible'],
    content: meilensteinEn,
  },
].map((p) => ({
  ...AUTOR,
  ...p,
  published_at: WANN,
  created_at: WANN,
  updated_at: WANN,
  status: 'published',
  og_image: p.featured_image,
  canonical_url: '',
}));

/* ------------------------------------------------------------------ Schreiben */

const vorhanden = JSON.parse(fs.readFileSync(datei, 'utf8'));
const slugs = new Set(vorhanden.map((p) => p.slug));
const zuLegen = neu.filter((p) => !slugs.has(p.slug));

if (!zuLegen.length) {
  console.log('Alle sechs Beiträge stehen schon in der Saatdatei — nichts zu tun.');
  process.exit(0);
}

const alle = [...vorhanden, ...zuLegen];
fs.writeFileSync(datei, `${JSON.stringify(alle, null, 2)}\n`, 'utf8');

for (const p of zuLegen) {
  console.log(`  + ${p.locale}  ${p.slug.padEnd(34)} ${String(p.content.split(/\s+/).length).padStart(5)} Wörter`);
}
console.log(`\n${zuLegen.length} Beiträge ergänzt, ${alle.length} insgesamt.`);
console.log('Auf dem Server danach einmal:  php blog-seed.php');
