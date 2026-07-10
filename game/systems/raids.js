/* 掠夺系统：负责军力目标、成功率、风险预览和执行结果。 */
/**
 * 初始化掠夺系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 raids 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
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
     * @returns {Object.<string, number|string|Price[]|Object>} 掠夺预览对象。
     */
    function previewRaid(state, targetId) {
        // RaidTargetDefinition|null 目标定义：用于读取防御、成本和奖励。
        var targetDefinition = getRaidTargetDefinition(targetId);

        if (!targetDefinition) {
            return {};
        }

        // number 当前军力：用于和目标防御比较。
        var militaryPower = state.resourcesById.militaryPower ? state.resourcesById.militaryPower.value : 0;

        // Object.<string, number> 政策效果字典：读取掠夺军力、战利品和关系代价修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 祖灵升级效果字典：读取战鼓回音等单局倍率。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 契约效果字典：战争契约提高掠夺能力。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 装备倍率：由工具、兵器、政策和后续升级共同修正。
        var equipmentRatio = (state.statistics.raidEquipmentRatio || 0) + (policyEffects.raidPowerRatio || 0) + (pactEffects.raidPowerRatio || 0);

        // number 头目倍率：有领袖时提供轻微加成。
        var leaderRatio = state.leaderGoblinId ? 0.05 : 0;

        // number 军力优势：当前军力乘倍率后减去目标防御。
        var powerAdvantage = militaryPower * (1 + equipmentRatio + leaderRatio) - targetDefinition.defense;

        // 成功率限制在 5%-95%，避免低级目标绝对安全或高级目标绝对不可能。
        var successChance = Math.max(0.05, Math.min(0.95, 0.5 + powerAdvantage / 100));

        return {
            cost: targetDefinition.cost,
            rewards: targetDefinition.rewards,
            lootRatio: (policyEffects.raidLootRatio || 0) + (ritualEffects.raidLootRatio || 0) + (pactEffects.raidLootRatio || 0),
            successChance: successChance,
            casualtyChance: Math.max(0.05, Math.min(0.5, 0.25 - powerAdvantage / 300 - (state.statistics.raidCasualtyReductionRatio || 0))),
            relationPenalty: Math.max(0, targetDefinition.relationPenalty * (1 + (policyEffects.raidRelationPenaltyRatio || 0))),
            retaliationChance: Math.min(0.75, Math.max(0, targetDefinition.relationPenalty * (1 + (policyEffects.raidRelationPenaltyRatio || 0))) / 100),
            captiveTypes: targetDefinition.captiveTypes.join(" / ")
        };
    }

    /**
     * 执行掠夺。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @returns {boolean} 是否执行成功；true 表示成本已支付且结果已结算。
     */
    function executeRaid(state, targetId) {
        if (state.isPaused) {
            return false;
        }

        // RaidTargetDefinition|null 目标定义：用于读取成本、收益和关系惩罚。
        var targetDefinition = getRaidTargetDefinition(targetId);

        if (!targetDefinition || !game.resources.spendResources(state, targetDefinition.cost)) {
            return false;
        }

        // Object.<string, number|string|Price[]|Object> 掠夺预览：用于本次成功率和风险。
        var preview = previewRaid(state, targetId);

        // boolean 是否成功：按成功率随机结算。
        var isSuccess = Math.random() < preview.successChance;

        game.diplomacy.applyRaidPenalty(state, targetDefinition.factionId, preview.relationPenalty);

        if (isSuccess) {
            applyRaidSuccess(state, targetDefinition, preview.lootRatio);
        } else {
            applyRaidFailure(state, targetDefinition, preview.casualtyChance);
        }

        return true;
    }

    /**
     * 应用掠夺成功结果。
     *
     * @param {GameState} state - 当前游戏状态对象，会增加资源和可能增加俘虏。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {number} lootRatio - 战利品收益修正比例，可为负数。
     * @returns {void} 无返回值。
     */
    function applyRaidSuccess(state, targetDefinition, lootRatio) {
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
        game.simulation.addLog(state, "important", "掠夺成功：" + targetDefinition.name + "，获得战利品并带回俘虏线索。");
    }

    /**
     * 应用掠夺失败结果。
     *
     * @param {GameState} state - 当前游戏状态对象，可能伤害具体哥布林。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {number} casualtyChance - 受伤概率，范围 0-1。
     * @returns {void} 无返回值。
     */
    function applyRaidFailure(state, targetDefinition, casualtyChance) {
        // Goblin|null 受伤哥布林：优先选择抢掠兵。
        var woundedGoblin = findRaider(state);

        if (woundedGoblin && Math.random() < casualtyChance) {
            woundedGoblin.wounds.push("raid_wound");
            game.simulation.addLog(state, "warning", "掠夺失败：" + targetDefinition.name + "，" + woundedGoblin.name + " 受伤，关系下降。");
            return;
        }

        game.simulation.addLog(state, "warning", "掠夺失败：" + targetDefinition.name + "，队伍空手而归，关系下降。");
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

    /**
     * 查找抢掠兵。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Goblin|null} 找到的抢掠兵；没有时返回任一存活哥布林或 null。
     */
    function findRaider(state) {
        // Goblin|null 备用哥布林：没有抢掠兵时用于承受失败风险。
        var fallbackGoblin = null;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于查找抢掠兵。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive) {
                continue;
            }

            if (!fallbackGoblin) {
                fallbackGoblin = goblin;
            }

            if (goblin.jobId === "raider") {
                return goblin;
            }
        }

        return fallbackGoblin;
    }

    // Object 掠夺系统命名空间：提供目标查询、预览和执行函数。
    game.raids = {
        getRaidTargetDefinition: getRaidTargetDefinition,
        previewRaid: previewRaid,
        executeRaid: executeRaid
    };
})(window.GoblinEmpire);
