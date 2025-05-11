const express = require("express");
const path = require("path");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const jwtSecret = process.env.JWT_SECRET;
const port = 2137;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "..", "client")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

app.get("/:page", (req, res, next) => {
  const page = req.params.page;
  if (page.endsWith(".ico")) return next();
  res.sendFile(path.join(__dirname, "..", "client", `${page}.html`));
});


app.post("/register", async (req, res) => {
  const { name, mail, password } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM "User" WHERE mail = $1', [mail]);
    if (existing.rows.length > 0) return res.status(400).json({ msg: "Użytkownik już istnieje" });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO "User" (name, mail, password) VALUES ($1, $2, $3)', [name, mail, hashed]);
    res.status(201).json({ msg: "Zarejestrowano pomyślnie" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Błąd serwera" });
  }
});

app.post("/login", async (req, res) => {
  const { mail, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM "User" WHERE mail = $1', [mail]);
    if (result.rows.length === 0) return res.status(404).json({ msg: "Nie znaleziono użytkownika" });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ msg: "Złe hasło" });
    jwt.sign({ userId: user.id, mail: user.mail }, jwtSecret, { expiresIn: "1h" }, (err, token) => {
      if (err) throw err;
      const cookieOptions = {
        secure: true,
        httpOnly: true,
        maxAge: 3600 * 1000,
        sameSite: "none",
      };
      res.setHeader("Set-Cookie", cookie.serialize("jwtToken", token, cookieOptions));
      res.status(200).json({ msg: "Zalogowano!" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Błąd serwera przy logowaniu" });
  }
});

app.listen(port, () => console.log(`🚀 Serwer działa na http://localhost:${port}`));