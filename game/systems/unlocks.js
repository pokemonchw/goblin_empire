/* 解锁模块：统一处理 UnlockBundle 和隐藏规则。 */
/**
 * 初始化解锁模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 unlocks 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 创建空解锁包。
     *
     * @returns {UnlockBundle} 空解锁包；各数组字段默认存在且为空。
     */
    function createEmptyUnlockBundle() {
        return {
            tabs: [],
            resources: [],
            buildings: [],
            jobs: [],
            technologies: [],
            upgrades: [],
            crafts: [],
            policies: []
        };
    }

    /**
     * 判断定义是否默认解锁。
     *
     * @param {UnlockBundle|undefined} unlockBundle - 解锁结构；省略时视为未默认解锁。
     * @returns {boolean} 是否默认解锁；true 表示新存档立即显示。
     */
    function isDefaultUnlocked(unlockBundle) {
        return Boolean(unlockBundle && unlockBundle.isDefault);
    }

    /**
     * 判断资源是否首次获得后应永久显示。
     *
     * @param {ResourceState} resourceState - 当前资源状态对象。
     * @returns {boolean} 是否应显示；true 表示已可见或数量大于 0。
     */
    function shouldRevealResource(resourceState) {
        return Boolean(resourceState.isVisible || resourceState.value > 0);
    }

    /**
     * 应用解锁包到游戏状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {UnlockBundle} unlockBundle - 解锁包；包含标签页、资源、建筑、职业、科技等 ID 数组。
     * @returns {void} 无返回值。
     */
    function applyUnlockBundle(state, unlockBundle) {
        if (!unlockBundle) {
            return;
        }

        applyResourceUnlocks(state, unlockBundle.resources || []);
        applyBuildingUnlocks(state, unlockBundle.buildings || []);
        applyTechnologyUnlocks(state, unlockBundle.technologies || []);
        applyJobUnlocks(state, unlockBundle.jobs || []);
        applyFlagUnlocks(state.tabsUnlockedById, unlockBundle.tabs || []);
        applyFlagUnlocks(state.upgradesUnlockedById, unlockBundle.upgrades || []);
        applyFlagUnlocks(state.craftsUnlockedById, unlockBundle.crafts || []);
        applyFlagUnlocks(state.policiesUnlockedById, unlockBundle.policies || []);
        applyDiplomacyUnlocks(state);
    }

    /**
     * 同步由人口门槛触发的一次性解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，会在首次拥有存活哥布林后解锁外交标签页和早期抢掠研究入口。
     * @returns {void} 无返回值。
     */
    function applyPopulationUnlocks(state) {
        // number 存活哥布林数量：用于判断人口驱动的系统入口，非负整数。
        var aliveGoblinCount = game.population && game.population.countAliveGoblins ? game.population.countAliveGoblins(state) : 0;

        // 外交在玩家拥有第一只哥布林后开放，让贸易和抢掠研究入口不被中期黑市卡住。
        if (aliveGoblinCount > 0) {
            state.tabsUnlockedById.diplomacy = true;
            applyTechnologyUnlocks(state, [
                "desire_enlightenment"
            ]);
            applyDiplomacyUnlocks(state);
        }

        applyDerivedUnlocks(state);
    }

    /**
     * 同步外交入口带出的早期抢掠研究。
     *
     * @param {GameState} state - 当前游戏状态对象，会在外交标签页已解锁时显示大木棒研究。
     * @returns {void} 无返回值。
     */
    function applyDiplomacyUnlocks(state) {
        if (!state.tabsUnlockedById.diplomacy) {
            return;
        }

        // TechnologyId[] 外交前置抢掠科技列表：用于让玩家尽早研究抢掠兵并在外交页开启掠夺。
        var raidTechnologyIds = [
            "big_club"
        ];

        applyTechnologyUnlocks(state, raidTechnologyIds);
    }

    /**
     * 同步解锁派生规则。
     *
     * @param {GameState} state - 当前游戏状态对象，会按已解锁标签页补齐派生科技入口。
     * @returns {void} 无返回值。
     */
    function applyDerivedUnlocks(state) {
        if (state.tabsUnlockedById.diplomacy) {
            applyDiplomacyUnlocks(state);
        }

        applyConditionalBuildingLocks(state);
        applyConditionalBuildingUnlocks(state);
    }

    /**
     * 应用资源解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {ResourceId[]} resourceIds - 资源 ID 数组。
     * @returns {void} 无返回值。
     */
    function applyResourceUnlocks(state, resourceIds) {
        // number 循环索引：遍历资源 ID 数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // ResourceId 当前资源 ID：用于查找并显示运行时资源状态。
            var resourceId = resourceIds[resourceIndex];

            if (state.resourcesById[resourceId]) {
                state.resourcesById[resourceId].isVisible = true;
            }
        }
    }

    /**
     * 应用建筑解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {BuildingId[]} buildingIds - 建筑 ID 数组。
     * @returns {void} 无返回值。
     */
    function applyBuildingUnlocks(state, buildingIds) {
        // number 循环索引：遍历建筑 ID 数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < buildingIds.length; buildingIndex += 1) {
            // BuildingId 当前建筑 ID：用于查找并显示运行时建筑状态。
            var buildingId = buildingIds[buildingIndex];

            // BuildingDefinition|null 当前建筑定义：用于检查额外统计门槛。
            var buildingDefinition = game.buildings && game.buildings.getBuildingDefinition ? game.buildings.getBuildingDefinition(buildingId) : null;

            if (state.buildingsById[buildingId] && canUnlockBuilding(state, buildingDefinition)) {
                state.buildingsById[buildingId].isUnlocked = true;
            }
        }
    }

    /**
     * 同步已经满足科技来源和运行时门槛的建筑解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，会补齐满足条件但尚未显示的建筑。
     * @returns {void} 无返回值。
     */
    function applyConditionalBuildingUnlocks(state) {
        // number 科技循环索引：遍历科技定义以查找建筑解锁来源。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 当前科技定义：用于读取研究状态和建筑解锁包。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            // TechnologyState|null 当前科技状态：用于确认建筑来源科技已经完成。
            var technologyState = state.technologiesById[technologyDefinition.id] || null;

            if (!technologyState || !technologyState.isResearched || !technologyDefinition.unlocks || !technologyDefinition.unlocks.buildings) {
                continue;
            }

            applyBuildingUnlocks(state, technologyDefinition.unlocks.buildings);
        }
    }

    /**
     * 收紧带额外门槛的未建造建筑，避免旧存档绕过新条件。
     *
     * @param {GameState} state - 当前游戏状态对象，会隐藏尚未建造且不满足门槛的建筑。
     * @returns {void} 无返回值。
     */
    function applyConditionalBuildingLocks(state) {
        // number 建筑循环索引：遍历建筑定义以检查额外门槛。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取额外运行时门槛。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            if (!buildingDefinition.unlockRequirements) {
                continue;
            }

            // BuildingState|null 当前建筑状态：用于判断是否需要重新隐藏。
            var buildingState = state.buildingsById[buildingDefinition.id] || null;

            if (buildingState && buildingState.owned <= 0 && !canUnlockBuilding(state, buildingDefinition)) {
                buildingState.isUnlocked = false;
            }
        }
    }

    /**
     * 判断建筑是否满足额外运行时解锁门槛。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition|null} buildingDefinition - 建筑定义对象；缺失时视为没有额外门槛。
     * @returns {boolean} 是否满足额外门槛；true 表示可以显示该建筑。
     */
    function canUnlockBuilding(state, buildingDefinition) {
        if (!buildingDefinition || !buildingDefinition.unlockRequirements) {
            return true;
        }

        return areStatisticRequirementsMet(state, buildingDefinition.unlockRequirements.statistics || []);
    }

    /**
     * 判断统计门槛是否全部满足。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {StatisticUnlockRequirement[]} statisticRequirements - 统计门槛数组；每项包含 id 和 minValue。
     * @returns {boolean} 是否全部满足；true 表示所有统计值达到最低要求。
     */
    function areStatisticRequirementsMet(state, statisticRequirements) {
        // number 循环索引：遍历统计门槛数组的整数下标。
        for (var requirementIndex = 0; requirementIndex < statisticRequirements.length; requirementIndex += 1) {
            // StatisticUnlockRequirement 当前统计门槛：用于比较状态统计值。
            var statisticRequirement = statisticRequirements[requirementIndex];

            // number 当前统计值：缺省按 0 处理，单位由统计项定义。
            var statisticValue = Math.max(0, Number(state.statistics[statisticRequirement.id]) || 0);

            // number 最低统计值：达到该值才满足门槛，非负累计数值。
            var minValue = Math.max(0, Number(statisticRequirement.minValue) || 0);

            if (statisticValue < minValue) {
                return false;
            }
        }

        return true;
    }

    /**
     * 应用科技解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {TechnologyId[]} technologyIds - 科技 ID 数组。
     * @returns {void} 无返回值。
     */
    function applyTechnologyUnlocks(state, technologyIds) {
        // number 循环索引：遍历科技 ID 数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < technologyIds.length; technologyIndex += 1) {
            // TechnologyId 当前科技 ID：用于查找并显示运行时科技状态。
            var technologyId = technologyIds[technologyIndex];

            if (state.technologiesById[technologyId]) {
                state.technologiesById[technologyId].isUnlocked = true;
            }
        }
    }

    /**
     * 应用职业解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {JobId[]} jobIds - 职业 ID 数组。
     * @returns {void} 无返回值。
     */
    function applyJobUnlocks(state, jobIds) {
        // number 循环索引：遍历职业 ID 数组的整数下标。
        for (var jobIndex = 0; jobIndex < jobIds.length; jobIndex += 1) {
            // JobId 当前职业 ID：用于写入职业解锁字典。
            var jobId = jobIds[jobIndex];

            state.jobsUnlockedById[jobId] = true;

            if (jobId === "miner" && game.jobs && game.jobs.promoteHaulersToMiners) {
                game.jobs.promoteHaulersToMiners(state);
            }
        }
    }

    /**
     * 应用通用布尔解锁字典。
     *
     * @param {Object.<string, boolean>} unlockedById - 解锁字典；key 为稳定 ID，value 表示是否解锁。
     * @param {string[]} stableIds - 要解锁的稳定 ID 数组。
     * @returns {void} 无返回值。
     */
    function applyFlagUnlocks(unlockedById, stableIds) {
        // number 循环索引：遍历稳定 ID 数组的整数下标。
        for (var stableIdIndex = 0; stableIdIndex < stableIds.length; stableIdIndex += 1) {
            // string 当前稳定 ID：用于写入通用解锁字典。
            var stableId = stableIds[stableIdIndex];

            unlockedById[stableId] = true;
        }
    }

    // Object 解锁模块命名空间：提供统一 UnlockBundle 操作。
    game.unlocks = {
        createEmptyUnlockBundle: createEmptyUnlockBundle,
        isDefaultUnlocked: isDefaultUnlocked,
        shouldRevealResource: shouldRevealResource,
        applyUnlockBundle: applyUnlockBundle,
        applyPopulationUnlocks: applyPopulationUnlocks,
        applyDerivedUnlocks: applyDerivedUnlocks,
        applyFlagUnlocks: applyFlagUnlocks,
        areStatisticRequirementsMet: areStatisticRequirementsMet
    };
})(window.GoblinEmpire);
