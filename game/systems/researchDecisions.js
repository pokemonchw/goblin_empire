/* 研究决策系统：分析知识经济、依赖路径与科技收益，生成稳定且可解释的只读研究队列。 */
/**
 * 初始化研究决策系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 researchDecisions 模块。
 * @returns {void} 无返回值；只注册纯派生查询函数。
 */
(function (game) {
    // string[] 手动取得资源 ID：这些资源没有持续流量时仍可由玩家主动取得。
    var MANUAL_RESOURCE_IDS = ["crudeKnowledge", "fungus", "rottenWood", "rubble"];
    // number 普通队列成员变化稳定窗口：单位毫秒，避免资源阈值附近连续跳位。
    var MEMBERSHIP_STABILITY_MILLISECONDS = 3000;
    // Object.<string, number> 研究路线顺序：用于最终确定性平局。
    var LINE_ORDER_BY_ID = { survival: 0, industry: 1, order: 2, warfare: 3, mysticism: 4, abyss: 5 };

    /**
     * 生成研究决策队列快照，不修改游戏状态。
     *
     * @param {GameState} state - 当前游戏状态对象，只读。
     * @param {ResearchDecisionRuntime|null=} decisionRuntime - 可选运行时防抖状态；省略时返回即时快照。
     * @param {number=} nowTimestamp - 当前 Unix 毫秒时间戳；省略时使用零且不推进防抖。
     * @returns {ResearchQueueSnapshot} 包含目标、可研究、先处理和诊断摘要的队列快照。
     */
    function getResearchQueueSnapshot(state, decisionRuntime, nowTimestamp) {
        // ResearchDecisionContext 决策上下文：集中保存研究经济和已完成集合。
        var context = createDecisionContext(state);
        // ResearchDecisionProfile[] 全部已揭示未完成档案：未知与已完成科技不占队列。
        var profiles = game.definitions.TECHNOLOGY_DEFINITIONS.map(function (technologyDefinition) {
            return createDecisionProfile(state, technologyDefinition, context);
        }).filter(function (profile) {
            return profile.visibility !== "unknown" && profile.status !== "researched";
        });
        // ResearchDecisionProfile[] 正式候选：预览只作为依赖阻断解释，不作为主目标或可研究项。
        var formalProfiles = profiles.filter(function (profile) { return profile.visibility === "revealed"; });

        enrichProfilesWithDependencyPlans(formalProfiles, context);
        formalProfiles.sort(compareDecisionProfiles);
        // Object.<TechnologyId, boolean> 已分配科技字典：保证三个区段不重复。
        var assignedById = {};
        // ResearchDecisionProfile[] 当前目标：只选择可通过现有来源到达的等待资源节点。
        var target = formalProfiles.filter(function (profile) {
            return profile.status === "waiting_resources" && profile.isReachable && !profile.hasDiscreteSource;
        }).slice(0, 1);

        // ResearchDecisionProfile|null 战略目标：用于识别立即研究项会否挪用目标缺口资源。
        var strategicTarget = target[0] || null;

        applyStrategicResourceConflicts(formalProfiles, strategicTarget, context.knowledgePressure);
        formalProfiles.sort(compareDecisionProfiles);

        if (target[0]) { assignedById[target[0].technologyId] = true; }
        // ResearchDecisionProfile[] 可立即研究：按经营意图和路线双重覆盖选取。
        var available = selectDiverseProfiles(formalProfiles.filter(function (profile) {
            return profile.status === "available" && !assignedById[profile.technologyId];
        }), 3);
        available.forEach(function (profile) { assignedById[profile.technologyId] = true; });
        // ResearchDecisionProfile[] 先处理：优先容量/来源硬阻断和关键依赖，不罗列遥远预览。
        var attention = selectDiverseProfiles(formalProfiles.filter(function (profile) {
            return !assignedById[profile.technologyId] && (profile.status === "blocked_prerequisite" || !profile.isReachable || profile.hasCapacityBlock || profile.hasDiscreteSource);
        }), 3);

        attention.forEach(function (profile) { assignedById[profile.technologyId] = true; });
        // ResearchQueueSnapshot 即时快照：防抖前的确定性候选结果。
        var candidateSnapshot = {
            target: target,
            available: available,
            attention: attention,
            strategicTargetId: strategicTarget ? strategicTarget.technologyId : null,
            knowledgePressure: context.knowledgePressure,
            signature: createQueueSignature(target, available, attention)
        };

        return decisionRuntime ? stabilizeQueueSnapshot(candidateSnapshot, formalProfiles, state, decisionRuntime, Number(nowTimestamp) || 0) : candidateSnapshot;
    }

    /**
     * 创建研究决策上下文。
     *
     * @param {GameState} state - 当前游戏状态，只读。
     * @returns {ResearchDecisionContext} 知识资源压力、完成集合与当前时代摘要。
     */
    function createDecisionContext(state) {
        // Object.<TechnologyId, boolean> 已完成科技字典：key 为稳定科技 ID。
        var researchedById = {};
        // number 已完成最高层级：非负整数，用于识别贴近当前进度的节点。
        var deepestResearchedTier = 0;

        game.definitions.TECHNOLOGY_DEFINITIONS.forEach(function (technologyDefinition) {
            // TechnologyState|null 科技状态：旧档缺项时按未完成处理。
            var technologyState = state.technologiesById[technologyDefinition.id] || null;

            if (technologyState && technologyState.isResearched) {
                researchedById[technologyDefinition.id] = true;
                deepestResearchedTier = Math.max(deepestResearchedTier, technologyDefinition.tier);
            }
        });
        return {
            researchedById: researchedById,
            deepestResearchedTier: deepestResearchedTier,
            knowledgePressure: analyzeKnowledgePressure(state),
            activePressureIntentIds: getActivePressureIntentIds(state),
            capacityBottlenecks: getCapacityBottlenecks(state)
        };
    }

    /**
     * 查找“库存已满且已开放建筑的下一次价格超过容量”的真实推进阻断。
     *
     * @param {GameState} state - 当前游戏状态，只读。
     * @returns {CapacityBottleneck[]} 容量阻断数组；每项包含资源、受阻建筑、需求与当前上限。
     */
    function getCapacityBottlenecks(state) {
        // CapacityBottleneck[] 容量阻断数组：只记录玩家当前已能看见并购买的建筑需求。
        var bottlenecks = [];
        // BuildingDefinition[] 建筑定义数组：测试替身未提供建筑系统时安全返回空数组。
        var buildingDefinitions = game.definitions.BUILDING_DEFINITIONS || [];

        buildingDefinitions.forEach(function (buildingDefinition) {
            // BuildingState|null 建筑状态：未进入存档或尚未解锁的建筑不构成当前阻断。
            var buildingState = state.buildingsById ? state.buildingsById[buildingDefinition.id] || null : null;
            if (!buildingState || !buildingState.isUnlocked) { return; }
            // Price[] 下一座建筑价格：必须复用权威建筑价格结算，包含拥有量和威望修正。
            var nextPrice = game.buildings && game.buildings.getBuildingPrice ? game.buildings.getBuildingPrice(state, buildingDefinition) : [];

            nextPrice.forEach(function (priceEntry) {
                // ResourceState|null 成本资源状态：缺失资源不能伪装成已满容量瓶颈。
                var resourceState = state.resourcesById[priceEntry.resource] || null;
                if (!resourceState || resourceState.maxValue <= 0 || resourceState.value < resourceState.maxValue || priceEntry.amount <= resourceState.maxValue) { return; }
                bottlenecks.push({
                    resourceId: priceEntry.resource,
                    buildingId: buildingDefinition.id,
                    buildingName: buildingDefinition.name,
                    requiredAmount: priceEntry.amount,
                    maxValue: resourceState.maxValue
                });
            });
        });
        return bottlenecks;
    }

    /**
     * 分析三类研究货币的库存、净流量与取得能力。
     *
     * @param {GameState} state - 当前游戏状态，只读。
     * @returns {KnowledgePressureSnapshot} 以资源 ID 为 key 的研究经济诊断。
     */
    function analyzeKnowledgePressure(state) {
        // string[] 研究价格资源 ID：从真实科技价格收集，涵盖粗识之外的食物、材料和高级货币。
        var researchResourceIds = collectResearchPriceResourceIds();
        // Object.<ResourceId, KnowledgeResourcePressure> 压力字典：每项记录库存、容量、流量与来源类型。
        var pressureById = {};

        researchResourceIds.forEach(function (resourceId) {
            // ResourceState|null 资源状态：未解锁资源按零库存零容量处理。
            var resourceState = state.resourcesById[resourceId] || null;
            // number 每秒净流量：单位资源/秒，暂停不抹除最近结算值。
            var perSecond = resourceState ? Number(resourceState.perSecond) || 0 : 0;
            // string 来源类型：continuous、manual、discrete 或 none。
            var sourceType = getResourceSourceType(state, resourceId, perSecond);

            pressureById[resourceId] = {
                value: resourceState ? Number(resourceState.value) || 0 : 0,
                maxValue: resourceState ? Number(resourceState.maxValue) || 0 : 0,
                perSecond: perSecond,
                sourceType: sourceType
            };
        });
        return pressureById;
    }

    /**
     * 为单项科技建立可排序、可解释的决策档案。
     *
     * @param {GameState} state - 当前游戏状态，只读。
     * @param {TechnologyDefinition} definition - 科技静态定义。
     * @param {ResearchDecisionContext} context - 本轮共享决策上下文。
     * @returns {ResearchDecisionProfile} 科技决策档案。
     */
    function createDecisionProfile(state, definition, context) {
        // TechnologyState|null 科技运行状态：缺失时视为未知。
        var technologyState = state.technologiesById[definition.id] || null;
        // boolean 是否完成全部 AND 前置：true 表示必需前置均完成。
        var hasRequiredPrerequisites = definition.prerequisiteTechnologyIds.every(function (technologyId) { return Boolean(context.researchedById[technologyId]); });
        // boolean 是否满足 OR 前置：无 OR 条件或至少完成一项时为 true。
        var hasAlternativePrerequisite = definition.alternativePrerequisiteTechnologyIds.length <= 0 || definition.alternativePrerequisiteTechnologyIds.some(function (technologyId) { return Boolean(context.researchedById[technologyId]); });
        // PriceGap[] 资源缺口数组：只记录仍缺少的价格项。
        var missingPrices = getMissingPrices(state, definition.price);
        // boolean 是否存在容量硬阻断：价格超过当前资源容量。
        var hasCapacityBlock = definition.price.some(function (priceEntry) {
            // ResourceState|null 价格资源状态：不存在时容量为零。
            var resourceState = state.resourcesById[priceEntry.resource] || null;
            return !resourceState || priceEntry.amount > resourceState.maxValue;
        });
        // boolean 是否可由当前来源到达：容量足够，且每项缺口有持续或手动取得路径。
        var isReachable = !hasCapacityBlock && missingPrices.every(function (priceGap) {
            return context.knowledgePressure[priceGap.resource] && context.knowledgePressure[priceGap.resource].sourceType !== "none";
        });
        // boolean 是否依赖离散来源：true 表示需由制作、贸易、掠夺或远征主动取得，不进入自动等待目标。
        var hasDiscreteSource = missingPrices.some(function (priceGap) { return context.knowledgePressure[priceGap.resource] && context.knowledgePressure[priceGap.resource].sourceType === "discrete"; });
        // string 可见性：unknown、preview 或 revealed。
        var visibility = getVisibility(technologyState, hasRequiredPrerequisites, hasAlternativePrerequisite);
        // string 状态：用于严格分配队列区段。
        var status = getDecisionStatus(technologyState, visibility, hasRequiredPrerequisites && hasAlternativePrerequisite, missingPrices);
        // string[] 决策意图数组：从受控效果标签和解锁包推导，不解析中文描述。
        var intentIds = getIntentIds(definition);
        // number 推进档位：0-4 整数，区分系统入口、关键能力和常规强化。
        var progressionTier = getProgressionTier(definition, context);
        // CapacitySolution|null 容量解法：科技直接解锁能扩充受阻资源容量的建筑时建立因果链。
        var capacitySolution = getCapacitySolution(definition, context.capacityBottlenecks || []);
        // number 紧迫档位：0-4 整数，硬阻断和当前层关键入口优先。
        var urgencyTier = getUrgencyTier(definition, status, hasCapacityBlock, isReachable, context, intentIds, capacitySolution);
        // number 等待秒数：持续来源可计算精确最大等待；离散来源或不可达为 Infinity。
        var waitSeconds = calculateWaitSeconds(missingPrices, context.knowledgePressure);
        // string 主要瓶颈文案：仅使用当前公开且可验证的信息。
        var bottleneckText = getBottleneckText(definition, status, missingPrices, hasCapacityBlock, isReachable, context);

        return {
            technologyId: definition.id,
            definition: definition,
            visibility: visibility,
            status: status,
            intentIds: intentIds,
            primaryIntentId: intentIds[0] || "general_growth",
            urgencyTier: urgencyTier,
            progressionTier: progressionTier,
            pressureMatchTier: Math.max(getPressureMatchTier(intentIds, context.activePressureIntentIds), capacitySolution ? 3 : 0),
            capacitySolution: capacitySolution,
            readinessRatio: getPriceReadinessRatio(state, definition.price),
            resourceConflictTier: 0,
            resourceConflict: null,
            dependencyDistance: getDependencyDistance(definition, context.researchedById, {}),
            missingPrices: missingPrices,
            hasCapacityBlock: hasCapacityBlock,
            hasDiscreteSource: hasDiscreteSource,
            isReachable: isReachable,
            waitSeconds: waitSeconds,
            bottleneckText: bottleneckText,
            reasonText: capacitySolution ? "解锁“" + capacitySolution.capacityBuildingName + "”扩充" + game.resources.getResourceDisplayName(capacitySolution.resourceId) + "容量，使“" + capacitySolution.blockedBuildingName + "”的下一次建造可达。" : getReasonText(definition, progressionTier, intentIds[0] || "general_growth")
        };
    }

    /**
     * 判断科技是否直接解锁当前容量阻断所需的扩容建筑。
     *
     * @param {TechnologyDefinition} definition - 科技定义，只读。
     * @param {CapacityBottleneck[]} bottlenecks - 当前容量阻断数组。
     * @returns {CapacitySolution|null} 最近的直接扩容解法；没有则返回 null。
     */
    function getCapacitySolution(definition, bottlenecks) {
        // BuildingId[] 解锁建筑 ID 数组：只信任结构化 unlocks.buildings。
        var unlockedBuildingIds = definition.unlocks && Array.isArray(definition.unlocks.buildings) ? definition.unlocks.buildings : [];
        // CapacitySolution|null 首个确定性解法：按阻断与解锁定义顺序稳定选择。
        var solution = null;

        bottlenecks.some(function (bottleneck) {
            return unlockedBuildingIds.some(function (buildingId) {
                // BuildingDefinition|null 扩容建筑定义：必须真实增加受阻资源容量。
                var capacityBuilding = (game.definitions.BUILDING_DEFINITIONS || []).find(function (buildingDefinition) { return buildingDefinition.id === buildingId; }) || null;
                // string 容量效果字段：资源稳定 ID 加 Max，与现有建筑效果契约一致。
                var capacityEffectKey = bottleneck.resourceId + "Max";
                if (!capacityBuilding || !capacityBuilding.effects || Number(capacityBuilding.effects[capacityEffectKey]) <= 0) { return false; }
                solution = {
                    resourceId: bottleneck.resourceId,
                    blockedBuildingId: bottleneck.buildingId,
                    blockedBuildingName: bottleneck.buildingName,
                    capacityBuildingId: capacityBuilding.id,
                    capacityBuildingName: capacityBuilding.name
                };
                return true;
            });
        });
        return solution;
    }

    /**
     * 计算科技价格的已备齐比例，用于同档目标优先选择更接近完成者。
     *
     * @param {GameState} state - 当前游戏状态，只读。
     * @param {Price[]} price - 科技完整价格数组。
     * @returns {number} 价格完成比例，范围为 0-1；免费科技返回 1。
     */
    function getPriceReadinessRatio(state, price) {
        if (price.length <= 0) { return 1; }
        // number 完成比例总和：每种资源等权，避免大额基础资源吞没稀有货币信号。
        var readinessRatioTotal = 0;

        price.forEach(function (priceEntry) {
            // ResourceState|null 价格资源状态：缺失时视为零库存。
            var resourceState = state.resourcesById[priceEntry.resource] || null;
            // number 单项完成比例：范围为 0-1。
            var entryReadinessRatio = priceEntry.amount <= 0 ? 1 : Math.min(1, Math.max(0, (resourceState ? resourceState.value : 0) / priceEntry.amount));

            readinessRatioTotal += entryReadinessRatio;
        });
        return readinessRatioTotal / price.length;
    }

    /**
     * 标记会挪用当前战略目标缺口资源的立即研究项，并生成补回成本说明。
     *
     * @param {ResearchDecisionProfile[]} profiles - 正式科技档案数组，会更新冲突字段与瓶颈文案。
     * @param {ResearchDecisionProfile|null} strategicTarget - 当前可达等待目标；没有目标时为 null。
     * @param {KnowledgePressureSnapshot} pressureById - 研究价格资源压力字典。
     * @returns {void} 无返回值；只修改派生档案，不修改 GameState。
     */
    function applyStrategicResourceConflicts(profiles, strategicTarget, pressureById) {
        if (!strategicTarget) { return; }
        profiles.forEach(function (profile) {
            if (profile.status !== "available" || profile.technologyId === strategicTarget.technologyId || profile.pressureMatchTier >= 2) { return; }
            // ResourceConflict|null 主资源冲突：按会挪用的目标缺口比例选择唯一提示。
            var primaryConflict = null;

            profile.definition.price.forEach(function (priceEntry) {
                // PriceGap|null 目标同资源缺口：没有缺口就不存在挪用。
                var targetGap = strategicTarget.missingPrices.find(function (priceGap) { return priceGap.resource === priceEntry.resource; }) || null;

                if (!targetGap || priceEntry.amount <= 0) { return; }
                // number 冲突量：单位资源量，不超过目标尚缺数量。
                var conflictAmount = Math.min(priceEntry.amount, targetGap.amount);
                // number 冲突比例：0-1，用于挑选最影响目标的一种资源。
                var conflictRatio = targetGap.amount > 0 ? conflictAmount / targetGap.amount : 0;

                if (!primaryConflict || conflictRatio > primaryConflict.conflictRatio) {
                    primaryConflict = { resource: priceEntry.resource, amount: conflictAmount, conflictRatio: conflictRatio };
                }
            });
            if (!primaryConflict) { return; }
            // KnowledgeResourcePressure|null 冲突资源压力：用于估算补回时间。
            var pressure = pressureById[primaryConflict.resource] || null;
            // string 冲突资源中文名：玩家提示禁止暴露稳定 ID。
            var resourceName = game.resources.getResourceDisplayName(primaryConflict.resource);

            primaryConflict.recoverySeconds = pressure && pressure.perSecond > 0 ? primaryConflict.amount / pressure.perSecond : Infinity;
            profile.resourceConflict = primaryConflict;
            profile.resourceConflictTier = primaryConflict.conflictRatio >= 0.5 ? 2 : 1;
            profile.bottleneckText = "会占用“" + strategicTarget.definition.name + "”所需的 " + formatAmount(primaryConflict.amount) + " " + resourceName + "，" + (Number.isFinite(primaryConflict.recoverySeconds) ? "约延迟 " + formatDuration(primaryConflict.recoverySeconds) : "当前无法自动补回");
        });
    }

    /** @param {TechnologyState|null} technologyState - 科技状态。 @param {boolean} hasRequired - 是否完成 AND 前置。 @param {boolean} hasAlternative - 是否完成 OR 前置。 @returns {string} unknown、preview 或 revealed。 */
    function getVisibility(technologyState, hasRequired, hasAlternative) {
        if (!technologyState) { return "unknown"; }
        if (technologyState.isUnlocked || technologyState.isResearched) { return "revealed"; }
        return "preview";
    }

    /** @param {TechnologyState|null} technologyState - 科技状态。 @param {string} visibility - 可见性。 @param {boolean} hasPrerequisites - 是否满足前置。 @param {PriceGap[]} missingPrices - 价格缺口。 @returns {string} 决策状态 ID。 */
    function getDecisionStatus(technologyState, visibility, hasPrerequisites, missingPrices) {
        if (technologyState && technologyState.isResearched) { return "researched"; }
        if (visibility === "unknown") { return "unknown"; }
        if (!hasPrerequisites || visibility === "preview") { return "blocked_prerequisite"; }
        return missingPrices.length > 0 ? "waiting_resources" : "available";
    }

    /** @param {GameState} state - 当前游戏状态。 @param {Price[]} price - 科技价格数组。 @returns {PriceGap[]} 非零缺口数组。 */
    function getMissingPrices(state, price) {
        return price.map(function (priceEntry) {
            // ResourceState|null 价格资源状态：不存在时库存按零处理。
            var resourceState = state.resourcesById[priceEntry.resource] || null;
            return { resource: priceEntry.resource, amount: Math.max(0, priceEntry.amount - (resourceState ? resourceState.value : 0)), requiredAmount: priceEntry.amount };
        }).filter(function (priceGap) { return priceGap.amount > 0; });
    }

    /** @param {TechnologyDefinition} definition - 科技定义。 @returns {string[]} 封闭决策意图数组。 */
    function getIntentIds(definition) {
        // Object.<string, string> 效果标签到经营意图映射：未知标签不会产生伪造结论。
        var intentByTag = { "增产": "increase_output", "资源": "increase_output", "加工": "increase_output", "系统": "unlock_system", "军备": "military_readiness", "外交": "military_readiness", "人口": "survive_food", "容量": "raise_capacity", "自动化": "automation", "政策": "governance", "职业": "governance", "劳力": "governance", "远征": "abyss_growth", "契约": "faith_growth", "终局": "abyss_growth", "重置": "abyss_growth" };
        // string[] 意图数组：保持元数据标签顺序并去重。
        var intentIds = [];

        definition.effectTags.forEach(function (effectTag) { if (intentByTag[effectTag] && intentIds.indexOf(intentByTag[effectTag]) < 0) { intentIds.push(intentByTag[effectTag]); } });
        if (getUnlockBreadth(definition) > 0 && intentIds.indexOf("unlock_system") < 0) { intentIds.unshift("unlock_system"); }
        return intentIds.length > 0 ? intentIds : ["general_growth"];
    }

    /** @param {TechnologyDefinition} definition - 科技定义。 @param {ResearchDecisionContext} context - 决策上下文。 @returns {number} 0-4 推进档位。 */
    function getProgressionTier(definition, context) {
        // number 解锁广度：直接解锁项目数量。
        var unlockBreadth = getUnlockBreadth(definition);
        // number 解锁语义档：主标签入口高于普通数组项目数量，避免“解锁多但无关”压过新系统。
        var unlockSemanticTier = getUnlockSemanticTier(definition);
        if (unlockSemanticTier >= 4 || (definition.nodeSize === "milestone" && unlockBreadth > 0)) { return 4; }
        if (unlockSemanticTier >= 3 || unlockBreadth >= 2) { return 3; }
        if (unlockBreadth === 1 || definition.nodeSize === "milestone") { return 2; }
        return definition.tier <= context.deepestResearchedTier + 1 ? 1 : 0;
    }

    /** @param {TechnologyDefinition} definition - 科技定义。 @param {string} status - 决策状态。 @param {boolean} hasCapacityBlock - 是否容量硬阻断。 @param {boolean} isReachable - 是否可达。 @param {ResearchDecisionContext} context - 决策上下文。 @param {string[]} intentIds - 科技经营意图。 @param {CapacitySolution|null} capacitySolution - 当前建造容量阻断的直接解法；无匹配为 null。 @returns {number} 0-4 紧迫档位。 */
    function getUrgencyTier(definition, status, hasCapacityBlock, isReachable, context, intentIds, capacitySolution) {
        if (capacitySolution) { return 4; }
        if (hasCapacityBlock) { return 4; }
        if (!isReachable && status === "waiting_resources") { return 3; }
        if (getPressureMatchTier(intentIds, context.activePressureIntentIds) >= 2) { return 3; }
        if (status === "available" && definition.tier <= context.deepestResearchedTier + 1) { return 2; }
        if (status === "blocked_prerequisite" && definition.tier <= context.deepestResearchedTier + 2) { return 1; }
        return 0;
    }

    /** @param {TechnologyDefinition} definition - 科技定义。 @returns {number} 解锁数组项目总数。 */
    function getUnlockBreadth(definition) {
        // Object 解锁包：key 为受控解锁类别。
        var unlockBundle = definition.unlocks || {};
        return Object.keys(unlockBundle).reduce(function (total, unlockKey) { return total + (Array.isArray(unlockBundle[unlockKey]) ? unlockBundle[unlockKey].length : 0); }, 0);
    }

    /** @param {TechnologyDefinition} definition - 科技定义。 @returns {number} 0-4 解锁类别语义档位。 */
    function getUnlockSemanticTier(definition) {
        // Object 解锁包：只读取定义契约中的受控类别。
        var unlockBundle = definition.unlocks || {};
        if (Array.isArray(unlockBundle.tabs) && unlockBundle.tabs.length > 0) { return 4; }
        if ((Array.isArray(unlockBundle.policies) && unlockBundle.policies.length > 0) || (Array.isArray(unlockBundle.jobs) && unlockBundle.jobs.length > 0) || (Array.isArray(unlockBundle.crafts) && unlockBundle.crafts.length > 0) || (Array.isArray(unlockBundle.resources) && unlockBundle.resources.length > 0)) { return 3; }
        if ((Array.isArray(unlockBundle.buildings) && unlockBundle.buildings.length > 0) || (Array.isArray(unlockBundle.technologies) && unlockBundle.technologies.length > 0)) { return 2; }
        return 0;
    }

    /** @param {PriceGap[]} missingPrices - 资源缺口。 @param {KnowledgePressureSnapshot} pressureById - 研究资源压力。 @returns {number} 最大持续等待秒数或 Infinity。 */
    function calculateWaitSeconds(missingPrices, pressureById) {
        // number 最大等待秒数：并行积累多资源时取最慢一项。
        var maximumWaitSeconds = 0;
        for (var gapIndex = 0; gapIndex < missingPrices.length; gapIndex += 1) {
            // PriceGap 当前价格缺口：用于查询对应知识流量。
            var priceGap = missingPrices[gapIndex];
            // KnowledgeResourcePressure|null 资源压力：缺失时不可计算。
            var pressure = pressureById[priceGap.resource] || null;
            if (!pressure || pressure.perSecond <= 0) { return Infinity; }
            maximumWaitSeconds = Math.max(maximumWaitSeconds, priceGap.amount / pressure.perSecond);
        }
        return maximumWaitSeconds;
    }

    /** @param {TechnologyDefinition} definition - 科技定义。 @param {Object.<TechnologyId, boolean>} researchedById - 完成字典。 @param {Object.<TechnologyId, boolean>} visitingById - 递归访问字典。 @returns {number} 最近未完成依赖距离，循环为 99。 */
    function getDependencyDistance(definition, researchedById, visitingById) {
        if (visitingById[definition.id]) { return 99; }
        // TechnologyId[] 未完成前置数组：AND 全部保留，OR 只需最近一条但统一参与最小值。
        var missingPrerequisiteIds = definition.prerequisiteTechnologyIds.concat(definition.alternativePrerequisiteTechnologyIds).filter(function (technologyId) { return !researchedById[technologyId]; });
        if (missingPrerequisiteIds.length <= 0) { return 0; }
        visitingById[definition.id] = true;
        // number 最近依赖距离：限制在 99 以内，避免错误元数据无限递归。
        var distance = 99;
        missingPrerequisiteIds.forEach(function (technologyId) {
            // TechnologyDefinition|null 前置定义：缺失配置按不可达处理。
            var prerequisiteDefinition = game.definitions.TECHNOLOGY_DEFINITIONS.find(function (candidateDefinition) { return candidateDefinition.id === technologyId; }) || null;
            if (prerequisiteDefinition) { distance = Math.min(distance, 1 + getDependencyDistance(prerequisiteDefinition, researchedById, visitingById)); }
        });
        delete visitingById[definition.id];
        return distance;
    }

    /**
     * 把高价值受阻科技的最近可行动前置标记为铺路方案。
     *
     * @param {ResearchDecisionProfile[]} profiles - 全部正式科技档案，会更新铺路理由与推进档。
     * @param {ResearchDecisionContext} context - 本轮研究决策上下文。
     * @returns {void} 无返回值；只修改纯派生档案，不修改 GameState 或静态定义。
     */
    function enrichProfilesWithDependencyPlans(profiles, context) {
        // Object.<TechnologyId, ResearchDecisionProfile> 档案索引：用于从依赖 ID 找到可行动科技。
        var profilesById = {};

        profiles.forEach(function (profile) { profilesById[profile.technologyId] = profile; });
        // ResearchDecisionProfile[] 高价值受阻目标：优先为里程碑和直接解锁节点寻找铺路项。
        var blockedTargets = profiles.filter(function (profile) { return profile.status === "blocked_prerequisite" && profile.progressionTier >= 2; }).sort(compareDecisionProfiles);

        blockedTargets.forEach(function (blockedTarget) {
            // ResearchDecisionProfile|null 最近可行动前置：递归最多三层，循环或未知定义返回 null。
            var pavingProfile = findNearestActionablePrerequisite(blockedTarget.definition, profilesById, context.researchedById, {}, 0);

            if (!pavingProfile || pavingProfile.technologyId === blockedTarget.technologyId) { return; }
            // number 铺路推进档：至少为 2，但不超过目标自身推进档，保持主系统目标价值上限。
            var pavingProgressionTier = Math.max(2, blockedTarget.progressionTier - 1);

            if (!pavingProfile.pavesForTechnologyId || pavingProgressionTier > pavingProfile.progressionTier) {
                pavingProfile.pavesForTechnologyId = blockedTarget.technologyId;
                pavingProfile.progressionTier = Math.max(pavingProfile.progressionTier, pavingProgressionTier);
                pavingProfile.reasonText = "为“" + blockedTarget.definition.name + "”铺路。" + pavingProfile.reasonText;
            }
        });
    }

    /**
     * 递归寻找距离目标最近的正式可行动前置。
     *
     * @param {TechnologyDefinition} targetDefinition - 当前回溯目标科技定义。
     * @param {Object.<TechnologyId, ResearchDecisionProfile>} profilesById - 正式科技档案索引。
     * @param {Object.<TechnologyId, boolean>} researchedById - 已完成科技字典。
     * @param {Object.<TechnologyId, boolean>} visitingById - 当前递归访问集合，会临时修改。
     * @param {number} depth - 当前递归深度，0-3 整数。
     * @returns {ResearchDecisionProfile|null} 可立即研究或可达等待资源的最近铺路档案。
     */
    function findNearestActionablePrerequisite(targetDefinition, profilesById, researchedById, visitingById, depth) {
        if (depth >= 3 || visitingById[targetDefinition.id]) { return null; }
        visitingById[targetDefinition.id] = true;
        // TechnologyId[] 缺失 AND 前置：全部都是必经节点。
        var missingRequiredIds = targetDefinition.prerequisiteTechnologyIds.filter(function (technologyId) { return !researchedById[technologyId]; });
        // TechnologyId[] 缺失 OR 前置：尚未完成任一项时保留全部备选，否则为空。
        var missingAlternativeIds = targetDefinition.alternativePrerequisiteTechnologyIds.some(function (technologyId) { return researchedById[technologyId]; }) ? [] : targetDefinition.alternativePrerequisiteTechnologyIds.slice();
        // TechnologyId[] 缺失前置 ID：AND 与 OR 候选按定义稳定顺序合并。
        var missingPrerequisiteIds = missingRequiredIds.concat(missingAlternativeIds);
        // ResearchDecisionProfile[] 直接可行动候选：正式揭示且可研究或资源可达。
        var directProfiles = missingPrerequisiteIds.map(function (technologyId) { return profilesById[technologyId] || null; }).filter(function (profile) { return profile && (profile.status === "available" || (profile.status === "waiting_resources" && profile.isReachable && !profile.hasDiscreteSource)); }).sort(compareDecisionProfiles);

        if (directProfiles[0]) {
            delete visitingById[targetDefinition.id];
            return directProfiles[0];
        }
        // ResearchDecisionProfile|null 最佳深层铺路项：按标准决策键比较递归结果。
        var bestNestedProfile = null;

        missingPrerequisiteIds.forEach(function (technologyId) {
            // TechnologyDefinition|null 前置定义：缺失定义不参与递归。
            var prerequisiteDefinition = game.definitions.TECHNOLOGY_DEFINITIONS.find(function (candidateDefinition) { return candidateDefinition.id === technologyId; }) || null;
            // ResearchDecisionProfile|null 深层铺路项：从当前前置继续回溯。
            var nestedProfile = prerequisiteDefinition ? findNearestActionablePrerequisite(prerequisiteDefinition, profilesById, researchedById, visitingById, depth + 1) : null;
            if (nestedProfile && (!bestNestedProfile || compareDecisionProfiles(nestedProfile, bestNestedProfile) < 0)) { bestNestedProfile = nestedProfile; }
        });
        delete visitingById[targetDefinition.id];
        return bestNestedProfile;
    }

    /** @param {TechnologyDefinition} definition - 科技定义。 @param {string} status - 决策状态。 @param {PriceGap[]} missingPrices - 缺口数组。 @param {boolean} hasCapacityBlock - 是否容量阻断。 @param {boolean} isReachable - 是否可达。 @param {ResearchDecisionContext} context - 决策上下文。 @returns {string} 唯一主瓶颈说明。 */
    function getBottleneckText(definition, status, missingPrices, hasCapacityBlock, isReachable, context) {
        if (status === "blocked_prerequisite") {
            // TechnologyId|null 首个未完成具名前置：只输出已定义关系。
            var missingPrerequisiteId = definition.prerequisiteTechnologyIds.concat(definition.alternativePrerequisiteTechnologyIds).find(function (technologyId) { return !context.researchedById[technologyId]; }) || null;
            // TechnologyDefinition|null 前置定义：定义缺失时使用通用诊断。
            var prerequisiteDefinition = missingPrerequisiteId ? game.definitions.TECHNOLOGY_DEFINITIONS.find(function (candidateDefinition) { return candidateDefinition.id === missingPrerequisiteId; }) : null;
            return prerequisiteDefinition ? "先完成“" + prerequisiteDefinition.name + "”" : "前置研究尚未完成";
        }
        if (missingPrices.length <= 0) { return "资源齐备，可立即研究"; }
        // PriceGap 主缺口：按需求比例选择真正占主导的研究货币。
        var primaryGap = missingPrices.slice().sort(function (leftGap, rightGap) { return rightGap.amount / rightGap.requiredAmount - leftGap.amount / leftGap.requiredAmount; })[0];
        // string 主缺口中文资源名：玩家文案不得输出稳定资源 ID。
        var resourceName = game.resources.getResourceDisplayName(primaryGap.resource);
        // KnowledgeResourcePressure|null 主缺口压力：用于给出容量或来源结论。
        var pressure = context.knowledgePressure[primaryGap.resource] || null;
        if (hasCapacityBlock && pressure && primaryGap.requiredAmount > pressure.maxValue) { return resourceName + "容量不足：需要 " + primaryGap.requiredAmount + "，当前上限 " + pressure.maxValue; }
        if (!isReachable || !pressure || pressure.sourceType === "none") { return resourceName + "尚无可用取得路径"; }
        if (pressure.sourceType === "manual") { return "还缺 " + formatAmount(primaryGap.amount) + " " + resourceName + "，可通过主动行动取得"; }
        if (pressure.sourceType === "discrete") { return "还缺 " + formatAmount(primaryGap.amount) + " " + resourceName + "，需通过已开放的制作、贸易、掠夺或远征取得"; }
        // number 等待秒数：主缺口按当前持续流量估算。
        var waitSeconds = primaryGap.amount / pressure.perSecond;
        return "还缺 " + formatAmount(primaryGap.amount) + " " + resourceName + "，按当前流量约 " + formatDuration(waitSeconds);
    }

    /** @param {TechnologyDefinition} definition - 科技定义。 @param {number} progressionTier - 0-4 推进档。 @param {string} primaryIntentId - 首要意图。 @returns {string} 可验证推荐理由。 */
    function getReasonText(definition, progressionTier, primaryIntentId) {
        if (progressionTier >= 4) { return "关键里程碑，将开放新的系统或推进主阶段。"; }
        if (progressionTier >= 2) { return "完成后会直接开放新的能力或内容。"; }
        // Object.<string, string> 意图理由字典：防止 UI 自由拼接含糊推荐。
        var reasonByIntentId = { increase_output: "强化当前资源取得效率。", military_readiness: "补强军事发展路线。", faith_growth: "推进祭祀与信仰能力。", abyss_growth: "推进深渊探索能力。", raise_capacity: "缓解关键资源容量限制。", automation: "减少重复操作并提升自动化。", governance: "强化氏族治理能力。", general_growth: definition.recommendedFor || "推进当前研究路线。" };
        return reasonByIntentId[primaryIntentId] || definition.recommendedFor || "推进当前研究路线。";
    }

    /** @param {ResearchDecisionProfile} leftProfile - 左候选。 @param {ResearchDecisionProfile} rightProfile - 右候选。 @returns {number} 确定性排序比较结果。 */
    function compareDecisionProfiles(leftProfile, rightProfile) {
        return rightProfile.urgencyTier - leftProfile.urgencyTier || rightProfile.pressureMatchTier - leftProfile.pressureMatchTier || leftProfile.resourceConflictTier - rightProfile.resourceConflictTier || rightProfile.progressionTier - leftProfile.progressionTier || leftProfile.dependencyDistance - rightProfile.dependencyDistance || getWaitBand(leftProfile.waitSeconds) - getWaitBand(rightProfile.waitSeconds) || rightProfile.readinessRatio - leftProfile.readinessRatio || getLineOrder(leftProfile.definition.lineId) - getLineOrder(rightProfile.definition.lineId) || leftProfile.definition.tier - rightProfile.definition.tier || leftProfile.definition.layoutOrder - rightProfile.definition.layoutOrder;
    }

    /** @param {ResearchDecisionProfile[]} profiles - 已排序候选。 @param {number} limit - 最大正整数数量。 @returns {ResearchDecisionProfile[]} 优先覆盖不同意图和路线的候选。 */
    function selectDiverseProfiles(profiles, limit) {
        // ResearchDecisionProfile[] 选择结果：逐轮最大化未覆盖意图和路线。
        var selected = [];
        // Object.<string, boolean> 已覆盖意图字典。
        var coveredIntentIds = {};
        // Object.<string, boolean> 已覆盖路线字典。
        var coveredLineIds = {};
        while (selected.length < limit) {
            // ResearchDecisionProfile|null 最佳剩余候选：每轮重新评价多样性奖励。
            var bestProfile = null;
            profiles.forEach(function (profile) {
                if (selected.indexOf(profile) >= 0) { return; }
                if (!bestProfile || getDiversityTier(profile, coveredIntentIds, coveredLineIds) > getDiversityTier(bestProfile, coveredIntentIds, coveredLineIds) || (getDiversityTier(profile, coveredIntentIds, coveredLineIds) === getDiversityTier(bestProfile, coveredIntentIds, coveredLineIds) && compareDecisionProfiles(profile, bestProfile) < 0)) { bestProfile = profile; }
            });
            if (!bestProfile) { break; }
            selected.push(bestProfile);
            coveredIntentIds[bestProfile.primaryIntentId] = true;
            coveredLineIds[bestProfile.definition.lineId] = true;
        }
        return selected;
    }

    /** @param {ResearchDecisionProfile} profile - 候选档案。 @param {Object.<string, boolean>} coveredIntentIds - 已覆盖意图。 @param {Object.<string, boolean>} coveredLineIds - 已覆盖路线。 @returns {number} 0-2 多样性档位。 */
    function getDiversityTier(profile, coveredIntentIds, coveredLineIds) { return (coveredIntentIds[profile.primaryIntentId] ? 0 : 1) + (coveredLineIds[profile.definition.lineId] ? 0 : 1); }

    /**
     * 收集科技价格实际使用的全部资源 ID。
     *
     * @returns {ResourceId[]} 按首次出现在定义表中的顺序去重的资源 ID 数组。
     */
    function collectResearchPriceResourceIds() {
        // ResourceId[] 资源 ID 数组：保证非知识材料也能正确判断可达性。
        var resourceIds = [];

        game.definitions.TECHNOLOGY_DEFINITIONS.forEach(function (technologyDefinition) {
            technologyDefinition.price.forEach(function (priceEntry) {
                if (resourceIds.indexOf(priceEntry.resource) < 0) { resourceIds.push(priceEntry.resource); }
            });
        });
        return resourceIds;
    }

    /**
     * 判断资源当前已经开放的取得路径类型。
     *
     * @param {GameState} state - 当前游戏状态，只读。
     * @param {ResourceId} resourceId - 目标资源稳定 ID。
     * @param {number} perSecond - 当前净流量，单位资源/秒。
     * @returns {"continuous"|"manual"|"discrete"|"none"} 当前最可靠取得路径类型。
     */
    function getResourceSourceType(state, resourceId, perSecond) {
        if (perSecond > 0) { return "continuous"; }
        if (MANUAL_RESOURCE_IDS.indexOf(resourceId) >= 0) { return "manual"; }
        if (hasUnlockedCraftSource(state, resourceId) || hasUnlockedTradeSource(state, resourceId) || hasUnlockedRaidSource(state, resourceId) || hasUnlockedExpeditionSource(state, resourceId)) { return "discrete"; }
        return "none";
    }

    /** @param {GameState} state - 当前游戏状态，只读。 @param {ResourceId} resourceId - 目标资源 ID。 @returns {boolean} 是否存在已解锁制作来源。 */
    function hasUnlockedCraftSource(state, resourceId) {
        // Object[] 配方定义数组：兼容当前工坊定义命名。
        var recipeDefinitions = game.definitions.CRAFT_RECIPE_DEFINITIONS || game.definitions.RECIPE_DEFINITIONS || [];
        return recipeDefinitions.some(function (recipeDefinition) { return recipeDefinition.outputResource === resourceId && Boolean(state.craftsUnlockedById && state.craftsUnlockedById[recipeDefinition.id]); });
    }

    /** @param {GameState} state - 当前游戏状态，只读。 @param {ResourceId} resourceId - 目标资源 ID。 @returns {boolean} 是否存在已开放外交交易来源。 */
    function hasUnlockedTradeSource(state, resourceId) {
        // boolean 外交是否开放：同时兼容当前 tabsUnlockedById 与旧 tabsById 形状。
        var isDiplomacyUnlocked = Boolean((state.tabsUnlockedById && state.tabsUnlockedById.diplomacy) || (state.tabsById && state.tabsById.diplomacy && state.tabsById.diplomacy.isUnlocked));
        // Object[] 势力定义数组：rewardResource 是一次贸易的产出资源。
        var factionDefinitions = game.definitions.FACTION_DEFINITIONS || [];
        return isDiplomacyUnlocked && factionDefinitions.some(function (factionDefinition) { return factionDefinition.rewardResource === resourceId; });
    }

    /** @param {GameState} state - 当前游戏状态，只读。 @param {ResourceId} resourceId - 目标资源 ID。 @returns {boolean} 是否存在已开放掠夺来源。 */
    function hasUnlockedRaidSource(state, resourceId) {
        // boolean 掠夺入口是否开放：至少有外交入口和掠夺定义时才视为潜在离散来源。
        var isRaidUnlocked = Boolean((state.tabsUnlockedById && state.tabsUnlockedById.diplomacy) || (state.tabsById && state.tabsById.diplomacy && state.tabsById.diplomacy.isUnlocked));
        // Object[] 掠夺目标定义数组：rewards 字典包含可能获得的资源。
        var raidTargetDefinitions = game.definitions.RAID_TARGET_DEFINITIONS || [];
        return isRaidUnlocked && raidTargetDefinitions.some(function (raidDefinition) { return raidDefinition.rewards && Number(raidDefinition.rewards[resourceId]) > 0; });
    }

    /** @param {GameState} state - 当前游戏状态，只读。 @param {ResourceId} resourceId - 目标资源 ID。 @returns {boolean} 是否存在已开放远征来源。 */
    function hasUnlockedExpeditionSource(state, resourceId) {
        // boolean 深渊入口是否开放：兼容当前与旧标签状态形状。
        var isAbyssUnlocked = Boolean((state.tabsUnlockedById && state.tabsUnlockedById.abyss) || (state.tabsById && state.tabsById.abyss && state.tabsById.abyss.isUnlocked));
        // Object[] 远征定义数组：不同版本可能使用 expedition 或 abyss expedition 命名。
        var expeditionDefinitions = game.definitions.EXPEDITION_ROUTE_DEFINITIONS || game.definitions.EXPEDITION_DEFINITIONS || game.definitions.ABYSS_EXPEDITION_DEFINITIONS || [];
        return isAbyssUnlocked && expeditionDefinitions.some(function (expeditionDefinition) { return expeditionDefinition.rewards && Number(expeditionDefinition.rewards[resourceId]) > 0; });
    }

    /**
     * 根据实时经营状态产生需要研究帮助的受控意图。
     *
     * @param {GameState} state - 当前游戏状态，只读。
     * @returns {Object.<string, number>} key 为意图 ID，value 为 1 警告或 2 严重。
     */
    function getActivePressureIntentIds(state) {
        // Object.<string, number> 活跃压力意图字典：只记录当前可从权威状态证明的压力。
        var pressureTierByIntentId = {};
        // ResourceState|null 菌菇状态：用于判断短期食物耗尽风险。
        var fungusState = state.resourcesById.fungus || null;

        if (fungusState && fungusState.perSecond < 0) {
            // number 食物耗尽秒数：单位秒，库存为零时为零。
            var foodSecondsRemaining = fungusState.value / Math.abs(fungusState.perSecond);
            pressureTierByIntentId.survive_food = foodSecondsRemaining <= 60 ? 2 : (foodSecondsRemaining <= 300 ? 1 : 0);
        }
        if (game.population && state.goblins) {
            // number 存活人口：单位个体整数。
            var alivePopulation = game.population.countAliveGoblins(state);
            // number 住房容量：单位床位整数。
            var housingMax = game.population.calculateHousingMax(state);
            if (alivePopulation >= housingMax) { pressureTierByIntentId.survive_food = Math.max(pressureTierByIntentId.survive_food || 0, 2); }
            // LaborBreakdown 劳力摘要：存在生产过载时治理/劳力科技成为严重意图。
            var laborBreakdown = game.population.analyzeLaborBreakdown(state);
            if (laborBreakdown.isProductionLaborOverloaded) { pressureTierByIntentId.governance = 2; }
            else if (laborBreakdown.populationLabor > 0 && laborBreakdown.adjustedBuildingUsageTotal / laborBreakdown.populationLabor >= 0.85) { pressureTierByIntentId.governance = 1; }
        }
        return pressureTierByIntentId;
    }

    /** @param {string[]} intentIds - 科技意图数组。 @param {Object.<string, number>} pressureTierByIntentId - 活跃压力字典。 @returns {number} 0-2 最大匹配压力档。 */
    function getPressureMatchTier(intentIds, pressureTierByIntentId) {
        // number 最大匹配档位：科技覆盖多个意图时取最严重问题。
        var maximumTier = 0;
        intentIds.forEach(function (intentId) { maximumTier = Math.max(maximumTier, pressureTierByIntentId ? pressureTierByIntentId[intentId] || 0 : 0); });
        return maximumTier;
    }

    /**
     * 对普通成员变化应用三秒防抖，重大结构事件和失效成员立即更新。
     *
     * @param {ResearchQueueSnapshot} candidateSnapshot - 本轮即时快照。
     * @param {ResearchDecisionProfile[]} profiles - 当前全部正式档案。
     * @param {GameState} state - 当前游戏状态，只读。
     * @param {ResearchDecisionRuntime} decisionRuntime - 界面运行态，会被直接修改但不入存档。
     * @param {number} nowTimestamp - 当前 Unix 毫秒时间戳。
     * @returns {ResearchQueueSnapshot} 稳定成员但数值说明保持最新的快照。
     */
    function stabilizeQueueSnapshot(candidateSnapshot, profiles, state, decisionRuntime, nowTimestamp) {
        // string 结构签名：研究完成/揭示、容量和来源类型变化都必须立即换队。
        var structureSignature = createStructureSignature(state, profiles);

        if (!decisionRuntime.stableSnapshot || decisionRuntime.structureSignature !== structureSignature || doesStableSnapshotContainInvalidMember(decisionRuntime.stableSnapshot, profiles)) {
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
            decisionRuntime.stableSnapshot = candidateSnapshot;
            return candidateSnapshot;
        }
        if (!decisionRuntime.pendingSnapshot || decisionRuntime.pendingSnapshot.signature !== candidateSnapshot.signature) {
            decisionRuntime.pendingSnapshot = candidateSnapshot;
            decisionRuntime.pendingSinceTimestamp = nowTimestamp;
            return refreshStableSnapshotDetails(decisionRuntime.stableSnapshot, profiles, candidateSnapshot.knowledgePressure);
        }
        if (nowTimestamp - decisionRuntime.pendingSinceTimestamp >= MEMBERSHIP_STABILITY_MILLISECONDS || isCandidateMateriallyBetter(candidateSnapshot, decisionRuntime.stableSnapshot)) {
            decisionRuntime.stableSnapshot = candidateSnapshot;
            decisionRuntime.pendingSnapshot = null;
            decisionRuntime.pendingSinceTimestamp = 0;
            return candidateSnapshot;
        }
        return refreshStableSnapshotDetails(decisionRuntime.stableSnapshot, profiles, candidateSnapshot.knowledgePressure);
    }

    /** @param {GameState} state - 当前游戏状态。 @param {ResearchDecisionProfile[]} profiles - 正式科技档案。 @returns {string} 重大结构事件签名。 */
    function createStructureSignature(state, profiles) {
        // string[] 结构字段数组：按稳定科技 ID 排列，普通优先级换位不能伪装成结构事件。
        var structureParts = profiles.map(function (profile) { return profile.technologyId + ":" + profile.visibility + ":" + profile.status + ":" + Number(profile.hasCapacityBlock) + ":" + Number(profile.isReachable); });
        structureParts.sort();
        return structureParts.join("|");
    }

    /** @param {ResearchQueueSnapshot} stableSnapshot - 当前稳定快照。 @param {ResearchDecisionProfile[]} profiles - 当前正式档案。 @returns {boolean} 是否有成员完成、隐藏或已改变基本分段资格。 */
    function doesStableSnapshotContainInvalidMember(stableSnapshot, profiles) {
        // Object.<TechnologyId, ResearchDecisionProfile> 当前档案索引。
        var profilesById = {};
        profiles.forEach(function (profile) { profilesById[profile.technologyId] = profile; });
        return stableSnapshot.target.concat(stableSnapshot.available, stableSnapshot.attention).some(function (oldProfile) {
            // ResearchDecisionProfile|null 当前同 ID 档案：缺失表示完成或隐藏。
            var currentProfile = profilesById[oldProfile.technologyId] || null;
            return !currentProfile || currentProfile.status !== oldProfile.status;
        });
    }

    /** @param {ResearchQueueSnapshot} stableSnapshot - 旧稳定成员。 @param {ResearchDecisionProfile[]} profiles - 当前档案。 @param {KnowledgePressureSnapshot} knowledgePressure - 最新资源压力。 @returns {ResearchQueueSnapshot} 保留成员并刷新说明的快照。 */
    function refreshStableSnapshotDetails(stableSnapshot, profiles, knowledgePressure) {
        // Object.<TechnologyId, ResearchDecisionProfile> 当前档案索引：替换旧成员的动态缺口与等待说明。
        var profilesById = {};
        profiles.forEach(function (profile) { profilesById[profile.technologyId] = profile; });
        // Function 区段刷新函数：保持 ID 顺序并读取最新档案。
        var refreshSection = function (sectionProfiles) { return sectionProfiles.map(function (profile) { return profilesById[profile.technologyId] || profile; }); };
        return { target: refreshSection(stableSnapshot.target), available: refreshSection(stableSnapshot.available), attention: refreshSection(stableSnapshot.attention), strategicTargetId: stableSnapshot.strategicTargetId || null, knowledgePressure: knowledgePressure, signature: stableSnapshot.signature };
    }

    /** @param {ResearchQueueSnapshot} candidateSnapshot - 新候选快照。 @param {ResearchQueueSnapshot} stableSnapshot - 旧稳定快照。 @returns {boolean} 新首项是否高出至少一个紧迫档。 */
    function isCandidateMateriallyBetter(candidateSnapshot, stableSnapshot) {
        // ResearchDecisionProfile|null 新首项：按区段行动性取可研究、目标、先处理。
        var candidateTop = candidateSnapshot.available[0] || candidateSnapshot.target[0] || candidateSnapshot.attention[0] || null;
        // ResearchDecisionProfile|null 旧首项：与新首项同口径比较。
        var stableTop = stableSnapshot.available[0] || stableSnapshot.target[0] || stableSnapshot.attention[0] || null;
        return Boolean(candidateTop && (!stableTop || candidateTop.urgencyTier > stableTop.urgencyTier));
    }

    /** @param {number} waitSeconds - 等待秒数或 Infinity。 @returns {number} now、short、medium、long、unreachable 对应 0-4。 */
    function getWaitBand(waitSeconds) { if (waitSeconds <= 0) { return 0; } if (waitSeconds <= 60) { return 1; } if (waitSeconds <= 300) { return 2; } return Number.isFinite(waitSeconds) ? 3 : 4; }
    /** @param {string} lineId - 研究路线 ID。 @returns {number} 稳定路线顺序。 */
    function getLineOrder(lineId) { return Object.prototype.hasOwnProperty.call(LINE_ORDER_BY_ID, lineId) ? LINE_ORDER_BY_ID[lineId] : 99; }
    /** @param {number} amount - 非负资源量。 @returns {string} 最多一位小数文本。 */
    function formatAmount(amount) { return amount >= 10 ? String(Math.ceil(amount)) : String(Math.round(amount * 10) / 10); }
    /** @param {number} seconds - 非负秒数。 @returns {string} 分秒等待文本。 */
    function formatDuration(seconds) { var roundedSeconds = Math.max(0, Math.ceil(seconds)); return String(Math.floor(roundedSeconds / 60)).padStart(2, "0") + ":" + String(roundedSeconds % 60).padStart(2, "0"); }
    /** @param {ResearchDecisionProfile[]} target - 目标区。 @param {ResearchDecisionProfile[]} available - 可研究区。 @param {ResearchDecisionProfile[]} attention - 先处理区。 @returns {string} 稳定成员签名。 */
    function createQueueSignature(target, available, attention) { return "t:" + target.map(function (profile) { return profile.technologyId; }).join(",") + "|a:" + available.map(function (profile) { return profile.technologyId; }).join(",") + "|x:" + attention.map(function (profile) { return profile.technologyId; }).join(","); }

    // Object 研究决策命名空间：供 UI 与自动测试读取纯派生结果。
    game.researchDecisions = {
        getResearchQueueSnapshot: getResearchQueueSnapshot,
        analyzeKnowledgePressure: analyzeKnowledgePressure,
        createDecisionProfile: createDecisionProfile
    };
})(window.GoblinEmpire);
