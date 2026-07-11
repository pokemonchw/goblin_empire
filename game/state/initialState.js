/* 初始状态模块：负责创建新存档的运行时状态对象。 */
/**
 * 初始化初始状态模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 initialState 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 按资源定义创建资源状态字典。
     *
     * @param {ResourceDefinition[]} resourceDefinitions - 资源定义数组；每项包含 id、默认容量和初始可见性。
     * @returns {ResourceStateById} 资源状态字典；key 为 ResourceId，value 为 ResourceState。
     */
    function createInitialResources(resourceDefinitions) {
        // ResourceStateById 资源状态字典：按稳定资源 ID 保存运行时数量。
        var resourcesById = {};

        // number 循环索引：遍历资源定义数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceDefinitions.length; resourceIndex += 1) {
            // ResourceDefinition 当前资源定义：用于生成对应运行时状态。
            var resourceDefinition = resourceDefinitions[resourceIndex];

            resourcesById[resourceDefinition.id] = {
                id: resourceDefinition.id,
                value: 0,
                maxValue: resourceDefinition.defaultMaxValue,
                isVisible: resourceDefinition.isVisibleAtStart,
                perSecond: 0,
                grossGainThisTick: 0,
                actualGainThisTick: 0
            };
        }

        return resourcesById;
    }

    /**
     * 按建筑定义创建建筑状态字典。
     *
     * @param {BuildingDefinition[]} buildingDefinitions - 建筑定义数组；每项包含 id 和解锁信息。
     * @returns {Object.<string, BuildingState>} 建筑状态字典；key 为 BuildingId，value 为 BuildingState。
     */
    function createInitialBuildings(buildingDefinitions) {
        // Object.<string, BuildingState> 建筑状态字典：按稳定建筑 ID 保存拥有数。
        var buildingsById = {};

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < buildingDefinitions.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于生成对应运行时状态。
            var buildingDefinition = buildingDefinitions[buildingIndex];

            buildingsById[buildingDefinition.id] = {
                id: buildingDefinition.id,
                owned: 0,
                active: 0,
                isUnlocked: Boolean(buildingDefinition.unlock && buildingDefinition.unlock.isDefault)
            };
        }

        return buildingsById;
    }

    /**
     * 按科技定义创建科技状态字典。
     *
     * @param {TechnologyDefinition[]} technologyDefinitions - 科技定义数组；每项包含 id 和解锁信息。
     * @returns {Object.<string, TechnologyState>} 科技状态字典；key 为 TechnologyId，value 为 TechnologyState。
     */
    function createInitialTechnologies(technologyDefinitions) {
        // Object.<string, TechnologyState> 科技状态字典：按稳定科技 ID 保存研究进度。
        var technologiesById = {};

        // number 循环索引：遍历科技定义数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < technologyDefinitions.length; technologyIndex += 1) {
            // TechnologyDefinition 当前科技定义：用于生成对应运行时状态。
            var technologyDefinition = technologyDefinitions[technologyIndex];

            technologiesById[technologyDefinition.id] = {
                id: technologyDefinition.id,
                isUnlocked: Boolean(technologyDefinition.unlock && technologyDefinition.unlock.isDefault),
                isResearched: false
            };
        }

        return technologiesById;
    }

    /**
     * 按职业定义创建职业解锁字典。
     *
     * @param {JobDefinition[]} jobDefinitions - 职业定义数组；每项包含 id 和解锁信息。
     * @returns {Object.<string, boolean>} 职业解锁字典；key 为 JobId，value 表示是否解锁。
     */
    function createInitialJobs(jobDefinitions) {
        // Object.<string, boolean> 职业解锁字典：按稳定职业 ID 保存是否显示。
        var jobsUnlockedById = {};

        // number 循环索引：遍历职业定义数组的整数下标。
        for (var jobIndex = 0; jobIndex < jobDefinitions.length; jobIndex += 1) {
            // JobDefinition 当前职业定义：用于生成对应解锁状态。
            var jobDefinition = jobDefinitions[jobIndex];

            jobsUnlockedById[jobDefinition.id] = Boolean(jobDefinition.unlock && jobDefinition.unlock.isDefault);
        }

        return jobsUnlockedById;
    }

    /**
     * 按标签页定义创建标签页解锁字典。
     *
     * @param {TabDefinition[]} tabDefinitions - 标签页定义数组；每项包含 id 和初始可见性。
     * @returns {Object.<string, boolean>} 标签页解锁字典；key 为标签页 ID，value 表示是否显示。
     */
    function createInitialTabs(tabDefinitions) {
        // Object.<string, boolean> 标签页解锁字典：按标签页 ID 保存是否显示。
        var tabsUnlockedById = {};

        // number 循环索引：遍历标签页定义数组的整数下标。
        for (var tabIndex = 0; tabIndex < tabDefinitions.length; tabIndex += 1) {
            // TabDefinition 当前标签页定义：用于生成对应解锁状态。
            var tabDefinition = tabDefinitions[tabIndex];

            tabsUnlockedById[tabDefinition.id] = Boolean(tabDefinition.isVisibleAtStart);
        }

        return tabsUnlockedById;
    }

    /**
     * 按稳定 ID 数组创建通用解锁字典。
     *
     * @param {string[]} stableIds - 稳定 ID 数组；每项为 ASCII ID。
     * @returns {Object.<string, boolean>} 解锁字典；key 为稳定 ID，value 初始为 false。
     */
    function createLockedFlagMap(stableIds) {
        // Object.<string, boolean> 解锁字典：按稳定 ID 保存是否解锁。
        var unlockedById = {};

        // number 循环索引：遍历稳定 ID 数组的整数下标。
        for (var stableIdIndex = 0; stableIdIndex < stableIds.length; stableIdIndex += 1) {
            // string 当前稳定 ID：用于初始化对应解锁标记。
            var stableId = stableIds[stableIdIndex];

            unlockedById[stableId] = false;
        }

        return unlockedById;
    }

    /**
     * 创建新局自带的俘虏列表。
     *
     * @returns {CaptiveState[]} 开局俘虏数组；默认包含 1 个普通村姑俘虏。
     */
    function createInitialCaptives() {
        return [
            {
                id: "captive_start_laborer",
                name: "阿苔",
                type: "laborer",
                quality: "common",
                source: "开局",
                traitHint: "basic",
                turnsHeld: 0,
                disposition: undefined,
                brainwashLevel: 0,
                breedingState: "idle",
                gestationWeatherId: undefined,
                gestationSecondsRemaining: 0,
                restSecondsRemaining: 0
            }
        ];
    }

    /**
     * 创建全新的游戏状态。
     *
     * @returns {GameState} 新存档运行时状态对象。
     */
    function createInitialState() {
        // number 当前毫秒时间戳：作为新存档的模拟推进起点。
        var nowTimestamp = Date.now();

        // CalendarState 初始日期状态：新局从春第 1 日开始，未解锁历法。
        var initialCalendar = game.calendar.createInitialCalendar();

        // WeatherState 初始天气状态：新局从稳潮开始，数日后进入轮换。
        var initialWeather = game.weather.createInitialWeather();

        return {
            version: game.definitions.SAVE_VERSION,
            isPaused: false,
            lastActiveTimestamp: nowTimestamp,
            resourcesById: createInitialResources(game.definitions.RESOURCE_DEFINITIONS),
            buildingsById: createInitialBuildings(game.definitions.BUILDING_DEFINITIONS),
            technologiesById: createInitialTechnologies(game.definitions.TECHNOLOGY_DEFINITIONS),
            jobsUnlockedById: createInitialJobs(game.definitions.JOB_DEFINITIONS),
            tabsUnlockedById: createInitialTabs(game.definitions.TAB_DEFINITIONS),
            upgradesUnlockedById: {},
            craftsUnlockedById: createLockedFlagMap(game.ids.ID_REGISTRY.recipes),
            policiesUnlockedById: createLockedFlagMap(game.ids.ID_REGISTRY.policies),
            goblins: [],
            leaderGoblinId: undefined,
            policies: {},
            pacts: {},
            activeExpedition: null,
            activeDiplomacyMissions: [],
            challenges: {
                runMode: "undecided",
                activeChallengeId: null,
                completedById: {}
            },
            calendar: initialCalendar,
            weather: initialWeather,
            captives: createInitialCaptives(),
            prestige: {
                legacy: 0,
                perks: []
            },
            statistics: {},
            activeTabId: "cavern",
            logs: [
                {
                    id: "log-initial",
                    level: "important",
                    text: game.calendar.formatLogDatePrefix({ calendar: initialCalendar }) + game.calendar.formatLogSeparator({ calendar: initialCalendar }) + game.text.TEXT_REGISTRY.logs.initial,
                    timestamp: nowTimestamp
                }
            ]
        };
    }

    // Object 状态模块命名空间：提供新存档创建函数。
    game.initialState = {
        createInitialState: createInitialState
    };
})(window.GoblinEmpire);
