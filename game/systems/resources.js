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
     * 取得玩家可见的中文资源名；定义异常时立即抛错，禁止泄露内部 ID 或使用占位文案。
     *
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {string} 已登记且非空的中文资源名。
     * @throws {Error} 资源定义缺失、名称为空或名称不含中文字符时抛出开发错误。
     */
    function getResourceDisplayName(resourceId) {
        // ResourceDefinition|null 资源定义：玩家可见名称的唯一权威来源。
        var resourceDefinition = getResourceDefinition(resourceId);

        if (!resourceDefinition || typeof resourceDefinition.name !== "string" || !/[\u3400-\u9fff]/.test(resourceDefinition.name)) {
            throw new Error("资源缺少严格中文显示名：" + resourceId);
        }

        return resourceDefinition.name;
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
     * 按有符号数量调整资源并按容量截断。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {number} deltaAmount - 资源变化数量；正数为获得，负数为损失。
     * @returns {number} 实际变化的资源数量，可为负数、0 或正数。
     */
    function changeResource(state, resourceId, deltaAmount) {
        // ResourceState 资源状态：用于写入变化后的数量和可见性。
        var resourceState = state.resourcesById[resourceId];

        // ResourceDefinition|null 资源定义：用于判断容量规则。
        var resourceDefinition = getResourceDefinition(resourceId);

        if (!resourceState || !resourceDefinition || !Number.isFinite(deltaAmount) || deltaAmount === 0) {
            return 0;
        }

        if (deltaAmount > 0) {
            return addResource(state, resourceId, deltaAmount);
        }

        // number 变化前数量：用于计算实际减少量。
        var previousValue = resourceState.value;

        // number 调整后数量：声望类资源不能低于 0。
        var changedValue = Math.max(0, resourceState.value + deltaAmount);

        resourceState.value = changedValue;

        if (game.unlocks.shouldRevealResource(resourceState)) {
            resourceState.isVisible = true;
        }

        return resourceState.value - previousValue;
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
                missingTexts.push(getResourceDisplayName(priceEntry.resource) + " -" + missingAmount.toFixed(0));
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
     * 判断指定科技是否已经研究，用于计算手动采集增益和事件池。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyId} technologyId - 要检查的科技稳定 ID。
     * @returns {boolean} 是否已经研究；true 表示科技效果立即生效。
     */
    function isTechnologyResearched(state, technologyId) {
        // TechnologyState|null 科技状态：缺失定义或旧存档中不存在时按未研究处理。
        var technologyState = state.technologiesById[technologyId] || null;

        return Boolean(technologyState && technologyState.isResearched);
    }

    /**
     * 计算一次手动采集的基础与科技增产总量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ManualActionDefinition} actionDefinition - 手动行动定义，包含基础数量和科技加成表。
     * @returns {number} 本次采集尝试获得的资源数量，非负资源数量。
     */
    function getManualActionAmount(state, actionDefinition) {
        // number 总采集数量：从行动基础值开始累加已研究科技加成。
        var totalAmount = actionDefinition.amount;

        // number 科技加成循环索引：遍历该行动的固定增产科技。
        for (var bonusIndex = 0; bonusIndex < actionDefinition.technologyBonuses.length; bonusIndex += 1) {
            // ManualActionTechnologyBonus 科技加成定义：描述科技 ID 与单次增产数量。
            var technologyBonus = actionDefinition.technologyBonuses[bonusIndex];

            if (isTechnologyResearched(state, technologyBonus.technologyId)) {
                totalAmount += technologyBonus.amount;
            }
        }

        return Math.max(0, totalAmount);
    }

    /**
     * 计算手动采集事件的当前抽取权重。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ManualGatherEventDefinition} eventDefinition - 待计算的事件定义。
     * @returns {number} 当前事件权重，0 表示已被安全科技屏蔽。
     */
    function getManualGatherEventWeight(state, eventDefinition) {
        if (eventDefinition.blockedByTechnologyId && isTechnologyResearched(state, eventDefinition.blockedByTechnologyId)) {
            return 0;
        }

        // number 当前事件权重：从基础权重开始乘入已研究科技倍率。
        var currentWeight = eventDefinition.weight;

        // number 权重加成循环索引：遍历提高好事件概率的科技列表。
        for (var bonusIndex = 0; bonusIndex < eventDefinition.weightBonuses.length; bonusIndex += 1) {
            // ManualGatherWeightBonus 权重加成定义：指定科技与正权重倍率。
            var weightBonus = eventDefinition.weightBonuses[bonusIndex];

            if (isTechnologyResearched(state, weightBonus.technologyId)) {
                currentWeight *= weightBonus.multiplier;
            }
        }

        return Math.max(0, currentWeight);
    }

    /**
     * 从行动专属事件池按当前科技修正后的权重抽取一个事件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ManualActionDefinition} actionDefinition - 手动行动定义，包含专属事件池。
     * @returns {ManualGatherEventDefinition|null} 抽中的事件；事件池为空时返回 null。
     */
    function selectManualGatherEvent(state, actionDefinition) {
        // number[] 当前事件权重数组：索引与 actionDefinition.events 一一对应。
        var eventWeights = [];

        // number 总权重：所有未被科技屏蔽事件的权重之和。
        var totalWeight = 0;

        // number 事件循环索引：遍历行动专属事件池。
        for (var eventIndex = 0; eventIndex < actionDefinition.events.length; eventIndex += 1) {
            // number 当前事件权重：已包含科技屏蔽和正面概率增益。
            var eventWeight = getManualGatherEventWeight(state, actionDefinition.events[eventIndex]);

            eventWeights.push(eventWeight);
            totalWeight += eventWeight;
        }

        if (totalWeight <= 0) {
            return null;
        }

        // number 随机权重点：范围为 0（含）到总权重（不含）。
        var randomWeight = Math.random() * totalWeight;

        // number 累计权重：用于定位随机权重点落入的事件区间。
        var accumulatedWeight = 0;

        // number 抽取循环索引：按定义顺序累加事件权重。
        for (var selectionIndex = 0; selectionIndex < actionDefinition.events.length; selectionIndex += 1) {
            accumulatedWeight += eventWeights[selectionIndex];

            if (randomWeight < accumulatedWeight) {
                return actionDefinition.events[selectionIndex];
            }
        }

        return actionDefinition.events[actionDefinition.events.length - 1] || null;
    }

    /**
     * 尝试触发并结算一次手动采集专属随机事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会被事件资源变化直接修改。
     * @param {ManualActionDefinition} actionDefinition - 已成功执行的手动行动定义。
     * @returns {boolean} 是否触发事件；true 表示已经抽取、结算并记录日志。
     */
    function tryTriggerManualGatherEvent(state, actionDefinition) {
        if (Math.random() >= actionDefinition.eventChance) {
            return false;
        }

        // ManualGatherEventDefinition|null 采集事件定义：按当前科技修正后的权重抽取。
        var eventDefinition = selectManualGatherEvent(state, actionDefinition);

        if (!eventDefinition) {
            return false;
        }

        // number 资源变化循环索引：逐项结算事件的即时得失。
        for (var changeIndex = 0; changeIndex < eventDefinition.resourceChanges.length; changeIndex += 1) {
            // WeatherEventResourceChange 资源变化定义：resource 为资源 ID，amount 为有符号数量。
            var resourceChange = eventDefinition.resourceChanges[changeIndex];

            changeResource(state, resourceChange.resource, resourceChange.amount);
        }

        // string 日志等级：负面事件使用警告，其余事件作为重要发现显示。
        var logLevel = eventDefinition.outcomeType === "negative" ? "warning" : "important";

        state.statistics.manualGatherEventsTriggered = (state.statistics.manualGatherEventsTriggered || 0) + 1;
        game.simulation.addLog(state, logLevel, "采集事件·" + eventDefinition.name + "：" + eventDefinition.logText);
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

        // number 本次采集数量：包含该行动独立科技树提供的固定增产。
        var actionAmount = getManualActionAmount(state, actionDefinition);

        // number 实际获得数量：容量满时可能低于本次采集数量。
        var addedAmount = addResource(state, actionDefinition.resource, actionAmount);

        if (addedAmount > 0) {
            // ResourceDefinition|null 资源定义：用于日志显示中文资源名。
            var resourceDefinition = getResourceDefinition(actionDefinition.resource);

            game.simulation.addLog(state, "normal", actionDefinition.name + "：获得 " + addedAmount.toFixed(1) + " " + getResourceDisplayName(actionDefinition.resource) + "。");
        }

        // boolean 是否触发采集事件：每次有效按钮点击都投骰，即使基础资源已经达到容量。
        var hasTriggeredEvent = tryTriggerManualGatherEvent(state, actionDefinition);

        return addedAmount > 0 || hasTriggeredEvent;
    }

    // Object 资源系统命名空间：提供资源增减、支付和手动采集函数。
    game.resources = {
        getResourceDefinition: getResourceDefinition,
        getResourceDisplayName: getResourceDisplayName,
        addResource: addResource,
        changeResource: changeResource,
        canAfford: canAfford,
        getMissingResourceTexts: getMissingResourceTexts,
        getPriceWaitInfo: getPriceWaitInfo,
        formatPriceAvailabilityText: formatPriceAvailabilityText,
        spendResources: spendResources,
        applyManualAction: applyManualAction,
        getManualActionAmount: getManualActionAmount,
        getManualGatherEventWeight: getManualGatherEventWeight,
        selectManualGatherEvent: selectManualGatherEvent,
        tryTriggerManualGatherEvent: tryTriggerManualGatherEvent,
        logCapacityFull: logCapacityFull
    };
})(window.GoblinEmpire);
