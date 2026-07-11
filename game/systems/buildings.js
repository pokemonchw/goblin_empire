/* 建筑系统：负责建筑成本计算和购买入口。 */
/**
 * 初始化建筑系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 buildings 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 建筑摧毁返还比例：返还最后一座建筑成本的固定百分比。
    var BUILDING_DESTROY_REFUND_RATIO = 0.1;

    /**
     * 取得建筑定义。
     *
     * @param {BuildingId} buildingId - 建筑稳定 ID。
     * @returns {BuildingDefinition|null} 建筑定义；未找到时返回 null。
     */
    function getBuildingDefinition(buildingId) {
        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于匹配建筑 ID。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            if (buildingDefinition.id === buildingId) {
                return buildingDefinition;
            }
        }

        return null;
    }

    /**
     * 计算建筑当前购买价格。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑定义对象。
     * @returns {Price[]} 当前购买价格数组。
     */
    function getBuildingPrice(state, buildingDefinition) {
        // BuildingState 建筑状态：用于读取已拥有数量。
        var buildingState = state.buildingsById[buildingDefinition.id];

        // number 已拥有数量：价格指数的非负整数。
        var ownedCount = buildingState ? buildingState.owned : 0;

        return getBuildingPriceForOwnedCount(state, buildingDefinition, ownedCount);
    }

    /**
     * 按指定拥有数量计算建筑购买价格。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑定义对象。
     * @param {number} ownedCount - 价格指数使用的已拥有数量，非负整数。
     * @returns {Price[]} 当前购买价格数组。
     */
    function getBuildingPriceForOwnedCount(state, buildingDefinition, ownedCount) {
        // number 价格指数数量：防止异常存档传入负数。
        var safeOwnedCount = Math.max(0, Math.floor(ownedCount));

        // number 威望价格倍率：地穴工程学降低所有建筑价格。
        var prestigePriceMultiplier = game.prestigeSystem ? Math.max(0.01, 1 + (game.prestigeSystem.getPrestigeEffects(state).buildingPriceRatio || 0)) : 1;

        // 建筑成本随拥有数量指数增长，用来给早期扩张制造资源取舍。
        return game.pricing.scalePrice(buildingDefinition.basePrice, Math.pow(buildingDefinition.priceRatio, safeOwnedCount) * prestigePriceMultiplier);
    }

    /**
     * 计算摧毁一座建筑时返还的资源。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑定义对象。
     * @returns {Price[]} 返还资源数组；amount 为非负资源数量。
     */
    function getBuildingDestroyRefund(state, buildingDefinition) {
        // BuildingState 建筑状态：用于读取最后一座建筑的价格指数。
        var buildingState = state.buildingsById[buildingDefinition.id];

        // number 最后一座建筑价格指数：摧毁只处理当前拥有列表中的最后一座。
        var lastOwnedIndex = buildingState && buildingState.owned > 0 ? buildingState.owned - 1 : 0;

        // Price[] 最后一座建筑成本：按当前价格曲线估算曾支付成本。
        var lastBuildingPrice = getBuildingPriceForOwnedCount(state, buildingDefinition, lastOwnedIndex);

        return game.pricing.scalePrice(lastBuildingPrice, BUILDING_DESTROY_REFUND_RATIO);
    }

    /**
     * 判断建筑当前是否可购买。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑定义对象。
     * @returns {boolean} 是否可购买；true 表示已解锁、未暂停且资源足够。
     */
    function canBuyBuilding(state, buildingDefinition) {
        // BuildingState 建筑状态：用于读取解锁状态。
        var buildingState = state.buildingsById[buildingDefinition.id];

        if (!buildingState || !buildingState.isUnlocked || state.isPaused) {
            return false;
        }

        return game.resources.canAfford(state, getBuildingPrice(state, buildingDefinition));
    }

    /**
     * 购买建筑并应用解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {BuildingId} buildingId - 建筑稳定 ID。
     * @returns {boolean} 是否购买成功；true 表示资源已扣除且拥有数增加。
     */
    function buyBuilding(state, buildingId) {
        // BuildingDefinition|null 建筑定义：用于读取价格、效果和解锁。
        var buildingDefinition = getBuildingDefinition(buildingId);

        if (!buildingDefinition || state.isPaused) {
            return false;
        }

        // BuildingState 建筑状态：用于写入拥有数和启用数。
        var buildingState = state.buildingsById[buildingId];

        if (!buildingState || !buildingState.isUnlocked) {
            return false;
        }

        // Price[] 当前价格：按已拥有数量缩放后的购买成本。
        var price = getBuildingPrice(state, buildingDefinition);

        if (!game.resources.spendResources(state, price)) {
            return false;
        }

        // boolean 深渊门此前是否已开启：用于首次开启日志和统计。
        var wasAbyssGateOpened = Boolean(state.statistics.hasOpenedAbyssGate);

        buildingState.owned += 1;
        buildingState.active += 1;
        applyBuildingEffects(state, buildingDefinition.effects);
        if (game.population && game.population.updateLaborFromPopulation) {
            game.population.updateLaborFromPopulation(state);
        }
        game.unlocks.applyUnlockBundle(state, buildingDefinition.unlock);
        game.simulation.addLog(state, "normal", game.text.TEXT_REGISTRY.logs.builtPrefix + buildingDefinition.name + "。");

        if (buildingId === "abyss_gate" && !wasAbyssGateOpened) {
            state.statistics.hasOpenedAbyssGate = 1;
            game.simulation.addLog(state, "important", "深渊门首次开启，帝国听见了更深处的回响。");
        }

        if (buildingId === "chief_hall") {
            state.statistics.hasBuiltChiefHall = 1;
        }

        return true;
    }

    /**
     * 摧毁一座建筑并返还部分资源。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {BuildingId} buildingId - 建筑稳定 ID。
     * @returns {boolean} 是否摧毁成功；true 表示拥有数减少且返还已发放。
     */
    function destroyBuilding(state, buildingId) {
        // BuildingDefinition|null 建筑定义：用于读取返还价格和反向效果。
        var buildingDefinition = getBuildingDefinition(buildingId);

        if (!buildingDefinition || state.isPaused) {
            return false;
        }

        // BuildingState 建筑状态：用于扣减拥有数和启用数。
        var buildingState = state.buildingsById[buildingId];

        if (!buildingState || !buildingState.isUnlocked || buildingState.owned <= 0) {
            return false;
        }

        // Price[] 返还资源：按最后一座建筑成本的固定比例计算。
        var refundPrice = getBuildingDestroyRefund(state, buildingDefinition);

        buildingState.owned -= 1;
        buildingState.active = Math.min(buildingState.active, buildingState.owned);
        removeBuildingEffects(state, buildingDefinition.effects);
        addRefundResources(state, refundPrice);

        if (game.population && game.population.updateLaborFromPopulation) {
            game.population.updateLaborFromPopulation(state);
        }

        game.simulation.addLog(state, "warning", game.text.TEXT_REGISTRY.logs.destroyedPrefix + buildingDefinition.name + "，返还 " + formatRefundLogText(refundPrice) + "。");
        return true;
    }

    /**
     * 应用建筑效果到运行时状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {Object.<string, number>} effects - 建筑效果字典；key 为效果 ID，value 为效果数值。
     * @returns {void} 无返回值。
     */
    function applyBuildingEffects(state, effects) {
        applyResourceCapacityEffect(state, effects, "fungusMax", "fungus");
        applyResourceCapacityEffect(state, effects, "rottenWoodMax", "rottenWood");
        applyResourceCapacityEffect(state, effects, "rubbleMax", "rubble");
        applyResourceCapacityEffect(state, effects, "coalSlagMax", "coalSlag");
        applyResourceCapacityEffect(state, effects, "ironOreMax", "ironOre");
        applyResourceCapacityEffect(state, effects, "ironPlateMax", "ironPlate");
        applyResourceCapacityEffect(state, effects, "crudeKnowledgeMax", "crudeKnowledge");
        applyResourceCapacityEffect(state, effects, "obedienceMax", "obedience");
        applyResourceCapacityEffect(state, effects, "lootMax", "loot");
        applyResourceCapacityEffect(state, effects, "captiveMax", "captive");
        applyResourceCapacityEffect(state, effects, "ancestralEchoMax", "ancestralEcho");
        applyResourceCapacityEffect(state, effects, "tarMax", "tar");
        applyResourceCapacityEffect(state, effects, "blackIronMax", "blackIron");
        applyResourceCapacityEffect(state, effects, "runePlateMax", "runePlate");
        applyResourceCapacityEffect(state, effects, "manaCrystalMax", "manaCrystal");
        applyResourceCapacityEffect(state, effects, "abyssEchoMax", "abyssEcho");
        applyResourceCapacityEffect(state, effects, "relicMax", "relic");
        applyResourceCapacityEffect(state, effects, "riftShardMax", "riftShard");

        if (effects.fortressAchievement) {
            state.statistics.hasBuiltBlackIronFortress = 1;
            state.resourcesById.prestige.isVisible = true;
        }

        if (effects.abyssGateOpened) {
            state.statistics.hasOpenedAbyssGate = state.statistics.hasOpenedAbyssGate || 0;
        }

        if (effects.allBasicCapacity) {
            applyBroadCapacityEffect(state, effects.allBasicCapacity);
        }
    }

    /**
     * 从运行时状态中移除一座建筑提供的可逆效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {Object.<string, number>} effects - 建筑效果字典；key 为效果 ID，value 为效果数值。
     * @returns {void} 无返回值。
     */
    function removeBuildingEffects(state, effects) {
        removeResourceCapacityEffect(state, effects, "fungusMax", "fungus");
        removeResourceCapacityEffect(state, effects, "rottenWoodMax", "rottenWood");
        removeResourceCapacityEffect(state, effects, "rubbleMax", "rubble");
        removeResourceCapacityEffect(state, effects, "coalSlagMax", "coalSlag");
        removeResourceCapacityEffect(state, effects, "ironOreMax", "ironOre");
        removeResourceCapacityEffect(state, effects, "ironPlateMax", "ironPlate");
        removeResourceCapacityEffect(state, effects, "crudeKnowledgeMax", "crudeKnowledge");
        removeResourceCapacityEffect(state, effects, "obedienceMax", "obedience");
        removeResourceCapacityEffect(state, effects, "lootMax", "loot");
        removeResourceCapacityEffect(state, effects, "captiveMax", "captive");
        removeResourceCapacityEffect(state, effects, "ancestralEchoMax", "ancestralEcho");
        removeResourceCapacityEffect(state, effects, "tarMax", "tar");
        removeResourceCapacityEffect(state, effects, "blackIronMax", "blackIron");
        removeResourceCapacityEffect(state, effects, "runePlateMax", "runePlate");
        removeResourceCapacityEffect(state, effects, "manaCrystalMax", "manaCrystal");
        removeResourceCapacityEffect(state, effects, "abyssEchoMax", "abyssEcho");
        removeResourceCapacityEffect(state, effects, "relicMax", "relic");
        removeResourceCapacityEffect(state, effects, "riftShardMax", "riftShard");

        if (effects.allBasicCapacity) {
            removeBroadCapacityEffect(state, effects.allBasicCapacity);
        }
    }

    /**
     * 应用通用基础容量效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} amount - 增加容量数量，非负资源数量。
     * @returns {void} 无返回值。
     */
    function applyBroadCapacityEffect(state, amount) {
        increaseCapacityIfPresent(state, "fungus", amount);
        increaseCapacityIfPresent(state, "rottenWood", amount);
        increaseCapacityIfPresent(state, "rubble", amount);
        increaseCapacityIfPresent(state, "coalSlag", amount);
        increaseCapacityIfPresent(state, "ironOre", amount);
        increaseCapacityIfPresent(state, "ironPlate", amount);
    }

    /**
     * 移除通用基础容量效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} amount - 减少容量数量，非负资源数量。
     * @returns {void} 无返回值。
     */
    function removeBroadCapacityEffect(state, amount) {
        decreaseCapacityIfPresent(state, "fungus", amount);
        decreaseCapacityIfPresent(state, "rottenWood", amount);
        decreaseCapacityIfPresent(state, "rubble", amount);
        decreaseCapacityIfPresent(state, "coalSlag", amount);
        decreaseCapacityIfPresent(state, "ironOre", amount);
        decreaseCapacityIfPresent(state, "ironPlate", amount);
    }

    /**
     * 若资源存在则增加容量。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {number} amount - 增加容量数量，非负资源数量。
     * @returns {void} 无返回值。
     */
    function increaseCapacityIfPresent(state, resourceId, amount) {
        if (state.resourcesById[resourceId]) {
            state.resourcesById[resourceId].maxValue += amount;
        }
    }

    /**
     * 若资源存在则减少容量，并把库存夹回新上限。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {number} amount - 减少容量数量，非负资源数量。
     * @returns {void} 无返回值。
     */
    function decreaseCapacityIfPresent(state, resourceId, amount) {
        // ResourceState 资源状态：用于写回容量和库存。
        var resourceState = state.resourcesById[resourceId];

        if (!resourceState) {
            return;
        }

        resourceState.maxValue = Math.max(0, resourceState.maxValue - amount);
        resourceState.value = Math.min(resourceState.value, resourceState.maxValue);
    }

    /**
     * 按已拥有建筑重建全部建筑派生效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会按建筑拥有数量重加容量类效果。
     * @returns {void} 无返回值。
     */
    function applyAllBuildingEffects(state) {
        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (!buildingState || buildingState.owned <= 0) {
                continue;
            }

            // number 拥有循环索引：逐个应用建筑效果。
            for (var ownedIndex = 0; ownedIndex < buildingState.owned; ownedIndex += 1) {
                applyBuildingEffects(state, buildingDefinition.effects);
            }
        }
    }

    /**
     * 应用单项资源容量效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {Object.<string, number>} effects - 建筑效果字典；key 为效果 ID，value 为效果数值。
     * @param {string} effectId - 容量效果 ID。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {void} 无返回值。
     */
    function applyResourceCapacityEffect(state, effects, effectId, resourceId) {
        if (!effects[effectId] || !state.resourcesById[resourceId]) {
            return;
        }

        state.resourcesById[resourceId].maxValue += effects[effectId];
    }

    /**
     * 应用单项资源容量移除效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {Object.<string, number>} effects - 建筑效果字典；key 为效果 ID，value 为效果数值。
     * @param {string} effectId - 容量效果 ID。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {void} 无返回值。
     */
    function removeResourceCapacityEffect(state, effects, effectId, resourceId) {
        if (!effects[effectId] || !state.resourcesById[resourceId]) {
            return;
        }

        decreaseCapacityIfPresent(state, resourceId, effects[effectId]);
    }

    /**
     * 发放建筑摧毁返还资源。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {Price[]} refundPrice - 返还资源数组；amount 为非负资源数量。
     * @returns {void} 无返回值。
     */
    function addRefundResources(state, refundPrice) {
        // number 循环索引：遍历返还资源数组的整数下标。
        for (var refundIndex = 0; refundIndex < refundPrice.length; refundIndex += 1) {
            // Price 当前返还项：用于给对应资源入库。
            var refundEntry = refundPrice[refundIndex];

            // ResourceState 资源状态：用于原值写入返还数量。
            var resourceState = state.resourcesById[refundEntry.resource];

            // ResourceDefinition|null 资源定义：用于判断容量限制和首次显示规则。
            var resourceDefinition = game.resources.getResourceDefinition(refundEntry.resource);

            if (!resourceState || !resourceDefinition || refundEntry.amount <= 0) {
                continue;
            }

            if (resourceDefinition.isCapacityLimited) {
                resourceState.value = Math.min(resourceState.maxValue, resourceState.value + refundEntry.amount);
            } else {
                resourceState.value += refundEntry.amount;
            }

            if (game.unlocks.shouldRevealResource(resourceState)) {
                resourceState.isVisible = true;
            }
        }
    }

    /**
     * 格式化建筑摧毁返还日志。
     *
     * @param {Price[]} refundPrice - 返还资源数组；amount 为非负资源数量。
     * @returns {string} 返还资源中文文本。
     */
    function formatRefundLogText(refundPrice) {
        // string[] 返还文本数组：逐项保存资源名和数量。
        var refundTexts = [];

        // number 循环索引：遍历返还资源数组的整数下标。
        for (var refundIndex = 0; refundIndex < refundPrice.length; refundIndex += 1) {
            // Price 当前返还项：用于格式化资源名和数量。
            var refundEntry = refundPrice[refundIndex];

            // ResourceDefinition|null 资源定义：用于读取中文资源名。
            var resourceDefinition = game.resources.getResourceDefinition(refundEntry.resource);

            refundTexts.push((resourceDefinition ? resourceDefinition.name : refundEntry.resource) + " " + refundEntry.amount.toFixed(1));
        }

        return refundTexts.join("，");
    }

    // Object 建筑系统命名空间：提供建筑查询、成本和购买函数。
    game.buildings = {
        getBuildingDefinition: getBuildingDefinition,
        getBuildingPrice: getBuildingPrice,
        getBuildingDestroyRefund: getBuildingDestroyRefund,
        canBuyBuilding: canBuyBuilding,
        buyBuilding: buyBuilding,
        destroyBuilding: destroyBuilding,
        applyBuildingEffects: applyBuildingEffects,
        removeBuildingEffects: removeBuildingEffects,
        applyAllBuildingEffects: applyAllBuildingEffects,
        applyBroadCapacityEffect: applyBroadCapacityEffect
    };
})(window.GoblinEmpire);
