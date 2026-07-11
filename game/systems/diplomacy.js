/* 外交系统：负责阵营关系、贸易预览和贸易执行。 */
/**
 * 初始化外交系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 diplomacy 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 取得阵营定义。
     *
     * @param {string} factionId - 阵营稳定 ID。
     * @returns {FactionTradeDefinition|null} 阵营定义；未找到时返回 null。
     */
    function getFactionDefinition(factionId) {
        // number 循环索引：遍历阵营定义数组的整数下标。
        for (var factionIndex = 0; factionIndex < game.definitions.FACTION_DEFINITIONS.length; factionIndex += 1) {
            // FactionTradeDefinition 当前阵营定义：用于匹配阵营 ID。
            var factionDefinition = game.definitions.FACTION_DEFINITIONS[factionIndex];

            if (factionDefinition.id === factionId) {
                return factionDefinition;
            }
        }

        return null;
    }

    /**
     * 读取阵营关系。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} factionId - 阵营稳定 ID。
     * @returns {number} 阵营关系值，范围建议 -100 到 100。
     */
    function getRelation(state, factionId) {
        return state.statistics[getRelationKey(factionId)] || 0;
    }

    /**
     * 修改阵营关系。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} factionId - 阵营稳定 ID。
     * @param {number} relationDelta - 关系变化值，有符号数。
     * @returns {number} 修改后的关系值。
     */
    function applyRelationChange(state, factionId, relationDelta) {
        // string 关系统计键：用于保存该阵营关系。
        var relationKey = getRelationKey(factionId);

        state.statistics[relationKey] = Math.max(-100, Math.min(100, getRelation(state, factionId) + relationDelta));
        return state.statistics[relationKey];
    }

    /**
     * 预览贸易收益和关系影响。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} factionId - 阵营稳定 ID。
     * @returns {Object.<string, number|string|boolean|Price[]>} 贸易预览对象。
     */
    function previewTrade(state, factionId) {
        // FactionTradeDefinition|null 阵营定义：用于读取贸易参数。
        var factionDefinition = getFactionDefinition(factionId);

        if (!factionDefinition) {
            return {};
        }

        // number 关系倍率：关系越高收益越好，低关系会压低收益。
        var relationMultiplier = 1 + getRelation(state, factionId) / 200;

        // Object.<string, number> 政策效果字典：读取贸易收益和关系变化修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：战争契约会压低贸易收益。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 贸易倍率：由统计加成和政策收益共同修正。
        var tradeMultiplier = 1 + (state.statistics.tradeRatio || 0) + (policyEffects.tradeRewardRatio || 0) + (pactEffects.tradeRewardRatio || 0);

        // number 使馆倍率：后续使馆等级可写入 statistics.embassyRatio。
        var embassyMultiplier = 1 + (state.statistics.embassyRatio || 0);

        // number 基础收益：应用贸易、关系和使馆倍率后的中心值。
        var expectedReward = factionDefinition.baseReward * tradeMultiplier * relationMultiplier * embassyMultiplier;

        // number 最小收益：显示给玩家的波动下限。
        var minReward = Math.max(0, expectedReward * (1 - factionDefinition.randomWidth));

        // number 最大收益：显示给玩家的波动上限。
        var maxReward = expectedReward * (1 + factionDefinition.randomWidth);

        // ResourceState|null 善名资源状态：用于判断高级势力贸易门槛。
        var goodwillState = state.resourcesById.goodwill || null;

        // number 当前善名：未解锁或旧存档缺失时按 0 处理。
        var goodwillAmount = goodwillState ? goodwillState.value : 0;

        // number 善名门槛：高阶势力要求更高信誉才允许交易。
        var requiredGoodwill = factionDefinition.requiredGoodwill || 0;

        return {
            cost: factionDefinition.cost,
            rewardResource: factionDefinition.rewardResource,
            minReward: minReward,
            maxReward: maxReward,
            relationChange: factionDefinition.relationChange + (policyEffects.tradeRelationBonus || 0),
            goodwillReward: factionDefinition.goodwillReward || 0,
            requiredGoodwill: requiredGoodwill,
            goodwillAmount: goodwillAmount,
            canTradeByGoodwill: goodwillAmount >= requiredGoodwill,
            distanceSeconds: factionDefinition.distanceSeconds || 0,
            successChance: 1
        };
    }

    /**
     * 发起贸易行动，扣除成本并等待贸易队按距离返程后结算。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} factionId - 阵营稳定 ID。
     * @returns {boolean} 是否发起成功；true 表示已扣成本并加入在途贸易队。
     */
    function executeTrade(state, factionId) {
        if (state.isPaused || (game.challengesSystem && game.challengesSystem.isTradeDisabled(state))) {
            return false;
        }

        // FactionTradeDefinition|null 阵营定义：用于读取成本和收益。
        var factionDefinition = getFactionDefinition(factionId);

        if (!factionDefinition) {
            return false;
        }

        // Object.<string, number|string|boolean|Price[]> 贸易预览：用于确定收益范围和善名门槛。
        var preview = previewTrade(state, factionId);

        if (!preview.canTradeByGoodwill) {
            game.simulation.addLog(state, "warning", "善名不足：与" + factionDefinition.name + "交易需要善名 " + preview.requiredGoodwill + "。");
            return false;
        }

        if (!game.resources.spendResources(state, factionDefinition.cost)) {
            return false;
        }

        // DiplomacyMissionState 贸易行动状态：保存返程倒计时和发起时冻结的结算数值。
        var mission = {
            id: createMissionId("trade", factionDefinition.id),
            modeId: "trade",
            locationId: factionDefinition.id,
            factionId: factionDefinition.id,
            raiderIds: [],
            remainingSeconds: preview.distanceSeconds,
            totalSeconds: preview.distanceSeconds,
            resultSnapshot: {
                minReward: preview.minReward,
                maxReward: preview.maxReward,
                relationChange: preview.relationChange,
                goodwillReward: preview.goodwillReward
            }
        };

        if (!Array.isArray(state.activeDiplomacyMissions)) {
            state.activeDiplomacyMissions = [];
        }

        state.activeDiplomacyMissions.push(mission);
        game.simulation.addLog(state, "normal", "贸易队出发：" + factionDefinition.name + "，预计 " + Math.ceil(preview.distanceSeconds) + " 秒后返回。");
        return true;
    }

    /**
     * 推进在途外交和掠夺行动。
     *
     * @param {GameState} state - 当前游戏状态对象，会减少返程时间并结算完成行动。
     * @param {number} deltaSeconds - 本次推进的真实秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function updateDiplomacyMissions(state, deltaSeconds) {
        if (!Array.isArray(state.activeDiplomacyMissions) || state.activeDiplomacyMissions.length <= 0) {
            return;
        }

        // DiplomacyMissionState[] 仍在途行动数组：结算完成后保留未完成行动。
        var remainingMissions = [];

        // number 循环索引：遍历在途行动数组的整数下标。
        for (var missionIndex = 0; missionIndex < state.activeDiplomacyMissions.length; missionIndex += 1) {
            // DiplomacyMissionState 当前行动：用于扣减倒计时和按类型结算。
            var mission = state.activeDiplomacyMissions[missionIndex];

            mission.remainingSeconds = Math.max(0, mission.remainingSeconds - deltaSeconds);

            if (mission.remainingSeconds > 0) {
                remainingMissions.push(mission);
                continue;
            }

            resolveDiplomacyMission(state, mission);
        }

        state.activeDiplomacyMissions = remainingMissions;
    }

    /**
     * 结算单个完成返程的外交行动。
     *
     * @param {GameState} state - 当前游戏状态对象，会获得收益、改变声名或调用掠夺结算。
     * @param {DiplomacyMissionState} mission - 已完成返程的外交行动。
     * @returns {void} 无返回值。
     */
    function resolveDiplomacyMission(state, mission) {
        if (mission.modeId === "raid" && game.raids && game.raids.resolveRaidMission) {
            game.raids.resolveRaidMission(state, mission);
            return;
        }

        if (mission.modeId === "trade") {
            resolveTradeMission(state, mission);
        }
    }

    /**
     * 结算完成返程的贸易行动。
     *
     * @param {GameState} state - 当前游戏状态对象，会发放贸易收益和善名。
     * @param {DiplomacyMissionState} mission - 已完成返程的贸易行动。
     * @returns {void} 无返回值。
     */
    function resolveTradeMission(state, mission) {
        // FactionTradeDefinition|null 阵营定义：用于读取收益资源和中文名称。
        var factionDefinition = getFactionDefinition(mission.locationId);

        if (!factionDefinition) {
            game.simulation.addLog(state, "warning", "贸易队返程失败：未知势力 " + mission.locationId + "。");
            return;
        }

        // Object.<string, number> 结算快照：使用出发时冻结的收益和关系数值。
        var resultSnapshot = mission.resultSnapshot || {};

        // number 最小收益：贸易出发时计算的收益波动下限。
        var minReward = Number(resultSnapshot.minReward) || 0;

        // number 最大收益：贸易出发时计算的收益波动上限。
        var maxReward = Number(resultSnapshot.maxReward) || minReward;

        // number 实际收益：在冻结预览区间内随机波动。
        var rewardAmount = minReward + Math.random() * Math.max(0, maxReward - minReward);

        // number 善名奖励：交易成功后写入善名资源。
        var goodwillReward = Number(resultSnapshot.goodwillReward) || 0;

        // number 关系变化：交易成功后写入势力关系。
        var relationChange = Number(resultSnapshot.relationChange) || 0;

        game.resources.addResource(state, factionDefinition.rewardResource, rewardAmount);
        game.resources.changeResource(state, "goodwill", goodwillReward);
        applyRelationChange(state, factionDefinition.id, relationChange);
        game.simulation.addLog(state, "normal", "贸易队返回：" + factionDefinition.name + "，获得 " + rewardAmount.toFixed(1) + "，善名 +" + goodwillReward + "。");
    }

    /**
     * 统计指定地点当前在途行动数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {"trade"|"raid"} modeId - 行动类型 ID。
     * @param {string} locationId - 贸易阵营 ID 或掠夺目标 ID。
     * @returns {number} 当前在途行动数量，非负整数。
     */
    function countActiveMissionsForLocation(state, modeId, locationId) {
        if (!Array.isArray(state.activeDiplomacyMissions)) {
            return 0;
        }

        // number 在途数量：统计同类型同地点尚未返程的行动。
        var activeMissionCount = 0;

        // number 循环索引：遍历在途行动数组的整数下标。
        for (var missionIndex = 0; missionIndex < state.activeDiplomacyMissions.length; missionIndex += 1) {
            // DiplomacyMissionState 当前行动：用于匹配类型和地点。
            var mission = state.activeDiplomacyMissions[missionIndex];

            if (mission.modeId === modeId && mission.locationId === locationId) {
                activeMissionCount += 1;
            }
        }

        return activeMissionCount;
    }

    /**
     * 生成外交行动运行 ID。
     *
     * @param {string} modeId - 行动类型 ID。
     * @param {string} locationId - 地点稳定 ID。
     * @returns {string} 行动运行 ID，包含时间戳和随机片段。
     */
    function createMissionId(modeId, locationId) {
        return "mission_" + modeId + "_" + locationId + "_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    }

    /**
     * 应用掠夺关系惩罚。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} factionId - 阵营稳定 ID。
     * @param {number} penalty - 惩罚数值，非负数。
     * @returns {number} 修改后的关系值。
     */
    function applyRaidPenalty(state, factionId, penalty) {
        return applyRelationChange(state, factionId, -Math.abs(penalty));
    }

    /**
     * 取得关系统计键。
     *
     * @param {string} factionId - 阵营稳定 ID。
     * @returns {string} 关系统计键。
     */
    function getRelationKey(factionId) {
        return "relation_" + factionId;
    }

    // Object 外交系统命名空间：提供关系、贸易预览和执行函数。
    game.diplomacy = {
        getFactionDefinition: getFactionDefinition,
        getRelation: getRelation,
        applyRelationChange: applyRelationChange,
        previewTrade: previewTrade,
        executeTrade: executeTrade,
        updateDiplomacyMissions: updateDiplomacyMissions,
        countActiveMissionsForLocation: countActiveMissionsForLocation,
        createMissionId: createMissionId,
        applyRaidPenalty: applyRaidPenalty
    };
})(window.GoblinEmpire);
