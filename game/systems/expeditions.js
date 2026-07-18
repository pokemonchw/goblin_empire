/* 远征系统：负责深渊路线预览、队伍编成、计时和结算。 */
/**
 * 初始化远征系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 expeditions 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 取得远征路线定义。
     *
     * @param {string} routeId - 路线稳定 ID。
     * @returns {ExpeditionRouteDefinition|null} 路线定义；未找到时返回 null。
     */
    function getRouteDefinition(routeId) {
        // number 循环索引：遍历远征路线定义数组的整数下标。
        for (var routeIndex = 0; routeIndex < game.definitions.EXPEDITION_ROUTE_DEFINITIONS.length; routeIndex += 1) {
            // ExpeditionRouteDefinition 当前路线定义：用于匹配路线 ID。
            var routeDefinition = game.definitions.EXPEDITION_ROUTE_DEFINITIONS[routeIndex];

            if (routeDefinition.id === routeId) {
                return routeDefinition;
            }
        }

        return null;
    }

    /**
     * 预览远征风险和收益。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} routeId - 路线稳定 ID。
     * @returns {Object.<string, number|string|Goblin[]|Object>} 远征预览对象。
     */
    function previewExpedition(state, routeId) {
        // ExpeditionRouteDefinition|null 路线定义：用于读取难度和奖励。
        var routeDefinition = getRouteDefinition(routeId);

        if (!routeDefinition) {
            return {};
        }

        // Goblin[] 成员数组：自动选择的具体远征成员。
        var members = selectExpeditionMembers(state, 3);

        // number 队伍实力：由成员技能、伤病和领袖加成计算。
        var teamPower = calculateTeamPower(state, members);

        // Object.<string, number> 契约效果字典：战争契约让远征略偏进攻。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 成功率：按队伍实力和路线难度钳制在 5%-95%。
        var successChance = Math.max(0.05, Math.min(0.95, 0.5 + (teamPower - routeDefinition.difficulty) / 120 + (pactEffects.raidStrengthRatio || 0) / 2));

        // number 伤亡概率：难度越高越危险，队伍实力可压低风险。
        var casualtyChance = Math.max(0.05, Math.min(0.75, routeDefinition.casualtyChance + (routeDefinition.difficulty - teamPower) / 300));

        return {
            route: routeDefinition,
            members: members,
            memberSummary: formatMemberSummary(state, members),
            successChance: successChance,
            casualtyChance: casualtyChance,
            rewardSummary: formatRewardSummary(routeDefinition.rewards),
            pactInfluence: pactEffects.raidStrengthRatio ? "战争契约提高成功率" : "无契约修正"
        };
    }

    /**
     * 开始远征。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入 activeExpedition。
     * @param {string} routeId - 路线稳定 ID。
     * @returns {boolean} 是否成功开始；true 表示已写入活动远征。
     */
    function startExpedition(state, routeId) {
        if (state.isPaused || state.activeExpedition || (game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state))) {
            return false;
        }

        // ExpeditionRouteDefinition|null 路线定义：用于写入远征时长。
        var routeDefinition = getRouteDefinition(routeId);

        if (!routeDefinition) {
            return false;
        }

        // Goblin[] 成员数组：本次远征的具体哥布林对象。
        var members = selectExpeditionMembers(state, 3);

        if (members.length === 0) {
            return false;
        }

        // string[] 成员 ID 数组：保存到远征状态。
        var memberIds = [];

        // number 循环索引：遍历成员数组的整数下标。
        for (var memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
            // Goblin 当前成员：用于写入 ID。
            var member = members[memberIndex];

            memberIds.push(member.id);
        }

        state.activeExpedition = {
            id: "expedition_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
            routeId: routeId,
            memberIds: memberIds,
            remainingSeconds: routeDefinition.durationSeconds,
            isResolved: false
        };
        game.simulation.addLog(state, "important", "远征出发：" + routeDefinition.name + "，成员：" + formatMemberSummary(state, members) + "。");
        return true;
    }

    /**
     * 推进远征计时。
     *
     * @param {GameState} state - 当前游戏状态对象，会推进或结算远征。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function updateExpeditions(state, deltaSeconds) {
        if (!state.activeExpedition || state.activeExpedition.isResolved) {
            return;
        }

        state.activeExpedition.remainingSeconds = Math.max(0, state.activeExpedition.remainingSeconds - deltaSeconds);

        if (state.activeExpedition.remainingSeconds <= 0) {
            resolveExpedition(state);
        }
    }

    /**
     * 结算当前远征。
     *
     * @param {GameState} state - 当前游戏状态对象，会发放奖励或造成损失。
     * @returns {boolean} 是否结算成功；true 表示活动远征已清空。
     */
    function resolveExpedition(state) {
        if (!state.activeExpedition || state.activeExpedition.isResolved) {
            return false;
        }

        // ExpeditionState 当前远征状态：用于读取路线和成员。
        var expedition = state.activeExpedition;

        // ExpeditionRouteDefinition|null 路线定义：用于结算奖励和风险。
        var routeDefinition = getRouteDefinition(expedition.routeId);

        if (!routeDefinition) {
            state.activeExpedition = null;
            return false;
        }

        // Object.<string, number|string|Goblin[]|Object> 预览对象：结算使用同一公式。
        var preview = previewExpedition(state, expedition.routeId);

        // boolean 是否成功：按成功率随机。
        var isSuccess = Math.random() < preview.successChance;

        expedition.isResolved = true;

        if (isSuccess) {
            applyExpeditionSuccess(state, routeDefinition, expedition.memberIds);
        } else {
            applyExpeditionFailure(state, routeDefinition, expedition.memberIds, preview.casualtyChance);
        }

        state.activeExpedition = null;
        return true;
    }

    /**
     * 应用远征成功结果。
     *
     * @param {GameState} state - 当前游戏状态对象，会获得资源。
     * @param {ExpeditionRouteDefinition} routeDefinition - 路线定义对象。
     * @param {string[]} memberIds - 成员哥布林 ID 数组。
     * @returns {void} 无返回值。
     */
    function applyExpeditionSuccess(state, routeDefinition, memberIds) {
        // string[] 奖励资源 ID 数组：用于遍历奖励范围字典。
        var resourceIds = Object.keys(routeDefinition.rewards);

        // string[] 奖励文本数组：用于日志记录。
        var rewardTexts = [];

        // number 循环索引：遍历奖励资源 ID 数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // ResourceId 当前奖励资源 ID：用于发放远征收益。
            var resourceId = resourceIds[resourceIndex];

            // Object 奖励范围：包含 min 和 max。
            var rewardRange = routeDefinition.rewards[resourceId];

            // number 奖励数量：在范围内随机。
            var rewardAmount = rewardRange.min + Math.random() * (rewardRange.max - rewardRange.min);

            game.resources.addResource(state, resourceId, rewardAmount);
            rewardTexts.push(game.resources.getResourceDisplayName(resourceId) + " +" + rewardAmount.toFixed(1));
        }

        game.simulation.addLog(state, "important", "远征成功：" + routeDefinition.name + "，成员：" + memberIds.join("，") + "，收益：" + rewardTexts.join("，") + "。");
    }

    /**
     * 应用远征失败结果。
     *
     * @param {GameState} state - 当前游戏状态对象，可能伤害或杀死成员。
     * @param {ExpeditionRouteDefinition} routeDefinition - 路线定义对象。
     * @param {string[]} memberIds - 成员哥布林 ID 数组。
     * @param {number} casualtyChance - 伤亡概率，范围 0-1。
     * @returns {void} 无返回值。
     */
    function applyExpeditionFailure(state, routeDefinition, memberIds, casualtyChance) {
        // Goblin|null 受损成员：从远征成员中选第一个存活对象。
        var harmedGoblin = findFirstAliveMember(state, memberIds);

        if (harmedGoblin && Math.random() < casualtyChance) {
            if (Math.random() < 0.25) {
                harmedGoblin.isAlive = false;
                harmedGoblin.wounds.push("lost_expedition");
                game.simulation.addLog(state, "warning", "远征失败：" + routeDefinition.name + "，成员：" + memberIds.join("，") + "，" + harmedGoblin.name + " 失踪。");
                return;
            }

            harmedGoblin.wounds.push("expedition_wound");
            game.simulation.addLog(state, "warning", "远征失败：" + routeDefinition.name + "，成员：" + memberIds.join("，") + "，" + harmedGoblin.name + " 受伤。");
            return;
        }

        game.simulation.addLog(state, "warning", "远征失败：" + routeDefinition.name + "，成员：" + memberIds.join("，") + "，无收益。");
    }

    /**
     * 自动选择远征成员。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {number} maxCount - 最大成员数量，非负整数。
     * @returns {Goblin[]} 自动选择的成员数组。
     */
    function selectExpeditionMembers(state, maxCount) {
        // Goblin[] 候选成员数组：存活哥布林按远征评分排序。
        var candidates = state.goblins.filter(function (goblin) {
            return goblin.isAlive;
        }).slice();

        candidates.sort(function (leftGoblin, rightGoblin) {
            return calculateExpeditionScore(rightGoblin) - calculateExpeditionScore(leftGoblin);
        });

        return candidates.slice(0, maxCount);
    }

    /**
     * 计算远征队实力。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin[]} members - 成员哥布林数组。
     * @returns {number} 队伍实力分数，非负数。
     */
    function calculateTeamPower(state, members) {
        // number 队伍实力：累加成员评分。
        var teamPower = 0;

        // number 循环索引：遍历成员数组的整数下标。
        for (var memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
            // Goblin 当前成员：用于计算远征评分。
            var member = members[memberIndex];

            teamPower += calculateExpeditionScore(member);

            if (member.id === state.leaderGoblinId) {
                teamPower += 10;
            }
        }

        return teamPower;
    }

    /**
     * 计算单个哥布林远征评分。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @returns {number} 远征评分，非负数。
     */
    function calculateExpeditionScore(goblin) {
        // number 属性分：强壮、感知、意志和魔性共同影响远征。
        var attributeScore = goblin.attributes.strength + goblin.attributes.perception + goblin.attributes.will + goblin.attributes.attunement;

        // number 技能分：采矿、抢掠、祭祀和制作经验提供少量加成。
        var skillScore = ((goblin.skills.mining || 0) + (goblin.skills.raiding || 0) + (goblin.skills.ritual || 0) + (goblin.skills.crafting || 0)) / 100;

        // number 伤病惩罚：每个伤病降低远征表现。
        var woundPenalty = goblin.wounds.length * 5;

        return Math.max(1, attributeScore + skillScore - woundPenalty);
    }

    /**
     * 查找第一个存活远征成员。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string[]} memberIds - 成员 ID 数组。
     * @returns {Goblin|null} 成员对象；没有存活成员时返回 null。
     */
    function findFirstAliveMember(state, memberIds) {
        // number 循环索引：遍历成员 ID 数组的整数下标。
        for (var memberIndex = 0; memberIndex < memberIds.length; memberIndex += 1) {
            // string 成员 ID：用于查找哥布林对象。
            var memberId = memberIds[memberIndex];

            // Goblin|null 成员对象：匹配 ID 后返回。
            var member = findGoblinById(state, memberId);

            if (member && member.isAlive) {
                return member;
            }
        }

        return null;
    }

    /**
     * 按 ID 查找哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} goblinId - 哥布林稳定 ID。
     * @returns {Goblin|null} 哥布林对象；未找到时返回 null。
     */
    function findGoblinById(state, goblinId) {
        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于匹配 ID。
            var goblin = state.goblins[goblinIndex];

            if (goblin.id === goblinId) {
                return goblin;
            }
        }

        return null;
    }

    /**
     * 格式化成员摘要。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin[]} members - 成员哥布林数组。
     * @returns {string} 成员中文摘要。
     */
    function formatMemberSummary(state, members) {
        // string[] 成员文本数组：每项为姓名和远征评分。
        var memberTexts = [];

        // number 循环索引：遍历成员数组的整数下标。
        for (var memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
            // Goblin 当前成员：用于显示姓名、技能和伤病。
            var member = members[memberIndex];

            // string 领袖文本：说明领袖对远征队实力的额外影响。
            var leaderText = member.id === state.leaderGoblinId ? "，领袖+10" : "";

            memberTexts.push(member.name + "(分" + calculateExpeditionScore(member).toFixed(0) + "，采" + (member.skills.mining || 0).toFixed(0) + "，掠" + (member.skills.raiding || 0).toFixed(0) + "，祭" + (member.skills.ritual || 0).toFixed(0) + "，工" + (member.skills.crafting || 0).toFixed(0) + "，伤" + member.wounds.length + leaderText + ")");
        }

        return memberTexts.join("，");
    }

    /**
     * 格式化奖励范围。
     *
     * @param {Object.<string, {min: number, max: number}>} rewards - 奖励范围字典。
     * @returns {string} 奖励范围文本。
     */
    function formatRewardSummary(rewards) {
        // string[] 奖励文本数组：用于预览显示。
        var rewardTexts = [];

        // string[] 资源 ID 数组：遍历奖励字典。
        var resourceIds = Object.keys(rewards);

        // number 循环索引：遍历资源 ID 数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // string 资源 ID：用于读取奖励范围。
            var resourceId = resourceIds[resourceIndex];

            // string 资源名称：从统一玩家显示名接口读取，异常时使用中文占位。
            var resourceName = game.resources.getResourceDisplayName(resourceId);

            rewardTexts.push(resourceName + " " + rewards[resourceId].min + "-" + rewards[resourceId].max);
        }

        return rewardTexts.join("，");
    }

    // Object 远征系统命名空间：提供预览、开始和推进接口。
    game.expeditions = {
        getRouteDefinition: getRouteDefinition,
        previewExpedition: previewExpedition,
        startExpedition: startExpedition,
        updateExpeditions: updateExpeditions,
        resolveExpedition: resolveExpedition,
        selectExpeditionMembers: selectExpeditionMembers
    };
})(window.GoblinEmpire);
