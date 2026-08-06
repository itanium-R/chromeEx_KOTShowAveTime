const WORKDAY_STR     = '平日';
const TIME_REGEXP     = /\d+.\d\d/;
const BASIS_WORK_TIME = 8;

// メーターの設定
const OVER_MARK_HOURS = 30;  // 契約時間からの目印（契約 +30h）
const METER_HEADROOM  = 75;  // メーターの上限（契約時間 + これ）

const COLOR = {
    within  : '#4a6ea8',  // 契約時間内
    over    : '#8a5712',  // 超過（目印まで）
    overHard: '#a8402c',  // 超過（目印を超えた分）
    track   : '#e7eaf0',  // 残枠
    mark    : '#3d444f',  // 契約時間の目印
    markWarn: '#a8402c',  // +30h の目印
    markNow : '#8a9099',  // 現時点の基準（当月のみ）
    ink     : '#3d444f',
    muted   : '#6b7280'
};

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

    // バルーンに渡す値をまとめる
    const summary = {
        workTime     : workTime,                       // 当月の総労働時間
        workTimeStr  : workTimeStr,                     // 画面表記そのまま
        workDays     : workDays,                        // 勤務日+有給日数（先月以前は平日数）
        fullWorkDays : fullWorkDays,                    // 月全体の平日数
        nowBasis     : BASIS_WORK_TIME * workDays,      // 現時点の基準時間
        contract     : BASIS_WORK_TIME * fullWorkDays,  // 月間の契約時間（8h × 平日数）
        isThisMonth  : isThisMonth
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
        'box-shadow:0 2px 8px rgba(0,0,0,0.15);width:360px;max-width:80vw;' +
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
 * バルーン上部の内訳（数値の行）を作る
 * @param   {object} s summary
 * @returns {HTMLElement}
 */
function createSummaryRows(s) {
    const over = s.workTime - s.contract;
    const rows = [
        ['勤務日+有給日数', s.workDays + '日'],
        ['基準時間（8h × 上記日数）', getHourMinuterStr(s.nowBasis) + '時間'],
        ['労働時間', s.workTimeStr + '時間'],
        ['契約時間（8h × 平日' + s.fullWorkDays + '日）', getHourMinuterStr(s.contract) + '時間'],
        [(over >= 0 ? '契約時間の超過' : '契約時間まで残り'), getHourMinuterStr(Math.abs(over)) + '時間']
    ];

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
 * 契約時間ベースのメーターを作る
 * 目盛りは 0 〜（契約時間 + METER_HEADROOM）。契約時間と +OVER_MARK_HOURS に目印を立てる
 * @param   {object} s summary
 * @returns {HTMLElement}
 */
function createMeter(s) {
    const ceiling = s.contract + METER_HEADROOM;
    const rate    = (x) => (Math.max(0, x) / ceiling * 100).toFixed(2) + '%';

    const within = Math.min(s.workTime, s.contract);
    const over   = Math.max(0, s.workTime - s.contract);
    const over1  = Math.min(over, OVER_MARK_HOURS);
    const over2  = Math.max(0, over - OVER_MARK_HOURS);

    const wrap = mk('span', 'display:block;margin-top:8px;');

    // 見出し
    const head = mk('span', 'display:flex;justify-content:space-between;gap:10px;font-size:11px;color:' + COLOR.muted + ';');
    head.appendChild(mk('span', 'color:' + COLOR.ink + ';font-weight:bold;', '労働時間 ' + getHourMinuterStr(s.workTime)));
    head.appendChild(mk('span', null, '上限 ' + getHourMinuterStr(ceiling) + '（契約 +' + METER_HEADROOM + 'h）'));
    wrap.appendChild(head);

    // トラック
    const track = mk('span', 'display:block;position:relative;height:16px;margin-top:4px;border-radius:3px;background:' + COLOR.track + ';');
    const addSeg = (from, len, color, title) => {
        if(len <= 0) return;
        const seg = mk('span',
            'position:absolute;top:0;bottom:0;left:' + rate(from) + ';width:' + rate(len) + ';' +
            'min-width:2px;background:' + color + ';');
        seg.title = title;
        track.appendChild(seg);
    };
    addSeg(0, within, COLOR.within, '契約時間内 ' + getHourMinuterStr(within));
    addSeg(within, over1, COLOR.over, '超過（+' + OVER_MARK_HOURS + 'h まで） ' + getHourMinuterStr(over1));
    addSeg(within + over1, over2, COLOR.overHard, '超過（+' + OVER_MARK_HOURS + 'h 超） ' + getHourMinuterStr(over2));

    const addMark = (x, color, title) => {
        if(x > ceiling) return;
        const mark = mk('span',
            'position:absolute;top:-3px;bottom:-3px;left:' + rate(x) + ';width:2px;background:' + color + ';opacity:.8;');
        mark.title = title;
        track.appendChild(mark);
    };
    addMark(s.contract, COLOR.mark, '契約時間 ' + getHourMinuterStr(s.contract));
    addMark(s.contract + OVER_MARK_HOURS, COLOR.markWarn,
            '契約 +' + OVER_MARK_HOURS + 'h = ' + getHourMinuterStr(s.contract + OVER_MARK_HOURS));
    // 当月は「現時点の基準（8h × 経過した勤務日数）」も薄く立てる
    if(s.isThisMonth && s.nowBasis < s.contract) {
        addMark(s.nowBasis, COLOR.markNow, '現時点の基準 ' + getHourMinuterStr(s.nowBasis));
    }
    wrap.appendChild(track);

    // 軸
    const axis = mk('span', 'display:block;position:relative;height:13px;margin-top:2px;font-size:10px;color:' + COLOR.muted + ';');
    const axisLabel = (text, style) => {
        const lab = mk('span', 'position:absolute;top:0;white-space:nowrap;' + style, text);
        axis.appendChild(lab);
    };
    axisLabel('0', 'left:0;');
    axisLabel('契約 ' + getHourMinuterStr(s.contract), 'left:' + rate(s.contract) + ';transform:translateX(-50%);');
    axisLabel('+' + OVER_MARK_HOURS + 'h', 'left:' + rate(s.contract + OVER_MARK_HOURS) + ';transform:translateX(-50%);');
    axisLabel(getHourMinuterStr(ceiling), 'right:0;');
    wrap.appendChild(axis);

    // 凡例
    const legend = mk('span', 'display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:10px;color:' + COLOR.muted + ';');
    const legendItem = (color, text) => {
        const item = mk('span', 'display:inline-flex;align-items:center;gap:4px;');
        item.appendChild(mk('span', 'width:8px;height:8px;border-radius:2px;background:' + color + ';'));
        item.appendChild(mk('span', null, text));
        legend.appendChild(item);
    };
    legendItem(COLOR.within, '契約時間内 ' + getHourMinuterStr(within));
    legendItem(COLOR.over, '超過 〜+' + OVER_MARK_HOURS + 'h ' + getHourMinuterStr(over1));
    legendItem(COLOR.overHard, '超過 +' + OVER_MARK_HOURS + 'h 超 ' + getHourMinuterStr(over2));
    legendItem(COLOR.track, '残枠 ' + getHourMinuterStr(Math.max(0, ceiling - s.workTime)));
    wrap.appendChild(legend);

    return wrap;
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
