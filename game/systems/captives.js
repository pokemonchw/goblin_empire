/* 俘虏系统：负责俘虏预览、处置和苗床繁衍入口。 */
/**
 * 初始化俘虏系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 captives 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 苗床孕育时长：一个哥布林历月份，单位模拟秒。
    var CAPTIVE_GESTATION_SECONDS = 30 * game.calendar.getSecondsPerDay();

    // number 苗床休养时长：一次孕育结束后的一个哥布林历月份，单位模拟秒。
    var CAPTIVE_REST_SECONDS = 30 * game.calendar.getSecondsPerDay();

    // string[] 俘虏名池：生成后写入 CaptiveState.name，避免列表中同类俘虏无法区分。
    var CAPTIVE_NAME_POOL = [
        "阿苔",
        "莉莎",
        "玛拉",
        "薇恩",
        "艾娜",
        "塔妮",
        "露芙",
        "贝芮",
        "伊柯",
        "诺拉",
        "茜尔",
        "朵琳",
        "米娅",
        "拉蔻",
        "萨缇",
        "芙洛"
    ];

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
            name: createCaptiveName(captiveTypeId),
            type: captiveTypeId,
            quality: qualityId,
            source: source,
            traitHint: captiveTypeDefinition ? captiveTypeDefinition.traitHint : "basic",
            turnsHeld: 0,
            disposition: undefined,
            brainwashLevel: 0,
            breedingState: "idle",
            gestationSecondsRemaining: 0,
            restSecondsRemaining: 0
        };
    }

    /**
     * 创建俘虏姓名。
     *
     * @param {string} captiveTypeId - 俘虏类型稳定 ID，用于让同一随机位点在不同类型间略有错位。
     * @returns {string} 俘虏中文姓名。
     */
    function createCaptiveName(captiveTypeId) {
        // number 随机索引：从姓名池中选择基础名，非负整数下标。
        var nameIndex = Math.floor(Math.random() * CAPTIVE_NAME_POOL.length);

        // number 类型偏移：同一时间连续生成不同类型时降低重名概率，非负整数。
        var typeOffset = captiveTypeId ? captiveTypeId.length : 0;

        return CAPTIVE_NAME_POOL[(nameIndex + typeOffset) % CAPTIVE_NAME_POOL.length];
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

        // number 洗脑程度：0-1 浮点比例，用于影响孕育失败率和新生属性。
        var brainwashRatio = getCaptiveBrainwashRatio(captive);

        if (dispositionId === "bed") {
            return {
                summary: "开始一个月孕育，可能生成 1 个带 " + (captiveTypeDefinition ? captiveTypeDefinition.name : captive.type) + " 倾向的新生",
                gestationMonths: 1,
                restMonths: 1,
                failureRisk: calculateBreedingFailureRisk(captive),
                brainwashLevel: Math.round(brainwashRatio * 100),
                attributeBonus: calculateBrainwashAttributeBonus(captive),
                inheritedTraitChance: Math.min(0.8, 0.25 * qualityMultiplier),
                escapeRisk: qualityDefinition ? qualityDefinition.escapeRisk : 0.1,
                retaliationRisk: qualityDefinition ? qualityDefinition.retaliationRisk : 0.05
            };
        }

        if (dispositionId === "modify") {
            return {
                summary: "洗脑程度 +" + calculateBrainwashGain(captive, 0) + "，粗识 +" + Math.round(10 * qualityMultiplier),
                brainwashGain: calculateBrainwashGain(captive, 0),
                brainwashLevel: Math.round(brainwashRatio * 100),
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
     * @returns {boolean} 是否执行成功；true 表示已应用收益；培育和洗脑会保留俘虏，食物会移除俘虏。
     */
    function applyDisposition(state, captiveId, dispositionId) {
        if (state.isPaused) {
            return false;
        }

        // number 俘虏索引：用于定位要处置的俘虏；消耗型处置会按该索引删除。
        var captiveIndex = findCaptiveIndex(state, captiveId);

        if (captiveIndex < 0) {
            return false;
        }

        // CaptiveState 当前俘虏：用于计算处置结果。
        var captive = state.captives[captiveIndex];

        if (!canApplyDisposition(captive, dispositionId)) {
            return false;
        }

        if (dispositionId === "bed") {
            // string 处置状态：标记该俘虏已作为苗床使用，后续可在休养完成后重复培育。
            captive.disposition = "bed";
            startCaptiveGestation(state, captive);
        } else {
            if (dispositionId === "modify") {
                applyModifyReward(state, captive);
            } else {
                applyFoodReward(state, captive);
                state.captives.splice(captiveIndex, 1);
            }
        }

        syncCaptiveResource(state);
        return true;
    }

    /**
     * 判断俘虏当前是否可以执行指定处置。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @param {"bed"|"modify"|"food"} dispositionId - 处置方式 ID。
     * @returns {boolean} 是否可以执行；true 表示按钮可生效。
     */
    function canApplyDisposition(captive, dispositionId) {
        // string 繁育状态：idle 可操作，gestating/resting 会锁定培育和处置。
        var breedingState = captive.breedingState || "idle";

        if (breedingState !== "idle") {
            return false;
        }

        return dispositionId === "bed" || dispositionId === "modify" || dispositionId === "food";
    }

    /**
     * 启动俘虏苗床孕育。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入俘虏孕育状态并追加日志。
     * @param {CaptiveState} captive - 俘虏运行时对象，会被直接修改。
     * @returns {void} 无返回值。
     */
    function startCaptiveGestation(state, captive) {
        captive.breedingState = "gestating";
        captive.gestationSecondsRemaining = CAPTIVE_GESTATION_SECONDS;
        captive.restSecondsRemaining = 0;
        game.simulation.addLog(state, "normal", "苗床开始培育新生，需要一个月孕育。");
    }

    /**
     * 推进所有俘虏苗床的孕育和休养倒计时。
     *
     * @param {GameState} state - 当前游戏状态对象，会更新俘虏繁育状态并可能新增哥布林。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点秒。
     * @returns {void} 无返回值。
     */
    function updateCaptives(state, deltaSeconds) {
        // number 有效推进秒数：暂停时主循环不会调用，此处仍防御负数输入。
        var safeDeltaSeconds = Math.max(0, deltaSeconds);

        // number 循环索引：遍历俘虏数组的整数下标。
        for (var captiveIndex = 0; captiveIndex < state.captives.length; captiveIndex += 1) {
            // CaptiveState 当前俘虏：用于推进孕育或休养倒计时。
            var captive = state.captives[captiveIndex];

            updateCaptiveBreedingState(state, captive, safeDeltaSeconds);
        }
    }

    /**
     * 推进单个俘虏苗床的孕育或休养状态。
     *
     * @param {GameState} state - 当前游戏状态对象，孕育成功时会新增哥布林。
     * @param {CaptiveState} captive - 俘虏运行时对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点秒。
     * @returns {void} 无返回值。
     */
    function updateCaptiveBreedingState(state, captive, deltaSeconds) {
        if (captive.breedingState === "gestating") {
            captive.gestationSecondsRemaining = Math.max(0, (Number(captive.gestationSecondsRemaining) || 0) - deltaSeconds);

            if (captive.gestationSecondsRemaining <= 0) {
                resolveCaptiveGestation(state, captive);
            }
        } else if (captive.breedingState === "resting") {
            captive.restSecondsRemaining = Math.max(0, (Number(captive.restSecondsRemaining) || 0) - deltaSeconds);

            if (captive.restSecondsRemaining <= 0) {
                captive.breedingState = "idle";
                captive.restSecondsRemaining = 0;
                game.simulation.addLog(state, "normal", "苗床休养完成，可以再次培育新生。");
            }
        }
    }

    /**
     * 结算一次苗床孕育。
     *
     * @param {GameState} state - 当前游戏状态对象，成功时会新增哥布林并写日志。
     * @param {CaptiveState} captive - 俘虏运行时对象，会进入休养状态。
     * @returns {void} 无返回值。
     */
    function resolveCaptiveGestation(state, captive) {
        // number 失败概率：0-1 浮点比例，洗脑程度越高失败概率越低。
        var failureRisk = calculateBreedingFailureRisk(captive);

        // number 随机掷骰：0-1 浮点比例，用于本次孕育成败判定。
        var failureRoll = Math.random();

        if (failureRoll >= failureRisk) {
            breedGoblinFromCaptive(state, captive);
        } else {
            game.simulation.addLog(state, "warning", "苗床孕育失败，仍需一个月休养。");
        }

        captive.breedingState = "resting";
        captive.gestationSecondsRemaining = 0;
        captive.restSecondsRemaining = CAPTIVE_REST_SECONDS;
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
            applyCaptiveBiasToGoblin(newGoblin, captiveTypeDefinition, qualityDefinition ? qualityDefinition.multiplier : 1, calculateBrainwashAttributeBonus(captive));
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
     * @param {number} brainwashAttributeBonus - 洗脑属性加成，非负整数。
     * @returns {void} 无返回值。
     */
    function applyCaptiveBiasToGoblin(goblin, captiveTypeDefinition, qualityMultiplier, brainwashAttributeBonus) {
        // string[] 属性 ID 数组：用于遍历属性偏向字典。
        var attributeIds = Object.keys(captiveTypeDefinition.attributeBias);

        // number 属性循环索引：遍历属性 ID 数组的整数下标。
        for (var attributeIndex = 0; attributeIndex < attributeIds.length; attributeIndex += 1) {
            // string 当前属性 ID：用于写入属性加成。
            var attributeId = attributeIds[attributeIndex];

            goblin.attributes[attributeId] = Math.min(10, Math.max(1, goblin.attributes[attributeId] + captiveTypeDefinition.attributeBias[attributeId] + brainwashAttributeBonus));
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
     * 计算俘虏洗脑程度比例。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {number} 洗脑程度比例，范围 0-1。
     */
    function getCaptiveBrainwashRatio(captive) {
        return Math.min(1, Math.max(0, (Number(captive.brainwashLevel) || 0) / 100));
    }

    /**
     * 计算苗床孕育失败概率。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {number} 失败概率，范围 0.1-0.45；洗脑程度越高越低。
     */
    function calculateBreedingFailureRisk(captive) {
        // number 洗脑程度比例：0-1 浮点比例，用于压低失败概率。
        var brainwashRatio = getCaptiveBrainwashRatio(captive);

        return Math.max(0.1, 0.45 - brainwashRatio * 0.35);
    }

    /**
     * 计算洗脑带来的新生属性加成。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {number} 属性加成，非负整数；每 25 点洗脑程度增加 1 点倾向属性。
     */
    function calculateBrainwashAttributeBonus(captive) {
        return Math.floor(getCaptiveBrainwashRatio(captive) * 4);
    }

    /**
     * 计算一次洗脑改造提升的洗脑程度。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @param {number} buildingRatio - 洗脑棚效果倍率，非负浮点比例。
     * @returns {number} 洗脑程度提升值，非负整数点。
     */
    function calculateBrainwashGain(captive, buildingRatio) {
        // CaptiveQualityDefinition|null 质量定义：用于让高质量俘虏更难被改造但收益更高。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        // number 质量倍率：缺失定义时按 1。
        var qualityMultiplier = qualityDefinition ? qualityDefinition.multiplier : 1;

        return Math.max(1, Math.round(12 * qualityMultiplier * (1 + Math.max(0, buildingRatio))));
    }

    /**
     * 应用洗脑改造收益。
     *
     * @param {GameState} state - 当前游戏状态对象，会增加粗识并提升俘虏洗脑程度。
     * @param {CaptiveState} captive - 俘虏运行时对象，会被直接修改。
     * @returns {void} 无返回值。
     */
    function applyModifyReward(state, captive) {
        // CaptiveQualityDefinition|null 质量定义：用于收益倍率。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        // number 洗脑建筑倍率：洗脑棚提高改造能转化出的粗识线索。
        var buildingRatio = getCaptiveBuildingEffectTotal(state, "captiveModifyKnowledgeRatio");

        // number 洗脑提升值：本次改造增加的洗脑程度点数。
        var brainwashGain = calculateBrainwashGain(captive, buildingRatio);

        captive.brainwashLevel = Math.min(100, (Number(captive.brainwashLevel) || 0) + brainwashGain);
        game.resources.addResource(state, "crudeKnowledge", 10 * (qualityDefinition ? qualityDefinition.multiplier : 1) * (1 + buildingRatio));
        game.simulation.addLog(state, "normal", "洗脑改造完成，苗床洗脑程度提升到 " + Math.round(captive.brainwashLevel) + "%。");
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
        createCaptiveName: createCaptiveName,
        getCaptiveTypeDefinition: getCaptiveTypeDefinition,
        getCaptiveQualityDefinition: getCaptiveQualityDefinition,
        previewDisposition: previewDisposition,
        applyDisposition: applyDisposition,
        canApplyDisposition: canApplyDisposition,
        updateCaptives: updateCaptives,
        breedGoblinFromCaptive: breedGoblinFromCaptive,
        syncCaptiveResource: syncCaptiveResource
    };
})(window.GoblinEmpire);
