// Fake Supabase Realtime for tests: tabs in the same browser share a BroadcastChannel bus.
(function () {
  const bus = new BroadcastChannel('mock-rt');
  const chans = new Set();
  bus.onmessage = e => chans.forEach(c => c._in(e.data));
  function channel(topic, opts) {
    const key = opts.config.presence.key;
    const state = {}; // key -> {s}
    const H = { sync: [], join: [], bc: {} };
    let mine = null, subbed = false;
    const c = {
      on(type, filter, cb) { if (type === 'presence') (filter.event === 'join' ? H.join : H.sync).push(cb); else (H.bc[filter.event] = H.bc[filter.event] || []).push(cb); return c; },
      subscribe(cb) {
        chans.add(c); subbed = true;
        setTimeout(() => { bus.postMessage({ t: topic, k: 'hello', from: key }); cb('SUBSCRIBED'); }, 30);
        return c;
      },
      track(s) { mine = s; state[key] = [s]; bus.postMessage({ t: topic, k: 'track', from: key, s }); fire(); return Promise.resolve('ok'); },
      send(m) { bus.postMessage({ t: topic, k: 'bc', from: key, ev: m.event, payload: m.payload }); return Promise.resolve('ok'); },
      presenceState() { return state; },
      _in(m) {
        if (m.t !== topic || m.from === key || !subbed) return;
        if (m.k === 'hello') { if (mine) bus.postMessage({ t: topic, k: 'track', from: key, s: mine }); }
        else if (m.k === 'track') { const isNew = !state[m.from]; state[m.from] = [m.s]; if (isNew) H.join.forEach(f => f({ key: m.from })); fire(); }
        else if (m.k === 'leave') { delete state[m.from]; fire(); }
        else if (m.k === 'bc') (H.bc[m.ev] || []).forEach(f => f({ payload: m.payload }));
      },
      _leave() { subbed = false; chans.delete(c); bus.postMessage({ t: topic, k: 'leave', from: key }); }
    };
    function fire() { setTimeout(() => H.sync.forEach(f => f()), 5); }
    addEventListener('pagehide', () => c._leave());
    return c;
  }
  window.supabase = { createClient: () => ({ channel, removeChannel: c => { c._leave(); return Promise.resolve('ok'); } }) };
})();
