/* 俘虏系统：负责俘虏预览、处置和苗床繁衍入口。 */
/**
 * 初始化俘虏系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 captives 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 创建俘虏运行时对象。
     *
     * @param {"laborer"|"accountant"|"artisan"|"noble"|"warrior"|"magic_talent"|"undead_captive"|"ascetic"|"herbalist"|"shrine_acolyte"} captiveTypeId - 俘虏类型 ID。
     * @param {"common"|"skilled"|"elite"|"legendary"} qualityId - 俘虏质量 ID。
     * @param {string} source - 来源 ID 或事件名。
     * @returns {CaptiveState} 新俘虏对象。
     */
    function createCaptive(captiveTypeId, qualityId, source) {
        // CaptiveTypeDefinition|null 俘虏类型定义：用于写入倾向提示。
        var captiveTypeDefinition = getCaptiveTypeDefinition(captiveTypeId);

        return {
            id: "captive_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
            type: captiveTypeId,
            quality: qualityId,
            source: source,
            traitHint: captiveTypeDefinition ? captiveTypeDefinition.traitHint : "basic",
            turnsHeld: 0,
            disposition: undefined
        };
    }

    /**
     * 取得俘虏类型定义。
     *
     * @param {string} captiveTypeId - 俘虏类型 ID。
     * @returns {CaptiveTypeDefinition|null} 俘虏类型定义；未找到时返回 null。
     */
    function getCaptiveTypeDefinition(captiveTypeId) {
        // number 循环索引：遍历俘虏类型定义数组的整数下标。
        for (var captiveTypeIndex = 0; captiveTypeIndex < game.definitions.CAPTIVE_TYPE_DEFINITIONS.length; captiveTypeIndex += 1) {
            // CaptiveTypeDefinition 当前俘虏类型定义：用于匹配类型 ID。
            var captiveTypeDefinition = game.definitions.CAPTIVE_TYPE_DEFINITIONS[captiveTypeIndex];

            if (captiveTypeDefinition.id === captiveTypeId) {
                return captiveTypeDefinition;
            }
        }

        return null;
    }

    /**
     * 取得俘虏质量定义。
     *
     * @param {string} qualityId - 俘虏质量 ID。
     * @returns {CaptiveQualityDefinition|null} 俘虏质量定义；未找到时返回 null。
     */
    function getCaptiveQualityDefinition(qualityId) {
        // number 循环索引：遍历俘虏质量定义数组的整数下标。
        for (var qualityIndex = 0; qualityIndex < game.definitions.CAPTIVE_QUALITY_DEFINITIONS.length; qualityIndex += 1) {
            // CaptiveQualityDefinition 当前质量定义：用于匹配质量 ID。
            var qualityDefinition = game.definitions.CAPTIVE_QUALITY_DEFINITIONS[qualityIndex];

            if (qualityDefinition.id === qualityId) {
                return qualityDefinition;
            }
        }

        return null;
    }

    /**
     * 预览俘虏处置收益和风险。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @param {"bed"|"modify"|"food"} dispositionId - 处置方式 ID。
     * @returns {Object.<string, string|number>} 预览对象；包含收益、继承概率、逃脱风险和报复风险。
     */
    function previewDisposition(captive, dispositionId) {
        // CaptiveTypeDefinition|null 俘虏类型定义：用于读取倾向和技能偏向。
        var captiveTypeDefinition = getCaptiveTypeDefinition(captive.type);

        // CaptiveQualityDefinition|null 质量定义：用于收益和风险倍率。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        // number 质量倍率：缺失定义时按 1。
        var qualityMultiplier = qualityDefinition ? qualityDefinition.multiplier : 1;

        if (dispositionId === "bed") {
            return {
                summary: "生成 1 个带 " + (captiveTypeDefinition ? captiveTypeDefinition.name : captive.type) + " 倾向的哥布林",
                inheritedTraitChance: Math.min(0.8, 0.25 * qualityMultiplier),
                escapeRisk: qualityDefinition ? qualityDefinition.escapeRisk : 0.1,
                retaliationRisk: qualityDefinition ? qualityDefinition.retaliationRisk : 0.05
            };
        }

        if (dispositionId === "modify") {
            return {
                summary: "获得临时专家线索或粗识 +" + Math.round(25 * qualityMultiplier),
                failureRisk: Math.min(0.5, 0.1 * qualityMultiplier),
                escapeRisk: qualityDefinition ? qualityDefinition.escapeRisk : 0.1,
                retaliationRisk: qualityDefinition ? qualityDefinition.retaliationRisk : 0.05
            };
        }

        return {
            summary: "菌菇 +" + Math.round(40 * qualityMultiplier) + "，服从波动 -2 到 +4",
            fungusGain: Math.round(40 * qualityMultiplier),
            obedienceSwing: "[-2, +4]",
            retaliationRisk: qualityDefinition ? qualityDefinition.retaliationRisk + 0.05 : 0.1
        };
    }

    /**
     * 执行俘虏处置。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} captiveId - 俘虏稳定 ID。
     * @param {"bed"|"modify"|"food"} dispositionId - 处置方式 ID。
     * @returns {boolean} 是否执行成功；true 表示俘虏已被移除并应用收益。
     */
    function applyDisposition(state, captiveId, dispositionId) {
        if (state.isPaused) {
            return false;
        }

        // number 俘虏索引：用于从数组中删除已处置俘虏。
        var captiveIndex = findCaptiveIndex(state, captiveId);

        if (captiveIndex < 0) {
            return false;
        }

        // CaptiveState 当前俘虏：用于计算处置结果。
        var captive = state.captives[captiveIndex];

        if (dispositionId === "bed") {
            breedGoblinFromCaptive(state, captive);
        } else if (dispositionId === "modify") {
            applyModifyReward(state, captive);
        } else {
            applyFoodReward(state, captive);
        }

        state.captives.splice(captiveIndex, 1);
        syncCaptiveResource(state);
        return true;
    }

    /**
     * 同步俘虏资源投影。
     *
     * @param {GameState} state - 当前游戏状态对象，会更新 captive 资源数量和可见性。
     * @returns {void} 无返回值。
     */
    function syncCaptiveResource(state) {
        // ResourceState|null 俘虏资源状态：仅作为资源栏投影，权威数据仍是 state.captives。
        var captiveResourceState = state.resourcesById.captive || null;

        if (!captiveResourceState) {
            return;
        }

        captiveResourceState.value = state.captives.length;
        captiveResourceState.maxValue = Math.max(captiveResourceState.maxValue || 0, state.captives.length);
        captiveResourceState.isVisible = captiveResourceState.isVisible || state.captives.length > 0;
        captiveResourceState.perSecond = 0;
    }

    /**
     * 用俘虏苗床繁衍哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，会新增哥布林对象。
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {Goblin} 新增哥布林对象。
     */
    function breedGoblinFromCaptive(state, captive) {
        // CaptiveTypeDefinition|null 俘虏类型定义：用于应用属性和技能倾向。
        var captiveTypeDefinition = getCaptiveTypeDefinition(captive.type);

        // CaptiveQualityDefinition|null 质量定义：用于计算初始技能倍率。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        // Goblin 新生哥布林：来源标记为 captive_bed。
        var newGoblin = game.population.createGoblin(state, "captive_bed");

        if (captiveTypeDefinition) {
            applyCaptiveBiasToGoblin(newGoblin, captiveTypeDefinition, qualityDefinition ? qualityDefinition.multiplier : 1);
        }

        state.goblins.push(newGoblin);
        game.simulation.addLog(state, "important", "俘虏苗床产出新哥布林：" + newGoblin.name + "。");
        return newGoblin;
    }

    /**
     * 应用俘虏倾向到新哥布林。
     *
     * @param {Goblin} goblin - 新生哥布林对象，会被直接修改。
     * @param {CaptiveTypeDefinition} captiveTypeDefinition - 俘虏类型定义对象。
     * @param {number} qualityMultiplier - 质量倍率，正数。
     * @returns {void} 无返回值。
     */
    function applyCaptiveBiasToGoblin(goblin, captiveTypeDefinition, qualityMultiplier) {
        // string[] 属性 ID 数组：用于遍历属性偏向字典。
        var attributeIds = Object.keys(captiveTypeDefinition.attributeBias);

        // number 属性循环索引：遍历属性 ID 数组的整数下标。
        for (var attributeIndex = 0; attributeIndex < attributeIds.length; attributeIndex += 1) {
            // string 当前属性 ID：用于写入属性加成。
            var attributeId = attributeIds[attributeIndex];

            goblin.attributes[attributeId] = Math.min(10, Math.max(1, goblin.attributes[attributeId] + captiveTypeDefinition.attributeBias[attributeId]));
        }

        // string[] 技能 ID 数组：用于遍历初始技能偏向。
        var skillIds = Object.keys(captiveTypeDefinition.skillBias);

        // number 技能循环索引：遍历技能 ID 数组的整数下标。
        for (var skillIndex = 0; skillIndex < skillIds.length; skillIndex += 1) {
            // string 当前技能 ID：用于写入初始经验。
            var skillId = skillIds[skillIndex];

            goblin.skills[skillId] = captiveTypeDefinition.skillBias[skillId] * qualityMultiplier;
        }

        goblin.traits.push(captiveTypeDefinition.traitHint);
    }

    /**
     * 应用洗脑改造收益。
     *
     * @param {GameState} state - 当前游戏状态对象，会增加粗识。
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function applyModifyReward(state, captive) {
        // CaptiveQualityDefinition|null 质量定义：用于收益倍率。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        // number 洗脑建筑倍率：洗脑棚提高改造能转化出的粗识线索。
        var buildingRatio = getCaptiveBuildingEffectTotal(state, "captiveModifyKnowledgeRatio");

        game.resources.addResource(state, "crudeKnowledge", 25 * (qualityDefinition ? qualityDefinition.multiplier : 1) * (1 + buildingRatio));
        game.simulation.addLog(state, "normal", "洗脑改造完成，获得粗识线索。");
    }

    /**
     * 汇总俘虏相关建筑效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} effectId - 建筑效果 ID。
     * @returns {number} 建筑效果累计值，有符号浮点数。
     */
    function getCaptiveBuildingEffectTotal(state, effectId) {
        // number 效果总值：每座建筑按拥有数累加。
        var effectTotal = 0;

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取拥有数。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (buildingState && buildingDefinition.effects[effectId]) {
                effectTotal += buildingState.owned * buildingDefinition.effects[effectId];
            }
        }

        return effectTotal;
    }

    /**
     * 应用做成食物收益。
     *
     * @param {GameState} state - 当前游戏状态对象，会增加菌菇。
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function applyFoodReward(state, captive) {
        // CaptiveQualityDefinition|null 质量定义：用于收益倍率。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        game.resources.addResource(state, "fungus", 40 * (qualityDefinition ? qualityDefinition.multiplier : 1));
        game.simulation.addLog(state, "warning", "俘虏被做成食物，菌菇增加但外交风险上升。");
    }

    /**
     * 查找俘虏数组索引。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} captiveId - 俘虏稳定 ID。
     * @returns {number} 俘虏数组索引；未找到时返回 -1。
     */
    function findCaptiveIndex(state, captiveId) {
        // number 循环索引：遍历俘虏数组的整数下标。
        for (var captiveIndex = 0; captiveIndex < state.captives.length; captiveIndex += 1) {
            // CaptiveState 当前俘虏：用于匹配稳定 ID。
            var captive = state.captives[captiveIndex];

            if (captive.id === captiveId) {
                return captiveIndex;
            }
        }

        return -1;
    }

    // Object 俘虏系统命名空间：提供俘虏创建、预览和处置函数。
    game.captivesSystem = {
        createCaptive: createCaptive,
        getCaptiveTypeDefinition: getCaptiveTypeDefinition,
        getCaptiveQualityDefinition: getCaptiveQualityDefinition,
        previewDisposition: previewDisposition,
        applyDisposition: applyDisposition,
        breedGoblinFromCaptive: breedGoblinFromCaptive,
        syncCaptiveResource: syncCaptiveResource
    };
})(window.GoblinEmpire);
