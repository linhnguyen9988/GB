'use strict';

const mediaTypes = {
    'chat.photo': 'image', 'share.photo': 'image', 'chat.gif': 'image',
    'chat.sticker': 'image', 'chat.doodle': 'image',
    'chat.video.msg': 'video', 'share.video': 'video',
    'chat.voice': 'audio', 'share.file': 'file'
};

function asObject(value) {
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch (_) { return null; }
    }
    return value && typeof value === 'object' ? value : null;
}

function mediaUrl(value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null;
    try {
        const url = new URL(value);
        if (url.username || url.password) return null;
        return url.href.replace(/;/g, '%3B');
    } catch (_) { return null; }
}

function readZaloContent(msgType, content) {
    const kind = mediaTypes[msgType];
    const data = asObject(content);
    if (!kind) {
        if (typeof content === 'string') return { text: content.slice(0, 8000), image: null, template: null };
        const url = mediaUrl(data?.href || data?.url);
        const title = typeof data?.title === 'string' ? data.title : '';
        const description = typeof data?.description === 'string' ? data.description : '';
        return { text: [title, description, url].filter(Boolean).join('\n').slice(0, 8000) || '[Nội dung Zalo chưa hỗ trợ]', image: null, template: null };
    }

    const params = asObject(data?.params);
    const list = Array.isArray(data) ? data : (Array.isArray(data?.attachments) ? data.attachments
        : Array.isArray(data?.photos) ? data.photos : [data || content]);
    const attachments = [];
    for (const item of list.slice(0, 50)) {
        const object = asObject(item);
        const details = asObject(object?.params);
        const sources = [object, details];
        const fields = kind === 'image'
            ? ['hdUrl', 'normalUrl', 'rawUrl', 'oriUrl', 'stickerUrl', 'href', 'url', 'thumb', 'thumbUrl']
            : ['fileUrl', 'videoUrl', 'href', 'url'];
        // Prefer a full image over a thumbnail, including URLs nested in params.
        const url = fields.flatMap(field => sources.map(source => mediaUrl(source?.[field]))).find(Boolean)
            || mediaUrl(item);
        if (!url || attachments.some(attachment => attachment.url === url)) continue;
        const name = object?.fileName || object?.filename || details?.fileName || object?.title;
        attachments.push({ url, kind, name: typeof name === 'string' ? name.slice(0, 255) : '',
            ...(msgType === 'chat.sticker' ? { sticker: object?.sticker || { label: 'Sticker', sprite: false } } : {}) });
    }

    const caption = data?.description || data?.desc || params?.desc || params?.description;
    const text = typeof caption === 'string' ? caption.slice(0, 8000) : null;
    if (!attachments.length) {
        const labels = { image: 'Ảnh', video: 'Video', audio: 'Tin thoại', file: 'Tệp' };
        return { text: text || (msgType === 'chat.sticker' ? '[Sticker Zalo chưa lấy được dữ liệu]' : `[${labels[kind]} Zalo chưa có đường dẫn]`), image: null,
            template: msgType === 'chat.sticker' ? { template_type: 'zalo_sticker_pending', stickerId: data?.stickerId || data?.id || params?.id || null } : null };
    }
    return {
        text,
        image: attachments.map(attachment => attachment.url).join(';'),
        template: { template_type: 'zalo_media', attachments }
    };
}

module.exports = { readZaloContent };
