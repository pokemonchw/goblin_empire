/* 挑战系统：负责新局挑战选择、规则约束和跨局奖励。 */
/**
 * 初始化挑战系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 challengesSystem 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // string[] 矿物产出资源列表：贫矿层降低这些资源的获得量。
    var MINERAL_OUTPUT_RESOURCE_IDS = [
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

    /**
     * 取得挑战定义。
     *
     * @param {string} challengeId - 挑战稳定 ID。
     * @returns {ChallengeDefinition|null} 挑战定义；未找到时返回 null。
     */
    function getChallengeDefinition(challengeId) {
        // number 循环索引：遍历挑战定义数组的整数下标。
        for (var challengeIndex = 0; challengeIndex < game.definitions.CHALLENGE_DEFINITIONS.length; challengeIndex += 1) {
            // ChallengeDefinition 当前挑战定义：用于匹配挑战 ID。
            var challengeDefinition = game.definitions.CHALLENGE_DEFINITIONS[challengeIndex];

            if (challengeDefinition.id === challengeId) {
                return challengeDefinition;
            }
        }

        return null;
    }

    /**
     * 判断当前是否是可选择挑战的新局。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否为新局；true 表示尚未产生实质进度。
     */
    function isFreshRun(state) {
        if (state.challenges.activeChallengeId || game.population.countAliveGoblins(state) > 0) {
            return false;
        }

        // string[] 资源 ID 数组：用于检查是否已有普通资源进度。
        var resourceIds = Object.keys(state.resourcesById);

        // number 资源循环索引：遍历资源 ID 数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // string 资源 ID：用于读取资源状态。
            var resourceId = resourceIds[resourceIndex];

            // ResourceDefinition|null 当前资源定义：用于区分开局基线库存与玩家取得的额外进度。
            var resourceDefinition = game.definitions.RESOURCE_DEFINITIONS.find(function (candidateDefinition) {
                return candidateDefinition.id === resourceId;
            }) || null;

            // number 开局资源基线：定义自带库存不代表玩家已经开始推进，单位为非负资源数量。
            var initialResourceValue = resourceDefinition ? Number(resourceDefinition.initialValue) || 0 : 0;

            // 俘虏库存是开局俘虏的派生投影；跨局资源和定义基线库存同样不能被误判为本局进度。
            if (state.resourcesById[resourceId].value > initialResourceValue && resourceId !== "captive" && resourceId !== "prestige" && resourceId !== "imperialLegacy" && resourceId !== "ancestralEcho") {
                return false;
            }
        }

        // string[] 建筑 ID 数组：用于检查是否已有建筑进度。
        var buildingIds = Object.keys(state.buildingsById);

        // number 建筑循环索引：遍历建筑 ID 数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < buildingIds.length; buildingIndex += 1) {
            // string 建筑 ID：用于读取建筑状态。
            var buildingId = buildingIds[buildingIndex];

            if (state.buildingsById[buildingId].owned > 0) {
                return false;
            }
        }

        // string[] 科技 ID 数组：用于检查是否已有研究进度。
        var technologyIds = Object.keys(state.technologiesById);

        // number 科技循环索引：遍历科技 ID 数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < technologyIds.length; technologyIndex += 1) {
            // string 科技 ID：用于读取科技状态。
            var technologyId = technologyIds[technologyIndex];

            if (state.technologiesById[technologyId].isResearched) {
                return false;
            }
        }

        return true;
    }

    /**
     * 判断新局模式入口是否仍可选择。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否可选择模式；true 表示尚未选择正常或挑战模式。
     */
    function isRunModeSelectionOpen(state) {
        return isFreshRun(state) && (!state.challenges.runMode || state.challenges.runMode === "undecided");
    }

    /**
     * 为新局选择正常模式。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入 runMode。
     * @returns {boolean} 是否选择成功；true 表示本局已明确进入正常模式。
     */
    function selectNormalModeForNewRun(state) {
        if (state.isPaused || !isRunModeSelectionOpen(state)) {
            return false;
        }

        state.challenges.runMode = "normal";
        game.simulation.addLog(state, "important", "开始正常模式。");
        return true;
    }

    /**
     * 为新局选择挑战。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入 activeChallengeId。
     * @param {string} challengeId - 挑战稳定 ID。
     * @returns {boolean} 是否选择成功；true 表示挑战已写入存档状态。
     */
    function selectChallengeForNewRun(state, challengeId) {
        if (state.isPaused || !isRunModeSelectionOpen(state) || !getChallengeDefinition(challengeId)) {
            return false;
        }

        state.challenges.runMode = "challenge";
        state.challenges.activeChallengeId = challengeId;
        applyChallengeStateEffects(state);
        game.simulation.addLog(state, "important", "选择挑战：" + getChallengeDefinition(challengeId).name + "。");
        return true;
    }

    /**
     * 完成当前挑战并写入永久标记。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入完成字典和统计标记。
     * @returns {boolean} 是否完成成功；true 表示存在活动挑战并已标记完成。
     */
    function completeActiveChallenge(state) {
        if (!state.challenges.activeChallengeId) {
            return false;
        }

        // string 挑战 ID：用于写入永久完成标记。
        var challengeId = state.challenges.activeChallengeId;

        state.challenges.completedById[challengeId] = true;
        state.statistics["challengeCompleted_" + challengeId] = 1;
        game.simulation.addLog(state, "important", "挑战完成：" + getChallengeDefinition(challengeId).name + "。");
        return true;
    }

    /**
     * 汇总当前活动挑战规则效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, number>} 挑战规则效果字典。
     */
    function getRuleEffects(state) {
        // Object.<string, number> 规则效果字典：没有活动挑战时为空。
        var ruleEffects = {};

        // ChallengeDefinition|null 挑战定义：用于读取活动规则。
        var challengeDefinition = getChallengeDefinition(state.challenges.activeChallengeId);

        if (!challengeDefinition) {
            return ruleEffects;
        }

        return Object.assign(ruleEffects, challengeDefinition.ruleEffects);
    }

    /**
     * 汇总已完成挑战奖励效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, number>} 挑战奖励效果字典。
     */
    function getRewardEffects(state) {
        // Object.<string, number> 奖励效果汇总字典：按效果 ID 累加已完成挑战。
        var rewardEffects = {};

        // number 循环索引：遍历挑战定义数组的整数下标。
        for (var challengeIndex = 0; challengeIndex < game.definitions.CHALLENGE_DEFINITIONS.length; challengeIndex += 1) {
            // ChallengeDefinition 当前挑战定义：用于判断是否已完成。
            var challengeDefinition = game.definitions.CHALLENGE_DEFINITIONS[challengeIndex];

            if (!state.challenges.completedById[challengeDefinition.id] && !state.statistics["challengeCompleted_" + challengeDefinition.id]) {
                continue;
            }

            // string[] 效果 ID 数组：遍历奖励效果字段。
            var effectIds = Object.keys(challengeDefinition.rewardEffects);

            // number 效果循环索引：遍历效果 ID 数组的整数下标。
            for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
                // string 效果 ID：用于累加同名效果。
                var effectId = effectIds[effectIndex];

                rewardEffects[effectId] = (rewardEffects[effectId] || 0) + challengeDefinition.rewardEffects[effectId];
            }
        }

        return rewardEffects;
    }

    /**
     * 读取资源获得倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {number} 资源获得倍率，至少为 0。
     */
    function getResourceGainMultiplier(state, resourceId) {
        // Object.<string, number> 规则效果字典：用于当前挑战惩罚。
        var ruleEffects = getRuleEffects(state);

        // Object.<string, number> 奖励效果字典：用于已完成挑战奖励。
        var rewardEffects = getRewardEffects(state);

        // number 资源倍率：按挑战规则和奖励累加后钳制。
        var resourceMultiplier = 1;

        if (resourceId === "fungus") {
            resourceMultiplier += ruleEffects.fungusOutputRatio || 0;
            resourceMultiplier += rewardEffects.foodBuildingOutputRatio || 0;
        }

        if (MINERAL_OUTPUT_RESOURCE_IDS.indexOf(resourceId) !== -1) {
            resourceMultiplier += ruleEffects.mineralOutputRatio || 0;
            resourceMultiplier += rewardEffects.storageAndProcessingRatio || 0;
        }

        if (resourceId === "crudeKnowledge") {
            resourceMultiplier += rewardEffects.researchOutputRatio || 0;
        }

        if (resourceId === "obedience") {
            resourceMultiplier += rewardEffects.obedienceBuildingOutputRatio || 0;
        }

        if (resourceId === "loot") {
            resourceMultiplier += rewardEffects.raidLootRatio || 0;
        }

        if (isRitualAndAbyssDisabled(state) && (resourceId === "ancestralEcho" || resourceId === "abyssEcho" || resourceId === "relic" || resourceId === "riftShard")) {
            resourceMultiplier = 0;
        }

        return Math.max(0, resourceMultiplier);
    }

    /**
     * 判断贸易是否被挑战禁用。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否禁用贸易；true 表示普通贸易入口不可执行。
     */
    function isTradeDisabled(state) {
        return Boolean(getRuleEffects(state).isTradeDisabled);
    }

    /**
     * 判断祖灵和深渊系统是否被挑战禁用。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否禁用祖灵和深渊系统。
     */
    function isRitualAndAbyssDisabled(state) {
        return Boolean(getRuleEffects(state).isRitualAndAbyssDisabled);
    }

    /**
     * 应用挑战带来的运行时状态效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会调整服从容量等状态。
     * @returns {void} 无返回值。
     */
    function applyChallengeStateEffects(state) {
        // Object.<string, number> 规则效果字典：用于服从上限挑战。
        var ruleEffects = getRuleEffects(state);

        if (ruleEffects.obedienceMaxRatio && state.resourcesById.obedience) {
            state.resourcesById.obedience.maxValue *= Math.max(0, 1 + ruleEffects.obedienceMaxRatio);
            state.resourcesById.obedience.value = Math.min(state.resourcesById.obedience.value, state.resourcesById.obedience.maxValue);
        }
    }

    // Object 挑战系统命名空间：提供选择、完成、规则和奖励接口。
    game.challengesSystem = {
        getChallengeDefinition: getChallengeDefinition,
        isFreshRun: isFreshRun,
        isRunModeSelectionOpen: isRunModeSelectionOpen,
        selectNormalModeForNewRun: selectNormalModeForNewRun,
        selectChallengeForNewRun: selectChallengeForNewRun,
        completeActiveChallenge: completeActiveChallenge,
        getRuleEffects: getRuleEffects,
        getRewardEffects: getRewardEffects,
        getResourceGainMultiplier: getResourceGainMultiplier,
        isTradeDisabled: isTradeDisabled,
        isRitualAndAbyssDisabled: isRitualAndAbyssDisabled,
        applyChallengeStateEffects: applyChallengeStateEffects
    };
})(window.GoblinEmpire);
