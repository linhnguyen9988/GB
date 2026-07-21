var s = document.getElementById("tenkhach");
var searchfor = '';
var oldphone = '';
var nuocx = 0;
var cn = 0;
const toast = new Bs5Utils();
function handleCheckDonHang() {
    try {
        var orderNum = document.getElementById('donhangdalen').value;
        var name = document.getElementById('fbname').value;
        var uId = document.getElementById('userid').value;
        var phone = document.getElementById('userphone').value;

        if (typeof OrderJourney === "function") {
            OrderJourney(orderNum, name, uId, phone);
        } else {
            alert("Không tìm thấy hàm OrderJourney");
        }
    } catch (e) {
        alert("Lỗi thực thi: " + e.message);
    }
}

function handleXemChiTietDon() {
    var orderNum = document.getElementById('donhangdalen').value;
    if (!orderNum || orderNum === 'undefined') {
        alert("Chưa có đơn hàng nào để xem chi tiết!");
        return;
    }
    if (typeof DetailDonHang === "function") {
        DetailDonHang(orderNum);
    } else {
        alert("Không tìm thấy hàm DetailDonHang");
    }
}

function LenDonKhachHang() {
    var btn = document.getElementById('btnlendonkh');
    var phone = document.getElementById('userphone').value.trim();
    var add = document.getElementById('diachilendon');
    var cod = document.getElementById('COD').value.replace(/\./g, '').replace(/,/g, '').trim();
    var kg = document.getElementById('KG').value;
    var realfbidEl = document.getElementById('realfbid');
    var realfbid = realfbidEl ? realfbidEl.value : '';

    if (phone.length != 10 && phone.substring(0, 2) != '02') {
        alert('Sai SĐT');
        return;
    }
    if (!add || add.selectedIndex < 0 || !add.options[add.selectedIndex]) {
        alert('Chưa có địa chỉ');
        return;
    }
    var opt = add.options[add.selectedIndex];
    var address = (opt.dataset && opt.dataset.address) ? opt.dataset.address : opt.text.replace(/^[✅⚠️🔄❌]\s*/, '');
    if (!address || address.length < 5) {
        alert('Chưa có địa chỉ');
        return;
    }
    if (!isNumeric(cod) || cod < 0) cod = 0;
    if (!isNumeric(kg) || kg <= 0) kg = 2;

    if (btn) btn.disabled = true;

    $.ajax({
        url: "/createorderviettel",
        method: "POST",
        dataType: "JSON",
        data: {
            fbname: window.fbnamex || document.getElementById('fbname').value,
            phone: phone,
            address: address,
            cod: cod,
            kg: kg,
            khid: window.khid,
            userid: window.userid || document.getElementById('userid').value,
            realfbid: realfbid
        },
        success: function (data) {
            if (data.hasOwnProperty('error')) {
                if (btn) btn.disabled = false;
                ShowToast('danger', '<i class="bi bi-x-circle"></i>', 'Lỗi lên đơn', data.error, 4000);
                return;
            }

            var kgGoi = kg * 1000;
            if (kgGoi <= 1000) kgGoi = 500;
            else if (kgGoi <= 2000) kgGoi = 1000;
            else if (kgGoi <= 3000) kgGoi = 1500;
            else if (kgGoi <= 4000) kgGoi = 2000;
            else if (kgGoi <= 6000) kgGoi = kgGoi - 2000;
            else if (kgGoi <= 9000) kgGoi = kgGoi - 3000;
            else if (kgGoi <= 15000) kgGoi = kgGoi - 4000;
            else kgGoi = kgGoi - 5000;

            var fbnamex = window.fbnamex || document.getElementById('fbname').value;
            var html = `<html><head>
                <style>
                    body { width: 360px; margin: 2mm 0mm 2mm 2mm; line-height: 1.6; }
                    table { width: 360px; font-family: "tahoma"; border-collapse: collapse; }
                    @media print{@page {size: landscape}}
                    *, html {margin:0;padding:0;}
                </style>
                </head>
                <body>
                <table>
                    <tr><td colspan="2">Tỉnh/TP: <p style="font-size:14px;display:inline;font-weight: bold;">${data.tinh}</p></td></tr>
                    <tr><td colspan="2">Quận/Huyện: <p style="font-size:13px;display:inline;font-weight: bold;">${data.huyen}</p></td></tr>
                    <tr><td colspan="2">Phường/Xã: <p style="font-size:13px;display:inline;font-weight: bold;">${data.xa}</p></td></tr>
                    <tr><td colspan="2" align="right"><p style="font-size:10px;display:inline;">${kgGoi / 1000} KG</p></td></tr>
                    <tr><td colspan="2"><center><img src="${IDToBarcode(data.realorderid, 30)}"/><br><p style="font-size:10px;display:inline;vertical-align: top;">${data.realorderid}</p></center></td></tr>
                    <tr><td colspan="2"><h5>${fbnamex} • ${phone}</h5></td></tr>
                    <tr><td colspan="2"><p style="font-size:10px;display:inline;vertical-align: top;">${catGonChuoi(address, 60)}</p></td></tr>
                    <tr><td><p style="font-size:10px;display:inline;vertical-align: top;">Cho xem hàng, không nhận thu 30k</p><br>
                    <p style="font-size:10px;display:inline;">1 x Vải</p><br>
                    <p style="font-size:18px;display:inline;">Tiền thu hộ: <b>${(+cod).toLocaleString()} đ</b></p></td>
                    <td>${MakeQRCode(data.realorderid, "Byte")}</td></tr>
                </table>
                </body></html>`;

            $.ajax({
                url: "/printviettel",
                method: "POST",
                dataType: "JSON",
                data: { html: html, realorderid: data.realorderid }
            });

            $.ajax({
                url: "/print-order",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    userId: window.CURRENT_USER_ID,
                    type: 'html',
                    content: html,
                    config: {
                        printerName: "HPRT N41",
                        widthMm: 150,
                        heightMm: 100
                    }
                }),
                success: function (res) {
                    if (btn) btn.disabled = false;
                    if (res.success) {
                        ShowToast('success', '<i class="bi bi-printer-fill"></i>', 'Đã lên đơn', `${fbnamex} • ${data.realorderid} • ${(+cod).toLocaleString()} đ`, 4000);
                        FillDiaChi();
                    } else {
                        alert("Máy in đang Offline!");
                    }
                },
                error: function () {
                    if (btn) btn.disabled = false;
                    console.log("Lỗi kết nối route in");
                }
            });
        },
        error: function () {
            if (btn) btn.disabled = false;
            ShowToast('danger', '<i class="bi bi-wifi-off"></i>', 'Lỗi mạng', 'Không thể tạo đơn, kiểm tra lại kết nối', 4000);
        }
    });
}

(function injectLenDonButton() {
    function tryInject() {
        var kgInput = document.getElementById('labelkg');
        if (!kgInput || document.getElementById('btnlendonkh')) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btnlendonkh';
        btn.className = 'btn btn-success';
        btn.title = 'Lên đơn Viettel';
        btn.innerHTML = '🖨️';
        btn.onclick = LenDonKhachHang;

        kgInput.insertAdjacentElement('afterend', btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInject);
    } else {
        tryInject();
    }
})();

(function injectXemChiTietButton() {
    var observer;
    function tryInject() {
        if (document.getElementById('btnchitietdonkh')) {
            if (observer) observer.disconnect();
            return;
        }
        var trackBtn = document.querySelector('[onclick="handleCheckDonHang()"]');
        if (!trackBtn) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btnchitietdonkh';
        btn.className = trackBtn.className || 'btn btn-primary';
        btn.title = 'Xem chi tiết đơn';
        btn.innerHTML = '<i class="bi bi-receipt"></i>';
        btn.onclick = handleXemChiTietDon;

        trackBtn.insertAdjacentElement('afterend', btn);
        if (observer) observer.disconnect();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInject);
    } else {
        tryInject();
    }
    // Phòng trường hợp nút tra hành trình được render động sau khi DOM đã sẵn sàng
    observer = new MutationObserver(tryInject);
    observer.observe(document.body, { childList: true, subtree: true });
})();
$('#nuocngoaix').change(function () {
    OnUpdateUser()
});
$('#checknote').change(function () {
    OnUpdateUser()
});
$('#labelkh').on('change', function () {
    OnUpdateUser();
});
$('#diachi').on('blur', function () {
    OnUpdateUser();
});
$('#note').on('blur', function () {
    OnUpdateUser();
});
function GetLabelColor(label) {
    if (!label || label.length === 0) return '';
    if (label.includes('Xả') || label.includes('Bom')) return 'red';
    if (label.includes('Nước')) return '#F333FF';
    if (label.includes('Có')) return '#F47803';
    if (label.includes('Thân')) return 'green';
    return '';
}
function GetLabelBadgeClass(label) {
    if (!label || label.length === 0) return '';
    if (label.includes('Xả') || label.includes('Bom')) return 'red';
    if (label.includes('Thân')) return 'green';
    if (label.includes('Có')) return 'orange';
    if (label.includes('Nước')) return 'lightpink';
    return '';
}
function OnUpdateUser() {
    var table = $('#tblkhachhang').DataTable();
    var userid = document.getElementById("userid").value;
    if (!userid || document.getElementById("fbname").value.length < 1) {
        return;
    }
    // LẤY DATA BẰNG USERID, KHÔNG DÙNG getRowIdx()
    var data = null;
    table.rows().every(function () {
        if (this.data()[0] == userid) { data = this.data(); }
    });
    if (!data) return;

    var nn = data[10];
    var checknote = data[15];
    if (document.getElementById("checknote").checked) {
        cn = 1;
        checknote = 1;
    } else {
        cn = 2;
        checknote = 0;
    }
    if ($('#nuocngoaix').is(":checked")) {
        nn = $('#nuocngoaix').attr('data-onlabel');
        if (nn != data[10]) { nuocx = 1; }
    } else {
        nn = $('#nuocngoaix').attr('data-offlabel');
        if (nn != data[10]) { nuocx = 2; }
    }
    var phone = document.getElementById("userphone").value;
    var cod = document.getElementById("COD").value.replace(/\./g, '').replace(/,/g, '').trim();
    var kg = document.getElementById("KG").value;
    var diachi = titleCase(document.getElementById("diachi").value);
    var label = document.getElementById("labelkh").value;
    var note = document.getElementById("note").value;
    var realfbid = document.getElementById("realfbid").value;
    if (!isNumeric(cod)) cod = 0;
    if (!isNumeric(kg)) kg = 0;
    if (label == 'Xóa') label = '';

    if ((phone == data[2]) && (diachi == data[3]) && (label == data[4]) && (note == data[6]) && nuocx == 0 && cn == 0) {
        return;
    }

    table.rows().every(function (rowIdx) {
        if (this.data()[0] == userid) {
            if (oldphone.length > 0) {
                this.cell(rowIdx, 1).data(this.cell(rowIdx, 1).data().replaceAll(oldphone, phone));
                oldphone = phone;
            } else {
                this.cell(rowIdx, 1).data(this.cell(rowIdx, 1).data() + `<br><span class="label label--pink" onclick="CP('${phone}')"><b>${phone}</b><a href="tel:${phone}">📱</a></span>`);
            }
            if (nuocx == 1 && !this.cell(rowIdx, 1).data().includes('Nước ngoài')) {
                this.cell(rowIdx, 1).data(this.cell(rowIdx, 1).data() + `<span class="label label--lightpink">Nước ngoài</span>`);
            } else if (nn != 'Nước ngoài') {
                this.cell(rowIdx, 1).data(this.cell(rowIdx, 1).data().split(`<span class="label label--lightpink">Nước ngoài</span>`)[0]);
            }
            // Bỏ badge nhãn cũ (nếu có) trước khi gắn badge mới, vì badge nằm luôn trong HTML của cell tên khách
            if (data[4] && data[4].length > 0) {
                var oldBadge = `<span class="label label--${GetLabelBadgeClass(data[4])}">${data[4]}</span>`;
                this.cell(rowIdx, 1).data(this.cell(rowIdx, 1).data().split(oldBadge).join(''));
            }
            if (label && label.length > 0) {
                var newBadge = `<span class="label label--${GetLabelBadgeClass(label)}">${label}</span>`;
                if (phone.length > 0) {
                    this.cell(rowIdx, 1).data(this.cell(rowIdx, 1).data() + newBadge);
                } else {
                    this.cell(rowIdx, 1).data(this.cell(rowIdx, 1).data() + `<br>` + newBadge);
                }
            }
            this.cell(rowIdx, 2).data(phone);
            this.cell(rowIdx, 3).data(diachi);
            this.cell(rowIdx, 4).data(label);
            this.cell(rowIdx, 6).data(note);
            this.cell(rowIdx, 10).data(nn);
            this.cell(rowIdx, 16).data(checknote);
            this.cell(rowIdx, 17).data(cod);
            this.cell(rowIdx, 18).data(kg);
        }
    });
    table.draw(false);

    var newColor = GetLabelColor(label);
    table.rows().every(function (rowIdx) {
        if (this.data()[0] == userid) {
            $(this.cell(rowIdx, 1).node()).css('color', newColor);
            $(this.cell(rowIdx, 4).node()).css('color', newColor);
        }
    });

    ShowToast('primary', `<img src="${data[1].split('src="').pop().split('"')[0]}" class="rounded me-2" width="30px" height="30px">`, `<strong>${data[11]}</strong>`, 'Đã cập nhật thông tin khách hàng.', 3000);

    $.ajax({
        url: "/updateuser",
        method: "POST",
        data: { phone: phone, diachi: diachi, label: label, note: note, userid: userid, nn: nn, realfbid: realfbid, checknote: checknote, cod: cod, kg: kg },
        dataType: "JSON"
    });
    nuocx = 0; cn = 0;
}

$("#tenkhach").on("keydown", function (e) {
    var keyCode = (e.keyCode ? e.keyCode : e.which);
    if (keyCode == 13) {
        SearchKhach();
    }
});
function getRowIdx() {
    return $('#tblkhachhang').DataTable().cell({
        focused: true
    }).index().row;
}
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
function UpdateRealFBID() {
    var x = $('#tblkhachhang').DataTable().row(getRowIdx()).data();
    if (x[19] == null || x[19] == '') {
        return;
    }
    $.ajax({
        url: "/getrealfbid",
        method: "POST",
        data: { phone: document.getElementById("userphone").value, userid: document.getElementById("userid").value, tag: x[19] },
        dataType: "JSON",
        success: function (x) {
            console.log(x.data);
        }
    });
}

var initkey = 0;
function InItKeys() {
    var t = $('#tblkhachhang').DataTable();
    t.on('key-focus', function (e, datatable, cell) {
        removeopt();
        var x = datatable.row(cell.index().row).data();
        oldphone = x[2];
        document.getElementById("fbname").value = x[11];
        document.getElementById("userphone").value = x[2];
        document.getElementById("diachi").value = x[3];
        document.getElementById("note").value = x[6];
        document.getElementById("labelkh").value = x[4];
        document.getElementById("aka").value = x[9];
        document.getElementById("realfbid").value = x[12];
        document.getElementById("userid").value = x[0];
        //document.getElementById("COD").value = 0;
        document.getElementById("KG").value = 1;
        if (x[15] == 1) {
            document.getElementById("checknote").checked = true;
            ShowImportant('Quan trọng', x[6]);
        } else {
            document.getElementById("checknote").checked = false;
        }
        if (x[10] == 'Nước ngoài') {
            $('#nuocngoaix').bootstrapToggle('on', true);
        } else {
            $('#nuocngoaix').bootstrapToggle('off', true);
        }
        FillDiaChi();
    }).on('key', function (e, datatable, keyCode, cell, originalEvent) {
        var x = datatable.row(cell.index().row).data();
        if ($('#message-input').is(':focus') || $('#notescan').is(':focus') || $('#diachiviettel').is(':focus') || $('#diachimodal').is(':focus') || $('#tblkhachhang_filter input').is(':focus') || $('#MessToSend').is(':focus') || $('#OrderNote').is(':focus') || $('#tenkhach').is(':focus') || $('#fbname').is(':focus') || $('#userphone').is(':focus') || $('#diachi').is(':focus') || $('#note').is(':focus')) {
            return;
        }
        if (keyCode == 67) {
            navigator.clipboard.writeText(x[11]);
        } else if (keyCode == 77) {
            const link = document.createElement('a');
            link.href = 'javascript:void(0);';
            link.dataset.customerId = x[0];
            link.dataset.customerName = x[11];
            link.dataset.senderPageId = x[8];
            link.className = 'open-message-modal';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (keyCode == 80) {
            window.open("https://mbasic.facebook.com/messages/read/?fbid=" + x[12] + "&pageID=" + x[8], '_blank').focus();
        } else if (keyCode == 85) {
            UpdatePsid(x[0]);
        } else if (keyCode == 78) {
            ShowNote();
        }
        //console.log(keyCode);
    });
    initkey = 1;
}
function UpdateDCLD(dccu, dcmoi) {
    $.ajax({
        url: "/updatediachilendon",
        method: "POST",
        data: { dccu: dccu, dcmoi: dcmoi },
        dataType: "JSON",
        success: function (data) {
            console.log('done')
        }
    });
}
function FixAddress() {
    $.ajax({
        url: "/fixaddress",
        method: "POST",
        data: {},
        dataType: "JSON",
        success: function (data) {
        }
    });
}
function UpdatePsid(uid) {
    var x = $('#tblkhachhang').DataTable().row(getRowIdx()).data();
    $.ajax({
        url: "/updateuserpsid",
        method: "POST",
        data: { psid: x[0], pageid: x[8] },
        dataType: "JSON",
        success: function (data) {
            if (data.data.hasOwnProperty('error')) {
                ShowToast('danger', `<i class="bi bi-list-check"></i>&nbsp;`, 'Update', data.data.error.message, 3000);
                return;
            }
            document.getElementById("" + uid + "").src = data.data.picture.data.url;
            ShowToast('success', `<i class="bi bi-list-check"></i>&nbsp;`, 'Update', 'Đã cập nhật KH.', 3000);
        }
    });
}
function SearchKhach() {
    var stringforsearch = s.value;
    if (stringforsearch.length < 2) {
        return;
    }
    if ($.fn.dataTable.isDataTable('#tblkhachhang')) {
        $('#tblkhachhang').DataTable().destroy();
    }
    $.ajax({
        url: "/getuserinfo",
        method: "POST",
        data: { stringforsearch: stringforsearch },
        dataType: "JSON",
        success: function (data) {
            var html = '';
            var zzzlabel = '';
            if (data.data.length > 0) {
                for (var i = 0; i < data.data.length; i++) {
                    if (data.data[i].realfbid == data.data[i].userid) {
                        continue;
                    }
                    var note = data.data[i].note;
                    if (note === undefined || note === null || note == 'null') {
                        note = '';
                    }
                    var aka = data.data[i].aka;
                    var idpage = data.data[i].pageid;
                    var buttonpage1, buttonpage2;
                    if (aka == null) {
                        aka = '';
                    }
                    var xlabel = data.data[i].label;
                    var phone = data.data[i].phone;
                    var diachi = data.data[i].diachi;
                    if (diachi === null) { diachi = '' }
                    var name = `<img id='${data.data[i].userid}' src='/images/ava/${data.data[i].userid}.jpg' class="avatar"><b onclick="CP('${data.data[i].fbname}')">${data.data[i].fbname}</b>`;
                    if (diachi > 0) {
                        name = name + `<svg width="20px" height="20px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="location-outline" fill="#000000" transform="translate(106.666667, 42.666667)"> <path d="M149.333333,7.10542736e-15 C231.807856,7.10542736e-15 298.666667,66.8588107 298.666667,149.333333 C298.666667,176.537017 291.413333,202.026667 278.683512,224.008666 C270.196964,238.663333 227.080238,313.32711 149.333333,448 C71.5864284,313.32711 28.4697022,238.663333 19.9831547,224.008666 C7.25333333,202.026667 2.84217094e-14,176.537017 2.84217094e-14,149.333333 C2.84217094e-14,66.8588107 66.8588107,7.10542736e-15 149.333333,7.10542736e-15 Z M149.333333,85.3333333 C113.987109,85.3333333 85.3333333,113.987109 85.3333333,149.333333 C85.3333333,184.679557 113.987109,213.333333 149.333333,213.333333 C184.679557,213.333333 213.333333,184.679557 213.333333,149.333333 C213.333333,113.987109 184.679557,85.3333333 149.333333,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>`;
                    }
                    if (aka.length > 0) {
                        name = name + `<svg width="20px" height="20px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#000000" class="bi bi-people-fill"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path> <path fill-rule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"></path> <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path> </g></svg>`;
                    }
                    if (idpage == '223266991771270') {
                        name = name + `<i class="bi bi-1-square"></i>`;
                        buttonpage1 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=223266991771270&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                        buttonpage2 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=102116919355833&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                    }
                    if (idpage == '102116919355833') {
                        name = name + `<i class="bi bi-2-square"></i>`;
                        buttonpage1 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=102116919355833&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                        buttonpage2 = `<a href='https://business.facebook.com/latest/inbox/messenger?asset_id=223266991771270&selected_item_id=${data.data[i].realfbid}&mailbox_id=&thread_type=FB_MESSAGE' target="blank"><i class="bi bi-messenger"></i></a>`;
                    }
                    if (data.data[i].nuocngoai == 'Nước ngoài') {
                        if (phone.length > 0) {
                            name = name + `<svg fill="#000000" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg><br><span class="label label--lightpink">${data.data[i].nuocngoai}</span>`;
                        } else {
                            name = name + `<svg fill="#000000" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.704"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M15.5 2c-8.008 0-14.5 6.492-14.5 14.5s6.492 14.5 14.5 14.5 14.5-6.492 14.5-14.5-6.492-14.5-14.5-14.5zM10.752 3.854c-0.714 1.289-1.559 3.295-2.113 6.131h-4.983c1.551-2.799 4.062-4.993 7.096-6.131zM3.154 10.987h5.316c-0.234 1.468-0.391 3.128-0.415 5.012h-6.060c0.067-1.781 0.468-3.474 1.159-5.012zM1.988 17.001h6.072c0.023 1.893 0.188 3.541 0.422 5.012h-5.29c-0.694-1.543-1.138-3.224-1.204-5.012zM3.67 23.015h4.977c0.559 2.864 1.416 4.867 2.134 6.142-3.046-1.134-5.557-3.336-7.111-6.142zM15.062 30.009c-1.052-0.033-2.067-0.199-3.045-0.46-0.755-1.236-1.736-3.363-2.356-6.534h5.401v6.994zM15.062 22.013h-5.578c-0.234-1.469-0.396-3.119-0.421-5.012h5.998v5.012zM15.062 15.999h-6.004c0.025-1.886 0.183-3.543 0.417-5.012h5.587v5.012zM15.062 9.985h-5.422c0.615-3.148 1.591-5.266 2.344-6.525 0.987-0.266 2.015-0.435 3.078-0.47v6.995zM29.003 15.999h-5.933c-0.025-1.884-0.182-3.544-0.416-5.012h5.172c0.693 1.541 1.108 3.23 1.177 5.012zM27.322 9.985h-4.837c-0.549-2.806-1.382-4.8-2.091-6.090 2.967 1.154 5.402 3.335 6.928 6.090zM16.063 2.989c1.067 0.047 2.102 0.216 3.092 0.493 0.751 1.263 1.72 3.372 2.331 6.503h-5.423v-6.996zM16.063 10.987h5.587c0.234 1.469 0.392 3.126 0.417 5.012h-6.004v-5.012zM16.063 17.001h5.998c-0.023 1.893-0.187 3.543-0.421 5.012h-5.577v-5.012zM16.063 29.991v-6.977h5.402c-0.617 3.152-1.591 5.271-2.343 6.512-0.978 0.272-2.005 0.418-3.059 0.465zM20.367 29.114c0.714-1.276 1.56-3.266 2.112-6.1h4.835c-1.522 2.766-3.967 4.95-6.947 6.1zM27.795 22.013h-5.152c0.234-1.471 0.398-3.119 0.423-5.012h5.927c-0.067 1.787-0.508 3.468-1.198 5.012z"></path> </g></svg><br><span class="label label--lightpink">${data.data[i].nuocngoai}</span>`;
                        }
                    }
                    if (phone === null) { phone = '' }
                    if (phone.length > 0) {
                        name = name + `<br><span class="label label--pink" data-toggle="phone" onclick="CP('${phone}')"><b>${phone}</b><a href="tel:${phone}">📱</a></span>`;
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
                    var buttonchat = `<a href="javascript:void(0);" data-customer-id="${data.data[i].userid}" data-customer-name="${data.data[i].fbname}" data-sender-page-id="${data.data[i].pageid}" class="open-message-modal"><i class="bi bi-chat-square-text-fill"></i></a>`;
                    html += `
                                <tr>
                                    <td>${data.data[i].userid}</td>
                                    <td>${name}</td>
                                    <td>${phone}</td>
                                    <td>${diachi}</td>
                                    <td>${data.data[i].label}</td>
                                    <td>${data.data[i].fbnamex}</td>
                                    <td>${note}</td>
                                    <td>${buttonchat}${buttonpage1}${buttonpage2}</td>
                                    <td>${idpage}</td>
                                    <td>${aka}</td>
                                    <td>${data.data[i].nuocngoai}</td>
                                    <td>${data.data[i].fbname}</td>
                                    <td>${data.data[i].realfbid}</td>
                                    <td>${data.data[i].threadid}</td>
                                    <td></td>
                                    <td>${data.data[i].important}</td>
                                    <td>${data.data[i].cod}</td>
                                    <td>${data.data[i].kg}</td>
                                    <td>${data.data[i].id}</td>
                                    <td>${data.data[i].tag}</td>
                                </tr>
                                `;

                }
            }
            $('#tblkhachhang tbody').html(html);
            $('#tblkhachhang').DataTable(
                {
                    keys: {
                        blurable: false,
                    },

                    language: {
                        "decimal": "",
                        "emptyTable": "Chưa có dữ liệu",
                        "info": "Hiển thị _START_ tới _END_ trong tổng số _TOTAL_ khách hàng.",
                        "infoEmpty": "Không có khách nào",
                        "infoFiltered": "(lọc trong _MAX_ khách hàng)",
                        "infoPostFix": "",
                        "thousands": ".",
                        "lengthMenu": "Hiển thị _MENU_ khách hàng",
                        "loadingRecords": "Đang tải...",
                        "processing": "Đang xử lý",
                        "search": "Tìm kiếm:",
                        "zeroRecords": "Không tìm thấy khách hàng nào",
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
                                "1": " - Đang chọn 1 khách.",
                                "_": " - Đang chọn %d khách."
                            }
                        },
                    },
                    lengthMenu: [
                        [20, 25, 35, 50, -1],
                        [20, 25, 35, 50, 'Tất cả']
                    ],
                    pageLength: 20,
                    columnDefs: [
                        { target: 0, visible: false, searchable: false },
                        {
                            target: 1,
                            createdCell: function (td, cellData, rowData, row, col) {
                                if (cellData.length > 0) {
                                    if (rowData[4].includes('Xả') || rowData[4].includes('Bom')) { $(td).css('color', 'red') }
                                    else if (rowData[4].includes('Nước')) { $(td).css('color', '#F333FF') }
                                    else if (rowData[4].includes('Có')) { $(td).css('color', '#F47803') }
                                    else if (rowData[4].includes('Thân')) { $(td).css('color', 'green') }
                                }
                            }
                        },
                        { target: 2, visible: false },
                        { target: 3, visible: false },
                        {
                            target: 4,
                            searchable: false,
                            createdCell: function (td, cellData, rowData, row, col) {
                                if (cellData.length > 0) {
                                    if (rowData[4].includes('Xả') || rowData[4].includes('Bom')) { $(td).css('color', 'red') }
                                    else if (rowData[4].includes('Nước')) { $(td).css('color', '#F333FF') }
                                    else if (rowData[4].includes('Có')) { $(td).css('color', '#F47803') }
                                    else if (rowData[4].includes('Thân')) { $(td).css('color', 'green') }
                                }
                            },
                            visible: false,
                        },
                        { target: 5, visible: false },
                        { target: 6, visible: false, searchable: false },
                        { target: 7, visible: true, searchable: false },
                        { target: 8, visible: false, searchable: false },
                        { target: 9, visible: false, searchable: false },
                        { target: 10, visible: false, searchable: false },
                        { target: 11, visible: false, searchable: false },
                        { target: 12, visible: false, searchable: false },
                        { target: 13, visible: false, searchable: false },
                        { target: 14, visible: false, searchable: false },
                        { target: 15, visible: false, searchable: false },
                        { target: 16, visible: false, searchable: false },
                        { target: 17, visible: false, searchable: false },
                        { target: 18, visible: false, searchable: false },
                        { target: 19, visible: false, searchable: false },
                    ],
                    order: [5, 'asc'],
                }
            );
            if (initkey === 0) {
                InItKeys();
            }
            $('#tblkhachhang tbody td:eq(0)').click();
        }
    });
}
function MakeUpCol7() {
    var table = $('#tblkhachhang').DataTable();
    table.rows().every(function (rowIdx, tableLoop, rowLoop) {
        if (table.cell(rowIdx, 8).data() == '223266991771270') {
            table.cell(rowIdx, 7).data(table.cell(rowIdx, 7).data() + `<a onclick="ChatBox('${table.cell(rowIdx, 14).data()}','223266991771270','${table.cell(rowIdx, 12).data()}','${table.cell(rowIdx, 2).data()}', '')"><i class="bi bi-envelope-fill"></i></a><a onclick="ChatBox('${table.cell(rowIdx, 15).data()}','102116919355833','${table.cell(rowIdx, 12).data()}','${table.cell(rowIdx, 2).data()}', '')"><i class="bi bi-envelope-fill"></i></a>`);
        } else {
            table.cell(rowIdx, 7).data(table.cell(rowIdx, 7).data() + `<a onclick="ChatBox('${table.cell(rowIdx, 14).data()}','102116919355833','${table.cell(rowIdx, 12).data()}','${table.cell(rowIdx, 2).data()}', '')"><i class="bi bi-envelope-fill"></i></a><a onclick="ChatBox('${table.cell(rowIdx, 15).data()}','223266991771270','${table.cell(rowIdx, 12).data()}','${table.cell(rowIdx, 2).data()}', '')"><i class="bi bi-envelope-fill"></i></a>`);
        }
    }).draw(false);
}
function CP(x) {
    navigator.clipboard.writeText(x);
}
function CopyPhoneF() {
    var copyText = document.getElementById("userphone");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
}

var orderadd = document.getElementById('diachilendon');
var donhang = document.getElementById('donhangdalen');
function removeopt() {
    removeOptions(orderadd);
    removeOptions(donhang);
}
function removeOptions(selectElement) {
    var i, L = selectElement.options.length - 1;
    for (i = L; i >= 0; i--) {
        selectElement.remove(i);
    }
}

function AddDiaChi() {
    var x = $('#tblkhachhang').DataTable().row(getRowIdx()).data();
    var diachi = titleCase(document.getElementById('diachi').value.trim());
    var phone = document.getElementById('userphone').value.trim();
    var fbnamex = document.getElementById('fbname').value;
    var userid = document.getElementById('userid').value;

    window.fbnamex = fbnamex;
    window.khid = x[18];
    window.userid = userid;

    if (phone.length !== 10 && !(phone.length === 11 && phone.startsWith("02"))) {
        alert('Sai số điện thoại, kiểm tra lại');
        return;
    }
    if (diachi.length < 10) {
        alert('Địa chỉ phải trên 10 ký tự');
        return;
    }

    $.ajax({
        url: "/checkaddress",
        method: "POST",
        data: { name: fbnamex, phone: phone, diachi: diachi, khid: x[18], userid: userid },
        dataType: "JSON",
        success: function (data) {
            if (data.hasOwnProperty('error')) {
                ShowToast('danger', '<i class="bi bi-x-circle"></i>', 'Lỗi', data.error, 4000);
                return;
            }

            const select = document.getElementById('diachilendon');
            [...select.options].forEach(opt => {
                if (opt.dataset.address === diachi) opt.remove();
            });

            const adxParts = (data.adx || '').split(',').map(s => s.trim());
            const xa = adxParts[0] || '';
            const huyen = adxParts[1] || '';
            const tinh = adxParts[2] || '';

            const opt = document.createElement('option');
            opt.value = data.id || diachi;
            opt.text = (data.jtready ? '✅ ' : '⚠️ ') + diachi;
            opt.dataset.address = diachi;
            opt.dataset.xa = xa;
            opt.dataset.huyen = huyen;
            opt.dataset.tinh = tinh;
            opt.dataset.xajt = data.xajt || '';
            opt.dataset.huyenjt = data.huyenjt || '';
            opt.dataset.tinhjt = data.tinhjt || '';
            opt.dataset.jtready = data.jtready ? '1' : '0';
            opt.dataset.dbid = data.id || '';

            select.appendChild(opt);
            select.value = opt.value;

            ShowToast('success', '<i class="bi bi-check2-circle"></i>', 'Đã thêm', `GB: ${diachi}<br><small>Viettel: ${data.adx}</small>`, 5000);

            document.getElementById('diachi').value = diachi;
            OnUpdateUser();
        }
    });
}

function FillDiaChi() {
    var x = $('#tblkhachhang').DataTable().row(getRowIdx()).data();
    window.fbnamex = x[11];
    window.khid = x[18];
    window.userid = x[0];

    const select = document.getElementById('diachilendon');
    removeOptions(select);

    $.ajax({
        url: "/getdiachilendon",
        method: "POST",
        data: { phone: x[2], userid: x[0] },
        dataType: "JSON",
        success: function (data) {
            for (var i = 0; i < data.data.length; i++) {
                var item = data.data[i];
                var opt = document.createElement('option');
                opt.value = item.id;
                opt.text = (item.jtready ? '✅ ' : '⚠️ ') + item.address;
                opt.dataset.xa = item.xa || '';
                opt.dataset.huyen = item.huyen || '';
                opt.dataset.tinh = item.tinh || '';
                opt.dataset.xajt = item.xajt || '';
                opt.dataset.huyenjt = item.huyenjt || '';
                opt.dataset.tinhjt = item.tinhjt || '';
                opt.dataset.address = item.address || '';
                opt.dataset.jtready = item.jtready ? '1' : '0';
                opt.dataset.dbid = item.id;
                select.appendChild(opt);
            }

            if (select.options.length > 0) {
                const firstOpt = select.options[0];
                if (firstOpt.dataset.jtready === '0' && !firstOpt.disabled) {
                    AutoValidateJT(firstOpt);
                }
            }
            select.onchange = function () {
                const opt = this.options[this.selectedIndex];
                if (opt && opt.dataset.jtready === '0' && !opt.disabled) {
                    AutoValidateJT(opt);
                }
            };
        }
    });

    $.ajax({
        url: "/getuserorder",
        method: "POST",
        data: { userid: x[0] },
        dataType: "JSON",
        success: function (data) {
            var donhang = document.getElementById('donhangdalen');
            removeOptions(donhang);
            for (var i = 0; i < data.data.length; i++) {
                let date = data.data[i].date.substring(9);
                if (data.data[i].realorderid.includes('1P1')) {
                    date = '[1P] ' + date;
                }
                if (data.data[i].statuscode == 107) continue;
                var statustext = data.data[i].statustext || 'TK Cũ';
                AddOptions(donhang, data.data[i].realorderid,
                    date + " - " + data.data[i].name + " - " + data.data[i].cod.toLocaleString() + "đ [" + data.data[i].kg + " KG] [" + statustext + "]");
            }
        }
    });
}
window.saveFile = function saveFile() {
    $.ajax({
        url: "/getdonhangjt",
        method: "POST",
        data: {},
        dataType: "JSON",
        success: function (data) {
            const order = eval("[" + data.data + "]");
            var opts = [{ sheetid: 'Danh sách Lên đơn', header: true }];
            alasql('SELECT * INTO XLSX("Len_Don_JT.xlsx",?) FROM ?',
                [opts, [order]]);
        }
    });
}
window.saveFileVT = function saveFileVT() {
    $.ajax({
        url: "/getdonhangvt",
        method: "POST",
        data: {},
        dataType: "JSON",
        success: function (data) {
            const order = eval("[" + data.data + "]");
            var opts = [{ sheetid: 'Danh sách Lên đơn', header: true }];
            alasql('SELECT * INTO XLSX("Len_Don_Viettel.xlsx",?) FROM ?',
                [opts, [order]]);
        }
    });
}
function CopyNameF() {
    var copyText = document.getElementById("fbname");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
}
function SelectAll() {
    var searchtext = document.getElementById("tenkhach");
    searchtext.select();
    searchtext.setSelectionRange(0, 99999);
}

async function handleRowDoubleClick(rowElement) {
    var data = $('#tblkhachhang').DataTable().row(rowElement).data();
    if (!data) return;

    var nameHtml = data[1];
    var phone = data[2] ? data[2].trim() : "";
    var idKhachHang = data[18];

    var avatarUrl = $('<div>').html(nameHtml).find('img').attr('src') || "";

    if (!avatarUrl) {
        avatarUrl = window.location.origin + `/images/ava/${data[0]}.jpg`;
    } else if (avatarUrl.startsWith('/')) {
        avatarUrl = window.location.origin + avatarUrl;
    }

    var printData = {
        date: ToDay(),
        name: nameHtml.split('<br>')[0].replace(/<[^>]*>?/gm, '').trim(),
        phone: phone,
        comment: "",
        gia: "",
        id: idKhachHang,
        avabase64: avatarUrl,
        address: data[3],
        region: data[10]
    };

    const resPdf = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printData)
    }).then(r => r.json());

    if (resPdf.success) {
        fetch('/print-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: window.CURRENT_USER_ID,
                type: 'pdf',
                content: resPdf.pdfBase64,
                config: {
                    printerName: "XP-80C",
                    widthMm: 80,
                    heightMm: 297,
                    marginTopPx: -5
                }
            })
        })
            .then(r => r.json())
            .then(res => {
                if (res.success);
            });
    } else {
        console.error("Lỗi server tạo PDF:", resPdf.message);
    }
}

$('#tblkhachhang tbody').on('dblclick', 'tr', function () {
    handleRowDoubleClick(this);
});

let lastTap = 0;
$('#tblkhachhang tbody').on('touchend', 'tr', function (e) {
    let currentTime = new Date().getTime();
    let tapLength = currentTime - lastTap;

    if (tapLength < 300 && tapLength > 0) {
        e.preventDefault();
        handleRowDoubleClick(this);
    }
    lastTap = currentTime;
});

let phoneTimer = null;
let lastLoadedPhone = '';

$(document).off('blur change input', '#userphone')
    .on('change', '#userphone', function () {
        const newPhone = this.value.trim();
        if (!newPhone || newPhone === lastLoadedPhone) return;

        clearTimeout(phoneTimer);
        phoneTimer = setTimeout(() => {
            lastLoadedPhone = newPhone;
            OnUpdateUser();
            loadDiaChiByPhone(newPhone);
        }, 350);
    });

function loadDiaChiByPhone(phone) {
    const selDiaChi = document.getElementById('diachilendon');
    const selDon = document.getElementById('donhangdalen');
    if (!phone || !selDiaChi) return;

    window.userid = document.getElementById('userid').value;

    selDiaChi.innerHTML = '<option>Đang tải...</option>';
    if (selDon) selDon.innerHTML = '';

    $.ajax({
        url: "/getdiachilendon",
        method: "POST",
        data: { phone: phone, userid: window.userid },
        dataType: "JSON",
        success: function (res) {
            selDiaChi.innerHTML = '';
            if (!res.data || res.data.length === 0) {
                selDiaChi.innerHTML = '<option>Chưa có địa chỉ cho SĐT này</option>';
                ShowToast('warning', '<i class="bi bi-phone"></i>', 'SĐT mới', 'Không tìm thấy địa chỉ', 3000);
                return;
            }
            res.data.forEach(function (item) {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.text = (item.jtready ? '✅ ' : '⚠️ ') + item.address;
                opt.dataset.address = item.address || '';
                opt.dataset.jtready = item.jtready ? '1' : '0';
                opt.dataset.xa = item.xa || '';
                opt.dataset.huyen = item.huyen || '';
                opt.dataset.tinh = item.tinh || '';
                opt.dataset.xajt = item.xajt || '';
                opt.dataset.huyenjt = item.huyenjt || '';
                opt.dataset.tinhjt = item.tinhjt || '';
                opt.dataset.dbid = item.id;
                selDiaChi.appendChild(opt);
            });

            const firstOpt = selDiaChi.options[0];
            if (firstOpt && firstOpt.dataset.jtready === '0') {
                AutoValidateJT(firstOpt);
            }

            selDiaChi.onchange = function () {
                const opt = this.options[this.selectedIndex];
                if (opt && opt.dataset.jtready === '0' && !opt.disabled) {
                    AutoValidateJT(opt);
                }
            };

            ShowToast('info', '<i class="bi bi-check"></i>', 'Đã tải', res.data.length + ' địa chỉ cho ' + phone, 2500);
        },
        error: function (xhr) {
            console.error('Lỗi load địa chỉ:', xhr);
            selDiaChi.innerHTML = '<option>Lỗi tải</option>';
        }
    });
}