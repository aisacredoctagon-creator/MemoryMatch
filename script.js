(() => {
  'use strict';

  // 32 simbol: cukup untuk grid terbesar (6x8 = 24 pasang).
  const SYMBOLS = [
    ['🍎', 'apel'], ['🍌', 'pisang'], ['🍇', 'anggur'], ['🍓', 'stroberi'],
    ['🍉', 'semangka', 'assets/watermelon.svg'], ['🍍', 'nanas'], ['🥝', 'kiwi'], ['🍒', 'ceri'],
    ['🐶', 'anjing'], ['🐱', 'kucing'], ['🐼', 'panda'], ['🦊', 'rubah'],
    ['🐸', 'katak'], ['🐵', 'monyet'], ['🦁', 'singa'], ['🐙', 'gurita'],
    ['🐢', 'kura-kura'], ['🦋', 'kupu-kupu'], ['🐝', 'lebah'], ['🐧', 'penguin'],
    ['🚀', 'roket'], ['⚽', 'bola'], ['🎸', 'gitar'], ['🎲', 'dadu'],
    ['🌵', 'kaktus'], ['🌻', 'bunga matahari'], ['🍄', 'jamur'], ['⭐', 'bintang'],
    ['🌙', 'bulan'], ['🔥', 'api'], ['⚡', 'petir'], ['🎈', 'balon'],
  ];

  const MISMATCH_DELAY = 700;
  const WIN_DELAY = 550;
  const SIZE_KEY = 'memorymatch.size.v1';
  const BEST_KEY = 'memorymatch.best.v1';

  const $ = (id) => document.getElementById(id);
  const els = {
    board: $('board'),
    size: $('size'),
    restart: $('restart'),
    moves: $('moves'),
    time: $('time'),
    best: $('best'),
    status: $('status'),
    progress: $('progress'),
    footerText: $('footer-text'),
    win: $('win'),
    winMoves: $('win-moves'),
    winTime: $('win-time'),
    winRecord: $('win-record'),
    again: $('again'),
  };

  const portrait = window.matchMedia('(orientation: portrait)');

  // ---------- Util ----------
  function shuffle(arr) {
    // Fisher-Yates
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function parseSize(value) {
    const [a, b] = value.split('x').map(Number);
    return { a, b, key: `${a}x${b}`, pairs: (a * b) / 2 };
  }

  const storage = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* diabaikan */ }
    },
  };

  // ---------- State ----------
  let game = null;
  let timerId = 0;
  let mismatchTimer = 0;
  let winTimer = 0;

  function newGame(size) {
    const symbols = shuffle(SYMBOLS.slice()).slice(0, size.pairs);
    const cards = shuffle([...symbols, ...symbols]).map(([symbol, name, art]) => ({
      symbol, name, art, state: 'closed', // closed | open | matched
    }));
    return {
      size, cards,
      first: -1,
      locked: false,
      moves: 0,
      matched: 0,
      startedAt: 0,
      elapsed: 0,
      done: false,
    };
  }

  // ---------- Rendering ----------
  function applyLayout() {
    // Sisi panjang jadi tinggi saat portrait, lebar saat landscape.
    const { a, b } = game.size;
    const cols = portrait.matches ? Math.min(a, b) : Math.max(a, b);
    const rows = (a * b) / cols;
    els.board.style.setProperty('--cols', cols);
    els.board.style.setProperty('--rows', rows);
  }

  function cardLabel(i) {
    const c = game.cards[i];
    const n = i + 1;
    if (c.state === 'matched') return `Kartu ${n}, cocok: ${c.name}`;
    if (c.state === 'open') return `Kartu ${n}, terbuka: ${c.name}`;
    return `Kartu ${n}, tertutup`;
  }

  function paintCard(i) {
    const el = els.board.children[i];
    const c = game.cards[i];
    el.classList.toggle('is-open', c.state === 'open');
    el.classList.toggle('is-matched', c.state === 'matched');
    el.setAttribute('aria-label', cardLabel(i));
    // aria-disabled (bukan disabled) agar fokus keyboard tidak hilang.
    el.setAttribute('aria-disabled', c.state === 'closed' ? 'false' : 'true');
  }

  function renderBoard() {
    const frag = document.createDocumentFragment();
    game.cards.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.dataset.index = i;
      btn.innerHTML =
        '<span class="card__inner">' +
        '<span class="face face--cover" aria-hidden="true">?</span>' +
        '<span class="face face--symbol" aria-hidden="true">' +
        (c.art ? `<img class="face__art" src="${c.art}" alt="">` : c.symbol) +
        '</span>' +
        '</span>';
      frag.appendChild(btn);
    });
    els.board.replaceChildren(frag);
    game.cards.forEach((_, i) => paintCard(i));
  }

  function renderBest() {
    const best = (storage.get(BEST_KEY) || {})[game.size.key];
    els.best.replaceChildren();
    if (!best) {
      els.best.textContent = '–';
      return;
    }
    const span = (className, text) => {
      const s = document.createElement('span');
      s.className = className;
      s.textContent = text;
      return s;
    };
    els.best.append(
      span('best__moves', `${best.moves} · `), span('sr-only', 'langkah, '),
      span('best__time', formatTime(best.time)), span('sr-only', ' menit'),
    );
  }

  function renderStats() {
    els.moves.textContent = game.moves;
    els.time.textContent = formatTime(game.elapsed);
  }

  function renderProgress() {
    const total = game.size.pairs;
    els.progress.style.setProperty('--p', game.matched / total);
    els.progress.setAttribute('aria-valuemax', total);
    els.progress.setAttribute('aria-valuenow', game.matched);
    els.footerText.textContent = `${game.matched} pasang ditemukan · lanjutkan petualangan!`;
  }

  function announce(msg) {
    els.status.textContent = msg;
  }

  // ---------- Timer ----------
  function startTimer() {
    game.startedAt = performance.now();
    timerId = setInterval(() => {
      game.elapsed = performance.now() - game.startedAt;
      els.time.textContent = formatTime(game.elapsed);
    }, 250);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = 0;
    if (game.startedAt) game.elapsed = performance.now() - game.startedAt;
  }

  // ---------- Game flow ----------
  function restart() {
    clearInterval(timerId);
    clearTimeout(mismatchTimer);
    clearTimeout(winTimer);
    timerId = mismatchTimer = winTimer = 0;
    if (els.win.open) els.win.close();

    game = newGame(parseSize(els.size.value));
    applyLayout();
    renderBoard();
    renderStats();
    renderBest();
    renderProgress();
    announce(`Game baru, ${game.size.a} kali ${game.size.b}, ${game.size.pairs} pasangan.`);
  }

  function flip(i) {
    const card = game.cards[i];
    if (game.locked || game.done || card.state !== 'closed') return;

    if (!game.startedAt) startTimer();

    card.state = 'open';
    paintCard(i);

    if (game.first === -1) {
      game.first = i;
      return;
    }

    const j = game.first;
    game.first = -1;
    game.moves++;
    els.moves.textContent = game.moves;

    if (game.cards[j].symbol === card.symbol) {
      card.state = game.cards[j].state = 'matched';
      paintCard(i);
      paintCard(j);
      game.matched++;
      renderProgress();
      announce(`Cocok: ${card.name}.`);
      if (game.matched === game.size.pairs) finish();
      return;
    }

    game.locked = true;
    announce(`Tidak cocok: ${game.cards[j].name} dan ${card.name}.`);
    const pair = [j, i].map((k) => els.board.children[k]);
    pair.forEach((el) => el.classList.add('is-wrong'));
    mismatchTimer = setTimeout(() => {
      card.state = game.cards[j].state = 'closed';
      paintCard(i);
      paintCard(j);
      pair.forEach((el) => el.classList.remove('is-wrong'));
      game.locked = false;
    }, MISMATCH_DELAY);
  }

  function saveBest() {
    const all = storage.get(BEST_KEY) || {};
    const prev = all[game.size.key];
    const time = Math.round(game.elapsed);
    const record = {
      moves: !prev || game.moves < prev.moves,
      time: !prev || time < prev.time,
      first: !prev,
    };
    all[game.size.key] = {
      moves: record.moves ? game.moves : prev.moves,
      time: record.time ? time : prev.time,
    };
    storage.set(BEST_KEY, all);
    return record;
  }

  function finish() {
    game.done = true;
    game.locked = true;
    stopTimer();
    renderStats();
    const record = saveBest();
    renderBest();

    els.winMoves.textContent = game.moves;
    els.winTime.textContent = formatTime(game.elapsed);
    const notes = [];
    if (record.moves) notes.push('langkah');
    if (record.time) notes.push('waktu');
    els.winRecord.hidden = notes.length === 0;
    els.winRecord.textContent = record.first
      ? 'Skor pertamamu untuk ukuran ini tersimpan!'
      : `Rekor baru: ${notes.join(' & ')} terbaik!`;

    announce(`Selesai dalam ${game.moves} langkah, waktu ${formatTime(game.elapsed)}.`);
    winTimer = setTimeout(() => els.win.showModal(), WIN_DELAY);
  }

  // ---------- Events ----------
  // Event delegation: satu listener untuk seluruh kartu.
  els.board.addEventListener('click', (e) => {
    const btn = e.target.closest('.card');
    if (btn && els.board.contains(btn)) flip(Number(btn.dataset.index));
  });

  els.size.addEventListener('change', () => {
    storage.set(SIZE_KEY, els.size.value);
    restart();
  });

  els.restart.addEventListener('click', restart);

  els.again.addEventListener('click', () => {
    els.win.close();
    restart();
    els.board.querySelector('.card')?.focus();
  });

  portrait.addEventListener('change', applyLayout);

  // ---------- Init ----------
  const saved = storage.get(SIZE_KEY);
  if (saved && [...els.size.options].some((o) => o.value === saved)) {
    els.size.value = saved;
  }
  restart();
})();
