const express = require('express');
const bodyParser = require('body-parser');
const pool = require('./db');
const path = require('path');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 1. Home - List Concerts
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM concerts ORDER BY date ASC');
    res.render('index', { concerts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error");
  }
});

// 2. Concert details & Seat map
app.get('/concert/:id', async (req, res) => {
  const concertId = req.params.id;
  try {
    const concertRes = await pool.query('SELECT * FROM concerts WHERE concert_id = $1', [concertId]);
    const seatsRes = await pool.query('SELECT * FROM seats WHERE concert_id = $1 ORDER BY seat_id ASC', [concertId]);
    const usersRes = await pool.query('SELECT * FROM users'); // For demo purposes, to select a user from dropdown
    
    if (concertRes.rows.length === 0) return res.status(404).send('Concert not found');

    res.render('concert', {
      concert: concertRes.rows[0],
      seats: seatsRes.rows,
      users: usersRes.rows,
      message: req.query.message,
      error: req.query.error
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error");
  }
});

// 3. Book a seat (TRANSACTION)
app.post('/book', async (req, res) => {
  const { user_id, concert_id, seat_id } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Select seat with FOR UPDATE to lock the row
    const seatRes = await client.query(
      "SELECT * FROM seats WHERE seat_id = $1 AND status = 'AVAILABLE' FOR UPDATE",
      [seat_id]
    );

    if (seatRes.rows.length === 0) {
      // Seat is either not found or already reserved
      await client.query('ROLLBACK');
      return res.redirect(`/concert/${concert_id}?error=Seat already reserved or unavailable.`);
    }

    // 2. Update seat status
    await client.query(
      "UPDATE seats SET status = 'RESERVED' WHERE seat_id = $1",
      [seat_id]
    );

    // 3. Insert reservation
    await client.query(
      "INSERT INTO reservations (user_id, seat_id) VALUES ($1, $2)",
      [user_id, seat_id]
    );

    // 4. Update concert available seats
    await client.query(
      "UPDATE concerts SET available_seats = available_seats - 1 WHERE concert_id = $1",
      [concert_id]
    );

    await client.query('COMMIT');
    res.redirect(`/my-tickets/${user_id}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.redirect(`/concert/${concert_id}?error=Transaction Failed.`);
  } finally {
    client.release();
  }
});

// 4. View User Tickets (JOIN Query)
app.get('/my-tickets/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const userRes = await pool.query('SELECT username FROM users WHERE user_id = $1', [userId]);
    
    const query = `
      SELECT r.reservation_id, c.title, c.date, s.seat_number, r.reservation_time 
      FROM reservations r 
      JOIN seats s ON r.seat_id = s.seat_id 
      JOIN concerts c ON s.concert_id = c.concert_id 
      WHERE r.user_id = $1
      ORDER BY r.reservation_time DESC
    `;
    const ticketsRes = await pool.query(query, [userId]);
    
    res.render('my-tickets', {
      username: userRes.rows.length > 0 ? userRes.rows[0].username : 'Unknown',
      tickets: ticketsRes.rows,
      userId: userId
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
