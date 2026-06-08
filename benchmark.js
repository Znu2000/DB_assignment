/**
 * Ticket Booking System - Concurrency Benchmark
 * 
 * 이 스크립트는 다음 세 가지 시나리오를 테스트합니다:
 * 
 * [Scenario 1] 동시 접속 - 같은 좌석에 N명이 동시 예약 시도
 *   → 오직 1명만 성공해야 함 (Transaction + FOR UPDATE Lock)
 * 
 * [Scenario 2] 처리량(Throughput) - 각각 다른 좌석에 N명이 동시 예약
 *   → 모두 성공, 총 소요 시간 및 TPS(Transactions Per Second) 측정
 * 
 * [Scenario 3] 혼합 부하 - 조회 + 예약 요청을 동시에 섞어서 부하
 *   → 평균 응답 시간(Avg Response Time) 측정
 */

const axios = require('axios');
const pool = require('./db');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

// ──────────────────────────────────────────
// Helper: DB를 초기 상태로 리셋 (벤치마크 전후)
// ──────────────────────────────────────────
async function resetDB() {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM reservations");
    await client.query("UPDATE seats SET status = 'AVAILABLE'");
    await client.query("UPDATE concerts SET available_seats = total_seats");
    console.log('  [DB Reset] 예약 내역 초기화 완료\n');
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────
// Helper: 좌석 목록 조회
// ──────────────────────────────────────────
async function getSeats(concertId) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT seat_id, seat_number, status FROM seats WHERE concert_id = $1 ORDER BY seat_id",
      [concertId]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────
// Helper: POST /book 요청 전송
// ──────────────────────────────────────────
async function bookSeat(userId, concertId, seatId) {
  const start = Date.now();
  try {
    const params = new URLSearchParams({ user_id: userId, concert_id: concertId, seat_id: seatId });
    // Express가 redirect를 반환하므로 maxRedirects: 0, validateStatus로 3xx도 허용
    const res = await axios.post(`${BASE_URL}/book`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: (s) => s < 400,
    });
    const elapsed = Date.now() - start;
    // /my-tickets로 redirect되면 성공, /concert로 redirect되면 실패(좌석 선점)
    const success = res.headers.location && res.headers.location.startsWith('/my-tickets');
    return { success, elapsed, status: res.status };
  } catch (err) {
    return { success: false, elapsed: Date.now() - start, status: err?.response?.status || 0 };
  }
}

// ──────────────────────────────────────────
// Scenario 1: 동일 좌석 동시 예약 (Race Condition Test)
// ──────────────────────────────────────────
async function scenario1_sameSeats(concertId, seats, numUsers) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Scenario 1] 동일 좌석 동시 예약 (${numUsers}명 → 좌석 A1)`);
  console.log(`${'─'.repeat(60)}`);
  await resetDB();

  const targetSeat = seats[0]; // 모두가 A1 좌석을 노림
  const requests = [];

  for (let i = 0; i < numUsers; i++) {
    const userId = (i % 3) + 1; // 유저 1, 2, 3 순환
    requests.push(bookSeat(userId, concertId, targetSeat.seat_id));
  }

  const results = await Promise.all(requests);
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const avgTime = Math.round(results.reduce((a, r) => a + r.elapsed, 0) / results.length);
  const maxTime = Math.max(...results.map(r => r.elapsed));
  const minTime = Math.min(...results.map(r => r.elapsed));

  console.log(`  총 요청 수     : ${numUsers}`);
  console.log(`  예약 성공      : ${successCount} (기대값: 1)`);
  console.log(`  예약 실패/롤백 : ${failCount}`);
  console.log(`  평균 응답시간  : ${avgTime} ms`);
  console.log(`  최소 응답시간  : ${minTime} ms`);
  console.log(`  최대 응답시간  : ${maxTime} ms`);
  console.log(`  결론: ${successCount === 1 ? '✅ PASS - 트랜잭션 Lock이 정상 작동' : '❌ FAIL - 동시성 문제 발생!'}`);

  return { scenario: 'Scenario 1: Same Seat Race Condition', numUsers, successCount, failCount, avgTime, minTime, maxTime };
}

// ──────────────────────────────────────────
// Scenario 2: 서로 다른 좌석 동시 예약 (Throughput Test)
// ──────────────────────────────────────────
async function scenario2_differentSeats(concertId, seats, numUsers) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Scenario 2] 서로 다른 좌석 동시 예약 - 처리량(Throughput) 측정`);
  console.log(`${'─'.repeat(60)}`);
  await resetDB();

  const actualUsers = Math.min(numUsers, seats.length);
  const requests = [];
  const startAll = Date.now();

  for (let i = 0; i < actualUsers; i++) {
    const userId = (i % 3) + 1;
    requests.push(bookSeat(userId, concertId, seats[i].seat_id));
  }

  const results = await Promise.all(requests);
  const totalTime = Date.now() - startAll;
  const successCount = results.filter(r => r.success).length;
  const tps = Math.round((successCount / totalTime) * 1000);
  const avgTime = Math.round(results.reduce((a, r) => a + r.elapsed, 0) / results.length);

  console.log(`  총 요청 수     : ${actualUsers}`);
  console.log(`  예약 성공      : ${successCount}`);
  console.log(`  전체 소요 시간 : ${totalTime} ms`);
  console.log(`  처리량 (TPS)   : ${tps} transactions/sec`);
  console.log(`  평균 응답시간  : ${avgTime} ms`);

  return { scenario: 'Scenario 2: Throughput Test', numUsers: actualUsers, successCount, totalTimeMs: totalTime, tps, avgTime };
}

// ──────────────────────────────────────────
// Scenario 3: 조회 + 예약 혼합 부하 (Mixed Workload)
// ──────────────────────────────────────────
async function scenario3_mixedLoad(concertId, numRequests) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Scenario 3] 조회 + 예약 혼합 부하 (총 ${numRequests}개 요청)`);
  console.log(`${'─'.repeat(60)}`);
  await resetDB();

  const seats = await getSeats(concertId);
  const requests = [];

  for (let i = 0; i < numRequests; i++) {
    if (i % 3 === 0) {
      // 1/3은 콘서트 목록 조회 (READ)
      requests.push(
        axios.get(`${BASE_URL}/`).then(r => ({ type: 'READ', elapsed: 0, success: r.status === 200 }))
          .catch(() => ({ type: 'READ', elapsed: 0, success: false }))
      );
    } else {
      // 2/3은 예약 시도 (WRITE + TRANSACTION)
      const seat = seats[i % seats.length];
      const userId = (i % 3) + 1;
      requests.push(bookSeat(userId, concertId, seat.seat_id).then(r => ({ ...r, type: 'WRITE' })));
    }
  }

  const start = Date.now();
  const results = await Promise.all(requests);
  const totalTime = Date.now() - start;

  const reads = results.filter(r => r.type === 'READ');
  const writes = results.filter(r => r.type === 'WRITE');
  const writeSuccess = writes.filter(r => r.success).length;

  console.log(`  총 요청 수     : ${numRequests}`);
  console.log(`  READ 요청      : ${reads.length}`);
  console.log(`  WRITE 요청     : ${writes.length} (성공: ${writeSuccess})`);
  console.log(`  전체 소요 시간 : ${totalTime} ms`);
  console.log(`  총 TPS         : ${Math.round((numRequests / totalTime) * 1000)} req/sec`);

  return { scenario: 'Scenario 3: Mixed Workload', numRequests, reads: reads.length, writes: writes.length, writeSuccess, totalTimeMs: totalTime };
}

// ──────────────────────────────────────────
// Main: 시나리오 순서대로 실행 후 결과 저장
// ──────────────────────────────────────────
async function main() {
  console.log('========================================');
  console.log('  Ticket Booking System - Benchmark');
  console.log('========================================');
  console.log('\n먼저 서버가 http://localhost:3000 에서 실행 중인지 확인합니다...');

  try {
    await axios.get(BASE_URL);
    console.log('  ✅ 서버 연결 확인!\n');
  } catch (e) {
    console.error('  ❌ 서버에 연결할 수 없습니다! 먼저 "node server.js"로 서버를 켜주세요.');
    process.exit(1);
  }

  // 콘서트 ID 및 좌석 정보 조회
  const client = await pool.connect();
  const concertRes = await client.query('SELECT concert_id FROM concerts LIMIT 1');
  client.release();
  const concertId = concertRes.rows[0].concert_id;
  const seats = await getSeats(concertId);

  // 시나리오 실행
  const r1 = await scenario1_sameSeats(concertId, seats, 10);
  const r2 = await scenario2_differentSeats(concertId, seats, 10);
  const r3 = await scenario3_mixedLoad(concertId, 20);

  // 결과를 JSON 파일로 저장
  const report = {
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL',
    isolationLevel: 'READ COMMITTED (default) with SELECT ... FOR UPDATE',
    results: [r1, r2, r3]
  };

  fs.writeFileSync('benchmark_results.json', JSON.stringify(report, null, 2));

  console.log('\n========================================');
  console.log('  벤치마크 완료!');
  console.log('  결과 저장 위치: benchmark_results.json');
  console.log('========================================');

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
