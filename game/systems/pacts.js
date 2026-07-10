/* 深渊契约系统：负责契约启用状态和效果汇总。 */
/**
 * 初始化深渊契约系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 pacts 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 取得契约定义。
     *
     * @param {string} pactId - 契约稳定 ID。
     * @returns {PactDefinition|null} 契约定义；未找到时返回 null。
     */
    function getPactDefinition(pactId) {
        // number 循环索引：遍历契约定义数组的整数下标。
        for (var pactIndex = 0; pactIndex < game.definitions.PACT_DEFINITIONS.length; pactIndex += 1) {
            // PactDefinition 当前契约定义：用于匹配契约 ID。
            var pactDefinition = game.definitions.PACT_DEFINITIONS[pactIndex];

            if (pactDefinition.id === pactId) {
                return pactDefinition;
            }
        }

        return null;
    }

    /**
     * 判断契约是否启用。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} pactId - 契约稳定 ID。
     * @returns {boolean} 是否启用；true 表示效果正在生效。
     */
    function isPactActive(state, pactId) {
        return Boolean(state.pacts[pactId]);
    }

    /**
     * 切换契约启用状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入 pacts 字典。
     * @param {string} pactId - 契约稳定 ID。
     * @returns {boolean} 是否切换成功；暂停或定义缺失时返回 false。
     */
    function togglePact(state, pactId) {
        if (state.isPaused || !getPactDefinition(pactId) || (game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state))) {
            return false;
        }

        state.pacts[pactId] = !state.pacts[pactId];
        game.simulation.addLog(state, "important", (state.pacts[pactId] ? "签订契约：" : "解除契约：") + getPactDefinition(pactId).name + "。");
        return true;
    }

    /**
     * 汇总已启用契约效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, number>} 契约效果字典；key 为效果 ID，value 为累计数值。
     */
    function getPactEffects(state) {
        // Object.<string, number> 效果汇总字典：按效果 ID 累加启用契约。
        var pactEffects = {};

        // number 循环索引：遍历契约定义数组的整数下标。
        for (var pactIndex = 0; pactIndex < game.definitions.PACT_DEFINITIONS.length; pactIndex += 1) {
            // PactDefinition 当前契约定义：用于判断是否启用。
            var pactDefinition = game.definitions.PACT_DEFINITIONS[pactIndex];

            if (!isPactActive(state, pactDefinition.id)) {
                continue;
            }

            // string[] 效果 ID 数组：遍历当前契约效果。
            var effectIds = Object.keys(pactDefinition.effects);

            // number 效果循环索引：遍历效果 ID 数组的整数下标。
            for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
                // string 当前效果 ID：用于累加同名效果。
                var effectId = effectIds[effectIndex];

                // number 当前效果值：代价类效果可被威望天赋按绝对强度减免。
                var effectValue = pactDefinition.effects[effectId];

                if (game.prestigeSystem && game.prestigeSystem.isPactCostEffect(effectId)) {
                    // Object.<string, number> 威望效果字典：用于读取深渊适应代价减免。
                    var prestigeEffects = game.prestigeSystem.getPrestigeEffects(state);

                    effectValue *= Math.max(0, 1 + (prestigeEffects.pactCostRatio || 0));
                }

                pactEffects[effectId] = (pactEffects[effectId] || 0) + effectValue;
            }
        }

        return pactEffects;
    }

    // Object 深渊契约系统命名空间：提供契约查询、切换和效果汇总。
    game.pacts = {
        getPactDefinition: getPactDefinition,
        isPactActive: isPactActive,
        togglePact: togglePact,
        getPactEffects: getPactEffects
    };
})(window.GoblinEmpire);
