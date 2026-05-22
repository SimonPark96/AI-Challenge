import { copyFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();

function step(label: string, fn: () => void): void {
  process.stdout.write(`\n▶ ${label}\n`);
  fn();
  process.stdout.write(`  ✓ done\n`);
}

function run(cmd: string): void {
  execSync(cmd, { stdio: "inherit", cwd: root });
}

step(".env.local 생성 (템플릿이 없으면 .env.example 복사)", () => {
  const target = resolve(root, ".env.local");
  if (existsSync(target)) {
    process.stdout.write("  ⤷ 이미 존재 — 건너뜀\n");
    return;
  }
  const src = resolve(root, ".env.example");
  if (!existsSync(src)) {
    throw new Error(".env.example 가 없습니다. 레포 루트에서 실행하세요.");
  }
  copyFileSync(src, target);
  process.stdout.write(
    "  ⤷ .env.example → .env.local 복사. OPENAI_API_KEY 등 시크릿을 채워주세요.\n"
  );
});

step("Prisma migrate (prisma/dev.db 생성 + 스키마 적용)", () => {
  run("npx prisma migrate deploy");
});

step("Prisma client 생성 (src/generated/prisma)", () => {
  run("npx prisma generate");
});

step("Playwright Chromium 다운로드 (스크래퍼 동작에 필요)", () => {
  run("npx playwright install chromium");
});

process.stdout.write(`
✅ Setup 완료.

남은 단계:
  1. .env.local 의 OPENAI_API_KEY / KPI_*/KPRC_*/CMPI_* 값을 채우세요.
     (스크래퍼 자격증명이 없는 사이트는 해당 사이트 스크래핑이 실패할 뿐 앱 자체엔 무해)
  2. npm run dev
  3. 브라우저에서 http://localhost:3000 접속.
`);
