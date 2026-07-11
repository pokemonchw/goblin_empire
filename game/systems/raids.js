/* 掠夺系统：负责按战斗职业队伍强度预览和结算掠夺行动。 */
/**
 * 初始化掠夺系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 raids 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // JobId[] 战斗职业 ID 列表：只有这些职业的存活哥布林可以被派出掠夺。
    var RAID_JOB_IDS = [
        "raider",
        "war_chief"
    ];

    /**
     * 取得掠夺目标定义。
     *
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @returns {RaidTargetDefinition|null} 掠夺目标定义；未找到时返回 null。
     */
    function getRaidTargetDefinition(targetId) {
        // number 循环索引：遍历掠夺目标定义数组的整数下标。
        for (var targetIndex = 0; targetIndex < game.definitions.RAID_TARGET_DEFINITIONS.length; targetIndex += 1) {
            // RaidTargetDefinition 当前目标定义：用于匹配目标 ID。
            var targetDefinition = game.definitions.RAID_TARGET_DEFINITIONS[targetIndex];

            if (targetDefinition.id === targetId) {
                return targetDefinition;
            }
        }

        return null;
    }

    /**
     * 预览掠夺收益和风险。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @param {number=} requestedRaiderCount - 玩家输入的派出人数，正整数；省略时按目标最低人数预览。
     * @returns {Object.<string, number|string|boolean|Price[]|Object>} 掠夺预览对象。
     */
    function previewRaid(state, targetId, requestedRaiderCount) {
        // RaidTargetDefinition|null 目标定义：用于读取强度、奖励和关系惩罚。
        var targetDefinition = getRaidTargetDefinition(targetId);

        if (!targetDefinition) {
            return {};
        }

        // Goblin[] 可派出哥布林列表：只包含当前战斗职业的存活个体。
        var availableRaiders = getAvailableRaiders(state);

        // number 请求派出人数：玩家输入为空时使用目标最低人数。
        var normalizedRequestedCount = normalizeRaiderCount(requestedRaiderCount, targetDefinition.minRaiders);

        // number 实际派出人数：不能超过当前可派出的战斗职业人数。
        var raiderCount = Math.min(normalizedRequestedCount, availableRaiders.length);

        // Goblin[] 掠夺队伍：按战斗强度从可派出列表中选前 N 个。
        var raidParty = availableRaiders.slice(0, raiderCount);

        // number 基础队伍强度：由具体哥布林属性、技能和职业计算。
        var baseTeamStrength = calculateRaidPartyBaseStrength(raidParty);

        // number 队伍强度倍率：由建筑、装备、政策、契约和领袖组成。
        var strengthRatio = calculateRaidStrengthRatio(state, raidParty);

        // number 最终队伍强度：用于和目标地点强度比较。
        var teamStrength = baseTeamStrength * (1 + strengthRatio);

        // number 强度优势：正数表示队伍压过目标，负数表示目标更强。
        var strengthAdvantage = teamStrength - targetDefinition.targetStrength;

        // Object.<string, number> 政策效果字典：读取战利品和关系代价修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 祖灵升级效果字典：读取战鼓回音等单局倍率。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 契约效果字典：战争契约提高掠夺收益。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 关系下降倍率：强队更容易制造恐慌，弱队失败也更容易激怒目标。
        var relationPenaltyRatio = Math.max(0.75, Math.min(1.5, 1 + strengthAdvantage / 250));

        return {
            availableRaiderCount: availableRaiders.length,
            requestedRaiderCount: normalizedRequestedCount,
            raiderCount: raiderCount,
            minRaiders: targetDefinition.minRaiders,
            canStart: raiderCount >= targetDefinition.minRaiders,
            targetStrength: targetDefinition.targetStrength,
            teamStrength: teamStrength,
            strengthAdvantage: strengthAdvantage,
            strengthRatio: strengthRatio,
            rewards: targetDefinition.rewards,
            lootRatio: (policyEffects.raidLootRatio || 0) + (ritualEffects.raidLootRatio || 0) + (pactEffects.raidLootRatio || 0),
            successChance: Math.max(0.05, Math.min(0.95, 0.5 + strengthAdvantage / 100)),
            casualtyChance: Math.max(0.03, Math.min(0.55, 0.22 - strengthAdvantage / 280 - (state.statistics.raidCasualtyReductionRatio || 0))),
            deathChance: Math.max(0.01, Math.min(0.18, 0.05 - strengthAdvantage / 600)),
            relationPenalty: Math.max(0, Math.round(targetDefinition.relationPenalty * relationPenaltyRatio * (1 + (policyEffects.raidRelationPenaltyRatio || 0)))),
            retaliationChance: Math.min(0.75, Math.max(0, targetDefinition.relationPenalty / 100 + Math.max(0, -strengthAdvantage) / 200)),
            captiveTypes: targetDefinition.captiveTypes.join(" / ")
        };
    }

    /**
     * 执行掠夺。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @param {number} requestedRaiderCount - 玩家输入的派出人数，正整数。
     * @returns {boolean} 是否执行成功；true 表示已按队伍强度结算结果。
     */
    function executeRaid(state, targetId, requestedRaiderCount) {
        if (state.isPaused) {
            return false;
        }

        // RaidTargetDefinition|null 目标定义：用于读取收益和关系惩罚。
        var targetDefinition = getRaidTargetDefinition(targetId);

        if (!targetDefinition) {
            return false;
        }

        // Object.<string, number|string|boolean|Price[]|Object> 掠夺预览：用于本次成功率和风险。
        var preview = previewRaid(state, targetId, requestedRaiderCount);

        if (!preview.canStart) {
            game.simulation.addLog(state, "warning", "掠夺队伍不足：" + targetDefinition.name + " 至少需要 " + targetDefinition.minRaiders + " 名抢掠兵或战争头目。");
            return false;
        }

        // Goblin[] 本次掠夺队伍：重新选择当前最强的指定人数。
        var raidParty = getAvailableRaiders(state).slice(0, preview.raiderCount);

        // boolean 是否成功：按预览成功率随机结算。
        var isSuccess = Math.random() < preview.successChance;

        game.diplomacy.applyRaidPenalty(state, targetDefinition.factionId, preview.relationPenalty);
        applyRaidCasualties(state, targetDefinition, raidParty, isSuccess ? preview.casualtyChance * 0.35 : preview.casualtyChance, preview.deathChance);

        if (isSuccess) {
            applyRaidSuccess(state, targetDefinition, preview.lootRatio, preview);
        } else {
            applyRaidFailure(state, targetDefinition, preview);
        }

        return true;
    }

    /**
     * 取得当前可派出的战斗职业哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Goblin[]} 可派出哥布林数组，按掠夺强度从高到低排序。
     */
    function getAvailableRaiders(state) {
        // Goblin[] 可派出哥布林列表：收集抢掠兵和战争头目。
        var availableRaiders = [];

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于检查是否属于战斗职业。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && RAID_JOB_IDS.indexOf(goblin.jobId) !== -1) {
                availableRaiders.push(goblin);
            }
        }

        availableRaiders.sort(compareRaidersByStrength);
        return availableRaiders;
    }

    /**
     * 按掠夺强度降序比较两个哥布林。
     *
     * @param {Goblin} leftGoblin - 左侧哥布林对象，不会被修改。
     * @param {Goblin} rightGoblin - 右侧哥布林对象，不会被修改。
     * @returns {number} 排序比较值；负数表示 left 应排在前面。
     */
    function compareRaidersByStrength(leftGoblin, rightGoblin) {
        return calculateGoblinRaidStrength(rightGoblin) - calculateGoblinRaidStrength(leftGoblin);
    }

    /**
     * 规范化玩家输入的派出人数。
     *
     * @param {number|undefined} requestedRaiderCount - 玩家输入人数，可能为空或非法。
     * @param {number} fallbackCount - 默认派出人数，正整数。
     * @returns {number} 规范化后的正整数派出人数。
     */
    function normalizeRaiderCount(requestedRaiderCount, fallbackCount) {
        // number 数值化派出人数：非法输入按默认人数处理。
        var numericCount = Number(requestedRaiderCount);

        if (!Number.isFinite(numericCount) || numericCount <= 0) {
            return Math.max(1, Math.floor(fallbackCount));
        }

        return Math.max(1, Math.floor(numericCount));
    }

    /**
     * 计算掠夺队伍基础强度。
     *
     * @param {Goblin[]} raidParty - 本次派出的战斗职业哥布林数组。
     * @returns {number} 队伍基础强度，非负浮点数。
     */
    function calculateRaidPartyBaseStrength(raidParty) {
        // number 队伍强度总和：逐个累加哥布林个人掠夺强度。
        var teamStrength = 0;

        // number 循环索引：遍历掠夺队伍数组的整数下标。
        for (var memberIndex = 0; memberIndex < raidParty.length; memberIndex += 1) {
            // Goblin 当前队员：用于累加个人强度。
            var raidMember = raidParty[memberIndex];

            teamStrength += calculateGoblinRaidStrength(raidMember);
        }

        return teamStrength;
    }

    /**
     * 计算单个哥布林的掠夺强度。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @returns {number} 个人掠夺强度，非负浮点数。
     */
    function calculateGoblinRaidStrength(goblin) {
        // number 属性强度：强壮、狡诈、灵巧和意志共同决定战斗表现。
        var attributeStrength = (goblin.attributes.strength || 0) * 1.2 + (goblin.attributes.cunning || 0) * 0.9 + (goblin.attributes.dexterity || 0) * 0.6 + (goblin.attributes.will || 0) * 0.4;

        // number 技能强度：掠夺经验提供温和加成，避免老兵完全碾压数值曲线。
        var skillStrength = Math.min(8, (goblin.skills.raiding || 0) / 150);

        // number 职业强度：战争头目比普通抢掠兵更适合带队。
        var jobStrength = goblin.jobId === "war_chief" ? 5 : 2;

        // number 伤病惩罚倍率：伤越多越不适合出击，最低保留一半能力。
        var woundMultiplier = Math.max(0.5, 1 - goblin.wounds.length * 0.1);

        return (attributeStrength + skillStrength + jobStrength) * woundMultiplier;
    }

    /**
     * 计算掠夺队伍强度倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin[]} raidParty - 本次派出的战斗职业哥布林数组。
     * @returns {number} 队伍强度加成比例，可为负数。
     */
    function calculateRaidStrengthRatio(state, raidParty) {
        // Object.<string, number> 政策效果字典：读取掠夺队伍强度修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：读取战争契约强度修正。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 建筑强度倍率：训练坑、兵器坊和战争营地等建筑提供。
        var buildingRatio = getOwnedRaidStrengthRatio(state);

        // number 装备强度倍率：战旗等可制作资源和旧存档兼容值提供。
        var equipmentRatio = (state.statistics.raidStrengthRatio || 0) + (state.statistics.raidLegacyStrengthRatio || 0);

        // number 领袖强度倍率：领袖亲自出战时提升队伍组织度。
        var leaderRatio = hasLeaderInRaidParty(state, raidParty) ? 0.05 : 0;

        return buildingRatio + equipmentRatio + (policyEffects.raidStrengthRatio || 0) + (pactEffects.raidStrengthRatio || 0) + leaderRatio;
    }

    /**
     * 汇总建筑提供的掠夺队伍强度倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 建筑强度加成比例，非负或有符号浮点数。
     */
    function getOwnedRaidStrengthRatio(state) {
        // number 强度倍率总和：按已拥有建筑数量累加。
        var strengthRatio = 0;

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取掠夺强度效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (buildingState && buildingDefinition.effects.raidStrengthRatio) {
                strengthRatio += buildingDefinition.effects.raidStrengthRatio * buildingState.owned;
            }
        }

        return strengthRatio;
    }

    /**
     * 判断领袖是否在本次掠夺队伍中。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin[]} raidParty - 本次派出的战斗职业哥布林数组。
     * @returns {boolean} 是否包含当前领袖；true 表示领袖亲自出战。
     */
    function hasLeaderInRaidParty(state, raidParty) {
        if (!state.leaderGoblinId) {
            return false;
        }

        // number 循环索引：遍历掠夺队伍数组的整数下标。
        for (var memberIndex = 0; memberIndex < raidParty.length; memberIndex += 1) {
            // Goblin 当前队员：用于匹配领袖 ID。
            var raidMember = raidParty[memberIndex];

            if (raidMember.id === state.leaderGoblinId) {
                return true;
            }
        }

        return false;
    }

    /**
     * 应用掠夺成功结果。
     *
     * @param {GameState} state - 当前游戏状态对象，会增加资源和可能增加俘虏。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {number} lootRatio - 战利品收益修正比例，可为负数。
     * @param {Object.<string, number|string|boolean|Price[]|Object>} preview - 本次掠夺预览摘要。
     * @returns {void} 无返回值。
     */
    function applyRaidSuccess(state, targetDefinition, lootRatio, preview) {
        // string[] 奖励资源 ID 数组：用于遍历奖励字典。
        var rewardResourceIds = Object.keys(targetDefinition.rewards);

        // number 循环索引：遍历奖励资源 ID 数组的整数下标。
        for (var rewardIndex = 0; rewardIndex < rewardResourceIds.length; rewardIndex += 1) {
            // ResourceId 当前奖励资源 ID：用于发放资源。
            var resourceId = rewardResourceIds[rewardIndex];

            // number 奖励数量：战利品可被政策修正，其他资源保持定义值。
            var rewardAmount = targetDefinition.rewards[resourceId] * (resourceId === "loot" ? Math.max(0, 1 + lootRatio) : 1);

            game.resources.addResource(state, resourceId, rewardAmount);
        }

        addRaidCaptive(state, targetDefinition);
        game.simulation.addLog(state, "important", "掠夺成功：" + targetDefinition.name + "，派出 " + preview.raiderCount + " 名战斗哥布林，队伍强度 " + preview.teamStrength.toFixed(1) + "。");
    }

    /**
     * 应用掠夺失败结果。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入失败日志。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {Object.<string, number|string|boolean|Price[]|Object>} preview - 本次掠夺预览摘要。
     * @returns {void} 无返回值。
     */
    function applyRaidFailure(state, targetDefinition, preview) {
        game.simulation.addLog(state, "warning", "掠夺失败：" + targetDefinition.name + "，派出 " + preview.raiderCount + " 名战斗哥布林，队伍强度 " + preview.teamStrength.toFixed(1) + "，关系下降。");
    }

    /**
     * 应用掠夺伤亡。
     *
     * @param {GameState} state - 当前游戏状态对象，可能修改哥布林伤病或存活状态。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象，用于日志。
     * @param {Goblin[]} raidParty - 本次派出的战斗职业哥布林数组。
     * @param {number} casualtyChance - 单个队员伤亡判定概率，范围 0-1。
     * @param {number} deathChance - 发生伤亡后转为死亡的概率，范围 0-1。
     * @returns {void} 无返回值。
     */
    function applyRaidCasualties(state, targetDefinition, raidParty, casualtyChance, deathChance) {
        // number 伤亡人数：统计本次受伤或死亡队员数量。
        var casualtyCount = 0;

        // number 死亡人数：统计本次死亡队员数量。
        var deathCount = 0;

        // number 循环索引：遍历掠夺队伍数组的整数下标。
        for (var memberIndex = 0; memberIndex < raidParty.length; memberIndex += 1) {
            // Goblin 当前队员：用于进行伤亡判定。
            var raidMember = raidParty[memberIndex];

            if (Math.random() >= casualtyChance) {
                continue;
            }

            casualtyCount += 1;

            if (Math.random() < deathChance) {
                raidMember.isAlive = false;
                raidMember.jobId = undefined;
                deathCount += 1;
                game.simulation.addLog(state, "warning", "掠夺伤亡：" + raidMember.name + " 死在 " + targetDefinition.name + "。");
            } else {
                raidMember.wounds.push("raid_wound");
                game.simulation.addLog(state, "warning", "掠夺伤亡：" + raidMember.name + " 在 " + targetDefinition.name + " 受伤。");
            }
        }

        if (casualtyCount > 0) {
            game.simulation.addLog(state, "warning", "掠夺伤亡合计：" + casualtyCount + " 名，死亡 " + deathCount + " 名。");
        }
    }

    /**
     * 添加掠夺俘虏。
     *
     * @param {GameState} state - 当前游戏状态对象，会追加俘虏。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @returns {void} 无返回值。
     */
    function addRaidCaptive(state, targetDefinition) {
        // string 俘虏类型 ID：从目标允许类型中选第一个，后续可替换为质量范围随机。
        var captiveTypeId = targetDefinition.captiveTypes[0] || "laborer";

        state.captives.push(game.captivesSystem.createCaptive(captiveTypeId, "common", targetDefinition.id));
        game.captivesSystem.syncCaptiveResource(state);
    }

    // Object 掠夺系统命名空间：提供目标查询、预览和执行函数。
    game.raids = {
        getRaidTargetDefinition: getRaidTargetDefinition,
        previewRaid: previewRaid,
        executeRaid: executeRaid,
        getAvailableRaiders: getAvailableRaiders
    };
})(window.GoblinEmpire);
