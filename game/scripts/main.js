/* 应用入口：创建状态、绑定事件并启动主循环。 */
/**
 * 初始化应用入口模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会读取各模块启动应用。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 启动浏览器静态应用。
     *
     * @returns {void} 无返回值。
     */
    function startApplication() {
        // GameState 当前运行时状态：整个应用唯一的主状态对象。
        var state = loadInitialRuntimeState();

        game.captivesSystem.syncCaptiveResource(state);

        // Object 运行时命名空间：保存当前状态引用，便于加载存档时替换。
        game.runtime = {
            state: state,
            censusFilters: {
                job: "",
                trait: "",
                wound: ""
            },
            // boolean 交互按压状态：true 表示玩家正按住标签栏或内容区元素。
            isPointerPressingInteractiveDom: false,
            // Element|null 指针按压起点：用于判断自动刷新是否会替换当前交互目标。
            pointerDownElement: null
        };

        game.events.bindAllEvents();
        game.render.renderApp(state, true);
        window.setInterval(function () {
            // number 当前毫秒时间戳：驱动确定性主循环入口。
            var nowTimestamp = Date.now();

            game.simulation.updateGame(game.runtime.state, nowTimestamp);
            game.render.renderAppWhenDue(game.runtime.state, nowTimestamp);
        }, 1000 / game.definitions.TICKS_PER_SECOND);
    }

    /**
     * 载入启动时的运行状态。
     *
     * @returns {GameState} 从本地存档恢复或新建的游戏状态。
     */
    function loadInitialRuntimeState() {
        // GameState 新建状态：没有可用存档或存档损坏时使用。
        var fallbackState = game.initialState.createInitialState();

        // string|null 原始本地存档文本：从 localStorage 读取。
        var rawSaveText = game.save.loadRawFromLocalStorage();

        if (!rawSaveText) {
            return fallbackState;
        }

        try {
            return game.save.loadFromText(rawSaveText);
        } catch (error) {
            game.simulation.addLog(fallbackState, "warning", game.text.TEXT_REGISTRY.ui.corruptedSave + error.message);
            return fallbackState;
        }
    }

    startApplication();
})(window.GoblinEmpire);
