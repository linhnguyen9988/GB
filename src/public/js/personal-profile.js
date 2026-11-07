'use strict';
(() => {
 const $ = id => document.getElementById(id);
 document.querySelectorAll('[data-reveal]').forEach(button => button.addEventListener('click', () => {
  const input = $(button.dataset.reveal), reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password'; button.textContent = reveal ? 'Ẩn' : 'Hiện'; button.setAttribute('aria-pressed', String(reveal));
 }));
 const fresh = $('newPassword'), confirmation = $('confirmPassword');
 function validatePassword() {
  const validLength = fresh.value.length >= 10 && new TextEncoder().encode(fresh.value).length <= 72;
  const matches = !!fresh.value && fresh.value === confirmation.value;
  $('rule-length').classList.toggle('valid', validLength);
  $('rule-match').classList.toggle('valid', matches);
  $('rule-length').textContent = (validLength ? '✓ ' : '○ ') + 'Ít nhất 10 ký tự, tối đa 72 byte';
  $('rule-match').textContent = (matches ? '✓ ' : '○ ') + 'Hai mật khẩu mới trùng nhau';
  fresh.setCustomValidity(fresh.value && !validLength ? 'Mật khẩu cần ít nhất 10 ký tự và tối đa 72 byte.' : '');
  confirmation.setCustomValidity(confirmation.value && !matches ? 'Hai mật khẩu mới chưa trùng nhau.' : '');
 }
 fresh.addEventListener('input', validatePassword); confirmation.addEventListener('input', validatePassword);
 document.querySelectorAll('.password-input input').forEach(input => {
  const caps = event => { $('caps-lock').hidden = !event.getModifierState || !event.getModifierState('CapsLock'); };
  input.addEventListener('keyup', caps); input.addEventListener('keydown', caps); input.addEventListener('blur', () => { $('caps-lock').hidden = true; });
 });
 const agent = navigator.userAgent;
 const browser = /Edg\//.test(agent) ? 'Microsoft Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Trình duyệt';
 const os = /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS / iPadOS' : /Windows/.test(agent) ? 'Windows' : /Macintosh/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
 $('current-device').textContent = browser + (os ? ' · ' + os : '');
 const dialog = $('revoke-dialog');
 $('open-revoke').addEventListener('click', () => { $('revoke-form').reset(); const message = dialog.querySelector('.form-result'); message.textContent = ''; message.classList.remove('error'); dialog.showModal(); });
 $('close-revoke').addEventListener('click', () => dialog.close());
 dialog.addEventListener('cancel', event => { if ($('revoke-form').dataset.busy === 'true') event.preventDefault(); });
 function finishAuthentication() {
  try { localStorage.removeItem('token'); } catch (_) {}
  setTimeout(() => location.assign('/login'), 1400);
 }
 document.querySelectorAll('form[data-endpoint]').forEach(form => form.addEventListener('submit', async event => {
  event.preventDefault();
  if (form.dataset.busy === 'true') return;
  if (form.id === 'password-form') validatePassword();
  if (!form.reportValidity()) return;
  const result = form.querySelector('.form-result'), button = form.querySelector('[type=submit]');
  const original = button.textContent;
  form.dataset.busy = 'true'; button.disabled = true; button.textContent = 'Đang xử lý…'; result.textContent = ''; result.classList.remove('error');
  const closing = $('close-revoke'); if (form.id === 'revoke-form') closing.disabled = true;
  let leaving = false;
  try {
   const payload = Object.fromEntries(new FormData(form));
   const response = await fetch(form.dataset.endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
   if (response.status === 401 || response.redirected) { leaving = true; location.assign('/login'); return; }
   const data = await response.json();
   if (!response.ok || !data.success) throw new Error(data.message || 'Chưa thực hiện được. Vui lòng thử lại.');
   result.textContent = data.message || 'Đã lưu thay đổi.';
   if (form.id === 'info-form') {
    $('fullname').value = data.fullname; $('profile-display-name').textContent = data.fullname;
    $('profile-avatar').textContent = data.fullname.trim().split(/\s+/).slice(-2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('vi-VN');
   } else { form.reset(); validatePassword(); leaving = true; finishAuthentication(); }
  } catch (error) {
   result.textContent = error instanceof TypeError ? 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.' : error.message;
   result.classList.add('error');
  } finally {
   if (!leaving) { form.dataset.busy = 'false'; button.disabled = false; button.textContent = original; closing.disabled = false; }
  }
 }));
})();
