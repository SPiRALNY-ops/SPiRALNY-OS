// A small Chrome DevTools Protocol driver: Google Chrome + Node's built-in WebSocket, no packages.
// Used by scripts/ui-check.mjs.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

export async function launchChrome(port = 9555) {
  const profile = mkdtempSync(join(tmpdir(), "spiral-ui-check-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--hide-scrollbars",
      "about:blank",
    ],
    {
      stdio: "ignore",
    },
  );
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      target = (
        await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      ).find((t) => t.type === "page");
    } catch {}
    if (!target) await sleep(200);
  }
  if (!target)
    throw new Error(
      `Chrome didn't start (looked for it at ${CHROME}; set CHROME_PATH).`,
    );
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    } else if (m.method) for (const l of listeners) l(m);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const problems = [];
  listeners.add((m) => {
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      problems.push(
        `console error: ${m.params.args
          .map((a) => a.value ?? a.description)
          .join(" ")
          .slice(0, 300)}`,
      );
    if (m.method === "Runtime.exceptionThrown")
      problems.push(
        `exception: ${(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300)}`,
      );
    if (
      m.method === "Network.responseReceived" &&
      m.params.response.status >= 400
    )
      problems.push(
        `HTTP ${m.params.response.status} ${m.params.response.url}`,
      );
  });
  for (const d of ["Page", "Runtime", "Network"]) await send(`${d}.enable`);

  const page = {
    send,
    problems,
    async viewport(width, height = 900) {
      const mobile = width < 768;
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
      await send(
        "Emulation.setTouchEmulationEnabled",
        mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false },
      );
      await send("Network.setUserAgentOverride", {
        userAgent: mobile ? IPHONE_UA : DESKTOP_UA,
      });
    },
    async colorScheme(value) {
      await send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value }],
      });
    },
    async goto(url, settle = 800) {
      let fn;
      const loaded = new Promise((resolve) => {
        fn = (m) =>
          (m.method === "Page.loadEventFired" ||
            m.method === "Page.navigatedWithinDocument") &&
          resolve();
        listeners.add(fn);
      });
      await send("Page.navigate", { url });
      // A link to a section of the page already open (#…) never fires a load event; never wait forever.
      await Promise.race([loaded, sleep(20000)]);
      listeners.delete(fn);
      await sleep(settle);
    },
    async eval(expression) {
      const r = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails)
        throw new Error(
          r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
        );
      return r.result.value;
    },
    async waitFor(expression, timeout = 20000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (await page.eval(expression)) return true;
        await sleep(150);
      }
      return false;
    },
    async press(key, code = key) {
      for (const type of ["keyDown", "keyUp"])
        await send("Input.dispatchKeyEvent", {
          type,
          key,
          code,
          windowsVirtualKeyCode: key === "Tab" ? 9 : key === "Escape" ? 27 : 0,
        });
    },
    async tap(selector) {
      const box = await page.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
      );
      if (!box) return false;
      await sleep(150);
      for (const type of ["mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", {
          type,
          x: box.x,
          y: box.y,
          button: "left",
          clickCount: 1,
        });
      return true;
    },
    async hover(selector) {
      const box = await page.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
      );
      if (!box) return false;
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: box.x,
        y: box.y,
        pointerType: "mouse",
      });
      return true;
    },
    async close() {
      try {
        await send("Browser.close");
      } catch {}
      proc.kill();
    },
  };
  return page;
}
