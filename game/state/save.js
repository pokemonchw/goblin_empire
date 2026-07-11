/* 存档模块：负责本地存储、导出导入和基础迁移入口。 */
/**
 * 初始化存档模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 save 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // string 本地存储键：保存哥布林帝国当前存档文本。
    var STORAGE_KEY = "goblinEmpireSave";

    // number v6 旧日期速度：旧存档中 10 模拟秒等于 1 个游戏日。
    var LEGACY_SECONDS_PER_DAY = 10;

    // string[] 技能 ID 列表：旧存档哥布林会按此补齐十项技能键。
    var GOBLIN_SKILL_IDS = [
        "foraging",
        "woodcutting",
        "hauling",
        "mining",
        "smelting",
        "crafting",
        "raiding",
        "scribing",
        "ritual",
        "overseeing"
    ];

    /**
     * 将运行时状态压缩为存档结构。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {SaveData} 可序列化存档对象。
     */
    function createSaveData(state) {
        // ResourceState[] 资源状态列表：从字典转为存档数组。
        var resourceStates = Object.keys(state.resourcesById).map(function (resourceId) {
            // ResourceState 当前资源状态：用于写入最小存档字段。
            var resourceState = state.resourcesById[resourceId];

            return {
                id: resourceState.id,
                value: resourceState.value,
                isVisible: resourceState.isVisible
            };
        });

        // BuildingState[] 建筑状态列表：从字典转为存档数组。
        var buildingStates = Object.keys(state.buildingsById).map(function (buildingId) {
            // BuildingState 当前建筑状态：用于写入最小存档字段。
            var buildingState = state.buildingsById[buildingId];

            return {
                id: buildingState.id,
                owned: buildingState.owned,
                active: buildingState.active,
                isUnlocked: buildingState.isUnlocked
            };
        });

        // TechnologyState[] 科技状态列表：从字典转为存档数组。
        var technologyStates = Object.keys(state.technologiesById).map(function (technologyId) {
            // TechnologyState 当前科技状态：用于写入最小存档字段。
            var technologyState = state.technologiesById[technologyId];

            return {
                id: technologyState.id,
                isUnlocked: technologyState.isUnlocked,
                isResearched: technologyState.isResearched
            };
        });

        // Object[] 职业解锁列表：从字典转为存档数组。
        var jobStates = Object.keys(state.jobsUnlockedById).map(function (jobId) {
            return {
                id: jobId,
                isUnlocked: state.jobsUnlockedById[jobId]
            };
        });

        return {
            version: state.version,
            timestamp: Date.now(),
            isPaused: state.isPaused,
            lastActiveTimestamp: state.lastActiveTimestamp,
            resources: resourceStates,
            buildings: buildingStates,
            technologies: technologyStates,
            jobs: jobStates,
            tabsUnlockedById: Object.assign({}, state.tabsUnlockedById),
            upgradesUnlockedById: Object.assign({}, state.upgradesUnlockedById),
            craftsUnlockedById: Object.assign({}, state.craftsUnlockedById),
            policiesUnlockedById: Object.assign({}, state.policiesUnlockedById),
            goblins: state.goblins.slice(),
            leaderGoblinId: state.leaderGoblinId,
            policies: Object.assign({}, state.policies),
            pacts: Object.assign({}, state.pacts),
            activeExpedition: state.activeExpedition ? Object.assign({}, state.activeExpedition) : null,
            challenges: {
                runMode: state.challenges ? state.challenges.runMode : "undecided",
                activeChallengeId: state.challenges ? state.challenges.activeChallengeId : null,
                completedById: state.challenges ? Object.assign({}, state.challenges.completedById) : {}
            },
            calendar: Object.assign({}, state.calendar || game.calendar.createInitialCalendar()),
            weather: Object.assign({}, state.weather || game.weather.createInitialWeather()),
            captives: state.captives.slice(),
            prestige: {
                legacy: state.prestige.legacy,
                perks: state.prestige.perks.slice()
            },
            statistics: Object.assign({}, state.statistics)
        };
    }

    /**
     * 保存当前游戏状态到 localStorage。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被直接修改。
     * @returns {boolean} 是否保存成功；true 表示已写入浏览器本地存储。
     */
    function saveToLocalStorage(state) {
        // SaveData 存档对象：用于序列化写入本地存储。
        var saveData = createSaveData(state);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
        return true;
    }

    /**
     * 从 localStorage 读取原始存档文本。
     *
     * @returns {string|null} 存档 JSON 文本；没有存档时返回 null。
     */
    function loadRawFromLocalStorage() {
        return localStorage.getItem(STORAGE_KEY);
    }

    /**
     * 清除浏览器中的本地存档。
     *
     * @returns {boolean} 是否清除成功；true 表示本地存档键已删除。
     */
    function clearLocalStorageSave() {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    }

    /**
     * 将旧存档迁移到当前版本。
     *
     * @param {SaveData} saveData - 已解析的存档对象，会按版本迁移。
     * @returns {SaveData} 当前版本存档对象。
     */
    function migrateSaveData(saveData) {
        // SaveData 迁移后存档：按版本逐步补齐新字段。
        var migratedSaveData = saveData;

        // number 来源版本：旧存档可能没有 version，按 v1 处理。
        var sourceVersion = Number(migratedSaveData.version) || 1;

        if (!migratedSaveData.version) {
            migratedSaveData.version = 1;
        }

        if (sourceVersion < 2) {
            // v1 旧 shape：没有 pacts、activeExpedition、challenges 等后期系统字段。
            // v2 新 shape：补齐后期系统字段，确保旧存档加载后拥有完整状态容器。
            // 迁移原因：5.x 阶段加入深渊契约、远征、威望和挑战系统，需要稳定存档入口。
            migratedSaveData.pacts = migratedSaveData.pacts || {};
            migratedSaveData.activeExpedition = migratedSaveData.activeExpedition || null;
            migratedSaveData.challenges = migratedSaveData.challenges || {
                runMode: "undecided",
                activeChallengeId: null,
                completedById: {}
            };
            migratedSaveData.prestige = migratedSaveData.prestige || {
                legacy: 0,
                perks: []
            };
        }

        if (sourceVersion < 3) {
            // v2 旧 shape：挑战状态只有 activeChallengeId，无法表示玩家已明确选择正常模式。
            // v3 新 shape：补充 runMode，避免全新存档只有挑战入口而缺少正常模式入口。
            migratedSaveData.challenges = migratedSaveData.challenges || {
                activeChallengeId: null,
                completedById: {}
            };
            migratedSaveData.challenges.runMode = inferRunModeFromLegacySave(migratedSaveData);
        }

        if (sourceVersion < 4) {
            // v3 旧 shape：没有日期系统，日志也没有季节或历法前缀。
            // v4 新 shape：补齐 calendar，用于春夏秋冬循环和历法解锁纪元。
            // 迁移原因：历法研究需要持久化解锁日，避免读档后哥布林历年份重置。
            migratedSaveData.calendar = game.calendar.createInitialCalendar();
        }

        if (sourceVersion < 5) {
            // v4 旧 shape：人口会通过 populationGrowthProgress 自然增长，空白新局没有开局俘虏。
            // v5 新 shape：人口只能通过俘虏苗床等显式入口新增，空白新局补 1 个普通村姑俘虏。
            // 迁移原因：开局繁育入口改为俘虏处置，旧自然增长进度不再是有效状态。
            if (migratedSaveData.statistics) {
                delete migratedSaveData.statistics.populationGrowthProgress;
            }

            if (!hasLegacySaveProgress(migratedSaveData) && (!Array.isArray(migratedSaveData.captives) || migratedSaveData.captives.length <= 0)) {
                migratedSaveData.captives = [
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
        }

        if (sourceVersion < 6) {
            // v5 旧 shape：俘虏苗床是即时一次性繁衍，俘虏没有洗脑程度、孕育和休养倒计时。
            // v6 新 shape：俘虏可重复“培育新生”，并保存洗脑程度、孕育状态和休养状态。
            // 迁移原因：俘虏卡牌从即时苗床改为按月孕育和按月休养的重复人口入口。
            migratedSaveData.captives = normalizeSavedCaptives(Array.isArray(migratedSaveData.captives) ? migratedSaveData.captives : []);
        }

        if (sourceVersion < 7) {
            // v6 旧 shape：日期和苗床倒计时按 10 秒 1 天保存。
            // v7 新 shape：现实 1 秒推进 1 个游戏日，按游戏天数等价缩短秒数字段。
            // 迁移原因：保持旧存档的日内进度和苗床月份语义不变。
            migrateCalendarAndCaptiveSecondsForOneSecondDays(migratedSaveData);
        }

        if (sourceVersion < 8) {
            // v7 旧 shape：俘虏只有类型和质量，没有单独姓名，列表中同类俘虏难以区分。
            // v8 新 shape：为每个俘虏补齐 name，并在后续新增俘虏时持久化姓名。
            // 迁移原因：俘虏列表改为逐个管理的卡片行，姓名成为玩家识别单个俘虏的必要状态。
            migratedSaveData.captives = normalizeSavedCaptives(Array.isArray(migratedSaveData.captives) ? migratedSaveData.captives : []);
        }

        if (sourceVersion < 9) {
            // v8 旧 shape：没有劳力名册、绞盘系统、监工操典及对应建筑的静态 ID。
            // v9 新 shape：新增劳力科技和建筑；运行时恢复会从当前定义补齐缺失状态。
            // 迁移原因：静态定义扩展不需要改写存档数组，但需要版本号标记新平衡口径。
        }

        if (sourceVersion < 10) {
            // v9 旧 shape：没有天气状态，生产只受季节日期和事件影响。
            // v10 新 shape：补齐 weather，用于保存当前天气、开始日和下次变化日。
            // 迁移原因：天气会影响持续生产倍率，需要读档后保持同一段天气。
            migratedSaveData.weather = game.weather.createInitialWeather();
        }

        if (sourceVersion < 11) {
            // v10 旧 shape：没有潮痕观测、通风支护和天气调控建筑的静态 ID。
            // v11 新 shape：运行时从当前定义补齐新增科技和建筑状态。
            // 迁移原因：天气从纯环境压力扩展为可被建筑缓冲和利用的生产系统。
        }

        if (sourceVersion < 12) {
            // v11 旧 shape：天气状态没有存档级随机种子，不同新局会按同一日期序列变化。
            // v12 新 shape：weather.randomSeed 保存每局天气随机源，读档继续复用。
            // 迁移原因：天气持续 30-90 天后，需要不同新局有不同天气序列，同时保持读档稳定。
            migratedSaveData.weather = game.weather.normalizeWeatherState(migratedSaveData.weather, migratedSaveData.calendar);
        }

        migratedSaveData.version = game.definitions.SAVE_VERSION;
        return migratedSaveData;
    }

    /**
     * 将旧日期速度下保存的秒数字段迁移到 1 秒 1 天口径。
     *
     * @param {SaveData} saveData - v6 或更早存档对象，会直接修改 calendar 和 captives 字段。
     * @returns {void} 无返回值。
     */
    function migrateCalendarAndCaptiveSecondsForOneSecondDays(saveData) {
        // number 缩放比例：旧 10 秒/天改为新 1 秒/天，所以剩余秒数除以 10。
        var secondsScaleRatio = game.calendar.getSecondsPerDay() / LEGACY_SECONDS_PER_DAY;

        if (saveData.calendar) {
            // number 旧日内进度秒数：旧存档中当前游戏日已推进的模拟秒。
            var legacyDayProgressSeconds = Math.max(0, Number(saveData.calendar.dayProgressSeconds) || 0);

            saveData.calendar.dayProgressSeconds = legacyDayProgressSeconds * secondsScaleRatio;
        }

        if (!Array.isArray(saveData.captives)) {
            return;
        }

        // number 循环索引：遍历存档俘虏数组的整数下标。
        for (var captiveIndex = 0; captiveIndex < saveData.captives.length; captiveIndex += 1) {
            // CaptiveState 当前俘虏对象：用于迁移苗床倒计时秒数。
            var captive = saveData.captives[captiveIndex];

            if (!captive) {
                continue;
            }

            // number 旧孕育剩余秒数：v6 以 10 秒/天保存。
            var legacyGestationSeconds = Math.max(0, Number(captive.gestationSecondsRemaining) || 0);

            // number 旧休养剩余秒数：v6 以 10 秒/天保存。
            var legacyRestSeconds = Math.max(0, Number(captive.restSecondsRemaining) || 0);

            captive.gestationSecondsRemaining = legacyGestationSeconds * secondsScaleRatio;
            captive.restSecondsRemaining = legacyRestSeconds * secondsScaleRatio;
        }
    }

    /**
     * 将存档结构合并到新建运行时状态。
     *
     * @param {SaveData} saveData - 当前版本存档对象。
     * @returns {GameState} 恢复后的运行时状态对象。
     */
    function restoreGameState(saveData) {
        validateSaveData(saveData);

        // GameState 恢复目标状态：先从静态定义创建完整默认结构。
        var restoredState = game.initialState.createInitialState();

        restoredState.version = saveData.version;
        restoredState.isPaused = Boolean(saveData.isPaused);
        restoredState.lastActiveTimestamp = Number(saveData.lastActiveTimestamp) || Date.now();
        restoredState.goblins = normalizeSavedGoblins(Array.isArray(saveData.goblins) ? saveData.goblins : []);
        restoredState.leaderGoblinId = saveData.leaderGoblinId;
        restoredState.policies = saveData.policies || {};
        restoredState.pacts = saveData.pacts || {};
        restoredState.activeExpedition = saveData.activeExpedition || null;
        restoredState.challenges = normalizeSavedChallenges(saveData.challenges);
        restoredState.calendar = game.calendar.normalizeCalendarState(saveData.calendar);
        restoredState.weather = game.weather.normalizeWeatherState(saveData.weather, restoredState.calendar);
        restoredState.captives = normalizeSavedCaptives(Array.isArray(saveData.captives) ? saveData.captives : []);
        restoredState.prestige = saveData.prestige || { legacy: 0, perks: [] };
        restoredState.statistics = saveData.statistics || {};
        // Object[] 日志数组：日志不进入存档，读档后清空新建状态的默认日志，避免显示错误日期。
        restoredState.logs = [];
        restoredState.tabsUnlockedById = saveData.tabsUnlockedById || restoredState.tabsUnlockedById;
        restoredState.upgradesUnlockedById = saveData.upgradesUnlockedById || restoredState.upgradesUnlockedById;
        restoredState.craftsUnlockedById = saveData.craftsUnlockedById || restoredState.craftsUnlockedById;
        restoredState.policiesUnlockedById = saveData.policiesUnlockedById || restoredState.policiesUnlockedById;

        // Object[] 资源存档列表：用于恢复资源数量和可见性。
        var savedResources = Array.isArray(saveData.resources) ? saveData.resources : [];

        // number 循环索引：遍历资源存档数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < savedResources.length; resourceIndex += 1) {
            // Object 当前资源存档：包含 id、value 和 isVisible。
            var savedResource = savedResources[resourceIndex];

            if (restoredState.resourcesById[savedResource.id]) {
                restoredState.resourcesById[savedResource.id].value = Number(savedResource.value) || 0;
                restoredState.resourcesById[savedResource.id].isVisible = Boolean(savedResource.isVisible);
            }
        }

        // Object[] 建筑存档列表：用于恢复拥有数和解锁状态。
        var savedBuildings = Array.isArray(saveData.buildings) ? saveData.buildings : [];

        // number 循环索引：遍历建筑存档数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < savedBuildings.length; buildingIndex += 1) {
            // Object 当前建筑存档：包含 id、owned、active 和 isUnlocked。
            var savedBuilding = savedBuildings[buildingIndex];

            if (restoredState.buildingsById[savedBuilding.id]) {
                restoredState.buildingsById[savedBuilding.id].owned = Number(savedBuilding.owned) || 0;
                restoredState.buildingsById[savedBuilding.id].active = Number(savedBuilding.active) || 0;
                restoredState.buildingsById[savedBuilding.id].isUnlocked = Boolean(savedBuilding.isUnlocked);
            }
        }

        // Object[] 科技存档列表：用于恢复研究和解锁状态。
        var savedTechnologies = Array.isArray(saveData.technologies) ? saveData.technologies : [];

        // number 循环索引：遍历科技存档数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < savedTechnologies.length; technologyIndex += 1) {
            // Object 当前科技存档：包含 id、isUnlocked 和 isResearched。
            var savedTechnology = savedTechnologies[technologyIndex];

            if (restoredState.technologiesById[savedTechnology.id]) {
                restoredState.technologiesById[savedTechnology.id].isUnlocked = Boolean(savedTechnology.isUnlocked);
                restoredState.technologiesById[savedTechnology.id].isResearched = Boolean(savedTechnology.isResearched);
            }
        }

        // Object[] 职业存档列表：用于恢复职业解锁状态。
        var savedJobs = Array.isArray(saveData.jobs) ? saveData.jobs : [];

        // number 循环索引：遍历职业存档数组的整数下标。
        for (var jobIndex = 0; jobIndex < savedJobs.length; jobIndex += 1) {
            // Object 当前职业存档：包含 id 和 isUnlocked。
            var savedJob = savedJobs[jobIndex];

            restoredState.jobsUnlockedById[savedJob.id] = Boolean(savedJob.isUnlocked);
        }

        correctDerivedSaveState(restoredState);

        if (game.buildings && game.buildings.applyAllBuildingEffects) {
            game.buildings.applyAllBuildingEffects(restoredState);
        }

        if (game.crafting && game.crafting.applyCraftedUpgradeEffects) {
            game.crafting.applyCraftedUpgradeEffects(restoredState);
        }

        if (game.prestigeSystem) {
            game.prestigeSystem.syncLegacyResource(restoredState);
            game.prestigeSystem.applyPermanentPerks(restoredState);
        }

        if (game.challengesSystem) {
            game.challengesSystem.applyChallengeStateEffects(restoredState);
        }

        return restoredState;
    }

    /**
     * 校验存档中的静态定义 ID。
     *
     * @param {SaveData} saveData - 当前版本存档对象，不会被修改。
     * @returns {void} 无返回值。
     * @throws {Error} 存档引用未知静态 ID 时抛出错误。
     */
    function validateSaveData(saveData) {
        validateSavedIds(saveData.resources, game.ids.ID_REGISTRY.resources, "资源");
        validateSavedIds(saveData.buildings, game.ids.ID_REGISTRY.buildings, "建筑");
        validateSavedIds(saveData.technologies, game.ids.ID_REGISTRY.technologies, "科技");
        validateSavedIds(saveData.jobs, game.ids.ID_REGISTRY.jobs, "职业");
        validateDictionaryValues(saveData.policies, game.ids.ID_REGISTRY.policies, "政策");
        validateDictionaryKeys(saveData.pacts, getDefinitionIds(game.definitions.PACT_DEFINITIONS), "契约");

        if (saveData.challenges) {
            validateRunMode(saveData.challenges.runMode);
            validateNullableId(saveData.challenges.activeChallengeId, game.ids.ID_REGISTRY.challenges, "活动挑战");
            validateDictionaryKeys(saveData.challenges.completedById, game.ids.ID_REGISTRY.challenges, "完成挑战");
        }

        if (saveData.weather) {
            validateNullableId(saveData.weather.currentWeatherId, game.ids.ID_REGISTRY.weather, "天气");
        }

        if (saveData.prestige && Array.isArray(saveData.prestige.perks)) {
            // number 循环索引：遍历威望天赋 ID 数组的整数下标。
            for (var perkIndex = 0; perkIndex < saveData.prestige.perks.length; perkIndex += 1) {
                // string 天赋 ID：用于校验静态定义。
                var perkId = saveData.prestige.perks[perkIndex];

                validateNullableId(perkId, game.ids.ID_REGISTRY.prestigePerks, "威望天赋");
            }
        }
    }

    /**
     * 从旧存档进度推断本局模式。
     *
     * @param {SaveData} saveData - v1/v2 存档对象，可能缺少 challenges.runMode。
     * @returns {"undecided"|"normal"|"challenge"} 推断出的本局模式。
     */
    function inferRunModeFromLegacySave(saveData) {
        if (saveData.challenges && saveData.challenges.activeChallengeId) {
            return "challenge";
        }

        if (hasLegacySaveProgress(saveData)) {
            return "normal";
        }

        return "undecided";
    }

    /**
     * 判断旧存档是否已有普通局实质进度。
     *
     * @param {SaveData} saveData - v1/v2 存档对象，用于检查资源、建筑、科技和人口。
     * @returns {boolean} 是否已有实质进度；true 表示应视为正常模式存档。
     */
    function hasLegacySaveProgress(saveData) {
        // string[] 可忽略资源 ID：威望资源可在迁徙后新局保留，不代表本局已开始普通流程。
        var ignoredResourceIds = ["prestige", "imperialLegacy", "ancestralEcho"];

        // Object[] 资源存档列表：用于检查旧存档普通资源数量。
        var savedResources = Array.isArray(saveData.resources) ? saveData.resources : [];

        // number 资源循环索引：遍历资源存档数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < savedResources.length; resourceIndex += 1) {
            // Object 当前资源存档：包含 id 和 value，用于识别已有采集或生产进度。
            var savedResource = savedResources[resourceIndex];

            if (ignoredResourceIds.indexOf(savedResource.id) === -1 && Number(savedResource.value) > 0) {
                return true;
            }
        }

        // Object[] 建筑存档列表：用于检查旧存档建筑拥有数。
        var savedBuildings = Array.isArray(saveData.buildings) ? saveData.buildings : [];

        // number 建筑循环索引：遍历建筑存档数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < savedBuildings.length; buildingIndex += 1) {
            // Object 当前建筑存档：包含 owned，用于识别已建造进度。
            var savedBuilding = savedBuildings[buildingIndex];

            if (Number(savedBuilding.owned) > 0) {
                return true;
            }
        }

        // Object[] 科技存档列表：用于检查旧存档研究完成状态。
        var savedTechnologies = Array.isArray(saveData.technologies) ? saveData.technologies : [];

        // number 科技循环索引：遍历科技存档数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < savedTechnologies.length; technologyIndex += 1) {
            // Object 当前科技存档：包含 isResearched，用于识别研究进度。
            var savedTechnology = savedTechnologies[technologyIndex];

            if (savedTechnology.isResearched) {
                return true;
            }
        }

        return Array.isArray(saveData.goblins) && saveData.goblins.length > 0;
    }

    /**
     * 规范化挑战存档状态。
     *
     * @param {Object|null|undefined} savedChallenges - 挑战存档对象，可能来自旧版本。
     * @returns {{runMode: "undecided"|"normal"|"challenge", activeChallengeId: string|null, completedById: Object.<string, boolean>}} 规范化后的挑战状态。
     */
    function normalizeSavedChallenges(savedChallenges) {
        // Object 挑战状态：补齐模式、活动挑战和永久完成标记。
        var normalizedChallenges = savedChallenges || {};

        // string 模式 ID：存档缺失时按活动挑战推断。
        var runMode = normalizedChallenges.runMode || (normalizedChallenges.activeChallengeId ? "challenge" : "undecided");

        return {
            runMode: runMode,
            activeChallengeId: normalizedChallenges.activeChallengeId || null,
            completedById: normalizedChallenges.completedById || {}
        };
    }

    /**
     * 校验本局模式字段。
     *
     * @param {string} runMode - 本局模式 ID，允许 undecided、normal 或 challenge。
     * @returns {void} 无返回值。
     * @throws {Error} 模式 ID 不合法时抛出错误。
     */
    function validateRunMode(runMode) {
        if (runMode !== "undecided" && runMode !== "normal" && runMode !== "challenge") {
            throw new Error("未知本局模式：" + runMode);
        }
    }

    /**
     * 校验存档数组中的 ID。
     *
     * @param {Object[]} savedEntries - 存档条目数组；每项应包含 id。
     * @param {string[]} allowedIds - 允许的稳定 ID 数组。
     * @param {string} labelText - 错误提示中的中文标签。
     * @returns {void} 无返回值。
     * @throws {Error} 发现未知 ID 时抛出错误。
     */
    function validateSavedIds(savedEntries, allowedIds, labelText) {
        if (!Array.isArray(savedEntries)) {
            return;
        }

        // number 循环索引：遍历存档条目数组的整数下标。
        for (var entryIndex = 0; entryIndex < savedEntries.length; entryIndex += 1) {
            // Object 当前存档条目：用于读取 id。
            var savedEntry = savedEntries[entryIndex];

            validateNullableId(savedEntry.id, allowedIds, labelText);
        }
    }

    /**
     * 校验字典键是否属于允许 ID。
     *
     * @param {Object.<string, *>} dictionary - 待校验字典；key 为稳定 ID。
     * @param {string[]} allowedIds - 允许的稳定 ID 数组。
     * @param {string} labelText - 错误提示中的中文标签。
     * @returns {void} 无返回值。
     * @throws {Error} 发现未知 ID 时抛出错误。
     */
    function validateDictionaryKeys(dictionary, allowedIds, labelText) {
        if (!dictionary || typeof dictionary !== "object") {
            return;
        }

        // string[] 字典键数组：用于逐项校验。
        var dictionaryKeys = Object.keys(dictionary);

        // number 循环索引：遍历字典键数组的整数下标。
        for (var keyIndex = 0; keyIndex < dictionaryKeys.length; keyIndex += 1) {
            // string 当前字典键：用于校验稳定 ID。
            var dictionaryKey = dictionaryKeys[keyIndex];

            validateNullableId(dictionaryKey, allowedIds, labelText);
        }
    }

    /**
     * 校验字典值是否属于允许 ID。
     *
     * @param {Object.<string, string>} dictionary - 待校验字典；value 为稳定 ID。
     * @param {string[]} allowedIds - 允许的稳定 ID 数组。
     * @param {string} labelText - 错误提示中的中文标签。
     * @returns {void} 无返回值。
     * @throws {Error} 发现未知 ID 时抛出错误。
     */
    function validateDictionaryValues(dictionary, allowedIds, labelText) {
        if (!dictionary || typeof dictionary !== "object") {
            return;
        }

        // string[] 字典键数组：用于读取每个值。
        var dictionaryKeys = Object.keys(dictionary);

        // number 循环索引：遍历字典键数组的整数下标。
        for (var keyIndex = 0; keyIndex < dictionaryKeys.length; keyIndex += 1) {
            // string 当前字典键：用于读取字典值。
            var dictionaryKey = dictionaryKeys[keyIndex];

            validateNullableId(dictionary[dictionaryKey], allowedIds, labelText);
        }
    }

    /**
     * 校验可空 ID。
     *
     * @param {string|null|undefined} candidateId - 待校验 ID。
     * @param {string[]} allowedIds - 允许的稳定 ID 数组。
     * @param {string} labelText - 错误提示中的中文标签。
     * @returns {void} 无返回值。
     * @throws {Error} 发现未知 ID 时抛出错误。
     */
    function validateNullableId(candidateId, allowedIds, labelText) {
        if (!candidateId) {
            return;
        }

        if (allowedIds.indexOf(candidateId) === -1) {
            throw new Error(labelText + " ID 未知：" + candidateId);
        }
    }

    /**
     * 从定义数组提取 ID。
     *
     * @param {Object[]} definitions - 静态定义数组；每项应包含 id。
     * @returns {string[]} ID 数组。
     */
    function getDefinitionIds(definitions) {
        // string[] ID 数组：用于校验定义引用。
        var definitionIds = [];

        // number 循环索引：遍历定义数组的整数下标。
        for (var definitionIndex = 0; definitionIndex < definitions.length; definitionIndex += 1) {
            // Object 当前定义：用于读取 id。
            var definition = definitions[definitionIndex];

            definitionIds.push(definition.id);
        }

        return definitionIds;
    }

    /**
     * 规范化存档中的哥布林对象。
     *
     * @param {Goblin[]} savedGoblins - 存档哥布林数组。
     * @returns {Goblin[]} 规范化后的哥布林数组。
     */
    function normalizeSavedGoblins(savedGoblins) {
        // Goblin[] 规范化数组：过滤掉没有稳定 ID 的无效对象。
        var normalizedGoblins = [];

        // number 循环索引：遍历存档哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < savedGoblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于补齐可派生字段。
            var goblin = savedGoblins[goblinIndex];

            if (!goblin || !goblin.id) {
                continue;
            }

            goblin.traits = Array.isArray(goblin.traits) ? goblin.traits : [];
            goblin.wounds = Array.isArray(goblin.wounds) ? goblin.wounds : [];
            goblin.skills = goblin.skills || {};
            normalizeGoblinSkills(goblin);
            goblin.attributes = goblin.attributes || {};
            goblin.isAlive = goblin.isAlive !== false;
            normalizedGoblins.push(goblin);
        }

        return normalizedGoblins;
    }

    /**
     * 规范化存档中的俘虏对象。
     *
     * @param {CaptiveState[]} savedCaptives - 存档俘虏数组。
     * @returns {CaptiveState[]} 规范化后的俘虏数组。
     */
    function normalizeSavedCaptives(savedCaptives) {
        // CaptiveState[] 规范化数组：过滤没有稳定 ID 的无效俘虏。
        var normalizedCaptives = [];

        // number 循环索引：遍历存档俘虏数组的整数下标。
        for (var captiveIndex = 0; captiveIndex < savedCaptives.length; captiveIndex += 1) {
            // CaptiveState 当前俘虏对象：用于补齐苗床繁育状态字段。
            var captive = savedCaptives[captiveIndex];

            if (!captive || !captive.id) {
                continue;
            }

            captive.turnsHeld = Math.max(0, Number(captive.turnsHeld) || 0);
            captive.name = normalizeCaptiveName(captive, captiveIndex);
            captive.brainwashLevel = Math.min(100, Math.max(0, Number(captive.brainwashLevel) || 0));
            captive.breedingState = normalizeCaptiveBreedingState(captive.breedingState);
            captive.gestationWeatherId = normalizeCaptiveGestationWeatherId(captive.gestationWeatherId, captive.breedingState);
            captive.gestationSecondsRemaining = Math.max(0, Number(captive.gestationSecondsRemaining) || 0);
            captive.restSecondsRemaining = Math.max(0, Number(captive.restSecondsRemaining) || 0);

            if (captive.breedingState === "gestating" && captive.gestationSecondsRemaining <= 0) {
                captive.gestationSecondsRemaining = 1;
            }

            if (captive.breedingState === "resting" && captive.restSecondsRemaining <= 0) {
                captive.restSecondsRemaining = 1;
            }

            normalizedCaptives.push(captive);
        }

        return normalizedCaptives;
    }

    /**
     * 规范化俘虏姓名。
     *
     * @param {CaptiveState} captive - 俘虏对象，用于读取旧存档中的类型和稳定 ID。
     * @param {number} captiveIndex - 俘虏数组下标，非负整数；用于旧存档确定性补名。
     * @returns {string} 俘虏中文姓名。
     */
    function normalizeCaptiveName(captive, captiveIndex) {
        if (typeof captive.name === "string" && captive.name.trim()) {
            return captive.name.trim();
        }

        // string[] 旧存档补名池：按稳定 ID 和数组下标确定，避免同一存档每次读档改名。
        var fallbackNames = [
            "阿苔",
            "莉莎",
            "玛拉",
            "薇恩",
            "艾娜",
            "塔妮",
            "露芙",
            "贝芮",
            "伊柯",
            "诺拉",
            "茜尔",
            "朵琳"
        ];

        // number 稳定散列值：由俘虏 ID 和类型字符码累加得到，非负整数。
        var stableHash = captiveIndex;

        // string 散列文本：俘虏稳定 ID 和类型 ID，旧存档一定存在 id，type 缺失时按空串。
        var hashText = String(captive.id) + String(captive.type || "");

        // number 循环索引：遍历散列文本字符的整数下标。
        for (var characterIndex = 0; characterIndex < hashText.length; characterIndex += 1) {
            stableHash += hashText.charCodeAt(characterIndex);
        }

        return fallbackNames[stableHash % fallbackNames.length];
    }

    /**
     * 规范化俘虏繁育状态 ID。
     *
     * @param {string|undefined} breedingState - 存档中的繁育状态 ID，可省略。
     * @returns {"idle"|"gestating"|"resting"} 规范化后的状态 ID。
     */
    function normalizeCaptiveBreedingState(breedingState) {
        if (breedingState === "gestating" || breedingState === "resting") {
            return breedingState;
        }

        return "idle";
    }

    /**
     * 规范化俘虏孕育天气 ID。
     *
     * @param {string|undefined} gestationWeatherId - 存档中的孕育开始天气 ID，可省略。
     * @param {"idle"|"gestating"|"resting"} breedingState - 俘虏繁育状态。
     * @returns {string|undefined} 有效天气 ID；非孕育中或未知 ID 时返回 undefined。
     */
    function normalizeCaptiveGestationWeatherId(gestationWeatherId, breedingState) {
        if (breedingState !== "gestating") {
            return undefined;
        }

        if (game.ids.ID_REGISTRY.weather.indexOf(gestationWeatherId) === -1) {
            return undefined;
        }

        return gestationWeatherId;
    }

    /**
     * 补齐哥布林技能字典。
     *
     * @param {Goblin} goblin - 哥布林对象，会补入缺失技能键。
     * @returns {void} 无返回值。
     */
    function normalizeGoblinSkills(goblin) {
        // number 循环索引：遍历技能 ID 数组的整数下标。
        for (var skillIndex = 0; skillIndex < GOBLIN_SKILL_IDS.length; skillIndex += 1) {
            // string 当前技能 ID：用于检查并补默认经验。
            var skillId = GOBLIN_SKILL_IDS[skillIndex];

            if (typeof goblin.skills[skillId] !== "number") {
                goblin.skills[skillId] = 0;
            }
        }
    }

    /**
     * 校正由哥布林对象派生的运行时字段。
     *
     * @param {GameState} state - 恢复后的游戏状态对象，会校正职业和领袖引用。
     * @returns {void} 无返回值。
     */
    function correctDerivedSaveState(state) {
        // boolean 领袖是否有效：用于清除失效 leaderGoblinId。
        var isLeaderValid = false;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于校正职业和领袖。
            var goblin = state.goblins[goblinIndex];

            if (goblin.jobId && game.ids.ID_REGISTRY.jobs.indexOf(goblin.jobId) === -1) {
                goblin.jobId = undefined;
            }

            if (goblin.jobId && !state.jobsUnlockedById[goblin.jobId]) {
                goblin.jobId = undefined;
            }

            if (goblin.id === state.leaderGoblinId && goblin.isAlive) {
                isLeaderValid = true;
            }
        }

        if (game.jobs && game.jobs.promoteHaulersToMiners) {
            game.jobs.promoteHaulersToMiners(state);
        }

        if (!isLeaderValid) {
            state.leaderGoblinId = undefined;
        }
    }

    /**
     * 从 JSON 文本载入游戏状态。
     *
     * @param {string} rawSaveText - 存档 JSON 文本。
     * @returns {GameState} 恢复后的游戏状态对象。
     * @throws {Error} 存档文本不是合法 JSON 或缺少必要字段时抛出错误。
     */
    function loadFromText(rawSaveText) {
        // SaveData 原始存档对象：由 JSON 文本解析得到。
        var parsedSaveData = JSON.parse(rawSaveText);

        if (!parsedSaveData || typeof parsedSaveData !== "object") {
            throw new Error("存档格式无效。");
        }

        return restoreGameState(migrateSaveData(parsedSaveData));
    }

    /**
     * 预览导入存档的版本和时间戳。
     *
     * @param {string} rawSaveText - 存档 JSON 文本。
     * @returns {{version: number, timestamp: number, goblinCount: number}} 存档预览信息。
     * @throws {Error} 存档文本不是合法 JSON 时抛出错误。
     */
    function previewSaveText(rawSaveText) {
        // SaveData 原始存档对象：由 JSON 文本解析得到。
        var parsedSaveData = JSON.parse(rawSaveText);

        if (!parsedSaveData || typeof parsedSaveData !== "object") {
            throw new Error("存档格式无效。");
        }

        return {
            version: Number(parsedSaveData.version) || 1,
            timestamp: Number(parsedSaveData.timestamp) || 0,
            goblinCount: Array.isArray(parsedSaveData.goblins) ? parsedSaveData.goblins.length : 0
        };
    }

    /**
     * 导出当前游戏状态为文本。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 存档 JSON 文本。
     */
    function exportToText(state) {
        return JSON.stringify(createSaveData(state));
    }

    // Object 存档模块命名空间：提供本地保存和导入导出函数。
    game.save = {
        saveToLocalStorage: saveToLocalStorage,
        loadRawFromLocalStorage: loadRawFromLocalStorage,
        clearLocalStorageSave: clearLocalStorageSave,
        loadFromText: loadFromText,
        previewSaveText: previewSaveText,
        exportToText: exportToText
    };
})(window.GoblinEmpire);
