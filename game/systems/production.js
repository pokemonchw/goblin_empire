/* 建筑生产系统：负责建筑自动产出和粗熔炉转换链。 */
/**
 * 初始化建筑生产模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 production 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 推进建筑自动生产。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function updateProduction(state, deltaSeconds) {
        applyFungusBedProduction(state, deltaSeconds);
        if (isProductionLaborOverloaded(state)) {
            applyPactResourceDrains(state, deltaSeconds);
            return;
        }
        applyLaborGatedFlatBuildingProduction(state, deltaSeconds);
        applyCharcoalKilnProduction(state, deltaSeconds);
        applyCrudeFurnaceProduction(state, deltaSeconds);
        applyDeepFurnaceProduction(state, deltaSeconds);
        applyRuneMachineProduction(state, deltaSeconds);
        applyPerSecondBuildingProduction(state, deltaSeconds);
        applyPactResourceDrains(state, deltaSeconds);
    }

    /**
     * 应用菌菇床固定产出。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyFungusBedProduction(state, deltaSeconds) {
        applyPerTickEffect(state, "fungus_bed", "fungusPerTick", "fungus", deltaSeconds);
    }

    /**
     * 应用受劳力门控的建筑固定产出。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyLaborGatedFlatBuildingProduction(state, deltaSeconds) {
        applyPerTickEffect(state, "rotten_grove", "rottenWoodPerTick", "rottenWood", deltaSeconds);
        applyPerTickEffect(state, "shallow_mine", "coalSlagPerTick", "coalSlag", deltaSeconds);
        applyPerTickEffect(state, "rubble_yard", "coalSlagPerTick", "coalSlag", deltaSeconds);
    }

    /**
     * 应用建筑每秒产出。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyPerSecondBuildingProduction(state, deltaSeconds) {
        applyPerSecondEffect(state, "beast_pen", "leatherPerSecond", "leather", deltaSeconds);
        applyPerSecondEffect(state, "beast_pen", "boneShardPerSecond", "boneShard", deltaSeconds);
        applyPerSecondEffect(state, "bad_wine_barrel", "obediencePerSecond", "obedience", deltaSeconds);
        applyPerSecondEffect(state, "chief_hall", "obediencePerSecond", "obedience", deltaSeconds);
        applyPerSecondEffect(state, "black_market", "coinPerSecond", "coin", deltaSeconds);
        applyPerSecondEffect(state, "ledger_room", "ledgerPerSecond", "ledger", deltaSeconds);
        applyPerSecondEffect(state, "ancestral_altar", "ancestralEchoPerSecond", "ancestralEcho", deltaSeconds);
        applyPerSecondEffect(state, "tar_well", "tarPerSecond", "tar", deltaSeconds);
        applyPerSecondEffect(state, "abyss_gate", "abyssEchoPerSecond", "abyssEcho", deltaSeconds);
        applyPerSecondEffect(state, "sacrifice_pit", "abyssEchoPerSecond", "abyssEcho", deltaSeconds);
    }

    /**
     * 应用单项每 tick 建筑产出。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {BuildingId} buildingId - 建筑稳定 ID。
     * @param {string} effectId - 建筑效果 ID。
     * @param {ResourceId} resourceId - 产出资源稳定 ID。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyPerTickEffect(state, buildingId, effectId, resourceId, deltaSeconds) {
        // BuildingDefinition|null 建筑定义：用于读取每 tick 产出效果。
        var buildingDefinition = game.buildings.getBuildingDefinition(buildingId);

        // BuildingState 建筑状态：用于读取启用数量。
        var buildingState = state.buildingsById[buildingId];

        if (!buildingDefinition || !buildingState || buildingState.active <= 0 || !buildingDefinition.effects[effectId]) {
            return;
        }

        // number 每秒产出：每 tick 产出乘以 tick 频率和启用数量。
        var perSecond = buildingDefinition.effects[effectId] * game.definitions.TICKS_PER_SECOND * buildingState.active;

        // Object.<string, number> 祖灵升级效果字典：读取菌菇和工业产出倍率。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 政策效果字典：读取高阶工业政策倍率。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        if (resourceId === "fungus" && state.statistics.fungusBloomSeconds > 0) {
            perSecond *= 1.5;
        }

        if (resourceId === "fungus") {
            perSecond *= 1 + (ritualEffects.fungusOutputRatio || 0);
        }

        if (resourceId === "rottenWood") {
            perSecond *= 1 + getOwnedBuildingEffectTotal(state, "rottenWoodOutputRatio") + (state.statistics.woodcuttingToolRatio || 0);
        }

        // number 天气产出倍率：地穴生态和矿道资源随当前天气上下波动。
        var weatherMultiplier = game.weather ? game.weather.calculateResourceOutputMultiplier(state, resourceId) : 1;

        perSecond *= weatherMultiplier;

        game.resources.addResource(state, resourceId, perSecond * deltaSeconds);
        state.resourcesById[resourceId].perSecond += perSecond;
    }

    /**
     * 应用闷炭窑资源转换。
     *
     * @param {GameState} state - 当前游戏状态对象，会消耗朽木并产出煤渣。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyCharcoalKilnProduction(state, deltaSeconds) {
        // BuildingDefinition|null 闷炭窑定义：用于读取朽木消耗和煤渣产出。
        var kilnDefinition = game.buildings.getBuildingDefinition("charcoal_kiln");

        // BuildingState 闷炭窑状态：用于读取启用数量。
        var kilnState = state.buildingsById.charcoal_kiln;

        if (!kilnDefinition || !kilnState || kilnState.active <= 0) {
            return;
        }

        // number 朽木消耗：本次模拟需要支付的资源数量。
        var rottenWoodCost = kilnDefinition.effects.charcoalKilnWoodCostPerSecond * kilnState.active * deltaSeconds;

        if (!game.resources.canAfford(state, [
            {
                resource: "rottenWood",
                amount: rottenWoodCost
            }
        ])) {
            return;
        }

        state.resourcesById.rottenWood.value -= rottenWoodCost;
        state.resourcesById.rottenWood.perSecond -= kilnDefinition.effects.charcoalKilnWoodCostPerSecond * kilnState.active;

        // number 煤渣每秒产出：闷炭窑把朽木稳定转为熔炉燃料。
        var coalSlagPerSecond = kilnDefinition.effects.charcoalKilnCoalSlagPerSecond * kilnState.active;

        game.resources.addResource(state, "coalSlag", coalSlagPerSecond * deltaSeconds);
        state.resourcesById.coalSlag.perSecond += coalSlagPerSecond;
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
     * 应用单项每秒建筑产出。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {BuildingId} buildingId - 建筑稳定 ID。
     * @param {string} effectId - 建筑效果 ID。
     * @param {ResourceId} resourceId - 产出资源稳定 ID。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyPerSecondEffect(state, buildingId, effectId, resourceId, deltaSeconds) {
        // BuildingDefinition|null 建筑定义：用于读取每秒产出效果。
        var buildingDefinition = game.buildings.getBuildingDefinition(buildingId);

        // BuildingState 建筑状态：用于读取启用数量。
        var buildingState = state.buildingsById[buildingId];

        if (!buildingDefinition || !buildingState || buildingState.active <= 0 || !buildingDefinition.effects[effectId]) {
            return;
        }

        // number 每秒产出：单建筑每秒产出乘以启用数量。
        var perSecond = buildingDefinition.effects[effectId] * buildingState.active;

        // Object.<string, number> 祖灵升级效果字典：读取祖灵回响产出倍率。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        if (resourceId === "ancestralEcho") {
            perSecond *= 1 + (ritualEffects.ancestralEchoOutputRatio || 0);
        }

        game.resources.addResource(state, resourceId, perSecond * deltaSeconds);
        state.resourcesById[resourceId].perSecond += perSecond;
    }

    /**
     * 应用粗熔炉资源转换。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyCrudeFurnaceProduction(state, deltaSeconds) {
        // BuildingDefinition|null 粗熔炉定义：用于读取消耗和产出效果。
        var furnaceDefinition = game.buildings.getBuildingDefinition("crude_furnace");

        // BuildingState 粗熔炉状态：用于读取启用数量。
        var furnaceState = state.buildingsById.crude_furnace;

        if (!furnaceDefinition || !furnaceState || furnaceState.active <= 0) {
            return;
        }

        // number 朽木消耗：本次模拟需要支付的资源数量。
        var rottenWoodCost = furnaceDefinition.effects.crudeFurnaceWoodCostPerSecond * furnaceState.active * deltaSeconds;

        // number 碎石消耗：本次模拟需要支付的资源数量。
        var rubbleCost = furnaceDefinition.effects.crudeFurnaceRubbleCostPerSecond * furnaceState.active * deltaSeconds;

        if (!game.resources.canAfford(state, [
            {
                resource: "rottenWood",
                amount: rottenWoodCost
            },
            {
                resource: "rubble",
                amount: rubbleCost
            }
        ])) {
            return;
        }

        state.resourcesById.rottenWood.value -= rottenWoodCost;
        state.resourcesById.rubble.value -= rubbleCost;
        state.resourcesById.rottenWood.perSecond -= furnaceDefinition.effects.crudeFurnaceWoodCostPerSecond * furnaceState.active;
        state.resourcesById.rubble.perSecond -= furnaceDefinition.effects.crudeFurnaceRubbleCostPerSecond * furnaceState.active;
        // Object.<string, number> 祖灵升级效果字典：读取地穴圣火工业倍率。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 政策效果字典：读取高阶工业政策倍率。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：黑炉契约会提高工业产出。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 工业产出倍率：粗熔炉产出由工坊、祖灵、政策、契约和天气共同修正。
        var furnaceOutputMultiplier = (1 + (state.statistics.furnaceOutputRatio || 0) + (ritualEffects.industrialOutputRatio || 0) + (policyEffects.industrialOutputRatio || 0) + (pactEffects.industrialOutputRatio || 0)) * getWeatherIndustrialOutputMultiplier(state);

        addFurnaceOutput(state, "ironOre", furnaceDefinition.effects.crudeFurnaceIronOrePerSecond * furnaceOutputMultiplier, furnaceState.active, deltaSeconds);
        addFurnaceOutput(state, "ironPlate", furnaceDefinition.effects.crudeFurnaceIronPlatePerSecond * furnaceOutputMultiplier, furnaceState.active, deltaSeconds);
    }

    /**
     * 增加粗熔炉产出并记录每秒变化。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {ResourceId} resourceId - 产出资源稳定 ID。
     * @param {number} basePerSecond - 单个粗熔炉每秒产量，非负浮点数。
     * @param {number} activeCount - 启用粗熔炉数量，非负整数。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function addFurnaceOutput(state, resourceId, basePerSecond, activeCount, deltaSeconds) {
        // number 每秒产出：单炉产出乘以启用数量。
        var perSecond = basePerSecond * activeCount;

        game.resources.addResource(state, resourceId, perSecond * deltaSeconds);
        state.resourcesById[resourceId].perSecond += perSecond;
    }

    /**
     * 应用深炉资源转换。
     *
     * @param {GameState} state - 当前游戏状态对象，会消耗焦油并产出钢锭和黑铁。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyDeepFurnaceProduction(state, deltaSeconds) {
        // BuildingDefinition|null 深炉定义：用于读取产出和消耗效果。
        var furnaceDefinition = game.buildings.getBuildingDefinition("deep_furnace");

        // BuildingState 深炉状态：用于读取启用数量。
        var furnaceState = state.buildingsById.deep_furnace;

        if (!furnaceDefinition || !furnaceState || furnaceState.active <= 0) {
            return;
        }

        // Object.<string, number> 祖灵升级效果字典：地穴圣火可提高工业产出。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 政策效果字典：全面工业化等政策影响深炉产出。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：黑炉契约会提高深炉产出。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 阀门减耗比例：深炉阀门降低焦油消耗。
        var valveReductionRatio = Math.min(0.75, (state.resourcesById.deepFurnaceValve ? state.resourcesById.deepFurnaceValve.value : 0) * 0.03);

        // number 焦油消耗：本次模拟需要支付的焦油数量。
        var tarCost = furnaceDefinition.effects.deepFurnaceTarCostPerSecond * furnaceState.active * Math.max(0, 1 - valveReductionRatio) * deltaSeconds;

        if (!game.resources.canAfford(state, [
            {
                resource: "tar",
                amount: tarCost
            }
        ])) {
            return;
        }

        state.resourcesById.tar.value -= tarCost;
        state.resourcesById.tar.perSecond -= furnaceDefinition.effects.deepFurnaceTarCostPerSecond * furnaceState.active * Math.max(0, 1 - valveReductionRatio);

        // number 工业产出倍率：深炉产出由工坊、祖灵、政策、契约和天气共同修正。
        var outputMultiplier = (1 + (state.statistics.furnaceOutputRatio || 0) + (ritualEffects.industrialOutputRatio || 0) + (policyEffects.industrialOutputRatio || 0) + (pactEffects.industrialOutputRatio || 0)) * getWeatherIndustrialOutputMultiplier(state);

        addFurnaceOutput(state, "steelIngot", furnaceDefinition.effects.deepFurnaceSteelPerSecond * outputMultiplier, furnaceState.active, deltaSeconds);
        addFurnaceOutput(state, "blackIron", furnaceDefinition.effects.deepFurnaceBlackIronPerSecond * outputMultiplier, furnaceState.active, deltaSeconds);
    }

    /**
     * 应用符文机房资源转换。
     *
     * @param {GameState} state - 当前游戏状态对象，会消耗魔晶并产出粗识。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyRuneMachineProduction(state, deltaSeconds) {
        // BuildingDefinition|null 符文机房定义：用于读取粗识产出和魔晶消耗。
        var machineDefinition = game.buildings.getBuildingDefinition("rune_machine_room");

        // BuildingState 符文机房状态：用于读取启用数量。
        var machineState = state.buildingsById.rune_machine_room;

        if (!machineDefinition || !machineState || machineState.active <= 0) {
            return;
        }

        // number 魔晶消耗：本次模拟需要支付的魔晶数量。
        var manaCost = machineDefinition.effects.runeMachineManaCostPerSecond * machineState.active * deltaSeconds;

        if (!game.resources.canAfford(state, [
            {
                resource: "manaCrystal",
                amount: manaCost
            }
        ])) {
            return;
        }

        state.resourcesById.manaCrystal.value -= manaCost;
        state.resourcesById.manaCrystal.perSecond -= machineDefinition.effects.runeMachineManaCostPerSecond * machineState.active;

        // number 每秒粗识产出：符文机房显著推动后期研究。
        var knowledgePerSecond = machineDefinition.effects.runeMachineKnowledgePerSecond * machineState.active * (1 + (state.statistics.crudeKnowledgeOutputRatio || 0));

        game.resources.addResource(state, "crudeKnowledge", knowledgePerSecond * deltaSeconds);
        state.resourcesById.crudeKnowledge.perSecond += knowledgePerSecond;
    }

    /**
     * 应用契约资源代价。
     *
     * @param {GameState} state - 当前游戏状态对象，会扣除契约代价资源。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyPactResourceDrains(state, deltaSeconds) {
        // Object.<string, number> 契约效果字典：读取每秒资源代价。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        if (pactEffects.obedienceDrainPerSecond && state.resourcesById.obedience) {
            state.resourcesById.obedience.value = Math.max(0, state.resourcesById.obedience.value - pactEffects.obedienceDrainPerSecond * deltaSeconds);
            state.resourcesById.obedience.perSecond -= pactEffects.obedienceDrainPerSecond;
        }
    }

    /**
     * 计算当前天气对工业产出的倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 工业天气产出倍率，至少为 0。
     */
    function getWeatherIndustrialOutputMultiplier(state) {
        if (!game.weather) {
            return 1;
        }

        return game.weather.calculateResourceOutputMultiplier(state, "ironPlate");
    }

    /**
     * 判断当前建筑生产是否因劳力过载而停摆。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否劳力过载；true 表示非菌菇床建筑生产停止。
     */
    function isProductionLaborOverloaded(state) {
        return Boolean(game.population && game.population.isProductionLaborOverloaded && game.population.isProductionLaborOverloaded(state));
    }

    // Object 建筑生产模块命名空间：提供建筑自动生产入口。
    game.production = {
        updateProduction: updateProduction
    };
})(window.GoblinEmpire);
