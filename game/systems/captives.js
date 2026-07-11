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

    // number 培育成功洗脑保留倍率：成功产出新生后保留当前洗脑程度的 50%，0-1 浮点比例。
    var CAPTIVE_BREEDING_SUCCESS_BRAINWASH_RATIO = 0.5;

    // number 培育失败洗脑保留倍率：失败后只保留当前洗脑程度的 10%，0-1 浮点比例。
    var CAPTIVE_BREEDING_FAILURE_BRAINWASH_RATIO = 0.1;

    // Price[] 洗脑固定价格：每次洗脑改造固定消耗 100 菌菇。
    var CAPTIVE_BRAINWASH_PRICE = [
        {
            resource: "fungus",
            amount: 100
        }
    ];

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
        "芙洛",
        "阿麦",
        "黑榛",
        "小芦",
        "谷娘",
        "铜铃",
        "井月",
        "雪荞",
        "红栗",
        "石楠",
        "晚枝",
        "阿葵",
        "盐雀",
        "青穗",
        "棘花",
        "泥笛",
        "灯草",
        "白砾",
        "雾茶",
        "短弓",
        "碎银",
        "罗珊",
        "卡蜜尔",
        "塞琳",
        "尤朵拉",
        "薇洛妮",
        "安菲",
        "黛西娅",
        "海伦娜",
        "帕梅拉",
        "米蕾",
        "奥莉薇",
        "珂赛特",
        "芮妮",
        "塔莉亚",
        "朱莉安",
        "伊莎贝",
        "玛蒂尔",
        "洛蕾塔",
        "妮可拉",
        "贝阿特",
        "沈银灯",
        "林鸦",
        "罗织",
        "许砂",
        "白鹿纹",
        "钟落雨",
        "陈墨",
        "柳薄荷",
        "秦砚",
        "苏苇",
        "乔火绒",
        "唐碎玉",
        "顾青盐",
        "叶暮",
        "孟枯荷",
        "方冷泉",
        "陆灰衣",
        "韩细雪",
        "岑乌",
        "谢灯",
        "修女鸢",
        "灰烛",
        "圣痕薇",
        "祈铃",
        "苦泉",
        "白祷",
        "墓百合",
        "夜弥撒",
        "鸦羽",
        "寒星",
        "寂音",
        "净骨",
        "烬玫",
        "蓝经",
        "月祷",
        "银忏",
        "雾冠",
        "低语",
        "断钟",
        "矿疤",
        "煤眼",
        "铁雀",
        "赤腕",
        "铅花",
        "锈斧",
        "炉心",
        "黑炭",
        "砧月",
        "渣星",
        "铜牙",
        "岩蜜",
        "焦藤",
        "镐影",
        "裂掌",
        "灰砧",
        "硫香",
        "砂喉",
        "铁苔",
        "旧螺",
        "霜荆"
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
            gestationWeatherId: undefined,
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
     * @param {GameState=} state - 当前游戏状态对象；提供时会计入天气和建筑修正。
     * @returns {Object.<string, string|number>} 预览对象；包含收益、继承概率、逃脱风险和报复风险。
     */
    function previewDisposition(captive, dispositionId, state) {
        // CaptiveTypeDefinition|null 俘虏类型定义：用于读取倾向和技能偏向。
        var captiveTypeDefinition = getCaptiveTypeDefinition(captive.type);

        // CaptiveQualityDefinition|null 质量定义：用于收益和风险倍率。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        // number 质量倍率：缺失定义时按 1。
        var qualityMultiplier = qualityDefinition ? qualityDefinition.multiplier : 1;

        // number 洗脑程度：0-1 浮点比例，用于影响孕育失败率和新生属性。
        var brainwashRatio = getCaptiveBrainwashRatio(captive);

        // Price[] 洗脑价格：提供状态时会计入欲风等天气修正。
        var brainwashPrice = calculateBrainwashPrice(state);

        // number 洗脑建筑倍率：提供状态时会计入洗脑棚收益。
        var buildingRatio = state ? getCaptiveBuildingEffectTotal(state, "captiveModifyKnowledgeRatio") : 0;

        // Object.<string, number> 俘虏天气效果：提供状态时读取当前天气或孕育天气。
        var captiveWeatherEffects = getCaptiveWeatherEffects(state, captive);

        if (dispositionId === "bed") {
            return {
                summary: "开始一个月孕育，可能生成 1 个带 " + (captiveTypeDefinition ? captiveTypeDefinition.name : captive.type) + " 倾向的新生；洗脑为 0 时不可培育，结算后洗脑会衰减",
                gestationMonths: 1,
                restMonths: 1,
                failureRisk: calculateBreedingFailureRisk(captive, state),
                brainwashLevel: Math.round(brainwashRatio * 100),
                attributeBonus: calculateBrainwashAttributeBonus(captive),
                attributePenalty: captiveWeatherEffects.captiveNewbornAttributePenalty || 0,
                inheritedTraitChance: Math.min(0.8, 0.25 * qualityMultiplier),
                escapeRisk: qualityDefinition ? qualityDefinition.escapeRisk : 0.1,
                retaliationRisk: qualityDefinition ? qualityDefinition.retaliationRisk : 0.05
            };
        }

        if (dispositionId === "modify") {
            return {
                summary: "消耗 " + brainwashPrice[0].amount + " 菌菇，洗脑程度 +" + calculateBrainwashGain(captive, buildingRatio, state) + "，粗识 +" + Math.round(10 * qualityMultiplier * (1 + buildingRatio)),
                brainwashCost: brainwashPrice[0].amount,
                brainwashGain: calculateBrainwashGain(captive, buildingRatio, state),
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

        if (!canApplyDisposition(null, captive, dispositionId)) {
            return false;
        }

        if (dispositionId === "bed") {
            // string 处置状态：标记该俘虏已作为苗床使用，后续可在休养完成后重复培育。
            captive.disposition = "bed";
            startCaptiveGestation(state, captive);
        } else {
            if (dispositionId === "modify") {
                if (!game.resources.spendResources(state, calculateBrainwashPrice(state))) {
                    return false;
                }

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
     * @param {GameState|null} state - 当前游戏状态对象；传入 null 时只检查俘虏自身状态，不检查资源库存。
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @param {"bed"|"modify"|"food"} dispositionId - 处置方式 ID。
     * @returns {boolean} 是否可以执行；true 表示按钮可生效。
     */
    function canApplyDisposition(state, captive, dispositionId) {
        // string 繁育状态：gestating 锁定所有处置，resting 只锁定再次培育。
        var breedingState = captive.breedingState || "idle";

        if (breedingState === "gestating") {
            return false;
        }

        if (dispositionId === "bed") {
            return breedingState === "idle" && getCaptiveBrainwashRatio(captive) > 0;
        }

        if (dispositionId === "modify") {
            // boolean 洗脑是否未满：true 表示洗脑程度低于 100%，仍允许继续改造。
            var isBrainwashIncomplete = getCaptiveBrainwashRatio(captive) < 1;

            return isBrainwashIncomplete && (!state || game.resources.canAfford(state, calculateBrainwashPrice(state)));
        }

        return dispositionId === "food";
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
        captive.gestationWeatherId = game.weather ? game.weather.getCurrentWeatherDefinition(state).id : undefined;
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
                game.simulation.addLog(state, "normal", "苗床休养完成，洗脑程度足够时可以再次培育新生。");
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
        var failureRisk = calculateBreedingFailureRisk(captive, state);

        // number 随机掷骰：0-1 浮点比例，用于本次孕育成败判定。
        var failureRoll = Math.random();

        if (failureRoll >= failureRisk) {
            breedGoblinFromCaptive(state, captive);
            applyBreedingBrainwashDecay(captive, CAPTIVE_BREEDING_SUCCESS_BRAINWASH_RATIO);
        } else {
            applyBreedingBrainwashDecay(captive, CAPTIVE_BREEDING_FAILURE_BRAINWASH_RATIO);
            game.simulation.addLog(state, "warning", "苗床孕育失败，仍需一个月休养。");
        }

        captive.gestationWeatherId = undefined;
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
            applyCaptiveBiasToGoblin(newGoblin, captiveTypeDefinition, qualityDefinition ? qualityDefinition.multiplier : 1, calculateBrainwashAttributeBonus(captive), getCaptiveNewbornAttributePenalty(state, captive));
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
     * @param {number} attributePenalty - 新生属性惩罚，非负整数。
     * @returns {void} 无返回值。
     */
    function applyCaptiveBiasToGoblin(goblin, captiveTypeDefinition, qualityMultiplier, brainwashAttributeBonus, attributePenalty) {
        // number 新生属性惩罚：欲风等天气会让这次苗床新生更虚弱。
        var safeAttributePenalty = Math.max(0, Math.floor(Number(attributePenalty) || 0));

        applyNewbornAttributePenalty(goblin, safeAttributePenalty);

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
     * @param {GameState=} state - 当前游戏状态对象；提供时会计入当前或孕育开始天气。
     * @returns {number} 失败概率，范围 0.1-0.45；洗脑程度越高越低。
     */
    function calculateBreedingFailureRisk(captive, state) {
        // number 洗脑程度比例：0-1 浮点比例，用于压低失败概率。
        var brainwashRatio = getCaptiveBrainwashRatio(captive);

        // Object.<string, number> 俘虏天气效果：欲风会降低本次孕育失败概率。
        var captiveWeatherEffects = getCaptiveWeatherEffects(state, captive);

        // number 基础失败概率：范围 0.1-0.45，洗脑程度越高失败概率越低。
        var baseFailureRisk = Math.max(0.1, 0.45 - brainwashRatio * 0.35);

        return Math.max(0.05, Math.min(0.95, baseFailureRisk * (1 + (captiveWeatherEffects.captiveBreedingFailureRiskRatio || 0))));
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
     * 应用苗床结算后的洗脑衰减。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，会被直接修改。
     * @param {number} remainingRatio - 洗脑保留倍率，0-1 浮点比例；成功保留 50%，失败保留 10%。
     * @returns {void} 无返回值。
     */
    function applyBreedingBrainwashDecay(captive, remainingRatio) {
        // number 当前洗脑程度：结算前的洗脑程度点数，范围 0-100。
        var currentBrainwashLevel = Math.min(100, Math.max(0, Number(captive.brainwashLevel) || 0));

        // number 洗脑保留倍率：防御异常输入，范围 0-1。
        var safeRemainingRatio = Math.min(1, Math.max(0, remainingRatio));

        captive.brainwashLevel = Math.round(currentBrainwashLevel * safeRemainingRatio);
    }

    /**
     * 计算一次洗脑改造提升的洗脑程度。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @param {number} buildingRatio - 洗脑棚效果倍率，非负浮点比例。
     * @param {GameState=} state - 当前游戏状态对象；提供时会计入当前天气。
     * @returns {number} 洗脑程度提升值，非负整数点。
     */
    function calculateBrainwashGain(captive, buildingRatio, state) {
        // CaptiveQualityDefinition|null 质量定义：用于让高质量俘虏更难被改造但收益更高。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        // number 质量倍率：缺失定义时按 1。
        var qualityMultiplier = qualityDefinition ? qualityDefinition.multiplier : 1;

        // Object.<string, number> 俘虏天气效果：欲风会提高洗脑提升。
        var captiveWeatherEffects = getCaptiveWeatherEffects(state, captive);

        return Math.max(1, Math.round(12 * qualityMultiplier * (1 + Math.max(0, buildingRatio)) * (1 + (captiveWeatherEffects.captiveBrainwashGainRatio || 0))));
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
        var brainwashGain = calculateBrainwashGain(captive, buildingRatio, state);

        captive.brainwashLevel = Math.min(100, (Number(captive.brainwashLevel) || 0) + brainwashGain);
        game.resources.addResource(state, "crudeKnowledge", 10 * (qualityDefinition ? qualityDefinition.multiplier : 1) * (1 + buildingRatio));
        game.simulation.addLog(state, "normal", "洗脑改造完成，苗床洗脑程度提升到 " + Math.round(captive.brainwashLevel) + "%。");
    }

    /**
     * 计算一次洗脑改造的实际价格。
     *
     * @param {GameState=} state - 当前游戏状态对象；提供时会计入当前天气。
     * @returns {Price[]} 洗脑价格数组；amount 为非负资源数量。
     */
    function calculateBrainwashPrice(state) {
        // Object.<string, number> 俘虏天气效果：欲风会降低洗脑消耗。
        var captiveWeatherEffects = getCaptiveWeatherEffects(state, null);

        // number 洗脑价格倍率：最低为 0，避免负数消耗。
        var priceMultiplier = Math.max(0, 1 + (captiveWeatherEffects.captiveBrainwashCostRatio || 0));

        return [
            {
                resource: CAPTIVE_BRAINWASH_PRICE[0].resource,
                amount: CAPTIVE_BRAINWASH_PRICE[0].amount * priceMultiplier
            }
        ];
    }

    /**
     * 读取俘虏相关天气效果。
     *
     * @param {GameState=} state - 当前游戏状态对象；缺失时返回空效果。
     * @param {CaptiveState|null=} captive - 俘虏状态；孕育中优先读取开始孕育时天气。
     * @returns {Object.<string, number>} 天气效果字典；key 为俘虏效果 ID。
     */
    function getCaptiveWeatherEffects(state, captive) {
        if (!state || !game.weather) {
            return {};
        }

        // string|null 孕育天气 ID：用于让一次孕育从开始到结算保持同一天气修正。
        var gestationWeatherId = captive && captive.gestationWeatherId ? captive.gestationWeatherId : null;

        if (gestationWeatherId) {
            // WeatherDefinition|null 孕育天气定义：读取开始孕育时锁定的天气。
            var gestationWeatherDefinition = game.weather.getWeatherDefinition(gestationWeatherId);

            return gestationWeatherDefinition ? gestationWeatherDefinition.effects : {};
        }

        return game.weather.getWeatherEffects(state);
    }

    /**
     * 取得新生属性惩罚。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {number} 新生属性惩罚，非负整数点。
     */
    function getCaptiveNewbornAttributePenalty(state, captive) {
        // Object.<string, number> 俘虏天气效果：欲风会降低这次新生属性。
        var captiveWeatherEffects = getCaptiveWeatherEffects(state, captive);

        return Math.max(0, Math.floor(Number(captiveWeatherEffects.captiveNewbornAttributePenalty) || 0));
    }

    /**
     * 对新生哥布林应用全属性惩罚。
     *
     * @param {Goblin} goblin - 新生哥布林对象，会被直接修改。
     * @param {number} attributePenalty - 属性惩罚，非负整数点。
     * @returns {void} 无返回值。
     */
    function applyNewbornAttributePenalty(goblin, attributePenalty) {
        if (attributePenalty <= 0) {
            return;
        }

        // string[] 属性 ID 数组：遍历新生哥布林六项属性。
        var attributeIds = Object.keys(goblin.attributes);

        // number 循环索引：遍历属性 ID 数组的整数下标。
        for (var attributeIndex = 0; attributeIndex < attributeIds.length; attributeIndex += 1) {
            // string 当前属性 ID：用于写回被天气削弱后的属性。
            var attributeId = attributeIds[attributeIndex];

            goblin.attributes[attributeId] = Math.max(1, goblin.attributes[attributeId] - attributePenalty);
        }
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
