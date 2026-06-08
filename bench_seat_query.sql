-- pgbench 커스텀 SQL: 콘서트 좌석 조회 부하 테스트
-- seats 테이블에서 랜덤 concert_id로 좌석 목록을 조회합니다.
SELECT seat_id, seat_number, status
FROM seats
WHERE concert_id = 1
ORDER BY seat_id;
