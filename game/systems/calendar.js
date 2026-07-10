/* 日期系统：负责地穴季节循环、历法纪年和日志日期前缀。 */
/**
 * 初始化日期系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 calendar 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 每个游戏日持续秒数：非负浮点秒，现实 1 秒推进 1 个游戏日。
    var SECONDS_PER_DAY = 1;

    // number 每个季节天数：非负整数天，春夏秋冬各 90 天。
    var DAYS_PER_SEASON = 90;

    // number 每个哥布林历月份天数：非负整数天，12 个月合计 360 天。
    var DAYS_PER_MONTH = 30;

    // number 每个哥布林历年份天数：非负整数天，四季合计 360 天。
    var DAYS_PER_YEAR = DAYS_PER_SEASON * 4;

    // string[] 季节名称数组：按春、夏、秋、冬循环显示。
    var SEASON_NAMES = [
        "春",
        "夏",
        "秋",
        "冬"
    ];

    /**
     * 创建初始日期状态。
     *
     * @returns {CalendarState} 日期运行时状态；新局从春第 1 日开始。
     */
    function createInitialCalendar() {
        return {
            elapsedDays: 0,
            dayProgressSeconds: 0,
            isCalendarUnlocked: false,
            calendarEpochDay: null
        };
    }

    /**
     * 规范化日期状态，补齐旧存档缺失字段。
     *
     * @param {Object|null|undefined} savedCalendar - 存档中的日期状态，可能为空或来自旧版本。
     * @returns {CalendarState} 规范化后的日期运行时状态。
     */
    function normalizeCalendarState(savedCalendar) {
        // Object 原始日期状态：读取旧存档字段并逐项兜底。
        var rawCalendar = savedCalendar || {};

        // number 已经过的完整游戏日：非负整数天。
        var elapsedDays = Math.max(0, Math.floor(Number(rawCalendar.elapsedDays) || 0));

        // number 当前游戏日进度：非负浮点秒，不超过单日秒数。
        var dayProgressSeconds = Math.min(SECONDS_PER_DAY - 0.001, Math.max(0, Number(rawCalendar.dayProgressSeconds) || 0));

        // boolean 是否已经研究历法：true 表示日志使用哥布林历。
        var isCalendarUnlocked = Boolean(rawCalendar.isCalendarUnlocked);

        // number|null 历法纪元日：解锁历法时的 elapsedDays，未解锁时为 null。
        var calendarEpochDay = rawCalendar.calendarEpochDay === null || rawCalendar.calendarEpochDay === undefined ? null : Math.max(0, Math.floor(Number(rawCalendar.calendarEpochDay) || 0));

        if (isCalendarUnlocked && calendarEpochDay === null) {
            calendarEpochDay = elapsedDays;
        }

        return {
            elapsedDays: elapsedDays,
            dayProgressSeconds: dayProgressSeconds,
            isCalendarUnlocked: isCalendarUnlocked,
            calendarEpochDay: calendarEpochDay
        };
    }

    /**
     * 推进日期状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会直接修改 calendar 字段。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点秒。
     * @returns {void} 无返回值。
     */
    function updateCalendar(state, deltaSeconds) {
        if (!state.calendar) {
            state.calendar = createInitialCalendar();
        }

        // number 待结算日进度：当前日进度加上本 tick 秒数，单位秒。
        var pendingDayProgressSeconds = state.calendar.dayProgressSeconds + Math.max(0, deltaSeconds);

        // number 完整新增游戏日：由待结算秒数换算的非负整数天。
        var addedDays = Math.floor(pendingDayProgressSeconds / SECONDS_PER_DAY);

        if (addedDays <= 0) {
            state.calendar.dayProgressSeconds = pendingDayProgressSeconds;
            return;
        }

        state.calendar.elapsedDays += addedDays;
        state.calendar.dayProgressSeconds = pendingDayProgressSeconds - addedDays * SECONDS_PER_DAY;
    }

    /**
     * 解锁历法并记录纪元起点。
     *
     * @param {GameState} state - 当前游戏状态对象，会直接修改 calendar 字段。
     * @returns {void} 无返回值。
     */
    function unlockCalendar(state) {
        if (!state.calendar) {
            state.calendar = createInitialCalendar();
        }

        if (state.calendar.isCalendarUnlocked) {
            return;
        }

        state.calendar.isCalendarUnlocked = true;
        state.calendar.calendarEpochDay = state.calendar.elapsedDays;
    }

    /**
     * 格式化日志日期前缀。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 日志日期前缀；未解锁为“春-第n日”，已解锁为“哥布林历xx年x月x日(春)”。
     */
    function formatLogDatePrefix(state) {
        // CalendarState 日期状态：用于判断是否显示历法纪年。
        var calendarState = state.calendar || createInitialCalendar();

        if (!calendarState.isCalendarUnlocked) {
            // Object 季节日期：包含季节名和季节内日序。
            var seasonalDate = getSeasonalDate(calendarState.elapsedDays);

            return seasonalDate.seasonName + "-第" + seasonalDate.dayInSeason + "日";
        }

        // Object 历法日期：包含纪年、月、日和当前季节。
        var goblinDate = getGoblinCalendarDate(calendarState);

        return "哥布林历" + goblinDate.year + "年" + goblinDate.month + "月" + goblinDate.day + "日(" + goblinDate.seasonName + ")";
    }

    /**
     * 格式化日志日期和正文之间的分隔符。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 日志分隔符；未解锁历法为紧凑连字符，已解锁历法为带空格连字符。
     */
    function formatLogSeparator(state) {
        // CalendarState 日期状态：用于判断是否已经进入哥布林历格式。
        var calendarState = state.calendar || createInitialCalendar();

        if (calendarState.isCalendarUnlocked) {
            return " - ";
        }

        return "-";
    }

    /**
     * 格式化状态栏日期文本。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 当前日期文本，用于状态栏显示。
     */
    function formatCurrentDate(state) {
        return formatLogDatePrefix(state);
    }

    /**
     * 取得每个游戏日对应的模拟秒数。
     *
     * @returns {number} 每个游戏日持续秒数，非负浮点秒。
     */
    function getSecondsPerDay() {
        return SECONDS_PER_DAY;
    }

    /**
     * 将模拟秒数换算为游戏天数。
     *
     * @param {number} seconds - 模拟推进秒数，非负浮点秒。
     * @returns {number} 对应游戏天数，非负浮点天。
     */
    function calculateDaysFromSeconds(seconds) {
        // number 安全秒数：过滤非法输入后的非负模拟秒数。
        var safeSeconds = Math.max(0, Number(seconds) || 0);

        return safeSeconds / SECONDS_PER_DAY;
    }

    /**
     * 根据全局游戏日计算季节日期。
     *
     * @param {number} elapsedDays - 已经过的完整游戏日，非负整数天。
     * @returns {{seasonName: string, dayInSeason: number, seasonIndex: number}} 季节日期；dayInSeason 范围 1-90。
     */
    function getSeasonalDate(elapsedDays) {
        // number 年内日序：范围 0-359，用于映射四季。
        var dayInYear = positiveModulo(Math.floor(elapsedDays), DAYS_PER_YEAR);

        // number 季节索引：0 为春，1 为夏，2 为秋，3 为冬。
        var seasonIndex = Math.floor(dayInYear / DAYS_PER_SEASON);

        // number 季节内日序：范围 1-90。
        var dayInSeason = dayInYear - seasonIndex * DAYS_PER_SEASON + 1;

        return {
            seasonName: SEASON_NAMES[seasonIndex],
            dayInSeason: dayInSeason,
            seasonIndex: seasonIndex
        };
    }

    /**
     * 根据历法纪元计算哥布林历日期。
     *
     * @param {CalendarState} calendarState - 日期运行时状态，必须包含 elapsedDays 和 calendarEpochDay。
     * @returns {{year: number, month: number, day: number, seasonName: string}} 哥布林历日期；year 从 1 开始。
     */
    function getGoblinCalendarDate(calendarState) {
        // number 纪元日：解锁历法时的完整游戏日，非负整数天。
        var calendarEpochDay = calendarState.calendarEpochDay === null || calendarState.calendarEpochDay === undefined ? calendarState.elapsedDays : calendarState.calendarEpochDay;

        // number 历法相对日：从解锁历法当天开始的非负整数天。
        var relativeDays = Math.max(0, Math.floor(calendarState.elapsedDays) - calendarEpochDay);

        // number 年份：哥布林历从第 1 年开始计数。
        var year = Math.floor(relativeDays / DAYS_PER_YEAR) + 1;

        // number 年内日序：范围 0-359，用于换算月日。
        var dayInYear = relativeDays % DAYS_PER_YEAR;

        // number 月份：范围 1-12。
        var month = Math.floor(dayInYear / DAYS_PER_MONTH) + 1;

        // number 月内日序：范围 1-30。
        var day = dayInYear % DAYS_PER_MONTH + 1;

        // Object 季节日期：季节继续沿用地穴自然循环，不因历法纪元重置。
        var seasonalDate = getSeasonalDate(calendarState.elapsedDays);

        return {
            year: year,
            month: month,
            day: day,
            seasonName: seasonalDate.seasonName
        };
    }

    /**
     * 计算非负取模，避免负数输入破坏季节循环。
     *
     * @param {number} value - 待取模数值，有符号整数。
     * @param {number} divisor - 模数，正整数。
     * @returns {number} 非负余数，范围 0 到 divisor - 1。
     */
    function positiveModulo(value, divisor) {
        return ((value % divisor) + divisor) % divisor;
    }

    // Object 日期系统命名空间：提供日期状态、推进、解锁和格式化函数。
    game.calendar = {
        createInitialCalendar: createInitialCalendar,
        normalizeCalendarState: normalizeCalendarState,
        updateCalendar: updateCalendar,
        unlockCalendar: unlockCalendar,
        getSecondsPerDay: getSecondsPerDay,
        calculateDaysFromSeconds: calculateDaysFromSeconds,
        formatLogDatePrefix: formatLogDatePrefix,
        formatLogSeparator: formatLogSeparator,
        formatCurrentDate: formatCurrentDate
    };
})(window.GoblinEmpire);
