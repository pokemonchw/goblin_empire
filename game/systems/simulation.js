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
        game.weather.updateWeather(state);
        game.jobs.resetResourceRates(state);
        game.population.updateLaborFromPopulation(state);
        game.jobs.applyJobProduction(state, deltaSeconds);
        game.production.updateProduction(state, deltaSeconds);
        game.population.consumeFungusForPopulation(state, deltaSeconds);
        game.crafting.updateAutoCrafting(state, deltaSeconds);
        game.captivesSystem.updateCaptives(state, deltaSeconds);
        game.eventsSystem.updateEvents(state, deltaSeconds);
        game.diplomacy.updateDiplomacyMissions(state, deltaSeconds);
        game.expeditions.updateExpeditions(state, deltaSeconds);
        game.prestigeSystem.updatePrestigeStatistics(state);
        game.captivesSystem.syncCaptiveResource(state);
        game.unlocks.applyPopulationUnlocks(state);
        resolveExtinctionIfNeeded(state, nowTimestamp);
        state.lastActiveTimestamp = nowTimestamp;

        return deltaSeconds;
    }

    /**
     * 检查当前局是否已经没有任何哥布林和俘虏，并在需要时结束本局。
     *
     * @param {GameState} state - 当前游戏状态对象，灭亡时会被原地替换为初始状态。
     * @param {number=} nowTimestamp - 当前 Unix 毫秒时间戳；省略时使用 Date.now()。
     * @returns {boolean} 是否触发游戏结束；true 表示状态已回到初始界面。
     */
    function resolveExtinctionIfNeeded(state, nowTimestamp) {
        if (!isRunExtinct(state)) {
            return false;
        }

        resetExtinctRun(state, nowTimestamp || Date.now());
        return true;
    }

    /**
     * 判断当前局是否已经灭亡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否灭亡；true 表示已进入正式局且无存活哥布林、无俘虏。
     */
    function isRunExtinct(state) {
        if (!state.challenges || !state.challenges.runMode || state.challenges.runMode === "undecided") {
            return false;
        }

        // number 存活哥布林数量：灭亡判定要求没有任何存活个体。
        var aliveGoblinCount = game.population.countAliveGoblins(state);

        // number 俘虏数量：灭亡判定要求没有任何可继续繁衍或处置的俘虏。
        var captiveCount = Array.isArray(state.captives) ? state.captives.length : 0;

        return aliveGoblinCount <= 0 && captiveCount <= 0;
    }

    /**
     * 将灭亡局原地替换为新局初始状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会被清空字段并写入初始状态字段。
     * @param {number} nowTimestamp - 当前 Unix 毫秒时间戳，用于重置模拟推进起点。
     * @returns {void} 无返回值。
     */
    function resetExtinctRun(state, nowTimestamp) {
        // GameState 初始状态：提供回到初始界面的完整字段集合。
        var nextState = game.initialState.createInitialState();

        nextState.lastActiveTimestamp = nowTimestamp;

        if (game.save && game.save.clearLocalStorageSave) {
            game.save.clearLocalStorageSave();
        }

        // string[] 旧状态字段列表：原地替换前先删除，避免遗留已灭亡局字段。
        var stateKeys = Object.keys(state);

        // number 循环索引：遍历旧状态字段列表的整数下标。
        for (var stateKeyIndex = 0; stateKeyIndex < stateKeys.length; stateKeyIndex += 1) {
            // string 当前字段名：用于删除旧状态字段。
            var stateKey = stateKeys[stateKeyIndex];

            delete state[stateKey];
        }

        Object.assign(state, nextState);
        game.captivesSystem.syncCaptiveResource(state);
        addLog(state, "important", game.text.TEXT_REGISTRY.logs.extinct);
    }

    // Object 模拟模块命名空间：提供主循环和日志函数。
    game.simulation = {
        addLog: addLog,
        togglePause: togglePause,
        updateGame: updateGame,
        resolveExtinctionIfNeeded: resolveExtinctionIfNeeded,
        isRunExtinct: isRunExtinct
    };
})(window.GoblinEmpire);
