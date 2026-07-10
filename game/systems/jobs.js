/* 职业系统：负责具体哥布林分配、职业产出和技能经验。 */
/**
 * 初始化职业系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 jobs 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 职业经验基础增长：单位为经验/秒。
    var JOB_XP_PER_SECOND = 0.25;

    /**
     * 取得职业定义。
     *
     * @param {JobId} jobId - 职业稳定 ID。
     * @returns {JobDefinition|null} 职业定义；未找到时返回 null。
     */
    function getJobDefinition(jobId) {
        // number 循环索引：遍历职业定义数组的整数下标。
        for (var jobIndex = 0; jobIndex < game.definitions.JOB_DEFINITIONS.length; jobIndex += 1) {
            // JobDefinition 当前职业定义：用于匹配职业 ID。
            var jobDefinition = game.definitions.JOB_DEFINITIONS[jobIndex];

            if (jobDefinition.id === jobId) {
                return jobDefinition;
            }
        }

        return null;
    }

    /**
     * 判断职业是否已解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {JobId} jobId - 职业稳定 ID。
     * @returns {boolean} 是否已解锁；true 表示可显示和分配。
     */
    function isJobUnlocked(state, jobId) {
        return Boolean(state.jobsUnlockedById[jobId]);
    }

    /**
     * 统计某职业人数。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {JobId} jobId - 职业稳定 ID。
     * @returns {number} 当前职业人数，非负整数。
     */
    function countAssigned(state, jobId) {
        // number 职业人数：从存活哥布林 jobId 派生。
        var assignedCount = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于统计职业。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && goblin.jobId === jobId) {
                assignedCount += 1;
            }
        }

        return assignedCount;
    }

    /**
     * 给一个空闲哥布林分配职业。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {JobId} jobId - 职业稳定 ID。
     * @returns {boolean} 是否分配成功；true 表示某个哥布林 jobId 已改变。
     */
    function assignWorker(state, jobId) {
        if (state.isPaused || !isJobUnlocked(state, jobId)) {
            return false;
        }

        // JobDefinition|null 职业定义：用于选择最适合的空闲哥布林。
        var jobDefinition = getJobDefinition(jobId);

        // Goblin|null 最佳哥布林：当前可分配候选中评分最高者。
        var bestGoblin = null;

        // number 最佳评分：用于比较候选哥布林。
        var bestScore = -Infinity;

        if (!jobDefinition) {
            return false;
        }

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于判断是否可分配。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive || goblin.jobId) {
                continue;
            }

            // number 当前评分：综合技能和属性权重。
            var candidateScore = calculateJobFitScore(goblin, jobDefinition);

            if (candidateScore > bestScore) {
                bestScore = candidateScore;
                bestGoblin = goblin;
            }
        }

        if (!bestGoblin) {
            return false;
        }

        bestGoblin.jobId = jobId;
        return true;
    }

    /**
     * 从职业撤下一个未固定哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {JobId} jobId - 职业稳定 ID。
     * @returns {boolean} 是否撤下成功；true 表示某个哥布林 jobId 已清空。
     */
    function unassignWorker(state, jobId) {
        if (state.isPaused) {
            return false;
        }

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = state.goblins.length - 1; goblinIndex >= 0; goblinIndex -= 1) {
            // Goblin 当前哥布林对象：用于寻找可撤下对象。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && goblin.jobId === jobId && !goblin.isPinned) {
                goblin.jobId = undefined;
                return true;
            }
        }

        return false;
    }

    /**
     * 撤下某职业全部未固定哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {JobId} jobId - 职业稳定 ID。
     * @returns {number} 撤下人数，非负整数。
     */
    function unassignAll(state, jobId) {
        // number 撤下人数：统计本次清空 jobId 的哥布林数量。
        var removedCount = 0;

        while (unassignWorker(state, jobId)) {
            removedCount += 1;
        }

        return removedCount;
    }

    /**
     * 尽量分配所有空闲哥布林到某职业。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {JobId} jobId - 职业稳定 ID。
     * @returns {number} 新增分配人数，非负整数。
     */
    function assignMax(state, jobId) {
        // number 新增人数：统计本次成功写入 jobId 的哥布林数量。
        var addedCount = 0;

        while (assignWorker(state, jobId)) {
            addedCount += 1;
        }

        return addedCount;
    }

    /**
     * 应用职业预设。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {"survival"|"mining"|"research"|"war"|"ritual"} presetId - 预设 ID。
     * @returns {void} 无返回值。
     */
    function applyJobPreset(state, presetId) {
        if (state.isPaused) {
            return;
        }

        // JobId[] 预设职业 ID 数组：按当前预设优先级分配。
        var presetJobIds = getPresetJobIds(presetId);

        if (presetJobIds.length === 0) {
            return;
        }

        clearUnpinnedJobs(state);

        // number 分配循环索引：遍历未固定存活哥布林的整数计数。
        var assignmentIndex = 0;

        while (assignBestPresetWorker(state, presetJobIds, assignmentIndex)) {
            assignmentIndex += 1;
        }
    }

    /**
     * 预览职业预设分配结果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {"survival"|"mining"|"research"|"war"|"ritual"} presetId - 预设 ID。
     * @returns {Object.<string, number>} 预览结果字典；key 为职业 ID 或 pinned/idle，value 为人数。
     */
    function previewJobPreset(state, presetId) {
        // Object.<string, number> 预览结果字典：记录各职业预计人数。
        var previewCounts = {};

        // JobId[] 预设职业 ID 数组：按当前预设优先级分配。
        var presetJobIds = getPresetJobIds(presetId);

        // number 可分配索引：用于轮转预设职业。
        var assignableIndex = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于统计固定和预计分配。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive) {
                continue;
            }

            if (goblin.isPinned) {
                previewCounts.pinned = (previewCounts.pinned || 0) + 1;
                continue;
            }

            // JobId|null 目标职业 ID：按轮转结果预估。
            var targetJobId = getPresetJobAtIndex(state, presetJobIds, assignableIndex);

            if (targetJobId) {
                previewCounts[targetJobId] = (previewCounts[targetJobId] || 0) + 1;
            } else {
                previewCounts.idle = (previewCounts.idle || 0) + 1;
            }

            assignableIndex += 1;
        }

        return previewCounts;
    }

    /**
     * 分配最适合当前轮转职业的哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，会给一个哥布林写入 jobId。
     * @param {JobId[]} presetJobIds - 预设职业 ID 数组。
     * @param {number} assignmentIndex - 分配序号，非负整数。
     * @returns {boolean} 是否分配成功；true 表示有一个哥布林被写入职业。
     */
    function assignBestPresetWorker(state, presetJobIds, assignmentIndex) {
        // JobId|null 目标职业 ID：当前分配轮次对应职业。
        var targetJobId = getPresetJobAtIndex(state, presetJobIds, assignmentIndex);

        if (!targetJobId) {
            return false;
        }

        // JobDefinition|null 目标职业定义：用于计算适配度。
        var jobDefinition = getJobDefinition(targetJobId);

        // Goblin|null 最佳哥布林：从空闲未固定个体中选择。
        var bestGoblin = null;

        // number 最佳分数：用于比较属性和技能适配。
        var bestScore = -Infinity;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：候选预设分配对象。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive || goblin.isPinned || goblin.jobId) {
                continue;
            }

            // number 适配分数：越高越优先分配到目标职业。
            var score = jobDefinition ? calculateJobFitScore(goblin, jobDefinition) : 0;

            if (score > bestScore) {
                bestGoblin = goblin;
                bestScore = score;
            }
        }

        if (!bestGoblin) {
            return false;
        }

        bestGoblin.jobId = targetJobId;
        return true;
    }

    /**
     * 按预设和序号取得目标职业。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {JobId[]} presetJobIds - 预设职业 ID 数组。
     * @param {number} assignmentIndex - 分配序号，非负整数。
     * @returns {JobId|null} 目标职业 ID；无可用职业时返回 null。
     */
    function getPresetJobAtIndex(state, presetJobIds, assignmentIndex) {
        // JobId[] 可用职业 ID 数组：只包含已解锁职业。
        var unlockedJobIds = [];

        // number 循环索引：遍历预设职业 ID 数组的整数下标。
        for (var jobIndex = 0; jobIndex < presetJobIds.length; jobIndex += 1) {
            // JobId 当前职业 ID：用于检查解锁状态。
            var jobId = presetJobIds[jobIndex];

            if (isJobUnlocked(state, jobId)) {
                unlockedJobIds.push(jobId);
            }
        }

        if (unlockedJobIds.length === 0) {
            return null;
        }

        return unlockedJobIds[assignmentIndex % unlockedJobIds.length];
    }

    /**
     * 取得预设职业列表。
     *
     * @param {"survival"|"mining"|"research"|"war"|"ritual"} presetId - 预设 ID。
     * @returns {JobId[]} 职业 ID 数组。
     */
    function getPresetJobIds(presetId) {
        if (presetId === "mining") {
            return ["miner", "hauler", "smelter"];
        }

        if (presetId === "research") {
            return ["graffiti_apprentice", "artisan", "accountant"];
        }

        if (presetId === "war") {
            return ["raider", "overseer"];
        }

        if (presetId === "ritual") {
            return ["witch_doctor", "overseer", "accountant"];
        }

        return ["forager", "woodcutter", "hauler"];
    }

    /**
     * 计算哥布林对职业的适配分。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @param {JobDefinition} jobDefinition - 职业定义对象。
     * @returns {number} 适配分数，非负浮点数。
     */
    function calculateJobFitScore(goblin, jobDefinition) {
        return calculateAttributeModifier(goblin, jobDefinition.attributeWeights) + calculateSkillModifier(goblin, jobDefinition.skillId);
    }

    /**
     * 清空所有未固定哥布林职业。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @returns {void} 无返回值。
     */
    function clearUnpinnedJobs(state) {
        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于清空未固定职业。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && !goblin.isPinned) {
                goblin.jobId = undefined;
            }
        }
    }

    /**
     * 推进职业产出和技能经验。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function updateJobs(state, deltaSeconds) {
        resetResourceRates(state);

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于计算职业产出。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive || !goblin.jobId) {
                continue;
            }

            // JobDefinition|null 当前职业定义：用于读取基础产出和技能。
            var jobDefinition = getJobDefinition(goblin.jobId);

            if (!jobDefinition) {
                continue;
            }

            applyJobOutput(state, goblin, jobDefinition, deltaSeconds);
            gainJobSkillXp(goblin, jobDefinition, deltaSeconds);
        }
    }

    /**
     * 清空资源每秒变化统计。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @returns {void} 无返回值。
     */
    function resetResourceRates(state) {
        // string[] 资源 ID 数组：用于遍历资源状态字典。
        var resourceIds = Object.keys(state.resourcesById);

        // number 循环索引：遍历资源 ID 数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // string 当前资源 ID：用于清空每秒变化值。
            var resourceId = resourceIds[resourceIndex];

            state.resourcesById[resourceId].perSecond = 0;
        }
    }

    /**
     * 应用单个哥布林职业产出。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {Goblin} goblin - 当前工作哥布林对象，会读取属性和技能。
     * @param {JobDefinition} jobDefinition - 当前职业定义对象。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function applyJobOutput(state, goblin, jobDefinition, deltaSeconds) {
        // number 综合倍率：包含属性、技能、伤病、建筑和服从修正。
        var outputModifier = calculateJobOutputModifier(state, goblin, jobDefinition);

        // string[] 产出资源 ID 数组：用于遍历职业基础产出。
        var outputResourceIds = Object.keys(jobDefinition.baseOutput);

        // number 循环索引：遍历产出资源 ID 数组的整数下标。
        for (var outputIndex = 0; outputIndex < outputResourceIds.length; outputIndex += 1) {
            // ResourceId 当前产出资源 ID：用于增加资源和每秒统计。
            var resourceId = outputResourceIds[outputIndex];

            // number 每 tick 基础产出：来自职业定义。
            var basePerTick = jobDefinition.baseOutput[resourceId];

            // number 每秒产出：按默认 tick 频率换算并应用倍率。
            var perSecond = basePerTick * game.definitions.TICKS_PER_SECOND * outputModifier;

            game.resources.addResource(state, resourceId, perSecond * deltaSeconds);
            state.resourcesById[resourceId].perSecond += perSecond;
        }
    }

    /**
     * 计算单个哥布林职业产出综合倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin} goblin - 当前工作哥布林对象，会读取属性、技能和伤病。
     * @param {JobDefinition} jobDefinition - 当前职业定义对象。
     * @returns {number} 职业产出综合倍率，非负浮点数。
     */
    function calculateJobOutputModifier(state, goblin, jobDefinition) {
        return calculateAttributeModifier(goblin, jobDefinition) * calculateSkillModifier(goblin, jobDefinition.skillId) * calculateWoundModifier(goblin) * calculateBuildingModifier(state, jobDefinition) * calculateTechnologyModifier(state, jobDefinition) * calculateObedienceModifier(state);
    }

    /**
     * 计算职业适配评分。
     *
     * @param {Goblin} goblin - 候选哥布林对象，不会被修改。
     * @param {JobDefinition} jobDefinition - 职业定义对象。
     * @returns {number} 适配评分，数值越高越优先分配。
     */
    function calculateJobFitScore(goblin, jobDefinition) {
        return calculateWeightedAttribute(goblin, jobDefinition) + getSkillXp(goblin, jobDefinition.skillId) / 100;
    }

    /**
     * 计算属性修正。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @param {JobDefinition} jobDefinition - 职业定义对象。
     * @returns {number} 属性产出倍率，范围为 0.75-1.25。
     */
    function calculateAttributeModifier(goblin, jobDefinition) {
        // number 加权属性：按职业权重合成的属性值。
        var weightedAttribute = calculateWeightedAttribute(goblin, jobDefinition);

        // 属性修正保持温和，避免早期单个高属性个体破坏增量曲线。
        return Math.min(1.25, Math.max(0.75, 1 + (weightedAttribute - 5) / 40));
    }

    /**
     * 计算职业加权属性值。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @param {JobDefinition} jobDefinition - 职业定义对象。
     * @returns {number} 加权属性值，通常在 1-10 区间。
     */
    function calculateWeightedAttribute(goblin, jobDefinition) {
        // string[] 属性 ID 数组：用于遍历职业权重。
        var attributeIds = Object.keys(jobDefinition.attributeWeights);

        // number 加权总和：属性值乘以权重后的累加。
        var weightedTotal = 0;

        // number 权重总和：用于归一化属性值。
        var weightTotal = 0;

        // number 循环索引：遍历属性 ID 数组的整数下标。
        for (var attributeIndex = 0; attributeIndex < attributeIds.length; attributeIndex += 1) {
            // string 当前属性 ID：用于读取权重和哥布林属性。
            var attributeId = attributeIds[attributeIndex];

            // number 当前权重：职业定义中的属性贡献比例。
            var weight = jobDefinition.attributeWeights[attributeId];

            weightedTotal += (goblin.attributes[attributeId] || 0) * weight;
            weightTotal += weight;
        }

        return weightTotal > 0 ? weightedTotal / weightTotal : 5;
    }

    /**
     * 读取技能经验。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @param {string} skillId - 技能稳定 ID。
     * @returns {number} 技能经验，非负数；缺省按 0 处理。
     */
    function getSkillXp(goblin, skillId) {
        return goblin.skills[skillId] || 0;
    }

    /**
     * 计算技能产出修正。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @param {string} skillId - 技能稳定 ID。
     * @returns {number} 技能产出倍率，非负浮点数。
     */
    function calculateSkillModifier(goblin, skillId) {
        return 1 + calculateSkillLevelBonus(getSkillXp(goblin, skillId));
    }

    /**
     * 计算技能等级加成。
     *
     * @param {number} skillXp - 技能经验，非负数。
     * @returns {number} 技能产出加成比例，非负小数。
     */
    function calculateSkillLevelBonus(skillXp) {
        if (skillXp >= 5000) {
            return 0.125;
        }

        if (skillXp >= 2500) {
            return 0.075;
        }

        if (skillXp >= 1200) {
            return 0.045;
        }

        if (skillXp >= 500) {
            return 0.025;
        }

        if (skillXp >= 100) {
            return 0.0125;
        }

        return 0;
    }

    /**
     * 计算伤病修正。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @returns {number} 伤病产出倍率，范围为 0.5-1。
     */
    function calculateWoundModifier(goblin) {
        return Math.max(0.5, 1 - goblin.wounds.length * 0.1);
    }

    /**
     * 计算建筑修正。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {JobDefinition} jobDefinition - 当前职业定义对象。
     * @returns {number} 建筑产出倍率，非负浮点数。
     */
    function calculateBuildingModifier(state, jobDefinition) {
        // number 加成比例：由相关建筑效果累加得到。
        var ratioBonus = 0;

        // Object.<string, number> 政策效果字典：读取职业产出修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 祖灵升级效果字典：读取本局祭祀倍率。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 契约效果字典：读取深渊契约职业产出修正。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        if (jobDefinition.baseOutput.fungus) {
            ratioBonus += getOwnedEffectTotal(state, "fungusOutputRatio");
            ratioBonus += state.statistics.fungusBloomSeconds > 0 ? 0.5 : 0;
        }

        if (jobDefinition.baseOutput.crudeKnowledge) {
            ratioBonus += getOwnedEffectTotal(state, "crudeKnowledgeOutputRatio");
            ratioBonus += state.statistics.crudeKnowledgeOutputRatio || 0;
            ratioBonus += ritualEffects.crudeKnowledgeOutputRatio || 0;
        }

        if (jobDefinition.baseOutput.rubble || jobDefinition.baseOutput.coalSlag || jobDefinition.baseOutput.ironOre) {
            ratioBonus += getOwnedEffectTotal(state, "rubbleOutputRatio");
            ratioBonus += state.statistics.miningToolRatio || 0;
            ratioBonus += policyEffects.miningOutputRatio || 0;
        }

        if (jobDefinition.baseOutput.rottenWood) {
            ratioBonus += state.statistics.woodcuttingToolRatio || 0;
        }

        if (jobDefinition.baseOutput.militaryPower) {
            ratioBonus += getOwnedEffectTotal(state, "militaryPowerOutputRatio");
        }

        if (jobDefinition.baseOutput.obedience) {
            ratioBonus += policyEffects.obedienceOutputRatio || 0;
            ratioBonus += ritualEffects.obedienceOutputRatio || 0;
        }

        if (jobDefinition.baseOutput.ancestralEcho) {
            ratioBonus += policyEffects.ancestralEchoOutputRatio || 0;
            ratioBonus += ritualEffects.ancestralEchoOutputRatio || 0;
        }

        if (jobDefinition.baseOutput.manaCrystal) {
            ratioBonus += pactEffects.manaCrystalOutputRatio || 0;
        }

        return 1 + ratioBonus;
    }

    /**
     * 计算科技修正。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {JobDefinition} jobDefinition - 当前职业定义对象。
     * @returns {number} 科技产出倍率，当前无相关科技时为 1。
     */
    function calculateTechnologyModifier(state, jobDefinition) {
        // number 科技加成比例：研究系统接入后按已研究科技累加。
        var technologyRatio = 0;

        if (state.technologiesById.foraging && state.technologiesById.foraging.isResearched && jobDefinition.baseOutput.fungus) {
            technologyRatio += 0.05;
        }

        return 1 + technologyRatio;
    }

    /**
     * 汇总已拥有建筑的某项效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} effectId - 建筑效果 ID。
     * @returns {number} 效果总值，有符号浮点数。
     */
    function getOwnedEffectTotal(state, effectId) {
        // number 效果总值：每个建筑效果乘以拥有数量后累加。
        var effectTotal = 0;

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取指定效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (buildingState && buildingDefinition.effects[effectId]) {
                effectTotal += buildingState.owned * buildingDefinition.effects[effectId];
            }
        }

        return effectTotal;
    }

    /**
     * 计算服从修正。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 服从产出倍率，范围为 0.75-1.25。
     */
    function calculateObedienceModifier(state) {
        // ResourceState 服从资源状态：用于读取当前服从值。
        var obedienceState = state.resourcesById.obedience;

        // number 当前服从值：缺省按 100 处理。
        var obedienceValue = obedienceState ? obedienceState.value : 100;

        return Math.min(1.25, Math.max(0.75, 1 + (obedienceValue - 100) / 400));
    }

    /**
     * 增加职业技能经验。
     *
     * @param {Goblin} goblin - 当前工作哥布林对象，会被直接修改。
     * @param {JobDefinition} jobDefinition - 当前职业定义对象。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function gainJobSkillXp(goblin, jobDefinition, deltaSeconds) {
        // number 新经验值：只在大于 0 时保存到技能字典。
        var nextSkillXp = getSkillXp(goblin, jobDefinition.skillId) + JOB_XP_PER_SECOND * deltaSeconds;

        if (nextSkillXp > 0) {
            goblin.skills[jobDefinition.skillId] = nextSkillXp;
        }
    }

    // Object 职业系统命名空间：提供职业分配、产出和经验函数。
    game.jobs = {
        getJobDefinition: getJobDefinition,
        isJobUnlocked: isJobUnlocked,
        countAssigned: countAssigned,
        assignWorker: assignWorker,
        unassignWorker: unassignWorker,
        unassignAll: unassignAll,
        assignMax: assignMax,
        applyJobPreset: applyJobPreset,
        previewJobPreset: previewJobPreset,
        updateJobs: updateJobs,
        calculateAttributeModifier: calculateAttributeModifier,
        calculateSkillModifier: calculateSkillModifier,
        calculateWoundModifier: calculateWoundModifier,
        calculateBuildingModifier: calculateBuildingModifier,
        calculateTechnologyModifier: calculateTechnologyModifier,
        calculateObedienceModifier: calculateObedienceModifier,
        calculateJobOutputModifier: calculateJobOutputModifier
    };
})(window.GoblinEmpire);
