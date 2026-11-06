# Ein-IP-XSS-Challenge

Shop und Vorschau laufen im selben Container auf Port 8080, ohne DNS oder hosts-Eintrag.

Auf der VM im bestehenden Compose-Projekt (bestehende Umgebungsvariablen beibehalten):

~~~sh
SHOP_BIND_IP=10.13.26.24 docker compose up --build -d --remove-orphans
~~~

Das entfernt den bisherigen Preview-Container. Keine Volumes loeschen. Beim
Container-Neustart wird das bestehende fluechtige Log wie bisher geleert.

Shop: http://10.13.26.24:8080/products
Vorschau: http://10.13.26.24:8080/xss-preview/

Die Vorschau ist wie auf dem Feature-Branch dauerhaft verfuegbar, unabhaengig vom
XSS-Datenbankflag. Bei einer Suche wird sie als iframe eingebettet.

## Praktischer Test

Diesen Text in die Produktsuche eingeben:

~~~html
<svg onload="document.getElementById('result').textContent='JavaScript in der isolierten Vorschau ausgefuehrt'"></svg>
~~~

Die Meldung muss im iframe erscheinen. Clear search leert die Suche; erneute
Eingabe erzeugt ein neues iframe. alert() ist ohne allow-modals gesperrt.

## Isolation

server/xss-preview.js liefert statisches HTML vor Shop-CSP, JSON-Parser und
Session-Abfrage. URL-Daten werden ausschliesslich im Browser per innerHTML
eingefuegt. Cookie- und Authorization-Header werden nicht ausgewertet oder reflektiert.

iframe-Sandbox und HTTP-CSP erlauben Skripte ohne allow-same-origin, auch beim
direkten Oeffnen der Vorschau. Die opake Origin verhindert Zugriff auf Eltern-DOM,
Shop-Cookies und Shop-Storage. connect-src 'none' blockiert fetch; weitere
CSP-Regeln sperren externe Ressourcen, Frames und Formulare. Nur die Vorschau
erlaubt absichtlich Inline-Eventhandler; die Shop-Skript-CSP bleibt restriktiv.
Es gibt keine postMessage-Bruecke. Die Sandbox ist keine universelle Netzwerksperre
und begrenzt keine Browser-CPU.

In der Browserkonsole des Vorschau-Frames pruefen:
- parent.document, document.cookie und localStorage muessen SecurityError ausloesen.
- fetch('/api/auth/me', {credentials:'include'}) muss an der CSP scheitern.
- Auch die direkt geoeffnete Vorschau muss diese Grenzen einhalten.

## Automatische Pruefungen

npm test prueft unter anderem Vorschau-Header, festen HTML-Inhalt, fehlende
Cookie-/CORS-Freigaben, URL-Datenfluss, HEAD, Methoden, Unterpfade und Laengenlimit.
Diese Tests ersetzen keinen echten Browsertest der Skriptausfuehrung und Isolation.
npm run build prueft den Frontend-Build. npm run dev startet nur API und Vite;
Vite leitet /xss-preview an Express weiter.

Pruefung dieser Integration: Build und ESLint der geaenderten Frontend-Dateien
erfolgreich; vier XSS-Tests erfolgreich. Ein separater Headless-Chrome-Lauf mit
temporaerem Profil und In-Memory-Datenbank bestaetigte Skriptausfuehrung im iframe,
verweigerten Eltern-DOM-/Cookie-/Storage-Zugriff und CSP-blockiertes fetch ohne
Shop-API-Aufruf. Auch die direkt geoeffnete Vorschau wurde geprueft.

Die Gesamtsuite ist bereits im Ausgangsstand fehlerhaft: acht Shoptests scheitern
bei Login, Registrierung, Bestellungen und Challenge-Verhalten. Ein Kontrolllauf
mit unveraendertem HEAD reproduzierte dieselben acht Fehler. Beide Laeufe bleiben
nach den Testergebnissen haengen. Diese fremde Logik wurde nicht angepasst.
