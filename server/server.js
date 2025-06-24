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
// app.use(express.static(path.join(__dirname, "..", "client")));

const pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    ssl: {
        rejectUnauthorized: false,
    },
});

app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
});

app.get("/user/me", verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query(
            'SELECT id, name, mail FROM "User" WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ msg: "Użytkownik nie znaleziony" });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Błąd w /user/me:", err);
        res.status(500).json({ msg: "Błąd serwera" });
    }
});

app.post("/logout", (req, res) => {
    res.setHeader(
        "Set-Cookie",
        cookie.serialize("jwtToken", "", {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 0,
            path: "/",
        })
    );
    res.status(200).json({ msg: "Wylogowano" });
});

app.post("/register", async (req, res) => {
    const { name, mail, password } = req.body;
    try {
        const existing = await pool.query(
            'SELECT * FROM "User" WHERE mail = $1',
            [mail]
        );
        if (existing.rows.length > 0)
            return res.status(400).json({ msg: "Użytkownik już istnieje" });
        const hashed = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO "User" (name, mail, password, balans) VALUES ($1, $2, $3, $4)',
            [name, mail, hashed, 0]
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
        const result = await pool.query(
            'SELECT * FROM "User" WHERE mail = $1',
            [mail]
        );
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
                    secure: false,
                    httpOnly: true,
                    maxAge: 3600 * 1000,
                    sameSite: "lax",
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
    console.log(`🚀 Serwer działa na http://localhost:${port}/home`)
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

        const groupRes = await client.query(
            'INSERT INTO "Group" (name, owner_user_id) VALUES ($1, $2) RETURNING id',
            [name, ownerId]
        );

        const groupId = groupRes.rows[0].id;

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

app.get("/group/:id/bills", verifyToken, async (req, res) => {
    const groupId = req.params.id;
    const userId = req.user.userId;

    try {
        const result = await pool.query(
            `
      SELECT 
        b.data,
        b.price       AS total,
        b.bill_name   AS description,
        p.user_id     AS payer_id,         
        u.name        AS payer,
        COALESCE(br.split_price, 0) AS your_share
      FROM bill b
      JOIN payers p    ON p.bill_id = b.id
      JOIN "User" u    ON u.id = p.user_id
      LEFT JOIN borrowers br 
        ON br.bill_id = b.id AND br.user_id = $2
      WHERE b.group_id = $1
      ORDER BY b.data DESC
      `,
            [groupId, userId]
        );

        res.json(
            result.rows.map((row) => ({
                description: row.description,
                date: row.data,
                total: row.total,
                payer_id: row.payer_id,
                payer: row.payer,
                your_share: row.your_share,
            }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Błąd serwera (group bills)" });
    }
});

app.get("/group/:id/balance", verifyToken, async (req, res) => {
    const groupId = req.params.id;
    const userId = req.user.userId;

    try {
        const result = await pool.query(
            `
            WITH debts AS (
                SELECT
                    p.user_id AS payer_id,
                    br.user_id AS borrower_id,
                    br.split_price AS amount
                FROM payers p
                JOIN borrowers br ON p.bill_id = br.bill_id
                JOIN bill b ON b.id = br.bill_id
                WHERE b.group_id = $1
            ),
            pairwise_balance AS (
                SELECT
                    other_user,
                    SUM(balance) AS net_balance
                FROM (
                    SELECT 
                        payer_id AS other_user, 
                        -SUM(amount) AS balance
                    FROM debts
                    WHERE borrower_id = $2 AND payer_id != $2
                    GROUP BY payer_id

                    UNION ALL

                    SELECT 
                        borrower_id AS other_user, 
                        SUM(amount) AS balance
                    FROM debts
                    WHERE payer_id = $2 AND borrower_id != $2
                    GROUP BY borrower_id
                ) AS combined
                GROUP BY other_user
            ),
            transactions AS (
                SELECT
                    other_user,
                    SUM(amount) AS net_transactions
                FROM (
                    SELECT to_user_id AS other_user, amount FROM transactions WHERE from_user_id = $2
                    UNION ALL
                    SELECT from_user_id AS other_user, -amount FROM transactions WHERE to_user_id = $2
                ) AS t
                GROUP BY other_user
            ),
            final_balance AS (
                SELECT
                    pb.other_user,
                    COALESCE(pb.net_balance, 0) + COALESCE(t.net_transactions, 0) AS final_amount
                FROM pairwise_balance pb
                LEFT JOIN transactions t ON pb.other_user = t.other_user
            )
            SELECT
                COALESCE((SELECT SUM(price) FROM bill WHERE group_id = $1), 0) AS total_group_spending,
                COALESCE(SUM(CASE WHEN final_amount < 0 THEN -final_amount ELSE 0 END), 0) AS you_owe_now,
                COALESCE(SUM(CASE WHEN final_amount > 0 THEN final_amount ELSE 0 END), 0) AS others_owe_you
            FROM final_balance;
            `,
            [groupId, userId]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error (group balance)" });
    }
});

app.get("/groups", verifyToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const result = await pool.query(
            `
			SELECT 
				g.id, 
				g.name,
        g.resolved
			FROM "Group" g
			JOIN Group_users gu ON gu.group_id = g.id
			WHERE gu.user_id = $1
		`,
            [userId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("Błąd pobierania grup:", err.message, err.stack);
        res.status(500).json({ msg: "Błąd serwera (groups)" });
    }
});

app.get("/group/:id/details", verifyToken, async (req, res) => {
    const groupId = req.params.id;

    try {
        const result = await pool.query(
            `
			SELECT g.name AS group_name, u.id AS user_id, u.name AS user_name
			FROM "Group" g
			JOIN Group_users gu ON gu.group_id = g.id
			JOIN "User" u ON u.id = gu.user_id
			WHERE g.id = $1
			`,
            [groupId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ msg: "Grupa nie istnieje" });
        }

        const groupName = result.rows[0].group_name;
        const members = result.rows.map((r) => ({
            id: r.user_id,
            name: r.user_name,
        }));

        res.json({
            id: groupId,
            name: groupName,
            members,
        });
    } catch (err) {
        console.error("Błąd w /group/:id/details:", err);
        res.status(500).json({ msg: "Błąd serwera" });
    }
});

app.post("/group/:id/expense", verifyToken, async (req, res) => {
    const groupId = req.params.id;
    const { name, amount, paidBy, splitType, splitValues } = req.body;
    const userId = req.user.userId;

    if (
        !name ||
        !amount ||
        !splitType ||
        !splitValues ||
        !Array.isArray(splitValues) ||
        splitValues.length === 0
    ) {
        return res.status(400).json({ msg: "Nieprawidłowe dane" });
    }

    const payerId = paidBy || userId;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const billRes = await client.query(
            `INSERT INTO bill (group_id, data, price, bill_name)
             VALUES ($1, NOW(), $2, $3)
             RETURNING id`,
            [groupId, amount, name]
        );

        const billId = billRes.rows[0].id;

        await client.query(
            `INSERT INTO payers (bill_id, user_id, split_price) VALUES ($1, $2, $3)`,
            [billId, payerId, amount]
        );

        const share = amount / splitValues.length;

        const borrowerPromises = splitValues
            .filter((uid) => Number(uid) !== Number(payerId))
            .map((uid) =>
                client.query(
                    `INSERT INTO borrowers (bill_id, user_id, split_price) VALUES ($1, $2, $3)`,
                    [billId, uid, share]
                )
            );

        await Promise.all(borrowerPromises);

        await client.query("COMMIT");
        res.status(201).json({ msg: "Wydatek dodany", billId });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Błąd dodawania wydatku:", err);
        res.status(500).json({ msg: "Błąd serwera" });
    } finally {
        client.release();
    }
});

// Adjusted Settlements Endpoint
app.get("/group/:id/settlements", verifyToken, async (req, res) => {
    const groupId = req.params.id;
    try {
        const membersRes = await pool.query(
            `SELECT u.id, u.name
             FROM "User" u
             JOIN group_users gu ON gu.user_id = u.id
             WHERE gu.group_id = $1`,
            [groupId]
        );
        const members = membersRes.rows;

        const balances = await Promise.all(
            members.map(async (m) => {
                const paidRes = await pool.query(
                    `SELECT COALESCE(SUM(p.split_price),0) AS paid
                     FROM payers p
                     JOIN bill b ON b.id = p.bill_id
                     WHERE b.group_id = $1 AND p.user_id = $2`,
                    [groupId, m.id]
                );
                const paid = Number(paidRes.rows[0].paid);

                const explicitOweRes = await pool.query(
                    `SELECT COALESCE(SUM(br.split_price),0) AS owe
                     FROM borrowers br
                     JOIN bill b ON b.id = br.bill_id
                     WHERE b.group_id = $1 AND br.user_id = $2`,
                    [groupId, m.id]
                );
                const explicitOwe = Number(explicitOweRes.rows[0].owe);

                const implicitOweRes = await pool.query(
                    `SELECT COALESCE(SUM(b.price - COALESCE(sub_borrowers.sum_borrowers, 0)),0) AS implicit_owe
                     FROM bill b
                     LEFT JOIN (
                         SELECT bill_id, SUM(split_price) AS sum_borrowers
                         FROM borrowers
                         GROUP BY bill_id
                     ) sub_borrowers ON sub_borrowers.bill_id = b.id
                     WHERE b.group_id = $1 AND b.id IN (
                         SELECT bill_id FROM payers WHERE user_id = $2
                     )`,
                    [groupId, m.id]
                );
                const implicitOwe = Number(implicitOweRes.rows[0].implicit_owe);

                const transactionsRes = await pool.query(
                    `SELECT COALESCE(SUM(amount),0) AS transactions_balance
                     FROM transactions
                     WHERE from_user_id = $2 AND to_user_id IN (SELECT user_id FROM group_users WHERE group_id = $1)
                     UNION ALL
                     SELECT -COALESCE(SUM(amount),0)
                     FROM transactions
                     WHERE to_user_id = $2 AND from_user_id IN (SELECT user_id FROM group_users WHERE group_id = $1)`,
                    [groupId, m.id]
                );
                const transactionsBalance = transactionsRes.rows.reduce(
                    (sum, row) => sum + Number(row.transactions_balance),
                    0
                );

                const totalOwed = explicitOwe + implicitOwe;
                const rawBalance = paid - totalOwed + transactionsBalance;
                const roundedBalance = Math.round(rawBalance * 100) / 100;

                return {
                    id: m.id,
                    name: m.name,
                    balance: roundedBalance,
                };
            })
        );

        let debtors = balances
            .filter((u) => u.balance < -0.01)
            .map((u) => ({ ...u, toPay: -u.balance }));
        let creditors = balances
            .filter((u) => u.balance > 0.01)
            .map((u) => ({ ...u, remaining: u.balance }));

        const settlements = [];

        for (let debtor of debtors) {
            for (let creditor of creditors) {
                if (creditor.remaining <= 0) continue;

                const pay = Math.min(debtor.toPay, creditor.remaining);
                if (pay > 0.01) {
                    settlements.push({
                        from: { id: debtor.id, name: debtor.name },
                        to: { id: creditor.id, name: creditor.name },
                        amount: +pay.toFixed(2),
                    });
                    creditor.remaining -= pay;
                    debtor.toPay -= pay;
                }

                if (debtor.toPay <= 0.01) break;
            }
        }

        res.json(settlements);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error (settlements)" });
    }
});

app.post("/group/:id/settle", verifyToken, async (req, res) => {
    const { settlements } = req.body;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        for (const settlement of settlements) {
            await client.query(
                `INSERT INTO transactions (from_user_id, to_user_id, amount)
                 VALUES ($1, $2, $3)`,
                [settlement.fromId, settlement.toId, settlement.amount]
            );
        }

        await client.query("COMMIT");
        res.json({ msg: "Settlements recorded successfully." });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error recording settlements:", err);
        res.status(500).json({ msg: "Server error during settlements." });
    } finally {
        client.release();
    }
});
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/:page", (req, res, next) => {
    const page = req.params.page;
    if (page.endsWith(".ico")) return next();
    res.sendFile(path.join(__dirname, "..", "client", `${page}.html`));
});
