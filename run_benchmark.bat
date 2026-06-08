@echo off
SET PGPASSWORD=1234
SET PGBIN=C:\Program Files\PostgreSQL\18\bin

echo.
echo ========================================
echo   pgbench Benchmark Suite
echo   PostgreSQL 18 - Ticket Booking DB
echo ========================================

echo.
echo [Step 1] pgbench 표준 테이블 초기화 (-i)
"%PGBIN%\pgbench.exe" -i -U postgres -h localhost postgres
if %ERRORLEVEL% NEQ 0 (
    echo 초기화 실패. PostgreSQL 서버가 실행 중인지 확인하세요.
    pause
    exit /b 1
)

echo.
echo ========================================
echo [Step 2] 기본 TPC-B 벤치마크
echo   - 클라이언트 수 (동시 접속): 5
echo   - 트랜잭션 수 (per client): 100
echo ========================================
"%PGBIN%\pgbench.exe" -U postgres -h localhost -c 5 -t 100 postgres

echo.
echo ========================================
echo [Step 3] 커스텀 SQL - 좌석 조회 쿼리 벤치마크
echo   - 클라이언트 수: 10, 트랜잭션 수: 50
echo ========================================
"%PGBIN%\pgbench.exe" -U postgres -h localhost -c 10 -t 50 -f bench_seat_query.sql postgres

echo.
echo ========================================
echo [Step 4] Read-Only 모드 (-S) - 최대 조회 처리량
echo   - 클라이언트 수: 10, 트랜잭션 수: 200
echo ========================================
"%PGBIN%\pgbench.exe" -U postgres -h localhost -c 10 -t 200 -S postgres

echo.
echo ========================================
echo   모든 벤치마크 완료!
echo   위 결과를 캡처해서 PPT에 사용하세요.
echo ========================================
pause
