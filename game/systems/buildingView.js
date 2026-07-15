/* 建筑视图模型：集中计算揭示、可用性、缺口、等待、劳力风险与建设建议，不修改游戏进度。 */
/**
 * 初始化建筑视图模型模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 buildingView 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 接近解锁揭示比例：任一基础成本资源达到 30% 时允许显示用途剪影，范围 0-1。
    var BUILDING_REVEAL_RATIO = 0.3;

    // Object.<string, string> 效果标签文案字典：key 为受控标签 ID，value 为建筑行中文短标签。
    var EFFECT_TAG_LABEL_BY_ID = {
        food: "口粮", production: "生产", labor: "劳力", housing: "住房", unlock: "解锁",
        efficiency: "效率", storage: "容量", military: "军事", weather: "天气", knowledge: "粗识",
        obedience: "服从", mining: "矿业", crafting: "制作", smelting: "冶炼", conversion: "转换",
        fuel: "燃料", warbeast: "战兽", trade: "贸易", captive: "俘虏", faith: "祭祀",
        prestige: "威望", abyss: "深渊", risk: "风险", expedition: "远征", rift: "裂隙"
    };

    /**
     * 判断未解锁建筑是否达到接近揭示条件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑静态定义。
     * @returns {boolean} 是否允许预览；true 表示至少一项基础成本库存达到揭示比例。
     */
    function shouldPreviewBuilding(state, buildingDefinition) {
        // number 价格循环索引：遍历基础价格的整数下标。
        for (var priceIndex = 0; priceIndex < buildingDefinition.basePrice.length; priceIndex += 1) {
            // Price 当前基础价格项：用于比较对应库存比例。
            var priceEntry = buildingDefinition.basePrice[priceIndex];

            // ResourceState|null 当前资源状态：缺失资源按零库存处理。
            var resourceState = state.resourcesById[priceEntry.resource] || null;

            if (resourceState && resourceState.value >= priceEntry.amount * BUILDING_REVEAL_RATIO) {
                return true;
            }
        }

        return false;
    }

    /**
     * 创建单个建筑的纯视图模型。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑静态定义。
     * @returns {Object} 建筑视图模型；包含状态、价格、缺口、等待、阻断原因和劳力风险。
     */
    function createBuildingViewModel(state, buildingDefinition) {
        // BuildingState 建筑运行时状态：用于读取解锁、拥有与启用数量。
        var buildingState = state.buildingsById[buildingDefinition.id];

        // boolean 是否正式解锁：true 表示允许显示完整建筑信息。
        var isUnlocked = Boolean(buildingState && buildingState.isUnlocked);

        // boolean 是否接近揭示：仅在未正式解锁时计算。
        var isPreview = !isUnlocked && shouldPreviewBuilding(state, buildingDefinition);

        // Price[] 当前购买价格：预览行不泄露缩放后完整数值，但模型保留供正式行使用。
        var price = game.buildings.getBuildingPrice(state, buildingDefinition);

        // PriceWaitInfo 价格等待信息：区分可支付、等待可达和阻断。
        var waitInfo = game.resources.getPriceWaitInfo(state, price);

        // ResourceId[] 容量阻断资源 ID：价格超过容量上限的缺口资源。
        var capacityBlockedResourceIds = [];

        // ResourceId[] 无持续来源资源 ID：容量足够但当前净产量不为正的缺口资源。
        var sourceBlockedResourceIds = [];

        // number 等待条目循环索引：遍历每项缺口资源的整数下标。
        for (var entryIndex = 0; entryIndex < waitInfo.entries.length; entryIndex += 1) {
            // ResourceWaitEntry 当前等待条目：用于判定具体阻断原因。
            var waitEntry = waitInfo.entries[entryIndex];

            // ResourceState|null 缺口资源状态：用于读取容量上限。
            var missingResourceState = state.resourcesById[waitEntry.resource] || null;

            // Price|null 对应价格项：用于比较目标价格与容量。
            var matchingPrice = findPriceEntry(price, waitEntry.resource);

            if (missingResourceState && matchingPrice && missingResourceState.maxValue < matchingPrice.amount) {
                capacityBlockedResourceIds.push(waitEntry.resource);
            } else if (waitEntry.perSecond <= 0) {
                sourceBlockedResourceIds.push(waitEntry.resource);
            }
        }

        // string 建筑封闭视图状态：hidden、preview、unaffordable、blocked、available 或 paused。
        var buildingViewStatus = getBuildingViewStatus(state, isUnlocked, isPreview, waitInfo);

        // LaborBreakdown 劳力摘要：用于预估再建一座后的过载状态。
        var laborBreakdown = game.population.analyzeLaborBreakdown(state);

        // number 单座劳力占用：非生产建筑按零处理，单位劳力。
        var laborUsage = Number(buildingDefinition.effects.laborUsage) || 0;

        // number 建造后减免建筑占用：按当前减免比例估算，单位劳力。
        var laborUsageAfterPurchase = laborBreakdown.adjustedBuildingUsageTotal + laborUsage * (1 - laborBreakdown.reductionRatio);

        return {
            definition: buildingDefinition,
            state: buildingState,
            buildingViewStatus: buildingViewStatus,
            isPreview: isPreview,
            isKeyBuilding: buildingDefinition.isMilestone,
            price: price,
            nextPrice: game.buildings.getBuildingPriceForOwnedCount(state, buildingDefinition, (buildingState ? buildingState.owned : 0) + 1),
            refundPrice: game.buildings.getBuildingDestroyRefund(state, buildingDefinition),
            waitInfo: waitInfo,
            capacityBlockedResourceIds: capacityBlockedResourceIds,
            sourceBlockedResourceIds: sourceBlockedResourceIds,
            willOverloadLabor: laborUsageAfterPurchase > laborBreakdown.populationLabor,
            laborUsage: laborUsage,
            totalLaborUsage: laborUsage * (buildingState ? buildingState.active : 0) * (1 - laborBreakdown.reductionRatio),
            unlockText: getBuildingUnlockText(state, buildingDefinition)
        };
    }

    /**
     * 查找指定资源的价格项。
     *
     * @param {Price[]} price - 价格数组。
     * @param {ResourceId} resourceId - 要匹配的资源稳定 ID。
     * @returns {Price|null} 匹配价格项；不存在时返回 null。
     */
    function findPriceEntry(price, resourceId) {
        // number 价格循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            if (price[priceIndex].resource === resourceId) {
                return price[priceIndex];
            }
        }

        return null;
    }

    /**
     * 计算建筑封闭视图状态。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {boolean} isUnlocked - true 表示建筑已经正式解锁；false 表示尚未解锁。
     * @param {boolean} isPreview - true 表示允许显示接近解锁剪影；false 表示完全隐藏。
     * @param {PriceWaitInfo} waitInfo - 当前价格等待信息。
     * @returns {string} hidden、preview、unaffordable、blocked、available 或 paused。
     */
    function getBuildingViewStatus(state, isUnlocked, isPreview, waitInfo) {
        if (!isUnlocked) {
            return isPreview ? "preview" : "hidden";
        }

        if (waitInfo.isAffordable) {
            return state.isPaused ? "paused" : "available";
        }

        return waitInfo.isAvailable ? "unaffordable" : "blocked";
    }

    /**
     * 收集所有已揭示建筑视图模型。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object[]} 建筑视图模型数组；完全隐藏建筑不包含在内。
     */
    function collectBuildingViewModels(state) {
        // Object[] 建筑视图模型数组：保持静态定义设计顺序。
        var viewModels = [];

        // number 建筑循环索引：遍历全部建筑定义的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // Object 当前建筑视图模型：用于判断是否进入可见列表。
            var viewModel = createBuildingViewModel(state, game.definitions.BUILDING_DEFINITIONS[buildingIndex]);

            if (viewModel.buildingViewStatus !== "hidden") {
                viewModels.push(viewModel);
            }
        }

        return viewModels;
    }

    /**
     * 获取建筑的具名解锁条件说明。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑静态定义。
     * @returns {string} 解锁来源与额外条件中文说明。
     */
    function getBuildingUnlockText(state, buildingDefinition) {
        if (buildingDefinition.unlock && buildingDefinition.unlock.isDefault) {
            return "默认可见";
        }

        // string[] 解锁条件文本数组：汇总科技来源和统计门槛。
        var conditionTexts = [];

        // number 科技循环索引：遍历科技定义查找建筑解锁包来源。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 当前科技定义：用于查找 unlocks.buildings 引用。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            if (technologyDefinition.unlocks && (technologyDefinition.unlocks.buildings || []).indexOf(buildingDefinition.id) >= 0) {
                conditionTexts.push("研究“" + technologyDefinition.name + "”");
            }
        }

        // StatisticUnlockRequirement[] 统计门槛数组：不存在时使用空数组。
        var statisticRequirements = buildingDefinition.unlockRequirements && buildingDefinition.unlockRequirements.statistics || [];

        // number 门槛循环索引：遍历额外统计条件的整数下标。
        for (var requirementIndex = 0; requirementIndex < statisticRequirements.length; requirementIndex += 1) {
            conditionTexts.push(statisticRequirements[requirementIndex].description);
        }

        return conditionTexts.length > 0 ? conditionTexts.join("；") : "由前置系统解锁";
    }

    /**
     * 获取受控效果标签中文名。
     *
     * @param {string} effectTagId - 效果标签稳定 ID。
     * @returns {string} 中文短标签；未知 ID 返回原 ID 以暴露配置错误。
     */
    function getEffectTagLabel(effectTagId) {
        return EFFECT_TAG_LABEL_BY_ID[effectTagId] || effectTagId;
    }

    game.buildingView = {
        collectBuildingViewModels: collectBuildingViewModels,
        createBuildingViewModel: createBuildingViewModel,
        getEffectTagLabel: getEffectTagLabel
    };
})(window.GoblinEmpire);
