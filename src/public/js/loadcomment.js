var e = document.getElementById("liveidcombobox");
var liveidfrominput = document.getElementById("liveidinput");
var html = '';
const toast = new Bs5Utils();
function OnUpdateLiveNote() {
    var note = document.getElementById("livenote").value;
    var id = liveidfrominput.value;
    $.ajax({
        url: "/updatelivenote",
        method: "POST",
        data: { note: note, liveid: id },
        dataType: "JSON",
        success: function (data) {
            ShowCenterToast('success', 'Đã lưu ghi chú', 3000);
        }
    });
}
$("#gia").on("keydown", function (e) {
    if (e.ctrlKey || e.metaKey) return;
    var keyCode = (e.keyCode ? e.keyCode : e.which);
    if (keyCode == 67 && e.shiftKey) {
        e.preventDefault();
        var rowData = null;
        try { rowData = $('#comment_table').DataTable().row(getRowIdx()).data(); } catch (err) { rowData = null; }
        OpenChot2Modal(rowData);
    } else if (keyCode == 13 || keyCode == 67) {
        Chot();
    } else if (keyCode == 88) {
        XaHang();
    }
});
var initkey = 0;
let mobileChotCommentId = null;

function UpdateCommentCustomerRow({ userid, phone, diachi, label, note, nn }) {
    if (!$.fn.dataTable.isDataTable('#comment_table')) return;
    var table = $('#comment_table').DataTable();
    table.rows().every(function (rowIdx) {
        if (String(table.cell(rowIdx, 12).data()) !== userid) return;
        var oldPhone = table.cell(rowIdx, 3).data();
        var display = table.cell(rowIdx, 1).data();
        var escapedPhone = gbEscapeText(phone);
        if (oldPhone) {
            display = display.replaceAll(gbEscapeText(oldPhone), () => escapedPhone);
        } else if (phone) {
            display += '<br><span class="label label--pink">' + escapedPhone + '</span>';
        }
        var regionBadge = '<span class="label label--lightpink">Nước ngoài</span>';
        display = display.replaceAll(regionBadge, '');
        if (nn === 'Nước ngoài') display += (phone ? '' : '<br>') + regionBadge;
        table.cell(rowIdx, 1).data(display);
        table.cell(rowIdx, 3).data(phone);
        table.cell(rowIdx, 10).data(diachi);
        table.cell(rowIdx, 21).data(label);
        table.cell(rowIdx, 19).data(note);
        table.cell(rowIdx, 23).data(nn);
    }).draw(false);
}

function OpenMessenger(pageid, realid) {
    if (realid != null && realid.length > 0) {
        window.open("https://business.facebook.com/latest/inbox/messenger?asset_id=" + pageid + "&selected_item_id=" + realid + "&mailbox_id=&thread_type=FB_MESSAGE", '_blank').focus();
    } else {
        UpdateComment(1);
    }
}
function isFakeCommentId(id) {
    return !!id && (String(id).match(/_/g) || []).length !== 1;
}
// Keep the stored comment untouched: printing and sorting use the original content.
function renderCommentSource(data, type, row) {
    if (type === 'copy') {
        const content = document.createElement('div');
        content.innerHTML = data == null ? '' : String(data);
        content.querySelectorAll('.comment-source-icon').forEach(icon => icon.remove());
        content.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        return content.textContent || '';
    }
    if (type !== 'display') return data;
    const content = data == null ? '' : data;
    if (!row || !row[8]) return content;
    const messenger = isFakeCommentId(row[8]);
    const icon = messenger ? 'messenger' : 'facebook';
    const label = messenger ? 'Tin nhắn Messenger' : 'Bình luận Facebook';
    return `<i class="bi bi-${icon} comment-source-icon" title="${label}" aria-label="${label}"></i>${content}`;
}
function UpdateComment(openmess, selectedRow) {
    RefreshCommentCustomer(openmess, selectedRow, 22, 26);
}

function InItKeys() {
    var t = $('#comment_table').DataTable();
    t.on('key', function (e, datatable, keyCode, cell, originalEvent) {
        if (originalEvent && (originalEvent.ctrlKey || originalEvent.metaKey)) return;
        var x = datatable.row(cell.index().row).data();
        if ($('.modal.show').is('#modaledit, #message-modal, #modalxaconfirm, #modalalertx, #modalchot2')) {
            return;
        }
        if ($('#viettelnotetext').is(':focus') || $('#message-input').is(':focus') || $('#notescan').is(':focus') || $('#diachiviettel').is(':focus') || $('#diachimodal').is(':focus') || $('#gia').is(':focus') || $('#slchot').is(':focus') || $('#gia_m').is(':focus') || $('#slchot_m').is(':focus') || $('#comment_table_filter input').is(':focus') || $('#livenote').is(':focus') || $('#OrderNote').is(':focus') || $('#MessToSend').is(':focus') || $('#link').is(':focus') || $('#usernote').is(':focus') || $('#userphone').is(':focus') || $('#useraddress').is(':focus') || $('#diachi').is(':focus') || $('#note').is(':focus')) {
            return;
        }
        if (keyCode == 67) {
            if (originalEvent && originalEvent.shiftKey) {
                OpenChot2Modal(x);   // Shift+C: chốt 2 giá
            } else {
                Chot();
            }
            //0-9 KeyCode
        } else if (keyCode == 66) { // Phím B
            var rowNode = datatable.row(cell.index().row).node();
            handlePrintLabel(rowNode);
        } else if (keyCode == 48) {//0
            document.getElementById("slchot").value = 10;
        } else if (keyCode == 49) {//1
            document.getElementById("slchot").value = 1;
        } else if (keyCode == 50) {//2
            document.getElementById("slchot").value = 2;
        } else if (keyCode == 51) {//3
            document.getElementById("slchot").value = 3;
        } else if (keyCode == 52) {//4
            document.getElementById("slchot").value = 4;
        } else if (keyCode == 53) {//5
            document.getElementById("slchot").value = 5;
        } else if (keyCode == 54) {//6
            document.getElementById("slchot").value = 6;
        } else if (keyCode == 55) {//7
            document.getElementById("slchot").value = 7;
        } else if (keyCode == 56) {//8
            document.getElementById("slchot").value = 8;
        } else if (keyCode == 57) {//9
            document.getElementById("slchot").value = 9;
        } else if (keyCode == 81) {
            ScanComment(30);
        } else if (keyCode == 189) {
            //UpdateToQ(x[22]);
        } else if (keyCode == 75) {
            SendMessage("Áo dài Gia Bảo chốt đơn.");
        } else if (keyCode == 76) {
            window.open('https://www.facebook.com/watch/?v=' + x[17] + '&t=' + (x[7] - 70), '_blank').focus();
        } else if (keyCode == 186) {
            if (x[18] != '102116919355833') {//ko can cai nay, xem chung tren trang chinh la dc
                const linkToClick = document.querySelector('.open-message-modal');
                window.open('https://www.facebook.com/watch/?v=' + liveidfrominput.value.replaceAll(x[17], '').replaceAll(',', '') + '&t=' + (x[7] - 70), '_blank').focus();
            }
        } else if (keyCode == 80) {
            $.ajax({
                url: "/updateuserpsid",
                method: "POST",
                data: { psid: x[12], pageid: x[18] },
                dataType: "JSON",
                success: function (data) {
                    var uid = String(x[12]);
                    $('img[src*="/images/ava/' + uid + '.jpg"]').each(function () {
                        this.src = '/images/ava/' + uid + '.jpg?t=' + Date.now();
                    });
                    if (data.avatarSaved === false) {
                        ShowCenterToast('warning', 'Đã cập nhật tên nhưng không tải được avatar: ' + (data.avatarError || ''), 4500);
                    } else {
                        ShowCenterToast('success', 'Đã cập nhật avatar.', 2500);
                    }
                },
                error: function (xhr) {
                    ShowCenterToast('danger', (xhr.responseJSON && xhr.responseJSON.error) || 'Không cập nhật được thông tin khách', 3500);
                }
            });
        } else if (keyCode == 77) {//nut M
            const link = document.createElement('a');
            link.href = 'javascript:void(0);';
            link.dataset.customerId = x[12];
            link.dataset.customerName = x[26];
            link.dataset.senderPageId = x[18] ? x[18].toString() : '';
            link.className = 'open-message-modal';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (keyCode == 78) {
            LuckyAdd(x[12], x[15] || $('<div>').html(x[1]).text(), String(x[3] || '').replace(/<[^>]*>?/gm, '').trim(), x[25], $('<div>').html(x[1]).find('img').attr('src') || '');
        } else if (keyCode == 79) {
            clearAllToasts();
        } else if (keyCode == 85) {
            ShowCustomerDetails({
                name: EditPlainName(x[1], x[12]), userid: x[12], phone: x[3], diachi: x[10],
                note: x[19], label: x[21], realfbid: x[22], nn: x[23],
                trigger: document.activeElement, onSaved: UpdateCommentCustomerRow
            });
        } else if (keyCode == 86) {
            UpdatePhone();
        } else if (keyCode == 88) {
            XaHang();
        } else if (keyCode == 84) {//Nut T
            UpdateComment(0, x);
        } else if (keyCode == 190) {
            SendWelcome();
        } else {
            //console.log('Key press: ' + keyCode + ' for cell ' + cell.data() + ' on Row ID ' + getRowIdx());
        }
    }).on('key-focus', function (e, datatable, cell) {
    });
    initkey = 1;
}
async function LoadLive() {
    mobileChotCommentId = null;
    var xxx = document.getElementById(e.value);
    document.getElementById("btnloadlive").disabled = true;
    document.getElementById("btnloadlive").innerHTML = '<span class="spinner-grow" style="width: 0.8rem; height: 0.8rem;" role="status"></span>&nbsp;Load';

    var t = $('#comment_table').DataTable();

    if ($.fn.dataTable.isDataTable('#comment_table')) {
        $('#comment_table').DataTable().destroy();
    }

    var liveid = e.value;
    if (currentPostId && currentPostId !== liveid) LeaveLiveRoom();
    if (document.getElementById("liveidinput").value.length > 0 && document.getElementById("liveidinput").value != liveid) {
        document.getElementById("liveidinput").value += ',' + liveid;
    } else {
        document.getElementById("liveidinput").value = liveid;
    }
    document.getElementById("livenote").value = xxx.getAttribute("data-note");

    UpdateLiveStatusBadge(xxx.getAttribute("data-status"));
    $.ajax({
        url: "/getlivestatus",
        method: "POST",
        data: { liveid: liveid },
        dataType: "JSON",
        success: function (statusRes) {
            xxx.setAttribute("data-status", statusRes.status || '');
            UpdateLiveStatusBadge(statusRes.status);
            if (statusRes.status === 'LIVE') {
                JoinLiveRoom(liveid);
                ShowCenterToast('primary', `Live đang phát trực tiếp, đang nhận bình luận: ${liveid}`, 3000);
            } else if (currentPostId === liveid) {
                LeaveLiveRoom();
            }
        }
    });

    $.ajax({
        url: "/action",
        method: "POST",
        data: { liveid: liveid },
        dataType: "JSON",
        success: function (data) {
            if (data.data.hasOwnProperty('error')) {
                ShowCenterToast('danger', data.data.error, 3000);
                document.getElementById("btnloadlive").disabled = false;
                document.getElementById("btnloadlive").innerHTML = 'Load';
                return;
            }
            if (data.data.length > 0) {
                for (i = 0; i < data.data.length; i++) {
                    var cmtidcol = t.column(8).data().toArray();
                    if (!cmtidcol.includes(data.data[i].commentid)) {
                        var note = data.data[i].note;
                        if (note === undefined || note === null || note == 'null') {
                            note = '';
                        }
                        var aka = data.data[i].aka;
                        var nuocngoai = data.data[i].nuocngoai;
                        var idpage = data.data[i].pageid;
                        var buttonpage1;
                        var buttonpage2;
                        if (aka == null) {
                            aka = '';
                        }
                        var xbel = '';
                        var xlabel = data.data[i].label;
                        if (data.data[i].chot.includes('CHỐT')) {
                            xbel = 'primary';
                        } else {
                            xbel = 'danger';
                        }
                        var zzzlabel = ``;
                        var zlabel = ``;
                        if (xlabel.includes('Nước')) {
                            zlabel = `<span class="badge bg-info">${xlabel}</span>`;
                        } else if (xlabel.includes('Xả') || xlabel.includes('Bom')) {
                            zlabel = `<span class="tag tag-red tag-pulse">${xlabel}</span>`;
                        } else if (xlabel.includes('Thân')) {
                            zlabel = `<span class="badge bg-success">${xlabel}</span>`;
                        } else if (xlabel.includes('Có')) {
                            zlabel = `<span class="label label--orange">${xlabel}</span>`;
                        }
                        var phone = data.data[i].phone;
                        var timesort = new Date(data.data[i].datecreate).getTime();
                        //var name = `<img src="${data.data[i].avalink}" class="avatar">${data.data[i].name}&nbsp;`;
                        var name = `<img src="/images/ava/${data.data[i].userid}.jpg" class="avatar">${data.data[i].name}`;
                        if (data.data[i].name.includes('Áo Dài Gia Bảo')) {
                            name += `<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="15" height="15" viewBox="0 0 48 48">
<linearGradient id="csF85US9HGjIK87qotE6pa_QMxOVe0B9VzG_gr1" x1="24" x2="24" y1="3.999" y2="43.001" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2aa4f4"></stop><stop offset="1" stop-color="#007ad9"></stop></linearGradient><path fill="url(#csF85US9HGjIK87qotE6pa_QMxOVe0B9VzG_gr1)" d="M43.466,25.705l-2.599-4.259l1.293-4.817c0.187-0.694-0.146-1.424-0.793-1.738l-4.488-2.178	l-1.518-4.752c-0.219-0.686-0.888-1.114-1.607-1.033l-4.953,0.594l-3.846-3.178c-0.555-0.459-1.355-0.459-1.91,0l-3.846,3.178	l-4.953-0.594c-0.717-0.081-1.389,0.348-1.607,1.033l-1.518,4.752l-4.488,2.178c-0.646,0.314-0.979,1.044-0.793,1.738l1.293,4.817	l-2.599,4.259c-0.375,0.614-0.261,1.408,0.271,1.892l3.693,3.354l0.116,4.987c0.018,0.719,0.542,1.325,1.252,1.444l4.92,0.825	l2.795,4.133c0.403,0.595,1.172,0.822,1.833,0.538L24,40.913l4.585,1.966C28.776,42.961,28.977,43,29.175,43	c0.486,0,0.957-0.236,1.243-0.659l2.795-4.133l4.92-0.825c0.71-0.119,1.234-0.726,1.252-1.444l0.116-4.987l3.693-3.354	C43.727,27.113,43.841,26.319,43.466,25.705z"></path><path fill="#fff" d="M21.814,31c-0.322,0-0.646-0.104-0.92-0.316l-4.706-3.66c-0.436-0.339-0.514-0.967-0.175-1.403	l0.614-0.789c0.339-0.436,0.967-0.514,1.403-0.175l3.581,2.785l7.086-8.209c0.361-0.418,0.992-0.464,1.41-0.104l0.757,0.653	c0.418,0.361,0.464,0.992,0.104,1.41l-8.017,9.289C22.655,30.822,22.236,31,21.814,31z"></path>
</svg>`;
                        }
                        if (data.data[i].diachi.length > 0) {
                            name = name + `<svg width="20px" height="20px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="location-outline" fill="currentColor" transform="translate(106.666667, 42.666667)"> <path d="M149.333333,7.10542736e-15 C231.807856,7.10542736e-15 298.666667,66.8588107 298.666667,149.333333 C298.666667,176.537017 291.413333,202.026667 278.683512,224.008666 C270.196964,238.663333 227.080238,313.32711 149.333333,448 C71.5864284,313.32711 28.4697022,238.663333 19.9831547,224.008666 C7.25333333,202.026667 2.84217094e-14,176.537017 2.84217094e-14,149.333333 C2.84217094e-14,66.8588107 66.8588107,7.10542736e-15 149.333333,7.10542736e-15 Z M149.333333,85.3333333 C113.987109,85.3333333 85.3333333,113.987109 85.3333333,149.333333 C85.3333333,184.679557 113.987109,213.333333 149.333333,213.333333 C184.679557,213.333333 213.333333,184.679557 213.333333,149.333333 C213.333333,113.987109 184.679557,85.3333333 149.333333,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>`;
                        }
                        if (nuocngoai.includes('Nước ngoài')) {
                            name = name + `<svg fill="currentColor" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
                        }
                        if (aka.length > 0) {
                            name = name + `<svg style="cursor:pointer" onclick="OpenAKAByPhone('${data.data[i].phone}','${data.data[i].userid}','${data.data[i].realfbid || ''}')" width="20px" height="20px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-people-fill"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path> <path fill-rule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"></path> <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path> </g></svg>`;
                        }


                        if (data.data[i].realfbid != null) {
                            if (idpage == '223266991771270') {
                                if (data.data[i].realfbid.length > 0) {
                                    buttonpage1 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=223266991771270&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                                    buttonpage2 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=102116919355833&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                                } else {
                                    buttonpage1 = `<a onclick="OpenMessenger('223266991771270',${data.data[i].realfbid})"<i class="bi bi-messenger"></i></a>`;
                                    buttonpage2 = `<a onclick="OpenMessenger('102116919355833',${data.data[i].realfbid})"<i class="bi bi-messenger"></i></a>`;
                                }
                            }
                            if (idpage == '102116919355833') {
                                if (data.data[i].realfbid.length > 0) {
                                    buttonpage1 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=102116919355833&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                                    buttonpage2 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=223266991771270&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                                } else {
                                    buttonpage1 = `<a onclick="OpenMessenger('102116919355833',${data.data[i].realfbid})"<i class="bi bi-messenger"></i></a>`;
                                    buttonpage2 = `<a onclick="OpenMessenger('223266991771270',${data.data[i].realfbid})"<i class="bi bi-messenger"></i></a>`;
                                }
                            }
                        }
                        if (phone === null) {
                            phone = '';
                        }
                        if (phone.length > 0) {
                            name = name + `<br><span class="label label--pink">${phone}<a href="tel:${data.data[i].phone}">📱</a></span>`;
                        }
                        if (nuocngoai == 'Nước ngoài') {
                            if (phone.length > 0) {
                                name = name + `<span class="label label--lightpink">${nuocngoai}</span>`;
                            } else {
                                name = name + `<br><span class="label label--lightpink">${nuocngoai}</span>`;
                            }
                        }
                        if (xlabel.length > 0) {
                            if (xlabel.includes('Xả') || xlabel.includes('Bom')) {
                                zzzlabel = 'red';
                            } else if (xlabel.includes('Thân')) {
                                zzzlabel = 'green';
                            } else if (xlabel.includes('Có')) {
                                zzzlabel = 'orange';
                            } else if (xlabel.includes('Nước')) {
                                zzzlabel = 'lightpink';
                            }
                            if (phone.length > 0) {
                                name = name + `<span class="label label--${zzzlabel}">${xlabel}</span>`;
                            } else {
                                name = name + `<br><span class="label label--${zzzlabel}">${xlabel}</span>`;
                            }
                        }
                        var buttonchat = `<a href="javascript:void(0);" data-customer-id="${data.data[i].userid}" data-customer-name="${data.data[i].name}" data-sender-page-id="${idpage}" class="open-message-modal"><i class="bi bi-chat-square-text-fill"></i></a>`;

                        var luotin = data.data[i].luotin;
                        if (luotin == 0) {
                            luotin = '&nbsp;';
                        }
                        var message = data.data[i].message;
                        if (message == null || message == undefined) {
                            message = '';
                        }
                        var pricehtml = ChotPriceTags(data.data[i].gia, data.data[i].slchot, data.data[i].gia2, data.data[i].slchot2);
                        var xabadge = (data.data[i].gia != '' && data.data[i].gia != null) ? XaBadgeHtml() : '';
                        html += `
                                <tr>
                                    <td>${(i + 1)}</td>
                                    <td>${name}</td>
                                    <td>${data.data[i].message}</td>
                                    <td>${phone}</td>
                                    <td>${zlabel}</td>
                                    <td><center><span class="badge bg-${xbel}">${data.data[i].chot}</span></center></td>
                                    <td><center>${pricehtml}${xabadge}</center></td>
                                    <td>${data.data[i].count}</td>
                                    <td>${data.data[i].commentid}</td>
                                    <td>${timesort}</td>
                                    <td>${data.data[i].diachi}</td>
                                    <td>${buttonchat}${buttonpage1}${buttonpage2}</td>
                                    <td>${data.data[i].userid}</td>
                                    <td>${data.data[i].datecreate}</td>
                                    <td>${data.data[i].timecomment}</td>
                                    <td>${data.data[i].fbnamex}</td>
                                    <td>${luotin}</td>
                                    <td>${data.data[i].liveid}</td>
                                    <td>${idpage}</td>
                                    <td>${note}</td>
                                    <td>${aka}</td>
                                    <td>${data.data[i].label}</td>
                                    <td>${data.data[i].realfbid}</td>
                                    <td>${nuocngoai}</td>
                                    <td>${data.data[i].threadid}</td>
                                    <td>${data.data[i].id}</td>
                                    <td>${data.data[i].name}</td>
                                    <td>${data.data[i].idx}</td>
                                </tr>
                                `;
                    }
                }
                document.getElementById("btnloadlive").disabled = false;
                document.getElementById("btnloadlive").innerHTML = 'Load';
                ShowCenterToast('success', 'Đã tải bình luận', 3000);
            }
            $('#comment_table tbody').html(html);
            $('#comment_table').DataTable(
                {
                    keys: {
                        blurable: false,
                        clipboardOrthogonal: 'copy'
                    },
                    language: {
                        "decimal": "",
                        "emptyTable": "Chưa có dữ liệu",
                        "info": "Hiển thị _START_ tới _END_ trong tổng số _TOTAL_ bình luận.",
                        "infoEmpty": "Không có bình luận nào",
                        "infoFiltered": "(lọc trong _MAX_ bình luận)",
                        "infoPostFix": "",
                        "thousands": ".",
                        "lengthMenu": "Hiển thị _MENU_ bình luận",
                        "loadingRecords": "Đang tải...",
                        "processing": "Đang xử lý",
                        "search": "Tìm kiếm:",
                        "zeroRecords": "Không tìm thấy bình luận nào",
                        "paginate": {
                            "first": "Đầu tiên",
                            "last": "Cuối cùng",
                            "next": "Tới",
                            "previous": "Lùi"
                        },
                        "aria": {
                            "sortAscending": ": activate to sort column ascending",
                            "sortDescending": ": activate to sort column descending"
                        },
                        "select": {
                            "rows": {
                                "1": " - Đang chọn 1 bình luận.",
                                "_": " - Đang chọn %d dòng."
                            }
                        },
                    },
                    lengthMenu: [
                        [20, 25, 35, 50, -1],
                        [20, 25, 35, 50, 'Tất cả']
                    ],
                    pageLength: 20,
                    columnDefs: [
                        {
                            target: 0,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 1,
                            createdCell: function (td, cellData, rowData, row, col) {
                                if (cellData.length > 0) {
                                    if (rowData[4].includes('Xả') || rowData[4].includes('Bom')) {
                                        $(td).css('color', 'red')
                                    } else if (rowData[4].includes('Có')) {
                                        $(td).css('color', '#F47803')
                                    }
                                    $(td).css('font-weight', 'bold');
                                }
                            }
                        },
                        {
                            target: 2,
                            searchable: true,
                            render: renderCommentSource,
                        },
                        {
                            target: 3,
                            createdCell: function (td, cellData, rowData, row, col) {
                                if (cellData.length > 0) {
                                    if (rowData[3].length > 0) {
                                        $(td).css('color', '#8E03F4')
                                    }
                                }
                            },
                            visible: false,
                        },
                        {
                            target: 4,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 5,
                            visible: false,
                            searchable: false,
                            createdCell: function (td, cellData, rowData, row, col) {
                                if (cellData.length > 0) {
                                    if (rowData[5].includes('CHỐT')) {
                                        $(td).css('color', 'blue');
                                    }
                                    else if (rowData[5].includes('XẢ')) {
                                        $(td).css('color', 'red');
                                    }
                                    $(td).css('font-weight', 'bold');
                                }
                            }
                        },
                        {
                            target: 6,
                            searchable: false,
                            createdCell: function (td, cellData, rowData, row, col) {
                                if (cellData.length > 0) {
                                    $(td).css('color', '#3BCB00')
                                    $(td).css('font-weight', 'bold');
                                }
                            }
                        },
                        {
                            target: 7,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 8,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 9,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 10,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 11,
                            searchable: false,
                        },
                        {
                            target: 12,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 13,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 14,
                            visible: false,
                            searchable: false,
                        },
                        {
                            target: 15,
                            visible: false,
                        },
                        {
                            target: 16,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 17,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 18,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 19,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 20,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 21,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 22,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 23,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 24,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 25,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 26,
                            searchable: false,
                            visible: false,
                        },
                        {
                            target: 27,
                            searchable: false,
                            visible: false,
                        },
                    ],
                    order: [27, 'desc'],//sort theo ID increment
                }
            );
            $('a.toggle-vis').on('click', function (e) {
                e.preventDefault();
                var column = t.column($(this).attr('data-column'));
                column.visible(!column.visible());
            });
            if (initkey === 0) {
                InItKeys();
            }
        }
    });
};
async function CreateLive() {
    var xxxx = document.getElementById("liveidinput").value;
    if (xxxx.length == 0) {
        return;
    }
    $.ajax({
        url: "/createlive",
        method: "POST",
        data: { liveid: xxxx },
        dataType: "JSON",
        success: function (data) { }
    });
}
var scancount = 0;
async function ScanComment(soluong) {
    var note = document.getElementById("livenote").value;
    var xxxx = document.getElementById("liveidinput").value;
    if (xxxx.length == 0) {
        return;
    }
    var t = $('#comment_table').DataTable();
    $.ajax({
        url: "/scancomment",
        method: "POST",
        data: { liveid: xxxx, note: note, soluong: soluong },
        dataType: "JSON",
        success: function (data) {
            if (data.data.hasOwnProperty('error')) {
                ShowCenterToast('danger', data.data.error, 3000);
                document.getElementById("scancomment").disabled = false;
                document.getElementById("scancomment").innerHTML = 'Quét';
                return;
            }
            if (data.data.length > 0) {
                for (i = 0; i < data.data.length; i++) {
                    var cmtidcol = t.column(8).data().toArray();
                    if (!cmtidcol.includes(data.data[i].commentid)) {
                        var note = data.data[i].note;
                        if (note === undefined || note === null || note == 'null') {
                            note = '';
                        }
                        var aka = data.data[i].aka;
                        var nuocngoai = data.data[i].nuocngoai;
                        var idpage = data.data[i].pageid;
                        var buttonpage1;
                        var buttonpage2;
                        if (aka == null) {
                            aka = '';
                        }
                        var xbel = '';
                        var xlabel = data.data[i].label;
                        if (data.data[i].chot.includes('CHỐT')) {
                            xbel = 'primary';
                        } else {
                            xbel = 'danger';
                        }
                        var zzzlabel = ``;
                        var zlabel = ``;
                        if (xlabel.includes('Nước')) {
                            zlabel = `<span class="badge bg-info">${xlabel}</span>`;
                        } else if (xlabel.includes('Xả') || xlabel.includes('Bom')) {
                            zlabel = `<span class="badge bg-danger">${xlabel}</span>`;
                        } else if (xlabel.includes('Thân')) {
                            zlabel = `<span class="badge bg-success">${xlabel}</span>`;
                        } else if (xlabel.includes('Có')) {
                            zlabel = `<span class="badge bg-warning">${xlabel}</span>`;
                        }
                        var phone = data.data[i].phone;
                        if (phone === null) {
                            phone = '';
                        }
                        var timesort = new Date(data.data[i].datecreate).getTime();
                        var name = `<img src="/images/ava/${data.data[i].userid}.jpg" class="avatar" onerror="tryAgain(this)">${data.data[i].name}`;
                        if (data.data[i].diachi.length > 0) {
                            name = name + `<svg width="20px" height="20px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="location-outline" fill="currentColor" transform="translate(106.666667, 42.666667)"> <path d="M149.333333,7.10542736e-15 C231.807856,7.10542736e-15 298.666667,66.8588107 298.666667,149.333333 C298.666667,176.537017 291.413333,202.026667 278.683512,224.008666 C270.196964,238.663333 227.080238,313.32711 149.333333,448 C71.5864284,313.32711 28.4697022,238.663333 19.9831547,224.008666 C7.25333333,202.026667 2.84217094e-14,176.537017 2.84217094e-14,149.333333 C2.84217094e-14,66.8588107 66.8588107,7.10542736e-15 149.333333,7.10542736e-15 Z M149.333333,85.3333333 C113.987109,85.3333333 85.3333333,113.987109 85.3333333,149.333333 C85.3333333,184.679557 113.987109,213.333333 149.333333,213.333333 C184.679557,213.333333 213.333333,184.679557 213.333333,149.333333 C213.333333,113.987109 184.679557,85.3333333 149.333333,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>`;
                        }
                        if (nuocngoai.includes('Nước ngoài')) {
                            name = name + `<svg fill="currentColor" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
                        }
                        if (aka.length > 0) {
                            name = name + `<i style="cursor:pointer" onclick="OpenAKAByPhone('${data.data[i].phone}','${data.data[i].userid}','${data.data[i].realfbid || ''}')" class="bi bi-people-fill" data-bs-toggle="tooltip" title="Trùng tên: ${aka}"></i>`;
                        }

                        if (data.data[i].realfbid != null) {
                            if (idpage == '223266991771270') {
                                if (data.data[i].realfbid.length > 0) {
                                    buttonpage1 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=223266991771270&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                                    buttonpage2 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=102116919355833&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                                } else {
                                    buttonpage1 = `<a onclick="OpenMessenger('223266991771270',${data.data[i].realfbid})"<i class="bi bi-messenger"></i></a>`;
                                    buttonpage2 = `<a onclick="OpenMessenger('102116919355833',${data.data[i].realfbid})"<i class="bi bi-messenger"></i></a>`;
                                }
                            }
                            if (idpage == '102116919355833') {
                                if (data.data[i].realfbid.length > 0) {
                                    buttonpage1 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=102116919355833&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                                    buttonpage2 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=223266991771270&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                                } else {
                                    buttonpage1 = `<a onclick="OpenMessenger('102116919355833',${data.data[i].realfbid})"<i class="bi bi-messenger"></i></a>`;
                                    buttonpage2 = `<a onclick="OpenMessenger('223266991771270',${data.data[i].realfbid})"<i class="bi bi-messenger"></i></a>`;
                                }
                            }
                        }
                        var buttonchat = `<a href="javascript:void(0);" data-customer-id="${data.data[i].userid}" data-customer-name="${data.data[i].name}" data-sender-page-id="${idpage}" class="open-message-modal"><i class="bi bi-chat-square-text-fill"></i></a>`;
                        if (phone.length > 0) {
                            name = name + `<br><span class="label label--pink">${phone}<a href="tel:${phone}">📱</a></span>`;
                        }
                        if (nuocngoai == 'Nước ngoài') {
                            if (phone.length > 0) {
                                name = name + `<span class="label label--lightpink">${nuocngoai}</span>`;
                            } else {
                                name = name + `<br><span class="label label--lightpink">${nuocngoai}</span>`;
                            }
                        }
                        if (xlabel.length > 0) {
                            if (xlabel.includes('Xả') || xlabel.includes('Bom')) {
                                zzzlabel = 'red';
                            } else if (xlabel.includes('Thân')) {
                                zzzlabel = 'green';
                            } else if (xlabel.includes('Có')) {
                                zzzlabel = 'orange';
                            } else if (xlabel.includes('Nước')) {
                                zzzlabel = 'lightpink';
                            }
                            if (phone.length > 0) {
                                name = name + `<span class="label label--${zzzlabel}">${xlabel}</span>`;
                            } else {
                                name = name + `<br><span class="label label--${zzzlabel}">${xlabel}</span>`;
                            }
                        }
                        var luotin = data.data[i].luotin;
                        if (luotin == 0) {
                            luotin = '&nbsp;';
                        }
                        t.row.add([
                            "",//0
                            name,//1
                            data.data[i].message,//2
                            phone,//3
                            zlabel,//4
                            `<center><span class="badge bg-${xbel}">${data.data[i].chot}</span></center>`,//5
                            `<center><span class="badge bg-success">${data.data[i].gia}</span>${(data.data[i].slchot > 1 ? `<span class='tag tag-purple tag-pulse'>x ${data.data[i].slchot}</span>` : '')}${ChotSecondPriceHtml(data.data[i].gia2, data.data[i].slchot2, true)}${(data.data[i].gia != '' && data.data[i].gia != null) ? XaBadgeHtml() : ''}</center>`,//6
                            data.data[i].count,//7
                            data.data[i].commentid,//8
                            timesort,//9
                            data.data[i].diachi,//10
                            buttonchat + buttonpage1 + buttonpage2,//11
                            data.data[i].userid,//12
                            data.data[i].datecreate,//13
                            data.data[i].timecomment,//14
                            data.data[i].fbnamex,//15
                            luotin,//16
                            data.data[i].liveid,//17
                            idpage,//18
                            note,//19
                            aka,//20
                            data.data[i].label,//21
                            data.data[i].realfbid,//22
                            nuocngoai,//23
                            data.data[i].threadid,//24
                            data.data[i].id,//25
                            data.data[i].name,//26
                            data.data[i].idx//27
                        ]).draw(false);
                    }
                }
            }
            ShowCenterToast('success', 'Đã quét bình luận', 3000);
            scancount++;
            if (scancount > 50) {
                RC();
                scancount = 0;
            }
        }
    });
};

socket.on('live-status', (data) => {
    var opt = document.getElementById(data.liveid);
    if (opt) {
        opt.setAttribute('data-status', data.status || '');
    }
    var selectedOpt = document.getElementById(e.value);
    var selectedLiveId = selectedOpt ? selectedOpt.id : null;
    if (data.liveid === selectedLiveId || data.liveid === currentPostId) {
        UpdateLiveStatusBadge(data.status);
        if (data.status === 'LIVE') {
            JoinLiveRoom(data.liveid);
        } else if (currentPostId === data.liveid) {
            LeaveLiveRoom();
        }
    }
});

function AddLiveComment(data, backfill = false) {
    var t = $('#comment_table').DataTable();
    var cmtidcol = t.column(8).data().toArray();
    if (cmtidcol.some(id => String(id) === String(data.cmtid))) return;

    var note = data.customerInfo.note;
    if (note === undefined || note === null) {
        note = '';
    }
    var message = data.message;
    if (message === null || message === undefined) {
        message = '';
    }
    var aka = data.customerInfo.aka;
    var nuocngoai = data.customerInfo.nuocngoai;
    var idpage = data.customerInfo.pageid;
    var buttonpage1;
    var buttonpage2;
    if (aka == null) {
        aka = '';
    }
    var xlabel = data.customerInfo.label;
    var zzzlabel = ``;
    var zlabel = ``;
    if (xlabel.includes('Nước')) {
        zlabel = `<span class="badge bg-info">${xlabel}</span>`;
    } else if (xlabel.includes('Xả') || xlabel.includes('Bom')) {
        zlabel = `<span class="label label--error">${xlabel}</span>`;
    } else if (xlabel.includes('Thân')) {
        zlabel = `<span class="badge bg-success">${xlabel}</span>`;
    } else if (xlabel.includes('Có')) {
        zlabel = `<span class="label label--orange">${xlabel}</span>`;
    }
    var phone = data.customerInfo.phone;
    var timesort = new Date(data.timelocal).getTime();
    var ava = `<img src="/images/ava/${data.customerInfo.userid}.jpg" class="avatar" onerror="tryAgain(this)">`;
    /*if (data.picture != undefined || data.picture != null) {
        ava = `<img src="${data.picture}" class="avatar" onerror="tryAgain(this)">`;
    }*/
    var name = ava + data.customerInfo.fbname;
    if (data.customerInfo.fbname.includes('Áo Dài Gia Bảo')) {
        name += `<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="15" height="15" viewBox="0 0 48 48">
<linearGradient id="csF85US9HGjIK87qotE6pa_QMxOVe0B9VzG_gr1" x1="24" x2="24" y1="3.999" y2="43.001" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2aa4f4"></stop><stop offset="1" stop-color="#007ad9"></stop></linearGradient><path fill="url(#csF85US9HGjIK87qotE6pa_QMxOVe0B9VzG_gr1)" d="M43.466,25.705l-2.599-4.259l1.293-4.817c0.187-0.694-0.146-1.424-0.793-1.738l-4.488-2.178	l-1.518-4.752c-0.219-0.686-0.888-1.114-1.607-1.033l-4.953,0.594l-3.846-3.178c-0.555-0.459-1.355-0.459-1.91,0l-3.846,3.178	l-4.953-0.594c-0.717-0.081-1.389,0.348-1.607,1.033l-1.518,4.752l-4.488,2.178c-0.646,0.314-0.979,1.044-0.793,1.738l1.293,4.817	l-2.599,4.259c-0.375,0.614-0.261,1.408,0.271,1.892l3.693,3.354l0.116,4.987c0.018,0.719,0.542,1.325,1.252,1.444l4.92,0.825	l2.795,4.133c0.403,0.595,1.172,0.822,1.833,0.538L24,40.913l4.585,1.966C28.776,42.961,28.977,43,29.175,43	c0.486,0,0.957-0.236,1.243-0.659l2.795-4.133l4.92-0.825c0.71-0.119,1.234-0.726,1.252-1.444l0.116-4.987l3.693-3.354	C43.727,27.113,43.841,26.319,43.466,25.705z"></path><path fill="#fff" d="M21.814,31c-0.322,0-0.646-0.104-0.92-0.316l-4.706-3.66c-0.436-0.339-0.514-0.967-0.175-1.403	l0.614-0.789c0.339-0.436,0.967-0.514,1.403-0.175l3.581,2.785l7.086-8.209c0.361-0.418,0.992-0.464,1.41-0.104l0.757,0.653	c0.418,0.361,0.464,0.992,0.104,1.41l-8.017,9.289C22.655,30.822,22.236,31,21.814,31z"></path>
</svg>`;
    }
    if (data.customerInfo.diachi.length > 0) {
        name = name + `<svg width="20px" height="20px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="location-outline" fill="currentColor" transform="translate(106.666667, 42.666667)"> <path d="M149.333333,7.10542736e-15 C231.807856,7.10542736e-15 298.666667,66.8588107 298.666667,149.333333 C298.666667,176.537017 291.413333,202.026667 278.683512,224.008666 C270.196964,238.663333 227.080238,313.32711 149.333333,448 C71.5864284,313.32711 28.4697022,238.663333 19.9831547,224.008666 C7.25333333,202.026667 2.84217094e-14,176.537017 2.84217094e-14,149.333333 C2.84217094e-14,66.8588107 66.8588107,7.10542736e-15 149.333333,7.10542736e-15 Z M149.333333,85.3333333 C113.987109,85.3333333 85.3333333,113.987109 85.3333333,149.333333 C85.3333333,184.679557 113.987109,213.333333 149.333333,213.333333 C184.679557,213.333333 213.333333,184.679557 213.333333,149.333333 C213.333333,113.987109 184.679557,85.3333333 149.333333,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>`;
    }
    if (nuocngoai.includes('Nước ngoài')) {
        name = name + `<svg fill="currentColor" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
    }
    if (aka.length > 0) {
        name = name + `<i style="cursor:pointer" onclick="OpenAKAByPhone('${data.customerInfo.phone}','${data.customerInfo.userid}','${data.customerInfo.realfbid || ''}')" class="bi bi-people-fill" data-bs-toggle="tooltip" title="Trùng tên: ${aka}"></i>`;
    }
    if (data.customerInfo.realfbid != null) {
        if (idpage == '223266991771270') {
            if (data.customerInfo.realfbid.length > 0) {
                buttonpage1 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=223266991771270&selected_item_id=${data.customerInfo.realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                buttonpage2 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=102116919355833&selected_item_id=${data.customerInfo.realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
            } else {
                buttonpage1 = `<a onclick="OpenMessenger('223266991771270',${data.customerInfo.realfbid})"<i class="bi bi-messenger"></i></a>`;
                buttonpage2 = `<a onclick="OpenMessenger('102116919355833',${data.customerInfo.realfbid})"<i class="bi bi-messenger"></i></a>`;
            }
        }
        if (idpage == '102116919355833') {
            if (data.customerInfo.realfbid.length > 0) {
                buttonpage1 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=102116919355833&selected_item_id=${data.customerInfo.realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                buttonpage2 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=223266991771270&selected_item_id=${data.customerInfo.realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
            } else {
                buttonpage1 = `<a onclick="OpenMessenger('102116919355833',${data.customerInfo.realfbid})"<i class="bi bi-messenger"></i></a>`;
                buttonpage2 = `<a onclick="OpenMessenger('223266991771270',${data.customerInfo.realfbid})"<i class="bi bi-messenger"></i></a>`;
            }
        }
    }
    var buttonchat = `<a href="javascript:void(0);" data-customer-id="${data.customerInfo.userid}" data-customer-name="${data.customerInfo.fbname}" data-sender-page-id="${idpage}" class="open-message-modal"><i class="bi bi-chat-square-text-fill"></i></a>`;
    if (phone.length > 0) {
        name = name + `<br><span class="label label--pink">${phone}<a href="tel:${phone}">📱</a></span>`;
    }
    if (nuocngoai == 'Nước ngoài') {
        if (phone.length > 0) {
            name = name + `<span class="label label--lightpink">${nuocngoai}</span>`;
        } else {
            name = name + `<br><span class="label label--lightpink">${nuocngoai}</span>`;
        }
    }
    if (xlabel.length > 0) {
        if (xlabel.includes('Xả') || xlabel.includes('Bom')) {
            zzzlabel = 'red';
        } else if (xlabel.includes('Thân')) {
            zzzlabel = 'green';
        } else if (xlabel.includes('Có')) {
            zzzlabel = 'orange';
        } else if (xlabel.includes('Nước')) {
            zzzlabel = 'lightpink';
        }
        if (phone.length > 0) {
            name = name + `<span class="label label--${zzzlabel}">${xlabel}</span>`;
        } else {
            name = name + `<br><span class="label label--${zzzlabel}">${xlabel}</span>`;
        }
    }
    var t = $('#comment_table').DataTable();
    const oldinfo = t.page.info();
    const oldTotalRowFilter = oldinfo.recordsDisplay;

    var added = t.row.add([
        "",
        name,
        message,
        phone,
        zlabel,
        backfill && data.chot ? `<center><span class="badge ${data.chot.includes('CHỐT') ? 'bg-primary' : 'bg-danger'}">${gbEscapeText(data.chot)}</span></center>` : "",
        backfill && data.gia ? `<center>${ChotPriceTags(data.gia, data.slchot, data.gia2, data.slchot2)}${XaBadgeHtml()}</center>` : "",
        backfill ? data.count || 0 : 0,
        data.cmtid,
        timesort,
        data.customerInfo.diachi,
        buttonchat + buttonpage1 + buttonpage2,
        data.customerInfo.userid,
        data.timelocal,
        backfill ? data.timecomment || 0 : 0,
        data.customerInfo.fbnamex,
        backfill ? data.luotin || 0 : 0,
        data.liveid,
        idpage,
        note,
        aka,
        data.customerInfo.label,
        data.customerInfo.realfbid,
        nuocngoai,
        data.customerInfo.threadid,
        data.customerInfo.id,
        data.customerInfo.fbname,
        data.idx
    ]);
    if (backfill) return;
    added.draw(false);
    const newinfo = t.page.info();
    const newTotalRowFilter = newinfo.recordsDisplay;
    const focusedCell = t.cell({ focused: true });
    const filtertext = $('#comment_table_filter input').val();
    if (focusedCell.any() && filtertext == '') {
        t.keys.move('down');
    } else {
        if (filtertext != '' && oldTotalRowFilter < newTotalRowFilter) {
            t.keys.move('down');
        }
    }
}

socket.on('new-comment', data => {
    if (currentPostId === String(data.liveid)) AddLiveComment(data);
});

async function UpdatePhone(selectedRow) {
    var data = selectedRow || $('#comment_table').DataTable().row(getRowIdx()).data();
    if (!data) return;
    var phone = '';
    var oldphone = String(data[3] || '');
    var userid = data[12];
    var diachi = data[10];
    var realfbid = data[22];
    var liveid = data[17];

    var regexp = "0[98735]([0-9]|\s|-|\.){8,12}";
    let phone_numbers = [];
    phone_numbers = [...String(data[2] || '').matchAll(regexp)];
    for (const match of phone_numbers) {
        phone = match[0].replaceAll(' ', '').replace(/\D/g, '');
    }
    if (phone.length < 10 || (oldphone.length > 1 && phone.includes(oldphone.slice(2, -2)))) {
        return;
    }

    if (phone.length > 0) {
        if (oldphone.length < 9) {
            SendWelcome(data);
        }
        await sendPhoneUpdate(userid, phone, realfbid, diachi, liveid);
    }
}

async function sendPhoneUpdate(userid, phone, realfbid, diachi, liveid) {
    try {
        const response = await fetch("/updatephone", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userid: userid, phone: phone, realfbid: realfbid, liveid: liveid, socketid: socket.id }),
        });

        const data = await response.json();

        if (data.data && data.data.hasOwnProperty('name')) {
            let labelx = '';
            if (data.data.bom != 'none') {
                if (data.data.bom.includes('Có')) {
                    labelx = ' - <span class="badge bg-warning">' + data.data.bom + '</span>';
                } else if (data.data.bom.includes('hàng')) {
                    labelx = ' - <span class="badge bg-danger">' + data.data.bom + '</span>';
                }
                ShowAKA('Trùng SĐT', 'Số điện thoại này được dùng bởi: ', data.data.name + labelx, diachi, data.data.list);
            } else {
                ShowAKA('Trùng SĐT', 'Số điện thoại này được dùng bởi: ', data.data.name, diachi, data.data.list);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

socket.on('new-share', (data) => {
    ShowCenterToast('success', (data.fbname || 'Một khách hàng') + ' vừa chia sẻ livestream', 4000);
});

socket.on('new-phone', (data) => {
    var table = $('#comment_table').DataTable();
    var updated = false;
    table.rows().every(function (rowIdx) {
        if (table.cell(rowIdx, 12).data() == data.userid) {
            if (table.cell(rowIdx, 3).data() != data.phone) {
                updated = true;
            }
            table.cell(rowIdx, 3).data(data.phone);
            if (!table.cell(rowIdx, 1).data().includes(data.phone)) {
                table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data() + `<br><span class="label label--pink">` + data.phone + `<a href="tel:${data.phone}">📱</a></span>`);
            }
        }
    }).draw(false);
    if (updated) {
        ShowCenterToast('success', 'Đã cập nhật số điện thoại: ' + data.phone, 3000);
    }
});


function highAndLow(numbers) {
    var arr = numbers.split(",").map(Number);
    var largest = arr[0];
    for (var i = 1; i < arr.length; i++) {
        if (arr[i] > largest) {
            largest = arr[i];
        }
    }
    return largest;
}
const pendingChot = Object.create(null);

async function Chot(buttongia, extra) {
    var table = $('#comment_table').DataTable();
    if (table.rows().count() === 0) return false;

    var data = null;
    if (extra && extra.commentid) {
        table.rows().every(function () {
            var d = this.data();
            if (!data && d && d[8] == extra.commentid) data = d;
        });
    } else {
        data = table.row(getRowIdx()).data();
    }
    if (!data) return false;

    var commentid = data[8];
    var liveid = data[17];
    if (pendingChot[commentid]) {
        return false;
    }

    var id = data[25];
    var realid = data[22];
    var rawNameHtml = data[1];
    var avatarUrl = $('<div>').html(rawNameHtml).find('img').attr('src') || "";

    if (avatarUrl && avatarUrl.startsWith('/')) {
        avatarUrl = window.location.origin + avatarUrl;
    }

    var slchot, gia, gia2 = '', slchot2 = '';
    if (extra && extra.gia2) {
        slchot = extra.slchot1;
        gia = extra.gia1;
        gia2 = String(extra.gia2).replace(/[^0-9]/g, '');
        slchot2 = extra.slchot2;
    } else {
        slchot = parseInt(document.getElementById("slchot").value) || 1;
        document.getElementById("slchot").value = 1;
        gia = buttongia > 0 ? buttongia : document.getElementById("gia").value;
    }
    var cleanPrice = gia.toString().replace(/[^0-9]/g, "");
    void UpdatePhone(data).catch(error => console.error('Lỗi cập nhật số điện thoại khi chốt:', error));
    if (!realid) {
        UpdateComment(0, data);
    }

    table.rows().every(function (rowIdx) {
        if (table.cell(rowIdx, 8).data() == commentid) {
            table.cell(rowIdx, 5).data("<center><span class='badge bg-secondary'>Đang chốt...</span></center>");
        }
    }).draw(false);

    pendingChot[commentid] = {
        liveid: liveid,
        id: id,
        rawNameHtml: rawNameHtml,
        avatarUrl: avatarUrl,
        phone: data[3],
        comment: data[2],
        note: document.getElementById("livenote").value,
        address: data[10],
        region: data[23],
        gia: cleanPrice,
        slchot: slchot,
        gia2: gia2,
        slchot2: slchot2,
        timeoutId: setTimeout(function () {
            FailChot(commentid, 'Không nhận được phản hồi từ máy chủ, vui lòng thử lại.');
        }, 10000)
    };

    $.ajax({
        url: "/updatechot",
        method: "POST",
        data: { commentid: commentid, chot: "CHỐT", gia: gia, liveid: liveid, slchot: slchot, gia2: gia2, slchot2: slchot2, socketid: socket.id },
        dataType: "JSON",
        error: function () {
            FailChot(commentid, 'Gửi yêu cầu chốt đơn thất bại.');
        }
    });
    return true;
}

function FailChot(commentid, message) {
    if (!pendingChot[commentid]) return;
    clearTimeout(pendingChot[commentid].timeoutId);
    delete pendingChot[commentid];
    var table = $('#comment_table').DataTable();
    table.rows().every(function (rowIdx) {
        if (table.cell(rowIdx, 8).data() == commentid) {
            table.cell(rowIdx, 5).data("<center><span class='badge bg-danger'>Lỗi, thử lại</span></center>");
        }
    }).draw(false);
    ShowToast('danger', `<i class="bi bi-x-octagon"></i>`, 'Chốt đơn', message, 4000);
}

socket.on('new-chot', async (data) => {
    var table = $('#comment_table').DataTable();
    var luotcuoilive = data.luotcuoilive;

    var pricehtml = ChotPriceTags(data.gia, data.slchot, data.gia2, data.slchot2);

    table.rows().every(function (rowIdx) {
        if (table.cell(rowIdx, 8).data() == data.cid) {
            table.cell(rowIdx, 5).data("<center><span class='badge bg-primary'>CHỐT</span></center>");
            table.cell(rowIdx, 6).data(`<center>${pricehtml}${XaBadgeHtml()}</center>`);
            table.cell(rowIdx, 16).data(luotcuoilive);
        }
    }).draw(false);

    let liveElement = document.getElementById(data.liveid);
    if (liveElement) {
        liveElement.innerHTML = liveElement.innerHTML.split('-')[0] + '- ' + luotcuoilive;
    }

    var pending = pendingChot[data.cid];
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    delete pendingChot[data.cid];

    var printData = {
        date: ToDay(),
        luotcuoi: luotcuoilive,
        name: pending.rawNameHtml.split('<br>')[0].replace(/<[^>]*>?/gm, '').trim(),
        phone: pending.phone ? pending.phone.replace(/<[^>]*>?/gm, '').trim() : "",
        comment: pending.comment ? pending.comment.replace(/<[^>]*>?/gm, '').trim() : "",
        gia: pending.gia,
        id: pending.id,
        avabase64: pending.avatarUrl,
        note: pending.note,
        address: pending.address,
        region: pending.region
    };

    var lines = [{ gia: pending.gia, sl: pending.slchot }];
    if (pending.gia2) lines.push({ gia: pending.gia2, sl: pending.slchot2 });
    for (var li = 0; li < lines.length; li++) {
        var resPdf = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({}, printData, { gia: lines[li].gia }))
        }).then(r => r.json());

        if (resPdf.success) {
            for (var k = 0; k < lines[li].sl; k++) {
                fetch('/print-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: window.CURRENT_USER_ID,
                        type: 'pdf',
                        content: resPdf.pdfBase64,
                        config: { printerName: "XP-80C", widthMm: 80, heightMm: 297, marginTopPx: -5 }
                    })
                });
            }
        }
    }
});

function ChotPriceTags(gia, sl, gia2, sl2) {
    var html = '';
    if (gia !== '' && gia != null) {
        html += `<span class='tag tag-green tag-pulse'>💰${gia}</span>`;
        if (sl > 1) html += `<span class='tag tag-purple tag-pulse'>x ${sl}</span>`;
    }
    if (gia2 !== '' && gia2 != null) {
        html += ChotSecondPriceHtml(gia2, sl2, false);
    }
    return html;
}

function ChotSecondPriceHtml(gia2, sl2, badge) {
    if (gia2 === '' || gia2 == null) return '';
    var html = badge
        ? `<span class="badge bg-success chot-p2">${gia2}</span>`
        : `<span class='tag tag-green tag-pulse chot-p2'>💰${gia2}</span>`;
    if (sl2 > 1) html += `<span class='tag tag-purple tag-pulse'>x ${sl2}</span>`;
    return html;
}

function ChotPricesFromCell(cellHtml) {
    var out = [];
    if (!cellHtml) return out;
    $('<div>').html(cellHtml).find('.tag-green, .badge.bg-success, .tag-purple').each(function () {
        var el = $(this);
        if (el.hasClass('tag-purple')) {
            if (out.length) out[out.length - 1].sl = parseInt(el.text().replace(/[^0-9]/g, ''), 10) || 1;
        } else {
            out.push({ gia: el.text().replace(/[^0-9]/g, '') || '0', sl: 1 });
        }
    });
    return out;
}

function EnsureChot2Modal() {
    if (document.getElementById('modalchot2')) return;
    document.body.insertAdjacentHTML('beforeend',
        `<div class="modal fade" tabindex="-1" id="modalchot2" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content rounded-4 shadow">
        <div class="modal-header border-0 pb-0">
          <h5 class="modal-title fw-bold">Chốt 2 giá</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
        </div>
        <div class="modal-body">
          <div id="chot2who" class="text-muted mb-3"></div>
          <div class="row g-2 align-items-end mb-2">
            <div class="col-7"><label class="form-label mb-1" for="chot2gia1">Giá 1</label><input type="text" inputmode="numeric" class="form-control" id="chot2gia1" autocomplete="off"></div>
            <div class="col-5"><label class="form-label mb-1" for="chot2sl1">SL giá 1</label><input type="number" min="1" max="20" class="form-control" id="chot2sl1" autocomplete="off"></div>
          </div>
          <div class="row g-2 align-items-end mb-3">
            <div class="col-7"><label class="form-label mb-1" for="chot2gia2">Giá 2</label><input type="text" inputmode="numeric" class="form-control" id="chot2gia2" autocomplete="off"></div>
            <div class="col-5"><label class="form-label mb-1" for="chot2sl2">SL giá 2</label><input type="number" min="1" max="20" class="form-control" id="chot2sl2" autocomplete="off"></div>
          </div>
          <div id="chot2total" class="fw-bold"></div>
          <div id="chot2err" class="text-danger small mt-1"></div>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button type="button" class="btn btn-light" data-bs-dismiss="modal">Hủy</button>
          <button type="button" class="btn btn-success" id="chot2btn">Chốt</button>
        </div>
      </div>
    </div>
  </div>`);
    var ids = ['chot2gia1', 'chot2sl1', 'chot2gia2', 'chot2sl2'];
    ids.forEach(function (id, i) {
        var el = document.getElementById(id);
        el.addEventListener('input', Chot2Recalc);
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (i < ids.length - 1) { var n = document.getElementById(ids[i + 1]); n.focus(); n.select(); }
                else SubmitChot2();
            }
        });
    });
    document.getElementById('chot2btn').addEventListener('click', SubmitChot2);
    $('#modalchot2').on('shown.bs.modal', function () {
        var g = document.getElementById('chot2gia1');
        g.focus(); g.select();
    });
}

var chot2Pending = null;

function Chot2Read() {
    var g1 = document.getElementById('chot2gia1').value.replace(/[^0-9]/g, '').replace(/^0+/, '');
    var g2 = document.getElementById('chot2gia2').value.replace(/[^0-9]/g, '').replace(/^0+/, '');
    var s1 = parseInt(document.getElementById('chot2sl1').value, 10);
    var s2 = parseInt(document.getElementById('chot2sl2').value, 10);
    return { g1: g1, g2: g2, s1: s1, s2: s2 };
}

function Chot2Recalc() {
    var v = Chot2Read();
    var total = (parseInt(v.g1, 10) || 0) * (v.s1 > 0 ? v.s1 : 0) + (parseInt(v.g2, 10) || 0) * (v.s2 > 0 ? v.s2 : 0);
    document.getElementById('chot2total').textContent = total > 0 ? 'Tổng: ' + (total * 1000).toLocaleString('vi-VN') + 'đ' : '';
    document.getElementById('chot2err').textContent = '';
}

function OpenChot2Modal(rowData) {
    var table = $('#comment_table').DataTable();
    var data = rowData;
    if (!data) {
        try { data = table.row(getRowIdx()).data(); } catch (e) { data = null; }
    }
    if (!data) return;
    EnsureChot2Modal();
    var name = $('<div>').html(data[1]).contents().filter(function () { return this.nodeType === 3; }).first().text().trim();
    chot2Pending = { commentid: data[8] };
    document.getElementById('chot2who').textContent = name;
    document.getElementById('chot2gia1').value = (document.getElementById('gia').value || '').replace(/[^0-9]/g, '');
    document.getElementById('chot2sl1').value = parseInt(document.getElementById('slchot').value, 10) || 1;
    document.getElementById('chot2gia2').value = '';
    document.getElementById('chot2sl2').value = 1;
    Chot2Recalc();
    $('#modalchot2').modal('show');
}

function SubmitChot2() {
    var v = Chot2Read();
    var err = document.getElementById('chot2err');
    if (!v.g1 || !v.g2) { err.textContent = 'Nhập đủ cả 2 giá.'; return; }
    if (!(v.s1 >= 1) || !(v.s2 >= 1)) { err.textContent = 'Số lượng mỗi giá phải từ 1 trở lên.'; return; }
    if (v.s1 + v.s2 > 20) { err.textContent = 'Tổng số lượng tối đa 20.'; return; }
    if (!chot2Pending) return;
    var p = chot2Pending;
    chot2Pending = null;
    document.getElementById('slchot').value = 1;
    $('#modalchot2').modal('hide');
    Chot(0, { commentid: p.commentid, gia1: v.g1, slchot1: v.s1, gia2: v.g2, slchot2: v.s2 });
}


function XaBadgeHtml() {
    return `<span class='tag tag-red tag-pulse badge-xa-gia' role='button' style='cursor:pointer;margin-left:4px;' title='Xả hàng đơn này'>Xả</span>`;
}

var xaPending = null;

function EnsureXaConfirmModal() {
    if (document.getElementById('modalxaconfirm')) return;
    document.body.insertAdjacentHTML('beforeend',
        `<div class="modal fade" tabindex="-1" id="modalxaconfirm" aria-hidden="true">
    <div class="modal-dialog modal-sm modal-dialog-centered">
      <div class="modal-content rounded-4 shadow">
        <div class="modal-body text-center p-4">
          <h5 class="fw-bold mb-2">Xác nhận xả hàng?</h5>
          <div id="xaconfirmtext" class="mb-3 text-muted"></div>
          <div class="d-flex justify-content-center gap-2">
            <button type="button" class="btn btn-light" data-bs-dismiss="modal">Hủy</button>
            <button type="button" class="btn btn-danger" id="xaconfirmbtn">Xả</button>
          </div>
        </div>
      </div>
    </div>
  </div>`);
    document.getElementById('xaconfirmbtn').addEventListener('click', function () {
        if (xaPending) {
            var p = xaPending;
            xaPending = null;
            XaHang(p.commentid, p.liveid);
        }
        $('#modalxaconfirm').modal('hide');
    });
    $('#modalxaconfirm').on('shown.bs.modal', function () {
        document.getElementById('xaconfirmbtn').focus();
    });
    $('#modalxaconfirm').on('hidden.bs.modal', function () {
        xaPending = null;
    });
}

document.addEventListener('click', function (e) {
    var badge = e.target.closest('#comment_table tbody .badge-xa-gia');
    if (!badge) return;
    e.stopPropagation();
    var tr = badge.closest('tr');
    var row = $('#comment_table').DataTable().row(tr);
    var data = row.data();
    if (!data) return;
    var name = $('<div>').html(data[1]).contents().filter(function () { return this.nodeType === 3; }).first().text().trim();
    var gia = ChotPricesFromCell(data[6]).map(function (x) { return x.gia + (x.sl > 1 ? ' x' + x.sl : ''); }).join(' + ');
    var sl = '';
    xaPending = { commentid: data[8], liveid: data[17] };
    EnsureXaConfirmModal();
    document.getElementById('xaconfirmtext').textContent = [name, gia, sl].filter(Boolean).join(' ');
    $('#modalxaconfirm').modal('show');
}, true);

function XaHang(cid, lid) {
    var table = $('#comment_table').DataTable();
    var commentid = cid;
    var liveid = lid;
    if (!commentid) {
        var data = table.row(getRowIdx()).data();
        commentid = data[8];
        liveid = data[17];
    }
    table.rows().every(function (rowIdx, tableLoop, rowLoop) {
        if (table.cell(rowIdx, 8).data() == commentid) {
            table.cell(rowIdx, 5).data("<center><span class='badge bg-secondary'>Đang xả...</span></center>");
        }
    }).draw(false);
    $.ajax({
        url: "/updatexa",
        method: "POST",
        data: { commentid: commentid, chot: "XẢ", liveid: liveid, socketid: socket.id },
        dataType: "JSON",
        error: function () {
            ShowToast('danger', `<i class="bi bi-x-octagon"></i>`, 'Xả hàng', 'Gửi yêu cầu xả hàng thất bại, vui lòng thử lại.', 4000);
        }
    });
}

socket.on('new-xa', (data) => {
    var table = $('#comment_table').DataTable();
    table.rows().every(function (rowIdx) {
        if (table.cell(rowIdx, 8).data() == data.cid) {
            table.cell(rowIdx, 5).data("<center><span class='badge bg-danger'>XẢ</span></center>");
            table.cell(rowIdx, 6).data("");
        }
    }).draw(false);
});

function IsRealCommentId(cid) {
    return typeof cid === 'string' && (cid.match(/_/g) || []).length === 1;
}

function SendWelcome(selectedRow) {
    var d = selectedRow || $('#comment_table').DataTable().row(getRowIdx()).data();
    if (!d || !IsRealCommentId(String(d[8]))) {
        return;
    }
    SendMessage("Chào chị, để gửi hàng nhanh nhất, em xin địa chỉ để khi chốt hàng em xác nhận đơn và chuyển hàng liền cho chị ạ. Em cám ơn!", d);
}

function SendMessage(chat, selectedRow) {
    var data = selectedRow || $('#comment_table').DataTable().row(getRowIdx()).data();
    var commentid = data[8];
    var userid = data[12];//neu ko co thi dung streamlabs id
    var pageid = data[18];
    $.ajax({
        url: "/replycomment",
        method: "POST",
        data: { commentid: commentid, pageid: pageid, userid: userid, chat: chat },
        dataType: "JSON",
        success: function (x) {
            if (x.data.skipped) { return; }
            if (x.data.hasOwnProperty('message_id')) {
                ShowCenterToast('success', 'Đã gửi tin nhắn cho: ' + data[1].split('avatar">').pop().split('<br')[0], 3000);
            } else {
                var mess = x.data.error.message;
                if (mess.includes('Activity already replied to')) {
                    ShowCenterToast('danger', data[1].split('avatar">').pop().split('<br')[0] + ': Bình luận này đã trả lời rồi.', 3000);
                } else if (mess.includes('This user cant reply to this activity')) {
                    ShowCenterToast('danger', data[1].split('avatar">').pop().split('<br')[0] + ': Người này đã chặn bạn nhắn tin.', 3000);
                } else if (IsDeletedCommentError(x.data.error)) {
                    ShowCenterToast('danger', data[1].split('avatar">').pop().split('<br')[0] + ': Bình luận đã bị xóa.', 3000);
                } else if (mess.includes('Activity replying time expired')) {
                    ShowCenterToast('danger', data[1].split('avatar">').pop().split('<br')[0] + ': Bình luận này đã quá 7 ngày, không thể nhắn tin', 3000);
                } else if (mess.includes('The session is invalid because the user logged out')) {
                    ShowCenterToast('danger', data[1].split('avatar">').pop().split('<br')[0] + ': Lỗi kết nối tài khoản nhắn tin. Vui lòng làm mới kết nối/', 3000);
                } else {
                    ShowCenterToast('danger', data[1].split('avatar">').pop().split('<br')[0] + ': ' + mess, 3000);
                }
            }
        },
        error: function (xhr) {
            const result = xhr.responseJSON || {};
            const reason = result.error || result.data?.error?.message || 'Không nhận được phản hồi gửi tin. Kiểm tra cuộc trò chuyện trước khi thử lại.';
            ShowCenterToast('danger', reason, 5000);
        }
    });
};
document.addEventListener('DOMContentLoaded', (event) => {
    const holdToastCheckbox = document.getElementById('holdToast');
    if (holdToastCheckbox && lockToast === 1) {
        holdToastCheckbox.checked = true;
    }
});

var holdToastEl = document.getElementById('holdToast');
if (holdToastEl) {
    holdToastEl.addEventListener('change', function () {
        if (this.checked) {
            lockToast = 1;
        } else {
            lockToast = 0;
        }
    });
}

function GetPriceFromCell(cellHtml) {
    if (!cellHtml) return "0";
    var priceText = $('<div>').html(cellHtml).find('.tag-green, .badge.bg-success').first().text();
    return priceText.replace(/[^0-9]/g, "") || "0";
}

async function handlePrintLabel(rowElement) {
    var data = $('#comment_table').DataTable().row(rowElement).data();
    if (!data) return;

    var rawNameHtml = data[1];
    var avatarUrl = $('<div>').html(rawNameHtml).find('img').attr('src') || "";

    if (avatarUrl && avatarUrl.startsWith('/')) {
        avatarUrl = window.location.origin + avatarUrl;
    }

    var printData = {
        date: ToDay(),
        name: rawNameHtml.split('<br>')[0].replace(/<[^>]*>?/gm, '').trim(),
        phone: data[3] ? data[3].replace(/<[^>]*>?/gm, '').trim() : "",
        comment: data[2] ? data[2].replace(/<[^>]*>?/gm, '').trim() : "",
        gia: GetPriceFromCell(data[6]),
        id: data[25],
        avabase64: avatarUrl,
        address: data[10],
        region: data[23]
    };

    var prices = ChotPricesFromCell(data[6]).map(function (x) { return x.gia; });
    if (prices.length === 0) prices = [printData.gia];
    for (var pi = 0; pi < prices.length; pi++) {
        const resPdf = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({}, printData, { gia: prices[pi] }))
        }).then(r => r.json());

        if (resPdf.success) {
            fetch('/print-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: window.CURRENT_USER_ID,
                    type: 'pdf',
                    content: resPdf.pdfBase64,
                    config: { printerName: "XP-80C", widthMm: 80, heightMm: 297, marginTopPx: -5 }
                })
            }).then(r => r.json()).then(res => {
                //if (res.success) console.log("In thành công!");
            });
        }
    }
}

(function () {
    document.addEventListener('dblclick', function (e) {
        var tr = e.target.closest('#comment_table tbody tr');
        if (tr) handlePrintLabel(tr);
    }, true);
    /*
    var lastTapComment = 0;
    document.addEventListener('touchend', function (e) {
        var tr = e.target.closest('#comment_table tbody tr');
        if (!tr) return;
        var currentTime = new Date().getTime();
        var tapLength = currentTime - lastTapComment;
        if (tapLength < 300 && tapLength > 0) {
            e.preventDefault();
            handlePrintLabel(tr);
        }
        lastTapComment = currentTime;
    }, true);*/
})();

async function ChotMobile() {
    var giaM = document.getElementById('gia_m');
    var slM = document.getElementById('slchot_m');
    var gia = (giaM.value || '').trim();
    var sl = parseInt(slM.value, 10) || 1;
    if (gia.length === 0) {
        ShowCenterToast('danger', 'Vui lòng nhập giá', 2000);
        giaM.focus();
        return;
    }
    if (!mobileChotCommentId) {
        ShowCenterToast('danger', 'Chạm vào bình luận cần chốt trước', 2500);
        return;
    }
    if (pendingChot[mobileChotCommentId]) return;
    document.getElementById('gia').value = gia;
    document.getElementById('slchot').value = sl;
    try {
        if (await Chot(0, { commentid: mobileChotCommentId })) {
            slM.value = 1;
        } else {
            ShowCenterToast('warning', 'Không tìm thấy dòng đã chọn. Chạm lại bình luận cần chốt.', 3500);
        }
    } catch (error) {
        console.error('Lỗi chốt trên điện thoại:', error);
        ShowCenterToast('danger', 'Không chốt được. Vui lòng thử lại.', 3500);
    }
}

function InitMobileChot() {
    if (document.getElementById('chot_mobile_box')) return;
    var anchor = document.getElementById('liveStatusBadge');
    if (!anchor) return;
    const comments = $('#comment_table');
    function highlightMobileSelection(table) {
        table.rows({ page: 'current' }).every(function () {
            const row = this.data();
            this.node()?.classList.toggle('table-active', Boolean(mobileChotCommentId && row && String(row[8]) === mobileChotCommentId));
        });
    }
    comments.on('click.gbMobileChot', 'tbody tr', function () {
        if (!window.matchMedia('(max-width: 767.98px)').matches || !$.fn.dataTable.isDataTable(comments[0])) return;
        const table = comments.DataTable();
        const row = table.row(this).data();
        if (!row || !row[8]) return;
        mobileChotCommentId = String(row[8]);
        highlightMobileSelection(table);
    });
    comments.on('draw.dt.gbMobileChot', function (event, settings) {
        if (mobileChotCommentId) highlightMobileSelection(new $.fn.dataTable.Api(settings));
    });
    anchor.insertAdjacentHTML('afterend',
        `<div id="chot_mobile_box" class="d-md-none ms-2 align-middle" style="display:inline-block;">
            <div class="d-flex align-items-center gap-1">
                <input type="text" inputmode="numeric" id="slchot_m" class="form-control form-control-sm text-center" style="width:52px;" placeholder="SL" value="1">
                <input type="text" inputmode="numeric" id="gia_m" class="form-control form-control-sm text-center" style="width:74px;" placeholder="Giá">
                <button type="button" id="chot_m_btn" class="btn btn-primary btn-sm">OK</button>
            </div>
        </div>`);
    document.getElementById('chot_m_btn').addEventListener('click', ChotMobile);
    document.getElementById('gia_m').addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ChotMobile();
        }
        ev.stopPropagation();
    });
    document.getElementById('slchot_m').addEventListener('keydown', function (ev) {
        ev.stopPropagation();
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', InitMobileChot);
} else {
    InitMobileChot();
}
