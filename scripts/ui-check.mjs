#!/usr/bin/env node
/**
 * End-to-end UI check for Analytics, in a real (headless) Google Chrome, with no packages.
 *
 *   npm run dev                                   # then, in another terminal:
 *   npm run ui:check                              # BASE defaults to http://localhost:3000
 *   BASE=https://spiralny-os.up.railway.app UI_EMAIL=… UI_PASSWORD=… npm run ui:check
 *
 * Checks, for every Analytics page:
 *  - at 360, 390, 768, 1024, 1280 and 1440 wide, in light and dark: nothing scrolls sideways, no broken
 *    values ("NaN", "undefined"…), the right tab is marked;
 *  - the tabs keep the period, and changing the period updates the page;
 *  - every chart's table view opens; the "?" tips open on hover (mouse) and tap (phone);
 *  - every "What stands out" link lands on its section;
 *  - the detail panel opens from each kind of row, opens a related item inside it, closes with Back and
 *    Escape, and opens from a shared link as a bottom sheet on a phone;
 *  - keyboard focus is visible;
 *  - and the browser saw no console errors, exceptions or failed requests along the way.
 * Exits 1 if anything fails. PARTS=4,5 runs only some parts (1 pages, 2 tabs and period, 3 charts and
 * tips, 4 findings, 5 detail panel, 6 keyboard; the console check always runs).
 */
import { launchChrome, sleep } from "./lib/chrome.mjs";

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const PAGES = [
  { path: "/analytics", tab: "Overview" },
  { path: "/analytics/leads", tab: "Leads & sign-ups" },
  { path: "/analytics/search", tab: "Google search" },
  { path: "/analytics/website", tab: "Website" },
  { path: "/analytics/cold-email", tab: "Cold email" },
];
const WIDTHS = [360, 390, 768, 1024, 1280, 1440];
const PARTS = new Set(
  (process.env.PARTS ?? "1,2,3,4,5,6").split(",").map((s) => s.trim()),
);
const part = (n) => PARTS.has(String(n));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`,
  );
};

const p = await launchChrome();
/** Opens a page, signing in first if the site asks (UI_EMAIL / UI_PASSWORD). */
async function open(path) {
  await p.goto(`${BASE}${path}`, 300);
  if ((await p.eval("location.pathname")) === "/sign-in") {
    if (!process.env.UI_EMAIL || !process.env.UI_PASSWORD)
      throw new Error(
        "The site asked to sign in: set UI_EMAIL and UI_PASSWORD.",
      );
    await p.waitFor("!!document.querySelector('#email')");
    await p.eval(`document.querySelector('#email').focus()`);
    await p.send("Input.insertText", { text: process.env.UI_EMAIL });
    await p.eval(`document.querySelector('#password').focus()`);
    await p.send("Input.insertText", { text: process.env.UI_PASSWORD });
    await p.tap("button[type=submit]");
    await p.waitFor("location.pathname !== '/sign-in'", 30000);
    await p.goto(`${BASE}${path}`, 300);
  }
  await p.waitFor(
    `!!document.querySelector('nav[aria-label="Analytics pages"]') && !document.querySelector('[aria-busy="true"][aria-label="Loading analytics"]')`,
    30000,
  );
  await sleep(600);
}

const OVERFLOW = `(() => {
  const vw = document.documentElement.clientWidth; const bad = [];
  for (const el of document.querySelectorAll("main *")) {
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1 || r.width === 0) continue;
    let a = el.parentElement, clipped = false;
    while (a && a !== document.body) {
      if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(a).overflowX) && a.getBoundingClientRect().right <= vw + 1) { clipped = true; break; }
      a = a.parentElement;
    }
    if (!clipped) bad.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""));
  }
  return { sideways: document.documentElement.scrollWidth - vw, bad: bad.slice(0, 3) };
})()`;
const BROKEN = `(document.querySelector('main')?.innerText.match(/\\bNaN\\b|\\bundefined\\b|\\bInfinity\\b|\\[object Object\\]/g) ?? []).length`;

try {
  // 1. Every page, every width, both themes.
  if (part(1))
    for (const theme of ["light", "dark"]) {
      await p.colorScheme(theme);
      for (const width of WIDTHS) {
        await p.viewport(width);
        const failures = [];
        for (const { path, tab } of PAGES) {
          await open(`${path}?range=28d`);
          if (path === "/analytics")
            await p.eval(`localStorage.setItem("theme", "system")`);
          const o = await p.eval(OVERFLOW);
          const broken = await p.eval(BROKEN);
          const current = await p.eval(
            `document.querySelector('nav[aria-label="Analytics pages"] [aria-current="page"]')?.textContent`,
          );
          if (o.sideways > 0 || o.bad.length)
            failures.push(
              `${path} scrolls sideways (${o.sideways}px: ${o.bad.join(", ")})`,
            );
          if (broken) failures.push(`${path} shows ${broken} broken values`);
          if (current !== tab)
            failures.push(`${path} marks "${current}" as the current tab`);
        }
        check(
          `pages at ${width}px, ${theme}`,
          failures.length === 0,
          failures.join("; "),
        );
      }
    }

  // 2. Tabs keep the period; the period picker updates the page.
  await p.colorScheme("light");
  await p.viewport(1440);
  if (part(2)) {
    await open("/analytics/search?range=90d");
    const hrefs = await p.eval(
      `[...document.querySelectorAll('nav[aria-label="Analytics pages"] a')].map((a) => a.getAttribute('href'))`,
    );
    check(
      "tabs keep the period",
      hrefs.length === 5 && hrefs.every((h) => h.endsWith("?range=90d")),
      hrefs.join(" "),
    );
    await p.tap(`[aria-label="Date range"] [aria-label="Last 7 days"]`);
    const switched = await p.waitFor(
      `location.search.includes('range=7d') && /last 7 days/i.test(document.querySelector('main')?.innerText ?? '')`,
    );
    check("the period picker updates the page", switched);
    await p.tap(
      `nav[aria-label="Analytics pages"] a[href^="/analytics/leads"]`,
    );
    check(
      "a tab opens its page with the period",
      await p.waitFor(
        `location.pathname === '/analytics/leads' && location.search.includes('range=7d')`,
      ),
    );
  }

  // 3. Every chart's table view, and the "?" tips.
  if (part(3)) {
    for (const { path } of PAGES) {
      await open(`${path}?range=28d`);
      const charts = await p.eval(
        `document.querySelectorAll('[role=group][aria-label$=": view"]').length`,
      );
      let tables = 0;
      for (let i = 0; i < charts; i++) {
        await p.eval(
          `document.querySelectorAll('[role=group][aria-label$=": view"]')[${i}].querySelector('[aria-label="Show table"]').click()`,
        );
        await sleep(250);
        tables += await p.eval(
          `document.querySelectorAll('[role=group][aria-label$=": view"]')[${i}].closest('section').querySelector('table') ? 1 : 0`,
        );
        await p.eval(
          `document.querySelectorAll('[role=group][aria-label$=": view"]')[${i}].querySelector('[aria-label="Show chart"]').click()`,
        );
      }
      check(
        `${path}: every chart has a table view`,
        tables === charts,
        `${tables} of ${charts}`,
      );
    }
    await open("/analytics?range=28d");
    await p.hover(`main button[aria-label^="About "]`);
    check(
      `"?" tip opens on hover`,
      await p.waitFor(
        `!!document.querySelector('[data-radix-popper-content-wrapper] [role=dialog]')`,
        3000,
      ),
    );
    await p.press("Escape");
    await p.viewport(390);
    await open("/analytics?range=28d");
    await p.tap(`main button[aria-label^="About "]`);
    check(
      `"?" tip opens on tap (phone)`,
      await p.waitFor(
        `!!document.querySelector('[data-radix-popper-content-wrapper] [role=dialog]')`,
        3000,
      ),
    );
    await p.viewport(1440);
  }

  // 4. Every "What stands out" link lands on its section.
  if (part(4))
    for (const { path } of PAGES) {
      await open(`${path}?range=28d`);
      const links = await p.eval(
        `[...document.querySelectorAll('section[aria-labelledby="findings-title"] a')].map((a) => a.getAttribute('href'))`,
      );
      const missing = [];
      for (const href of links) {
        await open(href);
        const hash = href.split("#")[1];
        if (
          hash &&
          !(await p.eval(`!!document.getElementById(${JSON.stringify(hash)})`))
        )
          missing.push(href);
      }
      check(
        `${path}: every finding links to its section`,
        missing.length === 0,
        missing.length
          ? `missing: ${missing.join(", ")}`
          : `${links.length} ${links.length === 1 ? "link" : "links"}`,
      );
    }

  // 5. The detail panel.
  if (part(5)) {
    const panelTitle = `document.querySelector('[role=dialog][data-side] h2')?.textContent ?? null`;
    for (const section of [
      "opportunities",
      "movers",
      "competing",
      "recruiting-pages",
    ]) {
      await open("/analytics/search?range=28d");
      const label = await p.eval(
        `document.querySelector('#${section} li button')?.textContent?.trim() ?? null`,
      );
      if (!label) {
        check(`panel from "${section}"`, true, "no rows this period");
        continue;
      }
      await p.tap(`#${section} li button`);
      const opened = await p.waitFor(
        `(${panelTitle}) && !document.querySelector('[role=dialog][data-side] [aria-busy]')`,
        15000,
      );
      const title = await p.eval(panelTitle);
      check(
        `panel opens from "${section}"`,
        opened && Boolean(title),
        `${label} → ${title}`,
      );
    }
    await open("/analytics/search?range=28d");
    await p.tap("#opportunities li button");
    await p.waitFor(
      `!!document.querySelector('[role=dialog][data-side] ul button')`,
      15000,
    );
    const first = await p.eval(panelTitle);
    await p.eval(
      `document.querySelector('[role=dialog][data-side] ul button').click()`,
    );
    await p.waitFor(`(${panelTitle}) !== ${JSON.stringify(first)}`, 15000);
    const second = await p.eval(panelTitle);
    check(
      "panel opens a related item inside it",
      second && second !== first,
      `${first} → ${second}`,
    );
    await p.eval("history.back()");
    check(
      "Back returns to the previous panel",
      await p.waitFor(`(${panelTitle}) === ${JSON.stringify(first)}`, 8000),
    );
    await p.press("Escape");
    check(
      "Escape closes the panel and clears the address",
      await p.waitFor(
        `!document.querySelector('[role=dialog][data-side]') && !location.search.includes('item=')`,
        5000,
      ),
    );
    await p.viewport(390);
    await open(
      `/analytics/search?range=28d&item=${encodeURIComponent("page:/")}`,
    );
    check(
      "a shared panel link opens as a bottom sheet on a phone",
      await p.waitFor(
        `document.querySelector('[role=dialog][data-side]')?.getAttribute('data-side') === 'bottom'`,
        15000,
      ),
    );
    await p.viewport(1440);
  }

  // 6. Keyboard focus is visible.
  if (part(6)) {
    await open("/analytics?range=28d");
    await p.eval("document.activeElement?.blur(); window.scrollTo(0, 0)");
    let visible = 0;
    for (let i = 0; i < 6; i++) {
      await p.press("Tab");
      visible += await p.eval(
        `(() => { const el = document.activeElement; if (!el || el === document.body) return 0; const s = getComputedStyle(el); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? 1 : 0; })()`,
      );
    }
    check(
      "keyboard focus is visible",
      visible >= 5,
      `${visible} of 6 focus stops outlined`,
    );
  }

  // 7. Nothing went wrong in the browser along the way.
  const problems = p.problems.filter((x) => !/favicon/.test(x));
  check(
    "no console errors, exceptions or failed requests",
    problems.length === 0,
    problems.slice(0, 5).join(" | "),
  );
} catch (error) {
  check(
    "the check ran to the end",
    false,
    error instanceof Error ? error.message : String(error),
  );
} finally {
  await p.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length} of ${results.length} checks passed.`,
);
process.exit(failed.length ? 1 : 0);
