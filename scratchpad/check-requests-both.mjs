import { createRequire } from "node:module";
const require = createRequire("C:/Users/hp/Things-to-do/package.json");
const { chromium } = require("playwright");
const BASE = "https://resolve-git-fix-discover-marketplace-completion-resolve-os-new.vercel.app";
const b = await chromium.launch({ headless: true });
for (const [name, state] of [["abdullahlp114", "./storage-state.json"], ["abdullah.zio1315", "./contributor.storageState.json"]]) {
  const c = await b.newContext({ storageState: state, viewport: { width: 1440, height: 1000 } });
  const p = await c.newPage();
  await p.goto(BASE + "/discover?view=requests", { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1500);
  const text = await p.evaluate(() => document.body.innerText);
  console.log(`\n=== ${name} ===`);
  console.log(text.slice(text.indexOf("Funded requests"), text.indexOf("Funded requests") + 500));
  await c.close();
}
await b.close();
process.exit(0);
