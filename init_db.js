const pool = require('./db');

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Drop existing tables
    await client.query(`DROP TABLE IF EXISTS reservations CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS seats CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS concerts CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS users CASCADE;`);

    // Create tables
    await client.query(`
      CREATE TABLE users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE
      );
    `);

    await client.query(`
      CREATE TABLE concerts (
        concert_id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        date TIMESTAMP NOT NULL,
        total_seats INT NOT NULL,
        available_seats INT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE seats (
        seat_id SERIAL PRIMARY KEY,
        concert_id INT REFERENCES concerts(concert_id) ON DELETE CASCADE,
        seat_number VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED')),
        UNIQUE(concert_id, seat_number)
      );
    `);

    await client.query(`
      CREATE TABLE reservations (
        reservation_id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
        seat_id INT REFERENCES seats(seat_id) ON DELETE CASCADE,
        reservation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert dummy users
    await client.query(`
      INSERT INTO users (username) VALUES ('Jinwoo'), ('Alice'), ('Bob');
    `);

    // Insert dummy concert
    const concertRes = await client.query(`
      INSERT INTO concerts (title, date, total_seats, available_seats) 
      VALUES ('INU Spring Festival 2026', '2026-07-01 19:00:00', 10, 10) RETURNING concert_id;
    `);
    const concertId = concertRes.rows[0].concert_id;

    // Insert dummy seats
    for (let i = 1; i <= 10; i++) {
      await client.query(`
        INSERT INTO seats (concert_id, seat_number) 
        VALUES ($1, $2);
      `, [concertId, `A${i}`]);
    }

    await client.query('COMMIT');
    console.log('Database initialized successfully with dummy data!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}

initDB().then(() => process.exit(0));
