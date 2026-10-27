// What only the browser knows. The first-person view: Esc in a browser frees a locked mouse without the game ever seeing
// the key, and Unity keeps asking for the lock again on the next click, so FirstPerson.cs asks here who has the mouse.
// The layout: screen pixels per CSS pixel, so the game's units match the web version's sizes (GameUI.cs).
mergeInto(LibraryManager.library, {
  /** 1: the game has the mouse; 0: the page has it back while it still has focus (Esc); -1: the page lost focus. */
  NaadamyPointerLock: function () {
    if (document.pointerLockElement) return 1;
    return document.hasFocus() ? 0 : -1;
  },
  /** The page's devicePixelRatio, capped at 2 like the canvas (WebGLTemplates/Naadamy/index.html). */
  NaadamyDpr: function () { return Math.min(window.devicePixelRatio || 1, 2); },
});
