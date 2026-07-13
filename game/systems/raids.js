/* 掠夺系统：负责按战斗职业队伍强度预览和结算掠夺行动。 */
/**
 * 初始化掠夺系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 raids 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // JobId[] 战斗职业 ID 列表：只有这些职业的存活哥布林可以被派出掠夺。
    var RAID_JOB_IDS = [
        "raider",
        "war_chief"
    ];

    // number 掠夺口粮单价：每派出 1 名战斗哥布林立即消耗的菌菇数量，单位为菌菇/哥布林。
    var RAID_FUNGUS_COST_PER_GOBLIN = 100;

    /**
     * 取得掠夺目标定义。
     *
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @returns {RaidTargetDefinition|null} 掠夺目标定义；未找到时返回 null。
     */
    function getRaidTargetDefinition(targetId) {
        // number 循环索引：遍历掠夺目标定义数组的整数下标。
        for (var targetIndex = 0; targetIndex < game.definitions.RAID_TARGET_DEFINITIONS.length; targetIndex += 1) {
            // RaidTargetDefinition 当前目标定义：用于匹配目标 ID。
            var targetDefinition = game.definitions.RAID_TARGET_DEFINITIONS[targetIndex];

            if (targetDefinition.id === targetId) {
                return targetDefinition;
            }
        }

        return null;
    }

    /**
     * 格式化掠夺目标可能带回的俘虏类型。
     *
     * @param {string[]} captiveTypeIds - 俘虏类型稳定 ID 数组。
     * @returns {string} 俘虏类型中文名列表；缺失定义时回退显示稳定 ID。
     */
    function formatCaptiveTypeNames(captiveTypeIds) {
        // string[] 俘虏类型中文名列表：用于外交页掠夺地点浮窗展示。
        var captiveTypeNames = [];

        // number 循环索引：遍历俘虏类型 ID 数组的整数下标。
        for (var captiveTypeIndex = 0; captiveTypeIndex < captiveTypeIds.length; captiveTypeIndex += 1) {
            // string 俘虏类型 ID：来自掠夺目标定义的稳定英文 ID。
            var captiveTypeId = captiveTypeIds[captiveTypeIndex];

            // CaptiveTypeDefinition|null 俘虏类型定义：用于把稳定 ID 转成中文显示名。
            var captiveTypeDefinition = game.captivesSystem.getCaptiveTypeDefinition(captiveTypeId);

            captiveTypeNames.push(captiveTypeDefinition ? captiveTypeDefinition.name : captiveTypeId);
        }

        return captiveTypeNames.join(" / ");
    }

    /**
     * 格式化掠夺目标可能带回的俘虏种族。
     *
     * @param {WeightedId[]} captiveRaceWeights - 俘虏种族权重数组；id 为种族稳定 ID。
     * @returns {string} 俘虏种族中文名列表；缺失定义时回退显示稳定 ID。
     */
    function formatCaptiveRaceNames(captiveRaceWeights) {
        if (!Array.isArray(captiveRaceWeights) || captiveRaceWeights.length <= 0) {
            return "未知种族";
        }

        // string[] 俘虏种族中文名列表：用于外交页掠夺地点浮窗展示。
        var captiveRaceNames = [];

        // number 循环索引：遍历俘虏种族权重数组的整数下标。
        for (var captiveRaceIndex = 0; captiveRaceIndex < captiveRaceWeights.length; captiveRaceIndex += 1) {
            // WeightedId 当前种族权重项：id 为种族稳定 ID。
            var captiveRaceWeight = captiveRaceWeights[captiveRaceIndex];

            // CaptiveRaceDefinition|null 俘虏种族定义：用于把稳定 ID 转成中文显示名。
            var captiveRaceDefinition = game.captivesSystem.getCaptiveRaceDefinition(captiveRaceWeight.id);

            captiveRaceNames.push(captiveRaceDefinition ? captiveRaceDefinition.name : captiveRaceWeight.id);
        }

        return captiveRaceNames.join(" / ");
    }

    /**
     * 预览掠夺收益和风险。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @param {number=} requestedRaiderCount - 玩家输入的派出人数，正整数；省略时按目标最低人数预览。
     * @returns {Object.<string, number|string|boolean|Price[]|Object>} 掠夺预览对象。
     */
    function previewRaid(state, targetId, requestedRaiderCount) {
        // RaidTargetDefinition|null 目标定义：用于读取强度、奖励和关系惩罚。
        var targetDefinition = getRaidTargetDefinition(targetId);

        if (!targetDefinition) {
            return {};
        }

        // Goblin[] 可派出哥布林列表：只包含当前战斗职业的存活个体。
        var availableRaiders = getAvailableRaiders(state);

        // number 请求派出人数：玩家输入为空时使用目标最低人数。
        var normalizedRequestedCount = normalizeRaiderCount(requestedRaiderCount, targetDefinition.minRaiders);

        // number 实际派出人数：不能超过当前可派出的战斗职业人数。
        var raiderCount = Math.min(normalizedRequestedCount, availableRaiders.length);

        // Goblin[] 掠夺队伍：按战斗强度从可派出列表中选前 N 个。
        var raidParty = availableRaiders.slice(0, raiderCount);

        // number 基础队伍强度：由具体哥布林属性、技能和职业计算。
        var baseTeamStrength = calculateRaidPartyBaseStrength(raidParty);

        // number 队伍强度倍率：由建筑、装备、政策、契约和领袖组成。
        var strengthRatio = calculateRaidStrengthRatio(state, raidParty);

        // number 最终队伍强度：用于和目标地点强度比较。
        var teamStrength = baseTeamStrength * (1 + strengthRatio);

        // number 强度优势：正数表示队伍压过目标，负数表示目标更强。
        var strengthAdvantage = teamStrength - targetDefinition.targetStrength;

        // Object.<string, number> 政策效果字典：读取战利品和关系代价修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 祖灵升级效果字典：读取战鼓回音等单局倍率。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 契约效果字典：战争契约提高掠夺收益。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 关系下降倍率：强队更容易制造恐慌，弱队失败也更容易激怒目标。
        var relationPenaltyRatio = Math.max(0.75, Math.min(1.5, 1 + strengthAdvantage / 250));

        // ResourceState|null 恶名资源状态：用于判断高级掠夺地点门槛。
        var infamyState = state.resourcesById.infamy || null;

        // number 当前恶名：未解锁或旧存档缺失时按 0 处理。
        var infamyAmount = infamyState ? infamyState.value : 0;

        // number 恶名门槛：越高级的地点要求越高恶名。
        var requiredInfamy = targetDefinition.requiredInfamy || 0;

        // Price[] 掠夺菌菇成本：按本次实际派出人数计算，执行前必须支付。
        var raidCost = getRaidCost(raiderCount);

        // boolean 菌菇是否足够：用于按钮置灰和执行前拦截。
        var canStartByCost = game.resources.canAfford(state, raidCost);

        return {
            availableRaiderCount: availableRaiders.length,
            requestedRaiderCount: normalizedRequestedCount,
            raiderCount: raiderCount,
            minRaiders: targetDefinition.minRaiders,
            canStartByRaiders: raiderCount >= targetDefinition.minRaiders,
            canStartByInfamy: infamyAmount >= requiredInfamy,
            canStartByCost: canStartByCost,
            canStart: raiderCount >= targetDefinition.minRaiders && infamyAmount >= requiredInfamy && canStartByCost,
            cost: raidCost,
            infamyAmount: infamyAmount,
            requiredInfamy: requiredInfamy,
            targetStrength: targetDefinition.targetStrength,
            teamStrength: teamStrength,
            strengthAdvantage: strengthAdvantage,
            strengthRatio: strengthRatio,
            rewards: targetDefinition.rewards,
            lootRatio: (policyEffects.raidLootRatio || 0) + (ritualEffects.raidLootRatio || 0) + (pactEffects.raidLootRatio || 0),
            infamyReward: targetDefinition.infamyReward || 0,
            infamyFailurePenalty: targetDefinition.infamyFailurePenalty || 0,
            goodwillPenalty: targetDefinition.goodwillPenalty || 0,
            distanceSeconds: targetDefinition.distanceSeconds || 0,
            successChance: Math.max(0.05, Math.min(0.95, 0.5 + strengthAdvantage / 100)),
            casualtyChance: Math.max(0.03, Math.min(0.55, 0.22 - strengthAdvantage / 280 - (state.statistics.raidCasualtyReductionRatio || 0))),
            deathChance: Math.max(0.01, Math.min(0.18, 0.05 - strengthAdvantage / 600)),
            relationPenalty: Math.max(0, Math.round(targetDefinition.relationPenalty * relationPenaltyRatio * (1 + (policyEffects.raidRelationPenaltyRatio || 0)))),
            retaliationChance: Math.min(0.75, Math.max(0, targetDefinition.relationPenalty / 100 + Math.max(0, -strengthAdvantage) / 200)),
            captiveTypes: formatCaptiveTypeNames(targetDefinition.captiveTypes),
            captiveRaces: formatCaptiveRaceNames(targetDefinition.captiveRaceWeights),
            warbeastCaptureChance: Number(targetDefinition.warbeastCaptureChance) || 0,
            warbeastSpecies: formatWarbeastSpeciesNames(targetDefinition.warbeastSpeciesWeights)
        };
    }

    /**
     * 格式化掠夺目标可能捕获的战兽物种。
     *
     * @param {WeightedId[]} warbeastSpeciesWeights - 战兽物种权重数组；id 为 WarbeastSpeciesDefinition.id。
     * @returns {string} 战兽物种中文名列表；无可捕获战兽时返回“无”。
     */
    function formatWarbeastSpeciesNames(warbeastSpeciesWeights) {
        if (!Array.isArray(warbeastSpeciesWeights) || warbeastSpeciesWeights.length <= 0 || !game.warbeastsSystem) {
            return "无";
        }

        // string[] 战兽物种中文名列表：用于外交页掠夺地点浮窗展示。
        var speciesNames = [];

        // number 循环索引：遍历战兽物种权重数组的整数下标。
        for (var speciesIndex = 0; speciesIndex < warbeastSpeciesWeights.length; speciesIndex += 1) {
            // WeightedId 当前物种权重项：id 为战兽物种稳定 ID。
            var speciesWeight = warbeastSpeciesWeights[speciesIndex];

            // WarbeastSpeciesDefinition|null 战兽物种定义：用于显示中文名。
            var speciesDefinition = game.warbeastsSystem.getSpeciesDefinition(speciesWeight.id);

            speciesNames.push(speciesDefinition ? speciesDefinition.name : speciesWeight.id);
        }

        return speciesNames.join(" / ");
    }

    /**
     * 发起掠夺行动，扣除口粮并等待队伍按距离返程后结算。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @param {number} requestedRaiderCount - 玩家输入的派出人数，正整数。
     * @returns {boolean} 是否发起成功；true 表示已扣成本并加入在途掠夺队。
     */
    function executeRaid(state, targetId, requestedRaiderCount) {
        if (state.isPaused) {
            return false;
        }

        // RaidTargetDefinition|null 目标定义：用于读取收益和关系惩罚。
        var targetDefinition = getRaidTargetDefinition(targetId);

        if (!targetDefinition) {
            return false;
        }

        // Object.<string, number|string|boolean|Price[]|Object> 掠夺预览：用于本次成功率和风险。
        var preview = previewRaid(state, targetId, requestedRaiderCount);

        if (!preview.canStartByRaiders) {
            game.simulation.addLog(state, "warning", "掠夺队伍不足：" + targetDefinition.name + " 至少需要 " + targetDefinition.minRaiders + " 名抢掠兵或战争头目。");
            return false;
        }

        if (!preview.canStartByInfamy) {
            game.simulation.addLog(state, "warning", "恶名不足：" + targetDefinition.name + " 需要恶名 " + preview.requiredInfamy + "。");
            return false;
        }

        if (!preview.canStartByCost) {
            game.simulation.addLog(state, "warning", "菌菇不足：" + targetDefinition.name + " 派出 " + preview.raiderCount + " 名战斗哥布林需要 " + (preview.raiderCount * RAID_FUNGUS_COST_PER_GOBLIN).toFixed(0) + " 菌菇。");
            return false;
        }

        if (!game.resources.spendResources(state, preview.cost)) {
            return false;
        }

        // Goblin[] 本次掠夺队伍：重新选择当前最强的指定人数，并在返程前锁定。
        var raidParty = getAvailableRaiders(state).slice(0, preview.raiderCount);

        // DiplomacyMissionState 掠夺行动状态：保存出战成员、返程倒计时和冻结结算数值。
        var mission = {
            id: game.diplomacy.createMissionId("raid", targetDefinition.id),
            modeId: "raid",
            locationId: targetDefinition.id,
            factionId: targetDefinition.factionId,
            raiderIds: getGoblinIds(raidParty),
            remainingSeconds: preview.distanceSeconds,
            totalSeconds: preview.distanceSeconds,
            resultSnapshot: {
                raiderCount: preview.raiderCount,
                teamStrength: preview.teamStrength,
                lootRatio: preview.lootRatio,
                infamyReward: preview.infamyReward,
                infamyFailurePenalty: preview.infamyFailurePenalty,
                goodwillPenalty: preview.goodwillPenalty,
                successChance: preview.successChance,
                casualtyChance: preview.casualtyChance,
                deathChance: preview.deathChance,
                relationPenalty: preview.relationPenalty,
                retaliationChance: preview.retaliationChance
            }
        };

        if (!Array.isArray(state.activeDiplomacyMissions)) {
            state.activeDiplomacyMissions = [];
        }

        state.activeDiplomacyMissions.push(mission);
        game.simulation.addLog(state, "important", "掠夺队出发：" + targetDefinition.name + "，派出 " + preview.raiderCount + " 名战斗哥布林，预计 " + Math.ceil(preview.distanceSeconds) + " 秒后返回。");
        return true;
    }

    /**
     * 结算完成返程的掠夺行动。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入资源、声名、关系和伤亡。
     * @param {DiplomacyMissionState} mission - 已完成返程的掠夺行动。
     * @returns {void} 无返回值。
     */
    function resolveRaidMission(state, mission) {
        // RaidTargetDefinition|null 目标定义：用于读取收益、关系和中文名称。
        var targetDefinition = getRaidTargetDefinition(mission.locationId);

        if (!targetDefinition) {
            game.simulation.addLog(state, "warning", "掠夺队返程失败：未知目标 " + mission.locationId + "。");
            return;
        }

        // Object.<string, number> 结算快照：使用出发时冻结的成功率和风险数值。
        var resultSnapshot = mission.resultSnapshot || {};

        // Object.<string, number|string|boolean|Price[]|Object> 掠夺预览兼容对象：复用现有成功/失败结算函数需要的字段。
        var preview = {
            raiderCount: Number(resultSnapshot.raiderCount) || mission.raiderIds.length,
            teamStrength: Number(resultSnapshot.teamStrength) || 0,
            lootRatio: Number(resultSnapshot.lootRatio) || 0,
            infamyReward: Number(resultSnapshot.infamyReward) || 0,
            infamyFailurePenalty: Number(resultSnapshot.infamyFailurePenalty) || 0,
            goodwillPenalty: Number(resultSnapshot.goodwillPenalty) || 0,
            casualtyChance: Number(resultSnapshot.casualtyChance) || 0,
            deathChance: Number(resultSnapshot.deathChance) || 0,
            relationPenalty: Number(resultSnapshot.relationPenalty) || 0,
            retaliationChance: Number(resultSnapshot.retaliationChance) || 0
        };

        // Goblin[] 掠夺队伍：按出发时锁定的 ID 找回当前仍存活的队员。
        var raidParty = getRaidPartyByIds(state, mission.raiderIds);

        // boolean 是否成功：按出发时冻结的成功率随机结算。
        var isSuccess = Math.random() < (Number(resultSnapshot.successChance) || 0);

        game.diplomacy.applyRaidPenalty(state, targetDefinition.factionId, preview.relationPenalty);
        applyRaidCasualties(state, targetDefinition, raidParty, isSuccess ? preview.casualtyChance * 0.35 : preview.casualtyChance, preview.deathChance);

        if (isSuccess) {
            applyRaidSuccess(state, targetDefinition, preview.lootRatio, preview);
        } else {
            applyRaidFailure(state, targetDefinition, preview);
        }
    }

    /**
     * 取得当前可派出的战斗职业哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Goblin[]} 可派出哥布林数组，按掠夺强度从高到低排序。
     */
    function getAvailableRaiders(state) {
        // Goblin[] 可派出哥布林列表：收集抢掠兵和战争头目。
        var availableRaiders = [];

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于检查是否属于战斗职业。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && RAID_JOB_IDS.indexOf(goblin.jobId) !== -1 && !isGoblinOnActiveRaidMission(state, goblin.id)) {
                availableRaiders.push(goblin);
            }
        }

        availableRaiders.sort(compareRaidersByStrength);
        return availableRaiders;
    }

    /**
     * 读取哥布林 ID 列表。
     *
     * @param {Goblin[]} goblins - 哥布林对象数组。
     * @returns {string[]} 哥布林 ID 数组。
     */
    function getGoblinIds(goblins) {
        // string[] 哥布林 ID 数组：用于在途掠夺行动锁定成员。
        var goblinIds = [];

        // number 循环索引：遍历哥布林对象数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于读取稳定 ID。
            var goblin = goblins[goblinIndex];

            goblinIds.push(goblin.id);
        }

        return goblinIds;
    }

    /**
     * 判断哥布林是否已经在返程中的掠夺队里。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} goblinId - 哥布林稳定 ID。
     * @returns {boolean} 是否正在掠夺返程；true 表示不能再次派出。
     */
    function isGoblinOnActiveRaidMission(state, goblinId) {
        if (!Array.isArray(state.activeDiplomacyMissions)) {
            return false;
        }

        // number 行动循环索引：遍历在途外交行动数组的整数下标。
        for (var missionIndex = 0; missionIndex < state.activeDiplomacyMissions.length; missionIndex += 1) {
            // DiplomacyMissionState 当前行动：用于检查掠夺队成员。
            var mission = state.activeDiplomacyMissions[missionIndex];

            if (mission.modeId === "raid" && Array.isArray(mission.raiderIds) && mission.raiderIds.indexOf(goblinId) !== -1) {
                return true;
            }
        }

        return false;
    }

    /**
     * 按 ID 找回掠夺队成员。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string[]} goblinIds - 出发时锁定的哥布林 ID 数组。
     * @returns {Goblin[]} 当前仍存活的掠夺队成员数组。
     */
    function getRaidPartyByIds(state, goblinIds) {
        // Goblin[] 掠夺队成员数组：只包含当前仍存活的成员。
        var raidParty = [];

        // number ID 循环索引：遍历出发时锁定的哥布林 ID 数组。
        for (var idIndex = 0; idIndex < goblinIds.length; idIndex += 1) {
            // string 哥布林 ID：用于匹配当前状态中的对象。
            var goblinId = goblinIds[idIndex];

            // Goblin|null 当前哥布林对象：找到后用于结算伤亡。
            var goblin = findGoblinById(state, goblinId);

            if (goblin && goblin.isAlive) {
                raidParty.push(goblin);
            }
        }

        return raidParty;
    }

    /**
     * 按 ID 查找哥布林对象。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} goblinId - 哥布林稳定 ID。
     * @returns {Goblin|null} 匹配的哥布林对象；不存在时返回 null。
     */
    function findGoblinById(state, goblinId) {
        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于匹配稳定 ID。
            var goblin = state.goblins[goblinIndex];

            if (goblin.id === goblinId) {
                return goblin;
            }
        }

        return null;
    }

    /**
     * 按掠夺强度降序比较两个哥布林。
     *
     * @param {Goblin} leftGoblin - 左侧哥布林对象，不会被修改。
     * @param {Goblin} rightGoblin - 右侧哥布林对象，不会被修改。
     * @returns {number} 排序比较值；负数表示 left 应排在前面。
     */
    function compareRaidersByStrength(leftGoblin, rightGoblin) {
        return calculateGoblinRaidStrength(rightGoblin) - calculateGoblinRaidStrength(leftGoblin);
    }

    /**
     * 规范化玩家输入的派出人数。
     *
     * @param {number|undefined} requestedRaiderCount - 玩家输入人数，可能为空或非法。
     * @param {number} fallbackCount - 默认派出人数，正整数。
     * @returns {number} 规范化后的正整数派出人数。
     */
    function normalizeRaiderCount(requestedRaiderCount, fallbackCount) {
        // number 数值化派出人数：非法输入按默认人数处理。
        var numericCount = Number(requestedRaiderCount);

        if (!Number.isFinite(numericCount) || numericCount <= 0) {
            return Math.max(1, Math.floor(fallbackCount));
        }

        return Math.max(1, Math.floor(numericCount));
    }

    /**
     * 计算本次掠夺需要支付的菌菇口粮。
     *
     * @param {number} raiderCount - 本次实际派出的战斗哥布林数量，非负整数。
     * @returns {Price[]} 掠夺成本数组；每名战斗哥布林固定消耗 100 菌菇。
     */
    function getRaidCost(raiderCount) {
        // number 成本人数：用于把异常输入收敛为非负整数。
        var normalizedRaiderCount = Math.max(0, Math.floor(Number(raiderCount) || 0));

        return [
            game.pricing.createPrice("fungus", normalizedRaiderCount * RAID_FUNGUS_COST_PER_GOBLIN)
        ];
    }

    /**
     * 计算掠夺队伍基础强度。
     *
     * @param {Goblin[]} raidParty - 本次派出的战斗职业哥布林数组。
     * @returns {number} 队伍基础强度，非负浮点数。
     */
    function calculateRaidPartyBaseStrength(raidParty) {
        // number 队伍强度总和：逐个累加哥布林个人掠夺强度。
        var teamStrength = 0;

        // number 循环索引：遍历掠夺队伍数组的整数下标。
        for (var memberIndex = 0; memberIndex < raidParty.length; memberIndex += 1) {
            // Goblin 当前队员：用于累加个人强度。
            var raidMember = raidParty[memberIndex];

            teamStrength += calculateGoblinRaidStrength(raidMember);
        }

        return teamStrength;
    }

    /**
     * 计算单个哥布林的掠夺强度。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @returns {number} 个人掠夺强度，非负浮点数。
     */
    function calculateGoblinRaidStrength(goblin) {
        // number 属性强度：强壮、狡诈、灵巧和意志共同决定战斗表现。
        var attributeStrength = (goblin.attributes.strength || 0) * 1.2 + (goblin.attributes.cunning || 0) * 0.9 + (goblin.attributes.dexterity || 0) * 0.6 + (goblin.attributes.will || 0) * 0.4;

        // number 技能强度：掠夺经验提供温和加成，避免老兵完全碾压数值曲线。
        var skillStrength = Math.min(8, (goblin.skills.raiding || 0) / 150);

        // number 职业强度：战争头目比普通抢掠兵更适合带队。
        var jobStrength = goblin.jobId === "war_chief" ? 5 : 2;

        // number 伤病惩罚倍率：伤越多越不适合出击，最低保留一半能力。
        var woundMultiplier = Math.max(0.5, 1 - goblin.wounds.length * 0.1);

        return (attributeStrength + skillStrength + jobStrength) * woundMultiplier;
    }

    /**
     * 计算掠夺队伍强度倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin[]} raidParty - 本次派出的战斗职业哥布林数组。
     * @returns {number} 队伍强度加成比例，可为负数。
     */
    function calculateRaidStrengthRatio(state, raidParty) {
        // Object.<string, number> 政策效果字典：读取掠夺队伍强度修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：读取战争契约强度修正。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 建筑强度倍率：训练坑、兵器坊和战争营地等建筑提供。
        var buildingRatio = getOwnedRaidStrengthRatio(state);

        // number 装备强度倍率：战旗等可制作资源和旧存档兼容值提供。
        var equipmentRatio = (state.statistics.raidStrengthRatio || 0) + (state.statistics.raidLegacyStrengthRatio || 0);

        // number 领袖强度倍率：领袖亲自出战时提升队伍组织度。
        var leaderRatio = hasLeaderInRaidParty(state, raidParty) ? 0.05 : 0;

        return buildingRatio + equipmentRatio + (policyEffects.raidStrengthRatio || 0) + (pactEffects.raidStrengthRatio || 0) + leaderRatio;
    }

    /**
     * 汇总建筑提供的掠夺队伍强度倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 建筑强度加成比例，非负或有符号浮点数。
     */
    function getOwnedRaidStrengthRatio(state) {
        // number 强度倍率总和：按已拥有建筑数量累加。
        var strengthRatio = 0;

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取掠夺强度效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (buildingState && buildingDefinition.effects.raidStrengthRatio) {
                strengthRatio += buildingDefinition.effects.raidStrengthRatio * buildingState.owned;
            }
        }

        return strengthRatio;
    }

    /**
     * 判断领袖是否在本次掠夺队伍中。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin[]} raidParty - 本次派出的战斗职业哥布林数组。
     * @returns {boolean} 是否包含当前领袖；true 表示领袖亲自出战。
     */
    function hasLeaderInRaidParty(state, raidParty) {
        if (!state.leaderGoblinId) {
            return false;
        }

        // number 循环索引：遍历掠夺队伍数组的整数下标。
        for (var memberIndex = 0; memberIndex < raidParty.length; memberIndex += 1) {
            // Goblin 当前队员：用于匹配领袖 ID。
            var raidMember = raidParty[memberIndex];

            if (raidMember.id === state.leaderGoblinId) {
                return true;
            }
        }

        return false;
    }

    /**
     * 应用掠夺成功结果。
     *
     * @param {GameState} state - 当前游戏状态对象，会增加资源和可能增加俘虏。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {number} lootRatio - 战利品收益修正比例，可为负数。
     * @param {Object.<string, number|string|boolean|Price[]|Object>} preview - 本次掠夺预览摘要。
     * @returns {void} 无返回值。
     */
    function applyRaidSuccess(state, targetDefinition, lootRatio, preview) {
        // string[] 奖励资源 ID 数组：用于遍历奖励字典。
        var rewardResourceIds = Object.keys(targetDefinition.rewards);

        // number 循环索引：遍历奖励资源 ID 数组的整数下标。
        for (var rewardIndex = 0; rewardIndex < rewardResourceIds.length; rewardIndex += 1) {
            // ResourceId 当前奖励资源 ID：用于发放资源。
            var resourceId = rewardResourceIds[rewardIndex];

            // number 奖励数量：战利品可被政策修正，其他资源保持定义值。
            var rewardAmount = targetDefinition.rewards[resourceId] * (resourceId === "loot" ? Math.max(0, 1 + lootRatio) : 1);

            game.resources.addResource(state, resourceId, rewardAmount);
        }

        game.resources.changeResource(state, "infamy", preview.infamyReward);
        game.resources.changeResource(state, "goodwill", -preview.goodwillPenalty);
        addRaidCaptive(state, targetDefinition);
        addRaidWarbeast(state, targetDefinition);
        game.simulation.addLog(state, "important", "掠夺成功：" + targetDefinition.name + "，派出 " + preview.raiderCount + " 名战斗哥布林，队伍强度 " + preview.teamStrength.toFixed(1) + "，恶名 +" + preview.infamyReward + "，善名 -" + preview.goodwillPenalty + "。");
    }

    /**
     * 应用掠夺失败结果。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入失败日志。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {Object.<string, number|string|boolean|Price[]|Object>} preview - 本次掠夺预览摘要。
     * @returns {void} 无返回值。
     */
    function applyRaidFailure(state, targetDefinition, preview) {
        game.resources.changeResource(state, "infamy", -preview.infamyFailurePenalty);
        game.simulation.addLog(state, "warning", "掠夺失败：" + targetDefinition.name + "，派出 " + preview.raiderCount + " 名战斗哥布林，队伍强度 " + preview.teamStrength.toFixed(1) + "，关系下降，恶名 -" + preview.infamyFailurePenalty + "。");
    }

    /**
     * 应用掠夺伤亡。
     *
     * @param {GameState} state - 当前游戏状态对象，可能修改哥布林伤病或存活状态。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象，用于日志。
     * @param {Goblin[]} raidParty - 本次派出的战斗职业哥布林数组。
     * @param {number} casualtyChance - 单个队员伤亡判定概率，范围 0-1。
     * @param {number} deathChance - 发生伤亡后转为死亡的概率，范围 0-1。
     * @returns {void} 无返回值。
     */
    function applyRaidCasualties(state, targetDefinition, raidParty, casualtyChance, deathChance) {
        // number 伤亡人数：统计本次受伤或死亡队员数量。
        var casualtyCount = 0;

        // number 死亡人数：统计本次死亡队员数量。
        var deathCount = 0;

        // number 循环索引：遍历掠夺队伍数组的整数下标。
        for (var memberIndex = 0; memberIndex < raidParty.length; memberIndex += 1) {
            // Goblin 当前队员：用于进行伤亡判定。
            var raidMember = raidParty[memberIndex];

            if (Math.random() >= casualtyChance) {
                continue;
            }

            casualtyCount += 1;

            if (Math.random() < deathChance) {
                raidMember.isAlive = false;
                raidMember.jobId = undefined;
                deathCount += 1;
                game.simulation.addLog(state, "warning", "掠夺伤亡：" + raidMember.name + " 死在 " + targetDefinition.name + "。");
            } else {
                raidMember.wounds.push("raid_wound");
                game.simulation.addLog(state, "warning", "掠夺伤亡：" + raidMember.name + " 在 " + targetDefinition.name + " 受伤。");
            }
        }

        if (casualtyCount > 0) {
            game.simulation.addLog(state, "warning", "掠夺伤亡合计：" + casualtyCount + " 名，死亡 " + deathCount + " 名。");
        }
    }

    /**
     * 添加掠夺俘虏。
     *
     * @param {GameState} state - 当前游戏状态对象，会追加俘虏。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @returns {void} 无返回值。
     */
    function addRaidCaptive(state, targetDefinition) {
        // CaptiveState 新俘虏：按地点种族权重、种族职业权重和种族质量权重生成。
        var captive = game.captivesSystem.createCaptiveFromRaidTarget(targetDefinition);

        state.captives.push(captive);
        game.captivesSystem.syncCaptiveResource(state);
    }

    /**
     * 尝试添加掠夺战兽。
     *
     * @param {GameState} state - 当前游戏状态对象，成功时会追加战兽。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @returns {void} 无返回值。
     */
    function addRaidWarbeast(state, targetDefinition) {
        if (!game.warbeastsSystem) {
            return;
        }

        game.warbeastsSystem.tryCaptureFromRaidTarget(state, targetDefinition);
    }

    // Object 掠夺系统命名空间：提供目标查询、预览和执行函数。
    game.raids = {
        getRaidTargetDefinition: getRaidTargetDefinition,
        previewRaid: previewRaid,
        executeRaid: executeRaid,
        resolveRaidMission: resolveRaidMission,
        getAvailableRaiders: getAvailableRaiders,
        getRaidCost: getRaidCost
    };
})(window.GoblinEmpire);
