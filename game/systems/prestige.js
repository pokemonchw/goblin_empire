/* 威望系统：负责帝国迁徙、帝国遗产结算和永久天赋效果。 */
/**
 * 初始化威望系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 prestigeSystem 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // string[] 矿物容量资源列表：深挖本能只影响矿物、工业和深渊稀有库存上限。
    var MINERAL_CAPACITY_RESOURCE_IDS = [
        "coalSlag",
        "ironOre",
        "ironPlate",
        "tar",
        "blackIron",
        "runePlate",
        "manaCrystal",
        "abyssEcho",
        "relic",
        "riftShard"
    ];

    // string[] 契约代价效果列表：深渊适应只压低这些负担项的绝对值。
    var PACT_COST_EFFECT_IDS = [
        "fungusConsumptionRatio",
        "eventRiskRatio",
        "obedienceDrainPerSecond",
        "tradeRewardRatio"
    ];

    /**
     * 取得威望天赋定义。
     *
     * @param {string} perkId - 威望天赋稳定 ID。
     * @returns {PrestigePerkDefinition|null} 威望天赋定义；未找到时返回 null。
     */
    function getPrestigePerkDefinition(perkId) {
        // number 循环索引：遍历威望天赋定义数组的整数下标。
        for (var perkIndex = 0; perkIndex < game.definitions.PRESTIGE_PERK_DEFINITIONS.length; perkIndex += 1) {
            // PrestigePerkDefinition 当前威望天赋定义：用于匹配天赋 ID。
            var perkDefinition = game.definitions.PRESTIGE_PERK_DEFINITIONS[perkIndex];

            if (perkDefinition.id === perkId) {
                return perkDefinition;
            }
        }

        return null;
    }

    /**
     * 判断威望天赋是否已购买。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} perkId - 威望天赋稳定 ID。
     * @returns {boolean} 是否已购买；true 表示永久效果生效。
     */
    function isPrestigePerkPurchased(state, perkId) {
        return state.prestige.perks.indexOf(perkId) !== -1;
    }

    /**
     * 汇总已购买威望天赋效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, number>} 威望效果字典；key 为效果 ID，value 为累计数值。
     */
    function getPrestigeEffects(state) {
        // Object.<string, number> 效果汇总字典：按效果 ID 累加已购天赋。
        var prestigeEffects = {};

        // number 循环索引：遍历已购威望天赋 ID 的整数下标。
        for (var perkIndex = 0; perkIndex < state.prestige.perks.length; perkIndex += 1) {
            // string 天赋 ID：用于读取威望天赋定义。
            var perkId = state.prestige.perks[perkIndex];

            // PrestigePerkDefinition|null 天赋定义：缺失时跳过以兼容旧存档。
            var perkDefinition = getPrestigePerkDefinition(perkId);

            if (!perkDefinition) {
                continue;
            }

            // string[] 效果 ID 数组：遍历该天赋的效果字段。
            var effectIds = Object.keys(perkDefinition.effects);

            // number 效果循环索引：遍历效果 ID 数组的整数下标。
            for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
                // string 效果 ID：用于累加同名效果。
                var effectId = effectIds[effectIndex];

                prestigeEffects[effectId] = (prestigeEffects[effectId] || 0) + perkDefinition.effects[effectId];
            }
        }

        return prestigeEffects;
    }

    /**
     * 更新威望相关历史统计。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入历史最高人口。
     * @returns {void} 无返回值。
     */
    function updatePrestigeStatistics(state) {
        // number 当前存活人口：作为历史最高人口候选值。
        var aliveCount = game.population.countAliveGoblins(state);

        state.statistics.highestPopulation = Math.max(state.statistics.highestPopulation || 0, aliveCount);
    }

    /**
     * 计算迁徙可获得帝国遗产。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 本次迁徙可获得的帝国遗产，非负整数。
     */
    function calculateEarnedLegacy(state) {
        // Object.<string, number> 遗产来源拆分：与界面预估共享同一公式来源。
        var legacyBreakdown = calculateLegacyBreakdown(state);

        return legacyBreakdown.total;
    }

    /**
     * 计算帝国遗产来源拆分。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, number>} 遗产来源字典；total 为最终非负整数。
     */
    function calculateLegacyBreakdown(state) {
        // number 历史最高人口：使用统计值和当前人口的较大值。
        var highestPopulation = Math.max(state.statistics.highestPopulation || 0, game.population.countAliveGoblins(state));

        // number 历史总粗识：统计累计值缺失时回退到当前库存。
        var totalKnowledge = Math.max(state.statistics.totalCrudeKnowledgeEarned || 0, state.resourcesById.crudeKnowledge ? state.resourcesById.crudeKnowledge.value : 0);

        // number 深渊门数量：来自当前建筑状态的非负整数。
        var abyssGateCount = state.buildingsById.abyss_gate ? state.buildingsById.abyss_gate.owned : 0;

        // number 成就奖励：由已完成的阶段目标统计换算。
        var achievementReward = calculateAchievementLegacyReward(state);

        // number 人口来源遗产：策划公式中的 sqrt(历史最高人口) 部分。
        var populationLegacy = Math.sqrt(highestPopulation);

        // number 粗识来源遗产：策划公式中的 log10(历史总粗识 + 1) * 3 部分。
        var knowledgeLegacy = Math.log10(totalKnowledge + 1) * 3;

        // number 深渊门来源遗产：每座深渊门提供 5 点基础遗产。
        var abyssGateLegacy = abyssGateCount * 5;

        // number 遗产总数：所有来源求和后向下取整，保持整数威望货币。
        var totalLegacy = Math.max(0, Math.floor(populationLegacy + knowledgeLegacy + abyssGateLegacy + achievementReward));

        // 迁徙奖励使用人口、粗识、深渊门和成就共同驱动，避免单一刷法支配长线循环。
        return {
            highestPopulation: highestPopulation,
            totalKnowledge: totalKnowledge,
            abyssGateCount: abyssGateCount,
            populationLegacy: populationLegacy,
            knowledgeLegacy: knowledgeLegacy,
            abyssGateLegacy: abyssGateLegacy,
            achievementReward: achievementReward,
            total: totalLegacy
        };
    }

    /**
     * 计算成就带来的帝国遗产奖励。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 成就奖励数量，非负整数。
     */
    function calculateAchievementLegacyReward(state) {
        // number 成就奖励：每项关键终局标记提供少量帝国遗产。
        var achievementReward = 0;

        if (state.statistics.hasBuiltChiefHall) {
            achievementReward += 2;
        }

        if (state.statistics.hasBuiltBlackIronFortress) {
            achievementReward += 5;
        }

        if (state.statistics.hasOpenedAbyssGate) {
            achievementReward += 3;
        }

        if (state.statistics.hasMigratedEmpire) {
            achievementReward += 5;
        }

        achievementReward += countCompletedChallenges(state) * 2;
        return achievementReward;
    }

    /**
     * 统计已完成挑战数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 已完成挑战数量，非负整数。
     */
    function countCompletedChallenges(state) {
        // number 已完成挑战数量：用于成就遗产奖励。
        var completedCount = 0;

        if (!state.challenges || !state.challenges.completedById) {
            return 0;
        }

        // string[] 挑战 ID 数组：遍历挑战完成字典。
        var challengeIds = Object.keys(state.challenges.completedById);

        // number 循环索引：遍历挑战 ID 数组的整数下标。
        for (var challengeIndex = 0; challengeIndex < challengeIds.length; challengeIndex += 1) {
            // string 当前挑战 ID：用于读取完成标记。
            var challengeId = challengeIds[challengeIndex];

            if (state.challenges.completedById[challengeId] || state.statistics["challengeCompleted_" + challengeId]) {
                completedCount += 1;
            }
        }

        return completedCount;
    }

    /**
     * 预览帝国迁徙结果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, boolean|number|string[]>} 迁徙预览对象。
     */
    function previewMigration(state) {
        // number 可获得遗产：按当前历史统计计算。
        var earnedLegacy = calculateEarnedLegacy(state);

        return {
            earnedLegacy: earnedLegacy,
            canMigrate: canMigrateEmpire(state),
            keepTexts: [
                "帝国遗产",
                "已购买威望天赋",
                "黑铁要塞、深渊门等成就统计",
                "挑战完成标记",
                "少量传奇领袖和血脉历史统计"
            ],
            loseTexts: [
                "普通资源和建筑",
                "当前普通人口",
                "当前科技和职业解锁",
                "俘虏、政策、契约和进行中远征"
            ]
        };
    }

    /**
     * 判断当前是否允许帝国迁徙。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否允许迁徙；true 表示满足科技、未暂停且没有远征。
     */
    function canMigrateEmpire(state) {
        // TechnologyState 迁徙法典科技状态：作为迁徙入口的硬性门槛。
        var migrationTechnologyState = state.technologiesById.migration_code;

        return Boolean(migrationTechnologyState && migrationTechnologyState.isResearched && !state.isPaused && !state.activeExpedition && calculateEarnedLegacy(state) > 0);
    }

    /**
     * 购买威望天赋。
     *
     * @param {GameState} state - 当前游戏状态对象，会扣除帝国遗产并写入天赋 ID。
     * @param {string} perkId - 威望天赋稳定 ID。
     * @returns {boolean} 是否购买成功；true 表示永久天赋已生效。
     */
    function purchasePrestigePerk(state, perkId) {
        if (state.isPaused || isPrestigePerkPurchased(state, perkId)) {
            return false;
        }

        // PrestigePerkDefinition|null 天赋定义：用于读取成本和效果。
        var perkDefinition = getPrestigePerkDefinition(perkId);

        if (!perkDefinition || state.prestige.legacy < perkDefinition.cost) {
            return false;
        }

        state.prestige.legacy -= perkDefinition.cost;
        state.prestige.perks.push(perkId);
        syncLegacyResource(state);
        applyPermanentPerks(state);
        game.simulation.addLog(state, "important", "购买威望天赋：" + perkDefinition.name + "。");
        return true;
    }

    /**
     * 执行帝国迁徙重置。
     *
     * @param {GameState} state - 当前游戏状态对象，会被替换为新局状态。
     * @param {boolean} isConfirmed - 是否已明确确认；true 表示允许执行重置。
     * @returns {boolean} 是否迁徙成功；true 表示状态已重置。
     */
    function executeMigration(state, isConfirmed) {
        if (!isConfirmed || !canMigrateEmpire(state)) {
            return false;
        }

        // Object.<string, number> 威望效果字典：用于计算可跨局保留的少量资源。
        var prestigeEffects = getPrestigeEffects(state);

        // number 本次获得遗产：会加入永久帝国遗产总量。
        var earnedLegacy = calculateEarnedLegacy(state);

        // number 保留祖灵回响：祖灵记忆天赋让少量祖灵资源跨局。
        var retainedAncestralEcho = calculateRetainedAncestralEcho(state, prestigeEffects);

        if (game.challengesSystem) {
            game.challengesSystem.completeActiveChallenge(state);
        }

        // Object.<string, number> 保留统计字典：只保留成就、挑战和历史摘要。
        var retainedStatistics = createRetainedStatistics(state, earnedLegacy);

        // Object 挑战状态：保留永久完成标记，清空当前活动挑战。
        var retainedChallenges = {
            runMode: "undecided",
            activeChallengeId: null,
            completedById: state.challenges ? Object.assign({}, state.challenges.completedById) : {}
        };

        // Object 威望状态：保留帝国遗产和已购天赋。
        var retainedPrestige = {
            legacy: state.prestige.legacy + earnedLegacy,
            perks: state.prestige.perks.slice()
        };

        // GameState 新局状态：普通资源、建筑、科技、人口都从初始状态重建。
        var nextState = game.initialState.createInitialState();

        nextState.prestige = retainedPrestige;
        nextState.challenges = retainedChallenges;
        nextState.statistics = retainedStatistics;
        syncLegacyResource(nextState);

        if (retainedAncestralEcho > 0) {
            game.resources.addResource(nextState, "ancestralEcho", retainedAncestralEcho);
        }

        applyPermanentPerks(nextState);
        replaceStateContents(state, nextState);
        game.simulation.addLog(state, "important", "帝国迁徙完成，获得帝国遗产 " + earnedLegacy + "。");
        return true;
    }

    /**
     * 计算迁徙后保留的祖灵回响。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object.<string, number>} prestigeEffects - 威望效果字典。
     * @returns {number} 保留的祖灵回响数量，非负资源数量。
     */
    function calculateRetainedAncestralEcho(state, prestigeEffects) {
        // ResourceState 祖灵回响状态：用于读取当前库存。
        var ancestralEchoState = state.resourcesById.ancestralEcho;

        // number 保留比例：没有祖灵记忆时为 0。
        var retentionRatio = Math.max(0, prestigeEffects.ancestralEchoRetentionRatio || 0);

        if (!ancestralEchoState || retentionRatio <= 0) {
            return 0;
        }

        return Math.max(0, ancestralEchoState.value * retentionRatio);
    }

    /**
     * 创建迁徙后保留的统计摘要。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {number} earnedLegacy - 本次获得的帝国遗产，非负整数。
     * @returns {Object.<string, number>} 保留统计字典。
     */
    function createRetainedStatistics(state, earnedLegacy) {
        // Object.<string, number> 保留统计字典：只保存长期摘要，避免普通对象跨局膨胀。
        var retainedStatistics = {};

        copyRetainedStatistic(state, retainedStatistics, "hasBuiltBlackIronFortress");
        copyRetainedStatistic(state, retainedStatistics, "hasBuiltChiefHall");
        copyRetainedStatistic(state, retainedStatistics, "hasOpenedAbyssGate");
        copyPrefixedStatistics(state, retainedStatistics, "achievement_");
        copyPrefixedStatistics(state, retainedStatistics, "challengeCompleted_");
        retainedStatistics.highestPopulation = Math.max(state.statistics.highestPopulation || 0, game.population.countAliveGoblins(state));
        retainedStatistics.totalCrudeKnowledgeEarned = Math.max(state.statistics.totalCrudeKnowledgeEarned || 0, state.resourcesById.crudeKnowledge ? state.resourcesById.crudeKnowledge.value : 0);
        retainedStatistics.totalMigrations = (state.statistics.totalMigrations || 0) + 1;
        retainedStatistics.historicalLegacyEarned = (state.statistics.historicalLegacyEarned || 0) + earnedLegacy;
        retainedStatistics.hasMigratedEmpire = 1;
        retainedStatistics.migratedLegendaryLeaders = (state.statistics.migratedLegendaryLeaders || 0) + countLegendaryLeaders(state);
        retainedStatistics.migratedBloodlineTags = (state.statistics.migratedBloodlineTags || 0) + countBloodlineTags(state);
        return retainedStatistics;
    }

    /**
     * 复制单个长期统计字段。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object.<string, number>} retainedStatistics - 保留统计字典，会被写入。
     * @param {string} statisticKey - 统计字段 ID。
     * @returns {void} 无返回值。
     */
    function copyRetainedStatistic(state, retainedStatistics, statisticKey) {
        if (state.statistics[statisticKey]) {
            retainedStatistics[statisticKey] = state.statistics[statisticKey];
        }
    }

    /**
     * 复制指定前缀的长期统计字段。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object.<string, number>} retainedStatistics - 保留统计字典，会被写入。
     * @param {string} prefix - 统计字段前缀。
     * @returns {void} 无返回值。
     */
    function copyPrefixedStatistics(state, retainedStatistics, prefix) {
        // string[] 统计键数组：遍历当前统计字段。
        var statisticKeys = Object.keys(state.statistics);

        // number 循环索引：遍历统计键数组的整数下标。
        for (var statisticIndex = 0; statisticIndex < statisticKeys.length; statisticIndex += 1) {
            // string 统计键：用于检查指定前缀。
            var statisticKey = statisticKeys[statisticIndex];

            if (statisticKey.indexOf(prefix) === 0) {
                retainedStatistics[statisticKey] = state.statistics[statisticKey];
            }
        }
    }

    /**
     * 统计可写入历史摘要的传奇领袖数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 传奇领袖数量，非负整数。
     */
    function countLegendaryLeaders(state) {
        // number 传奇领袖数量：只作为历史摘要保留，不保留完整哥布林对象。
        var legendaryLeaderCount = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林：用于检查领袖和传奇标签。
            var goblin = state.goblins[goblinIndex];

            if (goblin.id === state.leaderGoblinId && goblin.traits.indexOf("legendary") !== -1) {
                legendaryLeaderCount += 1;
            }
        }

        return legendaryLeaderCount;
    }

    /**
     * 统计可写入历史摘要的血脉标签数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 血脉标签数量，非负整数。
     */
    function countBloodlineTags(state) {
        // number 血脉标签数量：只保存数量摘要。
        var bloodlineTagCount = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林：用于统计血脉标签。
            var goblin = state.goblins[goblinIndex];

            // number 特质循环索引：遍历特质数组的整数下标。
            for (var traitIndex = 0; traitIndex < goblin.traits.length; traitIndex += 1) {
                // string 特质 ID：以 bloodline_ 开头的特质记入跨局摘要。
                var traitId = goblin.traits[traitIndex];

                if (traitId.indexOf("bloodline_") === 0) {
                    bloodlineTagCount += 1;
                }
            }
        }

        return bloodlineTagCount;
    }

    /**
     * 同步帝国遗产资源显示。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入帝国遗产资源状态。
     * @returns {void} 无返回值。
     */
    function syncLegacyResource(state) {
        if (!state.resourcesById.imperialLegacy) {
            return;
        }

        state.resourcesById.imperialLegacy.value = state.prestige.legacy;
        state.resourcesById.imperialLegacy.isVisible = state.prestige.legacy > 0;
        state.resourcesById.prestige.isVisible = state.prestige.legacy > 0 || state.statistics.hasMigratedEmpire;
    }

    /**
     * 应用威望天赋带来的运行时永久效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入统计倍率和容量。
     * @returns {void} 无返回值。
     */
    function applyPermanentPerks(state) {
        // Object.<string, number> 威望效果字典：用于写入可被其他系统读取的倍率。
        var prestigeEffects = getPrestigeEffects(state);

        state.statistics.permanentBuildingPriceRatio = prestigeEffects.buildingPriceRatio || 0;
        state.statistics.permanentCoinLootGainRatio = prestigeEffects.coinLootGainRatio || 0;
        state.statistics.permanentLedgerCraftRatio = prestigeEffects.ledgerCraftRatio || 0;
        state.statistics.permanentRunePlateCraftRatio = prestigeEffects.runePlateCraftRatio || 0;
        state.statistics.permanentMetalCraftRatio = prestigeEffects.metalCraftRatio || 0;
        state.statistics.permanentPactCostRatio = prestigeEffects.pactCostRatio || 0;
        state.statistics.permanentJobPresetSupport = prestigeEffects.jobPresetSupport || 0;
        applyMineralCapacityRatio(state, prestigeEffects.mineralCapacityRatio || 0);
    }

    /**
     * 应用矿物容量威望倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，会提高指定资源容量。
     * @param {number} targetRatio - 目标矿物容量倍率，非负比例。
     * @returns {void} 无返回值。
     */
    function applyMineralCapacityRatio(state, targetRatio) {
        // number 已应用倍率：避免重复调用时多次叠加同一个天赋。
        var appliedRatio = state.statistics.appliedMineralCapacityPrestigeRatio || 0;

        // number 增量倍率：本次只应用新增部分。
        var ratioDelta = Math.max(0, targetRatio - appliedRatio);

        if (ratioDelta <= 0) {
            return;
        }

        // number 循环索引：遍历矿物容量资源 ID 的整数下标。
        for (var resourceIndex = 0; resourceIndex < MINERAL_CAPACITY_RESOURCE_IDS.length; resourceIndex += 1) {
            // string 资源 ID：用于读取并提高容量。
            var resourceId = MINERAL_CAPACITY_RESOURCE_IDS[resourceIndex];

            // ResourceState 资源状态：会被提高容量上限。
            var resourceState = state.resourcesById[resourceId];

            if (resourceState) {
                resourceState.maxValue *= 1 + ratioDelta;
            }
        }

        state.statistics.appliedMineralCapacityPrestigeRatio = targetRatio;
    }

    /**
     * 判断效果 ID 是否属于契约代价。
     *
     * @param {string} effectId - 契约效果 ID。
     * @returns {boolean} 是否属于契约代价；true 表示可被深渊适应减免。
     */
    function isPactCostEffect(effectId) {
        return PACT_COST_EFFECT_IDS.indexOf(effectId) !== -1;
    }

    /**
     * 替换当前状态对象内容。
     *
     * @param {GameState} state - 当前游戏状态对象，会被清空并写入新字段。
     * @param {GameState} nextState - 新局状态对象，作为字段来源。
     * @returns {void} 无返回值。
     */
    function replaceStateContents(state, nextState) {
        // string[] 旧字段数组：用于清空当前对象。
        var stateKeys = Object.keys(state);

        // number 旧字段循环索引：遍历当前字段数组的整数下标。
        for (var stateKeyIndex = 0; stateKeyIndex < stateKeys.length; stateKeyIndex += 1) {
            // string 当前旧字段名：用于删除字段。
            var stateKey = stateKeys[stateKeyIndex];

            delete state[stateKey];
        }

        // string[] 新字段数组：用于写入替换状态。
        var nextStateKeys = Object.keys(nextState);

        // number 新字段循环索引：遍历新字段数组的整数下标。
        for (var nextStateKeyIndex = 0; nextStateKeyIndex < nextStateKeys.length; nextStateKeyIndex += 1) {
            // string 当前新字段名：用于复制字段。
            var nextStateKey = nextStateKeys[nextStateKeyIndex];

            state[nextStateKey] = nextState[nextStateKey];
        }
    }

    // Object 威望系统命名空间：提供迁徙、天赋和永久效果接口。
    game.prestigeSystem = {
        getPrestigePerkDefinition: getPrestigePerkDefinition,
        isPrestigePerkPurchased: isPrestigePerkPurchased,
        getPrestigeEffects: getPrestigeEffects,
        updatePrestigeStatistics: updatePrestigeStatistics,
        calculateEarnedLegacy: calculateEarnedLegacy,
        calculateLegacyBreakdown: calculateLegacyBreakdown,
        previewMigration: previewMigration,
        canMigrateEmpire: canMigrateEmpire,
        purchasePrestigePerk: purchasePrestigePerk,
        executeMigration: executeMigration,
        syncLegacyResource: syncLegacyResource,
        applyPermanentPerks: applyPermanentPerks,
        isPactCostEffect: isPactCostEffect
    };
})(window.GoblinEmpire);
