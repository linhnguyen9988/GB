'use strict';

const GBChatScroll = (() => {
  function create({ box, messageList, getVersion, isActive, canLoad, loadHistory }) {
    let followingLatest = true;
    function setFollowingLatest(value) {
      followingLatest = value;
      box.classList.toggle('chat-following-latest', value);
    }
    let previousScrollTop = 0;
    let readingAnchor = null;
    let touchScrolling = false;
    let touchGesture = null;
    let touchLoadTimer;

    function clearReadingAnchor() {
      readingAnchor = null;
      box.classList.remove('chat-anchoring-history');
    }

    function resetTouchGesture() {
      clearTimeout(touchLoadTimer);
      touchGesture = null;
    }

    function queueTouchHistory() {
      const gesture = touchGesture;
      clearTimeout(touchLoadTimer);
      if (!gesture?.ended || !gesture.towardHistory || followingLatest ||
          !canLoad() || box.scrollTop > 8) return;

      const version = getVersion();
      touchLoadTimer = setTimeout(() => {
        if (!isActive(version) || touchGesture !== gesture || box.scrollTop > 8) return;
        resetTouchGesture();
        void loadHistory();
      }, 140);
    }

    function keepLatestInView() {
      if (followingLatest && isActive(getVersion())) {
          box.scrollTop = box.scrollHeight;
        previousScrollTop = box.scrollTop;
      }
    }

    function restoreReadingAnchor() {
      if (!readingAnchor) return;
      if (!readingAnchor.row.isConnected) {
        clearReadingAnchor();
        return;
      }
      const offset = readingAnchor.row.getBoundingClientRect().top - box.getBoundingClientRect().top;
      const delta = offset - readingAnchor.offset;
      if (Math.abs(delta) < 1) return;
      box.scrollTop = box.scrollTop + delta;
      previousScrollTop = box.scrollTop;
    }

    // Keep delayed media above the viewport from moving the visible message on Safari.
    const resizeObserver = new ResizeObserver(() => {
      if (!isActive(getVersion())) return;
      if (followingLatest) keepLatestInView();
      else restoreReadingAnchor();
    });
    resizeObserver.observe(messageList);
    resizeObserver.observe(box);

    function insertOlderMessages(fragment) {
      const top = box.getBoundingClientRect().top;
      const anchor = !followingLatest && Array.from(messageList.children)
        .find(row => row.getBoundingClientRect().bottom > top);
      if (anchor) {
        readingAnchor = { row: anchor, offset: anchor.getBoundingClientRect().top - top };
        box.classList.add('chat-anchoring-history');
      }

      messageList.prepend(fragment);
      restoreReadingAnchor();
      keepLatestInView();
    }

    box.addEventListener('touchstart', event => {
      touchScrolling = true;
      resetTouchGesture();
      clearReadingAnchor();
      if (event.touches.length !== 1) return;
      const { clientX, clientY } = event.touches[0];
      touchGesture = { clientX, clientY, towardHistory: false, ended: false };
    }, { passive: true });

    box.addEventListener('touchmove', event => {
      if (!touchGesture || event.touches.length !== 1) return;
      const { clientX, clientY } = event.touches[0];
      const dy = clientY - touchGesture.clientY;
      const dx = clientX - touchGesture.clientX;
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) touchGesture.towardHistory = dy > 0;
    }, { passive: true });

    box.addEventListener('touchend', () => {
      if (!touchGesture) return;
      touchGesture.ended = true;
      queueTouchHistory();
    }, { passive: true });
    box.addEventListener('touchcancel', resetTouchGesture, { passive: true });
    box.addEventListener('wheel', () => {
      touchScrolling = false;
      resetTouchGesture();
      clearReadingAnchor();
    }, { passive: true });

    box.addEventListener('scroll', () => {
      const top = box.scrollTop;
      const oldTop = previousScrollTop;
      if (readingAnchor && Math.abs(top - oldTop) >= 1) clearReadingAnchor();
      const atBottom = box.scrollHeight - box.clientHeight - top <= 4;
      // Growing media changes the distance to the bottom without an upward scroll.
      if (atBottom) {
        setFollowingLatest(true);
        clearReadingAnchor();
      } else if (top < oldTop) setFollowingLatest(false);

      previousScrollTop = top;
      if (followingLatest && !atBottom) keepLatestInView();

      if (touchScrolling) queueTouchHistory();
      else if (!followingLatest && canLoad() && top <= 8 && oldTop > 8) void loadHistory();
    }, { passive: true });

    function reset() {
      resetTouchGesture();
      touchScrolling = false;
      clearReadingAnchor();
      setFollowingLatest(true);
      previousScrollTop = box.scrollTop;
    }

    return { reset, stopFollowing: () => setFollowingLatest(false), resetTouchGesture,
      keepLatestInView, restoreReadingAnchor, insertOlderMessages };
  }

  return { create };
})();
