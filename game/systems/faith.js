/* 信仰系统：负责哥布林祖灵信仰、俘虏随机信仰和信仰显示名称。 */
/**
 * 初始化信仰系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 faithSystem 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // string 哥布林祖灵信仰 ID：祖灵祭坛建立后写入哥布林个体。
    var GOBLIN_ANCESTOR_FAITH_ID = "goblin_ancestor";

    // number 俘虏有信仰概率：0-1 浮点比例；未命中时 faithId 为 null。
    var CAPTIVE_HAS_FAITH_RATIO = 0.7;

    // number 种族主信仰权重：让不同种族明显倾向自己的主要信仰。
    var PRIMARY_FAITH_WEIGHT = 8;

    // number 次要信仰权重：允许少量俘虏信仰其他非祖灵神灵。
    var SECONDARY_FAITH_WEIGHT = 1;

    /**
     * 取得信仰定义。
     *
     * @param {string|null|undefined} faithId - 信仰稳定 ID；null 或 undefined 表示无信仰。
     * @returns {FaithDefinition|null} 信仰定义；无信仰或找不到时返回 null。
     */
    function getFaithDefinition(faithId) {
        if (!faithId || !Array.isArray(game.definitions.FAITH_DEFINITIONS)) {
            return null;
        }

        // number 循环索引：遍历信仰定义数组的整数下标。
        for (var faithIndex = 0; faithIndex < game.definitions.FAITH_DEFINITIONS.length; faithIndex += 1) {
            // FaithDefinition 当前信仰定义：用于匹配稳定 ID。
            var faithDefinition = game.definitions.FAITH_DEFINITIONS[faithIndex];

            if (faithDefinition.id === faithId) {
                return faithDefinition;
            }
        }

        return null;
    }

    /**
     * 格式化信仰名称。
     *
     * @param {string|null|undefined} faithId - 信仰稳定 ID；null 或 undefined 表示无信仰。
     * @returns {string} 信仰中文名称；未知 ID 会显示为未知信仰。
     */
    function formatFaithName(faithId) {
        // FaithDefinition|null 信仰定义：用于读取中文名。
        var faithDefinition = getFaithDefinition(faithId);

        if (faithDefinition) {
            return faithDefinition.name;
        }

        return faithId ? "未知信仰" : "无信仰";
    }

    /**
     * 为新俘虏随机生成信仰。
     *
     * @param {string} raceId - 俘虏种族 ID；用于读取主要信仰。
     * @returns {string|null} 信仰 ID；null 表示无信仰。
     */
    function createRandomCaptiveFaithId(raceId) {
        if (Math.random() >= CAPTIVE_HAS_FAITH_RATIO) {
            return null;
        }

        // CaptiveRaceDefinition|null 种族定义：用于读取该种族主要信仰。
        var raceDefinition = getCaptiveRaceDefinition(raceId);

        // string 主要信仰 ID：缺失或未知时退回丰饶信仰。
        var primaryFaithId = raceDefinition && getFaithDefinition(raceDefinition.primaryFaithId) ? raceDefinition.primaryFaithId : "green_sun";

        return selectWeightedFaithId(primaryFaithId);
    }

    /**
     * 规范化旧存档或外部生成的俘虏信仰字段。
     *
     * @param {CaptiveState} captive - 俘虏对象，会在缺失 faithId 字段时补随机信仰。
     * @returns {void} 无返回值。
     */
    function normalizeCaptiveFaith(captive) {
        if (Object.prototype.hasOwnProperty.call(captive, "faithId")) {
            captive.faithId = getFaithDefinition(captive.faithId) ? captive.faithId : null;
            return;
        }

        captive.faithId = createRandomCaptiveFaithId(captive.raceId);
    }

    /**
     * 规范化哥布林信仰字段。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin} goblin - 哥布林对象，会补齐 faithId 字段。
     * @returns {void} 无返回值。
     */
    function normalizeGoblinFaith(state, goblin) {
        if (getFaithDefinition(goblin.faithId)) {
            return;
        }

        goblin.faithId = hasAncestralAltar(state) ? GOBLIN_ANCESTOR_FAITH_ID : null;
    }

    /**
     * 祖灵祭坛建立后，把无信仰哥布林纳入哥布林祖灵信仰。
     *
     * @param {GameState} state - 当前游戏状态对象，会修改哥布林 faithId 字段。
     * @returns {number} 新纳入祖灵信仰的哥布林数量，非负整数。
     */
    function applyGoblinAncestorFaith(state) {
        // number 变更数量：用于日志和测试确认。
        var changedCount = 0;

        if (!Array.isArray(state.goblins)) {
            return changedCount;
        }

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林：祖灵祭坛建立后获得默认祖灵信仰。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.faithId) {
                goblin.faithId = GOBLIN_ANCESTOR_FAITH_ID;
                changedCount += 1;
            }
        }

        return changedCount;
    }

    /**
     * 判断祖灵祭坛是否已经建立。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否拥有至少 1 座祖灵祭坛。
     */
    function hasAncestralAltar(state) {
        // BuildingState|null 祖灵祭坛状态：用于判断哥布林是否已有祖灵信仰入口。
        var altarState = state.buildingsById && state.buildingsById.ancestral_altar ? state.buildingsById.ancestral_altar : null;

        return Boolean(altarState && altarState.owned > 0);
    }

    /**
     * 按种族主信仰权重抽取一个有信仰 ID。
     *
     * @param {string} primaryFaithId - 种族主要信仰 ID。
     * @returns {string} 抽中的信仰 ID；不会返回 none 或 goblin_ancestor。
     */
    function selectWeightedFaithId(primaryFaithId) {
        // WeightedId[] 信仰候选权重：主信仰高权重，其他非祖灵神灵低权重。
        var faithWeights = [];

        // number 循环索引：遍历信仰定义数组的整数下标。
        for (var faithIndex = 0; faithIndex < game.definitions.FAITH_DEFINITIONS.length; faithIndex += 1) {
            // FaithDefinition 当前信仰定义：用于构造随机候选。
            var faithDefinition = game.definitions.FAITH_DEFINITIONS[faithIndex];

            if (faithDefinition.id === "none" || faithDefinition.id === GOBLIN_ANCESTOR_FAITH_ID) {
                continue;
            }

            faithWeights.push({
                id: faithDefinition.id,
                weight: faithDefinition.id === primaryFaithId ? PRIMARY_FAITH_WEIGHT : SECONDARY_FAITH_WEIGHT
            });
        }

        return selectWeightedId(faithWeights, primaryFaithId);
    }

    /**
     * 从带权重 ID 数组中抽取一个 ID。
     *
     * @param {WeightedId[]} weightedIds - 权重项数组；weight 为非负浮点权重。
     * @param {string} fallbackId - 兜底稳定 ID。
     * @returns {string} 抽中的稳定 ID。
     */
    function selectWeightedId(weightedIds, fallbackId) {
        // number 总权重：只累加正数权重。
        var totalWeight = 0;

        // number 权重循环索引：遍历所有候选权重项的整数下标。
        for (var weightIndex = 0; weightIndex < weightedIds.length; weightIndex += 1) {
            // WeightedId 当前权重项：用于累加随机区间。
            var weightEntry = weightedIds[weightIndex];

            totalWeight += Math.max(0, Number(weightEntry.weight) || 0);
        }

        if (totalWeight <= 0) {
            return fallbackId;
        }

        // number 随机落点：范围为 0 到总权重的浮点数。
        var roll = Math.random() * totalWeight;

        // number 累计权重：用于判断随机落点落在哪个候选项。
        var cumulativeWeight = 0;

        // number 抽取循环索引：遍历候选项并返回命中的 ID。
        for (var selectionIndex = 0; selectionIndex < weightedIds.length; selectionIndex += 1) {
            // WeightedId 候选权重项：id 为返回值，weight 为占用区间宽度。
            var candidateEntry = weightedIds[selectionIndex];

            cumulativeWeight += Math.max(0, Number(candidateEntry.weight) || 0);
            if (roll < cumulativeWeight) {
                return candidateEntry.id;
            }
        }

        return fallbackId;
    }

    /**
     * 取得俘虏种族定义。
     *
     * @param {string} raceId - 俘虏种族稳定 ID。
     * @returns {CaptiveRaceDefinition|null} 种族定义；找不到时返回 null。
     */
    function getCaptiveRaceDefinition(raceId) {
        if (!Array.isArray(game.definitions.CAPTIVE_RACE_DEFINITIONS)) {
            return null;
        }

        // number 循环索引：遍历俘虏种族定义数组的整数下标。
        for (var raceIndex = 0; raceIndex < game.definitions.CAPTIVE_RACE_DEFINITIONS.length; raceIndex += 1) {
            // CaptiveRaceDefinition 当前种族定义：用于匹配种族 ID。
            var raceDefinition = game.definitions.CAPTIVE_RACE_DEFINITIONS[raceIndex];

            if (raceDefinition.id === raceId) {
                return raceDefinition;
            }
        }

        return null;
    }

    game.faithSystem = {
        getFaithDefinition: getFaithDefinition,
        formatFaithName: formatFaithName,
        createRandomCaptiveFaithId: createRandomCaptiveFaithId,
        normalizeCaptiveFaith: normalizeCaptiveFaith,
        normalizeGoblinFaith: normalizeGoblinFaith,
        applyGoblinAncestorFaith: applyGoblinAncestorFaith,
        hasAncestralAltar: hasAncestralAltar
    };
})(window.GoblinEmpire);
