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

    // Object.<string, number[]> 俘虏品质血脉纯度范围：key 为质量 ID，value 为 [最小百分比, 最大百分比]。
    var CAPTIVE_BLOODLINE_PURITY_RANGES = {
        common: [1, 10],
        skilled: [11, 35],
        elite: [36, 70],
        legendary: [71, 100]
    };

    // Object.<string, string> 旧种族 ID 映射表：key 为旧亚种 ID，value 为合并后的当前种族 ID。
    var LEGACY_CAPTIVE_RACE_ID_ALIASES = {
        mire_human: "human",
        frontier_human: "human",
        hill_dwarf: "dwarf",
        deep_dwarf: "dwarf",
        wood_elf: "elf",
        moon_elf: "elf"
    };

    // Object.<string, string> 旧血脉 ID 映射表：key 为七神重设计前血脉 ID，value 为当前七宗罪神系血脉 ID。
    var LEGACY_BLOODLINE_ID_ALIASES = {
        stone_father: "stone_throne",
        mud_mother: "fertile_sea",
        rat_queen: "golden_river",
        green_sun: "fertile_sea",
        moon_root: "silent_moon",
        iron_warlord: "forge_sun",
        grave_lamp: "silent_moon",
        abyss_eye: "crimson_abyss",
        arrogant_mountain: "stone_throne",
        greedy_river: "golden_river",
        wrath_sun: "forge_sun",
        sloth_moon: "silent_moon",
        envious_stars: "mirror_stars",
        gluttonous_sea: "fertile_sea",
        lust_abyss: "crimson_abyss"
    };

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
     * @param {string=} raceId - 可选俘虏种族 ID；省略时按类型使用兼容默认种族。
     * @returns {CaptiveState} 新俘虏对象。
     */
    function createCaptive(captiveTypeId, qualityId, source, raceId) {
        // CaptiveTypeDefinition|null 俘虏类型定义：用于写入倾向提示。
        var captiveTypeDefinition = getCaptiveTypeDefinition(captiveTypeId);

        // string 种族 ID：新增种族系统字段；旧调用缺失时按类型回退到稳定默认种族。
        var normalizedRaceId = normalizeCaptiveRaceId(raceId, captiveTypeId);

        // number 基础年龄：根据俘虏类型年龄段随机生成，单位年，非负整数。
        var initialAgeYears = createCaptiveInitialAgeYears(captiveTypeDefinition);

        // number 基础寿命：根据俘虏质量寿命段和种族寿命修正随机生成，单位年。
        var baseLifespanYears = createCaptiveBaseLifespanYears(qualityId, initialAgeYears + 1, normalizedRaceId);

        // string|null 俘虏信仰 ID：用于血脉同源神灵判定，null 表示无信仰。
        var faithId = game.faithSystem.createRandomCaptiveFaithId(normalizedRaceId);

        // {bloodlineId: string|null, bloodlinePurity: number} 俘虏血脉快照：血脉 ID 和 0-100 百分比纯度会写入个体存档。
        var bloodlineSnapshot = createCaptiveBloodlineSnapshot(captiveTypeId, qualityId, faithId);

        return {
            id: "captive_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
            name: createCaptiveName(captiveTypeId),
            type: captiveTypeId,
            raceId: normalizedRaceId,
            faithId: faithId,
            bloodlineId: bloodlineSnapshot.bloodlineId,
            bloodlinePurity: bloodlineSnapshot.bloodlinePurity,
            quality: qualityId,
            source: source,
            traitHint: captiveTypeDefinition ? captiveTypeDefinition.traitHint : "basic",
            age: initialAgeYears,
            baseLifespanYears: baseLifespanYears,
            technologyLifespanYears: 0,
            eventLifespanYears: 0,
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
     * 按掠夺目标定义创建一个俘虏。
     *
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义；提供地点种族权重和允许职业类型。
     * @returns {CaptiveState} 新俘虏对象；种族、职业类型和品质均按权重生成。
     */
    function createCaptiveFromRaidTarget(targetDefinition) {
        // string 种族 ID：先由地点权重决定俘虏来自哪个非哥布林种族。
        var raceId = selectWeightedId(targetDefinition.captiveRaceWeights, "human");

        // CaptiveRaceDefinition|null 种族定义：用于读取职业和品质权重。
        var raceDefinition = getCaptiveRaceDefinition(raceId);

        // string[] 地点允许职业类型 ID 数组：避免地点生成完全不符合职业生态的俘虏。
        var allowedTypeIds = Array.isArray(targetDefinition.captiveTypes) ? targetDefinition.captiveTypes : ["laborer"];

        // string 俘虏类型 ID：在种族职业权重和地点允许列表交集中抽取。
        var captiveTypeId = selectCaptiveTypeForRaceAndTarget(raceDefinition, allowedTypeIds);

        // string 质量 ID：按种族定义抽取，体现不同种族高品质俘虏概率差异。
        var qualityId = selectWeightedId(raceDefinition ? raceDefinition.qualityWeights : null, "common");

        return createCaptive(captiveTypeId, qualityId, targetDefinition.id, raceId);
    }

    /**
     * 生成俘虏基础年龄。
     *
     * @param {CaptiveTypeDefinition|null} captiveTypeDefinition - 俘虏类型定义；缺失时使用成年兜底年龄段。
     * @returns {number} 基础年龄，单位年，非负整数。
     */
    function createCaptiveInitialAgeYears(captiveTypeDefinition) {
        // number 最小年龄：该类型俘虏生成年龄下限，单位年。
        var minAgeYears = captiveTypeDefinition ? Math.max(0, Math.floor(Number(captiveTypeDefinition.minInitialAgeYears) || 0)) : 18;

        // number 最大年龄：该类型俘虏生成年龄上限，单位年。
        var maxAgeYears = captiveTypeDefinition ? Math.max(minAgeYears, Math.floor(Number(captiveTypeDefinition.maxInitialAgeYears) || minAgeYears)) : 35;

        return randomIntegerInclusive(minAgeYears, maxAgeYears);
    }

    /**
     * 生成俘虏基础寿命。
     *
     * @param {"common"|"skilled"|"elite"|"legendary"} qualityId - 俘虏质量 ID。
     * @param {number=} minimumLifespanYears - 可选寿命下限，单位年；用于避免新俘虏出生时已经超过寿命。
     * @param {string=} raceId - 可选种族 ID；提供时会叠加种族寿命修正。
     * @returns {number} 基础寿命，单位年，范围为 18-140；质量越高区间越靠后，种族会修正区间。
     */
    function createCaptiveBaseLifespanYears(qualityId, minimumLifespanYears, raceId) {
        // CaptiveQualityDefinition|null 质量定义：用于读取该质量对应寿命区间。
        var qualityDefinition = getCaptiveQualityDefinition(qualityId);

        // CaptiveRaceDefinition|null 种族定义：用于读取同质量下不同种族的基础寿命差异。
        var raceDefinition = getCaptiveRaceDefinition(raceId);

        // number 种族寿命修正：单位年，可正可负；让相同职业和质量的不同种族仍有寿命差异。
        var raceLifespanYears = raceDefinition ? Number(raceDefinition.lifespanYears) || 0 : 0;

        // number 最小寿命：质量定义下限，单位年。
        var minLifespanYears = qualityDefinition ? Math.max(18, Math.floor(Number(qualityDefinition.minLifespanYears) + raceLifespanYears || 30)) : 30;

        // number 额外寿命下限：至少高于当前年龄，省略时不额外抬高。
        var safeMinimumLifespanYears = Math.max(0, Math.floor(Number(minimumLifespanYears) || 0));

        minLifespanYears = Math.min(140, Math.max(minLifespanYears, safeMinimumLifespanYears));

        // number 最大寿命：质量定义上限叠加种族修正，单位年，封顶 140。
        var maxLifespanYears = qualityDefinition ? Math.min(140, Math.max(minLifespanYears, Math.floor(Number(qualityDefinition.maxLifespanYears) + raceLifespanYears || minLifespanYears))) : Math.max(minLifespanYears, game.definitions.POPULATION_CONSTANTS.fallbackCaptiveLifespanYears);

        return randomIntegerInclusive(minLifespanYears, maxLifespanYears);
    }

    /**
     * 生成闭区间整数随机数。
     *
     * @param {number} minValue - 随机下限，整数。
     * @param {number} maxValue - 随机上限，整数且不小于 minValue。
     * @returns {number} 闭区间内的整数随机值。
     */
    function randomIntegerInclusive(minValue, maxValue) {
        return minValue + Math.floor(Math.random() * (maxValue - minValue + 1));
    }

    /**
     * 生成俘虏血脉快照。
     *
     * @param {string} captiveTypeId - 俘虏类型 ID；普通村姑固定无血脉。
     * @param {"common"|"skilled"|"elite"|"legendary"} qualityId - 俘虏质量 ID，用于决定血脉纯度随机区间。
     * @param {string|null} faithId - 俘虏信仰 ID；有血脉时必须与来源神灵一致。
     * @returns {{bloodlineId: string|null, bloodlinePurity: number}} 血脉快照；bloodlinePurity 为 0-100 百分比整数。
     */
    function createCaptiveBloodlineSnapshot(captiveTypeId, qualityId, faithId) {
        if (captiveTypeId === "laborer" || !faithId) {
            return {
                bloodlineId: null,
                bloodlinePurity: 0
            };
        }

        // BloodlineDefinition|null 血脉定义：由信仰神灵反查同源血脉。
        var bloodlineDefinition = getBloodlineDefinitionByFaith(faithId);

        if (!bloodlineDefinition) {
            return {
                bloodlineId: null,
                bloodlinePurity: 0
            };
        }

        // number[] 纯度范围：质量越高，随机区间越靠近 100%。
        var purityRange = CAPTIVE_BLOODLINE_PURITY_RANGES[qualityId] || CAPTIVE_BLOODLINE_PURITY_RANGES.common;

        // number 最小纯度：当前品质可随机到的最低百分比，整数。
        var minPurity = Math.max(1, Math.floor(Number(purityRange[0]) || 1));

        // number 最大纯度：当前品质可随机到的最高百分比，整数。
        var maxPurity = Math.min(100, Math.max(minPurity, Math.floor(Number(purityRange[1]) || minPurity)));

        return {
            bloodlineId: bloodlineDefinition.id,
            bloodlinePurity: randomIntegerInclusive(minPurity, maxPurity)
        };
    }

    /**
     * 按来源神灵取得血脉定义。
     *
     * @param {string|null|undefined} faithId - 神灵信仰 ID；null 或 undefined 表示无来源神灵。
     * @returns {BloodlineDefinition|null} 血脉定义；未找到时返回 null。
     */
    function getBloodlineDefinitionByFaith(faithId) {
        if (!faithId || !Array.isArray(game.definitions.BLOODLINE_DEFINITIONS)) {
            return null;
        }

        // string|null 当前信仰 ID：兼容旧神灵 ID 后用于反查同源血脉。
        var normalizedFaithId = game.faithSystem && game.faithSystem.normalizeFaithId ? game.faithSystem.normalizeFaithId(faithId) : faithId;

        // number 循环索引：遍历血脉定义数组的整数下标。
        for (var bloodlineIndex = 0; bloodlineIndex < game.definitions.BLOODLINE_DEFINITIONS.length; bloodlineIndex += 1) {
            // BloodlineDefinition 当前血脉定义：用于匹配来源神灵 ID。
            var bloodlineDefinition = game.definitions.BLOODLINE_DEFINITIONS[bloodlineIndex];

            if (bloodlineDefinition.deityFaithId === normalizedFaithId) {
                return bloodlineDefinition;
            }
        }

        return null;
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
     * 取得俘虏种族定义。
     *
     * @param {string|undefined} raceId - 俘虏种族 ID；可能来自旧存档缺失字段。
     * @returns {CaptiveRaceDefinition|null} 俘虏种族定义；未找到时返回 null。
     */
    function getCaptiveRaceDefinition(raceId) {
        if (!raceId) {
            return null;
        }

        // number 循环索引：遍历俘虏种族定义数组的整数下标。
        for (var raceIndex = 0; raceIndex < game.definitions.CAPTIVE_RACE_DEFINITIONS.length; raceIndex += 1) {
            // CaptiveRaceDefinition 当前种族定义：用于匹配种族 ID。
            var raceDefinition = game.definitions.CAPTIVE_RACE_DEFINITIONS[raceIndex];

            if (raceDefinition.id === raceId) {
                return raceDefinition;
            }
        }

        return null;
    }

    /**
     * 规范化俘虏种族 ID。
     *
     * @param {string|undefined} raceId - 当前俘虏种族 ID；旧存档或旧调用可能缺失。
     * @param {string} captiveTypeId - 俘虏职业类型 ID，用于选择兼容默认种族。
     * @returns {string} 有效种族 ID。
     */
    function normalizeCaptiveRaceId(raceId, captiveTypeId) {
        // string|undefined 合并后种族 ID：兼容旧存档中的地域亚种 ID。
        var mergedRaceId = LEGACY_CAPTIVE_RACE_ID_ALIASES[raceId];

        if (getCaptiveRaceDefinition(mergedRaceId)) {
            return mergedRaceId;
        }

        if (getCaptiveRaceDefinition(raceId)) {
            return raceId;
        }

        if (captiveTypeId === "undead_captive") {
            return "ghoulkin";
        }

        if (captiveTypeId === "magic_talent" || captiveTypeId === "shrine_acolyte") {
            return "human";
        }

        return "human";
    }

    /**
     * 按种族和地点限制抽取俘虏职业类型。
     *
     * @param {CaptiveRaceDefinition|null} raceDefinition - 种族定义；缺失时从地点允许类型中兜底。
     * @param {string[]} allowedTypeIds - 地点允许的俘虏类型 ID 数组。
     * @returns {string} 俘虏类型 ID。
     */
    function selectCaptiveTypeForRaceAndTarget(raceDefinition, allowedTypeIds) {
        // WeightedId[] 可用权重数组：只保留地点允许且种族声明的职业类型。
        var filteredWeights = [];

        if (raceDefinition && Array.isArray(raceDefinition.captiveTypeWeights)) {
            // number 权重循环索引：遍历种族职业类型权重数组的整数下标。
            for (var weightIndex = 0; weightIndex < raceDefinition.captiveTypeWeights.length; weightIndex += 1) {
                // WeightedId 当前权重项：id 为俘虏类型 ID，weight 为随机权重。
                var weightEntry = raceDefinition.captiveTypeWeights[weightIndex];

                if (allowedTypeIds.indexOf(weightEntry.id) !== -1) {
                    filteredWeights.push(weightEntry);
                }
            }
        }

        if (filteredWeights.length > 0) {
            return selectWeightedId(filteredWeights, allowedTypeIds[0] || "laborer");
        }

        return allowedTypeIds[0] || "laborer";
    }

    /**
     * 从带权重 ID 数组中抽取一个 ID。
     *
     * @param {WeightedId[]|null|undefined} weightedIds - 权重项数组；缺失或总权重为 0 时使用兜底 ID。
     * @param {string} fallbackId - 兜底稳定 ID。
     * @returns {string} 抽中的稳定 ID。
     */
    function selectWeightedId(weightedIds, fallbackId) {
        if (!Array.isArray(weightedIds) || weightedIds.length <= 0) {
            return fallbackId;
        }

        // number 总权重：只累加正数权重。
        var totalWeight = 0;

        // number 权重循环索引：遍历所有候选权重项的整数下标。
        for (var weightIndex = 0; weightIndex < weightedIds.length; weightIndex += 1) {
            // WeightedId 当前权重项：用于累加随机区间。
            var weightEntry = weightedIds[weightIndex];

            totalWeight += Math.max(0, Number(weightEntry.weight) || 0);
        }

        if (totalWeight <= 0) {
            return fallbackId;
        }

        // number 随机落点：范围为 0 到总权重的浮点数。
        var roll = Math.random() * totalWeight;

        // number 累计权重：用于判断随机落点落在哪个候选项。
        var cumulativeWeight = 0;

        // number 抽取循环索引：遍历候选项并返回命中的 ID。
        for (var selectionIndex = 0; selectionIndex < weightedIds.length; selectionIndex += 1) {
            // WeightedId 候选权重项：id 为返回值，weight 为占用区间宽度。
            var candidateEntry = weightedIds[selectionIndex];

            cumulativeWeight += Math.max(0, Number(candidateEntry.weight) || 0);
            if (roll < cumulativeWeight) {
                return candidateEntry.id;
            }
        }

        return fallbackId;
    }

    /**
     * 预览俘虏处置收益和风险。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @param {"bed"|"modify"|"food"|"beast"} dispositionId - 处置方式 ID。
     * @param {GameState=} state - 当前游戏状态对象；提供时会计入天气和建筑修正。
     * @returns {Object.<string, string|number>} 预览对象；包含收益、继承概率、逃脱风险和报复风险。
     */
    function previewDisposition(captive, dispositionId, state) {
        // CaptiveTypeDefinition|null 俘虏类型定义：用于读取倾向和技能偏向。
        var captiveTypeDefinition = getCaptiveTypeDefinition(captive.type);

        // CaptiveQualityDefinition|null 质量定义：用于收益和风险倍率。
        var qualityDefinition = getCaptiveQualityDefinition(captive.quality);

        // CaptiveRaceDefinition|null 种族定义：用于显示同类型同质量下的种族差异。
        var raceDefinition = getCaptiveRaceDefinition(captive.raceId);

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
                raceName: raceDefinition ? raceDefinition.name : "未知种族",
                bloodlinePurity: Math.max(0, Math.min(100, Math.round(Number(captive.bloodlinePurity) || 0))),
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

        if (dispositionId === "beast") {
            return {
                summary: "移入战兽列表，保留姓名；种族显示为原种族加（兽）标志",
                species: "战兽转化体",
                isUnlocked: hasHumanBeast(state)
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
     * @param {"bed"|"modify"|"food"|"beast"} dispositionId - 处置方式 ID。
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

        if (!canApplyDisposition(state, captive, dispositionId)) {
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
            } else if (dispositionId === "food") {
                applyFoodReward(state, captive);
                state.captives.splice(captiveIndex, 1);
            } else {
                applyBeastConversion(state, captive);
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
     * @param {"bed"|"modify"|"food"|"beast"} dispositionId - 处置方式 ID。
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

        if (dispositionId === "beast") {
            return Boolean(state && hasHumanBeast(state));
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
            // number 年龄推进量：每个生存月只增加十二分之一年，寿命字段保持年制。
            var ageGainYears = 1 / 12;

            captive.age = Math.max(0, Number(captive.age) || 0) + ageGainYears;

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
        // number 总寿命：寿命各组成部分相加后的年数。
        var totalLifespanYears = calculateCaptiveTotalLifespanYears(captive);

        if (captive.age < totalLifespanYears) {
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
        if (typeof captive.age !== "number" || !isFinite(captive.age)) {
            captive.age = createCaptiveInitialAgeYears(getCaptiveTypeDefinition(captive.type));
        }
        captive.raceId = normalizeCaptiveRaceId(captive.raceId, captive.type);
        if (typeof captive.baseLifespanYears !== "number") {
            captive.baseLifespanYears = createCaptiveBaseLifespanYears(captive.quality, captive.age + 1, captive.raceId);
        }
        captive.technologyLifespanYears = game.population.calculateTechnologyLifespanBonusYears(state);
        if (typeof captive.eventLifespanYears !== "number") {
            captive.eventLifespanYears = 0;
        }
        if (typeof captive.elderDeathCheckCount !== "number") {
            captive.elderDeathCheckCount = 0;
        }
        if (Math.max(0, Number(captive.age) || 0) < calculateCaptiveTotalLifespanYears(captive)) {
            captive.elderDeathCheckCount = 0;
        }
    }

    /**
     * 计算俘虏总寿命。
     *
     * @param {CaptiveState} captive - 俘虏对象，不会被修改。
     * @returns {number} 总寿命，单位年，非负整数。
     */
    function calculateCaptiveTotalLifespanYears(captive) {
        return Math.max(0, Math.floor(Number(captive.baseLifespanYears) || 0)) +
            Math.max(0, Math.floor(Number(captive.technologyLifespanYears) || 0)) +
            Math.max(0, Math.floor(Number(captive.eventLifespanYears) || 0));
    }

    /**
     * 对随机俘虏添加事件寿命。
     *
     * @param {GameState} state - 当前游戏状态对象，会修改被选中的俘虏。
     * @param {number} bonusYears - 寿命加成，单位年，非负整数。
     * @returns {CaptiveState|null} 获得寿命的俘虏；没有候选时返回 null。
     */
    function applyRandomCaptiveLifespanEventBonus(state, bonusYears) {
        if (!Array.isArray(state.captives) || state.captives.length <= 0) {
            return null;
        }

        // number 随机下标：从当前俘虏中选择一个。
        var randomIndex = Math.floor(Math.random() * state.captives.length);

        // CaptiveState 目标俘虏：获得事件寿命加成。
        var targetCaptive = state.captives[randomIndex];

        normalizeCaptiveLifespanFields(state, targetCaptive);
        targetCaptive.eventLifespanYears += Math.max(0, Math.floor(Number(bonusYears) || 0));
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

        // CaptiveRaceDefinition|null 俘虏种族定义：新增种族偏置会参与自动培育排序。
        var raceDefinition = getCaptiveRaceDefinition(captive.raceId);

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

        if (raceDefinition) {
            // string[] 种族属性 ID 数组：遍历种族属性修正字典。
            var raceAttributeIds = Object.keys(raceDefinition.attributeBonus);

            // number 种族属性循环索引：遍历种族属性 ID 数组的整数下标。
            for (var raceAttributeIndex = 0; raceAttributeIndex < raceAttributeIds.length; raceAttributeIndex += 1) {
                // string 种族属性 ID：用于读取种族属性修正值。
                var raceAttributeId = raceAttributeIds[raceAttributeIndex];

                attributeBiasTotal += Number(raceDefinition.attributeBonus[raceAttributeId]) || 0;
            }
        }

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
     * 判断人即是兽科技是否已经完成。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否完成人即是兽；true 表示俘虏卡片显示战兽转化按钮。
     */
    function hasHumanBeast(state) {
        if (!state) {
            return false;
        }

        // TechnologyState|null 人即是兽状态：用于控制俘虏转战兽入口。
        var technologyState = state.technologiesById.human_beast || null;

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

        // CaptiveRaceDefinition|null 种族定义：用于追加同职业同质量下的属性、技能和寿命差异。
        var raceDefinition = getCaptiveRaceDefinition(captive.raceId);

        // Goblin 新生哥布林：来源标记为 captive_bed。
        var newGoblin = game.population.createGoblin(state, "captive_bed");

        inheritBloodlineFromCaptive(newGoblin, captive);

        if (captiveTypeDefinition) {
            applyCaptiveBiasToGoblin(newGoblin, captiveTypeDefinition, raceDefinition, qualityDefinition ? qualityDefinition.multiplier : 1, calculateBrainwashAttributeBonus(captive), getCaptiveNewbornAttributePenalty(state, captive));
        }

        newGoblin.growthLifespanYears = game.population.calculateGoblinGrowthLifespanYears(newGoblin);
        state.goblins.push(newGoblin);
        game.simulation.addLog(state, "important", "俘虏苗床产出新哥布林：" + newGoblin.name + "。");
        return newGoblin;
    }

    /**
     * 将母体俘虏血脉继承给新生哥布林。
     *
     * @param {Goblin} goblin - 新生哥布林对象，会写入血脉字段。
     * @param {CaptiveState} captive - 母体俘虏对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function inheritBloodlineFromCaptive(goblin, captive) {
        // BloodlineDefinition|null 母体血脉定义：用于校验存档中的 bloodlineId 仍有效。
        var bloodlineDefinition = getBloodlineDefinition(captive.bloodlineId);

        if (!bloodlineDefinition) {
            goblin.bloodlineId = null;
            goblin.bloodlinePurity = 0;
            return;
        }

        goblin.bloodlineId = bloodlineDefinition.id;
        goblin.bloodlinePurity = Math.max(1, Math.min(100, Math.round(Number(captive.bloodlinePurity) || 0)));
        goblin.traits.push("bloodline_" + bloodlineDefinition.id);
    }

    /**
     * 取得血脉定义。
     *
     * @param {string|null|undefined} bloodlineId - 血脉稳定 ID；null 或 undefined 表示无血脉。
     * @returns {BloodlineDefinition|null} 血脉定义；未找到时返回 null。
     */
    function getBloodlineDefinition(bloodlineId) {
        if (!bloodlineId || !Array.isArray(game.definitions.BLOODLINE_DEFINITIONS)) {
            return null;
        }

        // string 规范化血脉 ID：兼容旧存档中的重设计前血脉。
        var normalizedBloodlineId = LEGACY_BLOODLINE_ID_ALIASES[bloodlineId] || bloodlineId;

        // number 循环索引：遍历血脉定义数组的整数下标。
        for (var bloodlineIndex = 0; bloodlineIndex < game.definitions.BLOODLINE_DEFINITIONS.length; bloodlineIndex += 1) {
            // BloodlineDefinition 当前血脉定义：用于匹配血脉 ID。
            var bloodlineDefinition = game.definitions.BLOODLINE_DEFINITIONS[bloodlineIndex];

            if (bloodlineDefinition.id === normalizedBloodlineId) {
                return bloodlineDefinition;
            }
        }

        return null;
    }

    /**
     * 应用俘虏倾向到新哥布林。
     *
     * @param {Goblin} goblin - 新生哥布林对象，会被直接修改。
     * @param {CaptiveTypeDefinition} captiveTypeDefinition - 俘虏类型定义对象。
     * @param {CaptiveRaceDefinition|null} raceDefinition - 俘虏种族定义对象；缺失时只应用职业类型偏置。
     * @param {number} qualityMultiplier - 质量倍率，正数。
     * @param {number} brainwashAttributeBonus - 洗脑属性加成，非负整数。
     * @param {number} attributePenalty - 新生属性惩罚，非负整数。
     * @returns {void} 无返回值。
     */
    function applyCaptiveBiasToGoblin(goblin, captiveTypeDefinition, raceDefinition, qualityMultiplier, brainwashAttributeBonus, attributePenalty) {
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

        if (raceDefinition) {
            // string[] 种族属性 ID 数组：遍历种族额外属性修正。
            var raceAttributeIds = Object.keys(raceDefinition.attributeBonus);

            // number 种族属性循环索引：遍历种族属性 ID 数组的整数下标。
            for (var raceAttributeIndex = 0; raceAttributeIndex < raceAttributeIds.length; raceAttributeIndex += 1) {
                // string 当前种族属性 ID：用于写入种族属性差异。
                var raceAttributeId = raceAttributeIds[raceAttributeIndex];

                goblin.attributes[raceAttributeId] = Math.min(10, Math.max(1, goblin.attributes[raceAttributeId] + raceDefinition.attributeBonus[raceAttributeId]));
            }
        }

        // string[] 技能 ID 数组：用于遍历初始技能偏向。
        var skillIds = Object.keys(captiveTypeDefinition.skillBias);

        // number 技能循环索引：遍历技能 ID 数组的整数下标。
        for (var skillIndex = 0; skillIndex < skillIds.length; skillIndex += 1) {
            // string 当前技能 ID：用于写入初始经验。
            var skillId = skillIds[skillIndex];

            goblin.skills[skillId] = captiveTypeDefinition.skillBias[skillId] * qualityMultiplier;
        }

        if (raceDefinition) {
            // string[] 种族技能 ID 数组：遍历种族技能修正字典。
            var raceSkillIds = Object.keys(raceDefinition.skillBonus);

            // number 种族技能循环索引：遍历种族技能 ID 数组的整数下标。
            for (var raceSkillIndex = 0; raceSkillIndex < raceSkillIds.length; raceSkillIndex += 1) {
                // string 当前种族技能 ID：用于叠加种族初始技能经验。
                var raceSkillId = raceSkillIds[raceSkillIndex];

                goblin.skills[raceSkillId] = (goblin.skills[raceSkillId] || 0) + raceDefinition.skillBonus[raceSkillId] * qualityMultiplier;
            }
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
     * 将俘虏转化为战兽并写入战兽列表。
     *
     * @param {GameState} state - 当前游戏状态对象，会追加战兽。
     * @param {CaptiveState} captive - 被转化的俘虏对象，不会在本函数中移出俘虏列表。
     * @returns {void} 无返回值。
     */
    function applyBeastConversion(state, captive) {
        if (!Array.isArray(state.warbeasts)) {
            state.warbeasts = [];
        }

        // WarbeastState 转化战兽：保留俘虏姓名和原种族字段。
        var warbeast = game.warbeastsSystem.createWarbeastFromCaptive(state, captive);

        // CaptiveRaceDefinition|null 原种族定义：用于日志显示转化前种族。
        var raceDefinition = getCaptiveRaceDefinition(captive.raceId);

        state.warbeasts.push(warbeast);
        game.simulation.addLog(state, "important", "俘虏 " + (captive.name || captive.id) + " 被转化为战兽，原种族：" + (raceDefinition ? raceDefinition.name : captive.raceId || "未知") + "。");
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
        createCaptiveFromRaidTarget: createCaptiveFromRaidTarget,
        createCaptiveName: createCaptiveName,
        getCaptiveTypeDefinition: getCaptiveTypeDefinition,
        getCaptiveQualityDefinition: getCaptiveQualityDefinition,
        getCaptiveRaceDefinition: getCaptiveRaceDefinition,
        getBloodlineDefinition: getBloodlineDefinition,
        getBloodlineDefinitionByFaith: getBloodlineDefinitionByFaith,
        previewDisposition: previewDisposition,
        applyDisposition: applyDisposition,
        canApplyDisposition: canApplyDisposition,
        toggleAutoBrainwash: toggleAutoBrainwash,
        toggleAutoBreed: toggleAutoBreed,
        applyAutoBrainwashIfNeeded: applyAutoBrainwashIfNeeded,
        applyAutoBreedingIfNeeded: applyAutoBreedingIfNeeded,
        hasDesireEnlightenment: hasDesireEnlightenment,
        hasPublicNursery: hasPublicNursery,
        hasHumanBeast: hasHumanBeast,
        calculateCaptiveAttributeValue: calculateCaptiveAttributeValue,
        updateMonthlyCaptiveAgingAndLifespan: updateMonthlyCaptiveAgingAndLifespan,
        normalizeCaptiveLifespanFields: normalizeCaptiveLifespanFields,
        calculateCaptiveTotalLifespanYears: calculateCaptiveTotalLifespanYears,
        applyRandomCaptiveLifespanEventBonus: applyRandomCaptiveLifespanEventBonus,
        updateCaptives: updateCaptives,
        breedGoblinFromCaptive: breedGoblinFromCaptive,
        syncCaptiveResource: syncCaptiveResource
    };
})(window.GoblinEmpire);
