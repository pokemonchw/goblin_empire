/* 建筑决策系统：诊断帝国压力，评价下一座建筑并生成稳定、只读的三个建设队列区段。 */
/**
 * 初始化建筑决策模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 buildingDecisions 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // string[] 受控意图 ID：限定决策层允许输出的经营意图。
    var INTENT_IDS = ["survive_food", "expand_housing", "recover_labor", "raise_capacity", "open_source", "stabilize_chain", "increase_output", "unlock_system", "advance_stage", "military_readiness", "faith_growth", "abyss_growth"];
    // Object.<string, number> 等待档位顺序：用于确定性决策键比较。
    var WAIT_BAND_ORDER_BY_ID = { now: 0, short: 1, medium: 2, long: 3, unreachable: 4 };
    // number 普通候选换位稳定窗口：新成员必须持续占优的毫秒数。
    var MEMBERSHIP_STABILITY_MILLISECONDS = 10000;

    /**
     * 生成建筑决策队列；只修改不入存档的界面防抖运行态，不修改 GameState。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @param {BuildingDecisionRuntime|null} decisionRuntime - 可选界面运行态；省略时直接返回纯计算结果。
     * @param {number} nowTimestamp - 当前毫秒时间戳，用于压力滞回和成员防抖。
     * @returns {BuildingQueueSnapshot} 最多七项且建筑不重复的队列快照。
     */
    function getBuildingQueueSnapshot(state, viewModels, decisionRuntime, nowTimestamp) {
        // EmpirePressureSnapshot 压力快照：所有建筑评价共享同一份帝国诊断。
        var pressureSnapshot = createEmpirePressureSnapshot(state, viewModels, decisionRuntime, nowTimestamp);
        // BuildingDecisionProfile[] 决策档案数组：保持定义顺序生成，随后使用稳定键排序。
        var profiles = createDecisionProfiles(state, viewModels, pressureSnapshot);
        enrichProfilesWithStrategicPlan(state, profiles);
        // BuildingQueueSnapshot 即时候选快照：尚未应用普通波动防抖。
        var candidateSnapshot = allocateQueueSections(profiles);

        if (!decisionRuntime) {
            return candidateSnapshot;
        }

        // string 结构签名：建筑数量、解锁、人口与严重压力变化时允许立即替换成员。
        var structureSignature = createStructureSignature(state, viewModels, pressureSnapshot);
        // boolean 是否结构事件：true 表示必须立即采用新成员。
        var isStructureEvent = decisionRuntime.structureSignature !== structureSignature;

        if (!decisionRuntime.stableSnapshot || isStructureEvent) {
            decisionRuntime.stableSnapshot = candidateSnapshot;
            decisionRuntime.pendingSnapshot = null;
            decisionRuntime.pendingSinceTimestamp = 0;
            decisionRuntime.structureSignature = structureSignature;
            return candidateSnapshot;
        }

        decisionRuntime.structureSignature = structureSignature;
        if (decisionRuntime.stableSnapshot.signature === candidateSnapshot.signature) {
            decisionRuntime.pendingSnapshot = null;
            decisionRuntime.pendingSinceTimestamp = 0;
            return candidateSnapshot;
        }

        // boolean 当前稳定成员是否失效：隐藏、失去作用或跨入致命风险时立即移出。
        var hasInvalidStableMember = doesSnapshotContainInvalidMember(decisionRuntime.stableSnapshot, profiles);

        if (hasInvalidStableMember) {
            decisionRuntime.stableSnapshot = candidateSnapshot;
            decisionRuntime.pendingSnapshot = null;
            decisionRuntime.pendingSinceTimestamp = 0;
            return candidateSnapshot;
        }

        if (!decisionRuntime.pendingSnapshot || decisionRuntime.pendingSnapshot.signature !== candidateSnapshot.signature) {
            decisionRuntime.pendingSnapshot = candidateSnapshot;
            decisionRuntime.pendingSinceTimestamp = nowTimestamp;
            return refreshSnapshotDetails(decisionRuntime.stableSnapshot, profiles);
        }

        if (nowTimestamp - decisionRuntime.pendingSinceTimestamp >= MEMBERSHIP_STABILITY_MILLISECONDS && isCandidateMateriallyBetter(candidateSnapshot, decisionRuntime.stableSnapshot)) {
            decisionRuntime.stableSnapshot = candidateSnapshot;
            decisionRuntime.pendingSnapshot = null;
            decisionRuntime.pendingSinceTimestamp = 0;
            return candidateSnapshot;
        }

        return refreshSnapshotDetails(decisionRuntime.stableSnapshot, profiles);
    }

    /**
     * 创建帝国压力快照，并按规格对口粮恢复执行时间滞回。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @param {BuildingDecisionRuntime|null} decisionRuntime - 可选界面运行态，会更新压力记忆。
     * @param {number} nowTimestamp - 当前毫秒时间戳。
     * @returns {EmpirePressureSnapshot} 当前压力诊断。
     */
    function createEmpirePressureSnapshot(state, viewModels, decisionRuntime, nowTimestamp) {
        // ResourceState 菌菇状态：用于库存、容量和运行时真实净流量判断。
        var fungusState = state.resourcesById.fungus;
        // ResourceFlowSummary|null 菌菇流量摘要：与资源浮窗复用同一分析来源。
        var fungusFlow = fungusState && game.resourceFlows ? game.resourceFlows.analyzeResourceFlow(state, "fungus") : null;
        // number 菌菇净流量：单位资源/秒，有符号浮点数。
        var fungusPerSecond = fungusFlow ? fungusFlow.finalPerSecond : (fungusState ? fungusState.perSecond : 0);
        // number 菌菇耗尽秒数：净消耗时为非负秒数，否则为正无穷。
        var fungusSecondsRemaining = fungusState && fungusPerSecond < 0 ? fungusState.value / Math.abs(fungusPerSecond) : Infinity;
        // string 原始口粮压力：未应用恢复滞回的 safe、warning 或 critical。
        var rawFoodPressure = fungusState && fungusPerSecond < 0 && (fungusState.value <= 0 || fungusSecondsRemaining <= 60) ? "critical" :
            (fungusState && ((fungusPerSecond < 0 && fungusSecondsRemaining <= 300) || (fungusState.maxValue > 0 && fungusState.value / fungusState.maxValue < 0.1)) ? "warning" : "safe");
        // string 口粮压力：暂停保留、运行中按 10/15 秒规则恢复。
        var foodPressure = applyPressureHysteresis(state, decisionRuntime, "food", rawFoodPressure, nowTimestamp);
        // number 存活人口数量：单位个体整数。
        var alivePopulation = game.population.countAliveGoblins(state);
        // number 住房上限：单位床位整数。
        var housingMax = game.population.calculateHousingMax(state);
        // boolean 是否仍具增长条件：有存活人口且菌菇尚未严重枯竭。
        var canPopulationGrow = alivePopulation > 0 && foodPressure !== "critical";
        // string 住房压力：达到上限为严重，仅剩一格且能增长为警告。
        var housingPressure = alivePopulation >= housingMax ? "critical" : (housingMax - alivePopulation <= 1 && canPopulationGrow ? "warning" : "safe");
        // LaborBreakdown 劳力摘要：与人口和生产停摆逻辑使用同一口径。
        var laborBreakdown = game.population.analyzeLaborBreakdown(state);
        // number 劳力占用率：人口无劳力时有占用按正无穷处理。
        var laborUsageRatio = laborBreakdown.populationLabor > 0 ? laborBreakdown.adjustedBuildingUsageTotal / laborBreakdown.populationLabor : (laborBreakdown.adjustedBuildingUsageTotal > 0 ? Infinity : 0);
        // number 最小候选劳力：下一座正式生产建筑的最小正劳力占用。
        var minimumCandidateLabor = getMinimumCandidateLabor(viewModels);
        // number 剩余劳力：单位劳力，允许为负数。
        var freeLabor = laborBreakdown.populationLabor - laborBreakdown.adjustedBuildingUsageTotal;
        // string 劳力压力：已过载为严重，占用率或下一座空间不足为警告。
        var laborPressure = laborBreakdown.isProductionLaborOverloaded ? "critical" : (laborUsageRatio >= 0.85 || (minimumCandidateLabor > 0 && freeLabor < minimumCandidateLabor) ? "warning" : "safe");
        // Object.<string, string> 容量压力字典：key 为 ResourceId，value 为 safe 或 warning。
        var storagePressureById = {};
        // ResourceId[] 持续净亏损资源数组：按资源定义稳定顺序生成。
        var deficitResourceIds = [];
        // number 资源循环索引：诊断全部有状态资源。
        for (var resourceIndex = 0; resourceIndex < game.definitions.RESOURCE_DEFINITIONS.length; resourceIndex += 1) {
            // ResourceDefinition 当前资源定义：用于读取稳定 ID 和容量属性。
            var resourceDefinition = game.definitions.RESOURCE_DEFINITIONS[resourceIndex];
            // ResourceState|null 当前资源状态：缺失状态跳过。
            var resourceState = state.resourcesById[resourceDefinition.id] || null;
            if (!resourceState) { continue; }
            storagePressureById[resourceDefinition.id] = resourceDefinition.isCapacityLimited && resourceState.maxValue > 0 && resourceState.value / resourceState.maxValue >= 0.95 && resourceState.perSecond > 0 ? "warning" : "safe";
            if (resourceState.perSecond < 0) { deficitResourceIds.push(resourceDefinition.id); }
        }
        // string[] 停滞生产链 ID：输入持续流量不足的已启用转换建筑。
        var stalledChainIds = collectStalledChainIds(state);

        return { foodPressure: foodPressure, housingPressure: housingPressure, laborPressure: laborPressure, storagePressureById: storagePressureById, deficitResourceIds: deficitResourceIds, stalledChainIds: stalledChainIds, activeStageId: getActiveStageId(state) };
    }

    /**
     * 对单项压力应用恢复滞回；暂停时不推进计时。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDecisionRuntime|null} decisionRuntime - 可选运行态，会更新压力记忆。
     * @param {string} pressureId - 压力稳定 ID。
     * @param {string} rawPressure - 当前原始压力等级。
     * @param {number} nowTimestamp - 当前毫秒时间戳。
     * @returns {string} 应用滞回后的压力等级。
     */
    function applyPressureHysteresis(state, decisionRuntime, pressureId, rawPressure, nowTimestamp) {
        if (!decisionRuntime) { return rawPressure; }
        // Object 压力记忆：保存上次等级和恢复候选起始时间。
        var pressureMemory = decisionRuntime.pressureMemoryById[pressureId] || { level: rawPressure, recoverySinceTimestamp: 0 };
        if (state.isPaused) { return pressureMemory.level; }
        // Object.<string, number> 等级权重字典：数值越高越严重。
        var pressureWeightById = { safe: 0, warning: 1, critical: 2 };
        if (pressureWeightById[rawPressure] >= pressureWeightById[pressureMemory.level]) {
            pressureMemory.level = rawPressure;
            pressureMemory.recoverySinceTimestamp = 0;
        } else {
            if (!pressureMemory.recoverySinceTimestamp) { pressureMemory.recoverySinceTimestamp = nowTimestamp; }
            // number 恢复所需毫秒数：严重降为警告需 10 秒，警告降为安全需 15 秒。
            var requiredMilliseconds = pressureMemory.level === "critical" ? 10000 : 15000;
            if (nowTimestamp - pressureMemory.recoverySinceTimestamp >= requiredMilliseconds) {
                pressureMemory.level = rawPressure;
                pressureMemory.recoverySinceTimestamp = 0;
            }
        }
        decisionRuntime.pressureMemoryById[pressureId] = pressureMemory;
        return pressureMemory.level;
    }

    /**
     * 为全部正式或预览建筑创建决策档案。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @param {EmpirePressureSnapshot} pressureSnapshot - 当前帝国压力快照。
     * @returns {BuildingDecisionProfile[]} 决策档案数组。
     */
    function createDecisionProfiles(state, viewModels, pressureSnapshot) {
        // BuildingDecisionProfile[] 档案数组：供区段分配使用。
        var profiles = [];
        // number 模型循环索引：按静态设计顺序评价建筑。
        for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) {
            profiles.push(createDecisionProfile(state, viewModels[modelIndex], pressureSnapshot));
        }
        return profiles;
    }

    /**
     * 创建单栋建筑的决策档案。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 单栋建筑视图模型。
     * @param {EmpirePressureSnapshot} pressureSnapshot - 当前帝国压力快照。
     * @returns {BuildingDecisionProfile} 完整决策档案。
     */
    function createDecisionProfile(state, viewModel, pressureSnapshot) {
        // BuildingDefinition 建筑定义：用于读取效果、路线与里程碑。
        var definition = viewModel.definition;
        // string[] 意图数组：从结构化效果和受控标签推导，不读取中文描述。
        var intentIds = getBuildingIntentIds(definition);
        // string 首要意图：根据当前压力选择最匹配意图。
        var primaryIntentId = getPrimaryIntentId(intentIds, pressureSnapshot);
        // number 推进档位：首座核心入口为 4，首座来源/系统为 3，阶段路线为 1。
        var progressionTier = getProgressionTier(viewModel, pressureSnapshot, intentIds);
        // number 紧迫度档位：当前危机直接解法最高，容量浪费和链路问题次之。
        var urgencyTier = getUrgencyTier(state, viewModel, pressureSnapshot, intentIds);
        // number 风险档位：劳力过载或转换输入不足视为致命风险。
        var riskTier = getRiskTier(state, viewModel, pressureSnapshot);
        // Object|null 唯一瓶颈：按风险、容量、来源、等待、前置顺序选择。
        var bottleneck = getPrimaryBottleneck(state, viewModel, riskTier);
        // string 等待档位：用于可达目标与排序。
        var waitBand = getWaitBand(state, viewModel);
        // number 直接度档位：危机直接效果为 3，铺路为 2，一般匹配为 1。
        var directnessTier = getDirectnessTier(viewModel, pressureSnapshot, intentIds, bottleneck);
        // number 效率档位：首座、可利用容量和未满仓产出具有更高边际价值。
        var efficiencyTier = getEfficiencyTier(state, viewModel, intentIds);
        // string 队列状态：把公开视图状态收敛到决策契约。
        // PriceWaitInfo 决策等待信息：暂停时使用不推进但保留可达性的诊断口径。
        var decisionWaitInfo = viewModel.decisionWaitInfo || viewModel.waitInfo;
        var queueStatus = viewModel.isPreview ? "preview" : (riskTier >= 4 || (viewModel.buildingViewStatus === "blocked" && !state.isPaused && !areSourceBlockersAcquirable(state, viewModel)) ? "blocked" : (decisionWaitInfo.isAffordable ? "available" : (decisionWaitInfo.isAvailable || areSourceBlockersAcquirable(state, viewModel) ? "reachable" : "blocked")));
        // Object.<string, string|number> 理由字段：渲染层只格式化，不重新推导排序业务。
        var reasonTokens = createReasonTokens(state, viewModel, primaryIntentId, pressureSnapshot, progressionTier, bottleneck);

        return { buildingId: definition.id, viewModel: viewModel, queueStatus: queueStatus, intentIds: intentIds, primaryIntentId: primaryIntentId, urgencyTier: urgencyTier, progressionTier: progressionTier, directnessTier: directnessTier, efficiencyTier: efficiencyTier, strategicLeverageTier: 0, blockerCoverageCount: 0, reservationConflictTier: 0, reservationDelaySeconds: 0, goalCompletionRatio: 0, riskTier: riskTier, waitBand: waitBand, bottleneck: bottleneck, reasonTokens: reasonTokens };
    }

    /**
     * 建立一个短视界战略计划：选定最高价值目标，提升其直接铺路节点，并惩罚会明显挪用目标缺口资源的普通消费。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDecisionProfile[]} profiles - 全部建筑档案，会写入纯派生的战略杠杆与资源冲突档位。
     * @returns {void} 无返回值。
     */
    function enrichProfilesWithStrategicPlan(state, profiles) {
        // BuildingDecisionProfile[] 战略目标候选：只考虑尚未支付且有明确推进价值的正式建筑。
        var strategicTargets = profiles.filter(function (profile) {
            return profile.queueStatus !== "preview" && profile.queueStatus !== "available" && profile.progressionTier >= 2;
        });
        // number 目标循环索引：排序前写入当前价格完成度，避免比较器依赖外部状态。
        for (var targetIndex = 0; targetIndex < strategicTargets.length; targetIndex += 1) {
            strategicTargets[targetIndex].goalCompletionRatio = getGoalCompletionRatio(state, strategicTargets[targetIndex].viewModel);
        }
        strategicTargets.sort(compareStrategicTargets);
        // BuildingDecisionProfile|null 战略目标：本轮只保留一个主目标，避免同时为多个远景保留互相冲突的资源。
        var strategicTarget = strategicTargets[0] || null;

        if (!strategicTarget) {
            return;
        }

        // Object.<string, number> 目标缺口字典：key 为 ResourceId，value 为尚缺资源量。
        var missingAmountByResourceId = getMissingAmountByResourceId(state, strategicTarget.viewModel);
        // string[] 目标阻断资源数组：容量与来源阻断按视图模型稳定顺序合并。
        var blockerResourceIds = strategicTarget.viewModel.capacityBlockedResourceIds.concat(strategicTarget.viewModel.sourceBlockedResourceIds);
        // number 档案循环索引：评估每栋建筑与战略目标之间的关系。
        for (var profileIndex = 0; profileIndex < profiles.length; profileIndex += 1) {
            // BuildingDecisionProfile 当前档案：会写入本轮纯派生战略字段。
            var profile = profiles[profileIndex];
            if (profile.buildingId === strategicTarget.buildingId || profile.queueStatus === "preview") {
                continue;
            }
            // string|null 直接解决的阻断资源 ID：容量提升或资源产出命中目标阻断时存在。
            var solvedResourceIds = getSolvedBlockerResourceIds(profile, strategicTarget, blockerResourceIds);
            // string|null 首个被解决资源 ID：用于蓝图签给出唯一、可核对的主因果。
            var solvedResourceId = solvedResourceIds[0] || null;
            if (solvedResourceId) {
                profile.blockerCoverageCount = solvedResourceIds.length;
                // boolean 是否全部一次解除：多阻断目标只有每项均被下一座清除时才属于最高战略杠杆。
                var canClearAllSolvedBlockers = solvedResourceIds.every(function (resourceId) {
                    return canSolutionClearBlocker(state, profile, strategicTarget, resourceId);
                });
                profile.strategicLeverageTier = canClearAllSolvedBlockers && solvedResourceIds.length === blockerResourceIds.length ? 3 : 2;
                profile.reasonTokens.dependencyTargetName = strategicTarget.viewModel.definition.name;
                profile.reasonTokens.dependencyResourceId = solvedResourceId;
                profile.reasonTokens.blockerCoverageCount = solvedResourceIds.length;
                continue;
            }
            if (profile.queueStatus !== "available" || profile.urgencyTier >= 3) {
                continue;
            }
            // number 资源冲突档位：0 无明显冲突，1 会消耗重要缺口，2 会消耗该资源当前库存的一半以上。
            profile.reservationConflictTier = getReservationConflictTier(state, profile.viewModel.price, missingAmountByResourceId);
            if (profile.reservationConflictTier > 0) {
                profile.reasonTokens.reservedForTargetName = strategicTarget.viewModel.definition.name;
                profile.reservationDelaySeconds = getReservationDelaySeconds(state, profile.viewModel.price, missingAmountByResourceId);
                profile.reasonTokens.reservationDelaySeconds = profile.reservationDelaySeconds;
            }
        }
    }

    /**
     * 计算目标当前价格的库存完成度，用于同推进档位目标之间优先完成更接近落地的计划。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 战略目标建筑视图模型。
     * @returns {number} 价格完成比例，范围 0-1；无价格目标返回 0。
     */
    function getGoalCompletionRatio(state, viewModel) {
        // number 价格权重总量：各价格项需求量之和，单位为归一化前资源量。
        var requiredTotal = 0;
        // number 已满足权重总量：每项最多计入其需求量。
        var satisfiedTotal = 0;
        // number 价格循环索引：遍历目标当前价格。
        for (var priceIndex = 0; priceIndex < viewModel.price.length; priceIndex += 1) {
            // Price 当前价格项：包含资源稳定 ID 与需求量。
            var priceEntry = viewModel.price[priceIndex];
            // ResourceState|null 当前资源状态：缺失时按零库存处理。
            var resourceState = state.resourcesById[priceEntry.resource] || null;
            requiredTotal += priceEntry.amount;
            satisfiedTotal += Math.min(priceEntry.amount, resourceState ? resourceState.value : 0);
        }
        return requiredTotal > 0 ? satisfiedTotal / requiredTotal : 0;
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object} viewModel - 目标建筑视图模型。 @returns {Object.<string, number>} key 为 ResourceId、value 为非负缺口资源量。 */
    function getMissingAmountByResourceId(state, viewModel) {
        // Object.<string, number> 缺口资源字典：由当前价格与库存直接计算。
        var missingAmountByResourceId = {};
        // number 价格循环索引：遍历目标的当前价格数组。
        for (var priceIndex = 0; priceIndex < viewModel.price.length; priceIndex += 1) {
            // Price 当前价格项：包含稳定资源 ID 与需求量。
            var priceEntry = viewModel.price[priceIndex];
            // ResourceState|null 对应资源状态：缺失状态按零库存计算。
            var resourceState = state.resourcesById[priceEntry.resource] || null;
            // number 资源缺口量：单位资源，保证非负。
            var missingAmount = Math.max(0, priceEntry.amount - (resourceState ? resourceState.value : 0));
            if (missingAmount > 0) {
                missingAmountByResourceId[priceEntry.resource] = missingAmount;
            }
        }
        return missingAmountByResourceId;
    }

    /** @param {BuildingDecisionProfile} solution - 解法建筑档案。 @param {BuildingDecisionProfile} target - 战略目标档案。 @param {ResourceId[]} blockerResourceIds - 目标阻断资源数组。 @returns {ResourceId|null} 被直接解决的首个资源 ID。 */
    function getSolvedBlockerResourceIds(solution, target, blockerResourceIds) {
        // ResourceId[] 容量解法资源数组：解法建筑能够增加容量的资源。
        var capacityResourceIds = getCapacityEffectResourceIds(solution.viewModel.definition);
        // ResourceId[] 来源解法资源数组：解法建筑能够直接产出的资源。
        var outputResourceIds = getOutputResourceIds(solution.viewModel.definition);
        // number 阻断循环索引：按目标原始阻断顺序查找，保证确定性。
        // ResourceId[] 已解决阻断资源数组：保留目标阻断原始顺序并去重。
        var solvedResourceIds = [];
        for (var blockerIndex = 0; blockerIndex < blockerResourceIds.length; blockerIndex += 1) {
            // ResourceId 当前阻断资源 ID。
            var blockerResourceId = blockerResourceIds[blockerIndex];
            if (target.viewModel.capacityBlockedResourceIds.indexOf(blockerResourceId) >= 0 && capacityResourceIds.indexOf(blockerResourceId) >= 0) {
                if (solvedResourceIds.indexOf(blockerResourceId) < 0) { solvedResourceIds.push(blockerResourceId); }
            }
            if (target.viewModel.sourceBlockedResourceIds.indexOf(blockerResourceId) >= 0 && outputResourceIds.indexOf(blockerResourceId) >= 0) {
                if (solvedResourceIds.indexOf(blockerResourceId) < 0) { solvedResourceIds.push(blockerResourceId); }
            }
        }
        return solvedResourceIds;
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {BuildingDecisionProfile} solution - 解法档案。 @param {BuildingDecisionProfile} target - 目标档案。 @param {ResourceId} resourceId - 被解决资源 ID。 @returns {boolean} 下一座解法建筑是否能一次清除容量阻断；来源解法只要有正产出即返回 true。 */
    function canSolutionClearBlocker(state, solution, target, resourceId) {
        if (target.viewModel.sourceBlockedResourceIds.indexOf(resourceId) >= 0) {
            return getOutputResourceIds(solution.viewModel.definition).indexOf(resourceId) >= 0;
        }
        // ResourceState|null 阻断资源状态：缺失时无法证明一次解除。
        var resourceState = state.resourcesById[resourceId] || null;
        // number 目标资源价格：单位资源，不存在时为正无穷。
        var targetAmount = getPriceAmount(target.viewModel.price, resourceId);
        // number 解法单座容量增量：单位资源。
        var capacityIncrease = getCapacityIncrease(solution.viewModel.definition, resourceId);
        return Boolean(resourceState && resourceState.maxValue + capacityIncrease >= targetAmount);
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {Price[]} price - 候选建筑当前价格。 @param {Object.<string, number>} missingAmountByResourceId - 战略目标缺口字典。 @returns {number} 资源保留冲突档位 0-2。 */
    function getReservationConflictTier(state, price, missingAmountByResourceId) {
        // number 延迟秒数：按当前正向流量估算候选消费需要重新积累的最长时间。
        var delaySeconds = getReservationDelaySeconds(state, price, missingAmountByResourceId);
        if (delaySeconds >= 30) { return 2; }
        if (delaySeconds >= 10) { return 1; }
        // number 最高冲突档位：遍历多资源价格后取最大值。
        var conflictTier = 0;
        // number 价格循环索引：评估候选对每项保留资源的消耗。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前候选价格项。
            var priceEntry = price[priceIndex];
            if (!missingAmountByResourceId[priceEntry.resource]) {
                continue;
            }
            // ResourceState|null 当前资源状态：缺失时无法形成可支付候选。
            var resourceState = state.resourcesById[priceEntry.resource] || null;
            if (resourceState && resourceState.perSecond <= 0 && priceEntry.amount >= resourceState.value * 0.5) {
                return 2;
            }
            conflictTier = 1;
        }
        return conflictTier;
    }


    /**
     * 估算非紧急消费对主目标造成的重新积累延迟。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Price[]} price - 候选建筑当前价格数组。
     * @param {Object.<string, number>} missingAmountByResourceId - 主目标缺口字典。
     * @returns {number} 最长恢复时间，单位秒；无自动恢复来源时为正无穷，无冲突时为 0。
     */
    function getReservationDelaySeconds(state, price, missingAmountByResourceId) {
        // number 最长延迟秒数：多资源消费取最慢恢复项。
        var maximumDelaySeconds = 0;
        // number 价格循环索引：只评估主目标仍缺少的资源。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前候选价格项。
            var priceEntry = price[priceIndex];
            if (!missingAmountByResourceId[priceEntry.resource]) { continue; }
            // ResourceFlowSummary 流量摘要：使用与资源栏一致的真实净流量。
            var resourceFlow = game.resourceFlows.analyzeResourceFlow(state, priceEntry.resource);
            // number 当前资源正向净流量：单位资源/秒。
            var positivePerSecond = Math.max(0, resourceFlow.finalPerSecond);
            if (positivePerSecond <= 0) { return Infinity; }
            maximumDelaySeconds = Math.max(maximumDelaySeconds, priceEntry.amount / positivePerSecond);
        }
        return maximumDelaySeconds;
    }

    /** @param {Price[]} price - 价格数组。 @param {ResourceId} resourceId - 目标资源 ID。 @returns {number} 对应价格资源量；不存在时返回正无穷。 */
    function getPriceAmount(price, resourceId) {
        // number 价格循环索引：按定义顺序查找资源价格。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            if (price[priceIndex].resource === resourceId) {
                return price[priceIndex].amount;
            }
        }
        return Infinity;
    }

    /** @param {BuildingDefinition} definition - 解法建筑定义。 @param {ResourceId} resourceId - 目标容量资源 ID。 @returns {number} 下一座提供的容量增量，单位资源。 */
    function getCapacityIncrease(definition, resourceId) {
        // number 单资源容量增量：来自 `<resourceId>Max` 效果。
        var directIncrease = Number(definition.effects[resourceId + "Max"]) || 0;
        // boolean 是否基础资源：全基础容量效果只对六种基础工业资源生效。
        var isBasicResource = ["fungus", "rottenWood", "rubble", "coalSlag", "ironOre", "ironPlate"].indexOf(resourceId) >= 0;
        return directIncrease + (isBasicResource ? Number(definition.effects.allBasicCapacity) || 0 : 0);
    }

    /**
     * 从结构化效果和标签推导受控意图。
     *
     * @param {BuildingDefinition} definition - 建筑静态定义。
     * @returns {string[]} 去重后的受控意图数组。
     */
    function getBuildingIntentIds(definition) {
        // string[] 意图数组：按战略优先顺序追加。
        var intentIds = [];
        // string[] 效果标签数组：静态展示契约中的受控标签。
        var effectTags = definition.effectTags || [];
        // Object.<string, number> 效果字典：key 为受控结算效果 ID。
        var effects = definition.effects || {};
        appendIntent(intentIds, effects.fungusPerTick || effects.foodConsumptionReductionRatio || effectTags.indexOf("food") >= 0, "survive_food");
        appendIntent(intentIds, effects.housingMax, "expand_housing");
        appendIntent(intentIds, effects.laborUsageReductionRatio, "recover_labor");
        appendIntent(intentIds, hasEffectSuffix(effects, "Max"), "raise_capacity");
        appendIntent(intentIds, hasDirectOutputEffect(effects), "open_source");
        appendIntent(intentIds, effectTags.indexOf("conversion") >= 0, "stabilize_chain");
        appendIntent(intentIds, hasEffectSuffix(effects, "OutputRatio") || hasEffectSuffix(effects, "PerTick") || hasEffectSuffix(effects, "PerSecond"), "increase_output");
        appendIntent(intentIds, definition.isMilestone || effectTags.indexOf("unlock") >= 0, "unlock_system");
        appendIntent(intentIds, definition.isMilestone, "advance_stage");
        appendIntent(intentIds, effectTags.indexOf("military") >= 0 || effectTags.indexOf("warbeast") >= 0, "military_readiness");
        appendIntent(intentIds, effectTags.indexOf("faith") >= 0, "faith_growth");
        appendIntent(intentIds, definition.routeId === "abyss" || effectTags.indexOf("abyss") >= 0, "abyss_growth");
        // string[] 显式意图数组：仅补充结构字段无法表达的设计意图。
        var hintedIntentIds = definition.decisionHints && definition.decisionHints.intentIds || [];
        // number 提示循环索引：验证后追加封闭集合成员。
        for (var hintIndex = 0; hintIndex < hintedIntentIds.length; hintIndex += 1) { appendIntent(intentIds, INTENT_IDS.indexOf(hintedIntentIds[hintIndex]) >= 0, hintedIntentIds[hintIndex]); }
        return intentIds;
    }

    /** @param {string[]} intentIds - 意图数组，会被修改。 @param {*} condition - 真值条件。 @param {string} intentId - 受控意图 ID。 @returns {void} 无返回值。 */
    function appendIntent(intentIds, condition, intentId) { if (condition && intentIds.indexOf(intentId) < 0) { intentIds.push(intentId); } }
    /** @param {Object.<string, number>} effects - 建筑效果字典。 @param {string} suffix - 效果键后缀。 @returns {boolean} 是否存在正数匹配效果。 */
    function hasEffectSuffix(effects, suffix) { return Object.keys(effects).some(function (effectId) { return effectId.slice(-suffix.length) === suffix && effects[effectId] > 0; }); }
    /** @param {Object.<string, number>} effects - 建筑效果字典。 @returns {boolean} 是否存在直接产出效果。 */
    function hasDirectOutputEffect(effects) { return Object.keys(effects).some(function (effectId) { return (effectId.slice(-7) === "PerTick" || effectId.slice(-9) === "PerSecond") && effectId.indexOf("Cost") < 0 && effects[effectId] > 0; }); }

    /** @param {string[]} intentIds - 建筑意图数组。 @param {EmpirePressureSnapshot} pressure - 压力快照。 @returns {string} 首要意图 ID。 */
    function getPrimaryIntentId(intentIds, pressure) {
        if (pressure.foodPressure !== "safe" && intentIds.indexOf("survive_food") >= 0) { return "survive_food"; }
        if (pressure.housingPressure !== "safe" && intentIds.indexOf("expand_housing") >= 0) { return "expand_housing"; }
        if (pressure.laborPressure !== "safe" && intentIds.indexOf("recover_labor") >= 0) { return "recover_labor"; }
        // string[] 默认优先序：无危机时依次推进、解锁、来源、容量和成长。
        var defaultOrder = ["advance_stage", "unlock_system", "open_source", "stabilize_chain", "raise_capacity", "increase_output", "military_readiness", "faith_growth", "abyss_growth", "expand_housing", "survive_food", "recover_labor"];
        // number 默认循环索引：查找建筑具备的最高优先意图。
        for (var orderIndex = 0; orderIndex < defaultOrder.length; orderIndex += 1) { if (intentIds.indexOf(defaultOrder[orderIndex]) >= 0) { return defaultOrder[orderIndex]; } }
        return "increase_output";
    }

    /** @param {Object} viewModel - 建筑视图模型。 @param {EmpirePressureSnapshot} pressure - 压力快照。 @param {string[]} intentIds - 意图数组。 @returns {number} 推进档位 0-4。 */
    function getProgressionTier(viewModel, pressure, intentIds) {
        // boolean 是否首座：拥有数量为零。
        var isFirstBuilding = !viewModel.state || viewModel.state.owned <= 0;
        if (isFirstBuilding && viewModel.definition.isMilestone) { return 4; }
        if (isFirstBuilding && (intentIds.indexOf("unlock_system") >= 0 || intentIds.indexOf("open_source") >= 0)) { return 3; }
        if (viewModel.capacityBlockedResourceIds.length > 0 || viewModel.sourceBlockedResourceIds.length > 0) { return 2; }
        return doesRouteMatchStage(viewModel.definition.routeId, pressure.activeStageId) ? 1 : 0;
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object} viewModel - 建筑视图模型。 @param {EmpirePressureSnapshot} pressure - 压力快照。 @param {string[]} intentIds - 意图数组。 @returns {number} 紧迫度档位 0-4。 */
    function getUrgencyTier(state, viewModel, pressure, intentIds) {
        if ((pressure.foodPressure === "critical" && intentIds.indexOf("survive_food") >= 0) || (pressure.laborPressure === "critical" && intentIds.indexOf("recover_labor") >= 0)) { return 4; }
        if (pressure.housingPressure === "critical" && intentIds.indexOf("expand_housing") >= 0) { return 3; }
        if (viewModel.capacityBlockedResourceIds.length > 0) { return 3; }
        // ResourceId[] 容量效果资源数组：用于判断建筑是否解决当前爆仓。
        var capacityResourceIds = getCapacityEffectResourceIds(viewModel.definition);
        // number 容量循环索引：任一对应资源爆仓即可升为档位 2。
        for (var capacityIndex = 0; capacityIndex < capacityResourceIds.length; capacityIndex += 1) { if (pressure.storagePressureById[capacityResourceIds[capacityIndex]] === "warning") { return 2; } }
        if (getConversionInputRiskResourceId(state, viewModel.definition)) { return 2; }
        if (intentIds.length > 0) { return 1; }
        return 0;
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object} viewModel - 建筑视图模型。 @param {EmpirePressureSnapshot} pressure - 压力快照。 @returns {number} 风险档位 0-4。 */
    function getRiskTier(state, viewModel, pressure) {
        if (viewModel.willOverloadLabor) { return 4; }
        if (getConversionInputRiskResourceId(state, viewModel.definition)) { return 4; }
        if (pressure.foodPressure !== "critical" && wouldCreateCriticalFoodRisk(state, viewModel.definition)) { return 4; }
        return viewModel.definition.effectTags.indexOf("risk") >= 0 ? 2 : 0;
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object} viewModel - 建筑视图模型。 @param {number} riskTier - 风险档位。 @returns {Object|null} 唯一瓶颈。 */
    function getPrimaryBottleneck(state, viewModel, riskTier) {
        if (viewModel.willOverloadLabor) { return { type: "labor_risk", resourceId: "labor", action: "先增加人口或建造劳力减免设施" }; }
        // ResourceId|null 转换输入风险资源：新增消耗无法由当前正向流量覆盖。
        var chainRiskResourceId = getConversionInputRiskResourceId(state, viewModel.definition);
        if (chainRiskResourceId) { return { type: "chain_risk", resourceId: chainRiskResourceId, action: "先稳定该资源产出" }; }
        if (riskTier >= 4) { return { type: "food_risk", resourceId: "fungus", action: "先稳定菌菇净流量" }; }
        if (viewModel.capacityBlockedResourceIds.length > 0) { return { type: "capacity", resourceId: viewModel.capacityBlockedResourceIds[0], action: getCapacitySolutionText(viewModel.capacityBlockedResourceIds[0]) }; }
        if (viewModel.sourceBlockedResourceIds.length > 0) {
            // ResourceId 来源阻断资源：选择价格顺序中的首项。
            var sourceResourceId = viewModel.sourceBlockedResourceIds[0];
            // Object 取得路径摘要：区分持续、手动、制作、贸易、掠夺与远征。
            var acquisition = getResourceAcquisition(state, sourceResourceId);
            return { type: acquisition.type === "none" ? "source_missing" : "discrete_source", resourceId: sourceResourceId, action: acquisition.text };
        }
        if (viewModel.waitInfo.entries.length > 0) { return { type: "waiting", resourceId: viewModel.waitInfo.entries[0].resource, action: "继续积累该资源" }; }
        if (viewModel.isPreview) { return { type: "prerequisite", resourceId: "", action: viewModel.unlockText }; }
        return null;
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object} viewModel - 建筑视图模型。 @returns {string} 等待档位。 */
    function getWaitBand(state, viewModel) { var decisionWaitInfo = viewModel.decisionWaitInfo || viewModel.waitInfo; if (decisionWaitInfo.isAffordable) { return "now"; } if (areSourceBlockersAcquirable(state, viewModel)) { return viewModel.sourceBlockedResourceIds.every(function (resourceId) { return getResourceAcquisition(state, resourceId).type === "manual"; }) ? "short" : "medium"; } if (!decisionWaitInfo.isAvailable || !Number.isFinite(decisionWaitInfo.seconds)) { return "unreachable"; } if (decisionWaitInfo.seconds <= 60) { return "short"; } return decisionWaitInfo.seconds <= 300 ? "medium" : "long"; }
    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object} viewModel - 建筑视图模型。 @returns {boolean} 所有来源阻断是否都有已开放离散取得路径且无容量阻断。 */
    function areSourceBlockersAcquirable(state, viewModel) { return viewModel.capacityBlockedResourceIds.length <= 0 && viewModel.sourceBlockedResourceIds.length > 0 && viewModel.sourceBlockedResourceIds.every(function (resourceId) { return getResourceAcquisition(state, resourceId).type !== "none"; }); }
    /** @param {Object} viewModel - 建筑视图模型。 @param {EmpirePressureSnapshot} pressure - 压力快照。 @param {string[]} intentIds - 意图数组。 @param {Object|null} bottleneck - 瓶颈。 @returns {number} 直接度 0-3。 */
    function getDirectnessTier(viewModel, pressure, intentIds, bottleneck) { if ((pressure.foodPressure !== "safe" && intentIds.indexOf("survive_food") >= 0) || (pressure.housingPressure !== "safe" && viewModel.definition.effects.housingMax) || (pressure.laborPressure !== "safe" && viewModel.definition.effects.laborUsageReductionRatio)) { return 3; } if (bottleneck && (bottleneck.type === "capacity" || bottleneck.type === "discrete_source")) { return 2; } return intentIds.length > 0 ? 1 : 0; }
    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object} viewModel - 建筑视图模型。 @param {string[]} intentIds - 意图数组。 @returns {number} 效率档位 0-3。 */
    function getEfficiencyTier(state, viewModel, intentIds) { if (intentIds.indexOf("increase_output") >= 0 && isOutputStorageFull(state, viewModel.definition) && (!viewModel.state || viewModel.state.owned <= 0 || !viewModel.definition.isMilestone)) { return 0; } if (!viewModel.state || viewModel.state.owned <= 0) { return 3; } if (intentIds.indexOf("raise_capacity") >= 0 && isAnyCapacityUseful(state, viewModel.definition)) { return 2; } if (intentIds.indexOf("increase_output") >= 0) { return 2; } return viewModel.state.owned < 5 ? 1 : 0; }

    /**
     * 将档案分配到“先处理→可建→目标→其他阻断”，保证不重复和槽位上限。
     *
     * @param {BuildingDecisionProfile[]} profiles - 全部建筑决策档案。
     * @returns {BuildingQueueSnapshot} 即时队列快照。
     */
    function allocateQueueSections(profiles) {
        // BuildingDecisionProfile[] 正式档案：预览默认不占七个槽位。
        var formalProfiles = profiles.filter(function (profile) { return profile.queueStatus !== "preview"; });
        // Object.<string, boolean> 已分配建筑字典：key 为 BuildingId，value true 表示已占一个区段。
        var assignedById = {};
        // BuildingDecisionProfile[] 致命风险项：最先进入先处理。
        var fatalAttention = formalProfiles.filter(function (profile) { return profile.riskTier >= 4; }).sort(compareDecisionProfiles);
        // BuildingDecisionProfile[] 先处理数组：最多三项。
        var attention = takeUnassigned(fatalAttention, assignedById, 3);
        // BuildingDecisionProfile[] 安全可建候选：过滤致命风险与零作用建筑。
        var availableCandidates = formalProfiles.filter(function (profile) { return profile.queueStatus === "available" && profile.riskTier < 4 && (profile.urgencyTier > 0 || profile.progressionTier > 0); }).sort(compareDecisionProfiles);
        // BuildingDecisionProfile[] 可建数组：采用意图覆盖选择最多三项。
        var available = selectDiverseProfiles(availableCandidates, assignedById, 3);
        // BuildingDecisionProfile[] 可达目标候选：长期普通成长项不得占据目标。
        var targetCandidates = formalProfiles.filter(function (profile) { return profile.queueStatus === "reachable" && profile.waitBand !== "unreachable" && (profile.waitBand !== "long" || profile.progressionTier >= 3) && !assignedById[profile.buildingId]; }).sort(compareDecisionProfiles);
        // BuildingDecisionProfile[] 当前目标数组：最多一项。
        var target = takeUnassigned(targetCandidates, assignedById, 1);
        // BuildingDecisionProfile[] 其他受阻候选：容量、来源和具名前置按决策键排序。
        var otherAttention = formalProfiles.filter(function (profile) { return profile.queueStatus === "blocked" && profile.bottleneck; }).sort(compareAttentionProfiles);
        attention = attention.concat(takeUnassigned(otherAttention, assignedById, 3 - attention.length));
        if (target.length <= 0) {
            // BuildingDecisionProfile[] 高价值受阻目标：用于依赖回溯寻找最近铺路建筑。
            var blockedTargets = otherAttention.filter(function (profile) { return profile.progressionTier >= 2; });
            promoteDependencySolution(blockedTargets, formalProfiles, available, attention, assignedById);
        }
        if (target.length + available.length + attention.length === 0) {
            // BuildingDecisionProfile|null 预览兜底：只显示一个匿名远景。
            var previewProfile = profiles.filter(function (profile) { return profile.queueStatus === "preview"; })[0] || null;
            if (previewProfile) { attention.push(previewProfile); }
        }
        // string 成员签名：区段和稳定 ID 组成，不含动态文案数值。
        var signature = createQueueSignature(target, available, attention);
        return { target: target, available: available, attention: attention, signature: signature };
    }

    /** @param {BuildingDecisionProfile} left - 左档案。 @param {BuildingDecisionProfile} right - 右档案。 @returns {number} Array.sort 比较值。 */
    function compareDecisionProfiles(left, right) { return right.urgencyTier - left.urgencyTier || right.directnessTier - left.directnessTier || right.strategicLeverageTier - left.strategicLeverageTier || right.blockerCoverageCount - left.blockerCoverageCount || right.progressionTier - left.progressionTier || left.reservationConflictTier - right.reservationConflictTier || left.reservationDelaySeconds - right.reservationDelaySeconds || Number((!right.viewModel.state || right.viewModel.state.owned === 0) && right.viewModel.definition.isMilestone) - Number((!left.viewModel.state || left.viewModel.state.owned === 0) && left.viewModel.definition.isMilestone) || right.efficiencyTier - left.efficiencyTier || left.riskTier - right.riskTier || WAIT_BAND_ORDER_BY_ID[left.waitBand] - WAIT_BAND_ORDER_BY_ID[right.waitBand] || getRepeatPenalty(left) - getRepeatPenalty(right) || left.viewModel.definition.designOrder - right.viewModel.definition.designOrder || left.buildingId.localeCompare(right.buildingId); }
    /** @param {BuildingDecisionProfile} left - 左侧战略目标档案。 @param {BuildingDecisionProfile} right - 右侧战略目标档案。 @returns {number} Array.sort 比较值；目标选择先看阶段推进，避免普通容量阻断冒充帝国主线。 */
    function compareStrategicTargets(left, right) { return right.progressionTier - left.progressionTier || right.urgencyTier - left.urgencyTier || right.directnessTier - left.directnessTier || right.goalCompletionRatio - left.goalCompletionRatio || WAIT_BAND_ORDER_BY_ID[left.waitBand] - WAIT_BAND_ORDER_BY_ID[right.waitBand] || left.riskTier - right.riskTier || left.viewModel.definition.designOrder - right.viewModel.definition.designOrder || left.buildingId.localeCompare(right.buildingId); }
    /** @param {BuildingDecisionProfile} left - 左档案。 @param {BuildingDecisionProfile} right - 右档案。 @returns {number} Array.sort 比较值。 */
    function compareAttentionProfiles(left, right) { return getAttentionTier(right) - getAttentionTier(left) || compareDecisionProfiles(left, right); }
    /** @param {BuildingDecisionProfile} profile - 建筑档案。 @returns {number} 先处理类别档位。 */
    function getAttentionTier(profile) { if (profile.riskTier >= 4) { return 5; } if (profile.bottleneck && profile.bottleneck.type === "capacity") { return 4; } if (profile.bottleneck && (profile.bottleneck.type === "source_missing" || profile.bottleneck.type === "discrete_source" || profile.bottleneck.type === "chain_risk")) { return 3; } if (profile.bottleneck && profile.bottleneck.type === "prerequisite") { return 2; } return 1; }
    /** @param {BuildingDecisionProfile} profile - 建筑档案。 @returns {number} 重复拥有惩罚非负整数。 */
    function getRepeatPenalty(profile) { return profile.urgencyTier >= 3 ? 0 : Math.min(4, profile.viewModel.state ? profile.viewModel.state.owned : 0); }

    /** @param {BuildingDecisionProfile[]} candidates - 已排序候选。 @param {Object.<string, boolean>} assignedById - 已分配字典，会修改。 @param {number} count - 最大数量整数。 @returns {BuildingDecisionProfile[]} 选中档案。 */
    function takeUnassigned(candidates, assignedById, count) { var selected = []; for (var candidateIndex = 0; candidateIndex < candidates.length && selected.length < count; candidateIndex += 1) { var profile = candidates[candidateIndex]; if (!assignedById[profile.buildingId]) { selected.push(profile); assignedById[profile.buildingId] = true; } } return selected; }
    /** @param {BuildingDecisionProfile[]} candidates - 已排序可建候选。 @param {Object.<string, boolean>} assignedById - 已分配字典，会修改。 @param {number} count - 最大数量整数。 @returns {BuildingDecisionProfile[]} 多样化选中档案。 */
    function selectDiverseProfiles(candidates, assignedById, count) { var selected = []; var coveredIntentById = {}; var coveredRouteById = {}; while (selected.length < count) { var chosen = null; for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) { var profile = candidates[candidateIndex]; if (assignedById[profile.buildingId]) { continue; } if (!chosen || (!coveredIntentById[profile.primaryIntentId] && coveredIntentById[chosen.primaryIntentId]) || (coveredIntentById[profile.primaryIntentId] === coveredIntentById[chosen.primaryIntentId] && !coveredRouteById[profile.viewModel.definition.routeId] && coveredRouteById[chosen.viewModel.definition.routeId])) { chosen = profile; } if (chosen === profile && !coveredIntentById[profile.primaryIntentId]) { break; } } if (!chosen) { break; } selected.push(chosen); assignedById[chosen.buildingId] = true; coveredIntentById[chosen.primaryIntentId] = true; coveredRouteById[chosen.viewModel.definition.routeId] = true; } return selected; }

    /**
     * 对最高价值受阻目标执行至多两层的容量/来源建筑回溯，并把最近可行动节点加入现有区段。
     *
     * @param {BuildingDecisionProfile[]} blockedTargets - 已排序受阻目标。
     * @param {BuildingDecisionProfile[]} profiles - 全部正式档案。
     * @param {BuildingDecisionProfile[]} available - 可建区数组，会修改。
     * @param {BuildingDecisionProfile[]} attention - 先处理数组，会修改。
     * @param {Object.<string, boolean>} assignedById - 已分配字典，会修改。
     * @returns {void} 无返回值。
     */
    function promoteDependencySolution(blockedTargets, profiles, available, attention, assignedById) {
        if (blockedTargets.length <= 0) { return; }
        // BuildingDecisionProfile 目标档案：仅回溯当前最高价值受阻建筑。
        var targetProfile = blockedTargets[0];
        // Object|null 目标瓶颈：必须具有资源 ID 才能查找解法。
        var bottleneck = targetProfile.bottleneck;
        if (!bottleneck || !bottleneck.resourceId) { return; }
        // Object.<string, boolean> 已访问建筑字典：防止两层依赖循环。
        var visitedBuildingIds = {};
        visitedBuildingIds[targetProfile.buildingId] = true;
        // Object.<string, boolean> 已访问资源字典：防止容量与来源资源互相回指。
        var visitedResourceIds = {};
        // BuildingDecisionProfile|null 铺路解法：优先可建、可达、风险低且一次解除的建筑。
        var solution = findDependencySolution(bottleneck.resourceId, bottleneck.type, profiles, visitedBuildingIds, visitedResourceIds, 0);
        if (!solution) { return; }
        solution.reasonTokens.dependencyTargetName = targetProfile.viewModel.definition.name;
        if (assignedById[solution.buildingId]) { return; }
        if (solution.queueStatus === "available" && available.length < 3 && solution.riskTier < 4) { available.push(solution); assignedById[solution.buildingId] = true; }
        else if (attention.length < 3) { attention.push(solution); assignedById[solution.buildingId] = true; }
    }

    /** @param {ResourceId} resourceId - 瓶颈资源 ID。 @param {string} bottleneckType - 容量或来源类型。 @param {BuildingDecisionProfile[]} profiles - 全部档案。 @param {Object.<string, boolean>} visitedBuildingIds - 已访问建筑字典，会修改。 @param {Object.<string, boolean>} visitedResourceIds - 已访问资源字典，会修改。 @param {number} depth - 当前深度 0-2 整数。 @returns {BuildingDecisionProfile|null} 最近可行动解法。 */
    function findDependencySolution(resourceId, bottleneckType, profiles, visitedBuildingIds, visitedResourceIds, depth) {
        if (visitedResourceIds[resourceId]) { if (typeof console !== "undefined" && console.warn) { console.warn("building_decision dependency_cycle resource=" + resourceId); } return null; }
        if (depth >= 2) { if (typeof console !== "undefined" && console.warn) { console.warn("building_decision dependency_depth resource=" + resourceId); } return null; }
        visitedResourceIds[resourceId] = true;
        // BuildingDecisionProfile[] 解法候选：容量效果或直接产出匹配目标资源。
        var solutions = profiles.filter(function (profile) { return !visitedBuildingIds[profile.buildingId] && (bottleneckType === "capacity" ? getCapacityEffectResourceIds(profile.viewModel.definition).indexOf(resourceId) >= 0 : getOutputResourceIds(profile.viewModel.definition).indexOf(resourceId) >= 0); }).sort(compareDecisionProfiles);
        // number 解法循环索引：优先返回可建或可达节点。
        for (var solutionIndex = 0; solutionIndex < solutions.length; solutionIndex += 1) { var solution = solutions[solutionIndex]; visitedBuildingIds[solution.buildingId] = true; if (solution.queueStatus === "available" || solution.queueStatus === "reachable") { return solution; } if (solution.bottleneck && solution.bottleneck.resourceId) { var nested = findDependencySolution(solution.bottleneck.resourceId, solution.bottleneck.type, profiles, visitedBuildingIds, visitedResourceIds, depth + 1); if (nested) { return nested; } } }
        return null;
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {ResourceId} resourceId - 资源 ID。 @returns {Object} 取得路径类型与中文方向。 */
    function getResourceAcquisition(state, resourceId) {
        // ResourceFlowSummary 流量摘要：与资源浮窗共享权威持续来源分析。
        var flow = game.resourceFlows.analyzeResourceFlow(state, resourceId);
        if (flow.totalOutputPerSecond > 0) { return { type: "continuous", text: "已有持续来源，先恢复或启用对应生产" }; }
        if (resourceId === "fungus" || resourceId === "rottenWood" || resourceId === "rubble") { return { type: "manual", text: "可通过地穴手动采集取得" }; }
        if (hasUnlockedRecipeForResource(state, resourceId)) { return { type: "craft", text: "可通过已开放制作配方取得" }; }
        if (state.tabsById && state.tabsById.diplomacy && state.tabsById.diplomacy.isUnlocked && (resourceId === "coin" || resourceId === "loot" || resourceId === "tar")) { return { type: "trade", text: "可通过已开放贸易或掠夺取得，不计算自动等待时间" }; }
        if (state.tabsById && state.tabsById.abyss && state.tabsById.abyss.isUnlocked && (resourceId === "manaCrystal" || resourceId === "relic" || resourceId === "riftShard" || resourceId === "abyssEcho")) { return { type: "expedition", text: "可通过已开放深渊远征取得，不计算自动等待时间" }; }
        return { type: "none", text: "当前未发现可用取得路径" };
    }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {ResourceId} resourceId - 目标资源 ID。 @returns {boolean} 是否有已解锁配方。 */
    function hasUnlockedRecipeForResource(state, resourceId) { if (!game.crafting || !game.definitions.CRAFT_RECIPE_DEFINITIONS) { return false; } return game.definitions.CRAFT_RECIPE_DEFINITIONS.some(function (recipeDefinition) { return recipeDefinition.outputResource === resourceId && game.crafting.isRecipeUnlocked(state, recipeDefinition.id); }); }
    /** @param {BuildingDefinition} definition - 建筑定义。 @returns {ResourceId[]} 容量效果资源 ID。 */
    function getCapacityEffectResourceIds(definition) { var resourceIds = Object.keys(definition.effects).filter(function (effectId) { return effectId.slice(-3) === "Max" && definition.effects[effectId] > 0; }).map(function (effectId) { return effectId.slice(0, -3); }); if (definition.effects.allBasicCapacity > 0) { resourceIds = resourceIds.concat(["fungus", "rottenWood", "rubble", "coalSlag", "ironOre", "ironPlate"]); } return resourceIds; }
    /** @param {BuildingDefinition} definition - 建筑定义。 @returns {ResourceId[]} 直接产出资源 ID。 */
    function getOutputResourceIds(definition) { var knownByEffectId = { fungusPerTick: "fungus", rottenWoodPerTick: "rottenWood", rubblePerTick: "rubble", crudeFurnaceIronOrePerSecond: "ironOre", crudeFurnaceIronPlatePerSecond: "ironPlate", charcoalKilnCoalSlagPerSecond: "coalSlag", leatherPerSecond: "leather", boneShardPerSecond: "boneShard", obediencePerSecond: "obedience", coinPerSecond: "coin", ledgerPerSecond: "ledger", ancestralEchoPerSecond: "ancestralEcho", tarPerSecond: "tar", abyssEchoPerSecond: "abyssEcho", deepFurnaceSteelPerSecond: "steelIngot", deepFurnaceBlackIronPerSecond: "blackIron", runeMachineKnowledgePerSecond: "crudeKnowledge" }; var outputIds = []; Object.keys(definition.effects).forEach(function (effectId) { if (knownByEffectId[effectId] && definition.effects[effectId] > 0) { outputIds.push(knownByEffectId[effectId]); } }); return outputIds.concat(definition.decisionHints && definition.decisionHints.outputResourceIds || []); }
    /** @param {BuildingDefinition} definition - 建筑定义。 @returns {ResourceId[]} 转换输入资源 ID。 */
    function getInputResourceIds(definition) { var knownByEffectId = { crudeFurnaceWoodCostPerSecond: "rottenWood", crudeFurnaceRubbleCostPerSecond: "rubble", charcoalKilnWoodCostPerSecond: "rottenWood", deepFurnaceTarCostPerSecond: "tar", runeMachineManaCostPerSecond: "manaCrystal" }; var inputIds = []; Object.keys(definition.effects).forEach(function (effectId) { if (knownByEffectId[effectId] && definition.effects[effectId] > 0) { inputIds.push(knownByEffectId[effectId]); } }); return inputIds.concat(definition.decisionHints && definition.decisionHints.inputResourceIds || []); }
    /** @param {GameState} state - 游戏状态，不会修改。 @param {BuildingDefinition} definition - 建筑定义。 @returns {ResourceId|null} 首个输入风险资源 ID。 */
    function getConversionInputRiskResourceId(state, definition) { var inputIds = getInputResourceIds(definition); for (var inputIndex = 0; inputIndex < inputIds.length; inputIndex += 1) { var flow = game.resourceFlows.analyzeResourceFlow(state, inputIds[inputIndex]); var required = getInputCostPerSecond(definition, inputIds[inputIndex]); if (flow.finalPerSecond + 0.000001 < required) { return inputIds[inputIndex]; } } return null; }
    /** @param {BuildingDefinition} definition - 建筑定义。 @param {ResourceId} resourceId - 输入资源 ID。 @returns {number} 下一座新增消耗量，资源/秒。 */
    function getInputCostPerSecond(definition, resourceId) { var effectIds = Object.keys(definition.effects); var total = 0; for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) { var effectId = effectIds[effectIndex]; if (effectId.indexOf("CostPerSecond") >= 0 && ((resourceId === "rottenWood" && effectId.indexOf("Wood") >= 0) || (resourceId === "rubble" && effectId.indexOf("Rubble") >= 0) || (resourceId === "tar" && effectId.indexOf("Tar") >= 0) || (resourceId === "manaCrystal" && effectId.indexOf("Mana") >= 0))) { total += definition.effects[effectId]; } } return total; }
    /** @param {GameState} state - 游戏状态，不会修改。 @returns {string[]} 已停滞转换建筑 ID。 */
    function collectStalledChainIds(state) { var stalledIds = []; for (var definitionIndex = 0; definitionIndex < game.definitions.BUILDING_DEFINITIONS.length; definitionIndex += 1) { var definition = game.definitions.BUILDING_DEFINITIONS[definitionIndex]; var buildingState = state.buildingsById[definition.id]; if (buildingState && buildingState.active > 0 && getConversionInputRiskResourceId(state, definition)) { stalledIds.push(definition.id); } } return stalledIds; }
    /** @param {GameState} state - 游戏状态，不会修改。 @param {BuildingDefinition} definition - 建筑定义。 @returns {boolean} 是否会令安全口粮直接进入严重净亏损。 */
    function wouldCreateCriticalFoodRisk(state, definition) { var fungusCost = getInputCostPerSecond(definition, "fungus"); return fungusCost > 0 && state.resourcesById.fungus.perSecond - fungusCost < 0 && state.resourcesById.fungus.value / Math.abs(state.resourcesById.fungus.perSecond - fungusCost) <= 60; }
    /** @param {GameState} state - 游戏状态，不会修改。 @param {BuildingDefinition} definition - 建筑定义。 @returns {boolean} 是否存在当前可利用容量。 */
    function isAnyCapacityUseful(state, definition) { return getCapacityEffectResourceIds(definition).some(function (resourceId) { var resourceState = state.resourcesById[resourceId]; return resourceState && (resourceState.value / Math.max(1, resourceState.maxValue) >= 0.75 || resourceState.perSecond > 0); }); }
    /** @param {GameState} state - 游戏状态，不会修改。 @param {BuildingDefinition} definition - 建筑定义。 @returns {boolean} 所有直接输出是否已满仓。 */
    function isOutputStorageFull(state, definition) { var outputIds = getOutputResourceIds(definition); return outputIds.length > 0 && outputIds.every(function (resourceId) { var resourceState = state.resourcesById[resourceId]; return resourceState && resourceState.maxValue > 0 && resourceState.value >= resourceState.maxValue; }); }
    /** @param {ResourceId} resourceId - 容量受阻资源 ID。 @returns {string} 可行动中文方向。 */
    function getCapacitySolutionText(resourceId) { var solution = game.definitions.BUILDING_DEFINITIONS.filter(function (definition) { return getCapacityEffectResourceIds(definition).indexOf(resourceId) >= 0; })[0] || null; return solution ? "先建造可增加该容量的“" + solution.name + "”" : "当前未发现可用容量设施"; }
    /** @param {Object[]} viewModels - 建筑视图模型数组。 @returns {number} 最小正劳力占用，单位劳力。 */
    function getMinimumCandidateLabor(viewModels) { var minimum = Infinity; for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) { if (!viewModels[modelIndex].isPreview && viewModels[modelIndex].laborUsage > 0) { minimum = Math.min(minimum, viewModels[modelIndex].laborUsage); } } return Number.isFinite(minimum) ? minimum : 0; }
    /** @param {GameState} state - 游戏状态，不会修改。 @returns {string} 当前阶段 ID。 */
    function getActiveStageId(state) { if (state.buildingsById.abyss_gate && state.buildingsById.abyss_gate.owned > 0) { return "abyss"; } if (state.buildingsById.black_iron_fortress && state.buildingsById.black_iron_fortress.owned > 0) { return "empire"; } if (state.buildingsById.chief_hall && state.buildingsById.chief_hall.owned > 0) { return "city_state"; } if (state.buildingsById.graffiti_wall && state.buildingsById.graffiti_wall.owned > 0) { return "clan"; } return "scramble"; }
    /** @param {BuildingRouteId} routeId - 建设路线 ID。 @param {string} stageId - 阶段 ID。 @returns {boolean} 路线是否匹配阶段。 */
    function doesRouteMatchStage(routeId, stageId) { if (stageId === "scramble") { return routeId === "survival" || routeId === "governance"; } if (stageId === "clan") { return routeId === "industry" || routeId === "storage" || routeId === "governance"; } if (stageId === "city_state") { return routeId === "military" || routeId === "industry"; } return stageId === "abyss" ? routeId === "abyss" : true; }

    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object} viewModel - 建筑视图模型。 @param {string} primaryIntentId - 首要意图。 @param {EmpirePressureSnapshot} pressure - 压力快照。 @param {number} progressionTier - 推进档位。 @param {Object|null} bottleneck - 瓶颈。 @returns {Object.<string, string|number>} 受控理由字段。 */
    function createReasonTokens(state, viewModel, primaryIntentId, pressure, progressionTier, bottleneck) { var kind = "growth"; if (viewModel.willOverloadLabor || (bottleneck && (bottleneck.type === "chain_risk" || bottleneck.type === "food_risk"))) { kind = "risk"; } else if (bottleneck && (bottleneck.type === "capacity" || bottleneck.type === "discrete_source" || bottleneck.type === "source_missing")) { kind = "blocker"; } else if (progressionTier >= 3) { kind = "progression"; } else if ((primaryIntentId === "survive_food" && pressure.foodPressure !== "safe") || (primaryIntentId === "expand_housing" && pressure.housingPressure !== "safe") || (primaryIntentId === "recover_labor" && pressure.laborPressure !== "safe")) { kind = "crisis"; } return { kind: kind, primaryIntentId: primaryIntentId, ownedCount: viewModel.state ? viewModel.state.owned : 0, effectValue: getPrimaryEffectValue(viewModel.definition), action: bottleneck ? bottleneck.action : "当前可建设" }; }
    /** @param {BuildingDefinition} definition - 建筑定义。 @returns {number} 首个正数效果值。 */
    function getPrimaryEffectValue(definition) { var effectIds = Object.keys(definition.effects); for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) { if (definition.effects[effectIds[effectIndex]] > 0 && effectIds[effectIndex] !== "laborUsage") { return definition.effects[effectIds[effectIndex]]; } } return 0; }
    /** @param {BuildingDecisionProfile[]} target - 目标区。 @param {BuildingDecisionProfile[]} available - 可建区。 @param {BuildingDecisionProfile[]} attention - 先处理区。 @returns {string} 稳定成员签名。 */
    function createQueueSignature(target, available, attention) { return "t:" + target.map(function (profile) { return profile.buildingId; }).join(",") + "|a:" + available.map(function (profile) { return profile.buildingId; }).join(",") + "|x:" + attention.map(function (profile) { return profile.buildingId; }).join(","); }
    /** @param {GameState} state - 游戏状态，不会修改。 @param {Object[]} viewModels - 建筑视图模型。 @param {EmpirePressureSnapshot} pressure - 压力快照。 @returns {string} 结构事件签名。 */
    function createStructureSignature(state, viewModels, pressure) { return state.goblins.filter(function (goblin) { return goblin.isAlive; }).length + "|" + pressure.foodPressure + "|" + pressure.laborPressure + "|" + viewModels.map(function (viewModel) { return viewModel.definition.id + ":" + (viewModel.state ? viewModel.state.owned + ":" + Number(viewModel.state.isUnlocked) : "x"); }).join(","); }
    /** @param {BuildingQueueSnapshot} snapshot - 稳定快照。 @param {BuildingDecisionProfile[]} profiles - 当前档案。 @returns {boolean} 是否含失效成员。 */
    function doesSnapshotContainInvalidMember(snapshot, profiles) { var currentById = {}; profiles.forEach(function (profile) { currentById[profile.buildingId] = profile; }); return snapshot.target.concat(snapshot.available, snapshot.attention).some(function (oldProfile) { var current = currentById[oldProfile.buildingId]; return !current || current.urgencyTier + current.progressionTier <= 0 || (oldProfile.riskTier < 4 && current.riskTier >= 4); }); }
    /** @param {BuildingQueueSnapshot} stableSnapshot - 旧成员快照。 @param {BuildingDecisionProfile[]} profiles - 当前档案。 @returns {BuildingQueueSnapshot} 保留成员但刷新数值的快照。 */
    function refreshSnapshotDetails(stableSnapshot, profiles) { var currentById = {}; profiles.forEach(function (profile) { currentById[profile.buildingId] = profile; }); var target = stableSnapshot.target.map(function (profile) { return currentById[profile.buildingId] || profile; }); var available = stableSnapshot.available.map(function (profile) { return currentById[profile.buildingId] || profile; }); var attention = stableSnapshot.attention.map(function (profile) { return currentById[profile.buildingId] || profile; }); return { target: target, available: available, attention: attention, signature: stableSnapshot.signature }; }
    /** @param {BuildingQueueSnapshot} candidate - 新候选。 @param {BuildingQueueSnapshot} stable - 当前稳定快照。 @returns {boolean} 新候选是否至少高出一个主要档位。 */
    function isCandidateMateriallyBetter(candidate, stable) { var candidateTop = candidate.available[0] || candidate.target[0] || candidate.attention[0]; var stableTop = stable.available[0] || stable.target[0] || stable.attention[0]; return !stableTop || (candidateTop && (candidateTop.urgencyTier > stableTop.urgencyTier || candidateTop.progressionTier > stableTop.progressionTier || candidateTop.riskTier >= stableTop.riskTier + 1)); }

    game.buildingDecisions = { getBuildingQueueSnapshot: getBuildingQueueSnapshot, createEmpirePressureSnapshot: createEmpirePressureSnapshot, createDecisionProfile: createDecisionProfile, getResourceAcquisition: getResourceAcquisition };
})(window.GoblinEmpire);
