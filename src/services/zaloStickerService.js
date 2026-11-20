'use strict';

const stickers = new Map();

function object(value) {
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch (_) { return {}; }
    }
    return value && typeof value === 'object' ? value : {};
}

async function resolveSticker(session, content) {
    const data = object(content);
    const params = object(data.params);
    const id = Number(data.stickerId ?? data.sticker_id ?? data.id ?? params.stickerId ?? params.sticker_id ?? params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return data;
    const cached = stickers.get(id);
    let detail;
    if (cached && cached.expires > Date.now()) detail = await cached.value;
    else {
        const value = session.api.getStickersDetail(id).then(rows => rows.find(row => Number(row.id) === id) || rows[0]);
        stickers.set(id, { value, expires: Date.now() + 24 * 60 * 60 * 1000 });
        if (stickers.size > 500) stickers.delete(stickers.keys().next().value);
        try { detail = await value; } catch (error) { stickers.delete(id); throw error; }
    }
    if (!detail) { stickers.delete(id); return data; }
    const webp = typeof detail.stickerWebpUrl === 'string' ? detail.stickerWebpUrl : '';
    const frames = Math.max(1, Math.min(1000, Number(detail.totalFrames) || 1));
    const sprite = !webp && frames > 1 && Boolean(detail.stickerSpriteUrl);
    const url = webp || (sprite ? detail.stickerSpriteUrl : detail.stickerUrl || detail.uri);
    return {
        ...data, stickerUrl: url,
        sticker: {
            id, sprite, frames, duration: Number(detail.duration) || 0,
            previewUrl: detail.stickerUrl || detail.uri || '',
            label: typeof detail.text === 'string' ? detail.text.slice(0, 255) : 'Sticker'
        }
    };
}

module.exports = { resolveSticker };
