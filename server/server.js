const express = require('express');
const path = require('path');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const {Pool} = require('pg');
require('dotenv').config();

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

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// app.get("/:page", (req, res, next) => {
//	const page = req.params.page;
//	if (page.endsWith(".ico")) return next();
//	res.sendFile(path.join(__dirname, "..", "client", `${page}.html`));
// });

app.get('/user/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
        'SELECT id, name, mail FROM "User" WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({msg: 'Użytkownik nie znaleziony'});
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Błąd w /user/me:', err);
    res.status(500).json({msg: 'Błąd serwera'});
  }
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', cookie.serialize('jwtToken', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  }));
  res.status(200).json({msg: 'Wylogowano'});
});


app.post('/register', async (req, res) => {
  const {name, mail, password} = req.body;
  try {
    const existing = await pool.query('SELECT * FROM "User" WHERE mail = $1', [
      mail,
    ]);
    if (existing.rows.length > 0)
      return res.status(400).json({msg: 'Użytkownik już istnieje'});
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
        'INSERT INTO "User" (name, mail, password, balans) VALUES ($1, $2, $3, $4)',
        [name, mail, hashed, 0]);

    res.status(201).json({msg: 'Zarejestrowano pomyślnie'});
  } catch (err) {
    console.error(err);
    res.status(500).json({msg: 'Błąd serwera'});
  }
});

app.post('/login', async (req, res) => {
  const {mail, password} = req.body;
  try {
    const result = await pool.query('SELECT * FROM "User" WHERE mail = $1', [
      mail,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({msg: 'Nie znaleziono użytkownika'});
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({msg: 'Złe hasło'});
    jwt.sign(
        {userId: user.id, mail: user.mail}, jwtSecret, {expiresIn: '1h'},
        (err, token) => {
          if (err) throw err;
          const cookieOptions = {
            secure: false,
            httpOnly: true,
            maxAge: 3600 * 1000,
            sameSite: 'lax',
          };
          res.setHeader(
              'Set-Cookie', cookie.serialize('jwtToken', token, cookieOptions));
          res.status(200).json({msg: 'Zalogowano!'});
        });
  } catch (err) {
    console.error(err);
    res.status(500).json({msg: 'Błąd serwera przy logowaniu'});
  }
});

app.listen(
    port, () => console.log(`🚀 Serwer działa na http://localhost:${port}`));

function verifyToken(req, res, next) {
  const cookies = req.headers.cookie;
  if (!cookies) return res.status(401).json({msg: 'Brak ciasteczek'});

  const parsedCookies = cookie.parse(cookies);
  const token = parsedCookies.jwtToken;

  if (!token) return res.status(401).json({msg: 'Brak tokenu'});

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return res.status(403).json({msg: 'Nieprawidłowy token'});
    req.user = decoded;
    next();
  });
}

app.get('/user/:email', verifyToken, async (req, res) => {
  const {email} = req.params;
  try {
    const result = await pool.query(
        'SELECT id, name FROM "User" WHERE mail = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({msg: 'Użytkownik nie znaleziony'});
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({msg: 'Błąd serwera'});
  }
});

app.post('/group', verifyToken, async (req, res) => {
  const {name, userIds} = req.body;
  const ownerId = req.user.userId;

  // console.log("req.user:", req.user);
  // console.log("ownerId:", ownerId);
  // console.log("name:", name);

  if (!name || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({msg: 'Nieprawidłowe dane'});
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const groupRes = await client.query(
        'INSERT INTO "Group" (name, owner_user_id) VALUES ($1, $2) RETURNING id',
        [name, ownerId]);

    const groupId = groupRes.rows[0].id;

    const allUserIds = Array.from(new Set([...userIds, ownerId]));

    const insertPromises = allUserIds.map(
        (userId) => client.query(
            'INSERT INTO Group_users (group_id, user_id) VALUES ($1, $2)',
            [groupId, userId]));

    await Promise.all(insertPromises);
    await client.query('COMMIT');

    res.status(201).json({msg: 'Grupa utworzona', groupId});
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({msg: 'Błąd tworzenia grupy'});
  } finally {
    client.release();
  }
});

app.get('/group/:id/bills', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
        `
      SELECT 
        b.data,
        b.price AS total,
        u.name AS payer,
        COALESCE(br.split_price, 0) AS your_share
      FROM bill b
      JOIN payers p ON p.bill_id = b.id
      JOIN "User" u ON u.id = p.user_id
      LEFT JOIN borrowers br ON br.bill_id = b.id AND br.user_id = $2
      WHERE b.group_id = $1
      ORDER BY b.data DESC
      `,
        [groupId, userId]);

    res.json(result.rows.map(row => ({
                               description: '(brak opisu)',
                               date: row.data,
                               total: row.total,
                               payer: row.payer,
                               your_share: row.your_share
                             })));
  } catch (err) {
    console.error(err);
    res.status(500).json({msg: 'Błąd serwera (group bills)'});
  }
});

app.get('/group/:id/balance', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
        `
      WITH group_bills AS (
        SELECT b.* FROM bill b
        WHERE b.group_id = $1
      ),
      you_owe AS (
        SELECT COALESCE(SUM(br.split_price), 0) AS total_owe
        FROM borrowers br
        JOIN bill b ON b.id = br.bill_id
        WHERE br.user_id = $2 AND b.group_id = $1
      ),
      you_paid AS (
        SELECT COALESCE(SUM(p.split_price), 0) AS total_paid
        FROM payers p
        JOIN bill b ON b.id = p.bill_id
        WHERE p.user_id = $2 AND b.group_id = $1
      )
      SELECT
        (SELECT COALESCE(SUM(price), 0) FROM group_bills) AS total_group_spending,
        (SELECT COALESCE(total_owe, 0) FROM you_owe) AS you_owe_now,
        (SELECT COALESCE(total_paid, 0) FROM you_paid) AS others_owe_you
      `,
        [groupId, userId]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({msg: 'Błąd serwera (group balance)'});
  }
});

app.get('/groups', verifyToken, async (req, res) => {
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
        [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Błąd pobierania grup:', err.message, err.stack);
    res.status(500).json({msg: 'Błąd serwera (groups)'});
  }
});

app.get('/group/:id/details', verifyToken, async (req, res) => {
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
        [groupId]);

    if (result.rows.length === 0) {
      return res.status(404).json({msg: 'Grupa nie istnieje'});
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
    console.error('Błąd w /group/:id/details:', err);
    res.status(500).json({msg: 'Błąd serwera'});
  }
});

app.post('/group/:id/expense', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  const { name, amount, paidBy, splitType } = req.body;
  const userId = req.user.userId;

  if (!name || !amount || !paidBy || !splitType) {
    return res.status(400).json({ msg: 'Nieprawidłowe dane' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billRes = await client.query(
  `INSERT INTO bill (group_id, data, price) VALUES ($1, NOW(), $2) RETURNING id`,
  [groupId, amount]
  );

    const billId = billRes.rows[0].id;

    await client.query(
      `INSERT INTO payers (bill_id, user_id, split_price) VALUES ($1, $2, $3)`,
      [billId, paidBy, amount]
    );

    const usersRes = await client.query(
      `SELECT user_id FROM Group_users WHERE group_id = $1`,
      [groupId]
    );
    const userIds = usersRes.rows.map(row => row.user_id);
    const share = amount / userIds.length;

    const borrowerPromises = userIds.map(uid =>
      client.query(
        `INSERT INTO borrowers (bill_id, user_id, split_price) VALUES ($1, $2, $3)`,
        [billId, uid, share]
      )
    );
    await Promise.all(borrowerPromises);

    await client.query('COMMIT');
    res.status(201).json({ msg: 'Wydatek dodany', billId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Błąd dodawania wydatku:', err);
    res.status(500).json({ msg: 'Błąd serwera' });
  } finally {
    client.release();
  }
});

app.get('/group/:id/settlements', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  try {
    const membersRes = await pool.query(
      `SELECT u.id, u.name
       FROM "User" u
       JOIN Group_users gu ON gu.user_id = u.id
       WHERE gu.group_id = $1`,
      [groupId]
    );
    const members = membersRes.rows;

    const settlements = await Promise.all(members.map(async m => {
      const oweRes = await pool.query(
        `SELECT COALESCE(SUM(br.split_price),0) AS owe
         FROM borrowers br
         JOIN bill b ON b.id = br.bill_id
         WHERE b.group_id = $1 AND br.user_id = $2`,
        [groupId, m.id]
      );
      const paidRes = await pool.query(
        `SELECT COALESCE(SUM(p.split_price),0) AS paid
         FROM payers p
         JOIN bill b ON b.id = p.bill_id
         WHERE b.group_id = $1 AND p.user_id = $2`,
        [groupId, m.id]
      );
      const owe  = Number(oweRes.rows[0].owe);
      const paid = Number(paidRes.rows[0].paid);
      return {
        id:      m.id,
        name:    m.name,
        balance: paid - owe
      };
    }));

    res.json(settlements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Błąd serwera (settlements)' });
  }
});

app.post('/group/:id/settle', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  const { userIds } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE borrowers
         SET split_price = 0
       WHERE user_id = ANY($1)
         AND bill_id IN (
           SELECT id FROM bill WHERE group_id = $2
         )`,
      [userIds, groupId]
    );

    await client.query(
      `UPDATE payers
         SET split_price = 0
       WHERE user_id = ANY($1)
         AND bill_id IN (
           SELECT id FROM bill WHERE group_id = $2
         )`,
      [userIds, groupId]
    );

    await client.query('COMMIT');
    res.json({ msg: 'OK' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Błąd rozliczania:', err);
    res.status(500).json({ msg: 'Błąd serwera (settle)' });
  } finally {
    client.release();
  }
});


app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/:page', (req, res, next) => {
  const page = req.params.page;
  if (page.endsWith('.ico')) return next();
  res.sendFile(path.join(__dirname, '..', 'client', `${page}.html`));
});