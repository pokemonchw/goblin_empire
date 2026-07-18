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
        game.unlocks.applyPopulationUnlocks(state);

        // Object 运行时命名空间：保存当前状态引用，便于加载存档时替换。
        game.runtime = {
            state: state,
            censusFilters: {
                job: "",
                trait: "",
                wound: ""
            },
            // string 外交子标签 ID：diplomacy 显示贸易地点，raid 显示掠夺地点。
            activeDiplomacySubtab: "diplomacy",
            // Object.<string, string> 外交世界子标签状态：key 为 diplomacy 或 raid，value 为世界 ID。
            activeDiplomacyWorldByModeId: {},
            // Object.<string, string> 外交势力子标签状态：key 为 行动类型 + 世界 ID，value 为势力 ID。
            activeDiplomacyFactionByScopeId: {},
            // boolean 交互按压状态：true 表示玩家正按住标签栏或内容区元素。
            isPointerPressingInteractiveDom: false,
            // Element|null 指针按压起点：用于判断自动刷新是否会替换当前交互目标。
            pointerDownElement: null,
            // Object.<string, number> 科研路线滚动位置字典：key 为 ResearchLineId，value 为非负 CSS 像素值。
            researchScrollLeftByLineId: {},
            // boolean 科研连线刷新排队标记：true 表示下一动画帧已有重绘任务。
            isResearchConnectionRefreshQueued: false,
            // HTMLElement|null 正在用鼠标拖动的科研路线元素：null 表示未拖动。
            draggedResearchLaneElement: null,
            // number 科研路线拖动起点横坐标：单位为视口 CSS 像素。
            researchLaneDragStartClientX: 0,
            // number 科研路线拖动起点滚动位置：单位为非负 CSS 像素。
            researchLaneDragStartScrollLeft: 0,
            // number 科研路线拖动指针 ID：用于保持同一鼠标指针的捕获。
            researchLaneDragPointerId: -1,
            // TechnologyId|string 当前研究检查器选择：空字符串表示进入页面时自动选择。
            selectedResearchTechnologyId: "",
            // string 研究状态筛选 ID：all、available、unaffordable、preview 或 researched。
            researchFilter: "all",
            // boolean 是否仅显示里程碑科技：true 与当前状态和搜索组合筛选。
            isResearchMilestoneOnly: false,
            // string 研究搜索词：匹配名称、介绍、效果、成本资源和前置科技。
            researchSearchText: "",
            // string 研究工作台视图 ID：decision 表示决策队列，catalog 表示完整研究图鉴。
            researchViewId: "decision",
            // number 研究搜索刷新计时器 ID：零表示当前没有等待刷新。
            researchSearchRenderTimerId: 0,
            // ResearchDecisionRuntime 研究决策运行态：只保存成员防抖快照，不进入存档。
            researchDecisionRuntime: {
                stableSnapshot: null,
                pendingSnapshot: null,
                pendingSinceTimestamp: 0,
                structureSignature: ""
            },
            // string 建筑状态筛选 ID：只保存当前浏览偏好，不进入存档。
            buildingFilter: "all",
            // boolean 图鉴是否仅显示已拥有建筑：true 表示 owned 大于零，不进入存档。
            isBuildingOwnedOnly: false,
            // string 建筑搜索词：匹配名称、说明、效果标签、价格资源与解锁文案，不进入存档。
            buildingSearchText: "",
            // number 建筑搜索刷新定时器 ID：合并连续输入，零表示当前没有等待刷新。
            buildingSearchRenderTimeoutId: 0,
            // BuildingId|string 当前选中建筑 ID：空字符串表示详情面板显示轻提示。
            selectedBuildingId: "",
            // boolean 窄屏检查器是否打开：true 显示底部抽屉，关闭不清空选择。
            isBuildingInspectorOpen: false,
            // BuildingId|string 最近成功建造建筑 ID：用于一次性边线脉冲和读屏播报。
            recentlyBuiltBuildingId: "",
            // BuildingId|string 原位快速检查建筑 ID：空字符串表示没有展开行。
            expandedBuildingId: "",
            // string 建筑视图 ID：overview 为默认总览，catalog 为完整目录。
            buildingViewId: "overview",
            // boolean 建筑高级筛选是否展开：true 显示低频筛选和排序控件。
            isBuildingFilterPanelOpen: false,
            // Object.<string, number> 建筑批量数量字典：key 为 BuildingId，value 为正整数购买座数。
            buildingBatchCountById: {},
            // boolean 工业生产链是否展开：仅矿业工业分区可用，不进入存档。
            isIndustryChainOpen: false,
            // string 建筑聚焦路线 ID：空字符串表示显示全部路线。
            buildingRouteId: "",
            // string 建筑排序 ID：status 表示状态优先，design 表示设计顺序，owned 表示拥有数量。
            buildingSort: "status",
            // number 建筑状态筛选横向滚动位置：单位为非负 CSS 像素值。
            buildingFilterScrollLeft: 0,
            // number 建筑路线导航横向滚动位置：单位为非负 CSS 像素值。
            buildingRouteScrollLeft: 0,
            // Object.<string, boolean> 建筑路线折叠字典：key 为 BuildingRouteId，value true 表示折叠。
            collapsedBuildingRoutesById: {},
            // BuildingId|string 待确认摧毁建筑 ID：空字符串表示没有确认条。
            confirmDestroyBuildingId: "",
            // BuildingId|string 待确认风险建筑 ID：仅劳力过载等关键持续风险需要确认。
            confirmBuildingRiskId: "",
            // BuildingId|string 待确认批量劳力风险建筑 ID：二次点击后才提交批量购买。
            confirmBuildingBatchRiskId: "",
            // Object.<string, boolean>|null 已见建筑字典：首次渲染后用于识别新揭示建筑；null 表示尚未建立基线。
            revealedBuildingIdsById: null,
            // Object.<string, boolean> 路线新揭示标记字典：key 为 BuildingRouteId，value true 表示存在新建筑。
            newBuildingRouteIdsById: {},
            // Object.<string, boolean> 建筑新内容标记字典：key 为 BuildingId，value true 表示尚未查看。
            newBuildingIdsById: {},
            // BuildingDecisionRuntime 建筑决策运行态：仅保存压力滞回和队列防抖信息，不进入存档。
            buildingDecisionRuntime: {
                pressureMemoryById: {},
                stableSnapshot: null,
                pendingSnapshot: null,
                pendingSinceTimestamp: 0,
                structureSignature: ""
            }
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
