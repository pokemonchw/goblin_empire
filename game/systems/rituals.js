/* 祭祀系统：负责祖灵升级、献祭预览和献祭结算。 */
/**
 * 初始化祭祀系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 rituals 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 取得祖灵升级定义。
     *
     * @param {string} upgradeId - 祖灵升级稳定 ID。
     * @returns {RitualUpgradeDefinition|null} 祖灵升级定义；未找到时返回 null。
     */
    function getRitualUpgradeDefinition(upgradeId) {
        // number 循环索引：遍历祖灵升级定义数组的整数下标。
        for (var upgradeIndex = 0; upgradeIndex < game.definitions.RITUAL_UPGRADE_DEFINITIONS.length; upgradeIndex += 1) {
            // RitualUpgradeDefinition 当前升级定义：用于匹配升级 ID。
            var upgradeDefinition = game.definitions.RITUAL_UPGRADE_DEFINITIONS[upgradeIndex];

            if (upgradeDefinition.id === upgradeId) {
                return upgradeDefinition;
            }
        }

        return null;
    }

    /**
     * 取得献祭定义。
     *
     * @param {string} sacrificeId - 献祭操作稳定 ID。
     * @returns {SacrificeDefinition|null} 献祭定义；未找到时返回 null。
     */
    function getSacrificeDefinition(sacrificeId) {
        // number 循环索引：遍历献祭定义数组的整数下标。
        for (var sacrificeIndex = 0; sacrificeIndex < game.definitions.SACRIFICE_DEFINITIONS.length; sacrificeIndex += 1) {
            // SacrificeDefinition 当前献祭定义：用于匹配献祭 ID。
            var sacrificeDefinition = game.definitions.SACRIFICE_DEFINITIONS[sacrificeIndex];

            if (sacrificeDefinition.id === sacrificeId) {
                return sacrificeDefinition;
            }
        }

        return null;
    }

    /**
     * 判断祖灵升级是否已购买。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} upgradeId - 祖灵升级稳定 ID。
     * @returns {boolean} 是否已购买；true 表示效果已生效。
     */
    function isRitualUpgradePurchased(state, upgradeId) {
        return Boolean(state.upgradesUnlockedById[upgradeId]);
    }

    /**
     * 汇总祖灵升级效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, number>} 祖灵升级效果字典；key 为效果 ID，value 为累计数值。
     */
    function getRitualEffects(state) {
        // Object.<string, number> 效果汇总字典：按效果 ID 累加已购买升级。
        var ritualEffects = {};

        // number 循环索引：遍历祖灵升级定义数组的整数下标。
        for (var upgradeIndex = 0; upgradeIndex < game.definitions.RITUAL_UPGRADE_DEFINITIONS.length; upgradeIndex += 1) {
            // RitualUpgradeDefinition 当前升级定义：用于判断是否生效。
            var upgradeDefinition = game.definitions.RITUAL_UPGRADE_DEFINITIONS[upgradeIndex];

            if (!isRitualUpgradePurchased(state, upgradeDefinition.id)) {
                continue;
            }

            // string[] 效果 ID 数组：遍历当前升级的效果字段。
            var effectIds = Object.keys(upgradeDefinition.effects);

            // number 效果循环索引：遍历效果 ID 数组的整数下标。
            for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
                // string 当前效果 ID：用于累加同名效果。
                var effectId = effectIds[effectIndex];

                ritualEffects[effectId] = (ritualEffects[effectId] || 0) + upgradeDefinition.effects[effectId];
            }
        }

        return ritualEffects;
    }

    /**
     * 购买祖灵升级。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} upgradeId - 祖灵升级稳定 ID。
     * @returns {boolean} 是否购买成功；true 表示资源已扣除且升级已生效。
     */
    function buyRitualUpgrade(state, upgradeId) {
        if (state.isPaused || isRitualUpgradePurchased(state, upgradeId) || (game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state))) {
            return false;
        }

        // RitualUpgradeDefinition|null 升级定义：用于读取价格和显示名。
        var upgradeDefinition = getRitualUpgradeDefinition(upgradeId);

        if (!upgradeDefinition || !game.resources.spendResources(state, upgradeDefinition.price)) {
            return false;
        }

        state.upgradesUnlockedById[upgradeId] = true;
        game.simulation.addLog(state, "important", "祖灵升级：" + upgradeDefinition.name + " 已供奉。");
        return true;
    }

    /**
     * 预览献祭收益和风险。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} sacrificeId - 献祭操作稳定 ID。
     * @returns {Object.<string, number|boolean|Price[]>} 献祭预览对象。
     */
    function previewSacrifice(state, sacrificeId) {
        // SacrificeDefinition|null 献祭定义：用于读取成本、收益和风险。
        var sacrificeDefinition = getSacrificeDefinition(sacrificeId);

        if (!sacrificeDefinition) {
            return {};
        }

        // Object.<string, number> 政策效果字典：祖灵或血月政策会影响回响收益。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 祖灵升级效果字典：预留给后续祭祀收益倍率。
        var ritualEffects = getRitualEffects(state);

        // number 收益倍率：政策和升级共同修正祖灵回响收益。
        var rewardMultiplier = Math.max(0, 1 + (policyEffects.ancestralEchoOutputRatio || 0) + (ritualEffects.ancestralEchoOutputRatio || 0));

        return {
            cost: sacrificeDefinition.cost,
            ancestralEchoReward: sacrificeDefinition.ancestralEchoReward * rewardMultiplier,
            riskChance: sacrificeDefinition.riskChance,
            affectsGoblin: sacrificeDefinition.affectsGoblin,
            goblinCost: sacrificeDefinition.goblinCost || 0,
            isAvailable: isSacrificeAvailable(state, sacrificeDefinition)
        };
    }

    /**
     * 执行献祭。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} sacrificeId - 献祭操作稳定 ID。
     * @returns {boolean} 是否执行成功；true 表示消耗和收益已结算。
     */
    function executeSacrifice(state, sacrificeId) {
        if (state.isPaused || (game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state))) {
            return false;
        }

        // SacrificeDefinition|null 献祭定义：用于读取成本、收益和风险。
        var sacrificeDefinition = getSacrificeDefinition(sacrificeId);

        // Object.<string, number|boolean|Price[]> 献祭预览：用于本次收益和风险。
        var preview = previewSacrifice(state, sacrificeId);

        if (!sacrificeDefinition || !preview.isAvailable || !canPaySacrificeGoblinCost(state, sacrificeDefinition.goblinCost || 0) || !game.resources.spendResources(state, sacrificeDefinition.cost)) {
            return false;
        }

        // Goblin[] 被献祭哥布林列表：人口消耗必须落到具体对象，便于日志和存档追踪。
        var consumedGoblins = consumeSacrificeGoblins(state, sacrificeDefinition.goblinCost || 0);

        if (consumedGoblins.length < (sacrificeDefinition.goblinCost || 0)) {
            return false;
        }

        // number 实际祖灵回响收益：写入资源并记录日志。
        var gainedEcho = game.resources.addResource(state, "ancestralEcho", preview.ancestralEchoReward);

        // Goblin|null 受影响哥布林：风险命中时追加祭祀伤病。
        var affectedGoblin = null;

        if (sacrificeDefinition.affectsGoblin && Math.random() < sacrificeDefinition.riskChance) {
            affectedGoblin = findRitualGoblin(state);

            if (affectedGoblin) {
                affectedGoblin.wounds.push("ritual_mark");
            }
        }

        if (affectedGoblin) {
            game.simulation.addLog(state, "warning", "献祭：" + sacrificeDefinition.name + "，获得祖灵回响 " + gainedEcho.toFixed(1) + "，" + affectedGoblin.name + " 留下祭祀烙印。");
            return true;
        }

        if (consumedGoblins.length > 0) {
            game.simulation.addLog(state, "warning", "献祭：" + sacrificeDefinition.name + "，" + formatGoblinNames(consumedGoblins) + " 被献给祖灵，获得祖灵回响 " + gainedEcho.toFixed(1) + "。");
            return true;
        }

        game.simulation.addLog(state, "important", "献祭：" + sacrificeDefinition.name + "，消耗" + formatPriceList(sacrificeDefinition.cost) + "，获得祖灵回响 " + gainedEcho.toFixed(1) + "。");
        return true;
    }

    /**
     * 判断献祭是否满足条件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {SacrificeDefinition} sacrificeDefinition - 献祭定义对象。
     * @returns {boolean} 是否可执行；true 表示条件入口已开启。
     */
    function isSacrificeAvailable(state, sacrificeDefinition) {
        if (sacrificeDefinition.conditionId === "ritual_festival") {
            return (state.statistics.ritualFestivalSeconds || 0) > 0;
        }

        if (sacrificeDefinition.conditionId === "abyss_echo_seen") {
            return Boolean(state.resourcesById.abyssEcho && state.resourcesById.abyssEcho.isVisible);
        }

        if (sacrificeDefinition.conditionId === "blood_moon_policy") {
            return state.policies && state.policies.ritual === "blood_moon" && canPaySacrificeGoblinCost(state, sacrificeDefinition.goblinCost || 0);
        }

        return true;
    }

    /**
     * 判断献祭人口成本是否能落到具体非领袖哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {number} goblinCost - 需要献祭的存活哥布林数量，非负整数。
     * @returns {boolean} 是否有足够可献祭哥布林；true 表示执行时可以逐个标记。
     */
    function canPaySacrificeGoblinCost(state, goblinCost) {
        // number 可献祭哥布林数量：排除领袖，避免献祭后部落无法继续运转。
        var availableGoblinCount = 0;

        if (goblinCost <= 0) {
            return true;
        }

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于统计可献祭人口。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && !goblin.isLeader) {
                availableGoblinCount += 1;
            }
        }

        return availableGoblinCount >= goblinCost;
    }

    /**
     * 查找承受祭祀风险的哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Goblin|null} 优先返回巫医，其次返回任一存活哥布林。
     */
    function findRitualGoblin(state) {
        // Goblin|null 备用哥布林：没有巫医时承受祭祀风险。
        var fallbackGoblin = null;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于查找巫医或存活个体。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive) {
                continue;
            }

            if (!fallbackGoblin) {
                fallbackGoblin = goblin;
            }

            if (goblin.jobId === "witch_doctor") {
                return goblin;
            }
        }

        return fallbackGoblin;
    }

    /**
     * 消耗献祭人口并直接写回具体哥布林对象。
     *
     * @param {GameState} state - 当前游戏状态对象，会把被献祭哥布林标记为死亡。
     * @param {number} goblinCost - 需要献祭的存活哥布林数量，非负整数。
     * @returns {Goblin[]} 实际被献祭的哥布林对象数组。
     */
    function consumeSacrificeGoblins(state, goblinCost) {
        // Goblin[] 被献祭哥布林数组：用于日志显示和数量校验。
        var consumedGoblins = [];

        if (goblinCost <= 0) {
            return consumedGoblins;
        }

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：优先献祭未固定的存活个体。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive || goblin.isPinned || goblin.isLeader) {
                continue;
            }

            goblin.isAlive = false;
            goblin.jobId = null;
            goblin.wounds.push("blood_moon_sacrifice");
            consumedGoblins.push(goblin);

            if (consumedGoblins.length >= goblinCost) {
                return consumedGoblins;
            }
        }

        // number 备用循环索引：没有足够普通哥布林时允许牺牲固定职业但保留领袖。
        for (var fallbackIndex = 0; fallbackIndex < state.goblins.length; fallbackIndex += 1) {
            // Goblin 备用哥布林对象：用于满足已确认的人口献祭成本。
            var fallbackGoblin = state.goblins[fallbackIndex];

            if (!fallbackGoblin.isAlive || fallbackGoblin.isLeader || consumedGoblins.indexOf(fallbackGoblin) >= 0) {
                continue;
            }

            fallbackGoblin.isAlive = false;
            fallbackGoblin.jobId = null;
            fallbackGoblin.wounds.push("blood_moon_sacrifice");
            consumedGoblins.push(fallbackGoblin);

            if (consumedGoblins.length >= goblinCost) {
                return consumedGoblins;
            }
        }

        return consumedGoblins;
    }

    /**
     * 格式化哥布林姓名列表。
     *
     * @param {Goblin[]} goblins - 哥布林对象数组。
     * @returns {string} 中文姓名列表文本。
     */
    function formatGoblinNames(goblins) {
        // string[] 姓名文本数组：用于献祭日志。
        var nameTexts = [];

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：读取显示姓名。
            var goblin = goblins[goblinIndex];

            nameTexts.push(goblin.name);
        }

        return nameTexts.join("、");
    }

    /**
     * 格式化价格列表。
     *
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {string} 中文价格文本。
     */
    function formatPriceList(price) {
        // string[] 价格文本数组：用于拼接日志。
        var priceTexts = [];

        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前价格项：用于读取资源名和数量。
            var priceEntry = price[priceIndex];

            // ResourceDefinition|null 资源定义：用于显示中文资源名。
            var resourceDefinition = game.resources.getResourceDefinition(priceEntry.resource);

            priceTexts.push((resourceDefinition ? resourceDefinition.name : priceEntry.resource) + " " + priceEntry.amount);
        }

        return priceTexts.join("，");
    }

    // Object 祭祀系统命名空间：提供祖灵升级、献祭预览和执行接口。
    game.rituals = {
        getRitualUpgradeDefinition: getRitualUpgradeDefinition,
        getSacrificeDefinition: getSacrificeDefinition,
        isRitualUpgradePurchased: isRitualUpgradePurchased,
        getRitualEffects: getRitualEffects,
        buyRitualUpgrade: buyRitualUpgrade,
        previewSacrifice: previewSacrifice,
        executeSacrifice: executeSacrifice,
        isSacrificeAvailable: isSacrificeAvailable
    };
})(window.GoblinEmpire);
