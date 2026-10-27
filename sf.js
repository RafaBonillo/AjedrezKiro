/* Puente con Stockfish (Web Worker). Si no carga, el juego usa el motor básico. */
(function (root) {
  'use strict';

  const SF = { ready: false, name: '' };
  let worker = null, cur = null, chain = Promise.resolve();

  function spawn(url) {
    return new Promise((resolve, reject) => {
      let w;
      try { w = new Worker(url); } catch (e) { reject(e); return; }
      const timer = setTimeout(() => { w.terminate(); reject(new Error('timeout')); }, 10000);
      w.onerror = (e) => { clearTimeout(timer); w.terminate(); reject(e); };
      w.onmessage = (ev) => {
        const line = String(ev.data);
        if (line === 'uciok') w.postMessage('isready');
        else if (line === 'readyok') { clearTimeout(timer); resolve(w); }
      };
      w.postMessage('uci');
    });
  }

  function onMsg(ev) {
    const line = String(ev.data);
    if (!cur) return;
    if (line.startsWith('info')) {
      const m = /score (cp|mate) (-?\d+)/.exec(line);
      if (m && !/(lower|upper)bound/.test(line)) cur.score = { type: m[1], v: +m[2] };
    } else if (line.startsWith('bestmove')) {
      const job = cur;
      cur = null;
      clearTimeout(job.timer);
      const best = line.split(/\s+/)[1];
      job.resolve({
        best: best === '(none)' ? null : best,
        cp: job.score && job.score.type === 'cp' ? job.score.v : null,
        mate: job.score && job.score.type === 'mate' ? job.score.v : null,
      });
    }
  }

  // Devuelve true si Stockfish quedó listo.
  SF.init = async function () {
    const base = new URL('stockfish/', location.href).href;
    const tries = [
      [base + 'stockfish.js#' + base + 'stockfish.wasm', 'Stockfish 10 (WASM)'],
      [base + 'stockfish.asm.js', 'Stockfish 10 (JS)'],
    ];
    for (const [url, name] of tries) {
      try {
        worker = await spawn(url);
        worker.onmessage = onMsg;
        worker.onerror = () => { SF.ready = false; };
        SF.ready = true;
        SF.name = name;
        return true;
      } catch (e) { /* prueba la siguiente */ }
    }
    SF.ready = false;
    return false;
  };

  // moves: lista de jugadas UCI desde la posición inicial. opts: { skill 0-20, movetime ms }
  SF.search = function (moves, opts) {
    const run = () => new Promise((resolve, reject) => {
      if (!SF.ready) { reject(new Error('sin-stockfish')); return; }
      const job = { resolve, score: null };
      job.timer = setTimeout(() => {
        if (cur === job) { cur = null; SF.ready = false; reject(new Error('timeout')); }
      }, opts.movetime + 8000);
      cur = job;
      worker.postMessage('setoption name Skill Level value ' + (opts.skill == null ? 20 : opts.skill));
      worker.postMessage('position startpos' + (moves.length ? ' moves ' + moves.join(' ') : ''));
      worker.postMessage('go movetime ' + opts.movetime);
    });
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  };

  root.SF = SF;
})(window);
