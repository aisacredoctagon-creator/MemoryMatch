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

  const DURATION_SECS = 60;
  const WARNING_SECS = 10;      // tampilan timer berubah jadi peringatan
  const ANNOUNCE_SECS = 30;     // pengumuman screen reader: 30 detik, 10 detik, habis
  const MISMATCH_DELAY = 700;
  const WIN_DELAY = 550;
  const SIZE_KEY = 'memorymatch.size.v1';
  // v2: menyimpan sisa waktu (detik) terbanyak. Data v1 (waktu terpakai) tidak kompatibel, jadi diabaikan.
  const BEST_KEY = 'memorymatch.best.v2';

  const $ = (id) => document.getElementById(id);
  const els = {
    board: $('board'),
    size: $('size'),
    restart: $('restart'),
    moves: $('moves'),
    stat: $('time').closest('.stat'),
    time: $('time'),
    timeIcon: $('time-icon'),
    best: $('best'),
    status: $('status'),
    progress: $('progress'),
    footerText: $('footer-text'),
    win: $('win'),
    winMoves: $('win-moves'),
    winTime: $('win-time'),
    winRecord: $('win-record'),
    again: $('again'),
    over: $('over'),
    overSummary: $('over-summary'),
    overPairs: $('over-pairs'),
    overMoves: $('over-moves'),
    retry: $('retry'),
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

  function formatSeconds(secs) {
    return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  }

  // Detik yang ditampilkan countdown: dibulatkan ke atas, jadi 00:00 hanya saat waktu benar-benar habis.
  function secondsLeft(ms) {
    return Math.ceil(Math.max(0, ms) / 1000);
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

  // Baca skor terbaik dengan validasi bentuk data; data rusak atau format lama dianggap tidak ada.
  function readBestAll() {
    const all = storage.get(BEST_KEY);
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  }

  function readBest(key) {
    const b = readBestAll()[key];
    return b && Number.isFinite(b.moves) && Number.isFinite(b.remaining) ? b : null;
  }

  // ---------- State ----------
  let game = null;
  let rafId = 0;
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
      done: false,
      // Countdown berbasis timestamp: endAt = performance.now() saat waktu habis.
      remainingMs: DURATION_SECS * 1000,
      endAt: 0,
      running: false,
      started: false,
      shownSecs: DURATION_SECS,
      warned: false,
      said30: false,
      said10: false,
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
    // Setelah game selesai semua kartu terkunci.
    el.setAttribute('aria-disabled', c.state === 'closed' && !game.done ? 'false' : 'true');
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
    const best = readBest(game.size.key);
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
      span('best__time', formatSeconds(best.remaining)), span('sr-only', ' tersisa'),
    );
  }

  function renderStats() {
    els.moves.textContent = game.moves;
    renderTime(secondsLeft(game.remainingMs));
  }

  function renderTime(secs) {
    game.shownSecs = secs;
    els.time.textContent = formatSeconds(secs);
    // Peringatan: warna, ikon, dan garis putus-putus (bukan hanya warna); denyut diatur di CSS.
    const warn = secs <= WARNING_SECS && game.started;
    els.stat.classList.toggle('is-warning', warn);
    els.timeIcon.textContent = warn ? '⚠️' : '⏳';
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

  // ---------- Countdown ----------
  function startTimer() {
    if (rafId || game.running) return;   // tidak pernah ada dua loop sekaligus
    game.endAt = performance.now() + game.remainingMs;
    game.running = true;
    rafId = requestAnimationFrame(tick);
  }

  // Hentikan loop dan simpan sisa waktu saat ini.
  function stopTimer() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (game.running) game.remainingMs = Math.max(0, game.endAt - performance.now());
    game.running = false;
  }

  function tick() {
    rafId = 0;
    if (!game.running || game.done) return;

    const left = game.endAt - performance.now();
    const secs = secondsLeft(left);
    // Teks hanya diubah saat detik berganti.
    if (secs !== game.shownSecs) {
      renderTime(secs);
      if (secs <= ANNOUNCE_SECS && !game.said30) {
        game.said30 = true;
        announce(`Tersisa ${secs} detik.`);
      }
      if (secs <= WARNING_SECS && !game.said10) {
        game.said10 = true;
        announce(`Tersisa ${secs} detik!`);
      }
    }
    if (left <= 0) {
      timeUp();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  // Jeda saat tab disembunyikan atau pemain pindah aplikasi, lanjut saat kembali.
  function pauseTimer() {
    if (!game || !game.running) return;
    stopTimer();
  }

  function resumeTimer() {
    if (!game || game.done || !game.started || game.running) return;
    startTimer();
  }

  // ---------- Game flow ----------
  function restart() {
    if (game) stopTimer();
    clearTimeout(mismatchTimer);
    clearTimeout(winTimer);
    mismatchTimer = winTimer = 0;
    if (els.win.open) els.win.close();
    if (els.over.open) els.over.close();

    game = newGame(parseSize(els.size.value));
    applyLayout();
    renderBoard();
    renderStats();
    renderBest();
    renderProgress();
    announce(`Game baru, ${game.size.a} kali ${game.size.b}, ${game.size.pairs} pasangan. Waktu ${DURATION_SECS} detik.`);
  }

  function flip(i) {
    const card = game.cards[i];
    if (game.locked || game.done || card.state !== 'closed') return;

    if (!game.started) {
      game.started = true;
      startTimer();
    }

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
      // Semua pasangan ditemukan = menang, prioritas di atas waktu habis.
      if (game.matched === game.size.pairs) finish();
      return;
    }

    game.locked = true;
    announce(`Tidak cocok: ${game.cards[j].name} dan ${card.name}.`);
    const pair = [j, i].map((k) => els.board.children[k]);
    pair.forEach((el) => el.classList.add('is-wrong'));
    mismatchTimer = setTimeout(() => {
      mismatchTimer = 0;
      card.state = game.cards[j].state = 'closed';
      paintCard(i);
      paintCard(j);
      pair.forEach((el) => el.classList.remove('is-wrong'));
      game.locked = false;
    }, MISMATCH_DELAY);
  }

  function saveBest(remaining) {
    const all = readBestAll();
    const prev = readBest(game.size.key);
    const record = {
      moves: !prev || game.moves < prev.moves,
      time: !prev || remaining > prev.remaining,
      first: !prev,
    };
    all[game.size.key] = {
      moves: record.moves ? game.moves : prev.moves,
      remaining: record.time ? remaining : prev.remaining,
    };
    storage.set(BEST_KEY, all);
    return record;
  }

  // Satu pintu untuk membuka modal: tidak pernah ada dua modal sekaligus, fokus ke tombol utama.
  function openModal(dialog, focusEl) {
    [els.win, els.over].forEach((d) => { if (d !== dialog && d.open) d.close(); });
    if (!dialog.open) dialog.showModal();
    focusEl.focus();
  }

  function finish() {
    if (game.done) return;
    game.done = true;
    game.locked = true;
    stopTimer();
    const remaining = secondsLeft(game.remainingMs);
    renderTime(remaining);
    game.cards.forEach((_, i) => paintCard(i));
    const record = saveBest(remaining);
    renderBest();

    els.winMoves.textContent = game.moves;
    els.winTime.textContent = formatSeconds(remaining);
    const notes = [];
    if (record.moves) notes.push('langkah');
    if (record.time) notes.push('sisa waktu');
    els.winRecord.hidden = notes.length === 0;
    els.winRecord.textContent = record.first
      ? 'Skor pertamamu untuk ukuran ini tersimpan!'
      : `Rekor baru: ${notes.join(' & ')} terbaik!`;

    announce(`Menang! Selesai dalam ${game.moves} langkah, sisa waktu ${formatSeconds(remaining)}.`);
    winTimer = setTimeout(() => openModal(els.win, els.again), WIN_DELAY);
  }

  function timeUp() {
    if (game.done) return;
    // Pertahanan ganda: jika semua pasangan sudah ditemukan, itu kemenangan.
    if (game.matched === game.size.pairs) {
      finish();
      return;
    }
    game.done = true;
    game.locked = true;
    game.remainingMs = 0;
    stopTimer();

    // Batalkan pengecekan yang tertunda dan tutup kartu yang masih terbuka (belum dicek).
    clearTimeout(mismatchTimer);
    mismatchTimer = 0;
    game.first = -1;
    game.cards.forEach((c) => { if (c.state === 'open') c.state = 'closed'; });
    game.cards.forEach((_, i) => {
      els.board.children[i].classList.remove('is-wrong');
      paintCard(i);
    });

    renderStats();
    const total = game.size.pairs;
    els.overSummary.textContent = `Waktu habis! Kamu menemukan ${game.matched} dari ${total} pasangan.`;
    els.overPairs.textContent = `${game.matched}/${total}`;
    els.overMoves.textContent = game.moves;
    announce(`Game Over. Waktu habis. ${game.matched} dari ${total} pasangan ditemukan dalam ${game.moves} langkah.`);
    openModal(els.over, els.retry);
  }

  // Jaga fokus Tab/Shift+Tab tetap di dalam modal.
  function trapFocus(dialog) {
    dialog.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active) || (e.shiftKey && active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    });
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

  [els.again, els.retry].forEach((btn) => {
    btn.addEventListener('click', () => {
      restart();
      els.board.querySelector('.card')?.focus();
    });
  });

  [els.win, els.over].forEach(trapFocus);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseTimer();
    else resumeTimer();
  });

  portrait.addEventListener('change', applyLayout);

  // ---------- Init ----------
  const saved = storage.get(SIZE_KEY);
  if (saved && [...els.size.options].some((o) => o.value === saved)) {
    els.size.value = saved;
  }
  restart();
})();
