/* Motor de ajedrez de AjedrezKiro: reglas completas + IA sencilla. */
(function (root) {
  'use strict';

  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const R = (i) => i >> 3;
  const C = (i) => i & 7;
  const N_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const K_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BISH_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const other = (c) => (c === 'w' ? 'b' : 'w');

  // Tablero: 64 casillas, 0 = a8 ... 63 = h1. Pieza = 'wP', 'bK', ...
  function initState() {
    const b = Array(64).fill(null);
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      b[c] = 'b' + back[c];
      b[8 + c] = 'bP';
      b[48 + c] = 'wP';
      b[56 + c] = 'w' + back[c];
    }
    return { b, turn: 'w', cast: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: -1, half: 0 };
  }

  function fromFEN(f) {
    const [pl, t, ca, ep, hm] = f.split(' ');
    const b = Array(64).fill(null);
    let i = 0;
    for (const ch of pl) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) { i += +ch; continue; }
      b[i++] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
    }
    return {
      b, turn: t,
      cast: { wK: ca.includes('K') ? 1 : 0, wQ: ca.includes('Q') ? 1 : 0, bK: ca.includes('k') ? 1 : 0, bQ: ca.includes('q') ? 1 : 0 },
      ep: ep && ep !== '-' ? (8 - +ep[1]) * 8 + (ep.charCodeAt(0) - 97) : -1,
      half: +hm || 0,
    };
  }

  function kingSq(b, col) { return b.indexOf(col + 'K'); }

  // ¿La casilla sq está atacada por el color "by"?
  function attacked(b, sq, by) {
    const r = R(sq), c = C(sq);
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) {
      const cc = c + dc;
      if (inB(pr, cc) && b[pr * 8 + cc] === by + 'P') return true;
    }
    for (const [dr, dc] of N_D) {
      const rr = r + dr, cc = c + dc;
      if (inB(rr, cc) && b[rr * 8 + cc] === by + 'N') return true;
    }
    for (const [dr, dc] of K_D) {
      const rr = r + dr, cc = c + dc;
      if (inB(rr, cc) && b[rr * 8 + cc] === by + 'K') return true;
    }
    for (const [dr, dc] of ROOK_D) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc)) {
        const q = b[rr * 8 + cc];
        if (q) { if (q === by + 'R' || q === by + 'Q') return true; break; }
        rr += dr; cc += dc;
      }
    }
    for (const [dr, dc] of BISH_D) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc)) {
        const q = b[rr * 8 + cc];
        if (q) { if (q === by + 'B' || q === by + 'Q') return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  }

  function inCheck(s) { return attacked(s.b, kingSq(s.b, s.turn), other(s.turn)); }

  // Movimientos sin comprobar si dejan al rey en jaque.
  function pseudo(s, sq) {
    const b = s.b, p = b[sq];
    if (!p || p[0] !== s.turn) return [];
    const col = p[0], t = p[1], opp = other(col), r = R(sq), c = C(sq), out = [];
    const add = (to, f) => out.push({ from: sq, to, f });

    if (t === 'P') {
      const d = col === 'w' ? -1 : 1, start = col === 'w' ? 6 : 1, last = col === 'w' ? 0 : 7;
      const r1 = r + d;
      if (inB(r1, c) && !b[r1 * 8 + c]) {
        add(r1 * 8 + c, r1 === last ? 'promo' : '');
        if (r === start && !b[(r + 2 * d) * 8 + c]) add((r + 2 * d) * 8 + c, 'dbl');
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (!inB(r1, cc)) continue;
        const to = r1 * 8 + cc;
        if (b[to] && b[to][0] === opp) add(to, r1 === last ? 'promo' : '');
        else if (to === s.ep) add(to, 'ep');
      }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of (t === 'N' ? N_D : K_D)) {
        const rr = r + dr, cc = c + dc;
        if (!inB(rr, cc)) continue;
        const q = b[rr * 8 + cc];
        if (!q || q[0] === opp) add(rr * 8 + cc, '');
      }
      if (t === 'K') {
        const row = col === 'w' ? 7 : 0, e = row * 8 + 4;
        if (sq === e && !attacked(b, e, opp)) {
          if (s.cast[col + 'K'] && b[row * 8 + 7] === col + 'R' && !b[e + 1] && !b[e + 2] &&
              !attacked(b, e + 1, opp) && !attacked(b, e + 2, opp)) add(e + 2, 'cK');
          if (s.cast[col + 'Q'] && b[row * 8] === col + 'R' && !b[e - 1] && !b[e - 2] && !b[e - 3] &&
              !attacked(b, e - 1, opp) && !attacked(b, e - 2, opp)) add(e - 2, 'cQ');
        }
      }
    } else {
      const dirs = t === 'R' ? ROOK_D : t === 'B' ? BISH_D : ROOK_D.concat(BISH_D);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inB(rr, cc)) {
          const to = rr * 8 + cc, q = b[to];
          if (!q) add(to, '');
          else { if (q[0] === opp) add(to, ''); break; }
          rr += dr; cc += dc;
        }
      }
    }
    return out;
  }

  function apply(s, m, promo) {
    const b = s.b.slice(), p = b[m.from], col = p[0];
    const cast = Object.assign({}, s.cast);
    let ep = -1, half = s.half + 1;
    if (b[m.to] || p[1] === 'P') half = 0;
    b[m.to] = p; b[m.from] = null;
    if (m.f === 'ep') b[R(m.from) * 8 + C(m.to)] = null;
    if (m.f === 'promo') b[m.to] = col + (promo || 'Q');
    if (m.f === 'dbl') ep = (m.from + m.to) / 2;
    if (m.f === 'cK') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
    if (m.f === 'cQ') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
    if (p[1] === 'K') { cast[col + 'K'] = 0; cast[col + 'Q'] = 0; }
    for (const q of [m.from, m.to]) {
      if (q === 63) cast.wK = 0;
      if (q === 56) cast.wQ = 0;
      if (q === 7) cast.bK = 0;
      if (q === 0) cast.bQ = 0;
    }
    return { b, turn: other(col), cast, ep, half };
  }

  function legal(s, sq) {
    const me = s.turn, opp = other(me);
    return pseudo(s, sq).filter((m) => {
      const ns = apply(s, m, 'Q');
      return !attacked(ns.b, kingSq(ns.b, me), opp);
    });
  }

  function allLegal(s) {
    const out = [];
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (p && p[0] === s.turn) for (const m of legal(s, i)) out.push(m);
    }
    return out;
  }

  function insufficient(s) {
    const rest = s.b.filter((p) => p && p[1] !== 'K');
    if (rest.length === 0) return true;
    if (rest.length === 1 && (rest[0][1] === 'B' || rest[0][1] === 'N')) return true;
    return false;
  }

  // 'ok' | 'check' | 'mate' | 'stalemate' | 'fifty' | 'insufficient'
  function status(s) {
    const ms = allLegal(s), chk = inCheck(s);
    if (!ms.length) return chk ? 'mate' : 'stalemate';
    if (s.half >= 100) return 'fifty';
    if (insufficient(s)) return 'insufficient';
    return chk ? 'check' : 'ok';
  }

  // ---- IA ----
  function evalS(s) {
    let sc = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p) continue;
      const t = p[1], r = R(i), c = C(i);
      const cen = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));
      let v = VAL[t];
      if (t === 'N' || t === 'B') v += cen * 8;
      if (t === 'P') v += (p[0] === 'w' ? 6 - r : r - 1) * 6 + cen * 2;
      sc += p[0] === 'w' ? v : -v;
    }
    return s.turn === 'w' ? sc : -sc;
  }

  function ordered(s) {
    const ms = allLegal(s);
    const score = (m) => (s.b[m.to] ? VAL[s.b[m.to][1]] * 10 - VAL[s.b[m.from][1]] : 0) + (m.f === 'promo' ? 800 : 0);
    return ms.sort((a, b) => score(b) - score(a));
  }

  function search(s, d, a, b) {
    if (d === 0) return evalS(s);
    const ms = ordered(s);
    if (!ms.length) return inCheck(s) ? -99999 - d : 0;
    let best = -Infinity;
    for (const m of ms) {
      const sc = -search(apply(s, m, 'Q'), d - 1, -b, -a);
      if (sc > best) best = sc;
      if (sc > a) a = sc;
      if (a >= b) break;
    }
    return best;
  }

  // level: 1 fácil, 2 normal, 3 difícil
  function bestMove(s, level) {
    const ms = ordered(s);
    if (!ms.length) return null;
    const depth = level || 2;
    const noise = depth === 1 ? 60 : 4;
    let best = null, bestSc = -Infinity;
    for (const m of ms) {
      const sc = -search(apply(s, m, 'Q'), depth - 1, -Infinity, Infinity) + Math.random() * noise;
      if (sc > bestSc) { bestSc = sc; best = m; }
    }
    return best;
  }

  function perft(s, d) {
    if (d === 0) return 1;
    let n = 0;
    for (const m of allLegal(s)) {
      if (m.f === 'promo') for (const p of ['Q', 'R', 'B', 'N']) n += perft(apply(s, m, p), d - 1);
      else n += perft(apply(s, m), d - 1);
    }
    return n;
  }

  root.Chess = { initState, fromFEN, pseudo, legal, allLegal, apply, attacked, inCheck, kingSq, status, bestMove, perft, other, VAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Chess;
})(typeof window !== 'undefined' ? window : globalThis);
