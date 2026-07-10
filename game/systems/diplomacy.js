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
     * @returns {Object.<string, number|string|Price[]>} 贸易预览对象。
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

        return {
            cost: factionDefinition.cost,
            rewardResource: factionDefinition.rewardResource,
            minReward: minReward,
            maxReward: maxReward,
            relationChange: factionDefinition.relationChange + (policyEffects.tradeRelationBonus || 0),
            successChance: 1
        };
    }

    /**
     * 执行贸易。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} factionId - 阵营稳定 ID。
     * @returns {boolean} 是否执行成功；true 表示已扣成本、发放收益并改变关系。
     */
    function executeTrade(state, factionId) {
        if (state.isPaused || (game.challengesSystem && game.challengesSystem.isTradeDisabled(state))) {
            return false;
        }

        // FactionTradeDefinition|null 阵营定义：用于读取成本和收益。
        var factionDefinition = getFactionDefinition(factionId);

        if (!factionDefinition || !game.resources.spendResources(state, factionDefinition.cost)) {
            return false;
        }

        // Object.<string, number|string|Price[]> 贸易预览：用于确定收益范围。
        var preview = previewTrade(state, factionId);

        // number 实际收益：在预览区间内随机波动。
        var rewardAmount = preview.minReward + Math.random() * (preview.maxReward - preview.minReward);

        game.resources.addResource(state, factionDefinition.rewardResource, rewardAmount);
        applyRelationChange(state, factionId, preview.relationChange);
        game.simulation.addLog(state, "normal", "与" + factionDefinition.name + "交易，获得 " + rewardAmount.toFixed(1) + "。");
        return true;
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
        applyRaidPenalty: applyRaidPenalty
    };
})(window.GoblinEmpire);
