const WORKDAY_STR     = '平日';
const TIME_REGEXP     = /\d+.\d\d/;
const BASIS_WORK_TIME = 8;

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

    // 平均時間を計算・表示
    const aveWorkTime  = getHourMinuterStr(workTime / workDays);
    if(!isNaN(aveWorkTime)) WORK_TIME_ELM.innerHTML += `<br>平均：${aveWorkTime}`;

    // 今月なら、着地見込みの労働過不足時間を表示
    if(isThisMonth) {
        const baseWorkTime = getHourMinuterStr(BASIS_WORK_TIME * workDays);
        const savingTime = getHourMinuterStr(workTime - (BASIS_WORK_TIME * workDays));
        if(!isNaN(savingTime) && !isNaN(baseWorkTime)) {
            WORK_TIME_DIF_ELM.innerHTML += '<br><span class="js-saving-time-toggle" style="cursor:default;position:relative;display:inline-block;">残業見込：' + savingTime + '<span class="js-saving-time-balloon" style="display:none;position:absolute;left:0;top:1.6em;z-index:9999;background:#fff;border:1px solid #999;border-radius:6px;padding:6px 8px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);">勤務日+有給日数：' + workDays + '日<br>基準時間：' + baseWorkTime + '時間<br>労働時間：' + workTimeStr + '時間</span></span>';
            const toggleElm = WORK_TIME_DIF_ELM.querySelector('.js-saving-time-toggle');
            const balloonElm = toggleElm?.querySelector('.js-saving-time-balloon');
            toggleElm?.addEventListener('mouseenter', () => {
                if(balloonElm) balloonElm.style.display = 'block';
            });
            toggleElm?.addEventListener('mouseleave', () => {
                if(balloonElm) balloonElm.style.display = 'none';
            });
        }
    }
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
