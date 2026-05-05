import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma CLI 는 SQLite 의 상대 경로 (file:./dev.db)를 schema.prisma 기준으로 resolve
 * 하지만, Prisma 6 의 prisma-client 런타임은 generator output 경로 기준이라
 * `src/generated/prisma/dev.db` 같은 엉뚱한 곳을 본다. 이를 회피하기 위해
 * 런타임에서 항상 절대 경로로 변환해서 PrismaClient 에 넘긴다.
 */
function resolveRuntimeDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 가 설정되어 있지 않습니다.");
  if (!url.startsWith("file:")) return url;
  const filePart = url.slice("file:".length);
  if (path.isAbsolute(filePart)) return url;
  const absolute = path.resolve(process.cwd(), "prisma", filePart);
  return `file:${absolute.replace(/\\/g, "/")}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveRuntimeDbUrl() } },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
