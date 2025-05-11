# 🔐 Split Easy – Express.js + PostgreSQL + JWT

Ten projekt to prosty backend oparty o Express.js i PostgreSQL do obsługi rejestracji i logowania z użyciem JWT zapisywanego w ciasteczkach. Frontend oparty jest o statyczne pliki HTML i CSS.

---

## 📦 Wymagania

- Node.js (v18+ zalecane): https://nodejs.org/
- PostgreSQL (np. baza w Tembo)
- Git (opcjonalnie)

---

## 🛠 Instalacja i uruchomienie

1. **Sklonuj lub pobierz projekt**

   ```bash
   git clone <adres repozytorium>
   cd io6-spliteasy/server
   ```

2. **Zainstaluj zależności**

   ```bash
   npm install
   ```

3. **Pobierz plik `.env` z jiry i umieść go w katalogu `server/` **

   **Przykład dla Tembo:**

   ```env
   PGHOST=maternally-blithe-pinniped.data-1.euc1.tembo.io
   PGPORT=5432
   PGDATABASE=postgres
   PGUSER=postgres
   PGPASSWORD=l4DkNDOyoYYd8WUv
   DATABASE_URL=postgresql://postgres:l4DkNDOyoYYd8WUv@maternally-blithe-pinniped.data-1.euc1.tembo.io:5432/postgres
   JWT_SECRET=sekretJWT
   ```

4. **Uruchom serwer**

   ```bash
   npm run dev
   ```

   Jeśli wszystko działa poprawnie, zobaczysz:

   ```
   🚀 Serwer działa na http://localhost:2137
   ```

---

## 🌐 Dostępne strony (frontend)

- `http://localhost:2137/home.html` – Strona główna
- `http://localhost:2137/register` – Rejestracja użytkownika
- `http://localhost:2137/login` – Logowanie użytkownika

---

## 📁 Struktura katalogów

```
io6-spliteasy/
├── client/
│   ├── assets/
│   │   ├── image.svg
│   │   └── logo.svg
│   ├── css/
│   │   ├── common.css
│   │   └── home.css
│   ├── home.html
│   ├── login.html
│   └── register.html
├── server/
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   ├── server.js
└── README.md
```

---
