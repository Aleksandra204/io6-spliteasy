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





function verifyToken(req, res, next) {
  const cookies = req.headers.cookie;
  if (!cookies) return res.status(401).json({ msg: "Brak ciasteczek" });

  const parsedCookies = cookie.parse(cookies);
  const token = parsedCookies.jwtToken;

  if (!token) return res.status(401).json({ msg: "Brak tokenu" });

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return res.status(403).json({ msg: "Nieprawidłowy token" });
    req.user = decoded;
    next();
  });
}



app.get("/user/:email", verifyToken, async (req, res) => {
  const { email } = req.params;
  try {
    const result = await pool.query('SELECT id, name FROM "User" WHERE mail = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Użytkownik nie znaleziony" });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Błąd serwera" });
  }
});


app.post("/group", verifyToken, async (req, res) => {
  const { name, userIds } = req.body;
  const ownerId = req.user.userId;

  // console.log("req.user:", req.user);
  // console.log("ownerId:", ownerId);
  // console.log("name:", name);

  if (!name || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ msg: "Nieprawidłowe dane" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Utworzenie grupy
    const groupRes = await client.query(
      'INSERT INTO "Group" (name, owner_user_id) VALUES ($1, $2) RETURNING id',
      [name, ownerId]
    );

    const groupId = groupRes.rows[0].id;

    // Dodanie osób i  właściciela do grupy
    const allUserIds = Array.from(new Set([...userIds, ownerId]));

    const insertPromises = allUserIds.map((userId) =>
      client.query(
        'INSERT INTO Group_users (group_id, user_id) VALUES ($1, $2)',
        [groupId, userId]
      )
    );

    await Promise.all(insertPromises);
    await client.query("COMMIT");

    res.status(201).json({ msg: "Grupa utworzona", groupId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ msg: "Błąd tworzenia grupy" });
  } finally {
    client.release();
  }
});



