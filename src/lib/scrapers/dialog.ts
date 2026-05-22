import type { BrowserContext, Dialog } from "playwright";

/**
 * context 안의 모든 페이지(현재 페이지 + 이후 열리는 popup) 에서 발생하는
 * native dialog(alert/confirm/prompt) 를 자동으로 accept.
 *
 * 용도: KPI/KPRC/CMPI 모두 같은 계정으로 다른 곳에서 로그인 중일 때
 * "이미 접속 중인 세션을 해제하시겠습니까?" 같은 confirm 이 뜨는데,
 * 이걸 자동 확인해서 강제 로그인 진행시키기 위함.
 */
export function autoAcceptDialogs(
  context: BrowserContext,
  log: (msg: string) => void = () => {}
): void {
  const handle = async (dialog: Dialog): Promise<void> => {
    const msg = dialog.message().replace(/\s+/g, " ").trim();
    log(`  → dialog auto-accept (${dialog.type()}): "${msg}"`);
    await dialog.accept().catch(() => {});
  };
  for (const p of context.pages()) p.on("dialog", handle);
  context.on("page", (p) => p.on("dialog", handle));
}
