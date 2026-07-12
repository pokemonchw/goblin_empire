/* 研究系统：负责科技价格检查、研究完成和解锁应用。 */
/**
 * 初始化研究系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 technology 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 取得科技定义。
     *
     * @param {TechnologyId} technologyId - 科技稳定 ID。
     * @returns {TechnologyDefinition|null} 科技定义；未找到时返回 null。
     */
    function getTechnologyDefinition(technologyId) {
        // number 循环索引：遍历科技定义数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 当前科技定义：用于匹配科技 ID。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            if (technologyDefinition.id === technologyId) {
                return technologyDefinition;
            }
        }

        return null;
    }

    /**
     * 判断科技是否可研究。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 科技定义对象。
     * @returns {boolean} 是否可研究；true 表示已解锁、未完成、未暂停且资源足够。
     */
    function canResearch(state, technologyDefinition) {
        // TechnologyState 科技状态：用于读取解锁和完成状态。
        var technologyState = state.technologiesById[technologyDefinition.id];

        if (!technologyState || !technologyState.isUnlocked || technologyState.isResearched || state.isPaused) {
            return false;
        }

        return game.resources.canAfford(state, technologyDefinition.price);
    }

    /**
     * 研究科技并立即应用解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {TechnologyId} technologyId - 科技稳定 ID。
     * @returns {boolean} 是否研究成功；true 表示资源已扣除且科技完成。
     */
    function researchTechnology(state, technologyId) {
        // TechnologyDefinition|null 科技定义：用于读取价格和解锁效果。
        var technologyDefinition = getTechnologyDefinition(technologyId);

        if (!technologyDefinition || state.isPaused) {
            return false;
        }

        // TechnologyState 科技状态：用于写入完成状态。
        var technologyState = state.technologiesById[technologyId];

        if (!technologyState || !technologyState.isUnlocked || technologyState.isResearched) {
            return false;
        }

        if (!game.resources.spendResources(state, technologyDefinition.price)) {
            return false;
        }

        technologyState.isResearched = true;
        game.unlocks.applyUnlockBundle(state, technologyDefinition.unlocks);
        if (game.population) {
            game.population.refreshTechnologyLifespanBonus(state);
        }
        if (technologyId === "calendar") {
            game.calendar.unlockCalendar(state);
        }
        game.simulation.addLog(state, "important", game.text.TEXT_REGISTRY.logs.researchedPrefix + technologyDefinition.name + "。");
        return true;
    }

    // Object 研究系统命名空间：提供科技查询和研究函数。
    game.technology = {
        getTechnologyDefinition: getTechnologyDefinition,
        canResearch: canResearch,
        researchTechnology: researchTechnology
    };
})(window.GoblinEmpire);
