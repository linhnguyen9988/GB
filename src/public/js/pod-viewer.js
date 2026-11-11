'use strict';

const GBPodViewer = (() => {
    function urls(value) {
        if (typeof value === 'string') {
            try { value = JSON.parse(value); } catch (_) { /* Older rows can store a plain URL. */ }
        }
        return (Array.isArray(value) ? value : [value])
            .filter(url => typeof url === 'string' && /^https?:\/\/\S+$/i.test(url.trim()))
            .map(url => url.trim());
    }

    function thumbnails(...fields) {
        const pictures = [...new Set(fields.flatMap(urls))];
        if (!pictures.length) return '';
        const container = document.createElement('div');
        container.className = 'd-flex flex-wrap gap-1 mt-2';
        pictures.forEach((url, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pod-thumbnail';
            button.dataset.podUrl = url;
            button.setAttribute('aria-label', 'Xem ảnh POD ' + (index + 1));
            button.setAttribute('aria-haspopup', 'dialog');
            const img = document.createElement('img');
            img.setAttribute('src', url);
            img.alt = '';
            img.loading = 'lazy';
            img.referrerPolicy = 'no-referrer';
            button.append(img);
            container.append(button);
        });
        return container.outerHTML;
    }

    const dialog = document.getElementById('pod-viewer');
    const journey = document.getElementById('modal-tracking-content');
    const find = name => dialog.querySelector('[data-pod-' + name + ']');
    const photo = find('photo');
    const image = find('image');
    const error = find('error');
    const previous = find('prev');
    const next = find('next');
    let album = [];
    let index = 0;
    let gesture;

    function showImage() {
        image.hidden = false;
        error.hidden = true;
        image.alt = 'Ảnh POD ' + (index + 1);
        image.src = album[index];
        find('count').textContent = (index + 1) + ' / ' + album.length;
        previous.hidden = next.hidden = album.length < 2;
    }

    function move(step) {
        if (album.length < 2) return;
        index = (index + step + album.length) % album.length;
        showImage();
    }

    journey.addEventListener('click', event => {
        const button = event.target.closest('[data-pod-url]');
        if (!button) return;
        album = [...new Set(Array.from(journey.querySelectorAll('[data-pod-url]'), item => item.dataset.podUrl))];
        index = album.indexOf(button.dataset.podUrl);
        showImage();
        dialog.showModal();
    });
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    find('close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') event.stopPropagation();
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
        }
    });
    dialog.addEventListener('close', () => {
        gesture = undefined;
        image.removeAttribute('src');
    });
    dialog.closest('.modal').addEventListener('hide.bs.modal', () => dialog.close());
    image.addEventListener('error', () => {
        if (!dialog.open) return;
        image.hidden = true;
        error.hidden = false;
    });

    photo.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch' || !event.isPrimary || event.target.closest('button')) return;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    photo.addEventListener('pointercancel', () => { gesture = undefined; });
    photo.addEventListener('pointerup', event => {
        if (gesture?.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        gesture = undefined;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
    });

    return { thumbnails };
})();
