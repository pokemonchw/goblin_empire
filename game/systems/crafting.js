/* 工坊制作系统：负责手工配方、批量制作和制作倍率。 */
/**
 * 初始化工坊制作模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 crafting 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 取得配方定义。
     *
     * @param {string} recipeId - 配方稳定 ID。
     * @returns {CraftRecipeDefinition|null} 配方定义；未找到时返回 null。
     */
    function getRecipeDefinition(recipeId) {
        // number 循环索引：遍历配方定义数组的整数下标。
        for (var recipeIndex = 0; recipeIndex < game.definitions.CRAFT_RECIPE_DEFINITIONS.length; recipeIndex += 1) {
            // CraftRecipeDefinition 当前配方定义：用于匹配配方 ID。
            var recipeDefinition = game.definitions.CRAFT_RECIPE_DEFINITIONS[recipeIndex];

            if (recipeDefinition.id === recipeId) {
                return recipeDefinition;
            }
        }

        return null;
    }

    /**
     * 判断配方是否已解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} recipeId - 配方稳定 ID。
     * @returns {boolean} 是否已解锁；true 表示工坊中可显示。
     */
    function isRecipeUnlocked(state, recipeId) {
        return Boolean(state.craftsUnlockedById[recipeId]);
    }

    /**
     * 计算制作倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 制作倍率，至少为 1。
     */
    function calculateCraftMultiplier(state) {
        // number 基础制作加成比例：后续工坊升级可写入 statistics.craftRatio。
        var craftRatio = state.statistics.craftRatio || 0;

        // number 阶层制作加成比例：后续威望或升级可写入 statistics.tierCraftRatio。
        var tierCraftRatio = state.statistics.tierCraftRatio || 0;

        // number 领袖制作加成比例：有领袖时提供轻微工坊组织加成。
        var leaderCraftRatio = state.leaderGoblinId ? 0.05 : 0;

        return 1 + craftRatio + tierCraftRatio + leaderCraftRatio;
    }

    /**
     * 计算最多可制作次数。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CraftRecipeDefinition} recipeDefinition - 配方定义对象。
     * @returns {number} 最大可制作次数，非负整数。
     */
    function calculateMaxCraftable(state, recipeDefinition) {
        // number 最大次数：从每项成本的库存/单价下限取最小值。
        var maxCount = Infinity;

        // number 循环索引：遍历配方价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < recipeDefinition.price.length; priceIndex += 1) {
            // Price 当前价格项：用于计算该资源可支持的制作次数。
            var priceEntry = recipeDefinition.price[priceIndex];

            // ResourceState 当前资源状态：用于读取库存。
            var resourceState = state.resourcesById[priceEntry.resource];

            if (!resourceState || priceEntry.amount <= 0) {
                return 0;
            }

            maxCount = Math.min(maxCount, Math.floor(resourceState.value / priceEntry.amount));
        }

        if (maxCount === Infinity) {
            return 0;
        }

        return Math.max(0, maxCount);
    }

    /**
     * 判断配方当前是否可制作指定次数。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CraftRecipeDefinition} recipeDefinition - 配方定义对象。
     * @param {number} requestedCount - 请求制作次数，非负整数。
     * @returns {boolean} 是否可制作；true 表示已解锁、未暂停且资源足够。
     */
    function canCraft(state, recipeDefinition, requestedCount) {
        if (state.isPaused || !isRecipeUnlocked(state, recipeDefinition.id) || requestedCount <= 0) {
            return false;
        }

        return game.resources.canAfford(state, getCraftPrice(recipeDefinition, requestedCount));
    }

    /**
     * 计算批量制作价格。
     *
     * @param {CraftRecipeDefinition} recipeDefinition - 配方定义对象。
     * @param {number} requestedCount - 请求制作次数，非负整数。
     * @returns {Price[]} 批量制作价格数组。
     */
    function getCraftPrice(recipeDefinition, requestedCount) {
        return game.pricing.scalePrice(recipeDefinition.price, requestedCount);
    }

    /**
     * 执行手工制作。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} recipeId - 配方稳定 ID。
     * @param {number|"all"} requestedCount - 请求制作次数；"all" 表示尽可能多制作。
     * @returns {boolean} 是否制作成功；true 表示已扣资源并添加产物。
     */
    function craftRecipe(state, recipeId, requestedCount) {
        // CraftRecipeDefinition|null 配方定义：用于读取成本和产物。
        var recipeDefinition = getRecipeDefinition(recipeId);

        if (!recipeDefinition || state.isPaused || !isRecipeUnlocked(state, recipeId)) {
            return false;
        }

        // number 实际制作次数：全部制作时取可支付上限。
        var craftCount = requestedCount === "all" ? calculateMaxCraftable(state, recipeDefinition) : Math.floor(requestedCount);

        if (!canCraft(state, recipeDefinition, craftCount)) {
            return false;
        }

        if (!game.resources.spendResources(state, getCraftPrice(recipeDefinition, craftCount))) {
            return false;
        }

        // number 威望制作加成倍率：特定天赋只影响指定产物。
        var prestigeCraftMultiplier = 1 + calculatePrestigeCraftRatio(state, recipeDefinition);

        // 制作收益按策划公式结算：请求次数乘以基础制作倍率和威望产物倍率。
        var craftedAmount = craftCount * recipeDefinition.outputAmount * calculateCraftMultiplier(state) * prestigeCraftMultiplier;

        game.resources.addResource(state, recipeDefinition.outputResource, craftedAmount);
        applySingleCraftedUpgradeEffect(state, recipeDefinition.outputResource, craftedAmount);
        return true;
    }

    /**
     * 计算威望天赋提供的配方制作加成。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CraftRecipeDefinition} recipeDefinition - 配方定义对象。
     * @returns {number} 配方制作加成比例，非负比例。
     */
    function calculatePrestigeCraftRatio(state, recipeDefinition) {
        if (!game.prestigeSystem) {
            return 0;
        }

        // Object.<string, number> 威望效果字典：用于匹配配方产物。
        var prestigeEffects = game.prestigeSystem.getPrestigeEffects(state);

        if (recipeDefinition.outputResource === "ledger") {
            return Math.max(0, prestigeEffects.ledgerCraftRatio || 0);
        }

        if (recipeDefinition.outputResource === "runePlate") {
            return Math.max(0, prestigeEffects.runePlateCraftRatio || 0);
        }

        if (recipeDefinition.outputResource === "steelIngot" || recipeDefinition.outputResource === "blackIron") {
            return Math.max(0, prestigeEffects.metalCraftRatio || 0);
        }

        return 0;
    }

    /**
     * 选择工程师自动制作配方。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入自动制作配方 ID。
     * @param {string} recipeId - 配方稳定 ID。
     * @returns {boolean} 是否选择成功；true 表示配方已解锁并写入状态。
     */
    function selectAutoCraftRecipe(state, recipeId) {
        if (state.isPaused || !isRecipeUnlocked(state, recipeId)) {
            return false;
        }

        state.statistics.autoCraftRecipeId = recipeId;
        state.statistics.autoCraftProgress = 0;
        return true;
    }

    /**
     * 推进工程师自动制作。
     *
     * @param {GameState} state - 当前游戏状态对象，会消耗资源并产出配方结果。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {number} 本次自动制作次数，非负整数。
     */
    function updateAutoCrafting(state, deltaSeconds) {
        if (state.isPaused || !state.statistics.autoCraftRecipeId) {
            return 0;
        }

        // string 自动制作配方 ID：由玩家在工坊中选择。
        var recipeId = state.statistics.autoCraftRecipeId;

        // CraftRecipeDefinition|null 配方定义：用于检查可制作性。
        var recipeDefinition = getRecipeDefinition(recipeId);

        if (!recipeDefinition || !isRecipeUnlocked(state, recipeId)) {
            return 0;
        }

        // number 自动制作速度：单位为制作次数/秒。
        var autoCraftRate = calculateAutoCraftRate(state);

        if (autoCraftRate <= 0) {
            return 0;
        }

        // number 自动制作进度：达到 1 时尝试制作一次。
        var autoCraftProgress = (state.statistics.autoCraftProgress || 0) + autoCraftRate * deltaSeconds;

        // number 本次制作次数：统计成功自动制作次数。
        var craftedCount = 0;

        while (autoCraftProgress >= 1 && canCraft(state, recipeDefinition, 1)) {
            if (!craftRecipe(state, recipeId, 1)) {
                break;
            }

            autoCraftProgress -= 1;
            craftedCount += 1;
        }

        state.statistics.autoCraftProgress = Math.min(autoCraftProgress, 1);
        return craftedCount;
    }

    /**
     * 计算工程师自动制作速度。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 自动制作速度，单位为制作次数/秒。
     */
    function calculateAutoCraftRate(state) {
        // number 工程师数量：只有工程师推动自动制作。
        var engineerCount = 0;

        // number 技能倍率总和：用于计算工程师技能平均加成。
        var skillMultiplierTotal = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于统计工程师自动制作能力。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive || goblin.jobId !== "engineer") {
                continue;
            }

            engineerCount += 1;
            skillMultiplierTotal += game.jobs.calculateSkillModifier(goblin, "crafting");
        }

        if (engineerCount <= 0) {
            return 0;
        }

        // number 平均技能倍率：工程师技能越高自动制作越快。
        var averageSkillMultiplier = skillMultiplierTotal / engineerCount;

        // number 升级倍率：后续自动滑槽等升级写入 statistics.autoCraftRatio。
        var upgradeMultiplier = 1 + (state.statistics.autoCraftRatio || 0);

        // Object.<string, number> 政策效果字典：帝国官僚等政策强化自动制作。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        return engineerCount * 0.08 * averageSkillMultiplier * (upgradeMultiplier + (policyEffects.autoCraftRatio || 0));
    }

    /**
     * 应用单次制作产物的升级效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {ResourceId} resourceId - 制作产物资源 ID。
     * @param {number} craftedAmount - 本次实际产物数量，非负资源数量。
     * @returns {void} 无返回值。
     */
    function applySingleCraftedUpgradeEffect(state, resourceId, craftedAmount) {
        if (resourceId === "reinforcedBasket") {
            state.resourcesById.rubble.maxValue += 25 * craftedAmount;
            state.resourcesById.coalSlag.maxValue += 10 * craftedAmount;
        }

        if (resourceId === "crudePickaxe") {
            state.statistics.miningToolRatio = (state.statistics.miningToolRatio || 0) + 0.02 * craftedAmount;
        }

        if (resourceId === "sawtoothAxe") {
            state.statistics.woodcuttingToolRatio = (state.statistics.woodcuttingToolRatio || 0) + 0.02 * craftedAmount;
        }

        if (resourceId === "blastFurnace") {
            state.statistics.furnaceOutputRatio = (state.statistics.furnaceOutputRatio || 0) + 0.05 * craftedAmount;
        }

        if (resourceId === "steelIngot") {
            state.resourcesById.ironPlate.maxValue += 20 * craftedAmount;
            state.resourcesById.militaryPower.maxValue += 10 * craftedAmount;
        }

        if (resourceId === "gear") {
            state.resourcesById.labor.maxValue += 20 * craftedAmount;
            state.statistics.autoCraftRatio = (state.statistics.autoCraftRatio || 0) + 0.05 * craftedAmount;
        }

        if (resourceId === "autoChute") {
            state.statistics.autoCraftRatio = (state.statistics.autoCraftRatio || 0) + 0.25 * craftedAmount;
        }

        if (resourceId === "chainmail") {
            state.statistics.raidCasualtyReductionRatio = (state.statistics.raidCasualtyReductionRatio || 0) + 0.1 * craftedAmount;
        }

        if (resourceId === "handcart") {
            state.statistics.tradeRatio = (state.statistics.tradeRatio || 0) + 0.1 * craftedAmount;
            state.resourcesById.fungus.maxValue += 10 * craftedAmount;
            state.resourcesById.rottenWood.maxValue += 10 * craftedAmount;
            state.resourcesById.rubble.maxValue += 10 * craftedAmount;
            state.resourcesById.ironOre.maxValue += 5 * craftedAmount;
        }

        if (resourceId === "overseerWhip") {
            state.resourcesById.obedience.maxValue += 5 * craftedAmount;
            state.resourcesById.obedience.value = Math.min(state.resourcesById.obedience.maxValue, state.resourcesById.obedience.value + 5 * craftedAmount);
            state.statistics.stabilityRatio = (state.statistics.stabilityRatio || 0) + 0.05 * craftedAmount;
        }

        if (resourceId === "blackIron") {
            state.resourcesById.blackIron.maxValue += 10 * craftedAmount;
            state.resourcesById.steelIngot.maxValue += 10 * craftedAmount;
        }

        if (resourceId === "runePlate") {
            state.resourcesById.crudeKnowledge.maxValue += 50 * craftedAmount;
        }

        if (resourceId === "warBanner") {
            state.statistics.raidEquipmentRatio = (state.statistics.raidEquipmentRatio || 0) + 0.03 * craftedAmount;
        }

        if (resourceId === "runeCarvingKnife") {
            state.statistics.crudeKnowledgeOutputRatio = (state.statistics.crudeKnowledgeOutputRatio || 0) + 0.04 * craftedAmount;
        }

        if (resourceId === "deepFurnaceValve") {
            state.statistics.furnaceOutputRatio = (state.statistics.furnaceOutputRatio || 0) + 0.08 * craftedAmount;
        }
    }

    /**
     * 按当前制作资源库存重建工坊升级效果。
     *
     * @param {GameState} state - 当前游戏状态对象，会重建工坊产出和容量加成。
     * @returns {void} 无返回值。
     */
    function applyCraftedUpgradeEffects(state) {
        state.statistics.miningToolRatio = 0;
        state.statistics.woodcuttingToolRatio = 0;
        state.statistics.furnaceOutputRatio = 0;
        state.statistics.autoCraftRatio = 0;
        state.statistics.raidEquipmentRatio = 0;
        state.statistics.raidCasualtyReductionRatio = 0;
        state.statistics.crudeKnowledgeOutputRatio = 0;
        state.statistics.tradeRatio = 0;
        state.statistics.stabilityRatio = 0;

        applySingleCraftedUpgradeEffect(state, "reinforcedBasket", state.resourcesById.reinforcedBasket ? state.resourcesById.reinforcedBasket.value : 0);
        applySingleCraftedUpgradeEffect(state, "crudePickaxe", state.resourcesById.crudePickaxe ? state.resourcesById.crudePickaxe.value : 0);
        applySingleCraftedUpgradeEffect(state, "sawtoothAxe", state.resourcesById.sawtoothAxe ? state.resourcesById.sawtoothAxe.value : 0);
        applySingleCraftedUpgradeEffect(state, "blastFurnace", state.resourcesById.blastFurnace ? state.resourcesById.blastFurnace.value : 0);
        applySingleCraftedUpgradeEffect(state, "steelIngot", state.resourcesById.steelIngot ? state.resourcesById.steelIngot.value : 0);
        applySingleCraftedUpgradeEffect(state, "gear", state.resourcesById.gear ? state.resourcesById.gear.value : 0);
        applySingleCraftedUpgradeEffect(state, "autoChute", state.resourcesById.autoChute ? state.resourcesById.autoChute.value : 0);
        applySingleCraftedUpgradeEffect(state, "chainmail", state.resourcesById.chainmail ? state.resourcesById.chainmail.value : 0);
        applySingleCraftedUpgradeEffect(state, "handcart", state.resourcesById.handcart ? state.resourcesById.handcart.value : 0);
        applySingleCraftedUpgradeEffect(state, "overseerWhip", state.resourcesById.overseerWhip ? state.resourcesById.overseerWhip.value : 0);
        applySingleCraftedUpgradeEffect(state, "blackIron", state.resourcesById.blackIron ? state.resourcesById.blackIron.value : 0);
        applySingleCraftedUpgradeEffect(state, "runePlate", state.resourcesById.runePlate ? state.resourcesById.runePlate.value : 0);
        applySingleCraftedUpgradeEffect(state, "warBanner", state.resourcesById.warBanner ? state.resourcesById.warBanner.value : 0);
        applySingleCraftedUpgradeEffect(state, "runeCarvingKnife", state.resourcesById.runeCarvingKnife ? state.resourcesById.runeCarvingKnife.value : 0);
        applySingleCraftedUpgradeEffect(state, "deepFurnaceValve", state.resourcesById.deepFurnaceValve ? state.resourcesById.deepFurnaceValve.value : 0);
    }

    // Object 工坊制作模块命名空间：提供配方查询、倍率和制作函数。
    game.crafting = {
        getRecipeDefinition: getRecipeDefinition,
        isRecipeUnlocked: isRecipeUnlocked,
        calculateCraftMultiplier: calculateCraftMultiplier,
        calculateMaxCraftable: calculateMaxCraftable,
        canCraft: canCraft,
        getCraftPrice: getCraftPrice,
        craftRecipe: craftRecipe,
        selectAutoCraftRecipe: selectAutoCraftRecipe,
        updateAutoCrafting: updateAutoCrafting,
        calculateAutoCraftRate: calculateAutoCraftRate,
        applySingleCraftedUpgradeEffect: applySingleCraftedUpgradeEffect,
        applyCraftedUpgradeEffects: applyCraftedUpgradeEffects
    };
})(window.GoblinEmpire);
