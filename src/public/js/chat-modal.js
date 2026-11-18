'use strict';

(() => {
  if (typeof socket === 'undefined') return;

  let currentPageID = null;
  let currentCustomerId = null;
  let currentImageFile = null;
  let customerNameEl = null;
  let customerAvatarEl = null;
  let messageInput = null;
  let imagePreviewContainer = null;
  let messageModal = null;
  let messageModalEl = null;
  let modalMessagesContainer = null;
  let chatState = {
    isFetchingMessages: false,
    hasMoreMessages: true,
    beforeId: null,
    pageSize: 10
  };
  let loadMoreMessages = null;
  let openQuotedContext = null;
  let switchOpenConversation;
  const GlobalPageID = "223266991771270";
  const GlobalPageID2 = '102116919355833';
  const PAGE_IDS = [GlobalPageID, GlobalPageID2];
  let lastOrderEl = null;
  let loadMoreBtn = null;
  let chatScroll;
  let conversationVersion = 0;
  function isActiveChat(version) {
    return version === conversationVersion && messageModalEl?.classList.contains('show');
  }

  function findRowByMsgId(msgId) {
    if (!msgId || !modalMessagesContainer) return null;
    const direct = modalMessagesContainer.querySelector(`[data-msg-id="${CSS.escape(String(msgId))}"]`);
    const local = messengerIds.get(String(msgId));
    return (local ? modalMessagesContainer.querySelector(`[data-local-id="${CSS.escape(local)}"]`) : null) || direct;
  }

  function updateMessageReactions(mid, reactions) {
    const row = findRowByMsgId(mid);
    if (!row) return;
    const wrapper = row.querySelector('.message-content-wrapper');
    if (!wrapper) return;

    const old = wrapper.querySelector('.message-reactions-container');
    if (old) old.remove();

    const html = GBChatMessageView.buildReactionsHtml(reactions);
    if (!html) return;

    const anchor = wrapper.querySelector('.message-status-time-wrapper');
    if (anchor) anchor.insertAdjacentHTML('beforebegin', html);
    else wrapper.insertAdjacentHTML('beforeend', html);

    const pill = wrapper.querySelector('.message-reactions-container');
    if (pill) pill.classList.add('reaction-pop');
  }

  socket.on('reaction', (data) => {
    if (data && Array.isArray(data.reactions)) {
      updateMessageReactions(data.mid, data.reactions);
    }
  });

  function scrollToRowAndHighlight(row) {
    chatScroll?.stopFollowing();
    const box = modalMessagesContainer;
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: top - (box.clientHeight - row.offsetHeight) / 2, behavior: 'smooth' });
    row.classList.add('message-row-highlight');
    setTimeout(() => row.classList.remove('message-row-highlight'), 1500);
  }

  async function jumpToQuotedMessage(mid, quoteEl) {
    if (!mid) return;
    let targetRow = findRowByMsgId(mid);
    if (targetRow) {
      scrollToRowAndHighlight(targetRow);
      return;
    }
    await openQuotedContext?.(mid, quoteEl);
  }

  const messengerIds = new Map();
  const knownLocalMessages = new Set();
  const renderingMids = new Set();
  const renderingLocals = new Set();
  function registerLocalMessage(id) {
    knownLocalMessages.add(id);
    if (knownLocalMessages.size > 2000) knownLocalMessages.delete(knownLocalMessages.values().next().value);
  }
  function linkMessengerId(mid, localId) {
    if (!mid || !localId || !knownLocalMessages.has(localId)) return false;
    const duplicates = modalMessagesContainer?.querySelectorAll(`[data-msg-id="${CSS.escape(String(mid))}"]`) || [];
    const own = modalMessagesContainer && modalMessagesContainer.querySelector(`[data-local-id="${CSS.escape(localId)}"]`);
    if (!own && !renderingLocals.has(localId)) return false;
    // An echo may already have rendered while the HTTP response was in flight.
    for (const duplicate of duplicates) {
      if (duplicate !== own) duplicate.remove();
    }
    messengerIds.set(String(mid), localId);
    if (messengerIds.size > 4000) messengerIds.delete(messengerIds.keys().next().value);
    return true;
  }
  function reconcileSendResponse(localId, data) {
    (data.messageIds || []).forEach(mid => linkMessengerId(mid, localId));
  }

  const PendingMessages = GBChatDelivery.createPendingStore(window.CURRENT_USER_ID);
  PendingMessages.purgeExpired();

  const pendingImageFiles = new Map();

  const retryingIds = new Set();

  let orderConfirmationDraft = false;
  window.openMessageModalAndPaste = function (customerId, customerName, pageId, orderConfirmation = false) {
    if (!messageModal || !customerId) {
      console.error('Lỗi: Modal hoặc ID khách hàng chưa được khởi tạo.');
      return;
    }
    currentPageID = pageId;
    currentCustomerId = customerId;
    const careInbox = document.getElementById('care-chat-inbox');
    if (careInbox) {
      careInbox.classList.toggle('d-none', careInbox.dataset.customerId !== String(customerId) || careInbox.dataset.pageId !== String(pageId));
    }
    orderConfirmationDraft = orderConfirmation;
    customerNameEl.textContent = customerName || 'Khách hàng';
    customerAvatarEl.src = `/images/ava/${customerId}.jpg`;

    messageInput.value = window.copiedText || '';
    window.copiedText = '';
    currentImageFile = null;
    imagePreviewContainer.style.display = 'none';

    if (messageModalEl.classList.contains('show')) switchOpenConversation();
    else messageModal.show();
    messageInput.dispatchEvent(new Event('input'));
  };
  const activeBlobUrls = [];

  function createAndTrackBlobUrl(blob) {
    const url = URL.createObjectURL(blob);
    activeBlobUrls.push(url);
    return url;
  }

  function revokeAllBlobs() {
    activeBlobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    activeBlobUrls.length = 0;
  }

  document.addEventListener('DOMContentLoaded', function () {
    modalMessagesContainer = document.querySelector('.messages-container-messenger');
    customerNameEl = document.getElementById('customer-name');
    customerAvatarEl = document.getElementById('customer-avatar');
    messageInput = document.getElementById('message-input');
    imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const sendMessageButton = document.getElementById('send-message-button');
    messageModalEl = document.getElementById('message-modal');
    if (!messageModalEl || !modalMessagesContainer) return;
    lastOrderEl = document.getElementById('last-order-info');
    if (sendMessageButton) {
      sendMessageButton.addEventListener('click', sendMessage);
    }

    messageModal = new bootstrap.Modal(messageModalEl);

    const customerDetailButtons = messageModalEl.querySelectorAll('[data-message-customer-details]');
    let loadingCustomerDetails = false;
    async function openMessageCustomerDetails(event) {
      const customerId = currentCustomerId;
      if (!customerId || loadingCustomerDetails) return;
      const trigger = event.currentTarget;
      loadingCustomerDetails = true;
      try {
        const response = await fetch('/api/customers/by-userid/' + encodeURIComponent(customerId));
        if (currentCustomerId !== customerId || !messageModalEl.classList.contains('show')) return;
        if (response.status === 404) {
          ShowCenterToast('warning', 'Khách này chưa có hồ sơ trong GB.', 4000);
          return;
        }
        if (!response.ok) throw new Error('Không tải được hồ sơ');
        const customer = await response.json();
        if (currentCustomerId !== customerId || !messageModalEl.classList.contains('show')) return;
        ShowCustomerDetails({
          name: customer.fbname || customerNameEl.textContent,
          userid: customerId,
          realfbid: customer.realfbid,
          phone: customer.phone,
          diachi: customer.diachi,
          note: customer.note,
          label: customer.label,
          nn: customer.nuocngoai,
          trigger,
          onSaved: window.UpdateCommentCustomerRow
        });
      } catch (_) {
        if (currentCustomerId === customerId && messageModalEl.classList.contains('show')) {
          ShowCenterToast('danger', 'Không tải được thông tin khách hàng. Thử lại sau.', 4000);
        }
      } finally {
        loadingCustomerDetails = false;
      }
    }
    customerDetailButtons.forEach(button => button.addEventListener('click', openMessageCustomerDetails));

    const imageViewerModal = document.getElementById('image-viewer-modal');
    const fullSizeImage = document.getElementById('full-size-image');
    const imageViewerClose = document.querySelector('.image-viewer-close');

    function isMobile() {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      return /android|iphone|ipad|ipod|windows phone|iemobile|mobile/i.test(userAgent);
    }

    function showFullImage(src) {
      fullSizeImage.src = src;
      imageViewerModal.style.display = "flex";
    }

    if (imageViewerClose) {
      imageViewerClose.onclick = function () {
        imageViewerModal.style.display = "none";
      };
    }
    if (imageViewerModal) {
      imageViewerModal.onclick = function (event) {
        if (event.target !== fullSizeImage) {
          imageViewerModal.style.display = "none";
        }
      };
    }

    const { renderMessage } = GBChatMessageView.create({ customerAvatarEl, pageIds: PAGE_IDS, jumpToQuotedMessage });

    let quoteContext = null;
    const messengerReadThrough = new Map();

    function markMessengerRead(row) {
      const watermark = messengerReadThrough.get(row.dataset.sender);
      const timestamp = Number(row.dataset.sentAt);
      if (!watermark || !timestamp || timestamp > watermark ||
          !row.classList.contains('message-sent-messenger') || row.dataset.channel === 'zalo') return;
      const status = row.querySelector('.message-status-sent');
      if (!status) return;
      const avatar = document.createElement('img');
      avatar.src = customerAvatarEl.src;
      avatar.alt = 'Đã xem';
      avatar.className = 'avatar-seen';
      status.className = 'message-status-read';
      status.replaceChildren(avatar);
    }

    function closeQuotedContext() {
      if (!quoteContext) return;
      const { panel, trigger } = quoteContext;
      quoteContext = null;
      panel.remove();
      modalMessagesContainer.inert = false;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }

    openQuotedContext = async (mid, trigger) => {
      const version = conversationVersion;
      if (!isActiveChat(version)) return;
      const rootTrigger = quoteContext?.trigger || trigger;
      closeQuotedContext();
      const panel = document.createElement('section');
      panel.className = 'chat-quote-context bg-body';
      panel.setAttribute('aria-label', 'Tin nhắn được trích dẫn');
      panel.innerHTML = '<div class="d-flex align-items-center justify-content-between border-bottom px-3 py-2">' +
        '<span class="fw-semibold">Tin nhắn gốc</span>' +
        '<button type="button" class="btn-close" aria-label="Đóng"></button></div>' +
        '<div class="chat-quote-context-body p-3" aria-live="polite">Đang tải…</div>';
      const body = panel.querySelector('.chat-quote-context-body');
      const close = panel.querySelector('button');
      close.addEventListener('click', closeQuotedContext);
      body.addEventListener('click', event => {
        if (event.target.classList.contains('message-clickable')) showFullImage(event.target.src);
      });
      panel.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        closeQuotedContext();
      });
      quoteContext = { panel, trigger: rootTrigger };
      modalMessagesContainer.inert = true;
      modalMessagesContainer.parentElement.appendChild(panel);
      close.focus({ preventScroll: true });
      try {
        const query = new URLSearchParams({ around: mid });
        const response = await fetch(`/api/messages/${encodeURIComponent(currentCustomerId)}?${query}`, { cache: 'no-store' });
        if (quoteContext?.panel !== panel || !isActiveChat(version)) return;
        if (response.status === 404) {
          body.textContent = 'Không tìm thấy tin nhắn gốc.';
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const messages = await response.json();
        const rows = await Promise.all(messages.map(msg => renderMessage(msg, true)));
        if (quoteContext?.panel !== panel || !isActiveChat(version)) return;
        body.replaceChildren(...rows);
        const target = body.querySelector(`[data-msg-id="${CSS.escape(String(mid))}"]`);
        if (target) {
          target.classList.add('message-row-highlight');
          body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top;
        }
      } catch (_) {
        if (quoteContext?.panel === panel) body.textContent = 'Không tải được tin nhắn gốc.';
      }
    };

    const messageList = document.createElement('div');
    messageList.className = 'chat-message-list';
    chatScroll = GBChatScroll.create({
      box: modalMessagesContainer, messageList,
      getVersion: () => conversationVersion, isActive: isActiveChat,
      canLoad: () => Boolean(chatState.beforeId && chatState.hasMoreMessages && !chatState.isFetchingMessages),
      loadHistory: () => loadMoreMessages()
    });

    async function addMessageToContainer(msg) {
      const version = conversationVersion;
      const mid = msg.messid ? String(msg.messid) : null;
      const localId = msg.localId;
      if (!isActiveChat(version)) return null;
      if (mid && (findRowByMsgId(mid) || renderingMids.has(mid))) return findRowByMsgId(mid);
      if (localId && (findMessageRowByLocalId(localId) || renderingLocals.has(localId))) return null;
      if (mid) renderingMids.add(mid);
      if (localId) renderingLocals.add(localId);

      try {
        const showAvatar = messageList.lastElementChild?.dataset.sender !== String(msg.sender);
        const row = await renderMessage(msg, showAvatar);
        if (!isActiveChat(version)) return null;
        const existing = mid && findRowByMsgId(mid);
        if (existing) return existing;
        if (mid && renderingLocals.has(messengerIds.get(mid))) return null;
        markMessengerRead(row);
        messageList.appendChild(row);

        if (localId) {
          const status = document.createElement('div');
          status.className = 'message-status-icon-wrapper';
          status.dataset.status = 'sending';
          status.innerHTML = '<span class="message-status-icon message-status-sending"></span>';
          row.querySelector('.message-content-wrapper').appendChild(status);
        }

        chatScroll.keepLatestInView();
        return row;
      } finally {
        if (version === conversationVersion) {
          if (mid) renderingMids.delete(mid);
          if (localId) renderingLocals.delete(localId);
        }
      }
    }

    function findMessageRowByLocalId(localId) {
      return modalMessagesContainer.querySelector(`[data-local-id="${CSS.escape(localId)}"]`);
    }

    function setStatusIcon(row, status) {
      const wrapper = row && row.querySelector('.message-status-icon-wrapper');
      if (!wrapper) return;
      const icon = wrapper.querySelector('.message-status-icon');
      wrapper.style.display = '';
      wrapper.dataset.status = status;
      if (status === 'sending') {
        icon.className = 'message-status-icon message-status-sending';
        icon.innerHTML = '';
      } else if (status === 'sent') {
        icon.className = 'message-status-icon message-status-sentx';
        icon.innerHTML = `<i class="bi bi-check-circle-fill"></i>`;
      } else if (status === 'error') {
        icon.className = 'message-status-icon message-status-error';
        icon.innerHTML = `<i class="bi bi-x-circle-fill"></i>`;
      }
    }

    function showFailBadge(row, localId, reason) {
      if (!row) row = findMessageRowByLocalId(localId);
      if (!row) return;
      const wrapper = row.querySelector('.message-content-wrapper');
      if (!wrapper) return;
      const entry = PendingMessages.getPending(currentCustomerId, currentPageID).find(item => item.localId === localId);

      setStatusIcon(row, 'error');
      const statusIconWrapper = row.querySelector('.message-status-icon-wrapper');
      if (statusIconWrapper) statusIconWrapper.style.display = 'none';

      let badge = wrapper.querySelector('.message-fail-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'message-fail-badge';
        badge.innerHTML = `<i class="bi bi-exclamation-circle-fill"></i><span class="message-fail-reason"></span><i class="bi bi-arrow-clockwise"></i>`;
        badge.addEventListener('click', function () {
          if (badge.dataset.canRetry === 'true') retryPendingMessage(localId);
        });
        wrapper.appendChild(badge);
      }
      badge.querySelector('.message-fail-reason').textContent = reason || 'Gửi thất bại. Nhấn để gửi lại';
      badge.title = reason || 'Gửi thất bại. Nhấn để gửi lại';
      badge.style.display = 'flex';
      badge.dataset.canRetry = String(!entry?.uncertain);
      badge.lastElementChild.hidden = Boolean(entry?.uncertain);
      let retryZalo = wrapper.querySelector('.message-retry-zalo');
      if (!retryZalo) {
        retryZalo = document.createElement('button');
        retryZalo.type = 'button';
        retryZalo.className = 'message-retry-zalo btn btn-link btn-sm py-0 px-1';
        retryZalo.textContent = 'Thử lại bằng Zalo';
        retryZalo.addEventListener('click', () => retryPendingMessage(localId, 'zalo'));
        wrapper.appendChild(retryZalo);
      }
      const needsFile = Boolean(entry?.hasImage && !entry.imagePartSent);
      const canRetryZalo = entry && !entry.uncertain &&
        ((!entry.textPartSent && Boolean(entry.message)) || (needsFile && /^image\//.test(entry.fileType || '')));
      retryZalo.hidden = !canRetryZalo || Boolean(entry?.orderConfirmation);
      let replaceAttachment = wrapper.querySelector('.message-replace-attachment');
      if (!replaceAttachment) {
        replaceAttachment = document.createElement('button');
        replaceAttachment.type = 'button';
        replaceAttachment.className = 'message-replace-attachment btn btn-link btn-sm py-0 px-1';
        replaceAttachment.textContent = 'Chọn lại tệp';
        replaceAttachment.addEventListener('click', () => {
          const customerId = currentCustomerId;
          const pageId = currentPageID;
          const picker = document.createElement('input');
          picker.type = 'file';
          picker.accept = entry?.fileType || 'image/*,video/*,audio/*';
          picker.addEventListener('change', () => {
            const file = picker.files?.[0];
            const pending = PendingMessages.getPending(customerId, pageId).find(item => item.localId === localId);
            if (!file || !pending || pending.uncertain || customerId !== currentCustomerId || pageId !== currentPageID) return;
            pending.fileType = file.type;
            pendingImageFiles.set(localId, file);
            PendingMessages.save(customerId, pageId, pending);
            showFailBadge(row, localId, 'Đã chọn tệp. Bấm thử lại để gửi.');
          }, { once: true });
          picker.click();
        });
        wrapper.appendChild(replaceAttachment);
      }
      replaceAttachment.hidden = !needsFile || Boolean(entry?.uncertain) || pendingImageFiles.has(localId);
    }

    function hideFailBadge(row) {
      if (!row) return;
      const badge = row.querySelector('.message-fail-badge');
      if (badge) badge.style.display = 'none';
      const retryZalo = row.querySelector('.message-retry-zalo');
      if (retryZalo) retryZalo.hidden = true;
      const replaceAttachment = row.querySelector('.message-replace-attachment');
      if (replaceAttachment) replaceAttachment.hidden = true;
    }

    function loadPendingMessagesFromStorage() {
      if (!currentCustomerId) return;
      const pending = PendingMessages.getPending(currentCustomerId, currentPageID);
      pending.forEach(async (entry) => {
        if (findMessageRowByLocalId(entry.localId)) return;
        const imageFile = pendingImageFiles.get(entry.localId) || null;
        registerLocalMessage(entry.localId);
        const tempMessage = {
          sender: entry.pageId || currentPageID,
          message: entry.zaloTextSent ? null : (entry.message || null),
          image: imageFile && !entry.zaloImageSent ? createAndTrackBlobUrl(imageFile) : null,
          fileType: imageFile ? imageFile.type : null,
          time: entry.createdAt,
          timestamp: entry.createdAt,
          localId: entry.localId
        };
        const row = await addMessageToContainer(tempMessage);
        showFailBadge(row, entry.localId, entry.failReason);
      });
    }

    async function retryPendingMessage(localId, channel = 'facebook') {
      const customerId = currentCustomerId;
      const pageId = currentPageID;
      const entry = PendingMessages.getPending(customerId, pageId).find(item => item.localId === localId);
      if (entry && !entry.uncertain) await submitPendingMessage(customerId, entry.pageId || currentPageID, entry, channel);
    }

    function inConversation(customerId, pageId) {
      return String(currentCustomerId) === String(customerId) && String(currentPageID) === String(pageId) &&
        isActiveChat(conversationVersion);
    }

    function settlePending(customerId, pageId, entry) {
      PendingMessages.remove(customerId, pageId, entry.localId);
      pendingImageFiles.delete(entry.localId);
      if (!inConversation(customerId, pageId)) return;
      const row = findMessageRowByLocalId(entry.localId);
      hideFailBadge(row);
      if (entry.zaloImageSent) row?.querySelector('.message-images-container')?.remove();
      if (entry.zaloTextSent) row?.querySelector('.message-text-messenger')?.remove();
      if ((entry.zaloImageSent || entry.zaloTextSent) && !entry.facebookPartSent) row?.remove();
      else setStatusIcon(row, 'sent');
    }

    function updatePendingConfirmation({ customerId, pageId, localId, part, channel, mid }) {
      if (!localId || (part !== 'image' && part !== 'text')) return;
      const entry = PendingMessages.getPending(customerId, pageId).find(item => item.localId === localId);
      if (!entry) return;
      if (mid && inConversation(customerId, pageId)) linkMessengerId(mid, localId);
      GBChatDelivery.confirm(entry, part, channel);
      if (GBChatDelivery.complete(entry)) settlePending(customerId, pageId, entry);
      else PendingMessages.save(customerId, pageId, entry);
    }

    async function submitPendingMessage(customerId, pageId, entry, channel) {
      const { localId } = entry;
      if (retryingIds.has(localId)) return;
      const row = findMessageRowByLocalId(localId);
      const needsImage = entry.hasImage && !entry.imagePartSent;
      const savedFile = needsImage ? pendingImageFiles.get(localId) : null;
      const image = savedFile && (channel !== 'zalo' || /^image\//.test(savedFile.type)) ? savedFile : null;
      const text = entry.textPartSent ? '' : (entry.message || '');
      const attachmentNote = savedFile
        ? 'Zalo hỗ trợ chữ và ảnh. Có thể thử lại tệp này qua Messenger.'
        : 'Tệp đính kèm cần được chọn lại.';
      if (!text && !image) {
        showFailBadge(row, localId, needsImage ? attachmentNote : 'Không còn phần nào cần gửi lại.');
        return;
      }

      retryingIds.add(localId);
      hideFailBadge(row);
      setStatusIcon(row, 'sending');
      registerLocalMessage(localId);
      try {
        const data = await GBChatDelivery.send({ customerId, pageId, entry, channel, text, image });
        if (inConversation(customerId, pageId)) reconcileSendResponse(localId, data);
        const saved = PendingMessages.getPending(customerId, pageId).find(item => item.localId === localId);
        if (!saved) return;
        entry = saved;
        entry.imagePartSent ||= Boolean(data.imageSent && image);
        entry.textPartSent ||= Boolean(data.textSent && text);
        entry.facebookPartSent ||= Boolean(data.messageIds?.length);
        entry.zaloImageSent ||= Boolean(data.zaloImageSent);
        entry.zaloTextSent ||= Boolean(data.zaloTextSent);
        entry.uncertain = Boolean(data.uncertain);
        const currentRow = findMessageRowByLocalId(localId);
        if (entry.zaloImageSent) currentRow?.querySelector('.message-images-container')?.remove();
        if (entry.zaloTextSent) currentRow?.querySelector('.message-text-messenger')?.remove();
        if (GBChatDelivery.complete(entry)) {
          settlePending(customerId, pageId, entry);
        } else {
          entry.failReason = data.error || (data.success && needsImage && !image ? attachmentNote : 'Không thể gửi tin nhắn.');
          PendingMessages.save(customerId, pageId, entry);
          if (inConversation(customerId, pageId)) showFailBadge(currentRow, localId, entry.failReason);
        }
        if (data.zaloImageSent || data.zaloTextSent) void syncNewMessages();
      } catch (_) {
        const saved = PendingMessages.getPending(customerId, pageId).find(item => item.localId === localId);
        if (!saved) return;
        entry = saved;
        entry.failReason = 'Mất kết nối máy chủ. Chưa xác nhận được tin đã gửi.';
        entry.uncertain = true;
        PendingMessages.save(customerId, pageId, entry);
        if (inConversation(customerId, pageId)) showFailBadge(row, localId, entry.failReason);
      } finally {
        retryingIds.delete(localId);
      }
    }

    let syncHistory;
    let syncBusy = false;
    async function syncNewMessages() {
      const history = syncHistory;
      if (syncBusy || chatState.isFetchingMessages || !history || document.hidden || !messageModalEl.classList.contains('show')) return;
      syncBusy = true;
      try {
        const pending = new Map();
        let oldestPendingId = 0n;
        for (const row of modalMessagesContainer.querySelectorAll('.message-sent-messenger[data-channel="zalo"]')) {
          const status = row.querySelector('.message-status-sent');
          if (!status) continue;
          const id = row.dataset.messageId;
          if (!/^\d+$/.test(id || '')) continue;
          const numericId = BigInt(id);
          pending.set(id, status);
          if (!oldestPendingId || numericId < oldestPendingId) oldestPendingId = numericId;
        }
        const waiting = PendingMessages.getPending(history.customerId, history.pageId).slice(-20);
        const query = new URLSearchParams({
          afterId: String(history.cursor),
          zaloReadFromId: String(oldestPendingId),
          pageId: history.pageId,
          pending: waiting.map(entry => entry.localId).join(',')
        });
        const response = await fetch('/api/messages/' + encodeURIComponent(history.customerId) + '?' + query, { cache: 'no-store' });
        if (!response.ok || history !== syncHistory) return;
        const { messages, readIds, deliveries = [] } = await response.json();
        if (history !== syncHistory) return;
        const partStates = new Map();
        for (const result of deliveries) {
          const states = partStates.get(result.id) || {};
          states[result.part] = result.state;
          partStates.set(result.id, states);
          if (result.state === 'sent') {
            updatePendingConfirmation({ customerId: history.customerId, pageId: history.pageId,
              localId: result.id, part: result.part, channel: result.channel, mid: result.messid });
          }
        }
        for (const entry of PendingMessages.getPending(history.customerId, history.pageId)) {
          if (!entry.uncertain || retryingIds.has(entry.localId)) continue;
          const states = partStates.get(entry.localId);
          if (!states) continue;
          const missing = [];
          if (entry.hasImage && !entry.imagePartSent) missing.push('image');
          if (entry.message && !entry.textPartSent) missing.push('text');
          if (!missing.length || !missing.every(part => states[part] === 'failed')) continue;
          entry.uncertain = false;
          entry.failReason = 'Máy chủ xác nhận phần còn lại chưa gửi. Có thể thử lại.';
          PendingMessages.save(history.customerId, history.pageId, entry);
          showFailBadge(findMessageRowByLocalId(entry.localId), entry.localId, entry.failReason);
        }
        for (const id of readIds) {
          const status = pending.get(id);
          if (!status) continue;
          const avatar = document.createElement('img');
          avatar.src = customerAvatarEl.src;
          avatar.alt = 'Đã xem';
          avatar.className = 'avatar-seen';
          status.className = 'message-status-read';
          status.replaceChildren(avatar);
        }
        for (const msg of messages) {
          if (history !== syncHistory) break;
          await addMessageToContainer(msg);
          history.cursor = msg.history_cursor || msg.id;
        }
      } catch (_) {
        // The next poll retries.
      } finally {
        syncBusy = false;
      }
    }
    setInterval(syncNewMessages, 4000);
    socket.on('connect', syncNewMessages);
    document.addEventListener('visibilitychange', syncNewMessages);

    async function renderHistory(messages, version) {
      const fragment = document.createDocumentFragment();
      const seen = new Set();
      let previousSender;

      for (const msg of [...messages].reverse()) {
        if (!isActiveChat(version)) return;
        const mid = msg.messid ? String(msg.messid) : null;
        if (mid && (seen.has(mid) || findRowByMsgId(mid))) continue;
        if (mid) seen.add(mid);
        let row;
        try {
          row = await renderMessage(msg, previousSender !== msg.sender);
        } catch (error) {
          console.error('Lỗi hiển thị một tin nhắn trong lịch sử:', error);
          row = document.createElement('div');
          row.className = 'small text-body-secondary my-2';
          row.textContent = 'Không hiển thị được tin nhắn này.';
          if (mid) row.dataset.msgId = mid;
        }
        fragment.appendChild(row);
        previousSender = msg.sender;
      }
      if (!isActiveChat(version)) return;

      for (const row of Array.from(fragment.children)) {
        if (row.dataset.msgId && findRowByMsgId(row.dataset.msgId)) row.remove();
        else markMessengerRead(row);
      }
      chatScroll.insertOlderMessages(fragment);
    }

    async function fetchHistory(initial = false) {
      if (chatState.isFetchingMessages || !chatState.hasMoreMessages) return;
      const version = conversationVersion;
      const customerId = currentCustomerId;
      if (!isActiveChat(version)) return;

      chatState.isFetchingMessages = true;
      loadMoreBtn.disabled = true;
      loadMoreBtn.setAttribute('aria-busy', 'true');
      loadMoreBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Đang tải…';

      try {
        const before = initial || !chatState.beforeId ? '' : '&beforeId=' + encodeURIComponent(chatState.beforeId);
        const response = await fetch(`/api/messages/${encodeURIComponent(customerId)}?limit=${chatState.pageSize}${before}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const messages = await response.json();
        if (!isActiveChat(version)) return;
        await renderHistory(messages, version);
        if (!isActiveChat(version)) return;

        if (initial) syncHistory = { customerId, pageId: currentPageID, cursor: messages[0]?.history_cursor || messages[0]?.id || 0 };
        const oldest = messages.at(-1);
        if (oldest) chatState.beforeId = oldest.history_cursor || oldest.id;
        chatState.hasMoreMessages = messages.length === chatState.pageSize && Boolean(chatState.beforeId);
        loadMoreBtn.hidden = !chatState.hasMoreMessages;
        chatScroll.restoreReadingAnchor();
        chatScroll.keepLatestInView();
      } catch (error) {
        if (!isActiveChat(version)) return;
        console.error('Lỗi tải lịch sử tin nhắn:', error);
        loadMoreBtn.hidden = false;
        loadMoreBtn.textContent = 'Lỗi tải. Bấm để thử lại.';
        return;
      } finally {
        if (isActiveChat(version)) {
          chatState.isFetchingMessages = false;
          loadMoreBtn.disabled = false;
          loadMoreBtn.removeAttribute('aria-busy');
        }
      }
      if (isActiveChat(version)) loadMoreBtn.textContent = 'Tải tin nhắn cũ';
    }

    loadMoreMessages = () => fetchHistory(!chatState.beforeId);

    async function sendMessage() {
      const text = messageInput.value.trim();
      const image = currentImageFile;
      if (!text && !image) return;
      const customerId = currentCustomerId;
      const pageId = currentPageID;
      const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      registerLocalMessage(localId);
      const entry = {
        localId, pageId, message: text || null, hasImage: Boolean(image), fileType: image?.type, createdAt: Date.now(),
        orderConfirmation: Boolean(text) && (orderConfirmationDraft || /(?:^|\\n)\\s*Đơn hàng chị có\\s*:/iu.test(text.normalize('NFC')))
      };
      orderConfirmationDraft = false;
      messageInput.value = '';
      currentImageFile = null;
      imagePreviewContainer.style.display = 'none';
      autoResizeInput();
      if (image) pendingImageFiles.set(localId, image);
      PendingMessages.save(customerId, pageId, entry);

      const tempMessage = {
        sender: pageId, message: entry.message, image: image ? createAndTrackBlobUrl(image) : null, timestamp: entry.createdAt,
        fileType: image?.type, time: entry.createdAt, localId,
        sent_by_username: messageModalEl.dataset.chatUsername || null
      };
      // Insert the row before starting the request so an immediate failure can show its retry controls.
      try {
        await addMessageToContainer(tempMessage);
      } catch (error) {
        console.error('Lỗi hiển thị bản nháp vừa gửi:', error);
      }
      if (String(customerId) === String(currentCustomerId) && messageModalEl.classList.contains('show')) {
        messageInput.focus({ preventScroll: true });
      }
      await submitPendingMessage(customerId, pageId, entry, 'facebook');
    }

    async function fetchLastOrder(customerId) {
      const version = conversationVersion;
      try {
        const response = await fetch(`/getuserorder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userid: customerId, limit: 1 })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!isActiveChat(version)) return;
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          renderLastOrder(data.data[0]);
        } else {
          lastOrderEl.innerHTML = '<span class="last-order-no-info">Khách hàng chưa có đơn hàng nào.</span>';
        }
      } catch (error) {
        if (isActiveChat(version)) {
          console.error('Lỗi khi lấy đơn hàng cuối cùng:', error);
          lastOrderEl.innerHTML = '';
        }
      }
    }

    function renderLastOrder(order) {
      if (!order) {
        lastOrderEl.innerHTML = '<span class="last-order-no-info">Khách hàng chưa có đơn hàng nào.</span>';
        return;
      }
      const date = order.time ? new Date(order.time) : null;
      const savedDate = String(order.date || '').match(/\b(\d{1,2}\/\d{1,2}\/)\d{2}(\d{2})\b/);
      const orderDate = savedDate ? savedDate[1] + savedDate[2] : (
        date && Number.isFinite(date.getTime())
          ? date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: '2-digit' }) : ''
      );
      const status = GBOrderStatus.get(order.provider, order.statuscode, order.statustext);
      const cod = Number(order.cod || 0).toLocaleString('vi-VN') + ' đ';
      const kg = order.kg ? `${order.kg}KG` : 'N/A';

      const lastOrderHtml = `
            <div class="last-order-item">
                <a href="/journey/${encodeURIComponent(order.realorderid)}" class="text-reset text-decoration-none">
                  <span class="last-order-value">${gbEscapeText(orderDate)} - ${cod} - ${gbEscapeText(kg)} - <span class="badge gb-order-status text-bg-${status.color}">${gbEscapeText(status.label)}</span></span>
                </a>
            </div>
        `;
      lastOrderEl.innerHTML = lastOrderHtml;
      lastOrderEl.querySelector('a').addEventListener('click', event => {
        event.preventDefault();
        OrderJourney(order.realorderid, order.name, order.userid, order.phone);
      });
    }

    if (messageInput) {
      messageInput.addEventListener('input', autoResizeInput);
      messageInput.addEventListener('keydown', (event) => {
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter' && !event.shiftKey) {
          if (!isMobile()) {
            event.preventDefault();
            sendMessage();
          }
        }
      });
    }

    const btnTakePhoto = document.getElementById('btn-take-photo');
    const btnChooseFile = document.getElementById('btn-choose-file');
    const inputTakePhoto = document.getElementById('input-take-photo');
    const inputChooseFile = document.getElementById('input-choose-file');

    if (btnTakePhoto && !isMobile()) {
      btnTakePhoto.style.display = 'none';
    }
    if (btnTakePhoto) {
      btnTakePhoto.addEventListener('click', () => inputTakePhoto.click());
    }
    if (btnChooseFile) {
      btnChooseFile.addEventListener('click', () => inputChooseFile.click());
    }

    function handleFileSelection(event) {
      const file = event.target.files[0];
      if (file) {
        currentImageFile = file;
        imagePreviewContainer.style.display = 'flex';

        if (file.type.startsWith('video/')) {
          imagePreview.innerHTML = `<video src="${createAndTrackBlobUrl(file)}" muted playsinline></video>`;
          autoResizeInput();
        } else if (file.type.startsWith('audio/')) {
          imagePreview.innerHTML = `<i class="bi bi-file-earmark-music-fill"></i>`;
          autoResizeInput();
        } else if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = e => {
            if (currentImageFile !== file) return;
            imagePreview.innerHTML = `<img src="${e.target.result}" alt="Image preview" />`;
            autoResizeInput();
          };
          reader.readAsDataURL(file);
        } else {
          imagePreview.innerHTML = `<i class="bi bi-file-earmark-fill"></i>`;
          autoResizeInput();
        }
      }
    }

    if (inputTakePhoto) {
      inputTakePhoto.addEventListener('change', handleFileSelection);
    }
    if (inputChooseFile) {
      inputChooseFile.addEventListener('change', handleFileSelection);
    }

    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', () => {
        currentImageFile = null;
        if (inputTakePhoto) inputTakePhoto.value = null;
        if (inputChooseFile) inputChooseFile.value = null;
        imagePreviewContainer.style.display = 'none';
        imagePreview.innerHTML = '';
        autoResizeInput();
      });
    }

    if (modalMessagesContainer) {
      modalMessagesContainer.addEventListener('click', function (event) {
        if (event.target.classList.contains('message-clickable')) {
          showFullImage(event.target.src);
        }
      });

    }

    const modalQR2El = document.getElementById('modalQR2');
    if (modalQR2El) {
      modalQR2El.addEventListener('focusin.bs.modal', function (event) {
        if (event.target.closest('#message-modal')) {
          event.preventDefault();
        }
      });
    }

    function beginConversation() {
      document.body.classList.add('gb-chat-open');
      closeQuotedContext();
      revokeAllBlobs();
      lastOrderEl.innerHTML = '';
      conversationVersion++;
      renderingMids.clear();
      renderingLocals.clear();
      messengerReadThrough.clear();
      syncHistory = undefined;
      chatState.beforeId = null;
      chatState.hasMoreMessages = true;
      chatState.isFetchingMessages = false;

      loadMoreBtn = document.createElement('button');
      loadMoreBtn.type = 'button';
      loadMoreBtn.className = 'btn btn-sm btn-link text-decoration-none load-more-btn align-self-center';
      loadMoreBtn.addEventListener('click', () => {
        chatScroll.resetTouchGesture();
        void loadMoreMessages();
      });
      modalMessagesContainer.replaceChildren(loadMoreBtn, messageList);
      chatScroll.reset();
    }

    async function loadConversation() {
      if (!currentCustomerId) return;
      const version = conversationVersion;
      await Promise.all([fetchHistory(true), fetchLastOrder(currentCustomerId)]);
      if (!isActiveChat(version)) return;
      loadPendingMessagesFromStorage();
      void syncNewMessages();
    }

    switchOpenConversation = () => {
      beginConversation();
      void loadConversation();
    };
    messageModalEl.addEventListener('show.bs.modal', beginConversation);
    messageModalEl.addEventListener('shown.bs.modal', loadConversation);

    messageModalEl.addEventListener('hidden.bs.modal', function () {
      document.body.classList.remove('gb-chat-open');
      chatScroll.reset();
      closeQuotedContext();
      revokeAllBlobs();
      conversationVersion++;
      syncHistory = undefined;
      messageList.replaceChildren();
      modalMessagesContainer.replaceChildren();
      lastOrderEl.innerHTML = '';
      chatState.isFetchingMessages = false;
      chatState.hasMoreMessages = true;
      chatState.beforeId = null;
      autoResizeInput();
    });

    function autoResizeInput() {
      if (messageInput) {
        messageInput.style.height = 'auto';
        const newHeight = messageInput.scrollHeight;
        messageInput.style.height = `${newHeight}px`;
      }
    }

    document.addEventListener('click', function (event) {
      const element = event.target.closest('.open-message-modal');
      if (element) {
        event.preventDefault();
        const customerId = element.dataset.customerId;
        const customerName = element.dataset.customerName;
        const pageId = element.dataset.senderPageId;
        if (customerId) {
          window.openMessageModalAndPaste(customerId, customerName, pageId);
        }
      }
    });

    socket.on('read', data => {
      if (!isActiveChat(conversationVersion) || String(data.senderId) !== String(currentCustomerId)) return;
      const watermark = Number(data.watermark);
      if (!data.pageId || !Number.isFinite(watermark)) return;
      const pageId = String(data.pageId);
      const previous = messengerReadThrough.get(pageId) || 0;
      if (watermark <= previous) return;
      messengerReadThrough.set(pageId, watermark);
      for (const row of messageList.querySelectorAll('.message-sent-messenger')) markMessengerRead(row);
    });

    const { addMessageToTop } = GBChatInbox.init(PAGE_IDS);

    function updateAuditLabel(data) {
      const row = findRowByMsgId(data.messid);
      const time = row && row.querySelector('.message-timestamp-text');
      if (time && data.sent_by_username) {
        if (!time.dataset.baseTime) time.dataset.baseTime = time.textContent.split(' · ')[0];
        time.textContent = time.dataset.baseTime + ' · ' + data.sent_by_username;
      }
    }
    socket.on('message-audit', data => {
      if (String(data.sent_by_user_id) === String(window.CURRENT_USER_ID)) {
        if (data.part && data.customer_id && data.page_id) {
          updatePendingConfirmation({ customerId: data.customer_id, pageId: data.page_id,
            localId: data.client_message_id, part: data.part, channel: 'facebook', mid: data.messid });
        } else {
          linkMessengerId(data.messid, data.client_message_id);
        }
      }
      updateAuditLabel(data);
    });
    socket.on('new-message', data => {
      addMessageToTop(data);
      if (!isActiveChat(conversationVersion)) return;
      const participants = [String(data.senderId), String(data.recipientId)];
      if (!participants.includes(String(currentCustomerId))) return;

      if (String(data.sent_by_user_id) === String(window.CURRENT_USER_ID) &&
          linkMessengerId(data.messid, data.client_message_id)) {
        updateAuditLabel(data);
        return;
      }
      if (data.messid && findRowByMsgId(data.messid)) {
        updateAuditLabel(data);
        return;
      }

      void addMessageToContainer({
        sender: data.senderId,
        sent_by_username: data.sent_by_username || null,
        message: data.messageText || null,
        image: data.messageImg || null,
        channel: data.channel,
        is_echo: data.is_echo,
        template_json: data.template || null,
        replyTo: data.replyTo || null,
        messid: data.messid || null,
        time: data.message_timestamp || data.timestamp || Date.now(),
        timestamp: data.message_timestamp
      }).catch(error => console.error('Lỗi hiển thị tin nhắn mới:', error));
    });
  });
})();
