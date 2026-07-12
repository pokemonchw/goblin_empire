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

        // DiplomacyMissionState[] 在途外交行动列表：按字段复制，避免存档对象共享运行时嵌套引用。
        var diplomacyMissionStates = Array.isArray(state.activeDiplomacyMissions) ? state.activeDiplomacyMissions.map(copyDiplomacyMissionStateForSave) : [];

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
            activeDiplomacyMissions: diplomacyMissionStates,
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
     * 复制在途外交行动为可序列化存档项。
     *
     * @param {DiplomacyMissionState} mission - 在途外交行动状态，不会被修改。
     * @returns {DiplomacyMissionState} 可写入存档的在途外交行动副本。
     */
    function copyDiplomacyMissionStateForSave(mission) {
        return {
            id: mission.id,
            modeId: mission.modeId,
            locationId: mission.locationId,
            factionId: mission.factionId,
            raiderIds: Array.isArray(mission.raiderIds) ? mission.raiderIds.slice() : [],
            remainingSeconds: mission.remainingSeconds,
            totalSeconds: mission.totalSeconds,
            resultSnapshot: mission.resultSnapshot ? Object.assign({}, mission.resultSnapshot) : {}
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
                        raceId: "mire_human",
                        quality: "common",
                        source: "开局",
                        traitHint: "basic",
                        turnsHeld: 0,
                        disposition: undefined,
                        brainwashLevel: 0,
                        isAutoBrainwashEnabled: false,
                        isAutoBreedEnabled: false,
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

        if (sourceVersion < 13) {
            // v12 旧 shape：弓弩同时承担早期抢掠兵和掠夺入口解锁，且没有大木棒科技状态。
            // v13 新 shape：新增大木棒作为早期抢掠研究，弓弩退后为铁片阶段军工扩展。
            // 迁移原因：避免旧存档已研究朽木栽培或弓弩后缺少新的抢掠兵研究入口。
            migrateCrossbowRaidUnlocksToBigClub(migratedSaveData);
        }

        if (sourceVersion < 14) {
            // v13 旧 shape：存在 militaryPower 资源、raidEquipmentRatio 统计和 raidPowerRatio 效果命名。
            // v14 新 shape：掠夺由玩家输入战斗职业人数并按队伍强度结算，不再保存军力资源。
            // 迁移原因：移除军力设定，同时保留无法由战旗库存重建的旧装备强度收益。
            migrateMilitaryPowerRaidModelToRaidStrength(migratedSaveData);
        }

        if (sourceVersion < 15) {
            // v14 旧 shape：没有恶名和善名资源，贸易与掠夺只受成本、队伍和关系影响。
            // v15 新 shape：新增 infamy/goodwill 资源，由当前静态资源定义在恢复时补齐默认运行时状态。
            // 迁移原因：让高级掠夺地点和高级贸易势力分别由恶名、善名门槛推进。
        }

        if (sourceVersion < 16) {
            // v15 旧 shape：贸易和掠夺都是即时结算，没有返程中的外交行动列表。
            // v16 新 shape：activeDiplomacyMissions 保存贸易队和掠夺队的剩余返程时间。
            // 迁移原因：地点距离开始影响结算时间，旧存档默认没有在途行动。
            migratedSaveData.activeDiplomacyMissions = [];
        }

        if (sourceVersion < 17) {
            // v16 旧 shape：俘虏没有单体自动洗脑开关。
            // v17 新 shape：isAutoBrainwashEnabled 保存指定俘虏是否自动消耗菌菇洗脑。
            // 迁移原因：欲望启蒙科技需要让每张俘虏卡独立保存自动洗脑状态。
            migratedSaveData.captives = normalizeSavedCaptives(Array.isArray(migratedSaveData.captives) ? migratedSaveData.captives : []);
        }

        if (sourceVersion < 18) {
            // v17 旧 shape：俘虏没有单体自动培育开关，也没有公用苗床科技状态。
            // v18 新 shape：isAutoBreedEnabled 保存指定俘虏是否加入公用苗床自动培育队列。
            // 迁移原因：公用苗床科技需要在每张俘虏卡独立保存自动培育状态。
            migratedSaveData.captives = normalizeSavedCaptives(Array.isArray(migratedSaveData.captives) ? migratedSaveData.captives : []);
        }

        if (sourceVersion < 20) {
            // v19 旧 shape：哥布林和俘虏寿命字段以 Months 命名，年龄也按生存月累计。
            // v20 新 shape：寿命字段以 Years 命名，年龄按年保存；俘虏缺失有效年龄时按类型补基础年龄。
            // 迁移原因：寿命设计单位改为年，避免个体在数个游戏年内过早老死。
            migrateLifespanMonthsToYears(migratedSaveData);
        }

        if (sourceVersion < 21) {
            // v20 旧 shape：俘虏只有职业类型和质量，没有独立种族来源。
            // v21 新 shape：raceId 保存非哥布林俘虏种族，掠夺地点按种族权重生成俘虏。
            // 迁移原因：种族系统需要让同职业同质量俘虏拥有不同属性、技能和寿命。
            migratedSaveData.captives = normalizeSavedCaptives(Array.isArray(migratedSaveData.captives) ? migratedSaveData.captives : []);
        }

        migratedSaveData.version = game.definitions.SAVE_VERSION;
        return migratedSaveData;
    }

    /**
     * 将旧月制寿命字段迁移为年制寿命字段。
     *
     * @param {SaveData} saveData - v19 或更早存档对象，会改写 goblins 和 captives 的寿命字段。
     * @returns {void} 无返回值。
     */
    function migrateLifespanMonthsToYears(saveData) {
        if (Array.isArray(saveData.goblins)) {
            // number 哥布林循环索引：遍历旧存档哥布林数组的整数下标。
            for (var goblinIndex = 0; goblinIndex < saveData.goblins.length; goblinIndex += 1) {
                // Goblin 当前哥布林对象：迁移年龄和寿命拆分字段。
                var goblin = saveData.goblins[goblinIndex];

                if (!goblin) {
                    continue;
                }

                migrateIndividualLifespanMonthsToYears(goblin, false);
            }
        }

        if (Array.isArray(saveData.captives)) {
            // number 俘虏循环索引：遍历旧存档俘虏数组的整数下标。
            for (var captiveIndex = 0; captiveIndex < saveData.captives.length; captiveIndex += 1) {
                // CaptiveState 当前俘虏对象：迁移年龄和寿命拆分字段。
                var captive = saveData.captives[captiveIndex];

                if (!captive) {
                    continue;
                }

                migrateIndividualLifespanMonthsToYears(captive, true);
            }
        }
    }

    /**
     * 迁移单个个体的寿命字段。
     *
     * @param {Goblin|CaptiveState} individual - 哥布林或俘虏对象，会被直接修改。
     * @param {boolean} isCaptive - 是否为俘虏；true 表示需要按俘虏类型补基础年龄和寿命。
     * @returns {void} 无返回值。
     */
    function migrateIndividualLifespanMonthsToYears(individual, isCaptive) {
        // number 旧年龄月数：v19 及更早按生存月累计，迁移后折算成年。
        var legacyAgeMonths = Math.max(0, Number(individual.age) || 0);

        individual.age = isCaptive && legacyAgeMonths <= 0 ? createCaptiveInitialAgeYears(individual.type) : legacyAgeMonths / 12;

        if (typeof individual.baseLifespanYears !== "number") {
            individual.baseLifespanYears = Math.max(1, Math.floor(Number(individual.baseLifespanMonths) || (isCaptive ? createCaptiveBaseLifespanYears(individual.quality, individual.age + 1, individual.raceId) : game.definitions.POPULATION_CONSTANTS.baseGoblinLifespanYears)));
        }
        if (typeof individual.growthLifespanYears !== "number" && !isCaptive) {
            individual.growthLifespanYears = Math.max(0, Math.floor(Number(individual.growthLifespanMonths) || 0));
        }
        if (typeof individual.technologyLifespanYears !== "number") {
            individual.technologyLifespanYears = Math.max(0, Math.floor(Number(individual.technologyLifespanMonths) || 0));
        }
        if (typeof individual.eventLifespanYears !== "number") {
            individual.eventLifespanYears = Math.max(0, Math.floor(Number(individual.eventLifespanMonths) || 0));
        }

        delete individual.baseLifespanMonths;
        delete individual.growthLifespanMonths;
        delete individual.technologyLifespanMonths;
        delete individual.eventLifespanMonths;
    }

    /**
     * 将旧抢掠研究入口迁移到大木棒。
     *
     * @param {SaveData} saveData - v12 或更早存档对象，会直接修改 technologies 数组。
     * @returns {void} 无返回值。
     */
    function migrateCrossbowRaidUnlocksToBigClub(saveData) {
        if (!Array.isArray(saveData.technologies)) {
            return;
        }

        // Object|null 朽木栽培科技存档：用于补齐新插入的大木棒显示状态。
        var deadwoodCultivationTechnology = null;

        // Object|null 弓弩科技存档：用于读取旧抢掠研究进度。
        var crossbowTechnology = null;

        // Object|null 大木棒科技存档：用于写入新抢掠研究进度。
        var bigClubTechnology = null;

        // number 循环索引：遍历存档科技数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < saveData.technologies.length; technologyIndex += 1) {
            // Object 当前科技存档：包含 id、isUnlocked 和 isResearched。
            var savedTechnology = saveData.technologies[technologyIndex];

            if (savedTechnology.id === "crossbow") {
                crossbowTechnology = savedTechnology;
            }

            if (savedTechnology.id === "deadwood_cultivation") {
                deadwoodCultivationTechnology = savedTechnology;
            }

            if (savedTechnology.id === "big_club") {
                bigClubTechnology = savedTechnology;
            }
        }

        // boolean 是否应显示大木棒：朽木栽培完成或外交已解锁都会暴露早期抢掠研究入口。
        var shouldUnlockBigClub = Boolean(
            (deadwoodCultivationTechnology && deadwoodCultivationTechnology.isResearched) ||
            (saveData.tabsUnlockedById && saveData.tabsUnlockedById.diplomacy)
        );

        // boolean 是否应完成大木棒：旧弓弩已研究等价于已走过旧抢掠前置链。
        var shouldResearchBigClub = Boolean(crossbowTechnology && crossbowTechnology.isResearched);

        if (!shouldUnlockBigClub && !shouldResearchBigClub) {
            return;
        }

        if (!bigClubTechnology) {
            bigClubTechnology = {
                id: "big_club",
                isUnlocked: true,
                isResearched: shouldResearchBigClub
            };
            saveData.technologies.push(bigClubTechnology);
            return;
        }

        bigClubTechnology.isUnlocked = true;
        bigClubTechnology.isResearched = Boolean(bigClubTechnology.isResearched || shouldResearchBigClub);
    }

    /**
     * 将旧军力资源掠夺模型迁移为队伍强度模型。
     *
     * @param {SaveData} saveData - v13 或更早存档对象，会清理 resources 并改写 statistics。
     * @returns {void} 无返回值。
     */
    function migrateMilitaryPowerRaidModelToRaidStrength(saveData) {
        if (Array.isArray(saveData.resources)) {
            // ResourceState[] 过滤后资源数组：移除旧 militaryPower 存档项。
            var filteredResources = [];

            // number 循环索引：遍历旧资源存档数组的整数下标。
            for (var resourceIndex = 0; resourceIndex < saveData.resources.length; resourceIndex += 1) {
                // Object 当前资源存档：用于过滤旧军力资源。
                var savedResource = saveData.resources[resourceIndex];

                if (savedResource.id !== "militaryPower") {
                    filteredResources.push(savedResource);
                }
            }

            saveData.resources = filteredResources;
        }

        saveData.statistics = saveData.statistics || {};

        if (saveData.statistics.raidEquipmentRatio) {
            // number 旧装备倍率：来自战旗等制作物，可能包含无法从当前资源库存重建的值。
            var legacyEquipmentRatio = saveData.statistics.raidEquipmentRatio;

            // number 战旗数量：用于估算恢复时会由工坊系统重建的队伍强度倍率。
            var warBannerCount = getSavedResourceValue(saveData, "warBanner");

            // number 可重建装备倍率：每个战旗在当前规则下提供 0.03 队伍强度。
            var rebuildableStrengthRatio = warBannerCount * 0.03;

            // number 兼容强度倍率：只迁移旧统计里不能由资源库存重建的剩余部分，避免读档后双算。
            var legacyStrengthRatio = Math.max(0, legacyEquipmentRatio - rebuildableStrengthRatio);

            if (legacyStrengthRatio > 0) {
                saveData.statistics.raidLegacyStrengthRatio = (saveData.statistics.raidLegacyStrengthRatio || 0) + legacyStrengthRatio;
            }

            delete saveData.statistics.raidEquipmentRatio;
        }
    }

    /**
     * 读取存档资源数量。
     *
     * @param {SaveData} saveData - 当前迁移中的存档对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {number} 存档资源数量，非负资源数量；缺失时返回 0。
     */
    function getSavedResourceValue(saveData, resourceId) {
        if (!Array.isArray(saveData.resources)) {
            return 0;
        }

        // number 循环索引：遍历资源存档数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < saveData.resources.length; resourceIndex += 1) {
            // Object 当前资源存档：用于匹配资源 ID 并读取数量。
            var savedResource = saveData.resources[resourceIndex];

            if (savedResource.id === resourceId) {
                return Math.max(0, Number(savedResource.value) || 0);
            }
        }

        return 0;
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
        restoredState.activeDiplomacyMissions = normalizeSavedDiplomacyMissions(Array.isArray(saveData.activeDiplomacyMissions) ? saveData.activeDiplomacyMissions : []);
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
        validateDiplomacyMissionIds(saveData.activeDiplomacyMissions);

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
     * 规范化在途外交行动存档。
     *
     * @param {Object[]} savedMissions - 在途外交行动存档数组；缺失字段会被收敛为安全默认值。
     * @returns {DiplomacyMissionState[]} 规范化后的在途外交行动数组。
     */
    function normalizeSavedDiplomacyMissions(savedMissions) {
        // DiplomacyMissionState[] 规范化结果：只保留贸易或掠夺行动。
        var normalizedMissions = [];

        // number 循环索引：遍历外交行动存档数组的整数下标。
        for (var missionIndex = 0; missionIndex < savedMissions.length; missionIndex += 1) {
            // Object 当前行动存档：用于补齐返程时间和冻结结算字段。
            var savedMission = savedMissions[missionIndex];

            if (!savedMission || (savedMission.modeId !== "trade" && savedMission.modeId !== "raid")) {
                continue;
            }

            normalizedMissions.push({
                id: String(savedMission.id || ("diplomacy-mission-" + Date.now() + "-" + missionIndex)),
                modeId: savedMission.modeId,
                locationId: String(savedMission.locationId || ""),
                factionId: String(savedMission.factionId || ""),
                raiderIds: Array.isArray(savedMission.raiderIds) ? savedMission.raiderIds.slice() : [],
                remainingSeconds: Math.max(0, Number(savedMission.remainingSeconds) || 0),
                totalSeconds: Math.max(0, Number(savedMission.totalSeconds) || 0),
                resultSnapshot: savedMission.resultSnapshot && typeof savedMission.resultSnapshot === "object" ? Object.assign({}, savedMission.resultSnapshot) : {}
            });
        }

        return normalizedMissions;
    }

    /**
     * 校验在途外交行动引用的静态 ID。
     *
     * @param {Object[]|undefined} savedMissions - 在途外交行动存档数组。
     * @returns {void} 无返回值。
     * @throws {Error} 发现未知阵营或掠夺目标 ID 时抛出错误。
     */
    function validateDiplomacyMissionIds(savedMissions) {
        if (!Array.isArray(savedMissions)) {
            return;
        }

        // string[] 阵营 ID 列表：用于校验贸易地点和行动势力。
        var factionIds = getDefinitionIds(game.definitions.FACTION_DEFINITIONS);

        // string[] 掠夺目标 ID 列表：用于校验掠夺行动地点。
        var raidTargetIds = getDefinitionIds(game.definitions.RAID_TARGET_DEFINITIONS);

        // number 循环索引：遍历外交行动存档数组的整数下标。
        for (var missionIndex = 0; missionIndex < savedMissions.length; missionIndex += 1) {
            // Object 当前行动存档：用于按行动类型校验地点 ID。
            var savedMission = savedMissions[missionIndex];

            if (!savedMission) {
                continue;
            }

            validateNullableId(savedMission.factionId, factionIds, "外交行动势力");

            if (savedMission.modeId === "trade") {
                validateNullableId(savedMission.locationId, factionIds, "贸易地点");
            } else if (savedMission.modeId === "raid") {
                validateNullableId(savedMission.locationId, raidTargetIds, "掠夺地点");
            } else {
                throw new Error("未知外交行动类型：" + savedMission.modeId);
            }
        }
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
            normalizeGoblinLifespanFields(goblin);
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
            captive.raceId = normalizeCaptiveRaceId(captive.raceId, captive.type);
            normalizeCaptiveLifespanFields(captive);
            captive.brainwashLevel = Math.min(100, Math.max(0, Number(captive.brainwashLevel) || 0));
            captive.isAutoBrainwashEnabled = Boolean(captive.isAutoBrainwashEnabled);
            captive.isAutoBreedEnabled = Boolean(captive.isAutoBreedEnabled);
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
     * 规范化俘虏种族 ID。
     *
     * @param {string|undefined} raceId - 存档中的种族 ID；旧存档可能缺失。
     * @param {string} captiveTypeId - 俘虏职业类型 ID，用于选择兼容默认种族。
     * @returns {string} 有效种族 ID。
     */
    function normalizeCaptiveRaceId(raceId, captiveTypeId) {
        if (isKnownCaptiveRaceId(raceId)) {
            return raceId;
        }

        if (captiveTypeId === "undead_captive") {
            return "ghoulkin";
        }

        return "mire_human";
    }

    /**
     * 判断种族 ID 是否存在于当前静态定义。
     *
     * @param {string|undefined} raceId - 待校验种族 ID。
     * @returns {boolean} 是否为已定义种族 ID。
     */
    function isKnownCaptiveRaceId(raceId) {
        if (!raceId || !Array.isArray(game.definitions.CAPTIVE_RACE_DEFINITIONS)) {
            return false;
        }

        // number 循环索引：遍历俘虏种族定义数组的整数下标。
        for (var raceIndex = 0; raceIndex < game.definitions.CAPTIVE_RACE_DEFINITIONS.length; raceIndex += 1) {
            // CaptiveRaceDefinition 当前种族定义：用于匹配种族 ID。
            var raceDefinition = game.definitions.CAPTIVE_RACE_DEFINITIONS[raceIndex];

            if (raceDefinition.id === raceId) {
                return true;
            }
        }

        return false;
    }

    /**
     * 生成俘虏基础年龄。
     *
     * @param {string} captiveTypeId - 俘虏类型 ID；未知时使用成年兜底年龄段。
     * @returns {number} 基础年龄，单位年，非负整数。
     */
    function createCaptiveInitialAgeYears(captiveTypeId) {
        // Object|null 俘虏类型定义：用于读取基础年龄范围。
        var captiveTypeDefinition = getDefinitionById(game.definitions.CAPTIVE_TYPE_DEFINITIONS, captiveTypeId);

        // number 最小年龄：该类型俘虏生成年龄下限，单位年。
        var minAgeYears = captiveTypeDefinition ? Math.max(0, Math.floor(Number(captiveTypeDefinition.minInitialAgeYears) || 0)) : 18;

        // number 最大年龄：该类型俘虏生成年龄上限，单位年。
        var maxAgeYears = captiveTypeDefinition ? Math.max(minAgeYears, Math.floor(Number(captiveTypeDefinition.maxInitialAgeYears) || minAgeYears)) : 35;

        return randomIntegerInclusive(minAgeYears, maxAgeYears);
    }

    /**
     * 生成俘虏基础寿命。
     *
     * @param {string} qualityId - 俘虏质量 ID；未知时使用兜底寿命。
     * @param {number=} minimumLifespanYears - 可选寿命下限，单位年；用于避免年龄已超过寿命。
     * @param {string=} raceId - 可选种族 ID；提供时会叠加种族寿命修正。
     * @returns {number} 基础寿命，单位年，范围为 18-140。
     */
    function createCaptiveBaseLifespanYears(qualityId, minimumLifespanYears, raceId) {
        // Object|null 俘虏质量定义：用于读取质量寿命范围。
        var qualityDefinition = getDefinitionById(game.definitions.CAPTIVE_QUALITY_DEFINITIONS, qualityId);

        // Object|null 俘虏种族定义：用于读取不同种族的寿命修正。
        var raceDefinition = getDefinitionById(game.definitions.CAPTIVE_RACE_DEFINITIONS, raceId);

        // number 种族寿命修正：单位年，可正可负。
        var raceLifespanYears = raceDefinition ? Number(raceDefinition.lifespanYears) || 0 : 0;

        // number 最小寿命：质量定义下限，单位年。
        var minLifespanYears = qualityDefinition ? Math.max(18, Math.floor(Number(qualityDefinition.minLifespanYears) + raceLifespanYears || 30)) : game.definitions.POPULATION_CONSTANTS.fallbackCaptiveLifespanYears;

        // number 额外寿命下限：至少高于当前年龄，省略时不额外抬高。
        var safeMinimumLifespanYears = Math.max(0, Math.floor(Number(minimumLifespanYears) || 0));

        minLifespanYears = Math.min(140, Math.max(minLifespanYears, safeMinimumLifespanYears));

        // number 最大寿命：质量定义上限叠加种族修正，单位年，封顶 140。
        var maxLifespanYears = qualityDefinition ? Math.min(140, Math.max(minLifespanYears, Math.floor(Number(qualityDefinition.maxLifespanYears) + raceLifespanYears || minLifespanYears))) : minLifespanYears;

        return randomIntegerInclusive(minLifespanYears, maxLifespanYears);
    }

    /**
     * 按 ID 查找静态定义。
     *
     * @param {Object[]} definitions - 静态定义数组；每项应包含 id 字段。
     * @param {string} definitionId - 要查找的稳定 ID。
     * @returns {Object|null} 匹配的静态定义；没有时返回 null。
     */
    function getDefinitionById(definitions, definitionId) {
        // number 循环索引：遍历定义数组的整数下标。
        for (var definitionIndex = 0; definitionIndex < definitions.length; definitionIndex += 1) {
            // Object 当前定义：用于匹配稳定 ID。
            var definition = definitions[definitionIndex];

            if (definition.id === definitionId) {
                return definition;
            }
        }

        return null;
    }

    /**
     * 生成闭区间整数随机数。
     *
     * @param {number} minValue - 随机下限，整数。
     * @param {number} maxValue - 随机上限，整数且不小于 minValue。
     * @returns {number} 闭区间内的整数随机值。
     */
    function randomIntegerInclusive(minValue, maxValue) {
        return minValue + Math.floor(Math.random() * (maxValue - minValue + 1));
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
     * 补齐存档哥布林寿命字段。
     *
     * @param {Goblin} goblin - 哥布林对象，会补入寿命拆分字段。
     * @returns {void} 无返回值。
     */
    function normalizeGoblinLifespanFields(goblin) {
        goblin.age = Math.max(0, Number(goblin.age) || 0);
        goblin.baseLifespanYears = Math.max(1, Math.floor(Number(goblin.baseLifespanYears) || game.definitions.POPULATION_CONSTANTS.baseGoblinLifespanYears));
        goblin.growthLifespanYears = Math.max(0, Math.floor(Number(goblin.growthLifespanYears) || 0));
        goblin.technologyLifespanYears = Math.max(0, Math.floor(Number(goblin.technologyLifespanYears) || 0));
        goblin.eventLifespanYears = Math.max(0, Math.floor(Number(goblin.eventLifespanYears) || 0));
        goblin.elderDeathCheckCount = Math.max(0, Math.floor(Number(goblin.elderDeathCheckCount) || 0));
    }

    /**
     * 补齐存档俘虏寿命字段。
     *
     * @param {CaptiveState} captive - 俘虏对象，会补入寿命拆分字段。
     * @returns {void} 无返回值。
     */
    function normalizeCaptiveLifespanFields(captive) {
        captive.age = Math.max(0, Number(captive.age) || createCaptiveInitialAgeYears(captive.type));
        captive.baseLifespanYears = Math.max(1, Math.floor(Number(captive.baseLifespanYears) || createCaptiveBaseLifespanYears(captive.quality, captive.age + 1, captive.raceId)));
        captive.technologyLifespanYears = Math.max(0, Math.floor(Number(captive.technologyLifespanYears) || 0));
        captive.eventLifespanYears = Math.max(0, Math.floor(Number(captive.eventLifespanYears) || 0));
        captive.elderDeathCheckCount = Math.max(0, Math.floor(Number(captive.elderDeathCheckCount) || 0));
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

            if (game.population && game.population.calculateGoblinGrowthLifespanYears) {
                goblin.growthLifespanYears = game.population.calculateGoblinGrowthLifespanYears(goblin);
            }
        }

        if (game.jobs && game.jobs.promoteHaulersToMiners) {
            game.jobs.promoteHaulersToMiners(state);
        }

        if (game.population && game.population.refreshTechnologyLifespanBonus) {
            game.population.refreshTechnologyLifespanBonus(state);
        }

        if (game.captivesSystem && game.captivesSystem.normalizeCaptiveLifespanFields) {
            // number 俘虏循环索引：遍历俘虏数组并刷新科技寿命。
            for (var captiveIndex = 0; captiveIndex < state.captives.length; captiveIndex += 1) {
                // CaptiveState 当前俘虏对象：用于补齐并刷新寿命字段。
                var captive = state.captives[captiveIndex];

                game.captivesSystem.normalizeCaptiveLifespanFields(state, captive);
            }
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
