/* 建筑决策自动测试：使用固定状态夹具覆盖策划案核心排序、风险、来源、多样性和不变量。 */
"use strict";

// Object Node 断言模块：用于表达固定夹具预期。
var assert = require("assert");
// Object Node 文件模块：用于读取浏览器决策脚本。
var fs = require("fs");
// Object Node 虚拟机模块：用于在隔离 window 命名空间执行浏览器脚本。
var vm = require("vm");
// string 决策脚本路径：相对本测试文件定位。
var decisionScriptPath = require("path").join(__dirname, "../systems/buildingDecisions.js");

/**
 * 创建最小可用游戏命名空间，并加载真实建筑决策模块。
 *
 * @returns {Object} 已挂载 buildingDecisions 的测试游戏命名空间。
 */
function createTestGame() {
    // Object 游戏测试替身：仅提供决策模块需要的权威查询接口。
    var game = {
        definitions: {
            RESOURCE_DEFINITIONS: createResourceDefinitions(),
            BUILDING_DEFINITIONS: [],
            RECIPE_DEFINITIONS: []
        },
        population: {
            countAliveGoblins: function (state) { return state.goblins.filter(function (goblin) { return goblin.isAlive; }).length; },
            calculateHousingMax: function (state) { return state.housingMax; },
            analyzeLaborBreakdown: function (state) { return state.laborBreakdown; }
        },
        resourceFlows: {
            analyzeResourceFlow: function (state, resourceId) {
                // ResourceState 资源状态：测试夹具保证每个查询 ID 都存在。
                var resourceState = state.resourcesById[resourceId];
                return { finalPerSecond: resourceState.perSecond, totalOutputPerSecond: resourceState.outputPerSecond || Math.max(0, resourceState.perSecond) };
            }
        },
        crafting: {
            isRecipeUnlocked: function (state, recipeId) { return Boolean(state.unlockedRecipeIdsById[recipeId]); }
        }
    };
    // Object 虚拟机上下文：window.GoblinEmpire 指向测试替身。
    var context = { window: { GoblinEmpire: game }, console: console };

    vm.runInNewContext(fs.readFileSync(decisionScriptPath, "utf8"), context, { filename: decisionScriptPath });
    return game;
}

/**
 * 创建测试资源定义。
 *
 * @returns {Object[]} 资源定义数组。
 */
function createResourceDefinitions() {
    // string[] 资源 ID 数组：覆盖生存、工业、贸易和深渊来源案例。
    var resourceIds = ["fungus", "rottenWood", "rubble", "ironPlate", "tar", "coin", "manaCrystal", "labor"];
    return resourceIds.map(function (resourceId) { return { id: resourceId, isCapacityLimited: resourceId !== "labor" }; });
}

/**
 * 创建基础游戏状态。
 *
 * @returns {Object} 可由单项测试覆盖字段的 GameState 测试夹具。
 */
function createState() {
    // Object.<string, Object> 资源状态字典：key 为资源 ID，value 为库存、容量和流量。
    var resourcesById = {};
    // Object[] 资源定义数组：用于建立一致状态。
    var resourceDefinitions = createResourceDefinitions();
    // number 资源循环索引：初始化所有资源状态。
    for (var resourceIndex = 0; resourceIndex < resourceDefinitions.length; resourceIndex += 1) {
        // string 当前资源 ID：作为状态字典稳定 key。
        var resourceId = resourceDefinitions[resourceIndex].id;
        resourcesById[resourceId] = { value: 50, maxValue: 100, perSecond: 1, outputPerSecond: 1 };
    }
    return {
        resourcesById: resourcesById,
        buildingsById: {},
        goblins: [{ isAlive: true }, { isAlive: true }],
        housingMax: 4,
        laborBreakdown: { populationLabor: 20, adjustedBuildingUsageTotal: 4, reductionRatio: 0, isProductionLaborOverloaded: false },
        tabsById: { diplomacy: { isUnlocked: false }, abyss: { isUnlocked: false } },
        unlockedRecipeIdsById: {},
        isPaused: false
    };
}

/**
 * 创建建筑定义并注册到游戏定义表。
 *
 * @param {Object} game - 测试游戏命名空间，会追加定义。
 * @param {string} id - 建筑稳定 ID。
 * @param {number} designOrder - 稳定设计顺序整数。
 * @param {Object.<string, number>} effects - 建筑效果字典。
 * @param {string[]} effectTags - 受控效果标签数组。
 * @param {string} routeId - 建设路线 ID。
 * @param {boolean=} isMilestone - true 表示首座开放核心系统，默认 false。
 * @returns {Object} BuildingDefinition 测试定义。
 */
function addDefinition(game, id, designOrder, effects, effectTags, routeId, isMilestone) {
    // Object 建筑定义：字段满足决策模块结构契约。
    var definition = { id: id, name: id, description: id, basePrice: [], priceRatio: 1.1, effects: effects, unlock: {}, routeId: routeId, effectTags: effectTags, isMilestone: Boolean(isMilestone), designOrder: designOrder };
    game.definitions.BUILDING_DEFINITIONS.push(definition);
    return definition;
}

/**
 * 创建建筑视图模型并注册运行状态。
 *
 * @param {Object} state - 游戏状态，会写入建筑运行状态。
 * @param {Object} definition - 建筑定义。
 * @param {string} status - available、unaffordable、blocked 或 preview。
 * @param {Object=} overrides - 可选字段覆盖；允许 key 为 owned、waitSeconds、capacityResourceId、sourceResourceId、willOverloadLabor、laborUsage、price。
 * @returns {Object} BuildingViewModel 测试夹具。
 */
function createViewModel(state, definition, status, overrides) {
    // Object 覆盖字段：省略时为空对象。
    var fixtureOverrides = overrides || {};
    // number 已拥有数量：非负整数。
    var ownedCount = fixtureOverrides.owned || 0;
    state.buildingsById[definition.id] = { id: definition.id, owned: ownedCount, active: ownedCount, isUnlocked: status !== "preview" };
    return {
        definition: definition,
        state: state.buildingsById[definition.id],
        buildingViewStatus: status,
        isPreview: status === "preview",
        price: fixtureOverrides.price || [],
        waitInfo: { isAffordable: status === "available", isAvailable: status === "available" || status === "unaffordable", seconds: fixtureOverrides.waitSeconds === undefined ? (status === "available" ? 0 : Infinity) : fixtureOverrides.waitSeconds, entries: fixtureOverrides.waitEntry ? [fixtureOverrides.waitEntry] : [] },
        capacityBlockedResourceIds: fixtureOverrides.capacityResourceIds || (fixtureOverrides.capacityResourceId ? [fixtureOverrides.capacityResourceId] : []),
        sourceBlockedResourceIds: fixtureOverrides.sourceResourceIds || (fixtureOverrides.sourceResourceId ? [fixtureOverrides.sourceResourceId] : []),
        willOverloadLabor: Boolean(fixtureOverrides.willOverloadLabor),
        laborUsage: fixtureOverrides.laborUsage || definition.effects.laborUsage || 0,
        unlockText: "需具名前置"
    };
}

/**
 * 执行全部固定状态测试。
 *
 * @returns {void} 无返回值；断言失败时抛出错误并令进程失败。
 */
function runTests() {
    testHousingCrisisPriority();
    testFoodCrisisPriority();
    testMilestoneBeatsShortWait();
    testLaborOverloadMovesToAttention();
    testCapacityBlocker();
    testCapacityDependencyPromotion();
    testTradeDiscreteSource();
    testConversionRisk();
    testFullOutputDowngrade();
    testRepeatedMilestoneLosesUnlockTier();
    testAvailableIntentDiversity();
    testPreviewDoesNotDisplaceFormalCandidate();
    testDeterminismAndLimits();
    testPausedPressureHysteresis();
    testStrategicDependencyLeverage();
    testStrategicResourceReservation();
    testStrategicGoalPrefersProgression();
    testMultiBlockerCoveragePriority();
    testReservationUsesRecoveryTime();
    process.stdout.write("buildingDecisions: 19 fixtures passed\n");
}

/** @returns {void} 无返回值。 */
function testHousingCrisisPriority() { var game = createTestGame(); var state = createState(); state.housingMax = 2; var bed = addDefinition(game, "bed", 1, { fungusPerTick: 1 }, ["food", "production"], "survival", false); var hut = addDefinition(game, "hut", 2, { housingMax: 2 }, ["housing"], "survival", false); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, bed, "available"), createViewModel(state, hut, "available")], null, 0); assert.strictEqual(snapshot.available[0].buildingId, "hut"); }
/** @returns {void} 无返回值。 */
function testFoodCrisisPriority() { var game = createTestGame(); var state = createState(); state.resourcesById.fungus.value = 10; state.resourcesById.fungus.perSecond = -1; var hall = addDefinition(game, "hall", 1, {}, ["unlock"], "governance", true); var bed = addDefinition(game, "bed", 2, { fungusPerTick: 1 }, ["food"], "survival", false); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, hall, "available"), createViewModel(state, bed, "available")], null, 0); assert.strictEqual(snapshot.available[0].buildingId, "bed"); }
/** @returns {void} 无返回值。 */
function testMilestoneBeatsShortWait() { var game = createTestGame(); var state = createState(); var normal = addDefinition(game, "normal", 1, { rottenWoodOutputRatio: 0.1 }, ["production"], "survival", false); var milestone = addDefinition(game, "milestone", 2, {}, ["unlock"], "governance", true); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, normal, "unaffordable", { waitSeconds: 10 }), createViewModel(state, milestone, "unaffordable", { waitSeconds: 45 })], null, 0); assert.strictEqual(snapshot.target[0].buildingId, "milestone"); }
/** @returns {void} 无返回值。 */
function testLaborOverloadMovesToAttention() { var game = createTestGame(); var state = createState(); state.laborBreakdown.isProductionLaborOverloaded = true; state.laborBreakdown.adjustedBuildingUsageTotal = 25; var mine = addDefinition(game, "mine", 1, { laborUsage: 5, rubblePerTick: 1 }, ["production", "labor"], "industry", false); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, mine, "available", { willOverloadLabor: true, laborUsage: 5 })], null, 0); assert.strictEqual(snapshot.attention[0].buildingId, "mine"); assert.strictEqual(snapshot.attention[0].bottleneck.type, "labor_risk"); }
/** @returns {void} 无返回值。 */
function testCapacityBlocker() { var game = createTestGame(); var state = createState(); var gate = addDefinition(game, "gate", 1, {}, ["unlock"], "abyss", true); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, gate, "blocked", { capacityResourceId: "ironPlate" })], null, 0); assert.strictEqual(snapshot.attention[0].bottleneck.type, "capacity"); }
/** @returns {void} 无返回值。 */
function testCapacityDependencyPromotion() { var game = createTestGame(); var state = createState(); var gate = addDefinition(game, "gate", 1, {}, ["unlock"], "abyss", true); var storage = addDefinition(game, "storage", 2, { ironPlateMax: 50 }, ["storage"], "storage", false); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, gate, "blocked", { capacityResourceId: "ironPlate" }), createViewModel(state, storage, "available")], null, 0); var storageProfile = snapshot.available.filter(function (profile) { return profile.buildingId === "storage"; })[0]; assert(storageProfile); assert.strictEqual(storageProfile.reasonTokens.dependencyTargetName, "gate"); }
/** @returns {void} 无返回值。 */
function testTradeDiscreteSource() { var game = createTestGame(); var state = createState(); state.tabsById.diplomacy.isUnlocked = true; state.resourcesById.coin.perSecond = 0; state.resourcesById.coin.outputPerSecond = 0; var market = addDefinition(game, "market", 1, {}, ["trade"], "governance", false); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, market, "blocked", { sourceResourceId: "coin" })], null, 0); assert.strictEqual(snapshot.target[0].bottleneck.type, "discrete_source"); assert.match(snapshot.target[0].bottleneck.action, /贸易/); }
/** @returns {void} 无返回值。 */
function testConversionRisk() { var game = createTestGame(); var state = createState(); state.resourcesById.tar.perSecond = 0; state.resourcesById.tar.outputPerSecond = 0; var furnace = addDefinition(game, "furnace", 1, { deepFurnaceTarCostPerSecond: 0.01 }, ["conversion"], "industry", false); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, furnace, "available")], null, 0); assert.strictEqual(snapshot.attention[0].bottleneck.type, "chain_risk"); }
/** @returns {void} 无返回值。 */
function testFullOutputDowngrade() { var game = createTestGame(); var state = createState(); state.resourcesById.rubble.value = 100; state.resourcesById.rubble.maxValue = 100; state.resourcesById.rubble.perSecond = 1; var mine = addDefinition(game, "mine", 1, { rubblePerTick: 1 }, ["production"], "industry", false); var storage = addDefinition(game, "storage", 2, { rubbleMax: 100 }, ["storage"], "storage", false); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, mine, "available"), createViewModel(state, storage, "available")], null, 0); assert.strictEqual(snapshot.available[0].buildingId, "storage"); }
/** @returns {void} 无返回值。 */
function testRepeatedMilestoneLosesUnlockTier() { var game = createTestGame(); var state = createState(); var wall = addDefinition(game, "wall", 1, {}, ["unlock"], "governance", true); var profile = game.buildingDecisions.createDecisionProfile(state, createViewModel(state, wall, "available", { owned: 1 }), game.buildingDecisions.createEmpirePressureSnapshot(state, [], null, 0)); assert.notStrictEqual(profile.progressionTier, 4); }
/** @returns {void} 无返回值。 */
function testAvailableIntentDiversity() { var game = createTestGame(); var state = createState(); var foodOne = addDefinition(game, "food_one", 1, { fungusPerTick: 1 }, ["food"], "survival", false); var foodTwo = addDefinition(game, "food_two", 2, { fungusPerTick: 1 }, ["food"], "survival", false); var storage = addDefinition(game, "storage", 3, { ironPlateMax: 50 }, ["storage"], "storage", false); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, foodOne, "available"), createViewModel(state, foodTwo, "available"), createViewModel(state, storage, "available")], null, 0); assert(snapshot.available.some(function (profile) { return profile.buildingId === "storage"; })); }
/** @returns {void} 无返回值。 */
function testPreviewDoesNotDisplaceFormalCandidate() { var game = createTestGame(); var state = createState(); var formal = addDefinition(game, "formal", 1, { fungusPerTick: 1 }, ["food"], "survival", false); var preview = addDefinition(game, "preview", 2, {}, ["unlock"], "abyss", true); var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, formal, "available"), createViewModel(state, preview, "preview")], null, 0); assert(!snapshot.target.concat(snapshot.available, snapshot.attention).some(function (profile) { return profile.buildingId === "preview"; })); }
/** @returns {void} 无返回值。 */
function testDeterminismAndLimits() { var game = createTestGame(); var state = createState(); var viewModels = []; for (var definitionIndex = 0; definitionIndex < 10; definitionIndex += 1) { var definition = addDefinition(game, "building_" + definitionIndex, definitionIndex, { fungusPerTick: 1 }, ["food"], definitionIndex % 2 ? "survival" : "industry", false); viewModels.push(createViewModel(state, definition, definitionIndex < 5 ? "available" : "unaffordable", { waitSeconds: 30 + definitionIndex })); } var stateBeforeDecision = JSON.stringify(state); var first = game.buildingDecisions.getBuildingQueueSnapshot(state, viewModels, null, 0); for (var repeatIndex = 0; repeatIndex < 100; repeatIndex += 1) { assert.strictEqual(game.buildingDecisions.getBuildingQueueSnapshot(state, viewModels, null, 0).signature, first.signature); } var ids = first.target.concat(first.available, first.attention).map(function (profile) { return profile.buildingId; }); assert(ids.length <= 7); assert.strictEqual(new Set(ids).size, ids.length); assert.strictEqual(JSON.stringify(state), stateBeforeDecision); }
/** @returns {void} 无返回值。 */
function testPausedPressureHysteresis() { var game = createTestGame(); var state = createState(); var runtime = { pressureMemoryById: {}, stableSnapshot: null, pendingSnapshot: null, pendingSinceTimestamp: 0, structureSignature: "" }; state.resourcesById.fungus.value = 5; state.resourcesById.fungus.perSecond = -1; var critical = game.buildingDecisions.createEmpirePressureSnapshot(state, [], runtime, 1000); state.isPaused = true; state.resourcesById.fungus.value = 100; state.resourcesById.fungus.perSecond = 1; var paused = game.buildingDecisions.createEmpirePressureSnapshot(state, [], runtime, 30000); assert.strictEqual(critical.foodPressure, "critical"); assert.strictEqual(paused.foodPressure, "critical"); }

/** @returns {void} 无返回值。 */
function testStrategicDependencyLeverage() {
    // Object 测试游戏命名空间：承载真实决策模块。
    var game = createTestGame();
    // GameState 测试状态：保持资源安全且劳力充足。
    var state = createState();
    // BuildingDefinition 深渊门定义：作为容量受阻的战略目标。
    var gate = addDefinition(game, "gate", 1, {}, ["unlock"], "abyss", true);
    // BuildingDefinition 普通矿场定义：作为无战略关系的竞争候选。
    var mine = addDefinition(game, "mine", 2, { rubblePerTick: 1 }, ["production"], "industry", false);
    // BuildingDefinition 铁片仓库定义：下一座能一次解除目标容量阻断。
    var storage = addDefinition(game, "storage", 3, { ironPlateMax: 100 }, ["storage"], "storage", false);
    // BuildingQueueSnapshot 队列快照：用于验证铺路节点排序与解释字段。
    var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, gate, "blocked", { capacityResourceId: "ironPlate", price: [{ resource: "ironPlate", amount: 150 }] }), createViewModel(state, mine, "available"), createViewModel(state, storage, "available")], null, 0);
    assert.strictEqual(snapshot.available[0].buildingId, "storage");
    assert.strictEqual(snapshot.available[0].strategicLeverageTier, 3);
    assert.strictEqual(snapshot.available[0].reasonTokens.dependencyTargetName, "gate");
}

/** @returns {void} 无返回值。 */
function testStrategicResourceReservation() {
    // Object 测试游戏命名空间：承载真实决策模块。
    var game = createTestGame();
    // GameState 测试状态：朽木库存足够支付普通消费但仍是主目标缺口。
    var state = createState();
    state.resourcesById.rottenWood.value = 50;
    // BuildingDefinition 治理里程碑定义：作为正在积累朽木的主目标。
    var milestone = addDefinition(game, "milestone", 1, {}, ["unlock"], "governance", true);
    // BuildingDefinition 朽木消费建筑定义：会显著挪用主目标资源。
    var woodConsumer = addDefinition(game, "wood_consumer", 2, { rubblePerTick: 1 }, ["production"], "industry", false);
    // BuildingDefinition 独立建筑定义：只消费碎石，不延迟主目标。
    var independent = addDefinition(game, "independent", 3, { rubblePerTick: 1 }, ["production"], "industry", false);
    // BuildingQueueSnapshot 队列快照：用于验证资源冲突降序。
    var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, milestone, "unaffordable", { waitSeconds: 45, price: [{ resource: "rottenWood", amount: 90 }] }), createViewModel(state, woodConsumer, "available", { price: [{ resource: "rottenWood", amount: 30 }] }), createViewModel(state, independent, "available", { price: [{ resource: "rubble", amount: 30 }] })], null, 0);
    assert.strictEqual(snapshot.available[0].buildingId, "independent");
    assert.strictEqual(snapshot.available.filter(function (profile) { return profile.buildingId === "wood_consumer"; })[0].reservationConflictTier, 2);
}

/** @returns {void} 无返回值。 */
function testStrategicGoalPrefersProgression() {
    // Object 测试游戏命名空间：承载真实决策模块。
    var game = createTestGame();
    // GameState 测试状态：同时存在普通容量阻断和主线来源阻断。
    var state = createState();
    // BuildingDefinition 普通受阻建筑定义：验证它不会仅凭容量阻断冒充主目标。
    var ordinaryBlock = addDefinition(game, "ordinary_block", 1, {}, ["storage"], "storage", false);
    // BuildingDefinition 治理里程碑定义：应成为本轮唯一战略目标。
    var milestone = addDefinition(game, "milestone", 2, {}, ["unlock"], "governance", true);
    // BuildingDefinition 碎石仓库定义：只解决普通建筑阻断。
    var rubbleStorage = addDefinition(game, "rubble_storage", 3, { rubbleMax: 100 }, ["storage"], "storage", false);
    // BuildingDefinition 铁片来源定义：直接解决里程碑的来源阻断。
    var forge = addDefinition(game, "forge", 4, { crudeFurnaceIronPlatePerSecond: 1 }, ["production"], "industry", false);
    // BuildingQueueSnapshot 队列快照：用于验证主目标先按推进价值选择。
    var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, ordinaryBlock, "blocked", { capacityResourceId: "rubble", price: [{ resource: "rubble", amount: 150 }] }), createViewModel(state, milestone, "blocked", { sourceResourceId: "ironPlate", price: [{ resource: "ironPlate", amount: 90 }] }), createViewModel(state, rubbleStorage, "available"), createViewModel(state, forge, "available")], null, 0);
    assert.strictEqual(snapshot.available[0].buildingId, "forge");
    assert.strictEqual(snapshot.available[0].reasonTokens.dependencyTargetName, "milestone");
}

/** @returns {void} 无返回值；验证一栋覆盖多项阻断的行动节点优先于单项解法。 */
function testMultiBlockerCoveragePriority() {
    // Object 测试游戏命名空间：承载真实决策模块。
    var game = createTestGame();
    // GameState 测试状态：工业资源容量均不足以支付战略目标。
    var state = createState();
    // BuildingDefinition 战略目标定义：同时受碎石与铁片容量阻断。
    var target = addDefinition(game, "target", 1, {}, ["unlock"], "governance", true);
    // BuildingDefinition 单项仓库定义：只处理碎石容量。
    var singleStorage = addDefinition(game, "single_storage", 2, { rubbleMax: 100 }, ["storage"], "storage", false);
    // BuildingDefinition 综合仓库定义：同时处理两项容量阻断。
    var combinedStorage = addDefinition(game, "combined_storage", 3, { rubbleMax: 100, ironPlateMax: 100 }, ["storage"], "storage", false);
    // BuildingQueueSnapshot 队列快照：用于验证多阻断覆盖排序。
    var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, target, "blocked", { capacityResourceIds: ["rubble", "ironPlate"], price: [{ resource: "rubble", amount: 150 }, { resource: "ironPlate", amount: 150 }] }), createViewModel(state, singleStorage, "available"), createViewModel(state, combinedStorage, "available")], null, 0);
    // BuildingDecisionProfile 综合仓库档案：应成为首个可建行动节点。
    var combinedProfile = snapshot.available.filter(function (profile) { return profile.buildingId === "combined_storage"; })[0];
    assert(combinedProfile);
    assert.strictEqual(snapshot.available[0].buildingId, "combined_storage");
    assert.strictEqual(combinedProfile.blockerCoverageCount, 2);
}

/** @returns {void} 无返回值；验证资源保留按恢复时间而非库存比例判断机会成本。 */
function testReservationUsesRecoveryTime() {
    // Object 测试游戏命名空间：承载真实决策模块。
    var game = createTestGame();
    // GameState 测试状态：朽木流量很慢，使小额消费也会显著拖延目标。
    var state = createState();
    state.resourcesById.rottenWood.value = 50;
    state.resourcesById.rottenWood.perSecond = 0.1;
    // BuildingDefinition 里程碑定义：仍缺朽木并形成资源保留目标。
    var milestone = addDefinition(game, "milestone", 1, {}, ["unlock"], "governance", true);
    // BuildingDefinition 小额消费定义：只消耗库存的两成，但需要 100 秒补回。
    var consumer = addDefinition(game, "consumer", 2, { rubblePerTick: 1 }, ["production"], "industry", false);
    // BuildingQueueSnapshot 队列快照：读取时间机会成本字段。
    var snapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, [createViewModel(state, milestone, "unaffordable", { waitSeconds: 400, price: [{ resource: "rottenWood", amount: 90 }] }), createViewModel(state, consumer, "available", { price: [{ resource: "rottenWood", amount: 10 }] })], null, 0);
    // BuildingDecisionProfile 消费建筑档案：应被判定为高冲突。
    var consumerProfile = snapshot.available.filter(function (profile) { return profile.buildingId === "consumer"; })[0];
    assert.strictEqual(consumerProfile.reservationConflictTier, 2);
    assert.strictEqual(consumerProfile.reservationDelaySeconds, 100);
}

runTests();
