// Playing together in the web build: the browser's own WebSocket. A browser runs no threads, so Net.cs can't use
// System.Net.WebSockets there; instead it opens the socket here and, every frame, reads the state and takes the messages.
mergeInto(LibraryManager.library, {
  NaadamyWsOpen: function (urlPtr) {
    var url = UTF8ToString(urlPtr), old = window.naadamyWs;
    if (old) { old.onopen = old.onmessage = old.onclose = old.onerror = null; try { old.close(); } catch (e) {} }
    var s = window.naadamyWsState = { inbox: [], state: 0 }; // 0 connecting, 1 open, 2 closed
    try {
      var ws = window.naadamyWs = new WebSocket(url);
      ws.onopen = function () { s.state = 1; };
      ws.onmessage = function (e) { if (typeof e.data === 'string') s.inbox.push(e.data); };
      ws.onclose = ws.onerror = function () { s.state = 2; };
    } catch (e) { s.state = 2; } // e.g. a ws:// address on an https page
  },
  NaadamyWsState: function () { var s = window.naadamyWsState; return s ? s.state : 2; },
  NaadamyWsSend: function (msgPtr) { var ws = window.naadamyWs; if (ws && ws.readyState === 1) ws.send(UTF8ToString(msgPtr)); },
  /** The next message, or null; the string is handed to C#, which frees it. */
  NaadamyWsPoll: function () {
    var s = window.naadamyWsState; if (!s || !s.inbox.length) return null;
    var str = s.inbox.shift(), size = lengthBytesUTF8(str) + 1, buf = _malloc(size);
    stringToUTF8(str, buf, size); return buf;
  },
  NaadamyWsClose: function () {
    var ws = window.naadamyWs; window.naadamyWs = null; window.naadamyWsState = null;
    if (ws) { ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(1000, 'bye'); } catch (e) {} }
  },
});
