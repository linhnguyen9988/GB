'use strict';

(() => {
  const panel = document.getElementById('zaloFriendQueue');
  if (!panel) return;
  const el = name => panel.querySelector('[data-fq-' + name + ']');
  const labels = { waiting:'Đang chờ',working:'Đang xử lý',friends:'Đã là bạn',pending_request:'Đã có lời mời chờ',
    sent:'Đã gửi lời mời',not_found:'Chưa tra được UID',failed:'Lỗi',duplicate:'Đã có lượt cho UID này',skipped:'Đã bỏ qua',uncertain:'Cần kiểm tra kết quả gửi' };
  const stages = { lookup:'Tra SĐT → UID',status:'Kiểm tra quan hệ bạn bè',invite:'Gửi lời mời kết bạn' };
  let state, busy = false, fetching = false, timer;
  const date = value => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString('vi-VN'); };
  async function request(method = 'GET', body, suffix = '') {
    const response = await fetch('/api/admin/zalo/friend-queue' + suffix, { method, cache:'no-store',
      headers:{'Content-Type':'application/json','X-GB-Zalo-Action':'1'},body:body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Không tải được hàng chờ kết bạn.');
    return result;
  }
  function text(tag, value, className) { const node = document.createElement(tag); node.textContent = value; if(className)node.className = className; return node; }
  function jobCard(job, logs, open = false) {
    const box = document.createElement('details');box.className = 'border rounded p-2 mb-2';box.open = open;
    const name = (job.customer_name || 'Khách Zalo') + (job.customer_id ? ' · KH' + job.customer_id : '');
    box.appendChild(text('summary', name + (job.phone ? ' · ' + job.phone : '') + ' · ' + (labels[job.state] || job.state), 'text-break'));
    box.appendChild(text('div', 'Bước: ' + (stages[job.stage] || job.stage) + (job.uid ? ' · UID ' + job.uid : ''), 'mt-1 text-break'));
    if (job.messenger_timestamp) box.appendChild(text('div', 'Tin Messenger gần nhất: ' + date(Number(job.messenger_timestamp)), 'text-body-secondary'));
    if (job.zalo_message_note) box.appendChild(text('div', 'Nhắn Zalo: ' + job.zalo_message_note, 'text-body-secondary'));
    if (job.last_error) box.appendChild(text('div', job.last_error, 'text-danger text-break'));
    for (const item of logs.filter(item => item.job_key === job.job_key).slice().reverse()) box.appendChild(text('div', date(item.created_at) + ' · ' + item.detail, 'text-break'));
    return box;
  }
  function render() {
    if (!state) return;
    const config = state.config;
    el('toggle').disabled = el('retry').disabled = busy;
    el('toggle').textContent = Number(config.enabled) ? 'Tạm dừng' : 'Chạy tiếp';
    const counts = Object.fromEntries(state.counts.map(item => [item.state,Number(item.count)]));
    const total = Object.values(counts).reduce((sum,n)=>sum+n,0), waiting=counts.waiting||0, working=counts.working||0;
    el('counts').textContent = 'Tổng ' + total + ' · đã xử lý ' + (total-waiting-working) + ' · còn chờ ' + waiting +
      ' · đang làm ' + working + ' · đã gửi lời mời ' + (counts.sent||0) + ' · đã là bạn ' + (counts.friends||0) + ' · lời mời có sẵn ' + (counts.pending_request||0) + ' · lỗi/chưa xác nhận ' + ((counts.failed||0)+(counts.uncertain||0)) +
      ' · chưa tra UID ' + (counts.not_found||0) + ' · trùng/bỏ qua ' + ((counts.duplicate||0)+(counts.skipped||0)) + ' · hôm nay dùng ' + (config.used_today||0) + ' lượt gửi · trong đợt hiện tại ' + (config.batch_count||0) + '/' + config.batch_size + ' khách.';
    let status = !Number(config.enabled) ? 'Hàng chờ đang tạm dừng.' : 'Hàng chờ đang bật, ưu tiên tin Messenger mới nhất.';
    if (Number(config.enabled) && state.schedule?.allowed === false) {
      const next = new Date(state.schedule.nextOpenAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      status = 'Ngoài giờ kết bạn (07:00–23:00 GMT+7). Tự chạy lại sớm nhất ' + next + ' (GMT+7).';
    } else if (config.paused_until && new Date(config.paused_until).getTime()>Date.now()) status += ' Zalo báo giới hạn, đang tự nghỉ đến ' + date(config.paused_until) + '.';
    else if (Number(config.enabled) && !state.current.length) status += ' Bước tiếp theo sớm nhất ' + date(config.next_api_at) + '.';
    const capacity = state.capacity;
    if (capacity) {
      if (capacity.error) status += ' ' + capacity.error;
      else if (capacity.count !== null) {
        status += ' Lời mời chưa được chấp nhận: ' + capacity.count + '/' + capacity.limit + '.';
        if (capacity.count >= capacity.limit) status += ' Đã đầy, dừng gửi thêm; kiểm tra lại sau mỗi 5 phút trong giờ hoạt động.';
      } else status += ' Chưa đọc số lời mời đang chờ; sẽ kiểm tra trước khi kết bạn.';
    }
    el('status').textContent = status;
    el('current').replaceChildren(...state.current.map(job=>jobCard(job,state.events,true)));
    if (!state.current.length) el('current').appendChild(text('div','Chưa có bước đang chạy; đang chờ đến lượt tiếp theo.','small text-body-secondary'));
    el('waiting').replaceChildren(...state.waiting.map(job=>jobCard(job,state.events)));
    el('recent').replaceChildren(...state.recent.map(job=>jobCard(job,state.events)));
    el('events').replaceChildren(...state.events.slice(0,30).map(item=>text('div',date(item.created_at)+' · '+(item.customer_name ? item.customer_name+(item.customer_id?' · KH'+item.customer_id:'')+' · ' : '')+item.detail,'mb-1')));
  }
  async function refresh() {
    clearTimeout(timer);if(fetching||document.hidden)return;
    fetching=true;
    try { state=await request();render(); } catch(error){el('status').textContent=error.message;}
    finally{fetching=false;timer=setTimeout(refresh,2500);}
  }
  el('toggle').addEventListener('click', async () => {
    if(busy||!state)return;busy=true;render();el('feedback').textContent='';
    try {
      await request('PUT',{enabled:!Number(state.config.enabled)});
      el('feedback').textContent='Đã lưu. Khách đang thực hiện sẽ hoàn tất trước khi dừng.';await refresh();
    }catch(error){el('feedback').textContent=error.message;}finally{busy=false;render();}
  });
  el('retry').addEventListener('click', async () => {
    if(busy||!state)return;busy=true;render();
    try { const result=await request('POST',undefined,'/retry');el('feedback').textContent='Đã xếp thử lại '+result.count+' lượt tra lỗi.';await refresh(); }
    catch(error){el('feedback').textContent=error.message;}finally{busy=false;render();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  refresh();
})();
