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
		const existing = await pool.query('SELECT * FROM "User" WHERE mail = $1', [
			mail,
		]);
		if (existing.rows.length > 0)
			return res.status(400).json({ msg: "Użytkownik już istnieje" });
		const hashed = await bcrypt.hash(password, 10);
		await pool.query(
			'INSERT INTO "User" (name, mail, password) VALUES ($1, $2, $3)',
			[name, mail, hashed]
		);
		res.status(201).json({ msg: "Zarejestrowano pomyślnie" });
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: "Błąd serwera" });
	}
});

app.post("/login", async (req, res) => {
	const { mail, password } = req.body;
	try {
		const result = await pool.query('SELECT * FROM "User" WHERE mail = $1', [
			mail,
		]);
		if (result.rows.length === 0)
			return res.status(404).json({ msg: "Nie znaleziono użytkownika" });
		const user = result.rows[0];
		const match = await bcrypt.compare(password, user.password);
		if (!match) return res.status(401).json({ msg: "Złe hasło" });
		jwt.sign(
			{ userId: user.id, mail: user.mail },
			jwtSecret,
			{ expiresIn: "1h" },
			(err, token) => {
				if (err) throw err;
				const cookieOptions = {
					secure: true,
					httpOnly: true,
					maxAge: 3600 * 1000,
					sameSite: "none",
				};
				res.setHeader(
					"Set-Cookie",
					cookie.serialize("jwtToken", token, cookieOptions)
				);
				res.status(200).json({ msg: "Zalogowano!" });
			}
		);
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: "Błąd serwera przy logowaniu" });
	}
});

app.listen(port, () =>
	console.log(`🚀 Serwer działa na http://localhost:${port}`)
);

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
		const result = await pool.query(
			'SELECT id, name FROM "User" WHERE mail = $1',
			[email]
		);
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
				"INSERT INTO Group_users (group_id, user_id) VALUES ($1, $2)",
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

app.get("/balance-users", verifyToken, async (req, res) => {
	const userId = req.user.userId;

	try {
		const result = await pool.query(
			`
      WITH bills_paid AS (
        SELECT
          b.id AS bill_id,
          p.user_id AS payer_id,
          p.split_price AS paid_amount,
          br.user_id AS borrower_id,
          br.split_price AS borrower_amount
        FROM Bill b
        JOIN Payers p ON b.id = p.bill_id
        JOIN Borrowers br ON br.bill_id = b.id
        WHERE p.user_id = $1
      ),
      debts AS (
        SELECT
          borrower_id AS user_id,
          SUM(borrower_amount) AS amount_owed
        FROM bills_paid
        WHERE borrower_id != $1
        GROUP BY borrower_id
      ),
      credits AS (
        SELECT
          from_user_id AS user_id,
          SUM(amount) AS amount_sent
        FROM Transactions
        WHERE to_user_id = $1
        GROUP BY from_user_id
      ),
      payments AS (
        SELECT
          to_user_id AS user_id,
          SUM(amount) AS amount_paid
        FROM Transactions
        WHERE from_user_id = $1
        GROUP BY to_user_id
      ),
      users AS (
        SELECT DISTINCT u.id, u.name
        FROM "User" u
        JOIN Group_users gu ON gu.user_id = u.id
        WHERE gu.group_id IN (
          SELECT group_id FROM Group_users WHERE user_id = $1
        ) AND u.id != $1
      )
      SELECT 
        users.id,
        users.name,
        COALESCE(d.amount_owed, 0) 
        - COALESCE(c.amount_sent, 0) 
        + COALESCE(p.amount_paid, 0) AS balance
      FROM users
      LEFT JOIN debts d ON users.id = d.user_id
      LEFT JOIN credits c ON users.id = c.user_id
      LEFT JOIN payments p ON users.id = p.user_id
    `,
			[userId]
		);

		res.json(result.rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: "Błąd serwera (balance-users)" });
	}
});

app.get("/balance", verifyToken, async (req, res) => {
	const userId = req.user.userId;

	try {
		const result = await pool.query(
			`
      WITH bills_in_groups AS (
        SELECT price FROM Bill 
        WHERE group_id IN (
          SELECT group_id FROM Group_users WHERE user_id = $1
        )
      ),
      you_owe AS (
        SELECT COALESCE(SUM(br.split_price), 0) AS total_owe
        FROM Borrowers br
        WHERE br.user_id = $1
      ),
      sent AS (
        SELECT COALESCE(SUM(amount), 0) AS total_sent
        FROM Transactions
        WHERE from_user_id = $1
      ),
      others_owe_you AS (
        SELECT COALESCE(SUM(p.split_price), 0) AS total_paid
        FROM Payers p
        WHERE p.user_id = $1
      ),
      received AS (
        SELECT COALESCE(SUM(amount), 0) AS total_received
        FROM Transactions
        WHERE to_user_id = $1
      )
      SELECT
        (SELECT COALESCE(SUM(price), 0) FROM bills_in_groups) AS total_group_spending,
        (SELECT total_owe FROM you_owe) - (SELECT total_sent FROM sent) AS you_owe_now,
        (SELECT total_paid FROM others_owe_you) - (SELECT total_received FROM received) AS others_owe_you
    `,
			[userId]
		);

		res.json(result.rows[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: "Błąd serwera (balance)" });
	}
});

app.get("/bills", verifyToken, async (req, res) => {
	const userId = req.user.userId;

	try {
		const result = await pool.query(
			`
      SELECT 
        b.id AS bill_id,
        b.price AS total,
        p_user.name AS payer,
        br.split_price AS your_share,
        b.date,
        b.description
      FROM Borrowers br
      JOIN Bill b ON b.id = br.bill_id
      JOIN Payers p ON p.bill_id = b.id
      JOIN "User" p_user ON p.user_id = p_user.id
      WHERE br.user_id = $1
    `,
			[userId]
		);

		res.json(
			result.rows.map((row) => ({
				description: row.description || "(brak opisu)",
				date: row.date || "(brak daty)",
				payer: row.payer,
				total: row.total,
				your_share: row.your_share,
			}))
		);
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: "Błąd serwera (bills)" });
	}
});
