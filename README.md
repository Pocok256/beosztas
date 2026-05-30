# Havi beosztas generator

Ez az alkalmazas egy Node.js alapu, bongeszoben hasznalhato beosztas-generator.

## Mit tud

- Honap alapu beosztast general.
- Hetvegere 24, hetkoznapra 16 ora kiosztast szamol.
- A magyar munkaszuneti unnepnapokat automatikusan figyelembe veszi, es azokra is 24 oras muszakkal szamol.
- A honaphoz kezi kivetel is hozzaadhato, igy egy adott nap kulon munkanapra vagy szunnapra allithato.
- Egy napra legfeljebb 2 embert oszt be.
- Ha egy napra 2 ember kerul, mindketten a teljes napi 16 vagy 24 orat kapjak meg.
- Bekeri a neveket es a nem vallalt napokat.
- Igyekszik folyamatos blokkokat es a 168 oras celhoz kozeli elosztast adni.
- Egy ember havi oraszama semmilyen korulmeny kozott nem mehet 168 ora fole.
- A generalast HTML fajlkent is elmenti, es linket ad hozza.
- A korabbi generalasok visszanezhetok.

## Inditas

```bash
npm install
npm start
```

Ezutan nyisd meg a bongeszoben a `http://localhost:3000` cimet.

## Kezi kivetelek

A honapvalaszto alatt kulon felveheto olyan napi feluliras, amely az automatikus hetvege es unnepnap logikat modosítja.

- `Munkanap`: az adott nap 16 oras napkent lesz kezelve.
- `Szunnap`: az adott nap 24 oras, munkaszuneti napkent lesz kezelve.

Ez akkor hasznos, ha athelyezett munkanapot vagy pihenonapot szeretnel figyelembe venni.

## Teszt

```bash
npm test
```

## Docker

Az alkalmazas dockerizalva is futtathato, ugy hogy a `data` es `exports` mappa tartalma a host gepen megmaradjon.

### Inditas Docker Compose-zal

```bash
docker compose up --build -d
```

Ezutan az alkalmazas alapertelmezetten a `http://localhost:3000` cimen erheto el.

### Leallitas

```bash
docker compose down
```

### Frissites uj kod utan

```bash
docker compose up --build -d
```

### Port modositas

Ha nem a 3000-es portot szeretned hasznalni, inditas elott adj meg egy `APP_PORT` kornyezeti valtozot:

```bash
APP_PORT=8080 docker compose up --build -d
```

### Tartos adatok

- A generalasi elozmenyek a `data/history.json` fajlba kerulnek.
- Az exportalt HTML fajlok az `exports` mappaba kerulnek.
- A `docker-compose.yml` ezeket bind mounttal a host gep mappaihoz koti, ezert kontener ujrainditas utan is megmaradnak.

### Szerveres feltoltes

Masold fel a teljes projektet a szerverre, majd a projekt gyokerkonyvtaraban futtasd:

```bash
docker compose up --build -d
```

Ha a 3000-es port nyitva van a szerveren, akkor az alkalmazas a `http://szerver-ip:3000` cimen azonnal elerheto lesz.