/* 政策系统：负责政策解锁判断、互斥选择和效果汇总。 */
/**
 * 初始化政策系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 policiesSystem 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 取得政策定义。
     *
     * @param {string} policyId - 政策稳定 ID。
     * @returns {PolicyDefinition|null} 政策定义；未找到时返回 null。
     */
    function getPolicyDefinition(policyId) {
        // number 循环索引：遍历政策定义数组的整数下标。
        for (var policyIndex = 0; policyIndex < game.definitions.POLICY_DEFINITIONS.length; policyIndex += 1) {
            // PolicyDefinition 当前政策定义：用于匹配政策 ID。
            var policyDefinition = game.definitions.POLICY_DEFINITIONS[policyIndex];

            if (policyDefinition.id === policyId) {
                return policyDefinition;
            }
        }

        return null;
    }

    /**
     * 判断政策是否已解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} policyId - 政策稳定 ID。
     * @returns {boolean} 是否已解锁；true 表示 UI 可显示并允许选择。
     */
    function isPolicyUnlocked(state, policyId) {
        return Boolean(state.policiesUnlockedById[policyId]);
    }

    /**
     * 取得当前已选择的政策定义。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {PolicyDefinition[]} 当前生效政策定义数组。
     */
    function getSelectedPolicyDefinitions(state) {
        // PolicyDefinition[] 已选择政策定义数组：按政策组读取当前政策。
        var selectedPolicyDefinitions = [];

        // string[] 政策组 ID 数组：state.policies 的 key 为互斥政策组 ID。
        var groupIds = Object.keys(state.policies);

        // number 循环索引：遍历政策组 ID 数组的整数下标。
        for (var groupIndex = 0; groupIndex < groupIds.length; groupIndex += 1) {
            // string 当前政策组 ID：用于读取选中的政策 ID。
            var groupId = groupIds[groupIndex];

            // string 当前政策 ID：该组当前生效的政策。
            var policyId = state.policies[groupId];

            // PolicyDefinition|null 当前政策定义：存在时加入效果计算。
            var policyDefinition = getPolicyDefinition(policyId);

            if (policyDefinition) {
                selectedPolicyDefinitions.push(policyDefinition);
            }
        }

        return selectedPolicyDefinitions;
    }

    /**
     * 汇总当前政策效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, number>} 政策效果字典；key 为效果 ID，value 为累计数值。
     */
    function getPolicyEffects(state) {
        // Object.<string, number> 效果汇总字典：按效果 ID 累加当前政策数值。
        var policyEffects = {};

        // PolicyDefinition[] 已选择政策定义数组：提供效果来源。
        var selectedPolicyDefinitions = getSelectedPolicyDefinitions(state);

        // number 循环索引：遍历已选择政策定义数组的整数下标。
        for (var policyIndex = 0; policyIndex < selectedPolicyDefinitions.length; policyIndex += 1) {
            // PolicyDefinition 当前政策定义：用于读取 effects 字典。
            var policyDefinition = selectedPolicyDefinitions[policyIndex];

            // string[] 效果 ID 数组：遍历当前政策的效果字段。
            var effectIds = Object.keys(policyDefinition.effects);

            // number 效果循环索引：遍历效果 ID 数组的整数下标。
            for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
                // string 当前效果 ID：用于累加同名效果。
                var effectId = effectIds[effectIndex];

                policyEffects[effectId] = (policyEffects[effectId] || 0) + policyDefinition.effects[effectId];
            }
        }

        return policyEffects;
    }

    /**
     * 选择政策，并自动替换同组旧政策。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} policyId - 要选择的政策稳定 ID。
     * @returns {boolean} 是否切换成功；true 表示已写入 state.policies。
     */
    function selectPolicy(state, policyId) {
        if (state.isPaused) {
            return false;
        }

        // PolicyDefinition|null 政策定义：用于读取政策组和显示名。
        var policyDefinition = getPolicyDefinition(policyId);

        if (!policyDefinition || !isPolicyUnlocked(state, policyId)) {
            return false;
        }

        if (state.policies[policyDefinition.groupId] === policyId) {
            return false;
        }

        state.policies[policyDefinition.groupId] = policyId;
        game.simulation.addLog(state, "important", "政策切换：" + policyDefinition.groupName + "改为" + policyDefinition.name + "。");
        return true;
    }

    // Object 政策系统命名空间：提供政策查询、效果汇总和切换接口。
    game.policiesSystem = {
        getPolicyDefinition: getPolicyDefinition,
        isPolicyUnlocked: isPolicyUnlocked,
        getSelectedPolicyDefinitions: getSelectedPolicyDefinitions,
        getPolicyEffects: getPolicyEffects,
        selectPolicy: selectPolicy
    };
})(window.GoblinEmpire);
