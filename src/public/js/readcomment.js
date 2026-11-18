var e = document.getElementById("liveidcombobox");
var liveidfrominput = document.getElementById("liveidinput");
var html = '';
const toast = new Bs5Utils();
function ADS() {
    const widget = document.getElementById('referral-widget');
    if (widget.style.display === 'none') {
        widget.style.display = 'block';
    } else {
        widget.style.display = 'none';
    }
}
function InItKeys(table) {
    table.off('key.gbReadComment').on('key.gbReadComment', function (event, datatable, keyCode, cell, originalEvent) {
        if (document.querySelector('.modal.show') || originalEvent?.target?.closest?.('input, textarea, select')) return;
        const row = datatable.row(cell.index().row).data();
        if (!row) return;

        if (keyCode === 85) {
            ShowCustomerDetails({
                name: EditPlainName(row[1], row[12]), userid: row[12], phone: row[3], diachi: row[10],
                note: row[19], label: row[21], realfbid: row[23], nn: row[24],
                trigger: document.activeElement, readOnly: true
            });
        } else if (keyCode === 78 && !originalEvent?.shiftKey) {
            LuckyAdd(row[12], row[15] || $('<div>').html(row[1]).text(),
                String(row[3] || '').replace(/<[^>]*>?/gm, '').trim(), row[26],
                $('<div>').html(row[1]).find('img').attr('src') || '');
        } else if (keyCode === 76) {
            window.open('https://www.facebook.com/watch/?v=' + row[17] + '&t=' + (row[7] - 100), '_blank')?.focus();
        }
    });
}

async function LoadLive() {
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
                ShowToast('primary', '<div class="spinner-border text-light" role="status"></div>&nbsp;', 'Quét bình luận', `Live đang phát trực tiếp, đang nhận bình luận realtime cho ID: ${liveid}`, 3000);
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
                ShowToast('danger', `<i class="bi bi-calendar-x"></i>`, 'Load bình luận', data.data.error, 3000);
                document.getElementById("btnloadlive").disabled = false;
                document.getElementById("btnloadlive").innerHTML = 'Load';
                return;
            }
            if (data.data.length > 0) {
                for (i = 0; i < data.data.length; i++) {
                    var cmtidcol = t.column(8).data().toArray();
                    if (!cmtidcol.includes(data.data[i].commentid)) {
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
                            name = name + `<svg width="15px" height="15px" viewBox="0 0 1024 1024" class="icon" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M523.9 986.4l-19.1-9.5c-16.6-8.3-407.6-207.7-407.6-550.2C97.2 191.4 288.6 0 523.9 0s426.7 191.4 426.7 426.7c0 342.4-390.9 541.8-407.6 550.2l-19.1 9.5z m0-901.1c-188.2 0-341.3 153.1-341.3 341.3 0 250.3 266.8 420.6 341.3 463.4 74.6-42.7 341.3-213.1 341.3-463.4 0-188.1-153.1-341.3-341.3-341.3z" fill="#3688FF"></path><path d="M523.9 533.3c-70.6 0-128-57.4-128-128s57.4-128 128-128 128 57.4 128 128-57.5 128-128 128z m0-170.6c-23.5 0-42.7 19.1-42.7 42.7s19.1 42.7 42.7 42.7c23.5 0 42.7-19.1 42.7-42.7s-19.2-42.7-42.7-42.7z" fill="#5F6379"></path></g></svg>`;
                        }
                        if (nuocngoai.includes('Nước ngoài')) {
                            name = name + `<svg fill="currentColor" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>globe1</title> <path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
                        }
                        if (aka.length > 0) {
                            name = name + `<svg style="cursor:pointer" onclick="OpenAKAByPhone('${data.data[i].phone}','${data.data[i].userid}','${data.data[i].realfbid || ''}')" width="20px" height="20px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-people-fill"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path> <path fill-rule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"></path> <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path> </g></svg>`;
                        }
                        var buttonchat = `<a onclick="ChatBox('${data.data[i].threadid}','${idpage}','${data.data[i].userid}','${data.data[i].phone}','${data.data[i].name}', '${data.data[i].commentid}')"><i class="bi bi-envelope-fill"></i></a>`;
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
                        if (phone === null) { phone = '' }
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
                        var buttondonhang = `<a onclick="ShowOrder('${data.data[i].name}','${data.data[i].phone}')"><i class="bi bi-receipt"></i></a>`;
                        var luotin = data.data[i].luotin;
                        if (luotin == 0) {
                            luotin = '&nbsp;';
                        }
                        html += `
                                <tr>
                                    <td>${(i + 1)}</td>
                                    <td>${name}</td>
                                    <td>${data.data[i].message}</td>
                                    <td>${phone}</td>
                                    <td>${zlabel}</td>
                                    <td><center><span class="badge bg-${xbel}">${data.data[i].chot}</span></center></td>
                                    <td><center><span class="badge bg-success">${data.data[i].gia}</span></center></td>
                                    <td>${data.data[i].count}</td>
                                    <td>${data.data[i].commentid}</td>
                                    <td>${timesort}</td>
                                    <td>${data.data[i].diachi}</td>
                                    <td>${buttonpage1}${buttonpage2}${buttonchat}${buttondonhang}</td>
                                    <td>${data.data[i].userid}</td>
                                    <td>${data.data[i].datecreate}</td>
                                    <td>${data.data[i].timecomment}</td>
                                    <td>${data.data[i].fbnamex}</td>
                                    <td>${luotin}</td>
                                    <td>${data.data[i].liveid}</td>
                                    <td>${idpage}</td>
                                    <td>${data.data[i].note}</td>
                                    <td>${aka}</td>
                                    <td>${data.data[i].label}</td>
                                    <td>${data.data[i].streamlabid}</td>
                                    <td>${data.data[i].realfbid}</td>
                                    <td>${nuocngoai}</td>
                                    <td>${data.data[i].threadid}</td>
                                    <td>${data.data[i].id}</td>
                                    <td>${data.data[i].idx}</td>
                                </tr>
                                `;
                    }
                }
                document.getElementById("btnloadlive").disabled = false;
                document.getElementById("btnloadlive").innerHTML = 'Load';
                ShowToast('success', `<i class="bi bi-check-square"></i>`, 'Load bình luận', 'Đã tải bình luận', 3000);
            }
            $('#comment_table tbody').html(html);
            const table = $('#comment_table').DataTable(
                {
                    searching: false,
                    paging: false,
                    info: false,
                    keys: {
                        blurable: false
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
                    pageLength: -1,
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
                            visible: false,
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
                            visible: false,
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
                    order: [9, 'asc'],//desc
                }
            );
            $('a.toggle-vis').on('click', function (e) {
                e.preventDefault();
                var column = table.column($(this).attr('data-column'));
                column.visible(!column.visible());
            });
            InItKeys(table);
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
    //add 
    var note = data.customerInfo.note;
    if (note === undefined || note === null || note == 'null') {
        note = '';
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
    if (phone === null) {
        phone = '';
    }
    var timesort = new Date(data.timelocal).getTime();
    var name = `<img src="/images/ava/${data.customerInfo.userid}.jpg" class="avatar" onerror="tryAgain(this)">${data.customerInfo.fbname}`;
    if (data.customerInfo.fbname.includes('Áo Dài Gia Bảo')) {
        name += `<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="15" height="15" viewBox="0 0 48 48">
<linearGradient id="csF85US9HGjIK87qotE6pa_QMxOVe0B9VzG_gr1" x1="24" x2="24" y1="3.999" y2="43.001" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2aa4f4"></stop><stop offset="1" stop-color="#007ad9"></stop></linearGradient><path fill="url(#csF85US9HGjIK87qotE6pa_QMxOVe0B9VzG_gr1)" d="M43.466,25.705l-2.599-4.259l1.293-4.817c0.187-0.694-0.146-1.424-0.793-1.738l-4.488-2.178	l-1.518-4.752c-0.219-0.686-0.888-1.114-1.607-1.033l-4.953,0.594l-3.846-3.178c-0.555-0.459-1.355-0.459-1.91,0l-3.846,3.178	l-4.953-0.594c-0.717-0.081-1.389,0.348-1.607,1.033l-1.518,4.752l-4.488,2.178c-0.646,0.314-0.979,1.044-0.793,1.738l1.293,4.817	l-2.599,4.259c-0.375,0.614-0.261,1.408,0.271,1.892l3.693,3.354l0.116,4.987c0.018,0.719,0.542,1.325,1.252,1.444l4.92,0.825	l2.795,4.133c0.403,0.595,1.172,0.822,1.833,0.538L24,40.913l4.585,1.966C28.776,42.961,28.977,43,29.175,43	c0.486,0,0.957-0.236,1.243-0.659l2.795-4.133l4.92-0.825c0.71-0.119,1.234-0.726,1.252-1.444l0.116-4.987l3.693-3.354	C43.727,27.113,43.841,26.319,43.466,25.705z"></path><path fill="#fff" d="M21.814,31c-0.322,0-0.646-0.104-0.92-0.316l-4.706-3.66c-0.436-0.339-0.514-0.967-0.175-1.403	l0.614-0.789c0.339-0.436,0.967-0.514,1.403-0.175l3.581,2.785l7.086-8.209c0.361-0.418,0.992-0.464,1.41-0.104l0.757,0.653	c0.418,0.361,0.464,0.992,0.104,1.41l-8.017,9.289C22.655,30.822,22.236,31,21.814,31z"></path>
</svg>`;
    }
    if (data.customerInfo.diachi.length > 0) {
        name = name + `<svg width="20px" height="20px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>location-filled</title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="location-outline" fill="currentColor" transform="translate(106.666667, 42.666667)"> <path d="M149.333333,7.10542736e-15 C231.807856,7.10542736e-15 298.666667,66.8588107 298.666667,149.333333 C298.666667,176.537017 291.413333,202.026667 278.683512,224.008666 C270.196964,238.663333 227.080238,313.32711 149.333333,448 C71.5864284,313.32711 28.4697022,238.663333 19.9831547,224.008666 C7.25333333,202.026667 2.84217094e-14,176.537017 2.84217094e-14,149.333333 C2.84217094e-14,66.8588107 66.8588107,7.10542736e-15 149.333333,7.10542736e-15 Z M149.333333,85.3333333 C113.987109,85.3333333 85.3333333,113.987109 85.3333333,149.333333 C85.3333333,184.679557 113.987109,213.333333 149.333333,213.333333 C184.679557,213.333333 213.333333,184.679557 213.333333,149.333333 C213.333333,113.987109 184.679557,85.3333333 149.333333,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>`;
    }
    if (nuocngoai.includes('Nước ngoài')) {
        name = name + `<svg fill="currentColor" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>globe1</title> <path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
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
    var buttonchat = `<a href="javascript:void(0);" data-customer-id="${data.customerInfo.userid}" data-customer-name="${data.customerInfo.fbname}" class="open-message-modal"><i class="bi bi-chat-square-text-fill"></i></a>`;
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
    var message = data.message;
    if (message == null || message == undefined) {
        message = '';
    }
    var t = $('#comment_table').DataTable();
    var added = t.row.add([
        "",
        name,
        message,
        phone,
        zlabel,
        backfill && data.chot ? `<center><span class="badge ${data.chot.includes('CHỐT') ? 'bg-primary' : 'bg-danger'}">${gbEscapeText(data.chot)}</span></center>` : "",
        backfill && data.gia ? gbEscapeText(data.gia) : "",
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
        0,
        data.customerInfo.realfbid,
        nuocngoai,
        data.customerInfo.threadid,
        data.customerInfo.id,
        data.idx
    ]);
    if (backfill) return;
    added.draw(false);
    var focusedCell = t.cell({ focused: true });
    if (focusedCell.any()) {
        t.keys.move('down');
    }
    ScrollBot();
}

socket.on('new-comment', data => {
    if (currentPostId === String(data.liveid)) AddLiveComment(data);
});
function ScrollBot() {
    window.scrollTo({ top: 1000000, left: 0, behavior: "instant" });
    //$('html, body').scrollTop( $(document).height() );
}
