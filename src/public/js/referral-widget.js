'use strict';

(() => {
  const widget = document.getElementById('referral-widget');
  if (!widget || typeof socket === 'undefined') return;

  socket.on('new-referral', (data) => {
    const span = document.getElementById('referral');
    const cusName = document.getElementById('ref-customer');

    if (span) {
      span.innerText = data.total_interactions || 0;

      if (cusName) cusName.innerText = data.fbname || "Khách hàng mới";

      widget.classList.add('bump');
      setTimeout(() => widget.classList.remove('bump'), 500);
    }
  });

  widget.querySelector('.close-btn').addEventListener('click', () => {
    widget.style.display = 'none';
  });

  dragElement(widget);

  function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    elmnt.onmousedown = dragMouseDown;
    elmnt.ontouchstart = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      var clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
      var clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

      pos3 = clientX;
      pos4 = clientY;

      if (e.type === "mousedown") {
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      } else if (e.type === "touchstart") {
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDrag;
      }
    }

    function elementDrag(e) {
      e = e || window.event;

      var clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
      var clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

      pos1 = pos3 - clientX;
      pos2 = pos4 - clientY;
      pos3 = clientX;
      pos4 = clientY;

      let newTop = elmnt.offsetTop - pos2;
      let newLeft = elmnt.offsetLeft - pos1;

      if (newTop < 0) newTop = 0;
      if (newLeft < 0) newLeft = 0;
      if (newTop > window.innerHeight - elmnt.offsetHeight) newTop = window.innerHeight - elmnt.offsetHeight;
      if (newLeft > window.innerWidth - elmnt.offsetWidth) newLeft = window.innerWidth - elmnt.offsetWidth;

      elmnt.style.top = newTop + "px";
      elmnt.style.left = newLeft + "px";
      elmnt.style.right = "auto";
      elmnt.style.transform = "none";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
      document.ontouchend = null;
      document.ontouchmove = null;
    }
  }
})();
