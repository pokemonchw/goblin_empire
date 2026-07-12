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
            age: 0,
            baseLifespanMonths: game.definitions.POPULATION_CONSTANTS.baseCaptiveLifespanMonths,
            technologyLifespanMonths: 0,
            eventLifespanMonths: 0,
            elderDeathCheckCount: 0,
            turnsHeld: 0,
            disposition: undefined,
            brainwashLevel: 0,
            isAutoBrainwashEnabled: false,
            isAutoBreedEnabled: false,
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

        if (safeDeltaSeconds > 0) {
            applyAutoBreedingIfNeeded(state);
        }

        // number 循环索引：遍历俘虏数组的整数下标。
        for (var captiveIndex = 0; captiveIndex < state.captives.length; captiveIndex += 1) {
            // CaptiveState 当前俘虏：用于推进孕育或休养倒计时。
            var captive = state.captives[captiveIndex];

            normalizeCaptiveLifespanFields(state, captive);
            if (safeDeltaSeconds > 0) {
                applyAutoBrainwashIfNeeded(state, captive);
            }
            updateCaptiveBreedingState(state, captive, safeDeltaSeconds);
        }
    }

    /**
     * 按跨过的月初推进俘虏年龄并检查老死。
     *
     * @param {GameState} state - 当前游戏状态对象，会更新俘虏年龄并移除老死俘虏。
     * @param {number} previousElapsedDays - 本次日期推进前的完整游戏日，非负整数天。
     * @param {number} currentElapsedDays - 本次日期推进后的完整游戏日，非负整数天。
     * @returns {void} 无返回值。
     */
    function updateMonthlyCaptiveAgingAndLifespan(state, previousElapsedDays, currentElapsedDays) {
        // number 上次月份序号：每 30 天递增 1，代表已越过的月初数量。
        var previousMonthSerial = Math.floor(Math.max(0, Number(previousElapsedDays) || 0) / 30);

        // number 当前月份序号：每 30 天递增 1，代表当前已越过的月初数量。
        var currentMonthSerial = Math.floor(Math.max(0, Number(currentElapsedDays) || 0) / 30);

        if (currentMonthSerial <= previousMonthSerial) {
            return;
        }

        // number 月份序号：逐月结算，避免长时间离线时跳过老死骰。
        for (var monthSerial = previousMonthSerial + 1; monthSerial <= currentMonthSerial; monthSerial += 1) {
            applyOneMonthCaptiveAging(state);
        }
    }

    /**
     * 结算一个月初的俘虏年龄增长和老死骰。
     *
     * @param {GameState} state - 当前游戏状态对象，会直接修改俘虏数组。
     * @returns {void} 无返回值。
     */
    function applyOneMonthCaptiveAging(state) {
        // string[] 老死俘虏姓名数组：用于合并日志。
        var elderDeadCaptiveNames = [];

        // number 倒序循环索引：遍历俘虏数组并允许安全删除。
        for (var captiveIndex = state.captives.length - 1; captiveIndex >= 0; captiveIndex -= 1) {
            // CaptiveState 当前俘虏对象：用于年龄增长和寿命检查。
            var captive = state.captives[captiveIndex];

            normalizeCaptiveLifespanFields(state, captive);
            captive.age = Math.max(0, Math.floor(Number(captive.age) || 0)) + 1;

            if (shouldCaptiveDieOfOldAge(captive)) {
                elderDeadCaptiveNames.push(captive.name || captive.id);
                state.captives.splice(captiveIndex, 1);
            }
        }

        if (elderDeadCaptiveNames.length > 0) {
            state.statistics.totalCaptiveOldAgeDeaths = (state.statistics.totalCaptiveOldAgeDeaths || 0) + elderDeadCaptiveNames.length;
            game.simulation.addLog(state, "important", "月初清点囚笼时，俘虏 " + elderDeadCaptiveNames.reverse().join("、") + " 老死了。");
            syncCaptiveResource(state);
        }
    }

    /**
     * 判断俘虏本月是否老死。
     *
     * @param {CaptiveState} captive - 当前俘虏对象，会在未死亡时增加老死检查次数。
     * @returns {boolean} 是否老死；true 表示本月应从俘虏列表移除。
     */
    function shouldCaptiveDieOfOldAge(captive) {
        // number 总寿命：寿命各组成部分相加后的游戏月数。
        var totalLifespanMonths = calculateCaptiveTotalLifespanMonths(captive);

        if (captive.age < totalLifespanMonths) {
            captive.elderDeathCheckCount = 0;
            return false;
        }

        // number 已检查次数：达到寿命后每月未死会让下月概率提高。
        var elderDeathCheckCount = Math.max(0, Math.floor(Number(captive.elderDeathCheckCount) || 0));

        // number 老死概率：首次 10%，每月递增 10%，最高 100%。
        var deathChance = Math.min(1, game.definitions.POPULATION_CONSTANTS.elderDeathBaseChance + elderDeathCheckCount * game.definitions.POPULATION_CONSTANTS.elderDeathChanceIncreasePerMonth);

        // number 随机骰：0-1 浮点比例，低于概率时死亡。
        var deathRoll = Math.random();

        if (deathRoll < deathChance) {
            return true;
        }

        captive.elderDeathCheckCount = elderDeathCheckCount + 1;
        return false;
    }

    /**
     * 补齐俘虏寿命字段。
     *
     * @param {GameState} state - 当前游戏状态对象，用于读取科技寿命加成。
     * @param {CaptiveState} captive - 俘虏对象，会被补齐寿命字段。
     * @returns {void} 无返回值。
     */
    function normalizeCaptiveLifespanFields(state, captive) {
        if (typeof captive.age !== "number") {
            captive.age = 0;
        }
        if (typeof captive.baseLifespanMonths !== "number") {
            captive.baseLifespanMonths = game.definitions.POPULATION_CONSTANTS.baseCaptiveLifespanMonths;
        }
        captive.technologyLifespanMonths = game.population.calculateTechnologyLifespanBonusMonths(state);
        if (typeof captive.eventLifespanMonths !== "number") {
            captive.eventLifespanMonths = 0;
        }
        if (typeof captive.elderDeathCheckCount !== "number") {
            captive.elderDeathCheckCount = 0;
        }
        if (Math.max(0, Math.floor(Number(captive.age) || 0)) < calculateCaptiveTotalLifespanMonths(captive)) {
            captive.elderDeathCheckCount = 0;
        }
    }

    /**
     * 计算俘虏总寿命。
     *
     * @param {CaptiveState} captive - 俘虏对象，不会被修改。
     * @returns {number} 总寿命，单位游戏月，非负整数。
     */
    function calculateCaptiveTotalLifespanMonths(captive) {
        return Math.max(0, Math.floor(Number(captive.baseLifespanMonths) || 0)) +
            Math.max(0, Math.floor(Number(captive.technologyLifespanMonths) || 0)) +
            Math.max(0, Math.floor(Number(captive.eventLifespanMonths) || 0));
    }

    /**
     * 对随机俘虏添加事件寿命。
     *
     * @param {GameState} state - 当前游戏状态对象，会修改被选中的俘虏。
     * @param {number} bonusMonths - 寿命加成，单位游戏月，非负整数。
     * @returns {CaptiveState|null} 获得寿命的俘虏；没有候选时返回 null。
     */
    function applyRandomCaptiveLifespanEventBonus(state, bonusMonths) {
        if (!Array.isArray(state.captives) || state.captives.length <= 0) {
            return null;
        }

        // number 随机下标：从当前俘虏中选择一个。
        var randomIndex = Math.floor(Math.random() * state.captives.length);

        // CaptiveState 目标俘虏：获得事件寿命加成。
        var targetCaptive = state.captives[randomIndex];

        normalizeCaptiveLifespanFields(state, targetCaptive);
        targetCaptive.eventLifespanMonths += Math.max(0, Math.floor(Number(bonusMonths) || 0));
        targetCaptive.elderDeathCheckCount = 0;
        return targetCaptive;
    }

    /**
     * 切换指定俘虏的自动洗脑状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入目标俘虏的自动洗脑开关。
     * @param {string} captiveId - 俘虏稳定 ID。
     * @returns {boolean} 是否切换成功；true 表示目标俘虏存在且科技已完成。
     */
    function toggleAutoBrainwash(state, captiveId) {
        if (state.isPaused || !hasDesireEnlightenment(state)) {
            return false;
        }

        // number 俘虏索引：用于定位要切换自动洗脑的俘虏。
        var captiveIndex = findCaptiveIndex(state, captiveId);

        if (captiveIndex < 0) {
            return false;
        }

        // CaptiveState 当前俘虏：写入指定俘虏自己的自动洗脑开关。
        var captive = state.captives[captiveIndex];

        captive.isAutoBrainwashEnabled = !Boolean(captive.isAutoBrainwashEnabled);
        return true;
    }

    /**
     * 切换指定俘虏的自动培育状态。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入目标俘虏的自动培育开关。
     * @param {string} captiveId - 俘虏稳定 ID。
     * @returns {boolean} 是否切换成功；true 表示目标俘虏存在且公用苗床科技已完成。
     */
    function toggleAutoBreed(state, captiveId) {
        if (state.isPaused || !hasPublicNursery(state)) {
            return false;
        }

        // number 俘虏索引：用于定位要切换自动培育的俘虏。
        var captiveIndex = findCaptiveIndex(state, captiveId);

        if (captiveIndex < 0) {
            return false;
        }

        // CaptiveState 当前俘虏：写入指定俘虏自己的自动培育开关。
        var captive = state.captives[captiveIndex];

        captive.isAutoBreedEnabled = !Boolean(captive.isAutoBreedEnabled);
        return true;
    }

    /**
     * 在食物充足时为指定俘虏执行一次自动洗脑。
     *
     * @param {GameState} state - 当前游戏状态对象，可能消耗菌菇并提升俘虏洗脑程度。
     * @param {CaptiveState} captive - 俘虏运行时对象，会在满足条件时被直接修改。
     * @returns {boolean} 是否执行了自动洗脑；true 表示已消耗食物并应用收益。
     */
    function applyAutoBrainwashIfNeeded(state, captive) {
        if (!hasDesireEnlightenment(state) || !captive.isAutoBrainwashEnabled) {
            return false;
        }

        if (!canApplyDisposition(state, captive, "modify")) {
            return false;
        }

        if (!game.resources.spendResources(state, calculateBrainwashPrice(state))) {
            return false;
        }

        applyModifyReward(state, captive);
        return true;
    }

    /**
     * 在食物和住房充足时按俘虏属性价值排序执行自动培育。
     *
     * @param {GameState} state - 当前游戏状态对象，可能让一个或多个俘虏进入孕育状态。
     * @returns {number} 本轮成功启动自动培育的俘虏数量，非负整数。
     */
    function applyAutoBreedingIfNeeded(state) {
        if (!hasPublicNursery(state) || !hasEnoughFoodForAutoBreeding(state)) {
            return 0;
        }

        // CaptiveState[] 自动培育候选数组：只包含开启开关且满足满洗脑和空闲条件的俘虏。
        var breedingCandidates = getAutoBreedingCandidates(state);

        if (breedingCandidates.length <= 0) {
            return 0;
        }

        // number 已启动数量：统计本轮实际进入孕育的俘虏数量，非负整数。
        var startedCount = 0;

        // number 预留住房空位：自动培育启动孕育时预占未来新生住房，非负整数。
        var reservedFreeHousing = game.population.calculateFreeHousing(state);

        // number 候选循环索引：按属性价值从高到低遍历候选俘虏。
        for (var candidateIndex = 0; candidateIndex < breedingCandidates.length; candidateIndex += 1) {
            if (reservedFreeHousing <= 0 || !hasEnoughFoodForAutoBreeding(state)) {
                break;
            }

            // CaptiveState 当前候选俘虏：本轮可能被自动送入苗床孕育。
            var captive = breedingCandidates[candidateIndex];

            // string 处置状态：自动培育与手动培育共享苗床状态，保证后续结算一致。
            captive.disposition = "bed";
            startCaptiveGestation(state, captive);
            startedCount += 1;
            reservedFreeHousing -= 1;
        }

        return startedCount;
    }

    /**
     * 取得自动培育候选，并按俘虏属性价值从高到低排序。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {CaptiveState[]} 排序后的候选俘虏数组。
     */
    function getAutoBreedingCandidates(state) {
        // CaptiveState[] 候选俘虏数组：保留原始对象引用，排序只影响本次决策顺序。
        var breedingCandidates = [];

        // number 循环索引：遍历当前关押俘虏数组的整数下标。
        for (var captiveIndex = 0; captiveIndex < state.captives.length; captiveIndex += 1) {
            // CaptiveState 当前俘虏：用于检查自动培育条件。
            var captive = state.captives[captiveIndex];

            if (canAutoBreedCaptive(state, captive)) {
                breedingCandidates.push(captive);
            }
        }

        breedingCandidates.sort(compareCaptivesByAttributeValue);
        return breedingCandidates;
    }

    /**
     * 判断单个俘虏是否满足自动培育的个体条件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {boolean} 是否可由公用苗床自动开始培育。
     */
    function canAutoBreedCaptive(state, captive) {
        return Boolean(captive.isAutoBreedEnabled) && getCaptiveBrainwashRatio(captive) >= 1 && canApplyDisposition(state, captive, "bed");
    }

    /**
     * 判断当前是否有足够菌菇允许自动培育。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否食物充足；true 表示当前库存至少覆盖一秒现有口粮消耗。
     */
    function hasEnoughFoodForAutoBreeding(state) {
        // ResourceState|null 菌菇状态：自动培育不直接扣费，但需要避免断粮时继续扩张人口。
        var fungusState = state.resourcesById.fungus || null;

        if (!fungusState) {
            return false;
        }

        // number 每秒口粮消耗：当前哥布林和俘虏的菌菇消耗速度，单位菌菇/秒。
        var fungusConsumptionPerSecond = game.population.calculateFungusConsumptionPerSecond(state);

        return fungusState.value >= Math.max(1, fungusConsumptionPerSecond);
    }

    /**
     * 按俘虏属性价值比较两个候选俘虏。
     *
     * @param {CaptiveState} leftCaptive - 左侧候选俘虏，不会被修改。
     * @param {CaptiveState} rightCaptive - 右侧候选俘虏，不会被修改。
     * @returns {number} 排序比较值；负数表示左侧优先。
     */
    function compareCaptivesByAttributeValue(leftCaptive, rightCaptive) {
        // number 左侧属性价值：按类型属性偏置总和与质量倍率估算。
        var leftAttributeValue = calculateCaptiveAttributeValue(leftCaptive);

        // number 右侧属性价值：按类型属性偏置总和与质量倍率估算。
        var rightAttributeValue = calculateCaptiveAttributeValue(rightCaptive);

        return rightAttributeValue - leftAttributeValue;
    }

    /**
     * 计算俘虏用于自动培育排序的属性价值。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {number} 属性价值分数，有符号浮点数；分数越高越优先自动培育。
     */
    function calculateCaptiveAttributeValue(captive) {
        // CaptiveTypeDefinition|null 俘虏类型定义：当前实现的俘虏属性来自类型偏置。
        var captiveTypeDefinition = getCaptiveTypeDefinition(captive.type);

        // CaptiveQualityDefinition|null 俘虏质量定义：高质量俘虏在排序中放大其属性价值。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        if (!captiveTypeDefinition) {
            return 0;
        }

        // string[] 属性 ID 数组：遍历该俘虏类型声明的属性偏置。
        var attributeIds = Object.keys(captiveTypeDefinition.attributeBias);

        // number 属性偏置总和：允许负偏置拉低总值，反映当前类型对新生六维的净贡献。
        var attributeBiasTotal = 0;

        // number 属性循环索引：遍历属性 ID 数组的整数下标。
        for (var attributeIndex = 0; attributeIndex < attributeIds.length; attributeIndex += 1) {
            // string 当前属性 ID：用于读取属性偏置数值。
            var attributeId = attributeIds[attributeIndex];

            attributeBiasTotal += Number(captiveTypeDefinition.attributeBias[attributeId]) || 0;
        }

        // number 质量倍率：缺失质量定义时按普通质量 1 处理。
        var qualityMultiplier = qualityDefinition ? qualityDefinition.multiplier : 1;

        return attributeBiasTotal * qualityMultiplier;
    }

    /**
     * 判断欲望启蒙科技是否已经完成。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否完成欲望启蒙；true 表示俘虏卡片可显示自动洗脑按钮。
     */
    function hasDesireEnlightenment(state) {
        // TechnologyState|null 欲望启蒙状态：用于控制自动洗脑入口和模拟逻辑。
        var technologyState = state.technologiesById.desire_enlightenment || null;

        return Boolean(technologyState && technologyState.isResearched);
    }

    /**
     * 判断公用苗床科技是否已经完成。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否完成公用苗床；true 表示俘虏卡片可显示自动培育按钮。
     */
    function hasPublicNursery(state) {
        // TechnologyState|null 公用苗床状态：用于控制自动培育入口和模拟逻辑。
        var technologyState = state.technologiesById.public_nursery || null;

        return Boolean(technologyState && technologyState.isResearched);
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

        newGoblin.growthLifespanMonths = game.population.calculateGoblinGrowthLifespanMonths(newGoblin);
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
        toggleAutoBrainwash: toggleAutoBrainwash,
        toggleAutoBreed: toggleAutoBreed,
        applyAutoBrainwashIfNeeded: applyAutoBrainwashIfNeeded,
        applyAutoBreedingIfNeeded: applyAutoBreedingIfNeeded,
        hasDesireEnlightenment: hasDesireEnlightenment,
        hasPublicNursery: hasPublicNursery,
        calculateCaptiveAttributeValue: calculateCaptiveAttributeValue,
        updateMonthlyCaptiveAgingAndLifespan: updateMonthlyCaptiveAgingAndLifespan,
        normalizeCaptiveLifespanFields: normalizeCaptiveLifespanFields,
        calculateCaptiveTotalLifespanMonths: calculateCaptiveTotalLifespanMonths,
        applyRandomCaptiveLifespanEventBonus: applyRandomCaptiveLifespanEventBonus,
        updateCaptives: updateCaptives,
        breedGoblinFromCaptive: breedGoblinFromCaptive,
        syncCaptiveResource: syncCaptiveResource
    };
})(window.GoblinEmpire);
