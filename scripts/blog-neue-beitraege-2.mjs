/**
 * Vier weitere Ratgeber in die Saatdatei legen — deutsch und englisch.
 *
 *   node scripts/blog-neue-beitraege-2.mjs
 *
 * Gleiches Vorgehen wie `blog-neue-beitraege.mjs`: Der Text steht hier als
 * normaler Text, `JSON.stringify` maskiert. Wer Markdown mit Tabellen direkt
 * in die JSON tippt, merkt den Fehler erst auf dem Server.
 *
 * Idempotent: Was schon drinsteht, wird übersprungen.
 *
 * NACH DEM AUSLIEFERN auf dem Server einmal:  php blog-seed.php
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datei = path.join(wurzel, 'public/api/blog-posts.seed.json');

const AUTOR = { author: 'JeyJey', author_email: 'jey.afandiyev@gmail.com' };
const WANN = '2026-09-17T09:00:00+00:00';

/* ------------------------------------------------------------- 1 / Gantt DE */

const ganttDe = `Kaum ein Werkzeug wird so oft verlangt und so selten gebraucht wie das Gantt-Diagramm. „Wir brauchen einen Gantt" heisst in neun von zehn Fällen eigentlich: „Ich will wissen, wann wir fertig sind." Das sind zwei verschiedene Wünsche.

## Was ein Gantt-Diagramm wirklich zeigt

Ein Balken je Arbeitspaket, waagerecht über eine Zeitachse gelegt. Die Länge ist die Dauer, die Position der Zeitraum, Pfeile dazwischen die Abhängigkeiten.

Der eigentliche Nutzen liegt nicht in den Balken. Er liegt in den Pfeilen: Ein Gantt zeigt, **welche Verzögerung sich nach hinten durchschlägt und welche nicht**. Das kann ein Kanban-Board nicht.

Alles andere — der Überblick, wer woran arbeitet, was als Nächstes dran ist — kann ein Board besser.

## Wann es sich lohnt, wann nicht

| Ein Gantt hilft | Ein Board reicht |
|---|---|
| feste Reihenfolge, physische Abhängigkeiten | Arbeit, die in beliebiger Reihenfolge geht |
| ein Termin steht fest und darf nicht wackeln | fortlaufende Arbeit ohne Enddatum |
| mehrere Gewerke übergeben aneinander | ein Team, das alles selbst macht |
| jemand von aussen will den Ablauf sehen | das Team plant für sich selbst |

Faustregel: Wenn ihr die Frage „Was passiert mit dem Endtermin, wenn dieses eine Paket zwei Wochen später fertig wird?" nicht im Kopf beantworten könnt, braucht ihr einen Gantt. Sonst nicht.

Bau ist das Musterbeispiel: Der Estrich kann nicht vor dem Rohbau, die Fliesen nicht vor dem Estrich. Softwareentwicklung ist meistens das Gegenbeispiel — dort sind die meisten Abhängigkeiten erfunden, nicht physisch.

## In sechs Schritten zum Diagramm

**1. Arbeitspakete, nicht Aufgaben.** Ein Balken je Paket von mehreren Tagen, nicht je Ticket von zwei Stunden. Ein Gantt mit vierzig Balken liest niemand. Zwölf bis zwanzig ist die brauchbare Grösse.

**2. Dauer schätzen, nicht Termine setzen.** Erst „dieses Paket dauert vier Tage", dann rechnet die Reihenfolge die Termine aus. Wer zuerst Termine malt und dann Dauern hineinschreibt, hat keinen Plan, sondern ein Wunschbild.

**3. Abhängigkeiten eintragen.** Nur echte. Der Test: „Könnte man B anfangen, wenn A noch nicht fertig ist?" Wenn ja — egal wie unangenehm — dann ist es keine Abhängigkeit, sondern eine Vorliebe.

**4. Verfügbarkeit dazurechnen.** Vier Tage Arbeit sind bei halber Verfügbarkeit acht Kalendertage. Der häufigste Fehler im Gantt ist, Arbeitstage als Kalendertage zu zeichnen.

**5. Kritischen Pfad markieren.** Das ist die längste Kette von Abhängigkeiten. Jede Verzögerung darauf verschiebt das Ende. Alles daneben hat Luft.

**6. Puffer ans Ende.** Als einen Block hinter das letzte Paket, nicht verteilt. Verteilter Puffer wird immer aufgebraucht.

## Vorlage zum Abschreiben

| Nr | Arbeitspaket | Dauer | Beginnt nach | Verantwortlich |
|---|---|---|---|---|
| 1 | Entwurf Startseite | 5 T | — | Lena |
| 2 | Texte Speisekarte | 4 T | — | Tom |
| 3 | Seite bauen | 8 T | 1 | Jey |
| 4 | Inhalte einpflegen | 3 T | 2, 3 | Tom |
| 5 | Tischreservierung | 6 T | 3 | Jey |
| 6 | Abnahme und Livegang | 2 T | 4, 5 | Jey |
| — | **Puffer** | 4 T | 6 | — |

Fünf Spalten. Aus „Beginnt nach" ergibt sich alles Weitere: Der kritische Pfad ist hier 1 → 3 → 5 → 6, macht 21 Tage plus Puffer. Paket 2 hat neun Tage Luft und muss niemanden nervös machen.

Das ist die eigentliche Arbeit. Ob ihr daraus danach bunte Balken malt, ist Geschmackssache — die Erkenntnis steckt in der Tabelle.

## Die drei häufigsten Fehler

**Erfundene Abhängigkeiten.** Sie entstehen fast immer aus Gewohnheit („wir machen das immer in dieser Reihenfolge"). Jede erfundene Abhängigkeit verlängert den kritischen Pfad ohne Grund.

**Der Gantt wird nie wieder angefasst.** Ein Balkenplan ist eine Momentaufnahme. Wird er nach der Freigabe nicht gepflegt, ist er nach drei Wochen Dekoration — und gefährlicher als kein Plan, weil Leute ihm noch glauben.

**Personen statt Pakete.** Ein Balken je Person über den ganzen Zeitraum zeigt Auslastung, nicht Ablauf. Das ist Ressourcenplanung und gehört in eine andere Ansicht.

## In ORBYLOX

Die Tabelle oben ist genau das, was auf dem Board schon steht: Tickets mit Aufwand, Zuständigem und der Angabe, worauf sie warten. Abhängigkeiten sind hinterlegt, und das Board sperrt, was noch nicht dran ist — statt dass jemand zu früh anfängt.

Die Zeitleiste zeigt dieselben Tickets über eine Zeitachse, und das Organigramm der Abhängigkeiten zeigt die Ketten. Wer wirklich einen Balkenplan zum Ausdrucken braucht, exportiert die Tabelle — aber die meisten stellen nach zwei Wochen fest, dass sie ihn gar nicht mehr aufschlagen.`;

/* ------------------------------------------------------------- 1 / Gantt EN */

const ganttEn = `Few tools are asked for as often and needed as rarely as the Gantt chart. "We need a Gantt" usually means: "I want to know when we will be finished." Those are two different wishes.

## What a Gantt chart actually shows

One bar per work package, laid horizontally across a timeline. Length is duration, position is the time span, arrows between them are dependencies.

The real value is not in the bars. It is in the arrows: a Gantt shows **which delay propagates to the end and which does not**. A kanban board cannot do that.

Everything else — who is working on what, what comes next — a board does better.

## When it is worth it, when it is not

| A Gantt helps | A board is enough |
|---|---|
| fixed order, physical dependencies | work that can happen in any order |
| a date is fixed and must not move | ongoing work with no end date |
| several trades hand over to each other | one team doing all of it |
| someone outside wants to see the sequence | the team plans for itself |

Rule of thumb: if you cannot answer "what happens to the end date if this one package finishes two weeks late?" in your head, you need a Gantt. Otherwise you do not.

Construction is the textbook case: the screed cannot go before the shell, the tiles cannot go before the screed. Software is usually the counter-example — there, most dependencies are invented, not physical.

## Six steps to the chart

**1. Work packages, not tasks.** One bar per multi-day package, not per two-hour ticket. Nobody reads a Gantt with forty bars. Twelve to twenty is the usable size.

**2. Estimate duration, do not set dates.** First "this package takes four days", then let the ordering compute the dates. Drawing dates first and filling durations in afterwards is not a plan, it is a wish picture.

**3. Enter dependencies.** Only real ones. The test: "could B start if A is not finished?" If yes — however uncomfortable — it is not a dependency, it is a preference.

**4. Add availability.** Four days of work at half availability is eight calendar days. The most common Gantt mistake is drawing working days as calendar days.

**5. Mark the critical path.** That is the longest chain of dependencies. Any delay on it moves the end. Everything beside it has slack.

**6. Buffer at the end.** As one block behind the last package, not spread out. Distributed buffer always gets consumed.

## Template to copy

| No | Work package | Duration | Starts after | Accountable |
|---|---|---|---|---|
| 1 | Homepage design | 5 d | — | Lena |
| 2 | Menu copy | 4 d | — | Tom |
| 3 | Build the site | 8 d | 1 | Jey |
| 4 | Load the content | 3 d | 2, 3 | Tom |
| 5 | Table booking | 6 d | 3 | Jey |
| 6 | Sign-off and go live | 2 d | 4, 5 | Jey |
| — | **Buffer** | 4 d | 6 | — |

Five columns. "Starts after" produces everything else: the critical path here is 1 → 3 → 5 → 6, twenty-one days plus buffer. Package 2 has nine days of slack and should make nobody nervous.

That is the actual work. Whether you draw coloured bars from it afterwards is a matter of taste — the insight is in the table.

## The three most common mistakes

**Invented dependencies.** They almost always come from habit ("we always do it in this order"). Every invented dependency lengthens the critical path for no reason.

**The Gantt is never touched again.** A bar chart is a snapshot. If it is not maintained after sign-off, it is decoration within three weeks — and more dangerous than no plan, because people still believe it.

**People instead of packages.** One bar per person across the whole period shows workload, not sequence. That is resource planning and belongs in a different view.

## In ORBYLOX

The table above is exactly what is already on the board: tickets with effort, owner and what they are waiting on. Dependencies are recorded, and the board locks what is not ready — instead of someone starting too early.

The timeline shows the same tickets across a time axis, and the dependency graph shows the chains. If you really need a printable bar chart, export the table — but most people find after two weeks that they no longer open it.`;

/* ------------------------------------------------------------ 2 / Kickoff DE */

const kickoffDe = `Das Kickoff ist das Meeting mit dem schlechtesten Verhältnis von Aufwand zu Nutzen — meistens, weil es als Vorstellungsrunde mit Folien abläuft und danach jeder mit einem anderen Bild im Kopf herausgeht.

Ein Kickoff hat genau eine Aufgabe: **dafür sorgen, dass alle dieselbe Vorstellung vom Ergebnis haben.** Nicht motivieren, nicht informieren, nicht planen. Abgleichen.

## Woran man ein misslungenes Kickoff erkennt

Nicht daran, dass jemand widerspricht — sondern daran, dass niemand widerspricht. Ein Kickoff ohne eine einzige Rückfrage bedeutet fast immer, dass die Leute nicht verstanden haben, was von ihnen erwartet wird, und es im Raum nicht sagen wollten.

Der zweite Hinweis kommt zwei Wochen später: Wenn dann Fragen auftauchen, die im Kickoff hätten geklärt werden können, war es eine Vorstellungsrunde.

## Die Agenda, die funktioniert

Neunzig Minuten. Fünf Punkte. Nicht mehr.

| Zeit | Punkt | Ergebnis |
|---|---|---|
| 10 min | **Warum machen wir das?** | Ein Satz, den alle wiederholen können |
| 20 min | **Was ist drin, was nicht?** | Eine Liste — beide Spalten gefüllt |
| 25 min | **Wie arbeiten wir?** | Wo steht was, wann reden wir |
| 20 min | **Wer entscheidet was?** | Namen an den Entscheidungen |
| 15 min | **Was macht uns Sorgen?** | Die drei grössten Risiken, benannt |

Der dritte Punkt bekommt die meiste Zeit, und das ist Absicht. Streit über Ziele ist selten; Streit darüber, wer wann was wo einträgt, kostet über Monate mehr Nerven als jede inhaltliche Frage.

## Die Spalte, die alle vergessen

„Was ist **nicht** drin" ist der wertvollste Punkt der ganzen Agenda, und er wird am häufigsten übersprungen, weil er sich nach Absage anfühlt.

Beispiel aus einem echten Projekt:

| Drin | Nicht drin |
|---|---|
| Speisekarte, Öffnungszeiten, Anfahrt | Onlineshop |
| Tischreservierung mit Bestätigung | Bezahlung im Voraus |
| Deutsche Fassung | Englische Fassung |
| Fotos vom Innenraum | Fotos von Gerichten |

Jede Zeile rechts erspart später ein unangenehmes Gespräch. Wer sie beim Kickoff ausspricht, hört vielleicht ein „Moment, das brauchen wir aber" — und genau dafür ist der Termin da. Vier Wochen später ist dasselbe Gespräch eine Änderungsanfrage mit Preis.

## Die Frage, die jeden Ton ändert

Gegen Ende, wenn alles besprochen scheint, eine Runde:

> „Was müsste passieren, damit dieses Projekt in drei Monaten scheitert?"

Das ist keine Stimmungsfrage. Sie holt heraus, was die Leute ohnehin denken, aber ungefragt nicht sagen — weil niemand als Miesmacher im Kickoff sitzen will. Die Antworten sind eure Risikoliste, und sie ist besser als jede, die ihr allein am Schreibtisch schreibt.

Schreibt sie mit. Drei bis fünf Punkte reichen.

## Wer dabei ist

So wenige wie möglich. Konkret: alle, die Arbeit übernehmen, plus die Person, die über den Umfang entscheidet.

Wer nur zuhört, bekommt das Protokoll. Ein Kickoff mit vierzehn Leuten ist keine Abstimmung, sondern eine Veranstaltung — und in Veranstaltungen sagt niemand, was er wirklich denkt.

## Was danach verschickt wird

Eine halbe Seite, am selben Tag. Länger liest niemand, später glaubt niemand mehr, dass es das Besprochene ist.

- Der Zielsatz, wörtlich
- Die Nicht-drin-Liste
- Wer welche Entscheidung trifft
- Die drei Risiken
- Der nächste Termin

Wenn jemand widerspricht, ist das der Erfolg des Kickoffs, nicht sein Scheitern: Der Abgleich hat gerade stattgefunden, nur schriftlich.

## In ORBYLOX

Die Agenda liegt als Notiz im Projekt und wird während des Termins direkt darin ausgefüllt — so gibt es hinterher keine zweite Fassung, die jemand aus seinen Notizen tippt.

Aus der Drin-Spalte werden die ersten Tickets, aus den Risiken werden Tickets mit Frist. Der Zielsatz steht in der Projektbeschreibung und ist damit auf jeder Seite eine Handbewegung entfernt — dort, wo man ihn in Monat drei sucht.`;

/* ------------------------------------------------------------ 2 / Kickoff EN */

const kickoffEn = `The kickoff has the worst effort-to-value ratio of any meeting — mostly because it runs as an introduction round with slides, and everyone leaves with a different picture in their head.

A kickoff has exactly one job: **making sure everyone has the same idea of the outcome.** Not motivating, not informing, not planning. Aligning.

## How to spot a failed kickoff

Not by someone objecting — but by nobody objecting. A kickoff without a single question almost always means people did not understand what is expected of them and did not want to say so in the room.

The second sign arrives two weeks later: if questions come up that could have been settled in the kickoff, it was an introduction round.

## The agenda that works

Ninety minutes. Five points. No more.

| Time | Point | Outcome |
|---|---|---|
| 10 min | **Why are we doing this?** | One sentence everyone can repeat |
| 20 min | **What is in, what is out?** | A list — both columns filled |
| 25 min | **How do we work?** | Where things live, when we talk |
| 20 min | **Who decides what?** | Names on the decisions |
| 15 min | **What worries us?** | The three biggest risks, named |

The third point gets the most time, and that is deliberate. Arguments about goals are rare; arguments about who records what, where and when cost more nerves over months than any question of substance.

## The column everyone forgets

"What is **not** in" is the most valuable point on the whole agenda, and the most often skipped, because it feels like saying no.

From a real project:

| In | Not in |
|---|---|
| Menu, opening hours, directions | Online shop |
| Table booking with confirmation | Prepayment |
| German version | English version |
| Photos of the interior | Photos of dishes |

Every row on the right saves an uncomfortable conversation later. Saying it at the kickoff might get you a "wait, we do need that" — and that is exactly what the meeting is for. Four weeks later the same conversation is a change request with a price tag.

## The question that changes the tone

Near the end, when everything seems covered, one round:

> "What would have to happen for this project to fail in three months?"

This is not a mood question. It surfaces what people already think but will not volunteer — because nobody wants to be the pessimist at a kickoff. The answers are your risk list, and it is better than any you would write alone at your desk.

Write them down. Three to five points is enough.

## Who attends

As few as possible. Concretely: everyone who takes on work, plus the person who decides on scope.

Anyone who only listens gets the notes. A kickoff with fourteen people is not an alignment, it is an event — and at events nobody says what they really think.

## What goes out afterwards

Half a page, the same day. Longer and nobody reads it; later and nobody believes it is what was discussed.

- The goal sentence, verbatim
- The not-in list
- Who makes which decision
- The three risks
- The next date

If someone objects, that is the kickoff succeeding, not failing: the alignment just happened, only in writing.

## In ORBYLOX

The agenda lives as a note in the project and is filled in during the meeting itself — so there is no second version afterwards that someone types up from their own notes.

The "in" column becomes the first tickets, the risks become tickets with a due date. The goal sentence sits in the project description and is therefore one click away on every page — right where you go looking for it in month three.`;

/* ------------------------------------------------------------- 3 / Risiko DE */

const risikoDe = `Risikomanagement hat in kleinen Teams einen schlechten Ruf, und zwar zu Recht: Es tritt meistens als Tabelle mit vierzig Zeilen auf, die einmal ausgefüllt und nie wieder geöffnet wird.

Das ist schade, denn der nützliche Kern passt auf eine Seite und kostet zwanzig Minuten im Monat.

## Risiko ist nicht Problem

Der Unterschied ist die Zeitform, und er entscheidet, was zu tun ist.

| | Risiko | Problem |
|---|---|---|
| Zeitform | könnte eintreten | ist eingetreten |
| Frage | Wie wahrscheinlich, wie schlimm? | Wer löst es bis wann? |
| Gehört in | die Risikoliste | das Board, als Ticket |

Der häufigste Fehler in Risikolisten ist, dass die Hälfte der Einträge längst Probleme sind. Die gehören nicht in die Liste, sondern in die Arbeit.

## Nur fünf, nicht vierzig

Eine Risikoliste mit vierzig Zeilen sagt aus, dass niemand priorisiert hat. **Fünf ist die richtige Zahl** — die fünf, bei denen ihr wirklich etwas tun würdet.

Alles darunter kostet Pflege und bringt nichts. Wenn euch ein sechstes wichtig genug erscheint, fliegt dafür ein anderes raus. Das ist keine Schlamperei, das ist die eigentliche Arbeit.

## Bewerten ohne Scheingenauigkeit

Zwei Fragen, je drei Stufen. Keine Prozentzahlen, keine Punktesysteme mit Nachkommastellen — die täuschen eine Präzision vor, die es nicht gibt.

| | gering | mittel | hoch |
|---|---|---|---|
| **Wahrscheinlichkeit** | unwahrscheinlich | kann gut passieren | rechnet damit |
| **Auswirkung** | ein paar Tage | Termin wackelt | Projekt scheitert |

Daraus die Matrix:

| | Auswirkung gering | mittel | hoch |
|---|---|---|---|
| **W. hoch** | beobachten | **handeln** | **handeln** |
| **W. mittel** | hinnehmen | beobachten | **handeln** |
| **W. gering** | hinnehmen | hinnehmen | beobachten |

Drei Felder heissen „handeln". Wenn bei euch mehr als zwei Risiken dort landen, ist das Projekt zu gross geschnitten.

## Vier Umgangsweisen

Für jedes Risiko im Handeln-Feld wird eine gewählt — und aufgeschrieben, welche:

**Vermeiden.** Den Plan so ändern, dass das Risiko verschwindet. Teuerste, aber sicherste Variante. Beispiel: statt der unerprobten Schnittstelle die langweilige nehmen.

**Verringern.** Wahrscheinlichkeit oder Auswirkung senken. Beispiel: die riskante Annahme früh testen statt spät.

**Übertragen.** Jemand anders trägt es — Vertrag, Versicherung, Dienstleister. In kleinen Projekten selten sinnvoll.

**Hinnehmen.** Bewusst nichts tun, aber wissen, dass es da ist, und einen Plan B im Kopf haben. Völlig legitim, solange es ausgesprochen ist.

Was nicht zur Auswahl steht: eintragen und weitermachen. Ein Risiko ohne gewählte Umgangsweise ist eine Notiz, keine Massnahme.

## Vorlage zum Abschreiben

| Risiko | W. | A. | Umgang | Wer | Bis wann |
|---|---|---|---|---|---|
| Kundin gibt Entwurf nicht rechtzeitig frei | hoch | mittel | verringern: feste Frist im Kickoff | Jey | 24.09. |
| Fotos werden bei schlechtem Wetter nichts | mittel | gering | hinnehmen, Ersatztermin im Kalender | Tom | — |
| Reservierung braucht länger als geschätzt | mittel | hoch | verringern: früh anfangen, Kern zuerst | Jey | 30.09. |
| Steuerberater meldet sich nicht | gering | hoch | verringern: zweite Kanzlei anfragen | Jey | 06.10. |

Sechs Spalten, vier Zeilen. Die letzten beiden sind die, die den Unterschied machen: Ein Risiko ohne Namen und Datum wird nicht bearbeitet.

## Wann geschaut wird

Alle zwei Wochen, zehn Minuten, im selben Termin wie der Statusbericht. Drei Fragen:

1. Ist eins davon eingetreten? → raus aus der Liste, rein aufs Board als Problem.
2. Ist eins unwahrscheinlicher geworden? → runterstufen oder streichen.
3. Ist etwas Neues dazugekommen? → dann fliegt etwas anderes raus.

Eine Risikoliste, die sich über drei Monate nicht ändert, ist nicht stabil — sie wird nicht gelesen.

## In ORBYLOX

Die Liste liegt als Notiz im Projekt. Jedes Risiko im Handeln-Feld bekommt zusätzlich ein Ticket mit Zuständigem und Frist — sonst bleibt es eine Zeile in einer Tabelle, und Zeilen in Tabellen erledigt niemand.

Tritt ein Risiko ein, wandert das Ticket ins Board und wird ganz normale Arbeit. Der Fristenlauf erinnert an das Datum, ohne dass jemand daran denken muss.`;

/* ------------------------------------------------------------- 3 / Risiko EN */

const risikoEn = `Risk management has a bad reputation in small teams, and deservedly so: it usually shows up as a forty-row table that is filled in once and never opened again.

That is a shame, because the useful core fits on one page and costs twenty minutes a month.

## A risk is not a problem

The difference is tense, and it decides what to do.

| | Risk | Problem |
|---|---|---|
| Tense | might happen | has happened |
| Question | How likely, how bad? | Who fixes it by when? |
| Belongs in | the risk list | the board, as a ticket |

The most common mistake in risk lists is that half the entries are already problems. Those do not belong in the list, they belong in the work.

## Five, not forty

A risk list with forty rows says nobody prioritised. **Five is the right number** — the five where you would actually do something.

Anything below that costs maintenance and returns nothing. If a sixth seems important enough, another one drops out. That is not sloppiness, that is the actual work.

## Rating without false precision

Two questions, three levels each. No percentages, no scoring systems with decimal places — they fake a precision that does not exist.

| | low | medium | high |
|---|---|---|---|
| **Likelihood** | unlikely | could well happen | expect it |
| **Impact** | a few days | the date wobbles | the project fails |

Which gives the matrix:

| | Impact low | medium | high |
|---|---|---|---|
| **L. high** | watch | **act** | **act** |
| **L. medium** | accept | watch | **act** |
| **L. low** | accept | accept | watch |

Three cells say "act". If more than two of your risks land there, the project is cut too large.

## Four ways to respond

For every risk in an "act" cell, one is chosen — and written down:

**Avoid.** Change the plan so the risk disappears. Most expensive, most certain. Example: take the boring interface instead of the untested one.

**Reduce.** Lower the likelihood or the impact. Example: test the risky assumption early instead of late.

**Transfer.** Someone else carries it — contract, insurance, supplier. Rarely worthwhile in small projects.

**Accept.** Deliberately do nothing, but know it is there and hold a plan B. Entirely legitimate, as long as it is said out loud.

What is not an option: record it and move on. A risk without a chosen response is a note, not a measure.

## Template to copy

| Risk | L. | I. | Response | Who | By when |
|---|---|---|---|---|---|
| Client does not sign off the design in time | high | med | reduce: fixed deadline at kickoff | Jey | Sep 24 |
| Photos fail in bad weather | med | low | accept, backup date in calendar | Tom | — |
| Booking takes longer than estimated | med | high | reduce: start early, core first | Jey | Sep 30 |
| Accountant does not respond | low | high | reduce: approach a second firm | Jey | Oct 6 |

Six columns, four rows. The last two make the difference: a risk without a name and a date does not get worked on.

## When to review

Every two weeks, ten minutes, in the same meeting as the status report. Three questions:

1. Has one of them happened? → out of the list, onto the board as a problem.
2. Has one become less likely? → downgrade or delete.
3. Has something new appeared? → then something else drops out.

A risk list that does not change over three months is not stable — it is not being read.

## In ORBYLOX

The list lives as a note in the project. Every risk in an "act" cell also gets a ticket with an owner and a due date — otherwise it stays a row in a table, and nobody works on rows in tables.

If a risk materialises, the ticket moves onto the board and becomes ordinary work. The deadline reminder handles the date so nobody has to remember it.`;

/* -------------------------------------------------------- 4 / Abschluss DE */

const abschlussDe = `Die meisten Projekte enden nicht, sie hören auf. Irgendwann ruft niemand mehr an, das Board wird nicht mehr geöffnet, und ein halbes Jahr später weiss keiner mehr, ob die offenen Punkte je erledigt wurden.

Ein Abschluss ist kein Ritual. Er beantwortet zwei Fragen: **Ist wirklich alles fertig?** Und: **Was nehmen wir mit?**

## Woran man erkennt, dass es fertig ist

Nicht daran, dass nichts mehr zu tun ist — es ist immer noch etwas zu tun. Sondern daran, dass das erfüllt ist, was am Anfang als Ergebnis vereinbart wurde.

Deshalb ist der Zielsatz aus dem Kickoff die Abschlussprüfung. „Die neue Seite ist online, alle alten Adressen leiten weiter, und das Kontaktformular stellt nachweislich zu" — drei Punkte, jeder überprüfbar. Wer keinen solchen Satz hat, kann nicht abschliessen, sondern nur aufhören.

## Die Abschlussliste

Sechs Punkte, eine Stunde. Kein Punkt davon ist verzichtbar, und der letzte wird am häufigsten vergessen.

| Punkt | Frage | Ergebnis |
|---|---|---|
| **Ergebnis** | Ist der Zielsatz erfüllt? | Ja — oder eine Liste, was fehlt |
| **Offene Punkte** | Was bleibt liegen? | Jeder mit Entscheidung: erledigen, verschieben, streichen |
| **Übergabe** | Wer betreibt das jetzt? | Ein Name, schriftlich |
| **Unterlagen** | Wo liegt was? | Ein Ort, nicht fünf |
| **Zugänge** | Wer braucht welchen Zugriff — und wer nicht mehr? | Liste, abgearbeitet |
| **Rückblick** | Was nehmen wir mit? | Drei bis fünf Sätze |

Die Zeile „Offene Punkte" ist die unbequeme. Jeder offene Punkt braucht eine ausgesprochene Entscheidung — auch „wir streichen das" ist eine. Was ohne Entscheidung liegen bleibt, taucht in vier Monaten als Vorwurf wieder auf.

## Lessons Learned, ohne Schuldrunde

Der Rückblick scheitert meistens auf eine von zwei Arten: Entweder wird es eine Lobrunde, in der niemand etwas sagt, oder eine Suche nach dem Schuldigen, nach der niemand mehr etwas sagt.

Drei Fragen halten es auf der Spur:

> **Was hat besser funktioniert als erwartet?**
> **Was hat uns am meisten Zeit gekostet — und war es das wert?**
> **Was würden wir beim nächsten Mal anders anfangen?**

Die dritte ist die einzige, die wirklich zählt. Die ersten beiden bereiten sie vor.

Wichtig ist die Formulierung „anders **anfangen**": Sie zwingt zu einer Aussage über den Beginn des nächsten Projekts, nicht über die Fehler des letzten. Das ist derselbe Inhalt, aber eine Runde, in der Leute reden.

## Die Regel gegen Rückblicke, die nichts ändern

**Höchstens drei Erkenntnisse, jede mit einem Namen und einem Ort.**

Ein Rückblick mit vierzehn Punkten wird nicht umgesetzt, sondern abgelegt. Drei Punkte, die jemand ins nächste Projekt trägt, verändern mehr als vierzehn in einem Dokument.

Beispiel aus einem echten Abschluss:

| Erkenntnis | Was wir konkret ändern | Wer trägt es weiter |
|---|---|---|
| Freigaben der Kundin dauerten im Schnitt neun Tage | Freigabefristen ins Kickoff, mit Datum | Jey |
| Die Bildbeschaffung hat uns zweimal aufgehalten | Inhalte vor dem Bauen, nicht parallel | Tom |
| Das zweite Board hat niemand benutzt | Nur ein Board, bis es wirklich eng wird | Lena |

Drei Zeilen. Die mittlere Spalte ist der Unterschied zwischen einer Beobachtung und einer Änderung.

## Wann der Abschluss stattfindet

Innerhalb von zwei Wochen nach dem letzten Arbeitstag. Später erinnert sich niemand mehr an die Stellen, an denen es geklemmt hat — und genau die sind der Ertrag.

Nicht nach einem gescheiterten Projekt auslassen. Dort ist der Rückblick am wertvollsten und wird am häufigsten übersprungen, weil alle froh sind, dass es vorbei ist.

## In ORBYLOX

Die Abschlussliste ist eine Notiz, die Erkenntnisse sind eine zweite — beide bleiben im Projekt liegen, auch wenn das Board längst still ist. Beim nächsten Projekt schlägt man sie auf, statt sich zu erinnern.

Offene Tickets, die verschoben werden, wandern ins Folgeprojekt statt in ein Archiv. Und was gestrichen wird, wird gestrichen — mit Begründung im Kommentar, damit in vier Monaten nachlesbar ist, warum.`;

/* -------------------------------------------------------- 4 / Abschluss EN */

const abschlussEn = `Most projects do not end, they stop. At some point nobody calls any more, the board is not opened again, and six months later nobody knows whether the open items were ever dealt with.

A closeout is not a ritual. It answers two questions: **is it really finished?** And: **what do we take with us?**

## How you know it is finished

Not by there being nothing left to do — there is always something left to do. By what was agreed at the start as the outcome being met.

That is why the goal sentence from the kickoff is the closing test. "The new site is live, all old addresses redirect, and the contact form demonstrably delivers" — three points, each verifiable. Without such a sentence you cannot close a project, only stop it.

## The closeout list

Six points, one hour. None of them is optional, and the last one is forgotten most often.

| Point | Question | Outcome |
|---|---|---|
| **Result** | Is the goal sentence met? | Yes — or a list of what is missing |
| **Open items** | What is left? | Each with a decision: do, defer, drop |
| **Handover** | Who runs this now? | One name, in writing |
| **Documents** | Where is what? | One place, not five |
| **Access** | Who needs which access — and who no longer does? | List, worked through |
| **Retrospective** | What do we take with us? | Three to five sentences |

The "open items" row is the uncomfortable one. Every open item needs a spoken decision — "we are dropping it" is one too. Anything left without a decision reappears in four months as a reproach.

## Lessons learned, without the blame round

Retrospectives usually fail in one of two ways: either it becomes a round of praise where nobody says anything, or a search for the culprit after which nobody says anything either.

Three questions keep it on track:

> **What worked better than expected?**
> **What cost us the most time — and was it worth it?**
> **What would we start differently next time?**

The third is the only one that really counts. The first two prepare the ground for it.

The wording "start differently" matters: it forces a statement about the beginning of the next project, not about the mistakes of the last one. Same content, but a round in which people actually speak.

## The rule against retrospectives that change nothing

**At most three insights, each with a name and a place.**

A retrospective with fourteen points does not get implemented, it gets filed. Three points someone carries into the next project change more than fourteen in a document.

From a real closeout:

| Insight | What we change concretely | Who carries it |
|---|---|---|
| Client sign-offs took nine days on average | Sign-off deadlines at kickoff, with dates | Jey |
| Sourcing images held us up twice | Content before building, not in parallel | Tom |
| Nobody used the second board | One board until it really gets tight | Lena |

Three rows. The middle column is the difference between an observation and a change.

## When to hold it

Within two weeks of the last working day. Later and nobody remembers the places where it got stuck — and those are the yield.

Do not skip it after a failed project. That is where the retrospective is most valuable and most often skipped, because everyone is glad it is over.

## In ORBYLOX

The closeout list is a note, the insights are a second one — both stay in the project even when the board has long gone quiet. At the next project you open them instead of trying to remember.

Open tickets that get deferred move into the follow-up project rather than an archive. And what gets dropped, gets dropped — with a reason in the comment, so that in four months you can read why.`;

/* ------------------------------------------------------------------ Einträge */

const neu = [
  {
    id: 'p12de',
    locale: 'de',
    slug: 'gantt-diagramm-erstellen',
    title: 'Gantt-Diagramm erstellen — und wann ihr keins braucht',
    seo_title: 'Gantt-Diagramm erstellen: Anleitung, Beispiel, Vorlage',
    meta_description:
      'In sechs Schritten zum Balkenplan: Arbeitspakete, Dauer, echte Abhängigkeiten, kritischer Pfad. Mit Vorlage — und der Frage, wann ein Board reicht.',
    excerpt:
      'Kaum ein Werkzeug wird so oft verlangt und so selten gebraucht. „Wir brauchen einen Gantt" heisst meistens: „Ich will wissen, wann wir fertig sind."',
    category: 'Projektmanagement',
    tags: ['Gantt-Diagramm', 'Balkenplan', 'Kritischer Pfad', 'Ablaufplan', 'Vorlage'],
    featured_image: '/screens/tasks.webp',
    featured_alt: 'Aufgaben mit Abhängigkeiten in ORBYLOX',
    translation_of: 'creating-a-gantt-chart',
    related_slugs: ['projektplan-erstellen-schritt-fuer-schritt', 'abhaengigkeiten-sichtbar-machen'],
    content: ganttDe,
  },
  {
    id: 'p12en',
    locale: 'en',
    slug: 'creating-a-gantt-chart',
    title: 'Creating a Gantt chart — and when you do not need one',
    seo_title: 'Creating a Gantt chart: guide, example, template',
    meta_description:
      'Six steps to a bar chart: work packages, durations, real dependencies, critical path. With a template — and the question of when a board is enough.',
    excerpt:
      'Few tools are asked for as often and needed as rarely. "We need a Gantt" usually means: "I want to know when we will be finished."',
    category: 'Project management',
    tags: ['Gantt chart', 'Bar chart', 'Critical path', 'Schedule', 'Template'],
    featured_image: '/screens/tasks.webp',
    featured_alt: 'Tasks with dependencies in ORBYLOX',
    translation_of: 'gantt-diagramm-erstellen',
    related_slugs: ['how-to-create-a-project-plan', 'making-dependencies-visible'],
    content: ganttEn,
  },
  {
    id: 'p13de',
    locale: 'de',
    slug: 'projekt-kickoff-agenda',
    title: 'Projekt-Kickoff: neunzig Minuten, fünf Punkte',
    seo_title: 'Projekt-Kickoff: Agenda, Vorlage und die richtige Frage',
    meta_description:
      'Ein Kickoff hat eine Aufgabe: alle auf dieselbe Vorstellung vom Ergebnis bringen. Agenda für neunzig Minuten, die Nicht-drin-Liste und was danach verschickt wird.',
    excerpt:
      'Das Kickoff hat das schlechteste Verhältnis von Aufwand zu Nutzen — meistens, weil es als Vorstellungsrunde abläuft und jeder mit einem anderen Bild herausgeht.',
    category: 'Zusammenarbeit',
    tags: ['Kickoff', 'Meeting', 'Agenda', 'Projektstart', 'Vorlage'],
    featured_image: '/screens/feed.webp',
    featured_alt: 'Projekt-Feed mit Absprachen in ORBYLOX',
    translation_of: 'project-kickoff-agenda',
    related_slugs: ['projektplan-erstellen-schritt-fuer-schritt', 'aufgaben-im-team-verteilen'],
    content: kickoffDe,
  },
  {
    id: 'p13en',
    locale: 'en',
    slug: 'project-kickoff-agenda',
    title: 'Project kickoff: ninety minutes, five points',
    seo_title: 'Project kickoff: agenda, template and the right question',
    meta_description:
      'A kickoff has one job: getting everyone to the same idea of the outcome. A ninety-minute agenda, the not-in list, and what goes out afterwards.',
    excerpt:
      'The kickoff has the worst effort-to-value ratio of any meeting — mostly because it runs as an introduction round and everyone leaves with a different picture.',
    category: 'Collaboration',
    tags: ['Kickoff', 'Meeting', 'Agenda', 'Project start', 'Template'],
    featured_image: '/screens/feed.webp',
    featured_alt: 'Project feed with agreements in ORBYLOX',
    translation_of: 'projekt-kickoff-agenda',
    related_slugs: ['how-to-create-a-project-plan', 'sharing-out-work-in-a-team'],
    content: kickoffEn,
  },
  {
    id: 'p14de',
    locale: 'de',
    slug: 'risiken-im-projekt-managen',
    title: 'Risiken im Projekt: fünf reichen',
    seo_title: 'Risikomanagement im Projekt: Risikomatrix und Vorlage',
    meta_description:
      'Risiko ist nicht Problem. Eine Matrix aus zwei mal drei Stufen, vier Umgangsweisen und eine Vorlage mit fünf Zeilen — mehr braucht ein kleines Team nicht.',
    excerpt:
      'Risikomanagement hat in kleinen Teams zu Recht einen schlechten Ruf: eine Tabelle mit vierzig Zeilen, einmal ausgefüllt und nie wieder geöffnet.',
    category: 'Projektmanagement',
    tags: ['Risikomanagement', 'Risikomatrix', 'Risikoanalyse', 'Projektrisiken', 'Vorlage'],
    featured_image: '/screens/canvas.webp',
    featured_alt: 'Risiken und Entscheidungen auf dem Canvas in ORBYLOX',
    translation_of: 'managing-project-risks',
    related_slugs: ['projektstatusbericht-schreiben', 'meilensteine-planen'],
    content: risikoDe,
  },
  {
    id: 'p14en',
    locale: 'en',
    slug: 'managing-project-risks',
    title: 'Project risks: five is enough',
    seo_title: 'Project risk management: risk matrix and template',
    meta_description:
      'A risk is not a problem. A two-by-three matrix, four ways to respond and a five-row template — a small team needs nothing more than that.',
    excerpt:
      'Risk management deservedly has a bad reputation in small teams: a forty-row table, filled in once and never opened again.',
    category: 'Project management',
    tags: ['Risk management', 'Risk matrix', 'Risk analysis', 'Project risks', 'Template'],
    featured_image: '/screens/canvas.webp',
    featured_alt: 'Risks and decisions on the canvas in ORBYLOX',
    translation_of: 'risiken-im-projekt-managen',
    related_slugs: ['writing-a-project-status-report', 'planning-milestones'],
    content: risikoEn,
  },
  {
    id: 'p15de',
    locale: 'de',
    slug: 'projekt-abschliessen-lessons-learned',
    title: 'Projekt abschliessen: sechs Punkte, eine Stunde',
    seo_title: 'Projektabschluss und Lessons Learned: Checkliste und Vorlage',
    meta_description:
      'Die meisten Projekte enden nicht, sie hören auf. Eine Abschlussliste mit sechs Punkten, drei Fragen für den Rückblick und die Regel gegen folgenlose Retros.',
    excerpt:
      'Irgendwann ruft niemand mehr an, das Board wird nicht mehr geöffnet, und ein halbes Jahr später weiss keiner, ob die offenen Punkte je erledigt wurden.',
    category: 'Projektmanagement',
    tags: ['Projektabschluss', 'Lessons Learned', 'Retrospektive', 'Übergabe', 'Checkliste'],
    featured_image: '/screens/files.webp',
    featured_alt: 'Projektunterlagen und Notizen in ORBYLOX',
    translation_of: 'closing-a-project-lessons-learned',
    related_slugs: ['projekt-kickoff-agenda', 'definition-of-done'],
    content: abschlussDe,
  },
  {
    id: 'p15en',
    locale: 'en',
    slug: 'closing-a-project-lessons-learned',
    title: 'Closing a project: six points, one hour',
    seo_title: 'Project closeout and lessons learned: checklist and template',
    meta_description:
      'Most projects do not end, they stop. A six-point closeout list, three questions for the retrospective and the rule against retros that change nothing.',
    excerpt:
      'At some point nobody calls any more, the board is not opened again, and six months later nobody knows whether the open items were ever dealt with.',
    category: 'Project management',
    tags: ['Project closeout', 'Lessons learned', 'Retrospective', 'Handover', 'Checklist'],
    featured_image: '/screens/files.webp',
    featured_alt: 'Project documents and notes in ORBYLOX',
    translation_of: 'projekt-abschliessen-lessons-learned',
    related_slugs: ['project-kickoff-agenda', 'definition-of-done-en'],
    content: abschlussEn,
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
  console.log('Alle acht Beiträge stehen schon in der Saatdatei — nichts zu tun.');
  process.exit(0);
}

fs.writeFileSync(datei, `${JSON.stringify([...vorhanden, ...zuLegen], null, 2)}\n`, 'utf8');

for (const p of zuLegen) {
  console.log(`  + ${p.locale}  ${p.slug.padEnd(36)} ${String(p.content.split(/\s+/).length).padStart(5)} Wörter`);
}
console.log(`\n${zuLegen.length} Beiträge ergänzt, ${vorhanden.length + zuLegen.length} insgesamt.`);
console.log('Auf dem Server danach einmal:  php blog-seed.php');
