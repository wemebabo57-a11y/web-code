(function (global) {
  'use strict';

  const K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;

  const CHAR_MAP = { k: K, a: A, b: B, n: N, r: R, c: C, p: P };

  const PIECE_NAMES = {
    1: '帅', 2: '仕', 3: '相', 4: '马', 5: '车', 6: '炮', 7: '兵',
    9: '将', 10: '士', 11: '象', 12: '马', 13: '车', 14: '炮', 15: '卒'
  };

  const VAL = [0, 10000, 200, 200, 400, 900, 450, 100];

  const INIT_ROWS = [
    "rnbakabnr",
    ".........",
    ".c.....c.",
    "p.p.p.p.p",
    ".........",
    ".........",
    "P.P.P.P.P",
    ".C.....C.",
    ".........",
    "RNBAKABNR"
  ];

  const COLS = 'abcdefghi';

  const MAX_DEPTH         = 3;
  const SEARCH_TIME_LIMIT = 4000;

  const typeOf = p => (p < 8 ? p : p - 8);

  function createBoard() {
    const bd = new Int8Array(90);
    for (let y = 0; y < 10; y++) {
      const row = INIT_ROWS[y];
      for (let x = 0; x < 9; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const base = CHAR_MAP[ch.toLowerCase()];
        bd[y * 9 + x] = (ch === ch.toUpperCase()) ? base : base + 8;
      }
    }
    return bd;
  }

  function canLand(bd, to, red) {
    const q = bd[to];
    return !q || (q < 8) !== red;
  }

  function makeMove(bd, from, to) {
    const cap = bd[to];
    bd[to] = bd[from];
    bd[from] = 0;
    return cap;
  }

  function unmakeMove(bd, from, to, cap) {
    bd[from] = bd[to];
    bd[to] = cap;
  }

  function genPseudoMoves(bd, side) {
    const moves = [];
    const red = side === 0;
    for (let i = 0; i < 90; i++) {
      const p = bd[i];
      if (!p) continue;
      if (red !== (p < 8)) continue;
      const x = i % 9, y = (i / 9) | 0;
      switch (p < 8 ? p : p - 8) {
        case K: genKing(bd, moves, x, y, red);     break;
        case A: genAdvisor(bd, moves, x, y, red);  break;
        case B: genElephant(bd, moves, x, y, red); break;
        case N: genKnight(bd, moves, x, y, red);   break;
        case R: genRook(bd, moves, x, y, red);     break;
        case C: genCannon(bd, moves, x, y, red);   break;
        case P: genPawn(bd, moves, x, y, red);     break;
      }
    }
    return moves;
  }

  function genKing(bd, mv, x, y, red) {
    const from = y * 9 + x;
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 3 || nx > 5) continue;
      if (red) { if (ny < 7 || ny > 9) continue; }
      else     { if (ny < 0 || ny > 2) continue; }
      const to = ny * 9 + nx;
      if (canLand(bd, to, red)) mv.push({ from, to, score: 0 });
    }
  }

  function genAdvisor(bd, mv, x, y, red) {
    const from = y * 9 + x;
    for (const [dx, dy] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 3 || nx > 5) continue;
      if (red) { if (ny < 7 || ny > 9) continue; }
      else     { if (ny < 0 || ny > 2) continue; }
      const to = ny * 9 + nx;
      if (canLand(bd, to, red)) mv.push({ from, to, score: 0 });
    }
  }

  function genElephant(bd, mv, x, y, red) {
    const from = y * 9 + x;
    for (const [dx, dy] of [[-2,-2],[-2,2],[2,-2],[2,2]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx > 8 || ny < 0 || ny > 9) continue;
      if (red) { if (ny < 5) continue; }
      else     { if (ny > 4) continue; }
      if (bd[(y + dy / 2) * 9 + (x + dx / 2)]) continue;
      const to = ny * 9 + nx;
      if (canLand(bd, to, red)) mv.push({ from, to, score: 0 });
    }
  }

  function genKnight(bd, mv, x, y, red) {
    const from = y * 9 + x;
    const combos = [
      [ 1, 2, 0, 1], [-1, 2, 0, 1], [ 1,-2, 0,-1], [-1,-2, 0,-1],
      [ 2, 1, 1, 0], [ 2,-1, 1, 0], [-2, 1,-1, 0], [-2,-1,-1, 0]
    ];
    for (const [dx, dy, lx, ly] of combos) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx > 8 || ny < 0 || ny > 9) continue;
      if (bd[(y + ly) * 9 + (x + lx)]) continue;
      const to = ny * 9 + nx;
      if (canLand(bd, to, red)) mv.push({ from, to, score: 0 });
    }
  }

  function genRook(bd, mv, x, y, red) {
    const from = y * 9 + x;
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      let nx = x + dx, ny = y + dy;
      while (nx >= 0 && nx < 9 && ny >= 0 && ny < 10) {
        const to = ny * 9 + nx, q = bd[to];
        if (!q) mv.push({ from, to, score: 0 });
        else {
          if ((q < 8) !== red) mv.push({ from, to, score: 0 });
          break;
        }
        nx += dx; ny += dy;
      }
    }
  }

  function genCannon(bd, mv, x, y, red) {
    const from = y * 9 + x;
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      let nx = x + dx, ny = y + dy, jumped = false;
      while (nx >= 0 && nx < 9 && ny >= 0 && ny < 10) {
        const to = ny * 9 + nx, q = bd[to];
        if (!jumped) {
          if (!q) mv.push({ from, to, score: 0 });
          else jumped = true;
        } else if (q) {
          if ((q < 8) !== red) mv.push({ from, to, score: 0 });
          break;
        }
        nx += dx; ny += dy;
      }
    }
  }

  function genPawn(bd, mv, x, y, red) {
    const from = y * 9 + x;
    const ny = y + (red ? -1 : 1);
    if (ny >= 0 && ny < 10) {
      const to = ny * 9 + x;
      if (canLand(bd, to, red)) mv.push({ from, to, score: 0 });
    }
    const crossed = red ? (y <= 4) : (y >= 5);
    if (crossed) {
      for (const dx of [-1, 1]) {
        const nx = x + dx;
        if (nx < 0 || nx > 8) continue;
        const to = y * 9 + nx;
        if (canLand(bd, to, red)) mv.push({ from, to, score: 0 });
      }
    }
  }

  function inCheckAt(bd, kp, side) {
    if (kp < 0) return true;
    const kx = kp % 9, ky = (kp / 9) | 0;
    const off = (side === 0) ? 8 : 0;
    const eR = R + off, eC = C + off, eN = N + off, eK = K + off, eP = P + off;

    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      let x = kx + dx, y = ky + dy, blocked = 0;
      while (x >= 0 && x < 9 && y >= 0 && y < 10) {
        const p = bd[y * 9 + x];
        if (p) {
          if (blocked === 0) {
            if (p === eR) return true;
            if (dy !== 0 && p === eK) return true;
            blocked = 1;
          } else {
            if (p === eC) return true;
            break;
          }
        }
        x += dx; y += dy;
      }
    }

    for (const [dx, dy] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) {
      const nx = kx + dx, ny = ky + dy;
      if (nx < 0 || nx > 8 || ny < 0 || ny > 9) continue;
      if (bd[ny * 9 + nx] !== eN) continue;
      let lx, ly;
      if (Math.abs(dx) === 2) { lx = nx + (dx > 0 ? -1 : 1); ly = ny; }
      else                    { lx = nx; ly = ny + (dy > 0 ? -1 : 1); }
      if (!bd[ly * 9 + lx]) return true;
    }

    if (side === 0) {
      if (ky - 1 >= 0 && bd[(ky - 1) * 9 + kx] === eP) return true;
      if (ky >= 5) {
        if (kx > 0 && bd[ky * 9 + kx - 1] === eP) return true;
        if (kx < 8 && bd[ky * 9 + kx + 1] === eP) return true;
      }
    } else {
      if (ky + 1 < 10 && bd[(ky + 1) * 9 + kx] === eP) return true;
      if (ky <= 4) {
        if (kx > 0 && bd[ky * 9 + kx - 1] === eP) return true;
        if (kx < 8 && bd[ky * 9 + kx + 1] === eP) return true;
      }
    }
    return false;
  }

  function genLegalMoves(bd, side) {
    const pseudo = genPseudoMoves(bd, side);
    const kingCode = side === 0 ? K : K + 8;
    let ks = -1;
    for (let i = 0; i < 90; i++) if (bd[i] === kingCode) { ks = i; break; }
    if (ks < 0) return [];

    const legal = [];
    for (let i = 0; i < pseudo.length; i++) {
      const m = pseudo[i];
      const cap = makeMove(bd, m.from, m.to);
      const kk = (m.from === ks) ? m.to : ks;
      if (!inCheckAt(bd, kk, side)) legal.push(m);
      unmakeMove(bd, m.from, m.to, cap);
    }
    return legal;
  }

  function evalFor(bd, side) {
    let s = 0;
    for (let i = 0; i < 90; i++) {
      const p = bd[i];
      if (!p) continue;
      const red = p < 8;
      const t = red ? p : p - 8;
      const x = i % 9, y = (i / 9) | 0;
      let v = VAL[t];
      const ry = red ? y : 9 - y;
      if (t === P) {
        if (ry <= 4) {
          v += 60 + (4 - ry) * 25;
          if (x === 4) v += 20; else if (x === 3 || x === 5) v += 10;
        }
      } else if (t === N || t === C) {
        if (x >= 2 && x <= 6 && ry >= 2 && ry <= 7) v += 12;
      } else if (t === R) {
        if (ry <= 4) v += 10;
      }
      s += red ? v : -v;
    }
    return side === 0 ? s : -s;
  }

  let nodes = 0;
  let searchDeadline = 0;
  let searchTimedOut = false;
  let prunedCount = 0;

  const aiSearchInfo = { depth: 0, time: 0, redScore: 0, nodes: 0 };

  function orderMoves(bd, moves) {
    for (const m of moves) {
      const cap = bd[m.to];
      m.score = cap ? VAL[typeOf(cap)] * 10 - VAL[typeOf(bd[m.from])] : 0;
    }
    moves.sort((a, b) => b.score - a.score);
  }

  function negamax(bd, side, depth, alpha, beta, ply) {
    if (((++nodes) & 1023) === 0 && performance.now() > searchDeadline) {
      searchTimedOut = true;
    }
    if (searchTimedOut) return 0;
    if (depth <= 0) return evalFor(bd, side);

    const moves = genLegalMoves(bd, side);
    if (moves.length === 0) return -30000 + ply;

    orderMoves(bd, moves);
    let best = -Infinity;
    for (const m of moves) {
      const cap = makeMove(bd, m.from, m.to);
      const sc = -negamax(bd, 1 - side, depth - 1, -beta, -alpha, ply + 1);
      unmakeMove(bd, m.from, m.to, cap);
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) { prunedCount++; break; }
    }
    return best;
  }

  function findBestMove(bd, side, maxDepth) {
    searchDeadline = performance.now() + SEARCH_TIME_LIMIT;
    searchTimedOut = false;
    nodes = 0;
    prunedCount = 0;

    aiSearchInfo.depth = 0;
    aiSearchInfo.time = 0;
    aiSearchInfo.redScore = 0;
    aiSearchInfo.nodes = 0;

    const startTime = performance.now();

    const moves = genLegalMoves(bd, side);
    if (moves.length === 0) return null;
    orderMoves(bd, moves);

    let scored = moves.map(m => ({ move: m, score: -Infinity }));
    let completedDepth = 0;
    let completedScore = 0;

    for (let d = 1; d <= maxDepth; d++) {
      const cur = [];
      let aborted = false;

      for (const m of moves) {
        const cap = makeMove(bd, m.from, m.to);
        const sc = -negamax(bd, 1 - side, d - 1, -Infinity, Infinity, 1);
        unmakeMove(bd, m.from, m.to, cap);
        if (searchTimedOut) { aborted = true; break; }
        cur.push({ move: m, score: sc });
      }

      if (aborted) {
        if (cur.length > 0) {
          const done = new Set(cur.map(x => x.move));
          for (const s of scored) if (!done.has(s.move)) cur.push(s);
          scored = cur;
        }
        break;
      }

      scored = cur;
      scored.sort((a, b) => b.score - a.score);
      for (let i = 0; i < moves.length; i++) moves[i] = scored[i].move;

      completedDepth = d;
      completedScore = scored[0].score;

      if (scored[0].score > 20000 || scored[0].score < -20000) break;
    }

    scored.sort((a, b) => b.score - a.score);

    aiSearchInfo.depth = completedDepth;
    aiSearchInfo.time = performance.now() - startTime;
    aiSearchInfo.nodes = nodes;
    aiSearchInfo.redScore = (side === 0) ? completedScore : -completedScore;

    if (scored[0].score === -Infinity) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    return scored[0].move;
  }

  function coordOf(sq) {
    const x = sq % 9, y = (sq / 9) | 0;
    return COLS[x] + (9 - y);
  }

  function moveToText(bd, from, to) {
    const piece = bd[from];
    if (!piece) return '—';
    return `${PIECE_NAMES[piece]} ${coordOf(from)}→${coordOf(to)}`;
  }

  function positionKey(bd, side) {
    return side + '|' + bd.join(',');
  }

  global.XQ = {
    K, A, B, N, R, C, P,
    PIECE_NAMES,
    MAX_DEPTH,
    createBoard,
    makeMove,
    unmakeMove,
    genLegalMoves,
    inCheckAt,
    evalFor,
    findBestMove,
    coordOf,
    moveToText,
    positionKey,
    aiSearchInfo
  };

})(window);