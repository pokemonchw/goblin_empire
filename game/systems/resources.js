/* 资源系统：负责资源增减、容量夹取、支付检查和首次显示。 */
/**
 * 初始化资源系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 resources 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 支付误差容差：价格指数和库存浮点运算允许的资源数量误差。
    var RESOURCE_PAYMENT_EPSILON = 0.000001;

    /**
     * 取得资源定义。
     *
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {ResourceDefinition|null} 资源定义；未找到时返回 null。
     */
    function getResourceDefinition(resourceId) {
        // number 循环索引：遍历资源定义数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < game.definitions.RESOURCE_DEFINITIONS.length; resourceIndex += 1) {
            // ResourceDefinition 当前资源定义：用于匹配资源 ID。
            var resourceDefinition = game.definitions.RESOURCE_DEFINITIONS[resourceIndex];

            if (resourceDefinition.id === resourceId) {
                return resourceDefinition;
            }
        }

        return null;
    }

    /**
     * 增加资源并按容量截断。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {number} amount - 增加数量，非负资源数量。
     * @returns {number} 实际增加的资源数量，范围为 0 到 amount。
     */
    function addResource(state, resourceId, amount) {
        // ResourceState 资源状态：用于写入数量和可见性。
        var resourceState = state.resourcesById[resourceId];

        // ResourceDefinition|null 资源定义：用于判断容量规则。
        var resourceDefinition = getResourceDefinition(resourceId);

        if (!resourceState || !resourceDefinition || amount <= 0) {
            return 0;
        }

        // number 调整后增加数量：挑战规则和永久奖励可修正资源收益。
        var adjustedAmount = amount * getPermanentResourceGainMultiplier(state, resourceId) * getChallengeResourceGainMultiplier(state, resourceId);

        // number 增加前数量：用于计算实际增量。
        var previousValue = resourceState.value;

        // number 目标数量：尚未按容量夹取的资源数量。
        var targetValue = resourceState.value + adjustedAmount;

        if (resourceDefinition.isCapacityLimited) {
            resourceState.value = Math.min(resourceState.maxValue, targetValue);
        } else {
            resourceState.value = targetValue;
        }

        if (game.unlocks.shouldRevealResource(resourceState)) {
            resourceState.isVisible = true;
        }

        // number 实际增加数量：用于返回和历史统计。
        var actualGain = resourceState.value - previousValue;

        resourceState.grossGainThisTick = (resourceState.grossGainThisTick || 0) + adjustedAmount;
        resourceState.actualGainThisTick = (resourceState.actualGainThisTick || 0) + actualGain;

        if (resourceId === "crudeKnowledge" && actualGain > 0) {
            state.statistics.totalCrudeKnowledgeEarned = (state.statistics.totalCrudeKnowledgeEarned || 0) + actualGain;
        }

        if (resourceDefinition.isCapacityLimited && resourceState.value >= resourceState.maxValue && actualGain < adjustedAmount) {
            logCapacityFull(state, resourceDefinition);
        }

        return actualGain;
    }

    /**
     * 读取永久资源收益倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {number} 资源收益倍率，至少为 1。
     */
    function getPermanentResourceGainMultiplier(state, resourceId) {
        if ((resourceId === "coin" || resourceId === "loot") && game.prestigeSystem) {
            // Object.<string, number> 威望效果字典：用于金币和战利品收益加成。
            var prestigeEffects = game.prestigeSystem.getPrestigeEffects(state);

            return Math.max(0, 1 + (prestigeEffects.coinLootGainRatio || 0));
        }

        return 1;
    }

    /**
     * 读取挑战资源收益倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {number} 资源收益倍率，至少为 0。
     */
    function getChallengeResourceGainMultiplier(state, resourceId) {
        if (!game.challengesSystem) {
            return 1;
        }

        return game.challengesSystem.getResourceGainMultiplier(state, resourceId);
    }

    /**
     * 记录容量已满日志。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入日志和统计标记。
     * @param {ResourceDefinition} resourceDefinition - 资源定义对象。
     * @returns {void} 无返回值。
     */
    function logCapacityFull(state, resourceDefinition) {
        // string 统计键：用于避免同一资源容量满时连续刷屏。
        var statisticKey = "capacityFullLogged_" + resourceDefinition.id;

        if (state.statistics[statisticKey]) {
            return;
        }

        state.statistics[statisticKey] = 1;
        game.simulation.addLog(state, "warning", game.text.TEXT_REGISTRY.logs.capacityFullPrefix + resourceDefinition.name + "。");
    }

    /**
     * 计算支付缺口，并把浮点运算产生的极小差额视为 0。
     *
     * @param {number} currentAmount - 当前库存数量，非负资源数量。
     * @param {number} requiredAmount - 需要支付的数量，非负资源数量。
     * @returns {number} 实际缺口数量，非负资源数量；小于容差时返回 0。
     */
    function getPriceMissingAmount(currentAmount, requiredAmount) {
        // number 原始缺口数量：价格减去库存后的有符号资源差额。
        var rawMissingAmount = requiredAmount - currentAmount;

        if (rawMissingAmount <= RESOURCE_PAYMENT_EPSILON) {
            return 0;
        }

        return rawMissingAmount;
    }

    /**
     * 判断资源是否足够支付价格。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {boolean} 是否足够支付；true 表示每项资源都达到价格数量。
     */
    function canAfford(state, price) {
        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前价格项：用于检查对应资源库存。
            var priceEntry = price[priceIndex];

            // ResourceState 资源状态：用于读取当前库存。
            var resourceState = state.resourcesById[priceEntry.resource];

            // number 当前资源数量：缺失资源按 0 处理。
            var currentAmount = resourceState ? resourceState.value : 0;

            if (getPriceMissingAmount(currentAmount, priceEntry.amount) > 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * 计算价格缺口文本。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {string[]} 缺口文本数组；每项为中文资源名和缺少数量。
     */
    function getMissingResourceTexts(state, price) {
        // string[] 缺口文本数组：用于按钮置灰时显示不足资源。
        var missingTexts = [];

        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前价格项：用于计算对应资源缺口。
            var priceEntry = price[priceIndex];

            // ResourceState 资源状态：用于读取当前库存。
            var resourceState = state.resourcesById[priceEntry.resource];

            // ResourceDefinition|null 资源定义：用于显示中文名称。
            var resourceDefinition = getResourceDefinition(priceEntry.resource);

            // number 当前资源数量：缺失资源按 0 处理。
            var currentAmount = resourceState ? resourceState.value : 0;

            // number 当前资源缺口：非负资源数量，极小浮点差额视为 0。
            var missingAmount = getPriceMissingAmount(currentAmount, priceEntry.amount);

            if (missingAmount > 0) {
                missingTexts.push((resourceDefinition ? resourceDefinition.name : priceEntry.resource) + " -" + missingAmount.toFixed(0));
            }
        }

        return missingTexts;
    }

    /**
     * 计算价格按当前资源速度补齐的等待信息。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {PriceWaitInfo} 等待信息；seconds 为整体可用倒计时秒数，不可达时为 Infinity。
     */
    function getPriceWaitInfo(state, price) {
        // ResourceWaitEntry[] 等待明细数组：记录每个缺口资源的补齐时间。
        var waitEntries = [];

        // boolean 是否已经可支付：没有缺口时为 true。
        var isAffordable = true;

        // boolean 是否可等待获得：任一缺口不可达时为 false。
        var isAvailable = true;

        // number 整体等待秒数：取所有缺口资源补齐时间的最大值。
        var totalSeconds = 0;

        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前价格项：用于计算对应资源缺口和等待时间。
            var priceEntry = price[priceIndex];

            // ResourceState 资源状态：用于读取当前库存、容量和每秒变化。
            var resourceState = state.resourcesById[priceEntry.resource];

            // number 当前资源数量：缺失资源按 0 处理。
            var currentAmount = resourceState ? resourceState.value : 0;

            // number 当前资源缺口：非负资源数量，极小浮点差额视为 0。
            var missingAmount = getPriceMissingAmount(currentAmount, priceEntry.amount);

            if (missingAmount <= 0) {
                continue;
            }

            isAffordable = false;

            // number 当前每秒积累速度：暂停时主循环停止，按 0 处理。
            var perSecond = state.isPaused || !resourceState ? 0 : resourceState.perSecond;

            // ResourceDefinition|null 资源定义：用于判断容量是否会阻止资源达到价格。
            var resourceDefinition = getResourceDefinition(priceEntry.resource);

            // boolean 容量是否足够：容量资源目标价格超过上限时不可达，贴近上限时视为足够。
            var hasCapacity = Boolean(resourceState && (!resourceDefinition || !resourceDefinition.isCapacityLimited || resourceState.maxValue + RESOURCE_PAYMENT_EPSILON >= priceEntry.amount));

            // boolean 当前缺口是否可达：需要容量足够且有正积累速度。
            var isReachable = Boolean(hasCapacity && perSecond > 0);

            // number 单资源等待秒数：不可达时为 Infinity。
            var seconds = isReachable ? missingAmount / perSecond : Infinity;

            if (!isReachable) {
                isAvailable = false;
            }

            if (seconds > totalSeconds) {
                totalSeconds = seconds;
            }

            waitEntries.push({
                resource: priceEntry.resource,
                missingAmount: missingAmount,
                perSecond: perSecond,
                seconds: seconds,
                isReachable: isReachable
            });
        }

        return {
            isAffordable: isAffordable,
            isAvailable: isAvailable,
            seconds: isAvailable ? totalSeconds : Infinity,
            entries: waitEntries
        };
    }

    /**
     * 格式化价格等待信息为卡片提示文本。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {string} 可用倒计时文本；已可支付时返回空字符串，不可达时显示不可用。
     */
    function formatPriceAvailabilityText(state, price) {
        // PriceWaitInfo 等待信息：用于判断显示倒计时或不可用。
        var waitInfo = getPriceWaitInfo(state, price);

        if (waitInfo.isAffordable) {
            return "";
        }

        return game.text.TEXT_REGISTRY.ui.availabilityPrefix + (waitInfo.isAvailable ? formatDuration(waitInfo.seconds) : game.text.TEXT_REGISTRY.ui.unavailable);
    }

    /**
     * 格式化秒数为时分秒。
     *
     * @param {number} seconds - 等待秒数，非负浮点数。
     * @returns {string} 时分秒文本，格式为 HH:MM:SS。
     */
    function formatDuration(seconds) {
        // number 向上取整秒数：避免显示 00:00:00 但仍不可支付。
        var totalSeconds = Math.max(0, Math.ceil(seconds));

        // number 小时数：总秒数中的完整小时。
        var hours = Math.floor(totalSeconds / 3600);

        // number 分钟数：扣除小时后的完整分钟。
        var minutes = Math.floor((totalSeconds % 3600) / 60);

        // number 秒数：扣除小时和分钟后的剩余秒。
        var remainingSeconds = totalSeconds % 60;

        return padTimePart(hours) + ":" + padTimePart(minutes) + ":" + padTimePart(remainingSeconds);
    }

    /**
     * 补齐时间字段为两位数字。
     *
     * @param {number} value - 时间字段整数，非负数。
     * @returns {string} 两位或更多位数字文本。
     */
    function padTimePart(value) {
        if (value < 10) {
            return "0" + value;
        }

        return String(value);
    }

    /**
     * 支付资源价格并写回状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {boolean} 是否支付成功；true 表示资源已扣除。
     */
    function spendResources(state, price) {
        if (!canAfford(state, price)) {
            game.simulation.addLog(state, "warning", game.text.TEXT_REGISTRY.logs.resourceMissingPrefix + getMissingResourceTexts(state, price).join("，"));
            return false;
        }

        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前价格项：用于扣除对应资源。
            var priceEntry = price[priceIndex];

            // ResourceState 资源状态：用于写回扣款后的库存。
            var resourceState = state.resourcesById[priceEntry.resource];

            // number 扣款后库存：允许贴近 0 的负数归零，避免显示 -0。
            var remainingAmount = resourceState.value - priceEntry.amount;

            resourceState.value = Math.abs(remainingAmount) <= RESOURCE_PAYMENT_EPSILON ? 0 : remainingAmount;
        }

        return true;
    }

    /**
     * 执行手动采集行动。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} actionId - 手动行动稳定 ID。
     * @returns {boolean} 是否成功执行；true 表示资源状态发生变化。
     */
    function applyManualAction(state, actionId) {
        if (state.isPaused) {
            return false;
        }

        // ManualActionDefinition|null 手动行动定义：用于确定产出资源和数量。
        var actionDefinition = null;

        // number 循环索引：遍历手动行动定义数组的整数下标。
        for (var actionIndex = 0; actionIndex < game.definitions.MANUAL_ACTION_DEFINITIONS.length; actionIndex += 1) {
            // ManualActionDefinition 当前手动行动定义：用于匹配行动 ID。
            var currentActionDefinition = game.definitions.MANUAL_ACTION_DEFINITIONS[actionIndex];

            if (currentActionDefinition.id === actionId) {
                actionDefinition = currentActionDefinition;
                break;
            }
        }

        if (!actionDefinition) {
            return false;
        }

        // number 实际获得数量：容量满时可能低于行动定义数量。
        var addedAmount = addResource(state, actionDefinition.resource, actionDefinition.amount);

        if (addedAmount > 0) {
            // ResourceDefinition|null 资源定义：用于日志显示中文资源名。
            var resourceDefinition = getResourceDefinition(actionDefinition.resource);

            game.simulation.addLog(state, "normal", actionDefinition.name + "：获得 " + addedAmount.toFixed(1) + " " + (resourceDefinition ? resourceDefinition.name : actionDefinition.resource) + "。");
        }

        return addedAmount > 0;
    }

    // Object 资源系统命名空间：提供资源增减、支付和手动采集函数。
    game.resources = {
        getResourceDefinition: getResourceDefinition,
        addResource: addResource,
        canAfford: canAfford,
        getMissingResourceTexts: getMissingResourceTexts,
        getPriceWaitInfo: getPriceWaitInfo,
        formatPriceAvailabilityText: formatPriceAvailabilityText,
        spendResources: spendResources,
        applyManualAction: applyManualAction,
        logCapacityFull: logCapacityFull
    };
})(window.GoblinEmpire);
