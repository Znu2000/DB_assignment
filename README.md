# Concert Ticket Booking System (콘서트 티켓 예매 시스템)

데이터베이스 시스템 설계 과제를 위한 PostgreSQL 기반의 콘서트 티켓 예매 시스템 웹 애플리케이션입니다.  
다수의 사용자가 동시에 동일한 좌석을 예약할 때 발생할 수 있는 동시성 문제(Race Condition)를 해결하기 위해 **데이터베이스 트랜잭션 격리 및 비관적 락(Pessimistic Locking, `SELECT ... FOR UPDATE`)**을 적용하여 구현되었습니다.

---

## 🛠 기술 스택

- **Backend**: Node.js, Express
- **Frontend**: EJS (HTML Template Engine), Vanilla CSS
- **Database**: PostgreSQL (Raw SQL 활용)
- **Library**: `pg` (PostgreSQL client for Node.js)

---

## 🚀 실행 가이드 (Quick Start)

교수님 또는 평가자가 로컬 환경에서 실행하기 위해 아래의 단계를 순서대로 진행해 주세요.

### 1. 필수 프로그램 설치
로컬 컴퓨터에 다음이 설치되어 있어야 합니다.
- **Node.js** (v16 이상 권장)
- **PostgreSQL**

### 2. 패키지 설치
프로젝트 루트 디렉토리(`ticket-booking`)에서 터미널을 열고 필요한 종속성 패키지를 설치합니다.
```bash
npm install
```

### 3. 데이터베이스 및 환경 변수 설정
프로젝트 루트에 있는 `.env.example` 파일을 복사하여 `.env` 파일을 생성하고, 본인의 로컬 PostgreSQL 접속 정보에 맞게 수정합니다.

```bash
# Windows (PowerShell)
copy .env.example .env
```

`.env` 파일 내부 수정 예시:
```properties
DB_USER=postgres
DB_PASSWORD=본인의_PostgreSQL_비밀번호
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres # 사용할 DB 이름 (기본적으로 postgres 사용 가능)
```

### 4. 데이터베이스 테이블 초기화 및 샘플 데이터 로드
데이터베이스에 필요한 테이블(`users`, `concerts`, `seats`, `reservations`)을 자동 생성하고 시연용 샘플 데이터를 삽입하는 스크립트를 실행합니다.
```bash
node init_db.js
```
*성공 시 `Database initialized successfully!` 메시지가 출력됩니다.*

### 5. 애플리케이션 실행
서버를 구동합니다.
```bash
npm start
```
서버가 켜지면 브라우저를 열고 **`http://localhost:3000`**으로 접속합니다.

---

## 💡 주요 기능 및 구현 특징

1. **실시간 좌석 예약**: 콘서트를 선택하고 좌석 배치도에서 원하는 좌석을 실시간으로 클릭해 예매할 수 있습니다.
2. **트랜잭션 격리 제어**: 동시 예약 요청이 들어왔을 때 데이터 정합성을 유지하기 위해 **`SELECT ... FOR UPDATE`** 쿼리를 사용하여 해당 좌석 행(Row)에 락을 겁니다. 먼저 트랜잭션을 시작한 사용자의 예매가 완료되기 전까지는 다른 사용자가 접근할 수 없어 **이중 예매(Double Booking) 현상을 원천 차단**합니다.
3. **예약 내역 및 취소**: 사용자가 예매한 내역을 `JOIN` 쿼리를 사용해 모아서 확인하고, 예매를 취소하면 좌석 상태가 유기적으로 복구되도록 구현했습니다.

---

## 📊 동시성 테스트 및 벤치마킹 방법

데이터베이스 락(Lock) 설정 유무에 따른 성능 및 안전성 차이를 평가하기 위해 자체 벤치마킹 스크립트가 구현되어 있습니다.

```bash
node benchmark.js
```
이 스크립트는 50명의 가상 사용자가 동시에 하나의 좌석을 선점하려고 시도하는 경쟁 상태를 시뮬레이션하며, **트랜잭션 락 덕분에 단 1명의 사용자만 예약에 성공하고 나머지는 정중히 예매 실패 처리**되는 것을 실시간 콘솔 로그로 입증해 줍니다.
