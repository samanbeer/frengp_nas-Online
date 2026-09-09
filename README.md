# 🚀 NAS Cloud - Moderní Webový Správce Souborů

Moderní, rychlá a zabezpečená webová aplikace pro správu souborů na vašem NAS serveru (`ftps://nas.frengp.cz`) určená pro běh na doméně **`nas.saman.beer`**.

Uživatel se přihlašuje zadáním svých přihlašovacích údajů k FTPS serveru.

---

## ✨ Klíčové Vlastnosti

- **🔐 100% Zabezpečené spojení**:
  - Připojení k NAS přes šifrovaný FTPS protokol (**TLSv1.3** explicit encryption).
  - Ochrana proti brute-force útokům (Rate limiting pro pokusy o přihlášení).
  - Bezpečná správa sezení: Sezení v paměti šifrovaná pomocí **AES-256-GCM**, HttpOnly cookies.
  - Ochrana proti Directory Traversal útokům (`..` path sanitization).
  - Bezpečnostní hlavičky přes **Helmet** (CSP, XSS ochrana, nosniff).
- **🎨 Moderní & Vyladěné UI**:
  - Elegantní rozhraní inspirované Nextcloud / Apple Finder s tmavým režimem a skleněným efektem (Glassmorphism).
  - Plně responzivní design (mobil, tablet i počítač).
  - Zobrazení v **mřížce** (Grid) nebo v **seznamu** (Table list).
  - Interaktivní drobečková navigace (Breadcrumbs) a rychlé vyhledávání / filtrování souborů v reálném čase.
  - Řazení podle názvu, velikosti a data poslední úpravy.
- **📂 Plná správa souborů & složek**:
  - **Drag & Drop nahrávání**: Přetáhněte soubory odkudkoliv z plochy přímo do okna prohlížeče.
  - **Stahování souborů**: Jedním kliknutím stáhnete jakýkoliv soubor.
  - **Vytváření složek**: Tvorba nových složek s okamžitým ověřením názvu.
  - **Přejmenování & Mazání**: Přejmenování i bezpečné mazání s potvrzovacím dialogem.
  - **Vestavěný textový/kódový editor**: Možnost vytvářet a přímo v prohlížeči upravovat textové soubory, konfigurační soubory, skripty a zdrojové kódy s okamžitým ukládáním na NAS.
- **👁️ Multimediální náhledy (Preview)**:
  - **Obrázky**: Prohlížeč s možností přiblížení (zoom), otáčení (rotate) a zobrazení v plném rozlišení.
  - **Audio přehrávač**: Přehrávání hudby a zvukových záznamů přímo na stránce.
  - **Video přehrávač**: Streamování videa v HTML5 přehrávači.
  - **PDF dokumenty**: Vestavěný prohlížeč PDF.

---

## 🛠️ Architektura aplikace

Webové prohlížeče ze své podstaty neumí komunikovat přímo s raw TCP/FTPS sockety. Proto aplikace funguje na architektuře:

```
[Webový prohlížeč]  <--->  [Node.js Express Backend]  <== FTPS (TLSv1.3) ==>  [NAS server]
(nas.saman.beer)           (REST API & Static SPA)                            (nas.frengp.cz:21)
```

1. **Frontend**: Single-Page Application (React 18 + Vite + Tailwind CSS + Lucide Icons).
2. **Backend**: Node.js + Express + `basic-ftp` s TLS šifrováním datového i řídicího kanálu.

---

## 🚀 Rychlé spuštění

### 1. Požadavky
- Node.js verze 18 nebo vyšší
- npm

### 2. Spuštění ve vývojovém režimu (Development)
Příkaz spustí backend server na portu 5000 a Vite dev server na portu 5173 s hot-reloadingem:

```bash
npm run dev
```

Otevřete v prohlížeči: [http://localhost:5173](http://localhost:5173)

### 3. Sestavení a produkční spuštění (Production)
Jedním příkazem sestavíte frontend a spustíte produkční server:

```bash
# Sestavení frontendu do složky client/dist
npm run build

# Spuštění serveru
npm start
```

Aplikace poběží na portu `5000`: [http://localhost:5000](http://localhost:5000)

---

## ⚡ Nasazení na Vercel (Doporučeno pro nas.saman.beer)

Aplikace je plně uzpůsobena pro bezproblémový běh na **Vercelu** (statický frontend + Serverless backend):

1. Přejděte na [vercel.com](https://vercel.com) a přihlaste se přes svůj **GitHub**.
2. Klikněte na **Add New...** -> **Project**.
3. Vyberte repozitář **`frengp_nas-Online`** a klikněte na **Import**.
4. V sekci **Environment Variables** přidejte:
   - `FTPS_HOST`: `nas.frengp.cz`
   - `FTPS_PORT`: `21`
   - `SESSION_SECRET`: *(zadejte libovolný dlouhý náhodný řetězec, např. 32 znaků)*
   - `FTPS_REJECT_UNAUTHORIZED`: `false`
5. Klikněte na **Deploy**. Vercel automaticky zkompiluje frontend i serverless API.
6. **Propojení s doménou `nas.saman.beer`**:
   - V projektu na Vercelu přejděte do **Settings** -> **Domains**.
   - Zadejte `nas.saman.beer` a klikněte na **Add**.
   - Vercel vám zobrazí DNS záznam (např. `CNAME cname.vercel-dns.com`).
   - Tento záznam vložte do administrace své domény u registrátora. Vercel automaticky vystaví a obnovuje SSL HTTPS certifikát!

---

## 🌐 Alternativa: Vlastní Linux Server / VPS (`nas.saman.beer`)

Pokud chcete aplikaci provozovat na vlastním serveru:

### Krok 1: DNS záznam
V administraci vaší domény nastavte **A záznam**:
- Název: `nas` (nebo `nas.saman.beer`)
- Hodnota: `IP adresa vašeho serveru`

### Krok 2: Reverse Proxy (HTTPS / SSL)
Máte připravené hotové konfigurace ve složce `deploy/`:

#### Varianta A: Caddy (nejjednodušší, automatické HTTPS zdarma)
1. Nainstalujte Caddy: `sudo apt install caddy`
2. Zkopírujte konfiguraci: `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile`
3. Restartujte Caddy: `sudo systemctl reload caddy`
*(Caddy sám automaticky vygeneruje a obnovuje Let's Encrypt SSL certifikát)*

#### Varianta B: Nginx + Certbot
1. Zkopírujte konfiguraci: `sudo cp deploy/nginx.conf /etc/nginx/sites-available/nas.saman.beer`
2. Aktivujte: `sudo ln -s /etc/nginx/sites-available/nas.saman.beer /etc/nginx/sites-enabled/`
3. Získejte certifikát: `sudo certbot --nginx -d nas.saman.beer`
4. Restartujte Nginx: `sudo systemctl reload nginx`

### Krok 3: Běh na pozadí jako systémová služba (systemd)
Aby aplikace běžela nepřetržitě i po restartu serveru:

```bash
sudo cp deploy/nas-website.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable nas-website
sudo systemctl start nas-website
```

Zkontrolovat stav můžete:
```bash
sudo systemctl status nas-website
```

---

## ⚙️ Konfigurace prostředí (`.env`)

Soubor `.env` v kořenovém adresáři obsahuje nastavení:

| Proměnná | Popis | Výchozí hodnota |
|---|---|---|
| `PORT` | Port, na kterém běží Node.js server | `5000` |
| `FTPS_HOST` | Adresa FTPS serveru | `nas.frengp.cz` |
| `FTPS_PORT` | FTPS Port (standardní FTP s explicit TLS) | `21` |
| `FTPS_USER` | Volitelný výchozí přihlašovací uživatel | `""` (prázdné) |
| `SESSION_SECRET` | Tajný klíč pro šifrování relací v paměti | *(vygenerovaný náhodný hash)* |
| `SESSION_TTL_HOURS` | Doba platnosti přihlášení (v hodinách) | `24` |
| `NODE_ENV` | Režim prostředí (`development` / `production`) | `production` |

---

## 🔒 Bezpečnostní mechanismy

1. **Žádné heslo není ukládáno v plaintextu na disku**:
   Heslo je po zadání uživatelem použito k navázání zabezpečené FTPS relace a v paměti serveru je zašifrováno pomocí symetrického šifrování **AES-256-GCM**.
2. **HttpOnly Cookies**:
   Klientský JavaScript v prohlížeči nemá přímý přístup k tokenům sezení, což eliminuje riziko krádeže identity při případném XSS.
3. **FTPS TLSv1.3**:
   Veškerý přenos dat mezi vaším webovým serverem a NAS probíhá šifrovaným tunelem (`AUTH TLS` a `PROT P`).
4. **Rate Limiting**:
   Ochrana proti automatizovaným brute-force útokům na heslo (omezen počet pokusů z jedné IP adresy).
