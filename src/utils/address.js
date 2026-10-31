'use strict';
function preprocessForViettel(addr) {
    if (!addr) return addr;
    let a = addr.trim();

    const hasDongNai = /đồng\s*nai/i.test(a);
    const hasThongNhat = /thống\s*nhất/i.test(a);
    const alreadyHasHuyen = /huyện\s+thống\s*nhất|h\.\s*thống\s*nhất|\bh\s+thống\s*nhất/i.test(a);

    if (hasDongNai && hasThongNhat && !alreadyHasHuyen) {
        a = a.replace(/thống\s*nhất/gi, 'huyện Thống Nhất');
        a = a.replace(/huyện\s+huyện/gi, 'huyện');
    }
    return a;
}

function applyAddressFixes(sWard, sDist) {

    sWard = (sWard || '').toLowerCase().normalize('NFC').trim();
    sDist = (sDist || '').toLowerCase().normalize('NFC').trim();

    sWard = sWard.replace(/\s*-\s*(h\.|huyện|quận|tt|tx|thị trấn|trấn trấn|thị xã|tt.).*$/i, '').trim();

    //if (sWard === 'trung nghĩa' && sDist === 'hưng yên') sWard = 'yên trung';
    if (sWard === 'cần guộc') sWard = 'cần giuộc';
    if (sWard === 'eatling') sWard = 'ea tling';
    if (sDist === 'phú xuân') sDist = 'huế';
    if (sDist === 'gò vấp' && ['1', '3', '4', '5', '7'].includes(sWard)) sWard = '0' + sWard;
    if (sDist === 'bình giang' && sWard === 'thái minh') sWard = 'bình minh';
    if (sDist === 'nghĩa hưng' && sWard === 'đông thịnh') sWard = 'nghĩa Đồng';
    if (sDist === 'xuân trường' && sWard === 'xuân phúc') sWard = 'xuân hòa';
    if (sDist === 'quỳ châu' && sWard === 'quỳ châu') sWard = 'tân lạc';
    if (sDist === 'đạ huoai' && sWard === 'quốc oai') sDist = 'đạ tẻh';
    if (sDist === 'đạ huoai' && sWard === 'quảng trị') { sDist = 'đạ tẻh'; sWard = 'Triệu Hải' }
    if (sDist === 'gia lộc' && sWard === 'gia tiến') sWard = 'Gia Lương';
    if (sDist === 'ý yên' && sWard === 'tân minh') sWard = 'yên minh';
    if (sDist === 'đạ huoai' && sWard === 'mỹ đức') sDist = 'đạ tẻh';
    if (sDist === 'đạ huoai' && sWard === 'đạ kho') sDist = 'đạ tẻh';
    if (sDist === 'đạ huoai' && sWard === 'đạ lây') sDist = 'đạ tẻh';
    if (sDist === 'long điền' && sWard === 'tam an') sWard = 'an ngãi';
    if (sWard === 'đạ tẻh' && sDist === 'đạ huoai') sDist = 'đạ tẻh';
    if (sDist === 'đạ huoai' && sWard === 'quảng ngãi') sDist = 'cát tiên';
    if (sDist === 'đạ huoai' && sWard === 'đức phổ') sDist = 'cát tiên';
    if (sDist === 'đạ huoai' && sWard === 'phước cát') sDist = 'cát tiên';
    if (sDist === 'đạ huoai' && sWard === 'tiên hoàng') sDist = 'cát tiên';
    if (sDist === 'đạ huoai' && sWard === 'cát tiên') sDist = 'cát tiên';
    if (sDist === 'phú lộc' && sWard === 'hương lộc') sDist = 'nam đông';
    if (sDist === 'ninh giang' && sWard === 'đức phúc') sWard = 'vạn phúc';
    if (sDist === 'huế' && sWard === 'long hồ') sWard = 'Hương Hồ';
    if (sDist === 'giao thủy' && sWard === 'giao thủy') sWard = 'ngô đồng';
    if (sDist === 'cẩm giàng' && sWard === 'phúc điền') sWard = 'cẩm phúc';
    if (sDist === 'kim thành' && sWard === 'hòa bình') sWard = 'Liên Hòa';
    if (sDist === 'kim thành' && sWard === 'vũ dũng') sWard = 'cổ dũng';
    if (sDist === 'nam trực' && sWard === 'nam điền') sWard = 'nam mỹ';
    if (sDist === 'gia lộc' && sWard === 'quang đức') sWard = 'quang minh';
    if (sDist === 'nam sách' && sWard === 'an phú') sWard = 'an lâm';
    if (sDist === 'nam sách' && sWard === 'trần phú') sWard = 'nam trung';
    if (sDist === 'sơn dương' && sWard === 'hồng sơn') sWard = 'hồng lạc';
    if (sDist === 'hớn quản' && sWard === "tân quang") sWard = 'tân quan';
    if (sDist === 'cư mgar' && sWard === "cư m'ga") sWard = 'cư mgar';
    if (sDist === 'chũ' && sWard === 'trù hựu') sDist = 'lục ngạn';
    if (sDist === 'chũ' && sWard === 'quý sơn') sDist = 'lục ngạn';
    if (sDist === 'chũ' && sWard === 'chũ') sDist = 'lục ngạn';
    if (sDist === 'chũ' && sWard === 'thanh hải') sDist = 'lục ngạn';
    if (sDist === 'chũ' && sWard === 'hồng giang') sDist = 'lục ngạn';
    if (sDist === 'thanh chương' && sWard === 'dùng') sWard = 'thanh chương';
    if (sDist === 'đạ huoai' && sWard === "đồng nai thượng") sDist = 'cát tiên';
    if (sDist === 'đạ huoai' && sWard === "đạp'loa") sWard = 'đoàn kết';
    if (sDist === 'bảo lâm' && sWard === 'lộc tlâm') sWard = 'lộc lâm';
    if (sDist === 'chũ' && sWard === 'phượng sơn') sDist = 'lục ngạn';
    if (sDist === 'phú lộc' && sWard === 'khe tre') sDist = 'nam đông';
    if (sDist === 'phú lộc' && sWard === 'thượng nhật') sDist = 'nam đông';
    if (sDist === 'cẩm phả' && sWard === 'hải hòa') sWard = 'cẩm hải';
    if (sDist === 'tứ kỳ' && sWard === 'dân an') sWard = 'Dân Chủ';
    if (sDist === 'phú lộc' && sWard === 'hương phú') sDist = 'nam đông';
    if (sDist === 'nam định' && sWard === 'mỹ lộc') { sDist = 'mỹ lộc'; sWard = 'mỹ tiến'; }
    if (sDist === 'xuân trường' && sWard === 'xuân giang') sWard = 'xuân đài';

    if (sDist.includes('chư') && sDist.includes('pưh')) sDist = 'chư pưh';
    if (sWard.includes('đồng sơn') && sDist.includes('đồng hới')) sWard = 'đồng sơn';
    if (sDist === 'long điền' && ['đất đỏ', 'láng dài', 'lộc an', 'long mỹ', 'long tân', 'phước long thọ', 'phước hải', 'phước hội'].includes(sWard)) {
        sDist = 'đất đỏ';
    }
    return { sWard, sDist };
}

function normalizeSQL(field) {
    const pairs = [
        ['đặ pék', 'đắk pék'], ['kong dỡng', 'kon dỡng'], ['kon chro', 'Kông Chro'], ['iakha', 'ia kha'],
        ['iii', '3'], ['ba', '3'], ['ii', '2'], ['i', '1'],
        ['krông ana', 'krông a na'], ['mdrăk', 'mđrăk'], ['cư drăm', 'cư đrăm'], ['ia sao', 'iasao'],
        ['đất đỏ', 'long đất'], ['long điền', 'long đất'],
        ['cần guộc', 'cần giuộc'], ['bàu hàm 1', 'bàu hàm'],
        ['hoà', 'hòa'], ['hoả', 'hỏa'], ['hoã', 'hỏa'], ['hoạ', 'họa'],
        ['oà', 'òa'], ['oả', 'ỏa'], ['oã', 'ỏa'], ['oạ', 'òa'],
        ['uý', 'úy'], ['uỳ', 'ùy'], ['uỷ', 'ủy'], ['uỹ', 'ũy'], ['uỵ', 'ụy'],
        ['thuý', 'thúy'], ['thuỷ', 'thủy'], ['thuỵ', 'thụy'],
        ['mĩ', 'mỹ'], ['kĩ', 'kỹ'], ['kì', 'kỳ'], ['kí', 'ký'], ['vĩ', 'vỹ'], ['hĩ', 'hỹ'], ['ngĩ', 'nghĩ'],
        ['quí', 'quý'], ['quì', 'quỳ'], ['quỉ', 'quỷ'], ['quĩ', 'quỹ'], ['quị', 'quỵ'], ['qui', 'quy'],
        ['mí', 'mỹ'], ['hì', 'hỳ'], ['tí', 'tý'],
        ['sĩ', 'sỹ'], ['đông xá', 'Ðông Xá'], ['vân đồn', 'Vân Đồn'], ['10', 'mười']
    ];

    let sql = field;
    pairs.forEach(p => {
        sql = `REPLACE(${sql}, '${p[0]}', '${p[1]}')`;
    });
    return sql;
}

function cleanSearchTerm(str) {
    if (!str) return "";
    let cleaned = str.toLowerCase().normalize('NFC').trim();
    if (cleaned.length > 10 && cleaned.charAt(cleaned.length - 9) === '-') {
        cleaned = cleaned.slice(0, -9).trim();
    }
    return cleaned
        .replace(/(kcn|phường|xã|quận|huyện|thị xã|thị trấn|tt|tx|thành phố|thi xã|thi trấn|đảo|p.) (?!\d)/gi, "")
        .replace('trấn trấn', '')
        .replace('`', '')
        .replace('iapal', 'ia pal')
        .replace('nghìn tường', 'nghinh tường')
        .replace('nam  yang', 'nam yang')
        .replace('tt bảy ngàn', 'bảy ngàn')
        .replace('tt. bảy ngàn', 'bảy ngàn')
        .replace('đường mười', 'Đường 10')
        .replace('p mông dương', 'mông dương')
        .replace('.', '')
        .replace('cư jang', 'cư yang')
        .replace('lương thế chân', 'lương thế trân')
        .replace('đăk drong', 'Đăk Đrông')
        .replace('đăk taley', 'đăk ta ley')
        .replace('đakpơ', 'Đak Pơ')
        .replace('cư ê wi', 'cư êwi')
        .replace('lộc thạch', 'Lộc Thạnh')
        .replace('ea knăng', 'ea kuăng')
        .replace('chi lễ', 'tri lễ')
        .replace('buôn choach', 'buôn choah')
        .replace('si phìn', 'si pa phìn')
        .replace('chưpơng', 'chư pơng')
        .replace(' (gia kiệm)', '')
        .replace('bà rịa - vũng tàu', 'bà rịa – vũng tàu')
        .replace('thừa thiên - huế', 'thừa thiên – huế')
        .replace("đăknhau", 'đăk nhau')
        .replace("ba bể (chợ rã)", 'chợ rã')
        .replace("đambri", 'Đạm Bri')
        .replace("ð", 'đ')
        .replace("eacharang", 'Ea Chà Rang')
        .replace("cư niê", 'cư ni')
        .replace("b'lá", 'blá')
        .replace("bun tở", 'bum tở')
        .replace("h'leo", 'hleo')
        .replace("vình an", 'vĩnh an')
        .replace("eabar", 'ea bar')
        .replace("yên  phú", 'yên phú')
        .replace("đăk jrăng", 'Ðắk Drjăng')
        .replace("lai khê", 'lai vu')
        .replace("cẩm đông", 'Cẩm Ðông')
        .replace("bhinh", 'bhing')
        .replace("h'đing", 'hđinh')
        .replace("đăk ýa", 'Ðắk Ya')
        .replace("iale", 'ia le')
        .replace("chu chinh", 'chu trinh')
        .replace("đắk rtih", 'Đắk RTíh')
        .replace("sơ lang", 'sơn lang')
        .replace("đạ k'năng", 'đạ knăng')
        .replace("n'thôn hạ", 'NThol Hạ')
        .replace("h'neng", 'hneng')
        .replace("iachía", 'ia chia')
        .replace("ealy", 'ea ly')
        .replace("nậm pan", 'nậm ban')
        .replace("bát sát", 'bát xát')
        .replace("đăk môi", 'đăk môl')
        .replace("đưng k'nớh", 'đưng knớ')
        .replace("k'đơn", 'ka đơn')
        .replace("iasao", 'ia sao')
        .replace("nghãi", 'ngãi')
        .replace("- h chư pưh", '')
        .replace("iako", 'ia ko')
        .replace("iaka", 'ia ka')
        .replace("iarsươm", 'ia rsươm')
        .replace("cư dliê m'nông", 'Cư Dliê Mnông')
        .replace("iabăng", 'ia băng')
        .replace("iabang", 'ia bang')
        .replace("iadin", 'ia din')
        .replace("nà trì", 'nà chì')
        .replace("liêng s'rônh", 'Liêng Srônh')
        .replace("linh đông", 'Linh Ðông')
        .replace("đất quốc", 'đất cuốc')
        .replace("đăk r'moan", 'đăk rmoan')
        .replace("hà ra", 'hra')
        .replace("ia gar", 'ia ga')
        .replace("chà vài", 'chà vàl')
        .replace('iakring', 'ia kring')
        .replace('iakênh', 'ia kênh')
        .replace('chưhdrông', 'chư hdrông')
        .replace('iake', 'ia ake')
        .replace('iamơrơn', 'ia mrơn')
        .replace('nham biền', 'nham bền')
        .replace('eakao', 'ea kao')
        .replace('eapô', 'ea pô')
        .replace("h'nol", 'hnol')
        .replace("p quang hanh", 'quang hanh')
        .replace('thuận hóa', 'huế')
        .replace('cuebuor', 'xã cư êbur')
        .replace('chưr căm', 'chư rcăm')
        .replace('madaguoil', 'ma đa guôi')
        .replace('madagoil', 'ma đa guôi')
        .replace("đạm'ri", 'đạ mri')
        .replace('lâm ðồng', 'lâm đồng')
        .replace('bình ðịnh', 'bình định')
        .replace('krông pắk', 'krông pắc')
        .replace('ea kmêc', 'ea knuêc')
        .replace("ea m'nang", 'ea mnang')
        .replace("cư m'gar", 'cư mgar')
        .replace("m'đrắk", 'mdrăk')
        .replace("cư m'ta", 'cư mta')
        .replace("mỹ đình ii", 'mỹ đình 2')
        .replace("mỹ đình i", 'mỹ đình 1')
        .replace("an hoà", 'an hòa')
        .replace("đắk rô", 'đắk drô')
        .replace("eatu", 'ea tu')
        .replace("eatam", 'ea tam')
        .replace("ngọc bay", 'ngọk bay')
        .replace("cuôr dăng", 'cuôr đăng')
        .replace("long hoà", 'long hòa')
        .replace("an qui", 'an quy')
        .replace("long đất", 'long điền')
        .replace("nâm n jang", 'nâm njang')
        .replace("thuận hóa", 'huế')
        .replace("nam ðịnh", 'nam định')
        .replace("đliê ya", 'dliê ya')
        .replace("simacai", 'si ma cai')
        .replace("đà tẻh", 'đạ tẻh')
        .replace("pơngdrang", 'pơng drang')
        .replace("tông lệnh", 'tông lạnh')
        .replace("thứ 11", 'thứ mười một')
        .replace("tân hội cơ", 'tân hộ cơ')
        .replace("ia h'drai", 'ia hdrai')
        .replace("lạc phượng", 'phượng kỳ')
        .trim();
}

module.exports = { applyAddressFixes, normalizeSQL, cleanSearchTerm, preprocessForViettel };
