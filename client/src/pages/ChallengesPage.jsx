import { useCallback, useEffect, useRef, useState } from "react";
import { BackLink, Button, LinkButton, Notice, PageHeader } from "../components/ui.jsx";
import { api } from "../lib/api.js";

const assets = "/challenge-assets/weak-password/";
const challenges = [
  {
    id: "xss", title: "DOM-XSS in der Produktsuche", category: "A05:2025 - Injection",
    cwe: "CWE-80 - Improper Neutralization of Script-Related HTML Tags in a Web Page (Basic XSS)", number: 80,
    goal: "Verstehe, wie eine manipulierte Produktsuche ausführbares HTML in einer Ergebnisanzeige erzeugen kann.",
    assignment: "Bringe die Suchvorschau dazu, durch JavaScript eine gefälschte Sicherheitsmeldung anzuzeigen. Beschränke die Wirkung auf die vorhandene Vorschau.",
    entry: "Öffne die Produktsuche im normalen Shop. Untersuche auch, wie Suchbegriffe ohne Treffer dargestellt werden.",
    prerequisites: "Keine Anmeldung erforderlich. Der Produktkatalog muss geladen und nicht leer sein. Die isolierte Vorschau unter /xss-preview/ wird vom Shop bereitgestellt. Es werden keine weiteren Hosts oder Ports benötigt. Es gibt keinen XSS-Aktivierungsschalter.",
    success: "Manueller Nachweis: Die gefälschte Sicherheitsmeldung entsteht nach Eingabe im Shop-Suchfeld durch JavaScript in der Vorschau. Reiner HTML-Text genügt nicht. Dokumentiere Eingabe und sichtbare Wirkung und reproduziere sie für die Lehrperson in einem frischen Browser. Es gibt keinen gespeicherten XSS-Fortschritt und keine automatische Erfolgsprüfung.",
    cause: "Suchtext wird in der Vorschau als HTML interpretiert. Unvertrauenswürdige Eingaben müssen als Text ausgegeben werden.",
    hints: ["Vergleiche eine Suche mit Treffern mit einer erfolglosen Suche.", "Untersuche im Browser, wo Suchtext als Text und wo er als HTML verarbeitet wird. Modale Dialoge sind in der Vorschau gesperrt; verwende eine sichtbare Änderung innerhalb der Vorschau."],
    reset: "Leere die Suche mit Clear search. Die Vorschau wird entfernt und bei der nächsten erfolglosen Suche neu erstellt.",
  },
  {
    id: "weak-password", title: "Der schwache Schutz des Kundenkontos", category: "A04:2025 - Cryptographic Failures",
    cwe: "CWE-916 - Use of Password Hash With Insufficient Computational Effort", number: 916,
    goal: "Verstehe, warum Passwort-Hashes ausreichend rechenaufwendig sein müssen und wie sich Offline-Prüfung von Login-Versuchen unterscheidet.",
    assignment: "Untersuche eine alte Backup-Funktion, beschaffe ausschließlich den Hash des fiktiven Übungskontos und prüfe die bereitgestellten Passwortkandidaten lokal dagegen. Melde dich anschließend mit dem gefundenen Konto über den normalen Shop-Login an.",
    entry: "Beginne ohne Anmeldung bei den Hinweisen für Webcrawler. Untersuche nur den dort genannten alten API-Bereich; die Discovery-Wortliste enthält mögliche Endpunktnamen.",
    prerequisites: "Der Betreiber muss weak-password aktiviert und das fiktive Zielkonto eingerichtet haben. Für die lokale Prüfung benötigst du Node.js, die unten angebotenen Dateien und bcryptjs in einem eigenen lokalen Ordner. Andere Kundenkonten sind keine Ziele.",
    success: "Der Server speichert einen erfolgreichen normalen Login des besonderen Zielkontos über dessen schwachen Passwort-Hash. Der Status gilt gemeinsam für diese Übungsinstanz. Zeige der Lehrperson zusätzlich die Ausgabe deiner lokalen Offline-Prüfung als Nachweis des Crackings.",
    cause: "Der bcrypt-Hash des Übungskontos verwendet Kostenfaktor 4. Der geringe Rechenaufwand erleichtert Offline-Versuche; der Backup-Zugriff ist eine zusätzliche Zugriffsschwäche.",
    hints: ["Eine robots.txt enthält Hinweise für Crawler, ist aber keine Zugriffskontrolle.", "Speichere den gefundenen Export als backup.json. Lade Prüfskript und Passwort-Wortliste in denselben lokalen Ordner und installiere dort mit npm install bcryptjs die Bibliothek. Führe node check-bcrypt.mjs backup.json wordlist-test.txt aus. Das Skript liest nur lokale Dateien und sendet keine Login-Anfragen."],
    reset: "Der Betreiber kann ausschließlich diese Aufgabe mit dem vorhandenen reset:password-challenge zurücksetzen. Dabei werden Zielkonto-Sitzungen und Fortschritt zurückgesetzt.",
  },
  {
    id: "log-flood", title: "Logging / Log-Flut", category: "A09:2025 - Security Logging and Alerting Failures",
    cwe: "CWE-779 - Logging of Excessive Data", number: 779,
    goal: "Erkenne, wie übermäßiges Protokollieren von Anfragen ohne ausreichende Begrenzung Log-Speicher verbraucht.",
    assignment: "Erzeuge mit fiktiven JSON-Daten im vorhandenen Logging-Endpunkt genügend protokollierte Daten, um die konfigurierte Erfolgsschwelle zu erreichen. Dokumentiere den Größenanstieg und den Status vor und nach deinem Versuch.",
    entry: "Nutze den bestehenden Shop-Endpunkt POST /api/log.flood mit Content-Type: application/json, beispielsweise mit einem lokalen HTTP-Werkzeug. Es gibt dafür kein eigenes Shop-Formular.",
    prerequisites: "Keine Anmeldung erforderlich. Der Betreiber muss log-flood aktiviert haben; der Schalter gilt auch in der internen Docker-Umgebung. Verwende ausschließlich fiktive Inhalte ohne Zugangsdaten. Der aktive Endpunkt akzeptiert höchstens 1 MiB pro Anfrage; das Challenge-Log ist auf 32 MiB begrenzt.",
    success: "Der vorhandene Status-Endpunkt /api/challenges/log-flood/status meldet achieved: true, sobald sizeBytes mindestens thresholdBytes erreicht. Standardmäßig beträgt die Schwelle 10 MiB (10.485.760 Bytes). Der aktuelle Dateizustand gilt für die gesamte Instanz und ist kein persönlicher, dauerhaft gespeicherter Abschluss. Dokumentiere beide Größen und den Status als Nachweis.",
    cause: "Im aktiven Modus werden vollständige Header und Request-Bodies ohne Rate-Limit in das isolierte Challenge-Log geschrieben. Protokollierung muss Datenmenge und Frequenz begrenzen.",
    hints: ["Lies zuerst den vorhandenen Status und vergleiche ihn nach einer kleinen Testanfrage.", "Untersuche, wie die Größe deiner fiktiven JSON-Daten und die Zahl der Anfragen die Log-Größe beeinflussen. Beachte die bestehenden Grenzen."],
    reset: "Der Betreiber kann mit dem vorhandenen reset:challenge ausschließlich das Challenge-Log leeren. Der angezeigte Erfolg verschwindet dadurch.",
  },
];

function ChallengeStatus({ id }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestNumber = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError("");
    try {
      const result = await api(`/api/challenges/${id}/status`);
      if (request === requestNumber.current) setStatus(result);
    } catch (failure) {
      if (request === requestNumber.current) { setStatus(null); setError(failure.message); }
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    const timer = setTimeout(() => { void refresh(); }, 0);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      clearTimeout(timer);
      requestNumber.current += 1;
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [refresh]);
  const active = id === "log-flood" ? status?.isActive : status?.active;
  const unavailable = id === "weak-password" && status && !status.ready;
  const label = loading ? "Status wird geprüft …" : error ? "Nicht erreichbar" : unavailable ? "Nicht eingerichtet" : !active ? "Deaktiviert" : status?.achieved ? "Geschafft" : "Offen";
  return (
    <div className="mt-5 space-y-3 rounded-lg border border-line bg-raised p-4" aria-live="polite" aria-busy={loading}>
      <p className="text-xs">Fortschritt dieser Instanz</p>
      <p className="font-semibold text-ink">{label}</p>
      {error && <p>Status konnte nicht geladen werden: {error}</p>}
      {status && !loading && !error && <>
        {!active && <p>Sichere Variante aktiv.{status.achieved && " Ein früherer Nachweis ist noch vorhanden."}</p>}
        {id === "weak-password" && <p>Login-Nachweis; lokale Offline-Prüfung zusätzlich vorzeigen.</p>}
        {id === "weak-password" && status.solvedAt && <p>Nachweis: {status.solvedAt}</p>}
        {id === "log-flood" && <p>Log-Größe: {status.sizeBytes.toLocaleString("de-AT")} / {status.thresholdBytes.toLocaleString("de-AT")} Bytes</p>}
      </>}
      <Button variant="secondary" onClick={refresh} disabled={loading}>Status aktualisieren</Button>
    </div>
  );
}

export default function ChallengesPage() {
  return (
    <main className="shell py-12 sm:py-20" lang="de">
      <BackLink>Zurück zum Webshop</BackLink>
      <PageHeader eyebrow="CRITICAL-HIT-SUPPLY - SECURITY QUESTS" title="Drei Aufgaben. Ein Webshop.">
        Entdecke die bestehenden Schwachstellen im normalen Shop. Klappe eine Aufgabe auf,
        lies den Auftrag und kehre zum Spielen in den Webshop zurück.
      </PageHeader>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
        {challenges.map((challenge) => (
          <article key={challenge.id} className="min-w-0 rounded-xl border border-line bg-surface p-6 text-sm leading-7 text-muted sm:p-7">
            <p className="text-xs font-semibold text-accent">OWASP {challenge.category}</p>
            <h2 className="mt-3 text-2xl font-medium leading-tight text-ink">{challenge.title}</h2>
            <p className="mt-3 text-xs"><a className="underline underline-offset-4 hover:text-accent" href={`https://cwe.mitre.org/data/definitions/${challenge.number}.html`}>{challenge.cwe}</a></p>
            <p className="mt-5">{challenge.goal}</p>
            {challenge.id === "xss" ? <Notice className="mt-5"><p className="text-xs">Fortschritt dieser Instanz</p><p className="font-semibold text-ink">Manueller Nachweis erforderlich</p></Notice> : <ChallengeStatus id={challenge.id} />}
            <details className="mt-6 border-t border-line pt-4">
              <summary className="cursor-pointer rounded text-ink focus-visible:outline-2 focus-visible:outline-accent">Vollständige Aufgabe: {challenge.title}</summary>
              <div className="mt-5 space-y-5">
                {[
                  ["Lernziel", challenge.goal], ["Auftrag", challenge.assignment],
                  ["Einstieg", challenge.entry], ["Vorbedingungen", challenge.prerequisites],
                  ["Erfolgskriterium und Nachweis", challenge.success],
                  ["Ursache und Sicherheitsregel", challenge.cause], ["Reset", challenge.reset],
                ].map(([label, text]) => <section key={label}><h3 className="font-semibold text-ink">{label}</h3><p>{text}</p></section>)}
                {challenge.id === "xss" && <LinkButton to="/products" variant="secondary">Zur Produktsuche</LinkButton>}
                {challenge.id === "weak-password" && <>
                  <a className="block text-ink underline" href="/robots.txt">Hinweise in /robots.txt</a>
                  <div className="flex flex-wrap gap-3">
                    <LinkButton href={assets + "endpoint-discovery.txt"} download variant="secondary">Discovery-Wortliste</LinkButton>
                    <LinkButton href={assets + "wordlist-test.txt"} download variant="secondary">Passwort-Wortliste</LinkButton>
                    <LinkButton href={assets + "check-bcrypt.mjs"} download variant="secondary">Lokales Prüfskript</LinkButton>
                  </div>
                  <LinkButton to="/login" state={{ from: "/challenges" }}>Zum Shop-Login</LinkButton>
                </>}
                <section className="space-y-3"><h3 className="font-semibold text-ink">Optionale Hinweise</h3>
                  {challenge.hints.map((hint, index) => <details key={hint} className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-ink">Hinweis {index + 1}</summary><p className="mt-3">{hint}</p></details>)}
                </section>
                <p className="text-xs">Keine CVE - eigene Umsetzung.</p>
              </div>
            </details>
          </article>
        ))}
      </div>
    </main>
  );
}
