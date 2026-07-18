/* 研究决策自动测试：使用固定状态夹具覆盖分段、可达性、依赖、多样性与确定性不变量。 */
"use strict";

// Object Node 断言模块：表达研究决策的固定预期。
var assert = require("assert");
// Object Node 文件模块：读取浏览器研究决策脚本。
var fs = require("fs");
// Object Node 虚拟机模块：在隔离 window 命名空间执行脚本。
var vm = require("vm");
// string 决策脚本路径：相对测试文件定位真实模块。
var decisionScriptPath = require("path").join(__dirname, "../systems/researchDecisions.js");

/**
 * 创建最小游戏命名空间并加载研究决策模块。
 *
 * @param {TechnologyDefinition[]} technologyDefinitions - 测试科技定义数组。
 * @returns {Object} 已挂载 researchDecisions 的游戏替身。
 */
function createTestGame(technologyDefinitions) {
    // Object 游戏测试替身：只提供决策模块使用的科技定义。
    var game = {
        definitions: { TECHNOLOGY_DEFINITIONS: technologyDefinitions, BUILDING_DEFINITIONS: [] },
        buildings: {
            getBuildingPrice: function (state, buildingDefinition) {
                // BuildingState|null 测试建筑状态：用于按拥有量计算下一座价格。
                var buildingState = state.buildingsById ? state.buildingsById[buildingDefinition.id] || null : null;
                // number 已拥有数量：建筑价格指数使用的非负整数。
                var ownedCount = buildingState ? buildingState.owned : 0;
                return buildingDefinition.basePrice.map(function (priceEntry) { return { resource: priceEntry.resource, amount: priceEntry.amount * Math.pow(buildingDefinition.priceRatio, ownedCount) }; });
            }
        },
        resources: {
            getResourceDisplayName: function (resourceId) {
                // Object.<ResourceId, string> 测试中文资源名字典：验证玩家文案不泄露英文 ID。
                var resourceNamesById = { crudeKnowledge: "粗识", ledger: "账册", manaCrystal: "魔晶", fungus: "菌菇" };
                if (!resourceNamesById[resourceId]) { throw new Error("测试资源缺少严格中文显示名：" + resourceId); }
                return resourceNamesById[resourceId];
            }
        }
    };
    // Object 虚拟机上下文：模拟浏览器 window.GoblinEmpire。
    var context = { window: { GoblinEmpire: game }, console: console };

    vm.runInNewContext(fs.readFileSync(decisionScriptPath, "utf8"), context, { filename: decisionScriptPath });
    return game;
}

/**
 * 创建科技定义。
 *
 * @param {string} id - 科技稳定 ID。
 * @param {Object=} overrides - 允许覆盖定义字段的测试配置；省略时使用基础科技。
 * @returns {TechnologyDefinition} 完整测试科技定义。
 */
function createTechnology(id, overrides) {
    // TechnologyDefinition 基础定义：默认是生存路线第一层普通强化。
    var definition = {
        id: id,
        name: id,
        price: [{ resource: "crudeKnowledge", amount: 10 }],
        unlocks: {},
        lineId: "survival",
        tier: 1,
        nodeSize: "normal",
        prerequisiteTechnologyIds: [],
        alternativePrerequisiteTechnologyIds: [],
        effectTags: ["增产"],
        recommendedFor: "测试推进。",
        layoutOrder: 10
    };

    Object.keys(overrides || {}).forEach(function (overrideKey) { definition[overrideKey] = overrides[overrideKey]; });
    return definition;
}

/**
 * 创建与定义表一致的基础状态。
 *
 * @param {TechnologyDefinition[]} definitions - 科技定义数组。
 * @returns {GameState} 测试游戏状态。
 */
function createState(definitions) {
    // Object.<TechnologyId, TechnologyState> 科技状态字典：默认全部正式揭示且未完成。
    var technologiesById = {};

    definitions.forEach(function (definition) { technologiesById[definition.id] = { isUnlocked: true, isResearched: false }; });
    return {
        technologiesById: technologiesById,
        buildingsById: {},
        resourcesById: {
            fungus: { value: 100, maxValue: 200, perSecond: 0 },
            crudeKnowledge: { value: 0, maxValue: 100, perSecond: 1 },
            ledger: { value: 0, maxValue: 100, perSecond: 0 },
            manaCrystal: { value: 0, maxValue: 100, perSecond: 0 }
        }
    };
}

/**
 * 运行全部研究决策测试。
 *
 * @returns {void} 无返回值；断言失败时由 Node 抛出错误。
 */
function runTests() {
    // TechnologyDefinition[] 分段科技：覆盖可研究、可达目标、容量阻断与完成项。
    var sectionDefinitions = [
        createTechnology("ready", { price: [] }),
        createTechnology("target", { nodeSize: "milestone", unlocks: { tabs: ["workshop"] }, layoutOrder: 20 }),
        createTechnology("capacity_block", { price: [{ resource: "ledger", amount: 120 }], layoutOrder: 30 }),
        createTechnology("done", { price: [], layoutOrder: 40 })
    ];
    // Object 分段测试游戏：加载真实决策系统。
    var sectionGame = createTestGame(sectionDefinitions);
    // GameState 分段测试状态：粗识正产，账册容量不足。
    var sectionState = createState(sectionDefinitions);

    sectionState.technologiesById.done.isResearched = true;
    // string 分段测试状态快照：用于证明纯派生决策不会修改 GameState。
    var sectionStateBeforeDecision = JSON.stringify(sectionState);
    // ResearchQueueSnapshot 分段快照：验证三段语义和去重。
    var sectionSnapshot = sectionGame.researchDecisions.getResearchQueueSnapshot(sectionState);
    // string[] 全部入队 ID：用于验证没有重复和完成项。
    var queuedIds = sectionSnapshot.target.concat(sectionSnapshot.available, sectionSnapshot.attention).map(function (profile) { return profile.technologyId; });

    assert.strictEqual(sectionSnapshot.target[0].technologyId, "target");
    assert.strictEqual(sectionSnapshot.available[0].technologyId, "ready");
    assert.strictEqual(sectionSnapshot.attention[0].technologyId, "capacity_block");
    assert.strictEqual(new Set(queuedIds).size, queuedIds.length);
    assert.strictEqual(queuedIds.indexOf("done"), -1);
    assert.strictEqual(sectionSnapshot.target[0].waitSeconds, 10);
    assert.strictEqual(sectionSnapshot.target[0].bottleneckText.indexOf("crudeKnowledge"), -1);
    assert.ok(sectionSnapshot.target[0].bottleneckText.indexOf("粗识") >= 0);
    assert.strictEqual(JSON.stringify(sectionState), sectionStateBeforeDecision);

    // TechnologyDefinition[] 多样性科技：两项同意图同路线，另两项覆盖系统与军事。
    var diversityDefinitions = [
        createTechnology("output_a", { price: [], layoutOrder: 10 }),
        createTechnology("output_b", { price: [], layoutOrder: 20 }),
        createTechnology("system", { price: [], lineId: "order", effectTags: ["系统"], unlocks: { tabs: ["diplomacy"] }, layoutOrder: 30 }),
        createTechnology("military", { price: [], lineId: "military", effectTags: ["军事"], layoutOrder: 40 })
    ];
    // Object 多样性测试游戏：验证意图优先于简单截取前三。
    var diversityGame = createTestGame(diversityDefinitions);
    // ResearchQueueSnapshot 多样性快照：三个槽位应覆盖三个意图。
    var diversitySnapshot = diversityGame.researchDecisions.getResearchQueueSnapshot(createState(diversityDefinitions));
    // string[] 入选意图数组：应无重复。
    var selectedIntentIds = diversitySnapshot.available.map(function (profile) { return profile.primaryIntentId; });

    assert.strictEqual(diversitySnapshot.available.length, 3);
    assert.strictEqual(new Set(selectedIntentIds).size, 3);
    assert.ok(diversitySnapshot.available.some(function (profile) { return profile.technologyId === "system"; }));

    // TechnologyDefinition[] OR 前置科技：完成任一父项即可让子项进入资源等待。
    var prerequisiteDefinitions = [
        createTechnology("parent_a", { price: [], layoutOrder: 10 }),
        createTechnology("parent_b", { price: [], layoutOrder: 20 }),
        createTechnology("child", { alternativePrerequisiteTechnologyIds: ["parent_a", "parent_b"], layoutOrder: 30 })
    ];
    // Object 前置测试游戏：验证 OR 语义。
    var prerequisiteGame = createTestGame(prerequisiteDefinitions);
    // GameState 前置测试状态：只完成一个任选前置。
    var prerequisiteState = createState(prerequisiteDefinitions);

    prerequisiteState.technologiesById.parent_a.isResearched = true;
    // ResearchDecisionContext 前置测试上下文：由公开压力和完成集合构造。
    var prerequisiteContext = { researchedById: { parent_a: true }, deepestResearchedTier: 1, knowledgePressure: prerequisiteGame.researchDecisions.analyzeKnowledgePressure(prerequisiteState) };
    // ResearchDecisionProfile 子科技档案：不应错误标为前置受阻。
    var childProfile = prerequisiteGame.researchDecisions.createDecisionProfile(prerequisiteState, prerequisiteDefinitions[2], prerequisiteContext);

    assert.strictEqual(childProfile.status, "waiting_resources");

    // TechnologyDefinition[] AND 前置科技：两个必需父项均未完成。
    var andDefinitions = [
        createTechnology("and_parent_a", { price: [], layoutOrder: 10 }),
        createTechnology("and_parent_b", { price: [], layoutOrder: 20 }),
        createTechnology("and_child", { prerequisiteTechnologyIds: ["and_parent_a", "and_parent_b"], layoutOrder: 30 })
    ];
    // Object AND 前置测试游戏：验证全部完成语义与稳定首项提示。
    var andGame = createTestGame(andDefinitions);
    // GameState AND 前置状态：父项均未完成。
    var andState = createState(andDefinitions);
    // ResearchQueueSnapshot AND 前置快照：受阻子项应出现在先处理并指向第一个父项。
    var andSnapshot = andGame.researchDecisions.getResearchQueueSnapshot(andState);
    // ResearchDecisionProfile|null AND 子项档案：从先处理区定位。
    var andChildProfile = andSnapshot.attention.find(function (profile) { return profile.technologyId === "and_child"; }) || null;

    assert.ok(andChildProfile);
    assert.strictEqual(andChildProfile.status, "blocked_prerequisite");
    assert.ok(andChildProfile.bottleneckText.indexOf("and_parent_a") >= 0);

    // TechnologyDefinition[] 循环依赖科技：验证递归保护和确定性。
    var cycleDefinitions = [
        createTechnology("cycle_a", { prerequisiteTechnologyIds: ["cycle_b"], layoutOrder: 10 }),
        createTechnology("cycle_b", { prerequisiteTechnologyIds: ["cycle_a"], layoutOrder: 20 })
    ];
    // Object 循环测试游戏：加载循环定义。
    var cycleGame = createTestGame(cycleDefinitions);
    // GameState 循环测试状态：两项均未完成。
    var cycleState = createState(cycleDefinitions);
    // ResearchQueueSnapshot 第一次循环快照：应安全返回而不是无限递归。
    var firstCycleSnapshot = cycleGame.researchDecisions.getResearchQueueSnapshot(cycleState);
    // ResearchQueueSnapshot 第二次循环快照：验证同一状态确定性。
    var secondCycleSnapshot = cycleGame.researchDecisions.getResearchQueueSnapshot(cycleState);

    assert.ok(firstCycleSnapshot.attention.every(function (profile) { return profile.dependencyDistance >= 99; }));
    assert.strictEqual(firstCycleSnapshot.signature, secondCycleSnapshot.signature);

    // TechnologyDefinition[] 离散来源科技：魔晶无持续流量但可由已开放外交获得。
    var discreteDefinitions = [createTechnology("trade_target", { price: [{ resource: "manaCrystal", amount: 5 }] })];
    // Object 离散来源测试游戏：补充真实形状的势力奖励定义。
    var discreteGame = createTestGame(discreteDefinitions);

    discreteGame.definitions.FACTION_DEFINITIONS = [{ id: "trader", rewardResource: "manaCrystal" }];
    // GameState 离散来源状态：外交入口已开放。
    var discreteState = createState(discreteDefinitions);

    discreteState.tabsUnlockedById = { diplomacy: true };
    // ResearchQueueSnapshot 离散来源快照：科技可达但不应显示持续等待目标。
    var discreteSnapshot = discreteGame.researchDecisions.getResearchQueueSnapshot(discreteState);

    assert.strictEqual(discreteSnapshot.knowledgePressure.manaCrystal.sourceType, "discrete");
    assert.strictEqual(discreteSnapshot.target.length, 0);
    assert.strictEqual(discreteSnapshot.attention[0].waitSeconds, Infinity);
    assert.ok(discreteSnapshot.attention[0].bottleneckText.indexOf("制作、贸易、掠夺或远征") >= 0);

    // TechnologyDefinition[] 防抖科技：使用两类持续研究资源制造普通目标换位。
    var stabilityDefinitions = [
        createTechnology("stable_a", { price: [{ resource: "crudeKnowledge", amount: 10 }], layoutOrder: 10 }),
        createTechnology("stable_b", { price: [{ resource: "ledger", amount: 50 }], layoutOrder: 20 })
    ];
    // Object 防抖测试游戏：加载两个同价值候选。
    var stabilityGame = createTestGame(stabilityDefinitions);
    // GameState 防抖测试状态：两类资源均持续增长，A 初始等待更短。
    var stabilityState = createState(stabilityDefinitions);

    stabilityState.resourcesById.ledger.perSecond = 1;
    // ResearchDecisionRuntime 防抖运行态：模拟 UI 连续三次刷新。
    var stabilityRuntime = { stableSnapshot: null, pendingSnapshot: null, pendingSinceTimestamp: 0, structureSignature: "" };
    // ResearchQueueSnapshot 初始稳定快照：目标应为 A。
    var initialStableSnapshot = stabilityGame.researchDecisions.getResearchQueueSnapshot(stabilityState, stabilityRuntime, 1000);

    stabilityState.resourcesById.crudeKnowledge.perSecond = 0.01;
    // ResearchQueueSnapshot 窗口内快照：B 已更优但成员应暂时保持 A。
    var pendingStableSnapshot = stabilityGame.researchDecisions.getResearchQueueSnapshot(stabilityState, stabilityRuntime, 2000);
    // ResearchQueueSnapshot 窗口后快照：普通优势持续三秒后采用 B。
    var settledStableSnapshot = stabilityGame.researchDecisions.getResearchQueueSnapshot(stabilityState, stabilityRuntime, 5100);

    assert.strictEqual(initialStableSnapshot.target[0].technologyId, "stable_a");
    assert.strictEqual(pendingStableSnapshot.target[0].technologyId, "stable_a");
    assert.strictEqual(settledStableSnapshot.target[0].technologyId, "stable_b");

    // TechnologyDefinition[] 铺路科技链：远期系统入口通过中间节点连接到当前可研究前置。
    var pavingDefinitions = [
        createTechnology("paving_step", { price: [], layoutOrder: 10 }),
        createTechnology("middle_step", { prerequisiteTechnologyIds: ["paving_step"], layoutOrder: 20 }),
        createTechnology("major_goal", { prerequisiteTechnologyIds: ["middle_step"], nodeSize: "milestone", unlocks: { tabs: ["empire"] }, effectTags: ["系统"], layoutOrder: 30 }),
        createTechnology("ordinary_ready", { price: [], layoutOrder: 40 })
    ];
    // Object 铺路测试游戏：加载三层依赖链。
    var pavingGame = createTestGame(pavingDefinitions);
    // GameState 铺路状态：中间节点与目标正式揭示但前置未完成。
    var pavingState = createState(pavingDefinitions);
    // ResearchQueueSnapshot 铺路快照：当前可行动前置应获得具名目标解释。
    var pavingSnapshot = pavingGame.researchDecisions.getResearchQueueSnapshot(pavingState);
    // ResearchDecisionProfile|null 铺路档案：从可研究区查找依赖链第一步。
    var pavingProfile = pavingSnapshot.available.find(function (profile) { return profile.technologyId === "paving_step"; }) || null;

    assert.ok(pavingProfile);
    assert.strictEqual(pavingProfile.pavesForTechnologyId, "major_goal");
    assert.ok(pavingProfile.reasonText.indexOf("为“major_goal”铺路") >= 0);

    // TechnologyDefinition[] 多资源科技：验证并行等待取最慢项、主瓶颈取相对缺口最大项。
    var multiPriceDefinitions = [createTechnology("multi_price", { price: [{ resource: "crudeKnowledge", amount: 20 }, { resource: "ledger", amount: 40 }] })];
    // Object 多资源测试游戏：加载复合价格。
    var multiPriceGame = createTestGame(multiPriceDefinitions);
    // GameState 多资源状态：粗识缺 20、每秒 2，账册缺 20、每秒 1。
    var multiPriceState = createState(multiPriceDefinitions);

    multiPriceState.resourcesById.crudeKnowledge.perSecond = 2;
    multiPriceState.resourcesById.ledger.value = 20;
    multiPriceState.resourcesById.ledger.perSecond = 1;
    // ResearchQueueSnapshot 多资源快照：总等待应取账册的 20 秒。
    var multiPriceSnapshot = multiPriceGame.researchDecisions.getResearchQueueSnapshot(multiPriceState);

    assert.strictEqual(multiPriceSnapshot.target[0].waitSeconds, 20);
    assert.ok(multiPriceSnapshot.target[0].bottleneckText.indexOf("粗识") >= 0);
    assert.strictEqual(multiPriceSnapshot.target[0].bottleneckText.indexOf("crudeKnowledge"), -1);

    // TechnologyDefinition[] 保密科技：未知项与预览项都不得进入正式七槽。
    var secrecyDefinitions = [
        createTechnology("unknown_node", { layoutOrder: 10 }),
        createTechnology("preview_node", { prerequisiteTechnologyIds: ["unknown_node"], layoutOrder: 20 })
    ];
    // Object 保密测试游戏：加载隐藏节点。
    var secrecyGame = createTestGame(secrecyDefinitions);
    // GameState 保密状态：删除 unknown 状态，preview 保留未解锁状态。
    var secrecyState = createState(secrecyDefinitions);

    delete secrecyState.technologiesById.unknown_node;
    secrecyState.technologiesById.preview_node.isUnlocked = false;
    // ResearchQueueSnapshot 保密快照：三个正式区段均为空。
    var secrecySnapshot = secrecyGame.researchDecisions.getResearchQueueSnapshot(secrecyState);

    assert.strictEqual(secrecySnapshot.target.length + secrecySnapshot.available.length + secrecySnapshot.attention.length, 0);

    // TechnologyDefinition[] 压力科技：食物危机应让人口/生存解法压过普通系统入口。
    var pressureDefinitions = [
        createTechnology("food_solution", { price: [], effectTags: ["人口"], layoutOrder: 10 }),
        createTechnology("normal_system", { price: [], effectTags: ["系统"], unlocks: { buildings: ["ordinary"] }, layoutOrder: 20 })
    ];
    // Object 压力测试游戏：不提供人口模块，仅依赖菌菇耗尽权威状态。
    var pressureGame = createTestGame(pressureDefinitions);
    // GameState 压力状态：菌菇将在十秒内耗尽。
    var pressureState = createState(pressureDefinitions);

    pressureState.resourcesById.fungus.value = 10;
    pressureState.resourcesById.fungus.perSecond = -1;
    // ResearchQueueSnapshot 压力快照：生存解法应成为第一可研究项。
    var pressureSnapshot = pressureGame.researchDecisions.getResearchQueueSnapshot(pressureState);

    assert.strictEqual(pressureSnapshot.available[0].technologyId, "food_solution");

    // TechnologyDefinition[] 满仓扩容科技：采菌解锁储物坑，其他高广度科技不解决当前容量阻断。
    var capacityPressureDefinitions = [
        createTechnology("foraging", { name: "采菌", price: [], unlocks: { buildings: ["storage_pit"] }, layoutOrder: 10 }),
        createTechnology("mining", { name: "采矿", price: [], lineId: "industry", unlocks: { resources: ["ironOre", "coalSlag"], buildings: ["mine", "furnace", "workshop"] }, layoutOrder: 20 }),
        createTechnology("big_club", { name: "大木棒", price: [], lineId: "warfare", unlocks: { jobs: ["raider"], buildings: ["training_pit", "captive_bed"] }, layoutOrder: 30 })
    ];
    // Object 满仓扩容测试游戏：加入菌菇床与储物坑的真实结构化效果。
    var capacityPressureGame = createTestGame(capacityPressureDefinitions);

    capacityPressureGame.definitions.BUILDING_DEFINITIONS = [
        { id: "fungus_bed", name: "菌菇床", basePrice: [{ resource: "fungus", amount: 10 }], priceRatio: 1.12, effects: {} },
        { id: "storage_pit", name: "储物坑", basePrice: [{ resource: "rottenWood", amount: 50 }], priceRatio: 1.75, effects: { fungusMax: 5000 } }
    ];
    // GameState 满仓扩容状态：菌菇 100/100，下一座菌菇床约需 121 菌菇。
    var capacityPressureState = createState(capacityPressureDefinitions);

    capacityPressureState.resourcesById.fungus.maxValue = 100;
    capacityPressureState.buildingsById.fungus_bed = { owned: 22, isUnlocked: true };
    capacityPressureState.buildingsById.storage_pit = { owned: 0, isUnlocked: false };
    // ResearchQueueSnapshot 满仓扩容快照：采菌必须压过采矿和大木棒，并给出完整因果解释。
    var capacityPressureSnapshot = capacityPressureGame.researchDecisions.getResearchQueueSnapshot(capacityPressureState);

    assert.strictEqual(capacityPressureSnapshot.available[0].technologyId, "foraging");
    assert.ok(capacityPressureSnapshot.available[0].reasonText.indexOf("储物坑") >= 0);
    assert.ok(capacityPressureSnapshot.available[0].reasonText.indexOf("菌菇床") >= 0);
    assert.ok(capacityPressureSnapshot.available[0].reasonText.indexOf("菌菇容量") >= 0);
    // Price[] 采菌真实等待价格：验证粗识未齐时同一解法成为当前目标而非被采矿取代。
    capacityPressureDefinitions[0].price = [{ resource: "crudeKnowledge", amount: 25 }];
    capacityPressureDefinitions[1].price = [{ resource: "crudeKnowledge", amount: 50 }];
    capacityPressureDefinitions[2].price = [{ resource: "crudeKnowledge", amount: 45 }];
    capacityPressureState.resourcesById.crudeKnowledge.value = 10;
    // ResearchQueueSnapshot 满仓等待快照：采菌应成为唯一当前目标。
    var capacityWaitingSnapshot = capacityPressureGame.researchDecisions.getResearchQueueSnapshot(capacityPressureState);

    assert.strictEqual(capacityWaitingSnapshot.target[0].technologyId, "foraging");

    // TechnologyDefinition[] 资源冲突科技：当前目标与两个立即研究项争用同一研究货币。
    var conflictDefinitions = [
        createTechnology("strategic_goal", { name: "战略目标", price: [{ resource: "crudeKnowledge", amount: 100 }], nodeSize: "milestone", unlocks: { tabs: ["empire"] }, layoutOrder: 10 }),
        createTechnology("expensive_distraction", { name: "昂贵支线", price: [{ resource: "crudeKnowledge", amount: 60 }], layoutOrder: 20 }),
        createTechnology("free_alternative", { name: "免费替代", price: [], lineId: "order", layoutOrder: 30 })
    ];
    // Object 资源冲突测试游戏：验证机会成本进入推荐解释和排序。
    var conflictGame = createTestGame(conflictDefinitions);
    // GameState 资源冲突状态：库存足以研究支线，但战略目标仍缺四十粗识。
    var conflictState = createState(conflictDefinitions);

    conflictState.resourcesById.crudeKnowledge.value = 60;
    conflictState.resourcesById.crudeKnowledge.perSecond = 2;
    // ResearchQueueSnapshot 资源冲突快照：免费替代应排在会延迟目标的支线前。
    var conflictSnapshot = conflictGame.researchDecisions.getResearchQueueSnapshot(conflictState);
    // ResearchDecisionProfile 冲突支线档案：应包含目标、资源量和补回时间。
    var conflictProfile = conflictSnapshot.available.find(function (profile) { return profile.technologyId === "expensive_distraction"; });

    assert.strictEqual(conflictSnapshot.strategicTargetId, "strategic_goal");
    assert.strictEqual(conflictSnapshot.available[0].technologyId, "free_alternative");
    assert.strictEqual(conflictProfile.resourceConflict.amount, 40);
    assert.ok(conflictProfile.bottleneckText.indexOf("战略目标") >= 0);
    assert.ok(conflictProfile.bottleneckText.indexOf("约延迟 00:20") >= 0);

    // TechnologyDefinition[] 完成度科技：同档同等待区间时优先更接近价格完成者。
    var readinessDefinitions = [
        createTechnology("low_readiness", { price: [{ resource: "crudeKnowledge", amount: 100 }], layoutOrder: 10 }),
        createTechnology("high_readiness", { price: [{ resource: "ledger", amount: 100 }], layoutOrder: 20 })
    ];
    // Object 完成度测试游戏：两个目标的等待时间都属于中档。
    var readinessGame = createTestGame(readinessDefinitions);
    // GameState 完成度状态：账册目标完成度显著更高。
    var readinessState = createState(readinessDefinitions);

    readinessState.resourcesById.crudeKnowledge.value = 10;
    readinessState.resourcesById.crudeKnowledge.perSecond = 1;
    readinessState.resourcesById.ledger.value = 70;
    readinessState.resourcesById.ledger.perSecond = 0.5;
    // ResearchQueueSnapshot 完成度快照：同战略档位下选择更接近完成的账册目标。
    var readinessSnapshot = readinessGame.researchDecisions.getResearchQueueSnapshot(readinessState);

    assert.strictEqual(readinessSnapshot.target[0].technologyId, "high_readiness");
}

runTests();
console.log("researchDecisions.test.js PASS");
