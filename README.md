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

| Schermo                        | Come si presenta                                                       |
| ------------------------------ | ---------------------------------------------------------------------- |
| telefono                       | una colonna, navigazione in barra sotto, tastierino che sale dal basso |
| tablet in verticale            | come sopra, con più respiro; colonna laterale di navigazione           |
| **tablet in orizzontale / PC** | **elenco a sinistra, tastierino sempre aperto a destra**               |

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
