# 데이터베이스 동기화 가이드

`prisma/schema.prisma` 와 마이그레이션 파일은 git 으로 공유되지만, 각자의 로컬 SQLite DB(`prisma/dev.db`) 와 생성된 Prisma Client(`src/generated/prisma/`) 는 **공유되지 않습니다**. 다른 사람이 스키마를 바꿔서 push 하면 pull 받은 쪽은 두 가지를 직접 갱신해야 합니다.

## TL;DR — 동료가 스키마 바꾼 PR 머지 후

```powershell
# 1. dev 서버 종료 (Ctrl+C) — Windows 에서 query engine DLL lock 회피
# 2. 한 줄로 끝
npm run db:sync
# 3. dev 서버 재시작
npm run dev
```

`db:sync` 는 `prisma migrate deploy && prisma generate` 입니다.

- `migrate deploy` : 미적용 마이그레이션을 dev.db 에 적용 (기존 데이터 보존)
- `generate` : `src/generated/prisma/` 에 타입/런타임 클라이언트 재생성

## 왜 두 단계가 필요한가

| 단계 | 안 하면 생기는 증상 |
| --- | --- |
| `migrate deploy` | DB 에 새 테이블/컬럼 없음 → 런타임에 SQL 에러 (`no such table`, `no such column`) |
| `generate` | 타입스크립트 `prisma.xxx` 가 `undefined` → **`Cannot read properties of undefined (reading 'create')`** |

실제로 이 가이드는 위쪽 에러를 만난 뒤 만들어졌습니다. 마이그레이션은 있었는데 적용이 안 됐고 클라이언트도 옛날 버전이었음.

## 자주 헷갈리는 포인트

### `migrate dev` vs `migrate deploy`

- **`migrate dev`** (= `npm run db:migrate`): **본인이 스키마를 바꿀 때** 사용. `schema.prisma` diff 를 보고 새 마이그레이션 파일을 만들어준 뒤 적용 + generate.
- **`migrate deploy`** (= `npm run db:sync` 의 첫 단계): **남이 만든 마이그레이션을 받아서 적용**할 때 사용. 절대 새 파일을 만들지 않음 — 안전.

스키마 변경자는 `db:migrate`, 풀러 는 `db:sync`. 헷갈리지 않게.

### 환경변수 (`DATABASE_URL`)

- 런타임(Next.js): `src/lib/prisma.ts` 가 `dotenv/config` 로 `.env` 를 로드.
- Prisma CLI: `prisma.config.ts` 가 `.env.local` 만 로드.

두 파일 모두에 `DATABASE_URL="file:./dev.db"` 가 있어야 합니다. 새로 클론한 사람은 두 파일을 다 만들어야 함 (`.env.example` 참고).

### Windows DLL lock 이슈

`prisma generate` 가 다음과 같이 실패하면:

```
EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'
```

→ Next.js dev 서버가 query engine DLL 을 잡고 있어서 그렇습니다. **dev 서버를 끄고 다시 실행**하세요. macOS/Linux 에서는 발생하지 않습니다.

## 새 환경 셋업 (처음부터)

```powershell
git clone <repo>
cd AI-Challenge
npm install                      # postinstall 로 prisma generate 자동 실행됨
# .env, .env.local 에 DATABASE_URL 및 자격증명 채우기
npm run db:sync                  # 모든 마이그레이션 dev.db 에 적용
npm run dev
```

## 흔한 사고 패턴

1. **"분명 schema.prisma 에는 모델이 있는데 `prisma.xxx` 가 undefined"**
   → `npm run db:sync` 잊음. 타입까지 깨끗하게 살아나려면 IDE 의 TS 서버도 재시작.

2. **"마이그레이션은 됐다는데 테이블이 없다고 나옴"**
   → 다른 위치의 dev.db 를 보고 있을 가능성. `src/lib/prisma.ts` 의 `resolveRuntimeDbUrl` 가 절대경로로 보정하긴 하지만, 직접 sqlite CLI 로 열어볼 땐 `prisma/dev.db` 인지 확인.

3. **"npm run db:migrate 했더니 새 마이그레이션 파일이 만들어졌다"**
   → `migrate dev` 는 schema diff 가 있으면 무조건 새 파일을 만듭니다. 의도하지 않았다면 그 파일은 커밋하지 말고 삭제하고 `db:sync` 를 쓰세요.
