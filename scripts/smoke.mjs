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
          hidden: document.documentElement.hasAttribute('data-agent-build-run'),
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
const hudText = (page) => page.locator('.agent-build-hud').innerText();

async function waitUntilGone(page) {
  await page.waitForFunction(() => !document.querySelector('.agent-build-stage, .agent-build-ruler, .agent-build-hud'));
  return page.evaluate(() => ({
    building: document.documentElement.hasAttribute('data-agent-build-run'),
    marked: document.querySelectorAll('[data-agent-build-reveal], [class=""]').length,
    disabled: document.querySelectorAll('[aria-disabled]').length,
    running: window.AgentBuild.isRunning(),
  }));
}

/* Records every element the run reveals, from the attribute mutations, and
   when the run ends lists anything the page shows that no layer covered,
   text or any visible leaf (media, icons, controls, components): that
   content would have waited hidden until the very end. It listens on window
   in the capture phase to run before the page's own end listeners, which may
   add content of their own. */
function trackCoverage(page) {
  return page.evaluate(() => {
    const shown = new Set();
    const frames = new Set();
    const sequence = [];
    const note = (records) => {
      for (const { target, oldValue } of records) {
        if (oldValue === null && target.hasAttribute('data-agent-build-reveal')) {
          sequence.push(target);
        }
        for (const value of [oldValue, target.getAttribute('data-agent-build-reveal')]) {
          if (value === 'shown') {
            shown.add(target);
          } else if (value === 'frame') {
            frames.add(target);
          }
        }
      }
    };
    const observer = new MutationObserver(note);
    observer.observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['data-agent-build-reveal'], attributeOldValue: true,
    });
    window.addEventListener('agentbuild:end', () => {
      note(observer.takeRecords());
      observer.disconnect();
      const ignored = 'script, style, noscript, template, .agent-build-layer';
      const visible = (element) => element.checkVisibility({ visibilityProperty: true });
      const covered = (element) => {
        for (let node = element; node; node = node.parentElement) {
          if (shown.has(node)) {
            return true;
          }
        }
        return frames.has(element);
      };
      const orphans = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const parent = text.parentElement;
        if (/\S/.test(text.nodeValue) && parent && !parent.closest(ignored) && visible(parent) && !covered(parent)) {
          orphans.push(`${parent.localName}: ${text.nodeValue.trim().slice(0, 40)}`);
        }
      }
      for (const element of document.body.querySelectorAll('*')) {
        if (element.children.length > 0 || element.closest(ignored) || !visible(element)) {
          continue;
        }
        const { width, height } = element.getBoundingClientRect();
        if (width >= 1 && height >= 1 && !covered(element)) {
          orphans.push(`<${element.localName}>`);
        }
      }
      const order = new Map(sequence.map((element, index) => [element, index]));
      const early = [];
      for (const [element, index] of order) {
        for (let node = element.parentElement; node; node = node.parentElement) {
          if (frames.has(node) && order.get(node) > index) {
            early.push(`${element.localName} before its ${node.localName}`);
          }
        }
      }
      window.__coverage = { orphans, early, shown: shown.size, frames: frames.size };
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
  const directions = await page.evaluate(() => ['.agent-build-hud', '.agent-build-live', '.agent-build-stage']
    .map((selector) => document.querySelector(selector))
    .map((element) => `${element.lang}:${element.dir}`));
  assert.deepEqual(directions, ['en:ltr', 'en:ltr', ':ltr']);
  await page.waitForFunction(() => /^[1-9]\d*\//.test(document.querySelector('.agent-build-hud-layers')?.textContent || ''),
    null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: fileURLToPath(new URL('running.png', OUTPUT)) });

  const pause = page.locator('.agent-build-hud-btn').first();
  await pause.click();
  const paused = await page.locator('.agent-build-hud-layers').textContent();
  assert.equal(await pause.textContent(), 'Resume');
  assert.equal(await pause.getAttribute('aria-pressed'), null, 'a button whose name changes is not a toggle');
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
  assert.deepEqual(look, { className: '', radius: '999px' }, 'the default look survives a run');

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
  assert.deepEqual(coverage.early, [], 'no block appears before its frame');
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
  const coverage = await page.evaluate(() => window.__coverage);
  assert.deepEqual(coverage.orphans, []);
  assert.deepEqual(coverage.early, []);
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

test('boxes take the size and angle of turned elements, on a body a collapsing margin moved', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/rotated.html');
  await page.evaluate(() => {
    window.__boxes = [];
    new MutationObserver((records) => {
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        if (node.classList?.contains('agent-build-box')) {
          const rect = node.getBoundingClientRect();
          window.__boxes.push({
            bounds: [rect.left + scrollX, rect.top + scrollY, rect.width, rect.height],
            size: [node.offsetWidth, node.offsetHeight],
            angle: Number(node.style.transform.match(/rotate\(([-\d.e]+)deg\)/)?.[1] ?? 0),
          });
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    window.AgentBuild.start({ count: 1, pace: 0.25 });
  });
  await page.waitForFunction(() => window.__events.some((event) => event.type === 'agentbuild:end'), null,
    { timeout: 30000 });

  const { boxes, targets } = await page.evaluate(() => ({
    boxes: window.__boxes,
    targets: ['.bar', '#title', '#left', '#right'].map((selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { selector, bounds: [rect.left + scrollX, rect.top + scrollY, rect.width, rect.height] };
    }),
  }));
  const near = (a, b) => a.every((value, index) => Math.abs(value - b[index]) <= 2);
  for (const { selector, bounds } of targets) {
    assert.ok(boxes.some((box) => near(box.bounds, bounds)), `a box lines up with ${selector}`);
  }
  assert.deepEqual(boxes.find((box) => Math.round(box.angle) === -8)?.size, [196, 401]);
  assert.deepEqual(boxes.find((box) => Math.round(box.angle) === 8)?.size, [176, 361]);
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

test('started from code it reports no trigger, then gives focus and scroll back', async (t) => {
  const { page, problems } = await open(t, '/');
  await page.evaluate(() => {
    window.__live = {};
    new MutationObserver((records) => {
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        if (node.classList?.contains('agent-build-live')) {
          window.__live.added ??= performance.now();
        } else if (node.nodeType === Node.TEXT_NODE && node.parentElement?.classList.contains('agent-build-live')) {
          window.__live.spoke ??= performance.now();
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    document.querySelector('[data-demo-run]').focus({ preventScroll: true });
    window.scrollTo({ top: 600, behavior: 'instant' });
  });

  assert.equal(await page.evaluate(() => window.AgentBuild.start()), true);
  await page.locator('.agent-build-hud').waitFor();
  await page.waitForFunction(() => window.__live.spoke);
  await page.keyboard.press('Escape');
  await waitUntilGone(page);

  const after = await page.evaluate(() => ({
    focused: document.activeElement.hasAttribute('data-demo-run'),
    scrolled: scrollY,
    silence: window.__live.spoke - window.__live.added,
  }));
  assert.equal(after.focused, true, 'focus is back where it was');
  assert.equal(after.scrolled, 600, 'the page is back where it was');
  assert.ok(after.silence >= 100, `the live region was there ${after.silence} ms before it spoke`);
  assert.equal((await events(page))[0].detail.trigger, false);
  await assertClean(page, problems);
});

test('focus goes back to where it was, not to a trigger passed in', async (t) => {
  const { page, problems } = await open(t, '/');
  await page.evaluate(() => {
    document.querySelector('[data-demo-run]').focus({ preventScroll: true });
    window.AgentBuild.start({ trigger: document.querySelector('[data-agent-build]') });
  });
  await page.locator('.agent-build-hud').waitFor();
  await page.keyboard.press('Escape');
  await waitUntilGone(page);

  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-demo-run')), true);
  assert.equal((await events(page))[0].detail.trigger, true);
  await assertClean(page, problems);
});

test('a scroll of the visitor\'s own stops the follow, and the page stays there', async (t) => {
  const { page, problems } = await open(t, '/');
  await page.locator('button[data-agent-build]').click();
  await page.locator('.agent-build-box').first().waitFor({ timeout: 20000 });
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => scrollY), 900, 'the follow lets go');

  await page.keyboard.press('Escape');
  await waitUntilGone(page);
  assert.equal(await page.evaluate(() => scrollY), 900, 'the page is not sent back');
  await assertClean(page, problems);
});

test('a right-to-left page gets its language, left-to-right overlays, and text typed from the right', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/rtl.html');
  const button = page.locator('button[data-agent-build]');
  await button.waitFor({ state: 'visible' });
  assert.equal(await button.textContent(), 'شاهد الوكلاء يبنون الصفحة');
  assert.deepEqual(await button.locator('span[lang]').evaluate((label) => [label.lang, label.dir]), ['ar', 'rtl']);
  await page.evaluate(() => {
    window.__sweeps = [];
    new MutationObserver((records) => {
      for (const { target } of records) {
        if (target.matches('p, h1, h2, h3') && target.getAttribute('data-agent-build-reveal') === 'shown') {
          for (const animation of target.getAnimations()) {
            const [first] = animation.effect.getKeyframes();
            if (first.clipPath) {
              window.__sweeps.push(first.clipPath);
            }
          }
        }
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['data-agent-build-reveal'], subtree: true });
  });

  await button.click();
  await page.locator('.agent-build-hud').waitFor();
  const directions = await page.evaluate(() => ['.agent-build-hud', '.agent-build-live', '.agent-build-stage',
    '.agent-build-ruler--top'].map((selector) => document.querySelector(selector))
    .map((element) => `${element.lang}:${element.dir}`));
  assert.deepEqual(directions, ['ar:rtl', 'ar:rtl', ':ltr', ':ltr']);
  assert.match(await hudText(page), /^محاكاة/);
  await page.waitForFunction(() => window.__sweeps.length >= 3, null, { timeout: 20000 });
  const sweeps = await page.evaluate(() => window.__sweeps);
  assert.ok(sweeps.every((sweep) => /^inset\(-6px -6px -6px 100%\)$/.test(sweep)), sweeps.join(' | '));

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
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-agent-build-run')), false);
  assert.deepEqual(await events(page), []);
  await assertClean(page, problems);
});

/* Samples, on every frame of the run, what must never happen on the
   page-rules fixture. */
function watchPageRules(page) {
  return page.evaluate(() => {
    const breaches = new Set();
    const check = () => {
      if (document.documentElement.getAttribute('data-agent-build-run') === 'building') {
        const visibility = (id) => getComputedStyle(document.getElementById(id)).visibility;
        if (visibility('dropdown') !== 'hidden') {
          breaches.add('a dropdown the page hides was shown');
        }
        if (visibility('error') !== 'hidden') {
          breaches.add('an error message the page hides was shown');
        }
        if (!document.getElementById('webfont').closest('[data-agent-build-reveal]') && visibility('webfont') !== 'hidden') {
          breaches.add('a heading the page makes visible escaped before its turn');
        }
        if (document.getElementById('top').hasAttribute('data-agent-build-reveal') && visibility('top') !== 'visible') {
          breaches.add('a revealed header disappeared when its class attribute changed');
        }
        const logo = getComputedStyle(document.getElementById('dim'));
        if (parseFloat(logo.opacity) > 0.51 || !logo.filter.includes('grayscale')) {
          breaches.add('a dimmed, filtered logo lost its own opacity or filter');
        }
        if (visibility('chat') !== 'visible') {
          breaches.add('a fixed control was hidden');
        }
      }
      if (!window.__breaches) {
        requestAnimationFrame(check);
      }
    };
    document.addEventListener('agentbuild:end', () => {
      window.__breaches = [...breaches];
    }, { once: true });
    requestAnimationFrame(check);
  });
}

test('the page keeps its own rules: what it hides stays hidden and nothing shows early', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/page-rules.html');
  await trackCoverage(page);
  await watchPageRules(page);
  await page.evaluate(() => window.AgentBuild.start({ pace: 0.25, count: 40 }));

  await page.waitForFunction(() => window.__coverage && window.__breaches, null, { timeout: 60000 });
  assert.deepEqual(await page.evaluate(() => window.__breaches), []);
  const coverage = await page.evaluate(() => window.__coverage);
  assert.deepEqual(coverage.orphans, []);
  assert.deepEqual(coverage.early, []);
  assert.ok(await page.evaluate(() => scrollY > 0 || document.getElementById('top').className === 'top'));
  await waitUntilGone(page);
  assert.deepEqual(await page.evaluate(() => ['dropdown', 'error', 'webfont']
    .map((id) => getComputedStyle(document.getElementById(id)).visibility)), ['hidden', 'hidden', 'visible']);
  await assertClean(page, problems);
});

test('boxes are measured after the page settles its start transitions', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/page-rules.html');
  await page.evaluate(() => window.AgentBuild.start({ count: 1 }));
  await page.locator('.agent-build-box').waitFor();

  const [box, target] = await page.evaluate(() => [
    document.querySelector('.agent-build-box'),
    document.getElementById('reveal'),
  ].map((element) => {
    const rect = element.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height].map(Math.round);
  }));
  assert.deepEqual(box, target);
  await page.evaluate(() => window.AgentBuild.stop());
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('a transformed body, mandatory snapping, and content no selector names', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/hostile.html');
  await trackCoverage(page);
  await page.evaluate(() => {
    window.__deepest = 0;
    const sample = () => {
      window.__deepest = Math.max(window.__deepest, scrollY);
      if (!window.__coverage) {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  });
  await page.evaluate(() => window.AgentBuild.start({ count: 4 }));

  const hud = page.locator('.agent-build-hud');
  await hud.waitFor();
  const placement = await page.evaluate(() => {
    const element = document.querySelector('.agent-build-hud');
    const ruler = document.querySelector('.agent-build-ruler--top').getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      onScreen: rect.top >= 0 && rect.bottom <= innerHeight,
      rulerTop: Math.round(ruler.top),
      topLayer: element.matches(':popover-open'),
    };
  });
  assert.deepEqual(placement, { onScreen: true, rulerTop: 0, topLayer: true });

  await page.waitForFunction(() => window.__coverage, null, { timeout: 60000 });
  const coverage = await page.evaluate(() => window.__coverage);
  assert.deepEqual(coverage.orphans, []);
  assert.deepEqual(coverage.early, []);
  assert.ok(await page.evaluate(() => window.__deepest > 100), 'the page followed the agents despite snapping');
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('a page that scrolls an inner container builds what is in view and shows the rest', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/inner-scroll.html');
  await trackCoverage(page);
  await page.evaluate(() => window.AgentBuild.start({ pace: 0.25, count: 40 }));

  await page.waitForFunction(() => window.__coverage, null, { timeout: 60000 });
  const coverage = await page.evaluate(() => window.__coverage);
  assert.deepEqual(coverage.orphans, []);
  const end = (await events(page)).at(-1);
  assert.equal(end.detail.total, 5, 'header, heading, section, heading and paragraph in view');
  assert.equal(end.detail.built, 5);
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('pausing while blocks wait for their frames, then Escape, ends cleanly', async (t) => {
  const { page, problems } = await open(t, '/');
  await page.evaluate(() => window.AgentBuild.start({ count: 40 }));
  await page.waitForFunction(() => document.querySelectorAll('.agent-build-box').length >= 10, null, { timeout: 20000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');

  assert.deepEqual(await waitUntilGone(page), { building: false, marked: 0, disabled: 0, running: false });
  assert.equal((await events(page)).at(-1).detail.skipped, true);
  assert.equal(await page.evaluate(() => window.AgentBuild.start({ pace: 0.25 })), true, 'a new run can start');
  assert.equal(await page.evaluate(() => window.AgentBuild.stop()), true);
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('a run never builds for much longer than twenty seconds, whatever the options', async (t) => {
  const { page, problems } = await open(t, '/');
  await trackCoverage(page);
  const started = Date.now();
  await page.evaluate(() => window.AgentBuild.start({ count: 1, pace: 4 }));

  await page.waitForFunction(() => window.__coverage, null, { timeout: 45000 });
  assert.ok(Date.now() - started < 26000, `${Date.now() - started} ms`);
  const end = (await events(page)).at(-1);
  assert.equal(end.detail.skipped, false);
  assert.equal(end.detail.built, end.detail.total);
  assert.deepEqual((await page.evaluate(() => window.__coverage)).orphans, []);
  await waitUntilGone(page);
  await assertClean(page, problems);
});


test('an element named AgentBuild does not stop the library', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/frameworks.html');

  assert.equal(await page.evaluate(() => typeof window.AgentBuild.start), 'function');
  await page.locator('#static').waitFor({ state: 'visible' });
  assert.match(await page.locator('#static').textContent(), /^Watch the agents build it$/);
  await assertClean(page, problems);
});

test('a framework handler that starts the run with its own options wins the click', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/frameworks.html');
  await page.locator('#framework').click();

  await page.locator('.agent-build-hud').waitFor();
  assert.match(await hudText(page), /^Simulation · 3 agents/);
  assert.equal((await events(page)).filter((event) => event.type === 'agentbuild:start').length, 1);
  await page.evaluate(() => window.AgentBuild.stop());
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('buttons rendered later appear once mounted', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/frameworks.html');
  await page.locator('#element button').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#late').isVisible(), false);

  await page.evaluate(() => window.AgentBuild.mount());
  await page.evaluate(() => window.AgentBuild.mount());
  await page.locator('#late').waitFor({ state: 'visible' });
  assert.match(await page.locator('#late').textContent(), /^Watch the agents build it$/);
  await page.locator('#late').click();
  await page.locator('.agent-build-hud').waitFor();
  assert.match(await hudText(page), /^Simulation · 20 agents/);
  await page.evaluate(() => window.AgentBuild.stop());
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('the custom element renders its own trigger and passes on its options', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/frameworks.html');
  const button = page.locator('#element button');
  await button.waitFor({ state: 'visible' });

  assert.equal(await button.textContent(), 'Build with five');
  assert.equal(await button.getAttribute('type'), 'button');
  await button.click();
  await page.locator('.agent-build-hud').waitFor();
  assert.match(await hudText(page), /^Simulation · 5 agents/);
  await page.evaluate(() => window.AgentBuild.stop());
  await waitUntilGone(page);
  await assertClean(page, problems);
});

test('without its stylesheet the button never shows and start() refuses', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/no-css.html');
  await page.waitForLoadState('load');
  await page.waitForTimeout(100);

  assert.equal(await page.locator('[data-agent-build]').isVisible(), false);
  assert.equal(await page.evaluate(() => window.AgentBuild.start()), false);
  assert.deepEqual(await events(page), []);
  assert.ok(problems.length > 0 && problems.every((problem) => problem.includes('agent-build.css is not loaded')), problems.join('\n'));
  assert.deepEqual(await page.evaluate(() => window.__violations), []);
});

test('ES modules in the browser share one run with the auto entry', async (t) => {
  const { page, problems } = await open(t, '/test/fixtures/esm.html');
  await page.waitForFunction(() => window.esm);
  await page.locator('button[data-agent-build]').waitFor({ state: 'visible' });

  assert.equal(await page.evaluate(() => window.esm.start({ pace: 0.25 })), true);
  assert.equal(await page.evaluate(() => window.AgentBuild.isRunning()), true);
  assert.equal(await page.evaluate(() => window.AgentBuild.stop()), true);
  assert.equal(await page.evaluate(() => window.esm.isRunning()), false);
  await waitUntilGone(page);
  await assertClean(page, problems);
});
