/* 主循环模块：负责时间门控和确定性 tick 推进入口。 */
/**
 * 初始化主循环模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 simulation 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 追加一条日志，并限制日志总数。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {"normal"|"important"|"warning"} level - 日志等级。
     * @param {string} text - 中文日志文本。
     * @returns {void} 无返回值。
     */
    function addLog(state, level, text) {
        // number 当前毫秒时间戳：用于日志排序和唯一 ID。
        var nowTimestamp = Date.now();

        // string 日期前缀：按历法解锁状态生成日志日期。
        var datePrefix = game.calendar.formatLogDatePrefix(state);

        // string 日期分隔符：未研究历法前使用紧凑季节格式，研究后使用哥布林历格式。
        var dateSeparator = game.calendar.formatLogSeparator(state);

        state.logs.push({
            id: "log-" + nowTimestamp + "-" + state.logs.length,
            level: level,
            text: datePrefix + dateSeparator + text,
            timestamp: nowTimestamp
        });

        // 日志上限避免长期运行拖慢界面；后续可改为设置项。
        if (state.logs.length > 120) {
            state.logs.splice(0, state.logs.length - 120);
        }
    }

    /**
     * 切换暂停状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @returns {boolean} 切换后的暂停状态；true 表示已暂停。
     */
    function togglePause(state) {
        state.isPaused = !state.isPaused;

        if (state.isPaused) {
            addLog(state, "normal", game.text.TEXT_REGISTRY.logs.paused);
        } else {
            state.lastActiveTimestamp = Date.now();
            addLog(state, "normal", game.text.TEXT_REGISTRY.logs.resumed);
        }

        return state.isPaused;
    }

    /**
     * 推进一次游戏模拟。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} nowTimestamp - 当前 Unix 毫秒时间戳。
     * @returns {number} 本次模拟推进的秒数；暂停时返回 0。
     */
    function updateGame(state, nowTimestamp) {
        if (state.isPaused) {
            return 0;
        }

        // number 秒数差：真实时间差换算成模拟 delta，非负浮点秒。
        var deltaSeconds = Math.max(0, (nowTimestamp - state.lastActiveTimestamp) / 1000);

        game.calendar.updateCalendar(state, deltaSeconds);
        game.jobs.updateJobs(state, deltaSeconds);
        game.production.updateProduction(state, deltaSeconds);
        game.crafting.updateAutoCrafting(state, deltaSeconds);
        game.population.updatePopulation(state, deltaSeconds);
        game.captivesSystem.updateCaptives(state, deltaSeconds);
        game.eventsSystem.updateEvents(state, deltaSeconds);
        game.expeditions.updateExpeditions(state, deltaSeconds);
        game.prestigeSystem.updatePrestigeStatistics(state);
        game.captivesSystem.syncCaptiveResource(state);
        state.lastActiveTimestamp = nowTimestamp;

        return deltaSeconds;
    }

    // Object 模拟模块命名空间：提供主循环和日志函数。
    game.simulation = {
        addLog: addLog,
        togglePause: togglePause,
        updateGame: updateGame
    };
})(window.GoblinEmpire);
