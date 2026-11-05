/* Browser smoke test: the real library in the system Chrome, sandboxed, on
   pages that enforce a strict CSP and Trusted Types. It needs Google Chrome
   installed and playwright-core, so it runs locally (`pnpm smoke`) and not
   in CI. Screenshots land in output/. */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './serve.mjs';

const OUTPUT = new URL('../output/', import.meta.url);
let server;
let browser;

before(async () => {
  await mkdir(OUTPUT, { recursive: true });
  server = await startServer();
  browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, headless: true });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

/* Opens a page and records what must never happen: page errors, console
   errors or warnings, and CSP violations. It also records the library's
   events, and whether the page was already hidden when start fired. */
async function open(t, path, contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...contextOptions });
  t.after(() => context.close());
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      problems.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  await page.addInitScript(() => {
    window.__violations = [];
    window.__events = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
    for (const type of ['agentbuild:start', 'agentbuild:end']) {
      document.addEventListener(type, (event) => {
        window.__events.push({
          type,
          detail: { ...event.detail, trigger: Boolean(event.detail.trigger) },
          hidden: document.documentElement.classList.contains('agent-building'),
        });
      });
    }
  });
  await page.goto(new URL(path, server.url).href);
  await page.waitForFunction(() => window.AgentBuild);
  return { page, problems };
}

async function assertClean(page, problems) {
  assert.deepEqual(problems, []);
  assert.deepEqual(await page.evaluate(() => window.__violations), []);
}

const events = (page) => page.evaluate(() => window.__events);

async function waitUntilGone(page) {
  await page.waitForFunction(() => !document.querySelector('.agent-build-stage, .agent-build-ruler, .agent-build-hud'));
  return page.evaluate(() => ({
    building: document.documentElement.classList.contains('agent-building'),
    marked: document.querySelectorAll('.agent-build-shown, .agent-build-frame, [class=""]').length,
    disabled: document.querySelectorAll('[aria-disabled]').length,
    running: window.AgentBuild.isRunning(),
  }));
}

/* Records every element the run reveals, from the class mutations, and when
   the run ends lists any visible text or media that no layer covered: that
   content would have waited hidden until the very end. It listens on window
   in the capture phase to run before the page's own end listeners, which may
   add content of their own. */
function trackCoverage(page) {
  return page.evaluate(() => {
    const shown = new Set();
    const frames = new Set();
    const note = (records) => {
      for (const record of records) {
        const classes = `${record.oldValue || ''} ${record.target.className}`;
        if (/\bagent-build-shown\b/.test(classes)) {
          shown.add(record.target);
        }
        if (/\bagent-build-frame\b/.test(classes)) {
          frames.add(record.target);
        }
      }
    };
    const observer = new MutationObserver(note);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    window.addEventListener('agentbuild:end', () => {
      note(observer.takeRecords());
      observer.disconnect();
      const ignored = 'script, style, noscript, template, .agent-build-layer';
      const insideShown = (element) => {
        for (let node = element; node; node = node.parentElement) {
          if (shown.has(node)) {
            return true;
          }
        }
        return false;
      };
      const orphans = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const parent = text.parentElement;
        if (!/\S/.test(text.nodeValue) || !parent || parent.closest(ignored) || !parent.checkVisibility()) {
          continue;
        }
        if (!insideShown(parent) && !frames.has(parent)) {
          orphans.push(`${parent.localName}: ${text.nodeValue.trim().slice(0, 40)}`);
        }
      }
      for (const media of document.querySelectorAll('img, svg, video, canvas, iframe')) {
        if (!media.closest(ignored) && media.checkVisibility() && !insideShown(media)) {
          orphans.push(`${media.localName}`);
        }
      }
      window.__coverage = { orphans, shown: shown.size, frames: frames.size };
    }, { capture: true, once: true });
  });
}

test('the button shows up labelled, under a strict CSP with Trusted Types', async (t) => {
  const { page, problems } = await open(t, '/');
  const button = page.locator('button[data-agent-build]');

  await button.waitFor({ state: 'visible' });
  assert.equal(await button.getAttribute('type'), 'button');
  assert.match(await button.textContent(), /^Watch the agents build it$/);
  assert.equal(await page.locator('[data-demo-run]').first().isVisible(), true);
  await page.screenshot({ path: fileURLToPath(new URL('demo.png', OUTPUT)), fullPage: false });
  await assertClean(page, problems);

  const enforced = await page.evaluate(() => {
    try {
      document.createElement('div').innerHTML = '<b>x</b>';
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(enforced, true, 'the page enforces Trusted Types, so innerHTML would have thrown');
});

test('a click runs the simulation, says so, pauses, and Escape restores the page', async (t) => {
  const { page, problems } = await open(t, '/');
  await page.locator('button[data-agent-build]').click();

  const hud = page.locator('.agent-build-hud');
  await hud.waitFor();
  assert.match(await hud.innerText(), /^Simulation · 20 agents · 0\/\d+ layers/);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Pause');
  await page.waitForFunction(() => document.querySelector('.agent-build-live')?.textContent.startsWith('Simulation running'));
  await page.waitForFunction(() => /^[1-9]\d*\//.test(document.querySelector('.agent-build-hud-layers')?.textContent || ''),
    null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: fileURLToPath(new URL('running.png', OUTPUT)) });

  await page.getByRole('button', { name: 'Pause' }).click();
  const paused = await page.locator('.agent-build-hud-layers').textContent();
  assert.equal(await page.locator('.agent-build-hud-btn').first().getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.agent-build-hud-layers').textContent(), paused);
  await page.getByRole('button', { name: 'Resume' }).click();

  await page.keyboard.press('Escape');
  assert.deepEqual(await waitUntilGone(page), { building: false, marked: 0, disabled: 0, running: false });
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-agent-build')), true);
  const look = await page.locator('button[data-agent-build]').evaluate((button) => ({
    className: button.className,
    radius: getComputedStyle(button).borderRadius,
  }));
  assert.deepEqual(look, { className: 'agent-build-button', radius: '999px' }, 'the default look survives a run');

  const [start, end] = await events(page);
  assert.equal(start.type, 'agentbuild:start');
  assert.equal(start.hidden, false, 'start fires before anything is hidden');
  assert.equal(start.detail.trigger, true);
  assert.equal(end.type, 'agentbuild:end');
  assert.equal(end.detail.skipped, true);
  assert.equal(end.hidden, false, 'end fires once the page is back');
  await assertClean(page, problems);
});

test('a full run builds every visible part of the demo, then cleans up', async (t) => {
  const { page, problems } = await open(t, '/');
  await trackCoverage(page);
  assert.equal(await page.evaluate(() => window.AgentBuild.start({ pace: 0.25, count: 40 })), true);
  assert.equal(await page.evaluate(() => window.AgentBuild.start()), false, 'one run at a time');

  await page.waitForFunction(() => window.__coverage, null, { timeout: 60000 });
  const coverage = await page.evaluate(() => window.__coverage);
  assert.deepEqual(coverage.orphans, []);
  const end = (await events(page)).at(-1);
  assert.equal(end.detail.skipped, false);
  assert.equal(end.detail.built, end.detail.total);
  assert.ok(end.detail.total > 30, `${end.detail.total} layers`);
  assert.match(await page.locator('.agent-build-hud').innerText(), /^Built in [\d.]+ s · it was a simulation$/);

  assert.deepEqual(await waitUntilGone(page), { building: false, marked: 0, disabled: 0, running: false });
  await assertClean(page, problems);
});

test('a page built from divs gets every part built too', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/generic.html');
  await trackCoverage(page);
  await page.evaluate(() => window.AgentBuild.start({ pace: 0.25, count: 40 }));

  await page.waitForFunction(() => window.__coverage, null, { timeout: 60000 });
  assert.deepEqual((await page.evaluate(() => window.__coverage)).orphans, []);
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('the button\'s own attributes apply, and a second copy of the script changes nothing', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/generic.html');
  assert.equal(await page.evaluate(() => document.querySelectorAll('script[src$="agent-build.js"]').length), 2);
  await page.locator('button[data-agent-build]').click();

  await page.locator('.agent-build-hud').waitFor();
  assert.match(await page.locator('.agent-build-hud').innerText(), /^Simulation · 3 agents/);
  await page.locator('.agent-build-agent').first().waitFor();
  assert.equal(await page.locator('.agent-build-agent').count(), 3);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.agent-build-stage'))
    .getPropertyValue('--agent-accent').trim()), '#FF9F0A');
  assert.equal(await page.evaluate(() => window.AgentBuild.stop()), true);
  assert.equal(await page.evaluate(() => window.AgentBuild.stop()), false);

  await waitUntilGone(page);
  assert.equal((await events(page)).filter((event) => event.type === 'agentbuild:start').length, 1);
  await assertClean(page, problems);
});

test('the work layer lines up with the page even when the body is offset', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/offset.html');
  await page.evaluate(() => window.AgentBuild.start({ count: 1 }));
  await page.locator('.agent-build-box').waitFor();

  const [box, target] = await page.evaluate(() => [
    document.querySelector('.agent-build-box'),
    document.getElementById('only'),
  ].map((element) => {
    const rect = element.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height].map(Math.round);
  }));
  assert.deepEqual(box, target);

  await page.evaluate(() => window.AgentBuild.stop());
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('the simulation speaks the language of its button', async (t) => {
  const { page, problems } = await open(t, '/?lang=es');
  const button = page.locator('button[data-agent-build]');
  assert.equal(await button.textContent(), 'Mira cómo la montan los agentes');

  await button.click();
  await page.locator('.agent-build-hud').waitFor();
  assert.match(await page.locator('.agent-build-hud').innerText(), /^Simulación · 20 agentes · 0\/\d+ capas/);
  assert.equal(await page.getByRole('group', { name: 'Simulación: agentes de IA montando la página' }).count(), 1);
  await page.evaluate(() => window.AgentBuild.stop());
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('on a phone it runs fourteen agents', async (t) => {
  const { page, problems } = await open(t, '/', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await page.locator('button[data-agent-build]').tap();
  await page.locator('.agent-build-agent').first().waitFor();
  assert.equal(await page.locator('.agent-build-agent').count(), 14);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: fileURLToPath(new URL('phone.png', OUTPUT)) });
  await page.getByRole('button', { name: 'Finish' }).tap();
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('under reduced motion the button never appears and start() refuses', async (t) => {
  const { page, problems } = await open(t, '/', { reducedMotion: 'reduce' });

  assert.equal(await page.locator('button[data-agent-build]').isVisible(), false);
  assert.equal(await page.evaluate(() => document.querySelector('[data-agent-build]').hidden), true);
  assert.equal(await page.locator('[data-demo-run]').first().isVisible(), false);
  assert.equal(await page.evaluate(() => window.AgentBuild.start()), false);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('agent-building')), false);
  assert.deepEqual(await events(page), []);
  await assertClean(page, problems);
});
