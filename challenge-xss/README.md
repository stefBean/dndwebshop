# DOM-XSS in der Produktsuche (CWE-80 / OWASP A05:2025)

Die Challenge verwendet den gemeinsamen Aktivierungsschalter `isActive`:

```sh
npm run challenge:set --prefix server -- xss true
npm run challenge:set --prefix server -- xss false
```

Der Status wird bei jeder Suche neu gelesen. Nur bei aktivem Status wird der
isolierte Frame bei einer Suche ohne Produkt-Treffer geladen. Erfolgreiche
Suchen zeigen ausschließlich die gefundenen Produkte. In
Produktion bleibt die Challenge wie die anderen Challenges deaktiviert.

Test-Payload: `<svg onload="alert('XSS')"></svg>`. `alert()` sendet eine
Nachricht an den Shop, der den Frame-Absender und Nachrichtentyp prüft und den
Browser-Alert öffnet. So bleibt die opaque Sandbox-Origin erhalten.

## Start

Im Repository:

```sh
docker compose up --build -d
```

Shop unbedingt über http://localhost:8080/products öffnen. Der getrennte
Preview-Dienst läuft unter http://127.0.0.1:8081. Hostnamen sind absichtlich
verschieden: Cookies werden nicht nach Port getrennt. Shop nicht unter
127.0.0.1 öffnen; der React-Wrapper lehnt denselben Cookie-Host ab.

Der vorhandene Volume `shop-data` bleibt eingebunden. Keine Volumes löschen und
kein Seed-/Import-/Reset-Kommando für die Datenbank ausführen. Der normale Shopstart
verwendet weiterhin seine bisherige Datenbankinitialisierung.
Die Vorschau besitzt weder Volume noch Datenbankabhängigkeit.

Für einen internen Zugriff von einem anderen Rechner müssen zwei getrennte,
vertrauenswürdige Hostnamen verwendet werden. `XSS_PREVIEW_ORIGIN` bestimmt die
browserseitige Preview-Origin im Shop und dessen `frame-src`;
`XSS_SHOP_ORIGINS` enthält die erlaubten Shop-Origins (durch Leerzeichen getrennt).
`XSS_BIND_IP` bestimmt das Port-Binding des Preview-Dienstes (Standard 127.0.0.1).
Bei HTTPS müssen beide Dienste über HTTPS bereitgestellt werden. Keine gemeinsame
Cookie-Domain konfigurieren; idealerweise getrennte Sites verwenden.
Änderungen der Variablen benötigen eine Neuerstellung der Container.

Für lokale Entwicklung startet `npm run dev` zusätzlich den Preview-Dienst.
Shop über http://localhost:5173 öffnen. Für einen gebauten Shop mit `npm start`
den Preview-Dienst zusätzlich mit `node challenge-xss/server.mjs` starten.

## Datenfluss und absichtliche Schwachstelle

Die normale React-Suche filtert weiterhin den geladenen Produktkatalog. Nur bei
einem nichtleeren Suchbegriff und aktivierter Challenge wird die Preview angezeigt.
Laden, Fehler, leerer Katalog, Produktkarten, Kategorie und Sortierung bleiben erhalten.
Die CollectionToolbar benötigt keine Änderung.

Der Wrapper bezieht die feste Preview-Origin von
`GET /api/challenges/xss/config` und erstellt mit `URL.searchParams.set` eine
URL mit kodiertem `?search=...`. Es gibt keinen HTML-Sink im Shop und kein
ungeprüftes postMessage-Protokoll; nur Alert-Nachrichten des aktuellen Frames werden akzeptiert. Das feste Preview-HTML enthält keinen serverseitig
reflektierten Suchtext. Ausschließlich sein Browser-Script liest:

```js
const search = new URLSearchParams(location.search).get('search') || '';
document.getElementById('result').innerHTML = 'No products found for: ' + search;
```

Die Senke ist absichtlich verwundbar. URL-Kodierung schützt die URL-Struktur,
ist aber keine HTML-Kodierung. Eingaben werden vom Browser wieder dekodiert.

## Reproduzierbare manuelle Erfolgsprüfung

1. Kategorie auf All lassen. Nach `dice` suchen: normale Produktkarten erscheinen.
2. Nach `Dragon Sword` suchen: die passende dunkle Vorschau zeigt
   `No products found for: Dragon Sword`.
3. Diese Eingabe in dasselbe Shop-Suchfeld kopieren:

```html
<svg onload="document.getElementById('result').textContent='Dice & Lore security notice: JavaScript executed in the isolated preview.'"></svg>
```

4. Erwartung: Innerhalb der Vorschau erscheint die gefälschte Sicherheitsmeldung.
   Der Handler hat den Ergebnistext per JavaScript ersetzt. Oberhalb der Vorschau
   zeigt der Shop die Eingabe weiterhin als Text. Keine Dialogbox wird benötigt,
   da die Sandbox modale Dialoge nicht erlaubt.
5. Im Netzwerk-Tab des Browsers prüfen: Frame-URL enthält URL-kodiertes
   `search`; Preview-HTML ist ein festes Dokument. Keine Payload-Übernahme in
   Shop-HTML oder Produktdaten.
6. Suche mit dem äußeren Clear-search-Button leeren: Vorschau verschwindet,
   Shopprodukte erscheinen. Dieselbe Eingabe erneut verwenden: ein neues iframe
   wird geladen; kein Erfolg oder HTML aus dem alten Dokument bleibt erhalten.

Eine bloß per HTML eingefügte Meldung ist noch kein Nachweis von JavaScript.
Die obige Eingabe erzeugt ihre Meldung erst im Eventhandler. Über innerHTML
eingefügte script-Elemente werden nicht einfach ausgeführt. Die Preview-CSP
erlaubt Eventhandler absichtlich über `script-src-attr 'unsafe-inline'`,
während nur das feste Startscript per Hash freigegeben ist.

Es gibt keinen verbindlichen Punktestand, Status-Endpunkt oder automatische
Erfolgsmeldung im Shop. DevTools können lokale Anzeigen manipulieren. Für eine
Benotung die Eingabe manuell in einem frischen Browser reproduzieren.

## Sicherheitsprüfung im Browser

Mit angemeldetem Shop und vorhandenem Warenkorb prüfen:

- In der Preview-Konsole (richtigen Frame auswählen) liefern
  `parent.document.body`, `localStorage` und `document.cookie`
  keinen Zugriff auf den Shop; bei den entsprechenden Zugriffen ist ein
  SecurityError zu erwarten. Der Frame hat eine opaque Origin.
- Ein `fetch('http://localhost:8080/api/auth/me')` aus der Preview wird
  durch `connect-src 'none'` blockiert. Im Network-Tab prüfen, dass kein
  entsprechender API-Request abgesetzt wird. Bilder und eingebettete Frames
  werden ebenfalls blockiert.
- Top-Navigation, Popups, Formulare und Downloads aus der Vorschau testen:
  Die Sandbox gewährt diese Rechte nicht. Der Shop bleibt bedienbar.
- Preview direkt in einem Tab öffnen: Der HTTP-CSP-Header erzwingt auch dort
  `sandbox allow-scripts`.
- Nach Reset bleiben Login, Warenkorb, Bestellungen und Produktbestand erhalten.
- Auf / und /products testen; zusätzlich Kategorie/Suche/Sortierung, API-Fehler,
  leeren Katalog und längere Eingaben prüfen. Über 4096 Zeichen zeigt die
  Vorschau einen Hinweis; die normale Suchfilterung wird nicht begrenzt.

Sandbox und CSP sind keine vollständige Netzwerksperre und keine CPU-Quote
für den Browser. Ein Frame kann insbesondere seine eigene Navigation versuchen;
CSP und Sandbox garantieren keine universelle Sperre sämtlicher ausgehender
Navigationsrequests. Unbekannte Payloads nur im vorgesehenen internen Testbrowser
ohne sensible Daten ausführen. Für eine harte Egress-Grenze wäre ein separater,
netzseitig eingeschränkter Browser notwendig. Der Browser des Teilnehmers läuft
nicht im Preview-Container; Containerlimits begrenzen nicht dessen JavaScript.
Die Preview ist auf 320px Höhe begrenzt und kann keine Shop-Bereiche überdecken.

## Isolation und Betrieb

- iframe: ausschließlich `sandbox="allow-scripts"`, ohne allow-same-origin.
- HTTP-CSP zusätzlich mit sandbox; kein Zugriff auf Shop-DOM oder Shop-Storage.
- Eigene Origin und eigener Cookie-Host; keine Shop-Secrets in Preview-Umgebung.
- Shop behält seine Script-CSP; lediglich eine feste frame-src-Origin kommt hinzu.
- Preview: default-src none, connect/img/frame/worker/media/font/object none,
  form-action none, base-uri none; frame-ancestors nur konfigurierte Shops.
- No-store und no-referrer; keine Request-/Payload-Logs oder Cookies im Dienst.
- Der Suchbegriff steht dennoch bewusst in der Frame-URL und kann in Browser-
  Werkzeugen oder vorgeschalteten Proxylogs auftauchen. Keine Secrets eingeben.
- Dienst nutzt ausschließlich Node-Bordmittel, liefert nur GET/HEAD / aus und
  begrenzt Request-Header, URL/Suchlänge und Timeouts.
- Container: unprivilegierter Benutzer, read-only Dateisystem, keine Volumes,
  keine Linux-Capabilities, no-new-privileges, 64 MB RAM, 0.25 CPU, 64 Prozesse.
- Eigenes Docker-Bridge-Netz ohne Shop-Service und ohne IP-Masquerading;
  kein Docker-Socket und keine Mitgliedschaft im Shop-Netz. Die Portfreigabe
  bleibt erreichbar. Deaktiviertes Masquerading ist keine universelle Egress-
  Firewall: direkt geroutete Ziele und Hostdienste benötigen bei Bedarf
  zusätzliche Host-Firewallregeln. Der statische Dienst baut selbst keine
  ausgehenden Verbindungen auf. internal:true wurde unter Docker Desktop
  verworfen, weil damit der veröffentlichte Port nicht erreichbar war.

## Reset und Logging-Challenge

XSS: Suche leeren (Clear search, Suchfeld-Kreuz oder Clear filters).
Der Frame wird entfernt; bei der nächsten erfolglosen Suche neu erstellt.
Clear search ändert Kategorie und Sortierung nicht. Clear filters hat weiterhin
seine bisherige Funktion. Keine persistenten XSS-Daten, Cookies oder DB-Änderungen.

Logging bleibt erreichbar:

```sh
curl http://localhost:8080/api/challenges/log-flood/status
docker compose exec shop npm run reset:challenge
```

Das zweite Kommando setzt ausschließlich das bestehende Challenge-Log zurück.
Die vorhandene ausführliche Logging-Anleitung steht in der Repository-README.

## Sichere Korrektur und Regression

Die produktive Korrektur im Preview-Script lautet:

```js
document.getElementById('result').textContent = 'No products found for: ' + search;
```

Danach denselben Payload erneut testen: Der gesamte HTML-Text muss sichtbar
bleiben, die Sicherheitsmeldung darf nicht per Handler entstehen. Ein normaler
Suchbegriff muss weiterhin angezeigt werden. Der CSP-Hash wird beim Serverstart
aus dem Script berechnet und bleibt nach der Änderung korrekt.
Die `innerHTML`-Assertion im Challenge-Test dann entsprechend auf textContent
und die sichere Erwartung umstellen. Für echten Rich Text wäre ein geprüfter
Sanitizer nötig; diese Anzeige braucht keinen Rich Text.

Automatisierte Tests: `npm test`, `npm run lint`, `npm run build`.
Die neuen Node-Tests prüfen HTTP-Grenzen, CSP, statische Auslieferung,
URL-Dekodierung bis zur isolierten Senke und Shop-Anbindung. Sie ersetzen keinen
echten Browsernachweis von Sandbox und Eventhandler-Ausführung; dafür gilt
das manuelle Szenario oben.

## Durchgeführte Prüfung dieser Implementierung

- Produktionsbuild und ESLint erfolgreich.
- Vier neue XSS-Tests erfolgreich; zehn bestehende Client-Tests erfolgreich.
- Backend: 23 von 29 Tests erfolgreich. Sechs bestehende Auth-/Bestelltests
  schlagen auch mit der unveränderten HEAD-Version von server/app.js fehl:
  Tests schicken Klartextpasswörter, die bestehende API verlangt Hashes.
  Diese unabhängige Auth-Implementierung wurde nicht geändert.
- Temporärer Headless-Chrome-Test mit In-Memory-Datenbank: Referenzpayload
  ausgeführt, Eltern-DOM/Storage und API-fetch gesperrt, Reset erfolgreich.
- Preview-Image gebaut und mit den Containerlimits ohne Volumes gestartet;
  HTTP 200 über die veröffentlichte Loopback-Adresse bestätigt.
- Bestehende Shop-Datenbank und Docker-Datenvolumes wurden nicht gestartet
  oder verändert; Testcontainer und temporäres Testnetz wurden entfernt.