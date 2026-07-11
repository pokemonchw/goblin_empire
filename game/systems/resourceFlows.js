/* 资源流量分析系统：为资源悬浮框提供不改动状态的产消耗拆分。 */
/**
 * 初始化资源流量分析模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 resourceFlows 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 分析单个资源的当前持续流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {ResourceFlowSummary} 资源流量摘要；包含产出、消耗、加成、buff、最终产出和爆仓时间。
     */
    function analyzeResourceFlow(state, resourceId) {
        // ResourceFlowEntry[] 流量条目数组：记录所有资源的持续产消耗来源。
        var flowEntries = collectFlowEntries(state);

        // ResourceFlowEntry[] 目标流量条目数组：只保留当前资源的来源。
        var targetEntries = filterEntriesByResource(flowEntries, resourceId);

        // ResourceFlowEntry[] 产出条目数组：当前资源的正向每秒来源。
        var outputEntries = filterEntriesByKind(targetEntries, "output");

        // ResourceFlowEntry[] 消耗条目数组：当前资源的负向每秒来源。
        var consumptionEntries = filterEntriesByKind(targetEntries, "consumption");

        // ResourceBonusEntry[] 加成条目数组：影响当前资源的倍率或修正说明。
        var bonusEntries = collectBonusEntries(state, resourceId);

        // string[] buff 文本数组：显示暂停、临时事件、自动制作和容量状态。
        var buffTexts = collectBuffTexts(state, resourceId);

        // number 总产出速度：当前资源正向持续来源之和，单位资源/秒。
        var totalOutputPerSecond = sumEntryAmounts(outputEntries);

        // number 总消耗速度：当前资源负向持续来源绝对值之和，单位资源/秒。
        var totalConsumptionPerSecond = sumEntryAmounts(consumptionEntries);

        // ResourceState|null 资源状态：用于读取最终产出和容量爆仓时间。
        var resourceState = state.resourcesById[resourceId] || null;

        // number 最终产出速度：优先使用运行时净值，确保显示口径与模拟一致。
        var finalPerSecond = resourceState ? resourceState.perSecond : totalOutputPerSecond - totalConsumptionPerSecond;

        return {
            resourceId: resourceId,
            outputEntries: outputEntries,
            consumptionEntries: consumptionEntries,
            bonusEntries: bonusEntries,
            buffTexts: buffTexts,
            totalOutputPerSecond: totalOutputPerSecond,
            totalConsumptionPerSecond: totalConsumptionPerSecond,
            finalPerSecond: finalPerSecond,
            timeToFullText: formatTimeToFull(state, resourceId, finalPerSecond)
        };
    }

    /**
     * 汇总所有当前持续流量条目。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {ResourceFlowEntry[]} 流量条目数组；每项包含 resource、kind、amount、source 和 detail。
     */
    function collectFlowEntries(state) {
        // ResourceFlowEntry[] 流量条目数组：逐类追加持续来源。
        var flowEntries = [];

        appendJobFlowEntries(state, flowEntries);
        appendBuildingFlowEntries(state, flowEntries);
        appendPopulationFlowEntries(state, flowEntries);
        appendPactFlowEntries(state, flowEntries);
        appendAutoCraftFlowEntries(state, flowEntries);

        return flowEntries;
    }

    /**
     * 追加职业产出流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加职业产出。
     * @returns {void} 无返回值。
     */
    function appendJobFlowEntries(state, flowEntries) {
        // Object.<string, number> 职业资源汇总字典：key 为资源 ID，value 为每秒产出。
        var totalsByResourceAndJob = {};

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于读取职业和个体倍率。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive || !goblin.jobId) {
                continue;
            }

            // JobDefinition|null 职业定义：用于读取基础产出。
            var jobDefinition = game.jobs.getJobDefinition(goblin.jobId);

            if (!jobDefinition) {
                continue;
            }

            // number 职业综合倍率：复用职业系统结算公式。
            var outputModifier = game.jobs.calculateJobOutputModifier(state, goblin, jobDefinition);

            // string[] 资源 ID 数组：遍历当前职业基础产出。
            var outputResourceIds = Object.keys(jobDefinition.baseOutput);

            // number 产出循环索引：遍历职业产出资源 ID 的整数下标。
            for (var outputIndex = 0; outputIndex < outputResourceIds.length; outputIndex += 1) {
                // ResourceId 当前资源 ID：职业产出的目标资源。
                var resourceId = outputResourceIds[outputIndex];

                // number 每秒产出：每 tick 基础产出乘 tick 频率和个体倍率。
                var perSecond = jobDefinition.baseOutput[resourceId] * game.definitions.TICKS_PER_SECOND * outputModifier;

                // string 汇总键：资源 ID 与职业 ID 组成的稳定键。
                var summaryKey = resourceId + "|" + jobDefinition.id;

                totalsByResourceAndJob[summaryKey] = (totalsByResourceAndJob[summaryKey] || 0) + perSecond;
            }
        }

        // string[] 汇总键数组：用于生成职业流量条目。
        var summaryKeys = Object.keys(totalsByResourceAndJob);

        // number 汇总循环索引：遍历职业汇总键的整数下标。
        for (var summaryIndex = 0; summaryIndex < summaryKeys.length; summaryIndex += 1) {
            // string 汇总键：由资源 ID 和职业 ID 组成。
            var summaryKeyValue = summaryKeys[summaryIndex];

            // string[] 汇总字段数组：第 0 项为资源 ID，第 1 项为职业 ID。
            var summaryParts = summaryKeyValue.split("|");

            // JobDefinition|null 汇总职业定义：用于显示职业中文名。
            var summaryJobDefinition = game.jobs.getJobDefinition(summaryParts[1]);

            pushFlowEntry(flowEntries, summaryParts[0], "output", totalsByResourceAndJob[summaryKeyValue], summaryJobDefinition ? summaryJobDefinition.name : summaryParts[1], "职业产出");
        }
    }

    /**
     * 追加建筑和转换流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加建筑产消耗。
     * @returns {void} 无返回值。
     */
    function appendBuildingFlowEntries(state, flowEntries) {
        appendPerTickBuildingEntry(state, flowEntries, "fungus_bed", "fungusPerTick", "fungus");
        if (isProductionLaborOverloaded(state)) {
            return;
        }
        appendPerTickBuildingEntry(state, flowEntries, "rotten_grove", "rottenWoodPerTick", "rottenWood");
        appendPerTickBuildingEntry(state, flowEntries, "shallow_mine", "coalSlagPerTick", "coalSlag");
        appendPerTickBuildingEntry(state, flowEntries, "rubble_yard", "coalSlagPerTick", "coalSlag");
        appendPerSecondBuildingEntry(state, flowEntries, "beast_pen", "leatherPerSecond", "leather");
        appendPerSecondBuildingEntry(state, flowEntries, "beast_pen", "boneShardPerSecond", "boneShard");
        appendPerSecondBuildingEntry(state, flowEntries, "bad_wine_barrel", "obediencePerSecond", "obedience");
        appendPerSecondBuildingEntry(state, flowEntries, "chief_hall", "obediencePerSecond", "obedience");
        appendPerSecondBuildingEntry(state, flowEntries, "black_market", "coinPerSecond", "coin");
        appendPerSecondBuildingEntry(state, flowEntries, "ledger_room", "ledgerPerSecond", "ledger");
        appendPerSecondBuildingEntry(state, flowEntries, "ancestral_altar", "ancestralEchoPerSecond", "ancestralEcho");
        appendPerSecondBuildingEntry(state, flowEntries, "tar_well", "tarPerSecond", "tar");
        appendPerSecondBuildingEntry(state, flowEntries, "abyss_gate", "abyssEchoPerSecond", "abyssEcho");
        appendPerSecondBuildingEntry(state, flowEntries, "sacrifice_pit", "abyssEchoPerSecond", "abyssEcho");
        appendCharcoalKilnEntries(state, flowEntries);
        appendCrudeFurnaceEntries(state, flowEntries);
        appendDeepFurnaceEntries(state, flowEntries);
        appendRuneMachineEntries(state, flowEntries);
    }

    /**
     * 追加单项每 tick 建筑产出。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加建筑产出。
     * @param {BuildingId} buildingId - 建筑稳定 ID。
     * @param {string} effectId - 建筑效果 ID。
     * @param {ResourceId} resourceId - 产出资源稳定 ID。
     * @returns {void} 无返回值。
     */
    function appendPerTickBuildingEntry(state, flowEntries, buildingId, effectId, resourceId) {
        // BuildingDefinition|null 建筑定义：用于读取效果和名称。
        var buildingDefinition = game.buildings.getBuildingDefinition(buildingId);

        // BuildingState 建筑状态：用于读取启用数量。
        var buildingState = state.buildingsById[buildingId];

        if (!buildingDefinition || !buildingState || buildingState.active <= 0 || !buildingDefinition.effects[effectId]) {
            return;
        }

        // number 每秒产出：每 tick 产出乘以 tick 频率和启用数量。
        var perSecond = buildingDefinition.effects[effectId] * game.definitions.TICKS_PER_SECOND * buildingState.active;

        if (resourceId === "fungus" && state.statistics.fungusBloomSeconds > 0) {
            perSecond *= 1.5;
        }

        if (resourceId === "fungus" && game.rituals) {
            // Object.<string, number> 祖灵升级效果字典：读取菌菇产出倍率。
            var ritualEffects = game.rituals.getRitualEffects(state);

            perSecond *= 1 + (ritualEffects.fungusOutputRatio || 0);
        }

        if (resourceId === "rottenWood") {
            perSecond *= 1 + getOwnedBuildingEffectTotal(state, "rottenWoodOutputRatio") + (state.statistics.woodcuttingToolRatio || 0);
        }

        // number 天气产出倍率：与真实生产系统保持一致。
        var weatherMultiplier = game.weather ? game.weather.calculateResourceOutputMultiplier(state, resourceId) : 1;

        perSecond *= weatherMultiplier;

        pushFlowEntry(flowEntries, resourceId, "output", perSecond, buildingDefinition.name, "建筑自动产出");
    }

    /**
     * 追加单项每秒建筑产出。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加建筑产出。
     * @param {BuildingId} buildingId - 建筑稳定 ID。
     * @param {string} effectId - 建筑效果 ID。
     * @param {ResourceId} resourceId - 产出资源稳定 ID。
     * @returns {void} 无返回值。
     */
    function appendPerSecondBuildingEntry(state, flowEntries, buildingId, effectId, resourceId) {
        // BuildingDefinition|null 建筑定义：用于读取效果和名称。
        var buildingDefinition = game.buildings.getBuildingDefinition(buildingId);

        // BuildingState 建筑状态：用于读取启用数量。
        var buildingState = state.buildingsById[buildingId];

        if (!buildingDefinition || !buildingState || buildingState.active <= 0 || !buildingDefinition.effects[effectId]) {
            return;
        }

        // number 每秒产出：单建筑每秒产出乘以启用数量。
        var perSecond = buildingDefinition.effects[effectId] * buildingState.active;

        if (resourceId === "ancestralEcho" && game.rituals) {
            // Object.<string, number> 祖灵升级效果字典：读取祖灵回响产出倍率。
            var ritualEffects = game.rituals.getRitualEffects(state);

            perSecond *= 1 + (ritualEffects.ancestralEchoOutputRatio || 0);
        }

        pushFlowEntry(flowEntries, resourceId, "output", perSecond, buildingDefinition.name, "建筑自动产出");
    }

    /**
     * 追加粗熔炉转换流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加粗熔炉产消耗。
     * @returns {void} 无返回值。
     */
    function appendCrudeFurnaceEntries(state, flowEntries) {
        // BuildingDefinition|null 建筑定义：用于读取粗熔炉效果。
        var buildingDefinition = game.buildings.getBuildingDefinition("crude_furnace");

        // BuildingState 建筑状态：用于读取启用数量。
        var buildingState = state.buildingsById.crude_furnace;

        if (!buildingDefinition || !buildingState || buildingState.active <= 0) {
            return;
        }

        if (!game.resources.canAfford(state, [
            {
                resource: "rottenWood",
                amount: buildingDefinition.effects.crudeFurnaceWoodCostPerSecond * buildingState.active
            },
            {
                resource: "rubble",
                amount: buildingDefinition.effects.crudeFurnaceRubbleCostPerSecond * buildingState.active
            }
        ])) {
            return;
        }

        // number 工业产出倍率：工坊、祖灵、政策和契约共同影响。
        var outputMultiplier = getIndustrialOutputMultiplier(state);

        pushFlowEntry(flowEntries, "rottenWood", "consumption", buildingDefinition.effects.crudeFurnaceWoodCostPerSecond * buildingState.active, buildingDefinition.name, "熔炼燃料");
        pushFlowEntry(flowEntries, "rubble", "consumption", buildingDefinition.effects.crudeFurnaceRubbleCostPerSecond * buildingState.active, buildingDefinition.name, "熔炼炉料");
        pushFlowEntry(flowEntries, "ironOre", "output", buildingDefinition.effects.crudeFurnaceIronOrePerSecond * outputMultiplier * buildingState.active, buildingDefinition.name, "熔炼产出");
        pushFlowEntry(flowEntries, "ironPlate", "output", buildingDefinition.effects.crudeFurnaceIronPlatePerSecond * outputMultiplier * buildingState.active, buildingDefinition.name, "熔炼产出");
    }

    /**
     * 追加闷炭窑转换流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加闷炭窑产消耗。
     * @returns {void} 无返回值。
     */
    function appendCharcoalKilnEntries(state, flowEntries) {
        // BuildingDefinition|null 建筑定义：用于读取闷炭窑效果。
        var buildingDefinition = game.buildings.getBuildingDefinition("charcoal_kiln");

        // BuildingState 建筑状态：用于读取启用数量。
        var buildingState = state.buildingsById.charcoal_kiln;

        if (!buildingDefinition || !buildingState || buildingState.active <= 0) {
            return;
        }

        if (!game.resources.canAfford(state, [
            {
                resource: "rottenWood",
                amount: buildingDefinition.effects.charcoalKilnWoodCostPerSecond * buildingState.active
            }
        ])) {
            return;
        }

        pushFlowEntry(flowEntries, "rottenWood", "consumption", buildingDefinition.effects.charcoalKilnWoodCostPerSecond * buildingState.active, buildingDefinition.name, "闷炭燃料");
        pushFlowEntry(flowEntries, "coalSlag", "output", buildingDefinition.effects.charcoalKilnCoalSlagPerSecond * buildingState.active, buildingDefinition.name, "闷炭产出");
    }

    /**
     * 追加深炉转换流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加深炉产消耗。
     * @returns {void} 无返回值。
     */
    function appendDeepFurnaceEntries(state, flowEntries) {
        // BuildingDefinition|null 建筑定义：用于读取深炉效果。
        var buildingDefinition = game.buildings.getBuildingDefinition("deep_furnace");

        // BuildingState 建筑状态：用于读取启用数量。
        var buildingState = state.buildingsById.deep_furnace;

        if (!buildingDefinition || !buildingState || buildingState.active <= 0) {
            return;
        }

        // number 阀门减耗比例：深炉阀门降低焦油消耗。
        var valveReductionRatio = Math.min(0.75, (state.resourcesById.deepFurnaceValve ? state.resourcesById.deepFurnaceValve.value : 0) * 0.03);

        if (!game.resources.canAfford(state, [
            {
                resource: "tar",
                amount: buildingDefinition.effects.deepFurnaceTarCostPerSecond * buildingState.active * Math.max(0, 1 - valveReductionRatio)
            }
        ])) {
            return;
        }

        // number 工业产出倍率：工坊、祖灵、政策和契约共同影响。
        var outputMultiplier = getIndustrialOutputMultiplier(state);

        pushFlowEntry(flowEntries, "tar", "consumption", buildingDefinition.effects.deepFurnaceTarCostPerSecond * buildingState.active * Math.max(0, 1 - valveReductionRatio), buildingDefinition.name, "深炉燃料");
        pushFlowEntry(flowEntries, "steelIngot", "output", buildingDefinition.effects.deepFurnaceSteelPerSecond * outputMultiplier * buildingState.active, buildingDefinition.name, "深炉产出");
        pushFlowEntry(flowEntries, "blackIron", "output", buildingDefinition.effects.deepFurnaceBlackIronPerSecond * outputMultiplier * buildingState.active, buildingDefinition.name, "深炉产出");
    }

    /**
     * 追加符文机房转换流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加符文机房产消耗。
     * @returns {void} 无返回值。
     */
    function appendRuneMachineEntries(state, flowEntries) {
        // BuildingDefinition|null 建筑定义：用于读取符文机房效果。
        var buildingDefinition = game.buildings.getBuildingDefinition("rune_machine_room");

        // BuildingState 建筑状态：用于读取启用数量。
        var buildingState = state.buildingsById.rune_machine_room;

        if (!buildingDefinition || !buildingState || buildingState.active <= 0) {
            return;
        }

        if (!game.resources.canAfford(state, [
            {
                resource: "manaCrystal",
                amount: buildingDefinition.effects.runeMachineManaCostPerSecond * buildingState.active
            }
        ])) {
            return;
        }

        pushFlowEntry(flowEntries, "manaCrystal", "consumption", buildingDefinition.effects.runeMachineManaCostPerSecond * buildingState.active, buildingDefinition.name, "符文机房燃料");
        pushFlowEntry(flowEntries, "crudeKnowledge", "output", buildingDefinition.effects.runeMachineKnowledgePerSecond * buildingState.active * (1 + (state.statistics.crudeKnowledgeOutputRatio || 0)), buildingDefinition.name, "符文研究产出");
    }

    /**
     * 追加口粮消耗流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加哥布林与俘虏口粮消耗。
     * @returns {void} 无返回值。
     */
    function appendPopulationFlowEntries(state, flowEntries) {
        // number 菌菇消耗速度：人口口粮每秒消耗。
        var fungusConsumptionPerSecond = game.population.calculateFungusConsumptionPerSecond(state);

        pushFlowEntry(flowEntries, "fungus", "consumption", fungusConsumptionPerSecond, "人口口粮", "哥布林与俘虏消耗");
    }

    /**
     * 追加契约资源代价流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加契约消耗。
     * @returns {void} 无返回值。
     */
    function appendPactFlowEntries(state, flowEntries) {
        // Object.<string, number> 契约效果字典：读取每秒资源代价。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        pushFlowEntry(flowEntries, "obedience", "consumption", pactEffects.obedienceDrainPerSecond || 0, "深渊契约", "契约维持代价");
    }

    /**
     * 追加工程师自动制作预估流量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会追加自动制作预估。
     * @returns {void} 无返回值。
     */
    function appendAutoCraftFlowEntries(state, flowEntries) {
        if (!state.statistics.autoCraftRecipeId || !game.crafting) {
            return;
        }

        // CraftRecipeDefinition|null 配方定义：用于读取成本和产物。
        var recipeDefinition = game.crafting.getRecipeDefinition(state.statistics.autoCraftRecipeId);

        if (!recipeDefinition || !game.crafting.isRecipeUnlocked(state, recipeDefinition.id)) {
            return;
        }

        // number 自动制作速度：单位为制作次数/秒。
        var autoCraftRate = game.crafting.calculateAutoCraftRate(state);

        if (autoCraftRate <= 0) {
            return;
        }

        // Price[] 制作成本数组：用于推算每秒消耗。
        var price = game.crafting.getCraftPrice(state, recipeDefinition, 1);

        if (!game.crafting.canCraft(state, recipeDefinition, 1)) {
            return;
        }

        // number 成本循环索引：遍历配方成本的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前成本项：用于转换为每秒消耗。
            var priceEntry = price[priceIndex];

            pushFlowEntry(flowEntries, priceEntry.resource, "consumption", priceEntry.amount * autoCraftRate, recipeDefinition.name, "工程师自动制作预估");
        }

        // number 制作倍率：影响每次自动制作产物数量。
        var craftMultiplier = game.crafting.calculateCraftMultiplier(state, recipeDefinition);

        pushFlowEntry(flowEntries, recipeDefinition.outputResource, "output", recipeDefinition.outputAmount * craftMultiplier * autoCraftRate, recipeDefinition.name, "工程师自动制作预估");
    }

    /**
     * 读取工业产出倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 工业产出倍率，至少为 0。
     */
    function getIndustrialOutputMultiplier(state) {
        // Object.<string, number> 祖灵升级效果字典：读取工业产出倍率。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 政策效果字典：读取工业产出倍率。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：读取工业产出倍率。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 天气工业倍率：酸雾等天气会轻微压制炉火产出。
        var weatherMultiplier = game.weather ? game.weather.calculateResourceOutputMultiplier(state, "ironPlate") : 1;

        return Math.max(0, 1 + (state.statistics.furnaceOutputRatio || 0) + (ritualEffects.industrialOutputRatio || 0) + (policyEffects.industrialOutputRatio || 0) + (pactEffects.industrialOutputRatio || 0)) * weatherMultiplier;
    }

    /**
     * 统计已拥有建筑的指定效果总和。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} effectId - 建筑效果 ID。
     * @returns {number} 效果总和，非负或有符号浮点数，取决于效果定义。
     */
    function getOwnedBuildingEffectTotal(state, effectId) {
        if (isProductionLaborOverloaded(state)) {
            return 0;
        }

        // number 效果总和：按建筑拥有数量累加。
        var effectTotal = 0;

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取指定效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (!buildingState || !buildingDefinition.effects[effectId]) {
                continue;
            }

            effectTotal += buildingDefinition.effects[effectId] * buildingState.owned;
        }

        return effectTotal;
    }

    /**
     * 判断建筑流量是否因劳力过载而停摆。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否劳力过载；true 表示非菌菇床建筑流量不再预估。
     */
    function isProductionLaborOverloaded(state) {
        return Boolean(game.population && game.population.isProductionLaborOverloaded && game.population.isProductionLaborOverloaded(state));
    }

    /**
     * 追加流量条目。
     *
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组，会被追加。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {"output"|"consumption"} kind - 条目类型；output 表示产出，consumption 表示消耗。
     * @param {number} amount - 每秒数量，非负浮点数。
     * @param {string} source - 来源中文名称。
     * @param {string} detail - 来源说明文本。
     * @returns {void} 无返回值。
     */
    function pushFlowEntry(flowEntries, resourceId, kind, amount, source, detail) {
        if (!amount || amount <= 0) {
            return;
        }

        flowEntries.push({
            resource: resourceId,
            kind: kind,
            amount: amount,
            source: source,
            detail: detail
        });
    }

    /**
     * 按资源 ID 过滤流量条目。
     *
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {ResourceFlowEntry[]} 只属于目标资源的条目数组。
     */
    function filterEntriesByResource(flowEntries, resourceId) {
        // ResourceFlowEntry[] 目标条目数组：保存匹配资源 ID 的流量。
        var targetEntries = [];

        // number 循环索引：遍历流量条目的整数下标。
        for (var entryIndex = 0; entryIndex < flowEntries.length; entryIndex += 1) {
            // Object 当前流量条目：用于检查资源 ID。
            var flowEntry = flowEntries[entryIndex];

            if (flowEntry.resource === resourceId) {
                targetEntries.push(flowEntry);
            }
        }

        return targetEntries;
    }

    /**
     * 按类型过滤流量条目。
     *
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组。
     * @param {"output"|"consumption"} kind - 目标类型。
     * @returns {ResourceFlowEntry[]} 匹配类型的条目数组。
     */
    function filterEntriesByKind(flowEntries, kind) {
        // ResourceFlowEntry[] 目标条目数组：保存匹配类型的流量。
        var targetEntries = [];

        // number 循环索引：遍历流量条目的整数下标。
        for (var entryIndex = 0; entryIndex < flowEntries.length; entryIndex += 1) {
            // Object 当前流量条目：用于检查类型。
            var flowEntry = flowEntries[entryIndex];

            if (flowEntry.kind === kind) {
                targetEntries.push(flowEntry);
            }
        }

        return targetEntries;
    }

    /**
     * 求和流量条目数量。
     *
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组。
     * @returns {number} 每秒数量总和，非负浮点数。
     */
    function sumEntryAmounts(flowEntries) {
        // number 数量总和：累加每秒数量。
        var amountTotal = 0;

        // number 循环索引：遍历流量条目的整数下标。
        for (var entryIndex = 0; entryIndex < flowEntries.length; entryIndex += 1) {
            // Object 当前流量条目：用于读取每秒数量。
            var flowEntry = flowEntries[entryIndex];

            amountTotal += flowEntry.amount;
        }

        return amountTotal;
    }

    /**
     * 收集资源加成说明。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {ResourceBonusEntry[]} 加成条目数组；每项包含 label 和 value。
     */
    function collectBonusEntries(state, resourceId) {
        // ResourceBonusEntry[] 加成条目数组：按当前资源追加相关倍率。
        var bonusEntries = [];

        appendJobBonusEntries(state, resourceId, bonusEntries);
        appendIndustrialBonusEntries(state, resourceId, bonusEntries);
        appendCraftBonusEntries(state, resourceId, bonusEntries);
        appendChallengeBonusEntry(state, resourceId, bonusEntries);

        return bonusEntries;
    }

    /**
     * 追加职业相关加成说明。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {ResourceBonusEntry[]} bonusEntries - 加成条目数组，会被追加。
     * @returns {void} 无返回值。
     */
    function appendJobBonusEntries(state, resourceId, bonusEntries) {
        if (resourceId === "fungus" && state.statistics.fungusBloomSeconds > 0) {
            bonusEntries.push({ label: "菌潮", value: "+50%" });
        }

        if (resourceId === "fungus" && state.technologiesById.foraging && state.technologiesById.foraging.isResearched) {
            bonusEntries.push({ label: "采菌科技", value: "+5%" });
        }

        if (resourceId === "rubble" || resourceId === "coalSlag" || resourceId === "ironOre") {
            bonusEntries.push({ label: "采矿工具", value: formatPercentRatio(state.statistics.miningToolRatio || 0) });
        }

        if (resourceId === "rottenWood") {
            bonusEntries.push({ label: "晾木架", value: formatPercentRatio(getOwnedBuildingEffectTotal(state, "rottenWoodOutputRatio")) });
            bonusEntries.push({ label: "锯齿斧", value: formatPercentRatio(state.statistics.woodcuttingToolRatio || 0) });
        }

        if (resourceId === "crudeKnowledge") {
            bonusEntries.push({ label: "粗识工坊升级", value: formatPercentRatio(state.statistics.crudeKnowledgeOutputRatio || 0) });
        }

        // ResourceState|null 服从资源状态：用于说明全局职业倍率。
        var obedienceState = state.resourcesById.obedience || null;

        if (obedienceState) {
            bonusEntries.push({ label: "服从修正", value: "x" + game.jobs.calculateObedienceModifier(state).toFixed(2) });
        }

        if (game.weather) {
            bonusEntries.push({ label: "当前天气", value: "x" + game.weather.calculateResourceOutputMultiplier(state, resourceId).toFixed(2) });
        }
    }

    /**
     * 追加工业加成说明。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {ResourceBonusEntry[]} bonusEntries - 加成条目数组，会被追加。
     * @returns {void} 无返回值。
     */
    function appendIndustrialBonusEntries(state, resourceId, bonusEntries) {
        if (resourceId !== "ironOre" && resourceId !== "ironPlate" && resourceId !== "steelIngot" && resourceId !== "blackIron") {
            return;
        }

        bonusEntries.push({ label: "熔炉产出", value: "x" + getIndustrialOutputMultiplier(state).toFixed(2) });
    }

    /**
     * 追加自动制作加成说明。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {ResourceBonusEntry[]} bonusEntries - 加成条目数组，会被追加。
     * @returns {void} 无返回值。
     */
    function appendCraftBonusEntries(state, resourceId, bonusEntries) {
        if (!state.statistics.autoCraftRecipeId || !game.crafting) {
            return;
        }

        // CraftRecipeDefinition|null 配方定义：用于判断资源是否为自动制作产物。
        var recipeDefinition = game.crafting.getRecipeDefinition(state.statistics.autoCraftRecipeId);

        if (recipeDefinition && recipeDefinition.outputResource === resourceId) {
            bonusEntries.push({ label: "自动制作倍率", value: "x" + game.crafting.calculateCraftMultiplier(state, recipeDefinition).toFixed(2) });
        }
    }

    /**
     * 追加挑战资源收益倍率说明。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {ResourceBonusEntry[]} bonusEntries - 加成条目数组，会被追加。
     * @returns {void} 无返回值。
     */
    function appendChallengeBonusEntry(state, resourceId, bonusEntries) {
        if (!game.challengesSystem) {
            return;
        }

        // number 挑战资源收益倍率：包含挑战惩罚和奖励。
        var challengeMultiplier = game.challengesSystem.getResourceGainMultiplier(state, resourceId);

        if (challengeMultiplier !== 1) {
            bonusEntries.push({ label: "挑战规则", value: "x" + challengeMultiplier.toFixed(2) });
        }
    }

    /**
     * 收集资源 buff 和状态提示。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {string[]} buff 文本数组。
     */
    function collectBuffTexts(state, resourceId) {
        // string[] buff 文本数组：显示影响当前资源的状态。
        var buffTexts = [];

        // ResourceState|null 资源状态：用于判断容量和可见性。
        var resourceState = state.resourcesById[resourceId] || null;

        if (state.isPaused) {
            buffTexts.push("已暂停：当前不推进生产和消耗");
        }

        if (resourceId === "fungus" && state.statistics.fungusBloomSeconds > 0) {
            buffTexts.push("菌潮剩余 " + Math.ceil(state.statistics.fungusBloomSeconds) + " 秒");
        }

        if (resourceId === "fungus" && state.statistics.pendingStarvationConsequence) {
            // number 断粮累计天数：用于提示距离下一次死亡结算的进度。
            var starvationDays = game.calendar.calculateDaysFromSeconds(state.statistics.starvationSeconds || 0);

            buffTexts.push("断粮累计 " + starvationDays.toFixed(1) + " / " + game.definitions.POPULATION_CONSTANTS.starvationCheckDays + " 天");
        }

        if (resourceState && resourceState.value >= resourceState.maxValue) {
            buffTexts.push("库存已达上限");
        }

        if (state.statistics.autoCraftRecipeId && game.crafting) {
            // CraftRecipeDefinition|null 配方定义：用于显示自动制作目标。
            var recipeDefinition = game.crafting.getRecipeDefinition(state.statistics.autoCraftRecipeId);

            if (recipeDefinition && (recipeDefinition.outputResource === resourceId || priceContainsResource(game.crafting.getCraftPrice(state, recipeDefinition, 1), resourceId))) {
                buffTexts.push("自动制作：" + recipeDefinition.name);
            }
        }

        return buffTexts;
    }

    /**
     * 判断价格是否包含某资源。
     *
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {boolean} 是否包含目标资源。
     */
    function priceContainsResource(price, resourceId) {
        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前价格项：用于匹配资源 ID。
            var priceEntry = price[priceIndex];

            if (priceEntry.resource === resourceId) {
                return true;
            }
        }

        return false;
    }

    /**
     * 格式化库存爆仓时间。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @param {number} finalPerSecond - 最终产出速度，单位资源/秒。
     * @returns {string} 库存爆仓时间文本。
     */
    function formatTimeToFull(state, resourceId, finalPerSecond) {
        // ResourceState|null 资源状态：用于读取库存和容量。
        var resourceState = state.resourcesById[resourceId] || null;

        // ResourceDefinition|null 资源定义：用于判断是否有容量上限。
        var resourceDefinition = game.resources.getResourceDefinition(resourceId);

        if (!resourceState || !resourceDefinition || !resourceDefinition.isCapacityLimited || finalPerSecond <= 0) {
            return "不会爆仓";
        }

        if (resourceState.value >= resourceState.maxValue) {
            return "已爆仓";
        }

        // number 剩余容量：到达库存上限前还能容纳的资源数量。
        var remainingCapacity = Math.max(0, resourceState.maxValue - resourceState.value);

        // number 爆仓秒数：剩余容量除以最终产出。
        var secondsToFull = remainingCapacity / finalPerSecond;

        return formatDuration(secondsToFull);
    }

    /**
     * 格式化持续时间。
     *
     * @param {number} seconds - 持续时间，单位秒，非负浮点数。
     * @returns {string} 中文时间文本。
     */
    function formatDuration(seconds) {
        if (!Number.isFinite(seconds)) {
            return "不会爆仓";
        }

        if (seconds < 1) {
            return "不足 1 秒";
        }

        // number 向上取整秒数：避免显示 0 秒。
        var roundedSeconds = Math.ceil(seconds);

        if (roundedSeconds < 60) {
            return roundedSeconds + " 秒";
        }

        // number 分钟数：用于中短期爆仓显示。
        var minutes = Math.floor(roundedSeconds / 60);

        // number 剩余秒数：分钟后的秒数。
        var remainingSeconds = roundedSeconds % 60;

        if (minutes < 60) {
            return remainingSeconds > 0 ? minutes + " 分 " + remainingSeconds + " 秒" : minutes + " 分";
        }

        // number 小时数：用于长期爆仓显示。
        var hours = Math.floor(minutes / 60);

        // number 剩余分钟数：小时后的分钟数。
        var remainingMinutes = minutes % 60;

        return remainingMinutes > 0 ? hours + " 小时 " + remainingMinutes + " 分" : hours + " 小时";
    }

    /**
     * 格式化比例为百分比。
     *
     * @param {number} ratio - 比例数值，1 表示 100%，可正可负。
     * @returns {string} 带符号百分比文本。
     */
    function formatPercentRatio(ratio) {
        if (!ratio) {
            return "0%";
        }

        return (ratio > 0 ? "+" : "") + Math.round(ratio * 100) + "%";
    }

    // Object 资源流量分析模块命名空间：提供资源悬浮框所需的只读统计。
    game.resourceFlows = {
        analyzeResourceFlow: analyzeResourceFlow
    };
})(window.GoblinEmpire);
