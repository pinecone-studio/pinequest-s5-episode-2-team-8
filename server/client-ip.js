'use strict';
const net = require('node:net');
/* Which address a request comes from, for the per-address limits (family login, Basar's AI). On Render the socket is the
   proxy, so it reads the proxy's headers there: Cloudflare (in front of Render) sets cf-connecting-ip to the real address and
   overwrites any the browser sent; else the last x-forwarded-for entry, the one the proxy added (the browser can fake the
   ones before it). Anywhere else (a home network) those headers are not trusted, since anyone could send them.
   An IPv6 address counts as its /64: one home gets a whole /64 and could otherwise use a new address for every request. */
const BEHIND_PROXY = !!process.env.RENDER;
function bucket(ip) {
  if (!ip.includes(':') || /^::ffff:\d/i.test(ip)) return ip; // IPv4, also when written as IPv6
  const [head, tail = ''] = ip.toLowerCase().split('::'), h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
  const all = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return all.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
module.exports = function clientIp(req) {
  if (BEHIND_PROXY) {
    const cf = String(req.headers['cf-connecting-ip'] || '').trim();
    if (net.isIP(cf)) return bucket(cf);
    const f = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (f.length && net.isIP(f[f.length - 1])) return bucket(f[f.length - 1]);
  }
  return bucket((req.socket && req.socket.remoteAddress) || '?');
};
