# Bancarella

App per bancarelle di vestiti usati: registri ogni articolo venduto e il prezzo
finisce automaticamente nel conto della persona che ti aveva dato quel vestito.
Pensata per essere usata **con una mano, dal telefono o dal tablet**, mentre sei
al banco.

## Il flusso di lavoro

1. **Apri la giornata** — scegli la data e spunti le persone che ti hanno dato
   dei vestiti (puoi aggiungerne di nuove al volo).
2. **Elenco con i totali** — ogni persona compare in lista con il suo saldo
   aggiornato, ordinabile per nome o per totale.
3. **Vendi un articolo** — tocchi la persona, digiti il prezzo sul tastierino e
   premi _Aggiungi al saldo_. Con _Rimuovi_ correggi un errore, oppure annulli il
   singolo movimento dalla lista.
4. **Chiudi la giornata** — vedi il riepilogo, confermi e tutto viene salvato
   nello storico, giorno per giorno. Una giornata chiusa si può sempre riaprire.

Il tastierino non si scorre mai: display e tasti si spartiscono l'altezza
disponibile, entro un minimo e un tetto, così _Aggiungi_ e _Rimuovi_ restano
sempre sotto il pollice senza che i tasti si deformino sugli schermi alti.
L'intestazione mostra la card della persona — nome, articoli venduti, saldo — e
i suoi movimenti stanno dietro il tasto 🕘, che li apre sopra il tastierino
invece di allungare la pagina.

Dopo ogni importo la persona viene **deselezionata automaticamente**: il
tastierino si chiude e non si rischia di attribuire l'articolo successivo allo
stesso nome per distrazione. Al suo posto compare per qualche secondo una
conferma (`+5,00 € a Maria`) con un tasto **Annulla**, che funziona anche se il
movimento è ancora in coda e non è arrivato al server.

## Come si avvia

```bash
npm install
npm run dev
```

Poi apri http://localhost:3000 e registrati.

Per usarla dal telefono sulla stessa rete Wi-Fi di questo computer:

```bash
npm run dev:lan
```

e dal telefono vai su `http://<ip-del-computer>:3000` (su iPhone/Android puoi
fare "Aggiungi alla schermata Home": c'è il manifest, si apre a tutto schermo
come un'app).

In produzione:

```bash
npm run build
npm run start:lan
```

## Metterla su un server Linux

Serve **Node ≥ 22.13** (meglio la 24): il database usa `node:sqlite`, che nelle
versioni precedenti non esiste — su Node 20 la build muore con
`No such built-in module: node:sqlite`. Verifica sempre così, non solo con
`node -v`:

```bash
node -e "require('node:sqlite'); console.log('node:sqlite ok')"
```

### Aggiornare Node su AlmaLinux / RHEL / Rocky 9

Node 22 è in AppStream, non serve nessun repo esterno:

```bash
dnf module reset -y nodejs && dnf module enable -y nodejs:22 && dnf install -y nodejs
```

Se la 22 di AppStream fosse più vecchia della 22.13, prendi la 24 da NodeSource:

```bash
dnf module reset -y nodejs
curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
dnf install -y nodejs
```

Su Debian/Ubuntu l'equivalente è `deb.nodesource.com/setup_24.x` seguito da
`apt-get install -y nodejs`.

### Installare l'applicazione

```bash
mkdir -p /opt/bancarella /var/lib/bancarella
# copia qui il progetto (git clone oppure rsync), quindi:
cd /opt/bancarella && npm ci && npm run build
```

`npm ci` completo, non `--omit=dev`: la build usa TypeScript e Tailwind.

### Tenerla in piedi

Con pm2, che è la via più corta:

```bash
npm i -g pm2 && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

L'ultimo comando stampa una riga da eseguire: è quella che registra pm2 in
systemd, così l'app riparte anche dopo un riavvio della macchina. La
configurazione è in [`ecosystem.config.cjs`](ecosystem.config.cjs) — porta,
`DATA_DIR` e un solo processo in `fork` mode, perché il database è un file
SQLite. I log si leggono con `pm2 logs bancarella`.

Se preferisci systemd senza pm2, in `deploy/` c'è
[`bancarella.service`](deploy/bancarella.service) già pronto: usa una delle due
strade, non entrambe.

In `deploy/` ci sono poi i file per nginx:

- [`nginx-bancarella.conf`](deploy/nginx-bancarella.conf) — virtual host, primo
  passo in solo HTTP perché certbot possa emettere il certificato;
- [`nginx-bancarella-tls.conf`](deploy/nginx-bancarella-tls.conf) — la versione
  finale con HTTPS, se preferisci scriverla a mano invece di lasciar fare a
  `certbot --nginx`.

Su un server con più siti non c'è niente da modificare in `nginx.conf`: il file
va in `/etc/nginx/conf.d/`, non usa `default_server` e ha log separati, quindi
gli altri virtual host non se ne accorgono. L'applicazione ascolta solo su
`127.0.0.1:5000`, così si raggiunge unicamente passando da nginx; se quella
porta è già occupata, cambiala nell'unità systemd e nel `proxy_pass`.

```bash
useradd -r -s /sbin/nologin bancarella
chown -R bancarella:bancarella /opt/bancarella /var/lib/bancarella
cp deploy/bancarella.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now bancarella
journalctl -u bancarella -f
```

### Le cinque cose su cui è facile inciampare

1. **HTTPS.** In produzione il cookie di sessione è `secure`: su HTTP semplice il
   browser lo scarta e l'accesso non funziona, senza errori chiari. Se il server
   risponde solo in HTTP, imposta `COOKIE_NON_SICURO=1` — sapendo che così
   password e sessione viaggiano in chiaro.
2. **`DATA_DIR` fuori da `/opt/bancarella`**, altrimenti il prossimo deploy
   cancella il database.
3. **SELinux** (attivo per default su AlmaLinux): senza questo nginx non riesce a
   contattare l'applicazione e risponde 502.
   ```bash
   setsebool -P httpd_can_network_connect 1
   ```
4. **firewalld**: apri le porte, altrimenti da fuori non arrivi.
   ```bash
   firewall-cmd --permanent --add-service=http --add-service=https && firewall-cmd --reload
   ```
5. **Un solo processo.** Il database è un file SQLite: niente cluster mode né più
   istanze in bilanciamento.

### Se Node non si potesse aggiornare

L'alternativa è cambiare driver (`node-sqlite3-wasm`, funziona da Node 18 senza
compilazione nativa): cambia solo `src/lib/db.ts`, il formato del file `.db`
resta lo stesso. Sul tuo server però Node si aggiorna, quindi non serve.

## Dove finiscono i dati

**Database SQLite** — un unico file in `data/bancarella.db` (cartella creata
automaticamente, esclusa da git). Usa il modulo `node:sqlite` incluso in Node 22,
quindi non c'è niente da compilare o installare. Tabelle: `users`, `sessions`,
`people`, `days`, `day_participants`, `movements`. Gli importi sono salvati in
**centesimi interi**, mai in virgola mobile.

Per un backup basta copiare la cartella `data/`.

**Persistenza nel browser** — pensata per non perdere niente se la pagina si
ricarica, se il telefono va in standby o se manca la rete al mercato:

| Dove             | Cosa                                                                                   | Perché                                                                       |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `localStorage`   | ultimo stato della giornata, elenco persone                                            | la lista compare subito e resta leggibile anche senza rete                   |
| `localStorage`   | **coda dei movimenti non ancora inviati**                                              | se la rete cade continui a vendere; i movimenti partono da soli quando torna |
| `localStorage`   | bozza della giornata da aprire (data, nome, persone spuntate)                          | se chiudi il browser a metà setup ritrovi tutto                              |
| `sessionStorage` | tastierino aperto e cifre digitate                                                     | un refresh accidentale non ti fa perdere il prezzo a metà                    |
| cookie           | sessione di accesso (`httpOnly`), ultima giornata usata, importi rapidi personalizzati | l'accesso resta valido 120 giorni; i tasti rapidi restano quelli tuoi        |

Ogni movimento in coda porta un `clientId` univoco e il server ha un vincolo di
unicità su `(day_id, client_id)`: se un invio viene ritentato, **il movimento non
viene registrato due volte**.

## Layout

| Schermo                        | Come si presenta                                                    |
| ------------------------------ | ------------------------------------------------------------------- |
| telefono                       | una colonna, navigazione in barra sotto, tastierino a tutto schermo |
| tablet in verticale            | il tastierino si apre come finestra centrata, ad altezza piena      |
| **tablet in orizzontale / PC** | **elenco a sinistra, tastierino sempre aperto a destra**            |

La vista affiancata scatta a `(min-width: 1024px) and (orientation: landscape)`:
prende quindi l'iPad in orizzontale e qualunque schermo da PC, ma lascia in
colonna singola il tablet in verticale, dove non ci sarebbe spazio. Nella
schermata della giornata la **colonna laterale del menu è nascosta** su tablet e
PC — lo spazio serve tutto a elenco e tastierino — e le altre sezioni si
raggiungono dalle icone in alto a destra. Il tastierino nella colonna destra usa
altezze ridotte per stare in una schermata sola, resta agganciato mentre scorri
l'elenco, e la persona selezionata è evidenziata nella lista.

## Tema

Tre modi, scelti dal tasto ☀️ / 🌙 / 📱 (in intestazione su telefono, nella
colonna laterale su tablet e PC):

- **Chiaro** — il default;
- **Scuro**;
- **Come il telefono** — segue `prefers-color-scheme`.

La scelta sta in un cookie letto dal server, quindi la pagina nasce già col
colore giusto: nessun lampo bianco al caricamento. La variante `dark:` di
Tailwind è ridefinita per seguire il tema scelto invece delle impostazioni di
sistema.

## Note sull'interfaccia

- Tastierino in stile registratore di cassa: le cifre entrano da destra, quindi
  `500` significa `5,00 €`. Nessuna virgola da digitare.
- Sei tasti di importo rapido, personalizzabili (si salvano in un cookie).
- Aree di tocco da 52–64 px, font a 16 px sui campi (così iOS non zooma),
  `viewport-fit=cover` e rispetto delle safe area, feedback tattile sui tasti.
- Feedback tattile (`navigator.vibrate`) su tasti e conferme.

## Una particolarità di questo volume

`/Volumes/Lavoro` non è formattato APFS/HFS+, quindi macOS scrive un file
`._nome` accanto a ogni file per conservare gli attributi estesi. Sono innocui
per l'app, ma la cache di Turbopack non riesce a interpretarli e la build muore
con `Failed to open database … invalid digit found in string`. Per questo `dev` e
`build` sono precedute da uno script `pulisci` che li rimuove; se ricapita:

```bash
rm -rf .next && npm run build
```
