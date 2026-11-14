const { expect } = require('@playwright/test');

async function waitForEntrance(page) {
  // Screens fade and lift into place. Axe has to measure the settled design; a
  // frame mid-transition reports blended colors. Infinite marquees are ignored.
  await page.waitForFunction(() => {
    return !document.body.getAnimations({ subtree: true }).some((animation) => {
      const timing = animation.effect && animation.effect.getComputedTiming();
      return timing && timing.endTime !== Infinity && animation.playState === 'running';
    });
  });
}

const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  'zh-Hans': 'Simplified Chinese', 'zh-Hant': 'Traditional Chinese',
  ja: 'Japanese', ko: 'Korean', 'pt-BR': 'Brazilian Portuguese',
  hi: 'Hindi', ar: 'Arabic'
};
const LOCALES = Object.keys(LANGUAGE_NAMES);

async function expectNoClippedText(page, screen, rootSelector) {
  await page.mouse.move(0, 0);
  await waitForEntrance(page);
  const issues = await page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector) || document.body;
    const problems = [];
    const viewport = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > viewport + 1) {
      problems.push('page scrolls horizontally (' + document.documentElement.scrollWidth + 'px for ' + viewport + 'px)');
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      const parent = node.parentElement;
      // Decorative ticker copy is aria-hidden and deliberately scrolls past the
      // viewport; its clipping is the design, not a layout defect.
      if (!parent || parent.closest('script,style,svg,textarea,.sr-only,[hidden],.home-ticker')) continue;
      let visiblyHidden = false;
      for (let ancestor = parent; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) { visiblyHidden = true; break; }
      }
      if (visiblyHidden) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
      if (!lines.length) continue;

      let box = parent;
      while (box && box !== document.body) {
        const boxStyle = getComputedStyle(box);
        const overflow = boxStyle.overflowX + boxStyle.overflowY;
        if (/auto|scroll/.test(overflow)) break;
        if (/hidden|clip/.test(overflow)) {
          const bounds = box.getBoundingClientRect();
          const clipped = lines.some((line) => line.left < bounds.left - 1 || line.right > bounds.right + 1 || line.top < bounds.top - 1 || line.bottom > bounds.bottom + 1);
          if (clipped) {
            problems.push('clipped: "' + node.nodeValue.trim().slice(0, 48) + '" in ' + (box.tagName.toLowerCase() + (box.id ? '#' + box.id : '') + (box.className && typeof box.className === 'string' ? '.' + box.className.trim().split(/\s+/).join('.') : '')));
          }
          break;
        }
        box = box.parentElement;
      }

      lines.forEach((line) => {
        if (line.right > viewport + 1 || line.left < -1) {
          problems.push('outside viewport: "' + node.nodeValue.trim().slice(0, 48) + '"');
        }
      });
    }

    root.querySelectorAll('button, a').forEach((element) => {
      if (element.innerText.trim().length < 3 || element.closest('[hidden],.sr-only,.home-ticker')) return;
      if (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2) {
        problems.push('overflowing control: "' + element.innerText.trim().slice(0, 48) + '"');
      }
    });
    return Array.from(new Set(problems));
  }, rootSelector);
  expect(issues, 'layout issues on ' + screen + ':\n' + issues.join('\n')).toEqual([]);
}

async function openLanguagePicker(page) {
  const picker = page.locator('#language-picker');
  if (!(await picker.evaluate((element) => element.open))) {
    await page.locator('#language-picker summary').click();
  }
}

async function chooseLocale(page, locale) {
  await openLanguagePicker(page);
  await page.locator('[data-locale="' + locale + '"]').click();
}

async function setPreferences(page, theme, locale) {
  await page.addInitScript(({ theme, locale }) => {
    localStorage.setItem('merge2048.theme', theme);
    localStorage.setItem('sixfold.locale.v1', locale);
  }, { theme, locale });
}

module.exports = {
  LANGUAGE_NAMES,
  LOCALES,
  waitForEntrance,
  expectNoClippedText,
  openLanguagePicker,
  chooseLocale,
  setPreferences
};
