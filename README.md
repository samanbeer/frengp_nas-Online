# FRENGP | NAS Vyuka

Webová aplikace sloužící jako klientské rozhraní pro přístup ke školnímu NAS úložišti (`nas.frengp.cz`) přímo z prostředí internetového prohlížeče.

## Jak aplikace funguje

Webové prohlížeče ze své podstaty neumí komunikovat přímo přes síťový FTPS protokol, který vyžaduje přímé TCP sockety a dynamické otevírání pasivních datových portů. Aplikace proto funguje na dvouvrstvé architektuře:

1. **Frontend**: Responzivní aplikace v Reactu (Vite, Tailwind CSS), která uživateli poskytuje rozhraní pro procházení adresářů, stahování souborů a náhledy multimédií (obrázky, video, audio, PDF a textové soubory).
2. **Backend**: Express.js server (nasazený na platformě Vercel), který přijímá HTTP požadavky z webového rozhraní a v roli FTPS klienta komunikuje přímo se školním NAS serverem.

```
[Prohlížeč klienta] <--- HTTPS ---> [Vercel API / Express] <--- FTPS (TLS, Port 21) ---> [NAS server nas.frengp.cz]
```

## Jak probíhá připojení a autentizace

1. **Přihlášení**:
   Uživatel zadá své uživatelské jméno a heslo, která jsou shodná s údaji pro přihlášení ze školní sítě. Backend tyto údaje ověří navázáním zabezpečeného spojení vůči FTPS serveru na adrese `nas.frengp.cz:21` za použití explicitního TLS šifrování řídicího i datového kanálu.

2. **Zabezpečení relace**:
   Po úspěšném ověření server vystaví šifrovanou bezstavovou relaci chráněnou algoritmem AES-256-GCM pomocí klíče `SESSION_SECRET`. Relace je uložena v prohlížeči výhradně jako `HttpOnly`, `Secure` a `SameSite=Lax` cookie, ke které nemá přístup klientský JavaScript.

3. **Optimalizace a práce se soubory**:
   Pro dosažení vysoké rychlosti backend udržuje otevřený pool teplých FTPS spojení, takže se šifrovací handshake neopakuje při každém kliknutí. Zároveň je nasazena krátkodobá paměťová mezipaměť (TTL 20 s), která se při manuálním obnovení (Refresh) okamžitě obchází a při nahrání či smazání souboru automaticky invaliduje.
