const WORKDAY_STR     = '平日';
const TIME_REGEXP     = /\d+.\d\d/;

const BASIS_WORK_TIME_ELM   = document.querySelectorAll('.custom2')[1];
const WORK_TIME_ELM         = document.querySelectorAll('.custom3')[1];
const WORK_TIME_DIF_ELM     = document.querySelectorAll('.custom4')[1];
const WORK_DAY_TYPE_ELMS    = document.querySelectorAll('tbody .work_day_type');
const DAILY_WORK_TIME_ELMS  = document.querySelectorAll('tbody .custom1');
const YEAR_MONTH_SELECT_ELM = document.querySelector('#select_year_month_picker');

/**
 * 平均時間・昨日までの過不足時間を表示する
 * @returns {void}
 */
function showAveTime() {
    
    // 取得できない要素があれば終了
    if (!(BASIS_WORK_TIME_ELM && WORK_TIME_ELM        && WORK_TIME_DIF_ELM && 
          WORK_DAY_TYPE_ELMS  && DAILY_WORK_TIME_ELMS && YEAR_MONTH_SELECT_ELM)) return;

    // 労働日数の数を数える
    let workDays1 = 0, workDays2 = 0;
    // 実労働時間に記載がある日数を労働日数とみなして数える(前労働日が前日以前でも当日でも拾えるように)
    for(let w of DAILY_WORK_TIME_ELMS) if(w.innerText.match(TIME_REGEXP) !== null) workDays1 += 1;
    // 昨日までの平日の数を労働日数とみなして数える(欠勤対策)
    const yesterdayDate =  new Date().getDate() - 1;
    for(let i = 0; i < yesterdayDate; i++) if(WORK_DAY_TYPE_ELMS[i].innerText === WORKDAY_STR) workDays2 += 1;
    // 数え損ないのないと思われる方の値を労働日数とする
    let workDays = Math.max(workDays1, workDays2);

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

    // 1日の基準労働時間と当月総労働時間を取得 一度時間の数値に変える（ex. '8.30' -> 8.5）
    const daylyBasisWorkTime = getHourNumFromHourMinuteStr(BASIS_WORK_TIME_ELM.innerHTML) / fullWorkDays;
    const workTime           = getHourNumFromHourMinuteStr(WORK_TIME_ELM.innerText); 

    // 平均時間を計算・表示
    const aveWorkTime  = getHourMinuterStr(workTime / workDays);
    if(!isNaN(aveWorkTime)) WORK_TIME_ELM.innerHTML += `<br>平均：${aveWorkTime}`;

    // 今月なら、着地見込みの労働過不足時間を表示 
    if(isThisMonth) {
        const savingTime = getHourMinuterStr(workTime - (daylyBasisWorkTime * workDays));
        if(!isNaN(savingTime)) WORK_TIME_DIF_ELM.innerHTML += `<br>見込：${savingTime}`;
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
 * 数値 num を小数点以下 digits 桁で表示した文字列を返す
 * @param {number} num
 * @param {number} digits
 * @returns string 数値 num を小数点以下 digits 桁で表示した文字列
 */
function getHourMinuterStr(num) {
    if(isNaN(num)) return NaN;
    let hour   = Math.floor(num);
    let minute = Math.round((num - hour) * 60);
    if(minute < 10) minute = '0' + minute;
    if(minute >= 60) {
        hour += 1;
        minute = '00';
    }
    return `${hour}.${minute}`;
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