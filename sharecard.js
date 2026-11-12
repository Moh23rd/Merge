/* The share card, in the 2.x pocket-arcade language: cream paper, the
   six-piece mark, one huge number and the six-colour strip. Drawn locally so
   every game can share the same object without shipping image files. */
(function () {
  'use strict';

  const FONT = '"Google Sans Flex", ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const CREAM = '#f6f1e8';
  const INK = '#211d18';
  const MUTED = '#6f665a';
  const LINE = 'rgba(94, 76, 45, 0.16)';
  const YELLOW = '#e3b94a';
  const TILES = ['#e85f3b', '#efb07a', '#e3b94a', '#8bbd54', '#39a9a1', '#5b8fd5'];

  function font(weight, px) {
    return weight + ' ' + px + 'px ' + FONT;
  }

  function number(value) {
    return window.SixfoldI18n && window.SixfoldI18n.number
      ? window.SixfoldI18n.number(String(value))
      : String(value);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function tracked(ctx, text, x, baseline, spacing) {
    let cursor = x;
    for (let i = 0; i < text.length; i += 1) {
      ctx.fillText(text[i], cursor, baseline);
      cursor += ctx.measureText(text[i]).width + spacing;
    }
  }

  function draw(data) {
    const W = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = W;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, W);

    // The quiet dotted paper from the hub and the social card.
    ctx.fillStyle = 'rgba(94, 76, 45, 0.10)';
    for (let y = 26; y < W; y += 34) {
      for (let x = 28; x < W; x += 34) {
        ctx.beginPath();
        ctx.arc(x, y, 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.textBaseline = 'alphabetic';

    // Mark + wordmark.
    const markX = 80;
    const markY = 72;
    const tile = 19;
    const gap = 4;
    for (let i = 0; i < 6; i += 1) {
      roundRect(ctx, markX + (i % 3) * (tile + gap), markY + Math.floor(i / 3) * (tile + gap), tile, tile, 5);
      ctx.fillStyle = TILES[i];
      ctx.fill();
    }
    const brandX = markX + 3 * (tile + gap) + 14;
    ctx.fillStyle = INK;
    ctx.font = font(800, 40);
    ctx.fillText('SIXFOLD', brandX, markY + 25);
    ctx.fillStyle = MUTED;
    ctx.font = font(700, 10);
    tracked(ctx, 'PUZZLE COLLECTION', brandX + 1, markY + 43, 2.1);

    // Which cartridge this result belongs to.
    ctx.textAlign = 'right';
    ctx.fillStyle = INK;
    ctx.font = font(800, 17);
    ctx.fillText(String(data.game || 'Sixfold').toUpperCase(), W - 80, markY + 19);
    ctx.fillStyle = MUTED;
    ctx.font = font(700, 10);
    ctx.fillText([data.number, data.kind].filter(Boolean).map(number).join('  ·  '), W - 80, markY + 39);
    ctx.textAlign = 'left';

    ctx.fillStyle = LINE;
    ctx.fillRect(80, 166, W - 160, 1.5);

    // Kicker.
    ctx.fillStyle = data.accent || '#e85f3b';
    ctx.fillRect(80, 208, 34, 3);
    ctx.fillStyle = MUTED;
    ctx.font = font(700, 13);
    tracked(ctx, 'THE POCKET ARCADE', 128, 214, 2.9);

    // Title and the number that matters.
    ctx.fillStyle = INK;
    ctx.font = font(800, 64);
    ctx.fillText(String(data.title || 'Result'), 80, 306);

    const score = number(data.score == null ? '0' : data.score);
    const size = score.length <= 2 ? 224 : score.length === 3 ? 200 : score.length === 4 ? 168 : 138;
    ctx.font = font(800, size);
    ctx.fillText(score, 72, 512);

    ctx.fillStyle = YELLOW;
    ctx.fillRect(82, 534, 118, 9);

    ctx.fillStyle = MUTED;
    ctx.font = font(700, 15);
    tracked(ctx, String(data.label || 'POINTS').toUpperCase(), 84, 582, 2.8);

    if (data.meta && data.meta.length) {
      ctx.fillStyle = INK;
      ctx.font = font(600, 26);
      ctx.fillText(data.meta.map(number).join('   ·   '), 80, 648);
    }

    // Six-piece footer strip, anchored by the same tiles as the app mark.
    const stripY = 716;
    const strip = 64;
    for (let i = 0; i < 6; i += 1) {
      roundRect(ctx, 80 + i * (strip + 10), stripY, strip, strip, 15);
      ctx.fillStyle = TILES[i];
      ctx.fill();
    }
    ctx.fillStyle = MUTED;
    ctx.font = font(700, 12);
    ctx.textAlign = 'right';
    ctx.fillText('SIX GAMES', W - 80, stripY + 30);
    ctx.font = font(600, 11);
    ctx.fillStyle = 'rgba(111, 102, 90, 0.8)';
    ctx.fillText('No ads. No accounts. Offline.', W - 80, stripY + 50);
    ctx.textAlign = 'left';

    // Ink footer with the address.
    ctx.fillStyle = INK;
    ctx.fillRect(0, 900, W, 180);
    ctx.fillStyle = CREAM;
    ctx.font = font(800, 24);
    ctx.fillText('MOH23RD.GITHUB.IO/SIXFOLD', 80, 1000);
    ctx.fillStyle = YELLOW;
    ctx.font = font(700, 14);
    ctx.textAlign = 'right';
    ctx.fillText('SIX GAMES. NO FILLER.', W - 80, 1000);
    ctx.textAlign = 'left';

    return canvas;
  }

  async function file(data) {
    try {
      if (document.fonts && document.fonts.load) {
        await document.fonts.load(font(800, 64));
      }
    } catch (err) {
      /* draw with the fallback face */
    }
    const canvas = draw(data);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('image unavailable'));
          return;
        }
        const name = 'sixfold-' + String(data.game || 'result').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
        if (typeof File === 'function') resolve(new File([blob], name, { type: 'image/png' }));
        else {
          blob.name = name;
          resolve(blob);
        }
      }, 'image/png');
    });
  }

  async function share(data, title, text) {
    try {
      if (document.fonts && document.fonts.load) {
        await document.fonts.load(font(800, 64));
      }
      const image = await file(data);
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [image] })) {
        await navigator.share({ files: [image], title: title, text: text, url: 'https://moh23rd.github.io/Sixfold/' });
        return true;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return true;
    }
    return false;
  }

  window.MergeShareCard = { draw: draw, file: file, share: share };
})();
