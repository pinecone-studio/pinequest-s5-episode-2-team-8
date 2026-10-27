// What only the browser knows. The first-person view: Esc in a browser frees a locked mouse without the game ever seeing
// the key, and Unity keeps asking for the lock again on the next click, so FirstPerson.cs asks here who has the mouse.
// The layout: screen pixels per CSS pixel, so the game's units match the web version's sizes (GameUI.cs), and how far a
// wheel or trackpad really scrolled.
mergeInto(LibraryManager.library, {
  /** 1: the game has the mouse; 0: the page has it back while it still has focus (Esc); -1: the page lost focus. */
  NaadamyPointerLock: function () {
    if (document.pointerLockElement) return 1;
    return document.hasFocus() ? 0 : -1;
  },
  /** How far the wheel or trackpad scrolled since the last call, in CSS pixels (Unity only says which way, one step per event). */
  NaadamyWheel: function () {
    var w = window.naadamyWheel;
    if (!w) {
      w = window.naadamyWheel = { acc: 0 };
      window.addEventListener('wheel', function (e) { w.acc += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1); }, { passive: true, capture: true });
    }
    var v = w.acc; w.acc = 0; return v;
  },
  /** The page's devicePixelRatio, capped at 2 like the canvas (WebGLTemplates/Naadamy/index.html). */
  NaadamyDpr: function () { return Math.min(window.devicePixelRatio || 1, 2); },
});
