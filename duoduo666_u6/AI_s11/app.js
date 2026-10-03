(function () {
  'use strict';

  const {
    K, PIECE_NAMES, MAX_DEPTH,
    createBoard, genLegalMoves, inCheckAt,
    findBestMove, positionKey
  } = XQ;

  const ANIM_DURATION = 220;
  const TOAST_DURATION = 1400;

  let board, turn, selected, targets, lastMove, gameOver, thinking, history;
  let playerColor = 0;
  let animState = null;
  let positionHistory = new Map();

  const undoBtn = document.getElementById('undo');
  const sideSel = document.getElementById('sideSel');

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  const CELL = 60, MARGIN = 36;
  const LOGICAL_W = MARGIN * 2 + 8 * CELL;
  const LOGICAL_H = MARGIN * 2 + 9 * CELL;

  let flipped = false;

  (function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = LOGICAL_W * dpr;
    canvas.height = LOGICAL_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  })();

  const px = x => MARGIN + (flipped ? 8 - x : x) * CELL;
  const py = y => MARGIN + (flipped ? 9 - y : y) * CELL;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function drawBoardBg() {
    const g = ctx.createLinearGradient(0, 0, LOGICAL_W, LOGICAL_H);
    g.addColorStop(0,   '#f7e5c0');
    g.addColorStop(0.5, '#efd6a5');
    g.addColorStop(1,   '#e4c489');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.strokeStyle = 'rgba(169,118,61,.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(MARGIN - 14, MARGIN - 14, 8 * CELL + 28, 9 * CELL + 28);

    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';

    for (let y = 0; y < 10; y++) {
      ctx.beginPath();
      ctx.moveTo(px(0), py(y));
      ctx.lineTo(px(8), py(y));
      ctx.stroke();
    }
    for (let x = 0; x < 9; x++) {
      ctx.beginPath();
      if (x === 0 || x === 8) {
        ctx.moveTo(px(x), py(0));
        ctx.lineTo(px(x), py(9));
      } else {
        ctx.moveTo(px(x), py(0));
        ctx.lineTo(px(x), py(4));
        ctx.moveTo(px(x), py(5));
        ctx.lineTo(px(x), py(9));
      }
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(px(3), py(0)); ctx.lineTo(px(5), py(2));
    ctx.moveTo(px(5), py(0)); ctx.lineTo(px(3), py(2));
    ctx.moveTo(px(3), py(7)); ctx.lineTo(px(5), py(9));
    ctx.moveTo(px(5), py(7)); ctx.lineTo(px(3), py(9));
    ctx.stroke();

    ctx.fillStyle = 'rgba(138,90,43,.8)';
    ctx.font = '26px "KaiTi","STKaiti","Kaiti SC",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚  河', px(2), py(4.5));
    ctx.fillText('漢  界', px(6), py(4.5));
  }

  function drawPiece(x, y, code, selected, alpha) {
    const cx = px(x), cy = py(y);
    const r = CELL * 0.45;
    const red = code < 8;

    const a = (alpha === undefined) ? 1 : alpha;
    if (a <= 0.01) return;
    ctx.globalAlpha = a;

    ctx.beginPath();
    ctx.arc(cx + 2, cy + 3, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60,30,0,.28)';
    ctx.fill();

    const g = ctx.createRadialGradient(cx - r * .38, cy - r * .42, r * .12, cx, cy, r);
    g.addColorStop(0,    '#fffaf0');
    g.addColorStop(0.65, '#f6e2bb');
    g.addColorStop(1,    '#d9b880');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = red ? '#b3342a' : '#2e2e2e';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = red ? '#b3342a' : '#262626';
    ctx.font = `bold ${Math.round(r * 1.05)}px "KaiTi","STKaiti","Kaiti SC",serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PIECE_NAMES[code], cx, cy + 1);

    if (selected) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(40,150,255,.95)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawBoardBg();

    if (lastMove) {
      for (const sq of [lastMove.from, lastMove.to]) {
        const x = sq % 9, y = (sq / 9) | 0;
        ctx.beginPath();
        ctx.arc(px(x), py(y), CELL * 0.47, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,170,40,.85)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    const now = performance.now();

    for (let i = 0; i < 90; i++) {
      if (animState && i === animState.from) continue;
      const p = board[i];
      if (!p) continue;

      let alpha = 1;
      if (animState && i === animState.to && animState.cap) {
        const t = Math.min(1, (now - animState.startTime) / animState.duration);
        alpha = Math.max(0, 1 - t * 1.6);
      }
      drawPiece(i % 9, (i / 9) | 0, p, i === selected, alpha);
    }

    if (animState) {
      const t = Math.min(1, (now - animState.startTime) / animState.duration);
      const e = easeInOutCubic(t);
      const fx = animState.from % 9, fy = (animState.from / 9) | 0;
      const tx = animState.to % 9,   ty = (animState.to / 9) | 0;
      const cx = fx + (tx - fx) * e;
      const cy = fy + (ty - fy) * e;

      ctx.beginPath();
      ctx.arc(px(cx), py(cy), CELL * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,216,155,.18)';
      ctx.fill();

      drawPiece(cx, cy, animState.piece, false, 1);
    }

    for (const t of targets) {
      const x = t % 9, y = (t / 9) | 0;
      if (board[t]) {
        ctx.beginPath();
        ctx.arc(px(x), py(y), CELL * 0.47, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(230,50,50,.85)';
        ctx.lineWidth = 3.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(px(x), py(y), 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30,120,220,.5)';
        ctx.fill();
      }
    }

    if (!gameOver) {
      const kc = turn === 0 ? K : K + 8;
      let ks = -1;
      for (let i = 0; i < 90; i++) if (board[i] === kc) { ks = i; break; }
      if (ks >= 0 && inCheckAt(board, ks, turn)) {
        const x = ks % 9, y = (ks / 9) | 0;
        ctx.beginPath();
        ctx.arc(px(x), py(y), CELL * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,40,40,.95)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
  }

  const toastContainer = document.getElementById('toastContainer');

  function showToast(text, level) {
    if (!toastContainer) return;
    const type = level || 'info';

    while (toastContainer.children.length >= 3) {
      toastContainer.removeChild(toastContainer.firstChild);
    }

    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = text;
    toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));

    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, TOAST_DURATION);
  }

  function isPlayerPiece(p) {
    if (!p) return false;
    return (p < 8) === (playerColor === 0);
  }

  function applyMove(from, to) {
    const piece = board[from];
    const cap = board[to];

    animState = {
      from, to, piece, cap,
      startTime: performance.now(),
      duration: ANIM_DURATION
    };
    board[from] = 0;

    requestAnimationFrame(function step() {
      if (!animState) return;
      const elapsed = performance.now() - animState.startTime;
      const t = Math.min(1, elapsed / animState.duration);
      if (t >= 1) {
        board[animState.to] = animState.piece;
        const st = animState;
        animState = null;
        commitMove(st.from, st.to, st.piece, st.cap);
        return;
      }
      draw();
      requestAnimationFrame(step);
    });
  }

  function commitMove(from, to, piece, cap) {
    history.push({ from, to, cap });
    lastMove = { from, to };
    selected = -1;
    targets = [];
    turn = 1 - turn;
    draw();

    if (checkEnd()) return;
    if (checkRepetition()) return;

    undoBtn.disabled = history.length === 0;

    if (turn !== playerColor) scheduleAI();
  }

  function checkEnd() {
    const moves = genLegalMoves(board, turn);
    if (moves.length === 0) {
      gameOver = true;
      const winner = turn === 0 ? '黑方' : '红方';
      const isPlayerWin = (turn !== playerColor);
      showToast(`绝杀 · ${winner}胜`, isPlayerWin ? 'success' : 'error');
      return true;
    }

    let count = 0;
    for (let i = 0; i < 90; i++) if (board[i]) count++;
    if (count <= 2) {
      gameOver = true;
      showToast('和棋', 'warn');
      return true;
    }
    return false;
  }

  function checkRepetition() {
    if (gameOver) return false;

    const key = positionKey(board, turn);
    const cnt = (positionHistory.get(key) || 0) + 1;
    positionHistory.set(key, cnt);
    if (cnt < 3) return false;

    gameOver = true;
    showToast('判和', 'warn');
    return true;
  }

  function scheduleAI() {
    if (gameOver) return;

    thinking = true;
    undoBtn.disabled = true;

    setTimeout(() => {
      const aiSide = turn;
      const m = findBestMove(board, aiSide, MAX_DEPTH);
      thinking = false;

      if (!m) { checkEnd(); return; }

      const desc = XQ.moveToText(board, m.from, m.to);

      applyMove(m.from, m.to);

      setTimeout(() => {
        if (!gameOver) showToast(`AI ${desc}`, 'info');
      }, ANIM_DURATION + 30);
    }, 40);
  }

  function newGame() {
    animState = null;
    board = createBoard();
    playerColor = sideSel.value === 'black' ? 1 : 0;
    flipped = playerColor === 1;
    turn = 0;
    selected = -1;
    targets = [];
    lastMove = null;
    gameOver = false;
    thinking = false;
    history = [];

    positionHistory = new Map();
    positionHistory.set(positionKey(board, 0), 1);

    undoBtn.disabled = true;
    draw();

    showToast(`新对局 · 你执${playerColor === 0 ? '红' : '黑'}`, 'info');

    if (turn !== playerColor) scheduleAI();
  }

  function doUndo() {
    if (thinking || animState || history.length === 0) return;

    while (history.length) {
      const h = history.pop();
      board[h.from] = board[h.to];
      board[h.to] = h.cap;
      turn = 1 - turn;
      if (turn === playerColor) break;
    }

    gameOver = false;
    selected = -1;
    targets = [];
    lastMove = null;

    positionHistory = new Map();
    positionHistory.set(positionKey(board, turn), 1);
    draw();

    if (turn !== playerColor) {
      scheduleAI();
    } else {
      undoBtn.disabled = history.length === 0;
      showToast('已悔棋', 'info');
    }
  }

  function eventToSquare(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  * LOGICAL_W;
    const cy = (e.clientY - rect.top)  / rect.height * LOGICAL_H;

    let gx = Math.round((cx - MARGIN) / CELL);
    let gy = Math.round((cy - MARGIN) / CELL);
    if (flipped) { gx = 8 - gx; gy = 9 - gy; }
    if (gx < 0 || gx > 8 || gy < 0 || gy > 9) return -1;

    const dx = cx - px(gx), dy = cy - py(gy);
    if (Math.hypot(dx, dy) > CELL * 0.62) return -1;
    return gy * 9 + gx;
  }

  canvas.addEventListener('click', e => {
    if (gameOver || thinking || animState || turn !== playerColor) return;

    const sq = eventToSquare(e);
    if (sq < 0) return;

    if (selected >= 0 && targets.includes(sq)) {
      applyMove(selected, sq);
      return;
    }

    if (isPlayerPiece(board[sq])) {
      selected = sq;
      targets = genLegalMoves(board, playerColor)
        .filter(m => m.from === sq)
        .map(m => m.to);
      draw();
      if (targets.length === 0) showToast('无处可走', 'warn');
      return;
    }

    selected = -1;
    targets = [];
    draw();
  });

  document.getElementById('restart').addEventListener('click', () => {
    if (thinking) return;
    newGame();
  });

  undoBtn.addEventListener('click', doUndo);

  sideSel.addEventListener('change', () => {
    if (thinking || animState) return;
    newGame();
  });

  const sidebar         = document.getElementById('sidebar');
  const sidebarOverlay  = document.getElementById('sidebarOverlay');
  const aboutBtn        = document.getElementById('aboutBtn');
  const closeSidebarBtn = document.getElementById('closeSidebar');

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  }

  aboutBtn.addEventListener('click', openSidebar);
  closeSidebarBtn.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
  });

  newGame();

})();