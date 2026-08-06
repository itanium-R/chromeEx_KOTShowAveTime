const WORKDAY_STR     = '平日';
const TIME_REGEXP     = /\d+.\d\d/;
const BASIS_WORK_TIME = 8;
const BASE_TIME_LABEL = '元の基準時間';

// メーターの設定
const WEEKLY_STATUTORY_HOURS = 40;  // 法定労働時間（週）。基準時間が画面から取れないときの計算に使う
const OVER_MARK_BASE         = 45;  // 基準時間からの目印（基準 +45h）
const OVER_MARK_CONTRACT     = 30;  // 契約時間からの目印（契約 +30h）
const METER_HEADROOM         = 75;  // メーターの上限（基準 + これ）

const COLOR = {
    within   : '#4a6ea8',  // 基準内・契約内
    over     : '#8a5712',  // 超過（目印まで）
    overHard : '#a8402c',  // 超過（目印を超えた分）
    track    : '#e7eaf0',  // 残枠
    mark     : '#3d444f',  // 基準（基準時間／契約時間）の目印
    markWarn : '#a8402c',  // 目印（+45h / +30h）
    markNow  : '#8a9099',  // 現時点の基準（当月のみ）
    projected: '#7d90ad',  // 着地見込みの目印
    ink      : '#3d444f',
    muted    : '#6b7280'
};

// 着地見込みの区間（実績ではないので斜線で描く）
const PROJECTED_FILL = 'repeating-linear-gradient(135deg,' +
    ' rgba(74,110,168,.38) 0 4px, rgba(74,110,168,.12) 4px 8px)';

const KINTAI_TABLE_ELM      = document.querySelector('.htBlock-adjastableTableF table');
const WORK_TIME_ELM         = document.querySelectorAll('.all_work_time')[1];
const WORK_TIME_DIF_ELM     = document.querySelectorAll('.all_work_time')[1];
const WORK_DAY_TYPE_ELMS    = KINTAI_TABLE_ELM?.querySelectorAll('.work_day_type');
const DAILY_WORK_TIME_ELMS  = KINTAI_TABLE_ELM?.querySelectorAll('tbody .all_work_time');
const YEAR_MONTH_SELECT_ELM = document.querySelector('#select_year_month_picker');

/**
 * 平均時間・昨日までの過不足時間を表示する
 * @returns {void}
 */
function showAveTime() {
    // 取得できない要素があれば終了
    if (!(WORK_TIME_ELM       && WORK_TIME_DIF_ELM &&
        WORK_DAY_TYPE_ELMS  && DAILY_WORK_TIME_ELMS && YEAR_MONTH_SELECT_ELM)) return;

    // 労働日数の数を数える
    let workDays1 = 0, workDays2 = 0;
    // 実労働時間に記載がある日数を労働日数とみなして数える(前労働日が前日以前でも当日でも拾えるように)
    for(let w of DAILY_WORK_TIME_ELMS) if(w.innerText.match(TIME_REGEXP) !== null) workDays1 += 1;
    // 昨日までの平日の数を労働日数とみなして数える(欠勤対策)
    const yesterdayDate =  new Date().getDate() - 1;
    for(let i = 0; i <= yesterdayDate; i++) if(WORK_DAY_TYPE_ELMS[i].innerText === WORKDAY_STR) workDays2 += 1;
    // 数え損ないのないと思われる方の値を労働日数とする
    let workDays = workDays1 > 0 ? workDays1 : workDays2;

    // 月全体の平日の数を数える
    let fullWorkDays = 0;
    for(let w of WORK_DAY_TYPE_ELMS) if(w.innerText === WORKDAY_STR) fullWorkDays += 1;

    // 来月以降なら終了、今月ならフラグを立てる、先月以前なら、労働日数数＝月全体の平日の数とする
    let isThisMonth = false;
    if(YEAR_MONTH_SELECT_ELM.value  >  getThisYearMonthStr()) return;
    if(YEAR_MONTH_SELECT_ELM.value === getThisYearMonthStr()) isThisMonth = true;
    if(YEAR_MONTH_SELECT_ELM.value  <  getThisYearMonthStr()) workDays = fullWorkDays;

    // ゼロ割でエラーになる状態（当月１日以外あるいは昨日まで全部休日）なら終了
    if(workDays === 0 || fullWorkDays === 0) return;

    // 当月総労働時間を取得 一度時間の数値に変える（ex. '8.30' -> 8.5）
    const workTimeStr = WORK_TIME_ELM.innerText;
    const workTime = getHourNumFromHourMinuteStr(workTimeStr);

    // 賃金計算期間の暦日数（基準時間を画面から取れないときの計算に使う）
    let calendarDays = WORK_DAY_TYPE_ELMS.length;
    if(calendarDays < 28 || calendarDays > 31) calendarDays = getDaysInMonth(YEAR_MONTH_SELECT_ELM.value);

    // 基準時間は画面の「元の基準時間」から取り、取れなければ法定労働時間の枠を暦から計算する
    const baseTimeStr = getOriginalBaseTime();
    const baseTimeFromScreen = (baseTimeStr === null) ? NaN : getHourNumFromHourMinuteStr(baseTimeStr);
    const isBaseFromScreen = !isNaN(baseTimeFromScreen) && baseTimeFromScreen > 0;
    const baseTime = isBaseFromScreen
        ? baseTimeFromScreen
        : floorToMinute(WEEKLY_STATUTORY_HOURS * calendarDays / 7);

    // 未消化の平日を 8h ずつ（残業も不足もなし）で埋めた場合の着地見込み
    const remainingDays = Math.max(0, fullWorkDays - workDays);
    const projected = workTime + BASIS_WORK_TIME * remainingDays;

    // バルーンに渡す値をまとめる
    const summary = {
        workTime        : workTime,                        // 当月の総労働時間
        workTimeStr     : workTimeStr,                     // 画面表記そのまま
        workDays        : workDays,                        // 勤務日+有給日数（先月以前は平日数）
        fullWorkDays    : fullWorkDays,                    // 月全体の平日数
        calendarDays    : calendarDays,                    // 賃金計算期間の暦日数
        remainingDays   : remainingDays,                   // 未消化の平日
        projected       : projected,                       // 8h で埋めた場合の着地見込み
        nowBasis        : BASIS_WORK_TIME * workDays,      // 現時点の基準時間
        contract        : BASIS_WORK_TIME * fullWorkDays,  // 月間の契約時間（8h × 平日数）
        baseTime        : baseTime,                        // 基準時間（元の基準時間 or 法定労働時間の枠）
        isBaseFromScreen: isBaseFromScreen,                // 基準時間を画面から取れたか
        isThisMonth     : isThisMonth
    };

    // 平均時間を計算・表示（ホバーで内訳とメーターを出す）
    const aveWorkTime = getHourMinuterStr(workTime / workDays);
    if(!isNaN(aveWorkTime)) {
        WORK_TIME_ELM.append(
            document.createElement('br'),
            createToggle('平均：' + aveWorkTime, summary, 'js-ave-time')
        );
    }

    // 今月なら、着地見込みの労働過不足時間を表示（ホバーで内訳とメーターを出す）
    if(isThisMonth) {
        const savingTime = getHourMinuterStr(workTime - summary.nowBasis);
        if(!isNaN(savingTime)) {
            WORK_TIME_DIF_ELM.append(
                document.createElement('br'),
                createToggle('残業見込：' + savingTime, summary, 'js-saving-time')
            );
        }
    }
}

/**
 * 画面の「元の基準時間」を返す
 * 見出しセルを探し、同じ列の 1 つ下の行にある値を取る
 * @returns {string|null} hh.mm となる文字列（見つからなければ null）
 */
function getOriginalBaseTime() {
    const headerCell = Array.from(document.querySelectorAll('th, td'))
        .find(el => el.textContent.trim() === BASE_TIME_LABEL);
    if(!headerCell) return null;

    const table = headerCell.closest('table');
    if(!table) return null;

    const rows = Array.from(table.querySelectorAll('tr'));
    const headerRowIndex = rows.findIndex(row => row.contains(headerCell));
    if(headerRowIndex === -1 || headerRowIndex + 1 >= rows.length) return null;

    const dataCell = rows[headerRowIndex + 1].children[headerCell.cellIndex];
    return dataCell ? dataCell.textContent.trim() : null;
}

/**
 * ホバーでバルーンを出すトグルを作る
 * @param   {string} labelText   常に見えているテキスト
 * @param   {object} summary     バルーンに出す値
 * @param   {string} classPrefix 要素に付けるクラスの接頭辞
 * @returns {HTMLElement}        トグルの span
 */
function createToggle(labelText, summary, classPrefix) {
    const toggle = mk('span', 'cursor:default;position:relative;display:inline-block;', labelText);
    toggle.classList.add(classPrefix + '-toggle');

    const balloon = mk('span',
        'display:none;position:absolute;left:0;top:1.6em;z-index:9999;' +
        'background:#fff;border:1px solid #999;border-radius:6px;padding:8px 10px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.15);width:380px;max-width:80vw;' +
        'white-space:normal;text-align:left;line-height:1.5;font-weight:normal;');
    balloon.classList.add(classPrefix + '-balloon');
    balloon.appendChild(createSummaryRows(summary));
    balloon.appendChild(createMeter(summary));

    toggle.appendChild(balloon);
    toggle.addEventListener('mouseenter', () => { balloon.style.display = 'block'; });
    toggle.addEventListener('mouseleave', () => { balloon.style.display = 'none'; });
    return toggle;
}

/**
 * 基準時間の出どころを表す短い説明を返す
 * @param   {object} s summary
 * @returns {string}
 */
function getBaseTimeSource(s) {
    return s.isBaseFromScreen
        ? BASE_TIME_LABEL
        : '40h × ' + s.calendarDays + '日 ÷ 7';
}

/**
 * バルーン上部の内訳（数値の行）を作る
 * @param   {object} s summary
 * @returns {HTMLElement}
 */
function createSummaryRows(s) {
    const overContract = s.workTime - s.contract;
    const overBase     = s.workTime - s.baseTime;

    const rows = [
        ['勤務日+有給日数', s.workDays + '日'],
        ['基準時間（8h × 上記日数）', getHourMinuterStr(s.nowBasis) + '時間'],
        ['労働時間', s.workTimeStr + '時間'],
        ['契約時間（8h × 平日' + s.fullWorkDays + '日）', getHourMinuterStr(s.contract) + '時間'],
        [(overContract >= 0 ? '契約時間の超過' : '契約時間まで残り'), getHourMinuterStr(Math.abs(overContract)) + '時間']
    ];
    if(s.baseTime > 0) {
        rows.push([BASE_TIME_LABEL + '（' + getBaseTimeSource(s) + '）', getHourMinuterStr(s.baseTime) + '時間']);
        rows.push([(overBase >= 0 ? BASE_TIME_LABEL + 'の超過' : BASE_TIME_LABEL + 'まで残り'),
                   getHourMinuterStr(Math.abs(overBase)) + '時間']);
    }
    if(s.remainingDays > 0) {
        rows.push(['未消化の平日', s.remainingDays + '日']);
        rows.push(['8h で埋めた場合の見込み', getHourMinuterStr(s.projected) + '時間']);
    }

    const box = mk('span', 'display:block;');
    rows.forEach(([label, value]) => {
        const row = mk('span', 'display:flex;justify-content:space-between;gap:10px;font-size:12px;');
        row.appendChild(mk('span', 'color:' + COLOR.muted + ';', label));
        row.appendChild(mk('span', 'color:' + COLOR.ink + ';font-variant-numeric:tabular-nums;', value));
        box.appendChild(row);
    });
    return box;
}

/**
 * メーターを作る（基準時間ベースと契約時間ベースを同じ目盛りで 2 段）
 * @param   {object} s summary
 * @returns {HTMLElement}
 */
function createMeter(s) {
    // 目盛りの端は時間単位に切り上げる（分が出ると読みにくいため）
    // 切り上げなので、基準 +75h や見込みがはみ出すことはない
    const headroomCeiling = Math.max(s.baseTime, s.contract) + METER_HEADROOM;
    const ceiling = Math.ceil(Math.max(headroomCeiling, s.projected));
    const wrap = mk('span', 'display:block;margin-top:8px;');

    // 見出し
    const head = mk('span', 'display:flex;justify-content:space-between;gap:10px;font-size:11px;color:' + COLOR.muted + ';');
    head.appendChild(mk('span', 'color:' + COLOR.ink + ';font-weight:bold;', '労働時間 ' + getHourMinuterStr(s.workTime)));
    head.appendChild(mk('span', null, '+' + METER_HEADROOM + 'h の枠 ' + getHourMinuterStr(headroomCeiling)));
    wrap.appendChild(head);

    // 基準時間ベース
    if(s.baseTime > 0) {
        wrap.appendChild(createTrackBlock(s, {
            title   : '基準',
            base    : s.baseTime,
            mark    : OVER_MARK_BASE,
            sub     : getBaseTimeSource(s),
            ceiling : ceiling
        }));
    }

    // 契約時間ベース
    wrap.appendChild(createTrackBlock(s, {
        title       : '契約',
        base        : s.contract,
        mark        : OVER_MARK_CONTRACT,
        sub         : '8h × 平日' + s.fullWorkDays + '日',
        ceiling     : ceiling,
        showNowMark : true
    }));

    // 軸（両ベースで基準の位置が違うので、目盛りは 0 と上限だけ。基準値は各段の見出しに出す）
    const axis = mk('span', 'display:flex;justify-content:space-between;margin-top:2px;font-size:10px;color:' + COLOR.muted + ';');
    axis.appendChild(mk('span', null, '0'));
    axis.appendChild(mk('span', null, getHourMinuterStr(ceiling)));
    wrap.appendChild(axis);

    // 凡例
    const legend = mk('span', 'display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:10px;color:' + COLOR.muted + ';');
    const legendItem = (background, text) => {
        const item = mk('span', 'display:inline-flex;align-items:center;gap:4px;');
        item.appendChild(mk('span', 'width:8px;height:8px;border-radius:2px;background:' + background + ';'));
        item.appendChild(mk('span', null, text));
        legend.appendChild(item);
    };
    legendItem(COLOR.within, '基準内');
    legendItem(COLOR.over, '超過（目印まで）');
    legendItem(COLOR.overHard, '超過（目印を超えた分）');
    if(s.remainingDays > 0) legendItem(PROJECTED_FILL, '見込み（未消化 × 8h）');
    legendItem(COLOR.track, '残枠');
    wrap.appendChild(legend);

    return wrap;
}

/**
 * メーター 1 段ぶん（見出し + トラック）を作る
 * @param   {object} s   summary
 * @param   {object} opt title / base / mark / sub / ceiling / showNowMark
 * @returns {HTMLElement}
 */
function createTrackBlock(s, opt) {
    const ceiling = opt.ceiling;
    const rate    = (x) => (Math.max(0, x) / ceiling * 100).toFixed(2) + '%';

    const within = Math.min(s.workTime, opt.base);
    const over   = Math.max(0, s.workTime - opt.base);
    const over1  = Math.min(over, opt.mark);
    const over2  = Math.max(0, over - opt.mark);

    // 見込みが目印を超える分（実績で既に超えていればその上積み）
    const projectedOver     = Math.max(0, s.projected - opt.base);
    const projectedOverMark = Math.max(0, projectedOver - opt.mark);

    const block = mk('span', 'display:block;margin-top:6px;');

    // 見出し（基準値と目印をここに書く）
    const label = mk('span', 'display:block;font-size:10px;color:' + COLOR.muted + ';');
    label.appendChild(mk('span', 'color:' + COLOR.ink + ';', opt.title + ' ' + getHourMinuterStr(opt.base)));
    label.appendChild(mk('span', null, '（' + opt.sub + '）・目印 +' + opt.mark + 'h'
        + (over2 > 0 ? '　超過 +' + opt.mark + 'h を ' + getHourMinuterStr(over2) + ' 超' : '')));
    if(s.remainingDays > 0) {
        const projText = '　見込 ' + getHourMinuterStr(s.projected)
            + (projectedOverMark > 0
                ? '（見込で +' + opt.mark + 'h を ' + getHourMinuterStr(projectedOverMark) + ' 超）'
                : '（見込でも +' + opt.mark + 'h 以内）');
        label.appendChild(mk('span', 'color:' + COLOR.projected + ';', projText));
    }
    block.appendChild(label);

    // トラック
    const track = mk('span', 'display:block;position:relative;height:14px;margin-top:2px;border-radius:3px;background:' + COLOR.track + ';');
    const addSeg = (from, len, background, title) => {
        if(len <= 0) return;
        const seg = mk('span',
            'position:absolute;top:0;bottom:0;left:' + rate(from) + ';width:' + rate(len) + ';' +
            'min-width:2px;background:' + background + ';');
        seg.title = title;
        track.appendChild(seg);
    };
    addSeg(0, within, COLOR.within, opt.title + '内 ' + getHourMinuterStr(within));
    addSeg(within, over1, COLOR.over, '超過（+' + opt.mark + 'h まで） ' + getHourMinuterStr(over1));
    addSeg(within + over1, over2, COLOR.overHard, '超過（+' + opt.mark + 'h 超） ' + getHourMinuterStr(over2));
    // 未消化の平日を 8h で埋めた場合の上積み
    if(s.remainingDays > 0) {
        addSeg(s.workTime, s.projected - s.workTime, PROJECTED_FILL,
               '見込みの上積み ' + getHourMinuterStr(s.projected - s.workTime)
               + '（未消化 ' + s.remainingDays + '日 × 8h）');
    }

    const addMark = (x, color, title) => {
        if(x > ceiling) return;
        const mark = mk('span',
            'position:absolute;top:-3px;bottom:-3px;left:' + rate(x) + ';width:2px;background:' + color + ';opacity:.8;');
        mark.title = title;
        track.appendChild(mark);
    };
    addMark(opt.base, COLOR.mark, opt.title + ' ' + getHourMinuterStr(opt.base));
    addMark(opt.base + opt.mark, COLOR.markWarn,
            opt.title + ' +' + opt.mark + 'h = ' + getHourMinuterStr(opt.base + opt.mark));
    // 当月は「現時点の基準（8h × 経過した勤務日数）」も薄く立てる
    if(opt.showNowMark && s.isThisMonth && s.nowBasis < opt.base) {
        addMark(s.nowBasis, COLOR.markNow, '現時点の基準 ' + getHourMinuterStr(s.nowBasis));
    }
    // 着地見込みの位置
    if(s.remainingDays > 0) {
        addMark(s.projected, COLOR.projected,
                '見込み ' + getHourMinuterStr(s.projected) + '（未消化 ' + s.remainingDays + '日 × 8h）');
    }
    block.appendChild(track);

    return block;
}

/**
 * インラインスタイル付きの要素を作る
 * @param   {string} tag
 * @param   {string} [style] cssText
 * @param   {string} [text]  textContent
 * @returns {HTMLElement}
 */
function mk(tag, style, text) {
    const elm = document.createElement(tag);
    if(style) elm.style.cssText = style;
    if(text !== undefined && text !== null) elm.textContent = text;
    return elm;
}

/**
 * 分未満を切り捨てた時間数を返す（KOT の表示と桁を合わせるため）
 * @param   {number} hours
 * @returns {number}
 */
function floorToMinute(hours) {
    return Math.floor(hours * 60) / 60;
}

/**
 * 'YYYY/MM' からその月の日数を返す
 * @param   {string} yearMonthStr
 * @returns {number} 日数（読めなければ 0）
 */
function getDaysInMonth(yearMonthStr) {
    const matched = String(yearMonthStr).match(/(\d{4})\D(\d{1,2})/);
    if(!matched) return 0;
    return new Date(Number(matched[1]), Number(matched[2]), 0).getDate();
}

/**
 * 「今年/今月」となる文字列を返す
 * @returns {string} 'YYYY/MM'
 */
function getThisYearMonthStr() {
    const now = new Date();
    return (now.getFullYear() + '/' + ('0' + (now.getMonth() + 1)).slice(-2));
}

/**
 * 数値 num を hh.mm 形式で表示した文字列を返す
 * @param   {number} num  何時間かを表す数値
 * @returns {string}      hh.mm となる文字列
 */
function getHourMinuterStr(num) {
    if(isNaN(num)) return NaN;
    const sign = (num < 0) ? '-' : '';
    const absNum = Math.abs(num);
    let hour   = Math.floor(absNum);
    let minute = Math.round((absNum - hour) * 60);
    if(minute >= 60) {
        hour += 1;
        minute = 0;
    }
    const minuteStr = (minute < 10) ? ('0' + minute) : String(minute);
    return `${sign}${hour}.${minuteStr}`;
}

/**
 * hh.mmとなっている文字列から何時間かを表す数値を得る
 * 例：'8.30' -> 8.5 (８時間半のとき)
 * @param   {string} str  hh.mmとなる文字列
 * @returns {number}      何時間かを表す数値
 */
function getHourNumFromHourMinuteStr(str) {
    const num    = Number(str);
    const hour   = Math.floor(num);
    const minute = (num - hour) * 100 / 60;
    return (hour + minute);
}

showAveTime();
