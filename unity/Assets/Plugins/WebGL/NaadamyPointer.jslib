// The first-person view in the web build: Esc in a browser frees a locked mouse without the game ever seeing the key,
// and Unity keeps asking for the lock again on the next click. FirstPerson.cs asks here who really has the mouse.
mergeInto(LibraryManager.library, {
  /** 1: the game has the mouse; 0: the page has it back while it still has focus (Esc); -1: the page lost focus. */
  NaadamyPointerLock: function () {
    if (document.pointerLockElement) return 1;
    return document.hasFocus() ? 0 : -1;
  },
});
