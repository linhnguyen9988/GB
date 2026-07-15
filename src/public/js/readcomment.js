var e = document.getElementById("liveidcombobox");
var liveidfrominput = document.getElementById("liveidinput");
var html = '';
const toast = new Bs5Utils();
function OnUpdateLiveNote() {
    var note = document.getElementById("livenote").value;
    var id = liveidfrominput.value;
    if (id.length < 1 || note.length < 1) {
        document.getElementById("livenote").value = '';
        ShowToast('danger', `<i class="bi bi-calendar-x"></i>`, 'Lưu ghi chú', 'Không thể lưu ghi chú khi chưa có id hoặc chưa có ghi chú', 3000);
        return;
    } else {
        $.ajax({
            url: "/updatelivenote",
            method: "POST",
            data: { note: note, liveid: id },
            dataType: "JSON",
            success: function (data) {
                ShowToast('success', `<i class="bi bi-check-square"></i>`, 'Lưu ghi chú', 'Đã lưu ghi chú', 3000);
            }
        });
    }
}
function ADS() {
    const widget = document.getElementById('referral-widget');
    if (widget.style.display === 'none') {
        widget.style.display = 'block';
    } else {
        widget.style.display = 'none';
    }
}
function getRowIdx() {
    return $('#comment_table').DataTable().cell({
        focused: true
    }).index().row;
}
$("#gia").on("keydown", function (e) {
    var keyCode = (e.keyCode ? e.keyCode : e.which);
    if (keyCode == 13) {
        Chot();
    }
});
var initkey = 0;
var oldphone = '';
function UpdateUser() {
    var userid = document.getElementById("fbid").value;
    var realfbid = document.getElementById("realfbid").value;
    var phone = document.getElementById("userphone").value;
    var diachi = document.getElementById("diachi").value;
    var label = document.getElementById("labelkh").value;
    var note = document.getElementById("note").value;
    var nn = document.getElementById("nuocngoai").value;
    if (label == 'Xóa') {
        label = '';
    }
    var table = $('#comment_table').DataTable();
    var data = table.row(getRowIdx()).data();
    oldphone = data[3];
    table.rows().every(function (rowIdx, tableLoop, rowLoop) {
        if (table.cell(rowIdx, 12).data() == userid) {
            if (oldphone.length > 0) {
                table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data().replaceAll(oldphone, phone));
            } else {
                table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data() + `<br><span class="label label--pink">${phone}</span>`);
            }
            if (nn == 'Nước ngoài') {
                if (phone.length > 0) {
                    table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data() + `<span class="label label--lightpink">Nước ngoài</span>`);
                } else {
                    table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data() + `<br><span class="label label--lightpink">Nước ngoài</span>`);
                }
            } else {
                table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data().replace('<span class="label label--lightpink">Nước ngoài</span>', ''));
            }
            table.cell(rowIdx, 3).data(phone);
            table.cell(rowIdx, 10).data(diachi);
            table.cell(rowIdx, 21).data(label);
            table.cell(rowIdx, 19).data(note);
            table.cell(rowIdx, 24).data(nn);
        }
    }).draw(false);
    $.ajax({
        url: "/updateuser",
        method: "POST",
        data: { phone: phone, diachi: diachi, label: label, note: note, userid: userid, realfbid: realfbid, nn: nn },
        dataType: "JSON",
        success: function (data) {
        }
    });
    $('#modaledit').modal('hide');
}
function DeleteLive() {
    var liveid = e.value;
    $.ajax({
        url: "/deletelive",
        method: "POST",
        data: { liveid: liveid },
        dataType: "JSON",
        success: function (data) {
        }
    });
}
function ShowEdit(title, id, phone, diachi, note, label, realfbid, nn) {
    document.getElementById("notetoshow").insertAdjacentHTML("afterend",
        `<div class="modal" tabindex="-1" role="dialog" id="modaledit">
    <div class="modal-dialog" role="document">
      <div class="modal-content rounded-4 shadow">
        <div class="modal-header p-5 pb-4 border-bottom-0">
          <!-- <h5 class="modal-title">Modal title</h5> -->
          <h3 class="fw-bold mb-0">${title}</h3>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
  
        <div class="modal-body p-5 pt-0">
        <div class="p-3 py-5">
        <div class="row mt-2">
            <div class="col-md-12">
                <div class="input-group mb-3">
                    <span class="input-group-text"><i class="bi bi-person-square"></i></span>
                    <input type="text" id="fbid" class="form-control input-sm" value="${id}" disabled>
                </div>
                <div class="input-group mb-3">
                    <span class="input-group-text"><i class="bi bi-person-square"></i></span>
                    <input type="text" id="realfbid" class="form-control input-sm" value="${realfbid}" disabled>
                </div>
            </div>
        
            <div class="col-md-6">
                <div class="input-group mb-3">
                    <span class="input-group-text"><i class="bi bi-phone-fill"></i></i></span>
                    <input type="text" id="userphone" class="form-control input-sm" value="${phone}">
                </div>
            </div>
            <div class="col-md-6">
                <div class="input-group mb-3">
                    <span class="input-group-text"><i class="bi bi-tag-fill"></i></span>
                    <select id="labelkh" class="form-select">
                        <option selected hidden disabled>${label}</option>
                        <option value="Thân thiết">Thân thiết</option>
                        <option value="Bom hàng">Bom hàng</option>
                        <option value="Xả hàng">Xả hàng</option>
                        <option value="Có vấn đề">Có vấn đề</option>
                        <option value="Xóa">Xóa</option>
                    </select>
                </div>
            </div>
            <div class="col-md-6">
                <div class="input-group mb-3">
                    <span class="input-group-text"><i class="bi bi-globe2"></i></span>
                    <select id="nuocngoai" class="form-select">
                        <option selected hidden disabled>${nn}</option>
                        <option value="Nước ngoài">Nước ngoài</option>
                        <option value="Trong nước">Trong nước</option>
                    </select>
                </div>
            </div>
            <div class="col-md-12">
                <div class="input-group mb-3">
                    <span class="input-group-text"><svg width="20px" height="20px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>location-filled</title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="location-outline" fill="#000000" transform="translate(106.666667, 42.666667)"> <path d="M149.333333,7.10542736e-15 C231.807856,7.10542736e-15 298.666667,66.8588107 298.666667,149.333333 C298.666667,176.537017 291.413333,202.026667 278.683512,224.008666 C270.196964,238.663333 227.080238,313.32711 149.333333,448 C71.5864284,313.32711 28.4697022,238.663333 19.9831547,224.008666 C7.25333333,202.026667 2.84217094e-14,176.537017 2.84217094e-14,149.333333 C2.84217094e-14,66.8588107 66.8588107,7.10542736e-15 149.333333,7.10542736e-15 Z M149.333333,85.3333333 C113.987109,85.3333333 85.3333333,113.987109 85.3333333,149.333333 C85.3333333,184.679557 113.987109,213.333333 149.333333,213.333333 C184.679557,213.333333 213.333333,184.679557 213.333333,149.333333 C213.333333,113.987109 184.679557,85.3333333 149.333333,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg></span>
                    <textarea class="form-control" id="diachi" rows="2">${diachi}</textarea>
                </div>
            </div>
            <div class="col-md-12"><textarea class="form-control" id="note" rows="5">${note}</textarea></div>
        <div class="row mt-2">
                            <div class="text-center"><button class="btn btn-primary" type="button"
                                    onclick="UpdateUser()">Lưu</button></div>
                        </div>
    </div>
        </div>
      </div>
    </div>
  </div>`);
    if (numx == 0) {
        $('#modaledit').modal('show');
        numx = 1;
    }

    $('#modaledit').on('hidden.bs.modal', function () {
        numx = 0
        var div = document.getElementById('modaledit');
        div.remove();
    });
}
function OpenMessenger(pageid, realid) {
    if (realid != null && realid.length > 0) {
        window.open("https://business.facebook.com/latest/inbox/messenger?asset_id=" + pageid + "&selected_item_id=" + realid + "&mailbox_id=&thread_type=FB_MESSAGE", '_blank').focus();
    } else {
        UpdateComment(1);
    }
}
function UpdateComment(openmess) {
    var x = $('#comment_table').DataTable().row(getRowIdx()).data();
    $.ajax({
        url: "/detailcomment",
        method: "POST",
        data: { commentid: x[8], streamlabid: x[22] },
        dataType: "JSON",
        success: function (data) {
            if (data.data.hasOwnProperty('error')) {
                ShowToast('danger', `<i class="bi bi-list-check"></i>&nbsp;`, 'Cập nhật bình luận', data.data.error.message, 3000);
                return;
            }
            var table = $('#comment_table').DataTable();
            var xx = table.row(getRowIdx()).data();
            table.rows().every(function (rowIdx, tableLoop, rowLoop) {
                if (table.cell(rowIdx, 8).data() == xx[8]) {
                    var timecmt = new Date(data.data.live_broadcast_timestamp * 1000).toISOString().substring(11, 19);
                    table.cell(rowIdx, 23).data(data.data.from.id);//realfbid
                    table.cell(rowIdx, 14).data(timecmt);
                    table.cell(rowIdx, 7).data(data.data.live_broadcast_timestamp);
                }
            }).draw(false);
            if (openmess == 1) {
                OpenMessenger(x[18], data.data.from.id);
            }
            ShowToast('success', `<i class="bi bi-list-check"></i>&nbsp;`, 'Cập nhật bình luận', 'Đã cập nhật bình luận, có thể mở hộp thư hoặc xem live.', 3000);
        }
    });
}
function GetConversation() {
    $.ajax({
        url: "/getconversations",
        method: "POST",
        dataType: "JSON",
        success: function () {
            ShowToast('success', `<i class="bi bi-list-check"></i>&nbsp;`, 'Scan Conversations', 'Scan completed, you can open Chat Box Now.', 3000);
        }
    });
}


function InItKeys() {
    var t = $('#comment_table').DataTable();
    t.on('key', function (e, datatable, keyCode, cell, originalEvent) {
        var x = datatable.row(cell.index().row).data();
        if ($('#comment_table_filter input').is(':focus') || $('#livenote').is(':focus') || $('#OrderNote').is(':focus') || $('#MessToSend').is(':focus') || $('#link').is(':focus') || $('#usernote').is(':focus') || $('#userphone').is(':focus') || $('#useraddress').is(':focus') || $('#diachi').is(':focus') || $('#note').is(':focus')) {
            return;
        }
        oldphone = x[3];
        if (keyCode == 67) {
            Chot();
        } else if (keyCode == 81) {
            ScanComment(20);
        } else if (keyCode == 72) {
            ChatBox(x[25], x[18], x[12], x[3], x[8]);
        } else if (keyCode == 73) {
            $.ajax({
                url: "/updaterealid",
                method: "POST",
                data: { realfbid: x[23] },
                dataType: "JSON",
                success: function (z) {
                    if (z.phone.length > 0) {
                        var labelx = '';
                        var table = $('#comment_table').DataTable();
                        var data = $('#comment_table').DataTable().row(getRowIdx()).data();
                        table.rows().every(function (rowIdx, tableLoop, rowLoop) {
                            if (table.cell(rowIdx, 12).data() == data[12]) {
                                table.cell(rowIdx, 3).data(z.phone);
                                if (!table.cell(rowIdx, 1).data().includes(z.phone)) {
                                    table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data() + `<br><span class="label label--pink">${z.phone}</span>`);
                                    table.cell(rowIdx, 10).data(z.diachi);
                                    table.cell(rowIdx, 19).data(z.note);
                                    table.cell(rowIdx, 25).data(z.threadid);
                                }
                            }
                        }).draw(false);
                        ShowToast('success', `<i class="bi bi-list-check"></i>&nbsp;`, 'Cập nhật khách hàng', 'Đã cập nhật khách hàng thành công.', 3000);
                    } else {
                        ShowToast('warning', `<i class="bi bi-list-check"></i>&nbsp;`, 'Khách mới', 'Khách mới chưa có số điện thoại.', 3000);
                        return;
                    }
                    if (z.label.includes('Có')) {
                        labelx = '<span class="badge bg-warning">' + z.label + '</span>';
                        ShowAKA('Khách có vấn đề', z.fbname, labelx, z.note);
                    } else if (z.label.includes('hàng')) {
                        labelx = '<span class="badge bg-danger">' + z.label + '</span>';
                        ShowAKA('Xả hoặc bom', z.fbname, labelx, z.note);
                    }
                }
            });
        } else if (keyCode == 74) {
            ChatBox(x[25], x[18], x[12], x[3], x[8]);
        } else if (keyCode == 75) {
            SendMessage("Áo dài Gia Bảo chốt đơn.");
        } else if (keyCode == 76) {
            window.open('https://www.facebook.com/watch/?v=' + x[17] + '&t=' + (x[7] - 100), '_blank').focus();
        } else if (keyCode == 186) {
            if (x[18] != '102116919355833') {
                window.open('https://www.facebook.com/watch/?v=' + liveidfrominput.value.replaceAll(x[17], '').replaceAll(',', '') + '&t=' + (x[7] - 200), '_blank').focus();
            }
        } else if (keyCode == 80) {
            window.open("https://mbasic.facebook.com/messages/read/?fbid=" + x[23] + "&pageID=" + x[18], '_blank').focus();
        } else if (keyCode == 77) {
            OpenMessenger(x[18], x[23]);
        } else if (keyCode == 78) {
            ShowNote();
        } else if (keyCode == 85) {
            ShowEdit(x[1], x[12], x[3], x[10], x[19], x[21], x[23], x[24]);
        } else if (keyCode == 86) {
            UpdatePhone();
        } else if (keyCode == 88) {
            XaHang();
        } else if (keyCode == 84) {//Nut T
            //if (x[23].length < 1 || x[7] < 1) {
            UpdateComment(0);
            //}
        } else if (keyCode == 82) {//Nut R
            if (x[23].length > 1 && x[22].length > 1) {
                $.ajax({
                    url: "/updatefromreal",
                    method: "POST",
                    data: { realfbid: x[23], streamlabid: x[22] },
                    dataType: "JSON",
                    success: function (z) {
                        if (z.hasOwnProperty('error')) {
                            ShowToast('warning', `<i class="bi bi-list-check"></i>&nbsp;`, 'Khách mới', 'Khách mới chưa có số điện thoại.', 3000);
                            return;
                        }
                        if (z.phone.length > 0) {
                            var labelx = '';
                            var table = $('#comment_table').DataTable();
                            var data = $('#comment_table').DataTable().row(getRowIdx()).data();
                            table.rows().every(function (rowIdx, tableLoop, rowLoop) {
                                if (table.cell(rowIdx, 12).data() == data[12]) {
                                    table.cell(rowIdx, 3).data(z.phone);
                                    if (!table.cell(rowIdx, 1).data().includes(z.phone)) {
                                        table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data() + `<br><span class="label label--pink">${z.phone}</span>`);
                                        table.cell(rowIdx, 10).data(z.diachi);
                                        table.cell(rowIdx, 19).data(z.note);
                                        table.cell(rowIdx, 25).data(z.threadid);
                                    }
                                }
                            }).draw(false);
                            ShowToast('success', `<i class="bi bi-list-check"></i>&nbsp;`, 'Cập nhật khách hàng', 'Đã cập nhật khách hàng thành công.', 3000);
                        }
                        if (z.label.includes('Có')) {
                            labelx = '<span class="badge bg-warning">' + z.label + '</span>';
                            ShowAKA('Khách có vấn đề', z.fbname, labelx, z.note);
                        } else if (z.label.includes('hàng')) {
                            labelx = '<span class="badge bg-danger">' + z.label + '</span>';
                            ShowAKA('Xả hoặc bom', z.fbname, labelx, z.note);
                        }
                    }
                });
            }
        } else if (keyCode == 190) {
            SendMessage("Chào chị, để gửi hàng nhanh nhất, em xin địa chỉ để khi chốt hàng em xác nhận đơn và chuyển hàng liền cho chị ạ. Em cám ơn!");
        } else {
            //console.log('Key press: ' + keyCode + ' for cell ' + cell.data() + ' on Row ID ' + getRowIdx());
        }
    }).on('key-focus', function (e, datatable, cell) {
    });
    initkey = 1;
}
async function LoadLive() {
    start();
    var xxx = document.getElementById(e.value);
    document.getElementById("btnloadlive").disabled = true;
    document.getElementById("btnloadlive").innerHTML = '<span class="spinner-grow" style="width: 0.8rem; height: 0.8rem;" role="status"></span>&nbsp;Load';

    var t = $('#comment_table').DataTable();

    if ($.fn.dataTable.isDataTable('#comment_table')) {
        $('#comment_table').DataTable().destroy();
    }

    var liveid = e.value;
    if (document.getElementById("liveidinput").value.length > 0 && document.getElementById("liveidinput").value != liveid) {
        document.getElementById("liveidinput").value += ',' + liveid;
    } else {
        document.getElementById("liveidinput").value = liveid;
    }
    document.getElementById("livenote").value = xxx.getAttribute("data-note");
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
                            name = name + `<svg width="15px" height="15px" viewBox="0 0 1024 1024" class="icon" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M523.9 986.4l-19.1-9.5c-16.6-8.3-407.6-207.7-407.6-550.2C97.2 191.4 288.6 0 523.9 0s426.7 191.4 426.7 426.7c0 342.4-390.9 541.8-407.6 550.2l-19.1 9.5z m0-901.1c-188.2 0-341.3 153.1-341.3 341.3 0 250.3 266.8 420.6 341.3 463.4 74.6-42.7 341.3-213.1 341.3-463.4 0-188.1-153.1-341.3-341.3-341.3z" fill="#3688FF"></path><path d="M523.9 533.3c-70.6 0-128-57.4-128-128s57.4-128 128-128 128 57.4 128 128-57.5 128-128 128z m0-170.6c-23.5 0-42.7 19.1-42.7 42.7s19.1 42.7 42.7 42.7c23.5 0 42.7-19.1 42.7-42.7s-19.2-42.7-42.7-42.7z" fill="#5F6379"></path></g></svg>`;
                        }
                        if (nuocngoai.includes('Nước ngoài')) {
                            name = name + `<svg fill="#000000" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>globe1</title> <path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
                        }
                        if (aka.length > 0) {
                            name = name + `<svg width="20px" height="20px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#000000" class="bi bi-people-fill"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path> <path fill-rule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"></path> <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path> </g></svg>`;
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
                ShowToast('success', `<i class="bi bi-check-square"></i>`, 'Load bình luận', 'Hoàn thành trong ' + end() + ' mili giây', 3000);
            }
            $('#comment_table tbody').html(html);
            $('#comment_table').DataTable(
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
                var column = t.column($(this).attr('data-column'));
                column.visible(!column.visible());
            });
            if (initkey === 0) {
                InItKeys();
            }
        }
    });
};
var scancount = 0;
async function ScanComment(soluong) {
    var note = document.getElementById("livenote").value;
    var xxxx = document.getElementById("liveidinput").value;
    if (xxxx.length == 0) {
        return;
    }
    start();
    var t = $('#comment_table').DataTable();
    $.ajax({
        url: "/scancomment",
        method: "POST",
        data: { liveid: xxxx, note: note, soluong: soluong },
        dataType: "JSON",
        success: function (data) {
            if (data.data.hasOwnProperty('error')) {
                ShowToast('danger', `<i class="bi bi-calendar-x"></i>`, 'Quét bình luận', data.data.error, 3000);
                document.getElementById("scancomment").disabled = false;
                document.getElementById("scancomment").innerHTML = 'Quét';
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
                            zlabel = `<span class="badge bg-warning">${xlabel}</span>`;
                        }
                        var phone = data.data[i].phone;
                        if (phone === null) {
                            phone = '';
                        }
                        var timesort = new Date(data.data[i].datecreate).getTime();
                        var name = `<img src="${data.data[i].avalink}" class="avatar">${data.data[i].name}`;
                        if (data.data[i].diachi.length > 0) {
                            name = name + `<svg width="20px" height="20px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>location-filled</title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="location-outline" fill="#000000" transform="translate(106.666667, 42.666667)"> <path d="M149.333333,7.10542736e-15 C231.807856,7.10542736e-15 298.666667,66.8588107 298.666667,149.333333 C298.666667,176.537017 291.413333,202.026667 278.683512,224.008666 C270.196964,238.663333 227.080238,313.32711 149.333333,448 C71.5864284,313.32711 28.4697022,238.663333 19.9831547,224.008666 C7.25333333,202.026667 2.84217094e-14,176.537017 2.84217094e-14,149.333333 C2.84217094e-14,66.8588107 66.8588107,7.10542736e-15 149.333333,7.10542736e-15 Z M149.333333,85.3333333 C113.987109,85.3333333 85.3333333,113.987109 85.3333333,149.333333 C85.3333333,184.679557 113.987109,213.333333 149.333333,213.333333 C184.679557,213.333333 213.333333,184.679557 213.333333,149.333333 C213.333333,113.987109 184.679557,85.3333333 149.333333,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>`;
                        }
                        if (nuocngoai.includes('Nước ngoài')) {
                            name = name + `<svg fill="#000000" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>globe1</title> <path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
                        }
                        if (aka.length > 0) {
                            name = name + `<i class="bi bi-people-fill" data-bs-toggle="tooltip" title="Trùng tên: ${aka}"></i>`;
                        }
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
                            "",
                            name,
                            data.data[i].message,
                            phone,
                            zlabel,
                            `<center><span class="badge bg-${xbel}">${data.data[i].chot}</span></center>`,
                            `<center><span class="badge bg-success">${data.data[i].gia}</span></center>`,
                            data.data[i].count,
                            data.data[i].commentid,
                            timesort,
                            data.data[i].diachi,
                            buttonpage1 + buttonpage2,
                            data.data[i].userid,
                            data.data[i].datecreate,
                            data.data[i].timecomment,
                            data.data[i].fbnamex,
                            luotin,
                            data.data[i].liveid,
                            idpage,
                            data.data[i].note,
                            aka,
                            data.data[i].label,
                            data.data[i].streamlabid,
                            data.data[i].realfbid,
                            nuocngoai,
                            data.data[i].threadid,
                            data.data[i].id,
                            data.data[i].idx
                        ]).draw(false);
                    } else {
                        //todo: test lai xem chay dc chua. neu OK cho no update phone vao DB luon
                        var table = $('#comment_table').DataTable();
                        table.rows().every(function (rowIdx, tableLoop, rowLoop) {
                            if (table.cell(rowIdx, 8).data() == data.data[i].commentid) {
                                table.cell(rowIdx, 3).data(data.data[i].phone);
                                table.cell(rowIdx, 23).data(data.data[i].realfbid);
                                if (!table.cell(rowIdx, 1).data().includes(data.data[i].phone)) {
                                    table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data() + `<br><span class="label label-pink">` + phone + `</span>`);
                                }
                            }
                        }).draw(false);
                    }

                }
            }
            ShowToast('success', `<i class="bi bi-check-square"></i>`, 'Quét bình luận', 'Hoàn thành trong ' + end() + ' mili giây', 3000);
            scancount++;
            if (scancount > 50) {
                RC();
                scancount = 0;
            }
        }
    });
};
let startget = 0;
let currentPostId = null;

socket.on('new-comment', (data) => {
    var t = $('#comment_table').DataTable();
    var cmtidcol = t.column(8).data().toArray();
    if (cmtidcol.includes(data.cmtid)) return;
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
        name = name + `<svg width="20px" height="20px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>location-filled</title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="location-outline" fill="#000000" transform="translate(106.666667, 42.666667)"> <path d="M149.333333,7.10542736e-15 C231.807856,7.10542736e-15 298.666667,66.8588107 298.666667,149.333333 C298.666667,176.537017 291.413333,202.026667 278.683512,224.008666 C270.196964,238.663333 227.080238,313.32711 149.333333,448 C71.5864284,313.32711 28.4697022,238.663333 19.9831547,224.008666 C7.25333333,202.026667 2.84217094e-14,176.537017 2.84217094e-14,149.333333 C2.84217094e-14,66.8588107 66.8588107,7.10542736e-15 149.333333,7.10542736e-15 Z M149.333333,85.3333333 C113.987109,85.3333333 85.3333333,113.987109 85.3333333,149.333333 C85.3333333,184.679557 113.987109,213.333333 149.333333,213.333333 C184.679557,213.333333 213.333333,184.679557 213.333333,149.333333 C213.333333,113.987109 184.679557,85.3333333 149.333333,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>`;
    }
    if (nuocngoai.includes('Nước ngoài')) {
        name = name + `<svg fill="#000000" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>globe1</title> <path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
    }
    if (aka.length > 0) {
        name = name + `<i class="bi bi-people-fill" data-bs-toggle="tooltip" title="Trùng tên: ${aka}"></i>`;
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
    t.row.add([
        "",
        name,
        message,
        phone,
        zlabel,
        "",
        "",
        0,
        data.cmtid,
        timesort,
        data.customerInfo.diachi,
        buttonchat + buttonpage1 + buttonpage2,
        data.customerInfo.userid,
        data.timelocal,
        0,
        data.customerInfo.fbnamex,
        0,
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
    ]).draw(false);
    var focusedCell = t.cell({ focused: true });
    if (focusedCell.any()) {
        t.keys.move('down');
    }
    ScrollBot();
});
function Begin() {
    if (startget == 1) {
        if (currentPostId) {
            document.getElementById("liveidinput").disabled = false;
            document.getElementById("begin").innerHTML = 'Begin';
            $('#begin').removeClass('btn-success').addClass('btn-primary');
            $(this).addClass('btn-primary').removeClass('btn-success');

            socket.emit('leave-live-stream', currentPostId);
            console.log(`Đã dừng theo dõi bình luận cho post ID: ${currentPostId}`);
            currentPostId = null;
        }
        startget = 0;
        return;
    }
    startget = 1;
    const postId = document.getElementById("liveidinput").value.trim();
    if (postId) {
        if (currentPostId) {
            socket.emit('leave-live-stream', currentPostId);
        }
        socket.emit('join-live-stream', postId);
        currentPostId = postId;
        console.log(`Đã bắt đầu theo dõi bình luận cho post ID: ${postId}`);
        ShowToast('primary', '<div class="spinner-border text-light" role="status"></div>&nbsp;', 'Quét bình luận', `Đang nhận bình luận facebok phòng live ID: ${postId}`, 3000);
    } else {
        ShowToast('danger', '<i class="bi bi-sign-stop"></i>', 'Quét bình luận', 'Đã ra khỏi phòng live.', 3000);
    }
    if (document.getElementById("begin").innerHTML.includes('Begin')) {
        document.getElementById("liveidinput").disabled = true;
        document.getElementById("begin").innerHTML = '<span class="spinner-grow text-danger" style="width: 0.8rem; height: 0.8rem;" role="status"></span>&nbsp;Stop';
        $('#begin').removeClass('btn-primary').addClass('btn-success');
        $(this).addClass('btn-success').removeClass('btn-primary');
    }
}
async function BeginScan() {
    var xxxx = document.getElementById("liveidinput").value;
    if (xxxx.length == 0) {//bat buoc quet id 1 truoc
        return;
    }
    var t = $('#comment_table').DataTable();
    $.ajax({
        url: "/laycmt",
        method: "POST",
        data: { liveid: xxxx },
        dataType: "JSON",
        success: function (data) {
            if (data.data.hasOwnProperty('error')) {
                ShowToast('danger', '<i class="bi bi-calendar-x"></i>', 'Quét bình luận', data.data.error, 3000);
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
                            zlabel = `<span class="label label--error">${xlabel}</span>`;
                        } else if (xlabel.includes('Thân')) {
                            zlabel = `<span class="badge bg-success">${xlabel}</span>`;
                        } else if (xlabel.includes('Có')) {
                            zlabel = `<span class="label label--orange">${xlabel}</span>`;
                        }
                        var phone = data.data[i].phone;
                        var timesort = new Date(data.data[i].datecreate).getTime();
                        var name = `<img src="/images/ava/${data.data[i].userid}.jpg" class="avatar" onerror="tryAgain(this)">${data.data[i].name}`;
                        if (data.data[i].name.includes('Áo Dài Gia Bảo')) {
                            name += `<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="15" height="15" viewBox="0 0 48 48">
<linearGradient id="csF85US9HGjIK87qotE6pa_QMxOVe0B9VzG_gr1" x1="24" x2="24" y1="3.999" y2="43.001" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2aa4f4"></stop><stop offset="1" stop-color="#007ad9"></stop></linearGradient><path fill="url(#csF85US9HGjIK87qotE6pa_QMxOVe0B9VzG_gr1)" d="M43.466,25.705l-2.599-4.259l1.293-4.817c0.187-0.694-0.146-1.424-0.793-1.738l-4.488-2.178	l-1.518-4.752c-0.219-0.686-0.888-1.114-1.607-1.033l-4.953,0.594l-3.846-3.178c-0.555-0.459-1.355-0.459-1.91,0l-3.846,3.178	l-4.953-0.594c-0.717-0.081-1.389,0.348-1.607,1.033l-1.518,4.752l-4.488,2.178c-0.646,0.314-0.979,1.044-0.793,1.738l1.293,4.817	l-2.599,4.259c-0.375,0.614-0.261,1.408,0.271,1.892l3.693,3.354l0.116,4.987c0.018,0.719,0.542,1.325,1.252,1.444l4.92,0.825	l2.795,4.133c0.403,0.595,1.172,0.822,1.833,0.538L24,40.913l4.585,1.966C28.776,42.961,28.977,43,29.175,43	c0.486,0,0.957-0.236,1.243-0.659l2.795-4.133l4.92-0.825c0.71-0.119,1.234-0.726,1.252-1.444l0.116-4.987l3.693-3.354	C43.727,27.113,43.841,26.319,43.466,25.705z"></path><path fill="#fff" d="M21.814,31c-0.322,0-0.646-0.104-0.92-0.316l-4.706-3.66c-0.436-0.339-0.514-0.967-0.175-1.403	l0.614-0.789c0.339-0.436,0.967-0.514,1.403-0.175l3.581,2.785l7.086-8.209c0.361-0.418,0.992-0.464,1.41-0.104l0.757,0.653	c0.418,0.361,0.464,0.992,0.104,1.41l-8.017,9.289C22.655,30.822,22.236,31,21.814,31z"></path>
</svg>`;
                        }
                        if (data.data[i].diachi.length > 0) {
                            name = name + `<svg width="15px" height="15px" viewBox="0 0 1024 1024" class="icon" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M523.9 986.4l-19.1-9.5c-16.6-8.3-407.6-207.7-407.6-550.2C97.2 191.4 288.6 0 523.9 0s426.7 191.4 426.7 426.7c0 342.4-390.9 541.8-407.6 550.2l-19.1 9.5z m0-901.1c-188.2 0-341.3 153.1-341.3 341.3 0 250.3 266.8 420.6 341.3 463.4 74.6-42.7 341.3-213.1 341.3-463.4 0-188.1-153.1-341.3-341.3-341.3z" fill="#3688FF"></path><path d="M523.9 533.3c-70.6 0-128-57.4-128-128s57.4-128 128-128 128 57.4 128 128-57.5 128-128 128z m0-170.6c-23.5 0-42.7 19.1-42.7 42.7s19.1 42.7 42.7 42.7c23.5 0 42.7-19.1 42.7-42.7s-19.2-42.7-42.7-42.7z" fill="#5F6379"></path></g></svg>`;
                        }
                        if (nuocngoai.includes('Nước ngoài')) {
                            name = name + `<svg fill="#000000" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>globe1</title> <path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg>`;
                        }
                        if (aka.length > 0) {
                            name = name + `<i class="bi bi-people-fill" data-bs-toggle="tooltip" title="Trùng tên: ${aka}"></i>`;
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
                            "",
                            name,
                            data.data[i].message,
                            phone,
                            zlabel,
                            `<center><span class="badge bg-${xbel}">${data.data[i].chot}</span></center>`,
                            `<center><span class="badge bg-success">${data.data[i].gia}</span></center>`,
                            data.data[i].count,
                            data.data[i].commentid,
                            timesort,
                            data.data[i].diachi,
                            buttonpage1 + buttonpage2,
                            data.data[i].userid,
                            data.data[i].datecreate,
                            data.data[i].timecomment,
                            data.data[i].fbnamex,
                            luotin,
                            data.data[i].liveid,
                            idpage,
                            data.data[i].note,
                            aka,
                            data.data[i].label,
                            data.data[i].streamlabid,
                            data.data[i].realfbid,
                            nuocngoai,
                            data.data[i].threadid,
                            data.data[i].id
                        ]).draw(false);
                        ScrollBot();
                    }
                }
            }
        }
    });
};
function ScrollBot() {
    window.scrollTo({ top: 1000000, left: 0, behavior: "instant" });
    //$('html, body').scrollTop( $(document).height() );
}
function GetPhone(string) {
    var phone = '';
    var regexp = "0[98735]([0-9]|\s|-|\.){8,12}";
    let phone_numbers = [];
    phone_numbers = [...string.matchAll(regexp)];
    for (const match of phone_numbers) {
        phone = match[0].replaceAll(' ', '').replace(/\D/g, '');
    }
    return phone;
}
function UpdatePhone() {
    var table = $('#comment_table').DataTable();
    var data = $('#comment_table').DataTable().row(getRowIdx()).data();
    var phone = GetPhone(data[2]);
    if (phone.length < 10 || (data[3].length > 1 && phone.includes(data[3].slice(2, -2)))) {
        return;
    }
    var userid = data[12];
    var diachi = data[10];
    var realfbid = data[23];
    if (phone.length > 0) {
        console.log(data[3]);
        if (data[3].length < 9) {
            SendMessage("Chào chị, để gửi hàng nhanh nhất, em xin địa chỉ để khi chốt hàng em xác nhận đơn và chuyển hàng liền cho chị ạ. Em cám ơn!");
        }
        table.rows().every(function (rowIdx, tableLoop, rowLoop) {
            if (table.cell(rowIdx, 12).data() == data[12]) {
                table.cell(rowIdx, 3).data(phone);
                if (!table.cell(rowIdx, 1).data().includes(phone)) {
                    table.cell(rowIdx, 1).data(table.cell(rowIdx, 1).data() + `<br><span class="label label--pink">` + phone + `<a href="tel:${phone}">📱</a></span>`);
                }
            }
        }).draw(false);
        $.ajax({
            url: "/updatephone",
            method: "POST",
            data: { userid: userid, phone: phone, realfbid: realfbid },
            dataType: "JSON",
            success: function (data) {
                if (data.data.hasOwnProperty('name')) {
                    if (data.data.bom != 'none') {
                        var labelx = '';
                        if (data.data.bom.includes('Có')) {
                            labelx = ' - <span class="badge bg-warning">' + data.data.bom + '</span>';
                        } else if (data.data.bom.includes('hàng')) {
                            labelx = ' - <span class="badge bg-danger">' + data.data.bom + '</span>';
                        }
                        ShowAKA('Trùng SĐT', 'Số điện thoại này được dùng bởi: ', data.data.name + labelx, diachi);
                    } else {
                        ShowAKA('Trùng SĐT', 'Số điện thoại này được dùng bởi: ', data.data.name, diachi);
                    }
                }
            }
        });
    }
}
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
async function Chot(buttongia) {
    var table = $('#comment_table').DataTable();
    if (table.rows().count() === 0) {
        return;
    }
    var gia = 0;
    var zz = table.column(16).data().toArray();
    var luotincuoi = highAndLow(zz.toString().replaceAll('&nbsp;', '0'));
    var luotcuoi = 0;
    var luotcuoilive = 0;
    var data = table.row(getRowIdx()).data();
    var xx = data[16];
    var realid = data[23];
    var id = data[26];
    if (xx == '&nbsp;') {
        xx = 0;
    }
    if (xx === 0) {
        luotcuoi = luotincuoi + 1;
        luotcuoilive = luotcuoi;
    } else {
        luotcuoi = parseInt(data[16]);
        luotcuoilive = luotincuoi;
    }
    let str = document.getElementById(data[17]).innerHTML;
    document.getElementById(data[17]).innerHTML = str.split('-')[0] + '- ' + luotcuoilive;
    UpdatePhone();
    if (realid.length < 1) {
        UpdateComment(0);
    }
    if (buttongia > 0) {
        gia = buttongia;
        document.getElementById("gia").value = buttongia;
    } else {
        gia = document.getElementById("gia").value;
    }
    var name = data[1];
    var avabase64 = '';
    toDataUrl(`/images/ava/${data[12]}.jpg`, function (myBase64) {
        avabase64 = myBase64;
    });
    await WaitUntil(_ => avabase64 != '');
    name = name.replace(`/images/ava/${data[12]}.jpg`, avabase64);
    var message = data[2];
    var phone = data[3];
    var diachi = data[10];
    var commentid = data[8];
    var note = document.getElementById("livenote").value;
    $phone = ``;
    $diachi = ``;
    $note = ``;
    var xgia = ``;
    if (gia.toString().length > 0) {
        xgia = `<tr>
                    <td><p style="font-size:17px;"><svg width="20px" height="20px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#000000" class="bi bi-cash"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path> <path d="M0 4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V4zm3 0a2 2 0 0 1-2 2v4a2 2 0 0 1 2 2h10a2 2 0 0 1 2-2V6a2 2 0 0 1-2-2H3z"></path> </g></svg> • ${gia.toString().replace(/^0+/, '').replaceAll("c", "")}.000đ</p></td>
                </tr>`;
    }
    if (phone.length > 0) {
        $phone = `<tr>
                    <td><p style="font-size:17px; font-weight: bold;"><svg width="20px" height="20px" viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <rect x="5.75" y="1.75" width="12.5" height="20.5" rx="1.75" stroke="#000000" stroke-width="1.512"></rect> <path d="M12 19.25C12.6904 19.25 13.25 18.6904 13.25 18C13.25 17.3096 12.6904 16.75 12 16.75C11.3096 16.75 10.75 17.3096 10.75 18C10.75 18.6904 11.3096 19.25 12 19.25Z" fill="#000000" stroke="#000000" stroke-width="1.512"></path> </g></svg>• ${phone}</p></td>
                </tr>`;
    }
    if (note.length > 0) {
        $note = `<tr>
                    <td><b><font size='1.5'><center>${note}</center></font></b></td>
                </tr>`;
    }
    if (diachi.length > 0) {
        $diachi = `<tr>
                    <td><p style="font-size:15px"><i class="fas fa-comment"></i> • ${diachi}</p></td>
                </tr>`;
    }

    $html = `<table>
                <tr>
                    <td><p class="lead"><b>Áo Dài Gia Bảo </b>• ${ToDay()}<b> • ${luotcuoi}</b></p></td>
                </tr>
                <tr>
                    <td><p style="font-size:22px; font-weight: bold;">${name.replace('<img ', '<img class="top"').replace('class="avatar"', '').split('<br>')[0]}</p></td>
                </tr>
                `+ $phone + ` 
                <tr>
                    <td><p style="font-size:17px;"><svg width="16px" height="16px" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g clip-path="url(#clip0_901_991)"> <path d="M9 17.0001H15M9 9.0001H23M9 13.0001H23M22 23.004C22 23.004 28 29.006 29 30.006C30.609 31.616 31 31.008 31 30.008V2.008C31 1.456 30.553 1 30 1H2C1.447 1 1 1.456 1 2.008V24.008C1 24.561 1.447 25 2 25H20" stroke="#000000" stroke-width="1.6640000000000001" stroke-linecap="round" stroke-linejoin="round"></path> </g> <defs> <clipPath id="clip0_901_991"> <rect width="32" height="32" fill="white"></rect> </clipPath> </defs> </g></svg> • ${message}</p></td>
                </tr>
                ${xgia}
                <tr><td><center><img src="${IDToBarcode(id)}"/></center></td></tr>
                `+ $note + `
                </table>
                `;
    //<img src="${IDToBarcode(id)}"/>
    //${MakeQRCode(id,'Numeric')}
    PrintLabelx($html);
    table.rows().every(function (rowIdx, tableLoop, rowLoop) {
        if (table.cell(rowIdx, 8).data() == data[8]) {
            table.cell(rowIdx, 5).data("<center><span class='badge bg-primary'>CHỐT</span></center>");
            table.cell(rowIdx, 6).data("<center><span class='badge bg-success'>" + gia + "</span></center>");
            table.cell(rowIdx, 16).data(luotcuoi);
        }
    }).draw(false);
    ShowToast('primary', `<img src='${data[1].split('src="').pop().split('"')[0]}' class="rounded me-2" width="30px" height="30px">`, data[1].split('avatar">').pop().split('<br')[0], 'Đã chốt bình luận: ' + message, 3000);

    $.ajax({
        url: "/updatechot",
        method: "POST",
        data: { commentid: commentid, chot: "CHỐT", gia: gia, luotincuoi: luotcuoi, liveid: data[17], luotcuoilive: luotcuoilive },
        dataType: "JSON",
        success: function (data) { }
    });
};
function XaHang() {
    var table = $('#comment_table').DataTable();
    var data = $('#comment_table').DataTable().row(getRowIdx()).data();
    var commentid = data[8];
    table.rows().every(function (rowIdx, tableLoop, rowLoop) {
        if (table.cell(rowIdx, 8).data() == data[8]) {
            table.cell(rowIdx, 5).data("<center><span class='badge bg-danger'>XẢ</span></center>");
            table.cell(rowIdx, 6).data("");
        }
    }).draw(false);
    $.ajax({
        url: "/updatexa",
        method: "POST",
        data: { commentid: commentid, chot: "XẢ" },
        dataType: "JSON",
        success: function (data) { }
    });
}
function SendMessage(chat) {
    var data = $('#comment_table').DataTable().row(getRowIdx()).data();
    var commentid = data[8];
    var userid = data[12];//neu ko co thi dung streamlabs id
    var pageid = data[18];
    $.ajax({
        url: "/replycomment",
        method: "POST",
        data: { commentid: commentid, pageid: pageid, userid: userid, chat: chat },
        dataType: "JSON",
        success: function (x) {
            if (x.data.hasOwnProperty('message_id')) {
                ShowToast('success', `<img src='${data[1].split('src="').pop().split('"')[0]}' class="rounded me-2" width="30px" height="30px">`, data[1].split('avatar">').pop().split('<br')[0], 'Đã gửi tin nhắn.', 3000);
            } else {
                var mess = x.data.error.message;
                if (mess.includes('Activity already replied to')) {
                    ShowToast('danger', `<img src='${data[1].split('src="').pop().split('"')[0]}' class="rounded me-2" width="30px" height="30px">`, data[1].split('avatar">').pop().split('<br')[0], 'Bình luận này đã trả lời rồi.', 3000);
                } else if (mess.includes('This user cant reply to this activity')) {
                    ShowToast('danger', `<img src='${data[1].split('src="').pop().split('"')[0]}' class="rounded me-2" width="30px" height="30px">`, data[1].split('avatar">').pop().split('<br')[0], 'Người này đã chặn bạn nhắn tin.', 3000);
                } else if (mess.includes('Invalid comment_id parameter') || mess.includes('Thông số comment_id không hợp lệ')) {
                    ShowToast('danger', `<img src='${data[1].split('src="').pop().split('"')[0]}' class="rounded me-2" width="30px" height="30px">`, data[1].split('avatar">').pop().split('<br')[0], 'Bình luận đã bị xóa, không thể nhắn tin.', 3000);
                } else if (mess.includes('Activity replying time expired')) {
                    ShowToast('danger', `<img src='${data[1].split('src="').pop().split('"')[0]}' class="rounded me-2" width="30px" height="30px">`, data[1].split('avatar">').pop().split('<br')[0], 'Bình luận này đã quá 7 ngày, không thể nhắn tin', 3000);
                } else if (mess.includes('The session is invalid because the user logged out')) {
                    ShowToast('danger', `<img src='${data[1].split('src="').pop().split('"')[0]}' class="rounded me-2" width="30px" height="30px">`, data[1].split('avatar">').pop().split('<br')[0], 'Lỗi kết nối tài khoản nhắn tin. Vui lòng làm mới kết nối/', 3000);
                } else {
                    ShowToast('danger', `<img src='${data[1].split('src="').pop().split('"')[0]}' class="rounded me-2" width="30px" height="30px">`, data[1].split('avatar">').pop().split('<br')[0], mess, 3000);
                }
            }
        }
    });
};
var startTime, endTime;

function start() {
    startTime = performance.now();
};

function end() {
    endTime = performance.now();
    var timeDiff = endTime - startTime;
    return timeDiff.toFixed(0);
}
$('#comment_table tbody').on('dblclick', 'tr', async function () {
    var data = $('#comment_table').DataTable().row(this).data();
    var id = data[26];
    var name = data[1];
    var phone = data[3];
    var avabase64 = '';
    toDataUrl(`/images/ava/${data[12]}.jpg`, function (myBase64) {
        avabase64 = myBase64;
    });
    await WaitUntil(_ => avabase64 != '');
    name = name.replace(`/images/ava/${data[12]}.jpg`, avabase64);
    $phone = ``;
    if (phone.length > 0) {
        $phone = `<tr>
                    <td><p style="font-size:17px; font-weight: bold;"><svg width="20px" height="20px" viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <rect x="5.75" y="1.75" width="12.5" height="20.5" rx="1.75" stroke="#000000" stroke-width="1.512"></rect> <path d="M12 19.25C12.6904 19.25 13.25 18.6904 13.25 18C13.25 17.3096 12.6904 16.75 12 16.75C11.3096 16.75 10.75 17.3096 10.75 18C10.75 18.6904 11.3096 19.25 12 19.25Z" fill="#000000" stroke="#000000" stroke-width="1.512"></path> </g></svg>• ${phone}</p></td>
                </tr>`;
    }
    $html = `<table>
                <tr>
                    <td><p class="lead"><b>Áo Dài Gia Bảo • ${ToDay()}</b></p></td>
                </tr>
                <tr>
                    <td><p style="font-size:22px; font-weight: bold;">${name.replace('<img ', '<img class="top"').replace('class="avatar"', '').split('<br>')[0]}</p></td>
                </tr>
                `+ $phone + ` 
                <tr>
                    <td><p style="font-size:17px;"><svg width="16px" height="16px" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g clip-path="url(#clip0_901_991)"> <path d="M9 17.0001H15M9 9.0001H23M9 13.0001H23M22 23.004C22 23.004 28 29.006 29 30.006C30.609 31.616 31 31.008 31 30.008V2.008C31 1.456 30.553 1 30 1H2C1.447 1 1 1.456 1 2.008V24.008C1 24.561 1.447 25 2 25H20" stroke="#000000" stroke-width="1.6640000000000001" stroke-linecap="round" stroke-linejoin="round"></path> </g> <defs> <clipPath id="clip0_901_991"> <rect width="32" height="32" fill="white"></rect> </clipPath> </defs> </g></svg> • ${data[2]}</p></td>
                </tr>
                <tr><td><center><img src="${IDToBarcode(id)}"/></center></td></tr>
                </table>`;
    PrintLabelx($html);
});