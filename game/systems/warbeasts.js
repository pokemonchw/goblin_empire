/* 战兽系统：负责掠夺捕获、驯化、战兽苗床、休养口粮和屠宰。 */
/**
 * 初始化战兽系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 warbeastsSystem 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 战兽孕育时长：一个哥布林历月份，单位模拟秒。
    var WARBEAST_GESTATION_SECONDS = game.calendar.getSecondsPerDay() * 30;

    // number 战兽休养时长：一次孕育结束后的一个哥布林历月份，单位模拟秒。
    var WARBEAST_REST_SECONDS = game.calendar.getSecondsPerDay() * 30;

    // number 驯化单次进度：每次驯化动作增加的进度点，范围累计到 100。
    var TAMING_PROGRESS_GAIN = 25;

    /**
     * 取得战兽物种定义。
     *
     * @param {string} speciesId - 战兽物种稳定 ID。
     * @returns {WarbeastSpeciesDefinition|null} 战兽物种定义；找不到时返回 null。
     */
    function getSpeciesDefinition(speciesId) {
        // number 循环索引：遍历战兽物种定义数组的整数下标。
        for (var speciesIndex = 0; speciesIndex < game.definitions.WARBEAST_SPECIES_DEFINITIONS.length; speciesIndex += 1) {
            // WarbeastSpeciesDefinition 当前物种定义：用于匹配稳定 ID。
            var speciesDefinition = game.definitions.WARBEAST_SPECIES_DEFINITIONS[speciesIndex];

            if (speciesDefinition.id === speciesId) {
                return speciesDefinition;
            }
        }

        return null;
    }

    /**
     * 按掠夺目标尝试捕获战兽。
     *
     * @param {GameState} state - 当前游戏状态对象，成功时会追加战兽。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义，读取捕获概率和物种权重。
     * @returns {WarbeastState|null} 成功捕获的战兽；未捕获时返回 null。
     */
    function tryCaptureFromRaidTarget(state, targetDefinition) {
        // number 捕获概率：目标定义控制，缺失时表示不会捕获。
        var captureChance = Math.max(0, Math.min(1, Number(targetDefinition.warbeastCaptureChance) || 0));

        if (captureChance <= 0 || Math.random() >= captureChance) {
            return null;
        }

        // string|null 捕获物种 ID：按目标地点权重随机选择。
        var speciesId = chooseWeightedId(targetDefinition.warbeastSpeciesWeights);

        if (!speciesId) {
            return null;
        }

        // WarbeastState 新战兽对象：写入运行时列表和存档。
        var warbeast = createWarbeast(speciesId, targetDefinition.id, state);

        if (!Array.isArray(state.warbeasts)) {
            state.warbeasts = [];
        }

        state.warbeasts.push(warbeast);
        game.simulation.addLog(state, "important", "掠夺队拖回战兽：" + warbeast.name + "。");
        return warbeast;
    }

    /**
     * 创建战兽对象。
     *
     * @param {string} speciesId - 战兽物种稳定 ID。
     * @param {string} sourceId - 来源掠夺目标或事件稳定 ID。
     * @param {GameState} state - 当前游戏状态对象，会读取并更新 nextWarbeastIndex 统计值。
     * @returns {WarbeastState} 新战兽运行时对象。
     */
    function createWarbeast(speciesId, sourceId, state) {
        // number 战兽序号：用于生成稳定 ID 和个体名。
        var warbeastIndex = state.statistics.nextWarbeastIndex || 0;

        // WarbeastSpeciesDefinition|null 物种定义：用于生成中文名。
        var speciesDefinition = getSpeciesDefinition(speciesId);

        state.statistics.nextWarbeastIndex = warbeastIndex + 1;

        return {
            id: "warbeast_" + warbeastIndex,
            speciesId: speciesId,
            name: createWarbeastName(speciesDefinition, warbeastIndex),
            source: sourceId,
            isTamed: false,
            breedingState: "idle",
            tamingProgress: 0,
            gestationSecondsRemaining: 0,
            restSecondsRemaining: 0
        };
    }

    /**
     * 将俘虏转化为战兽对象。
     *
     * @param {GameState} state - 当前游戏状态对象，会读取并更新 nextWarbeastIndex 统计值。
     * @param {CaptiveState} captive - 被转化的俘虏对象，不会在本函数中移出俘虏列表。
     * @returns {WarbeastState} 转化后的战兽对象；保留俘虏姓名和原种族字段。
     */
    function createWarbeastFromCaptive(state, captive) {
        // number 战兽序号：用于生成稳定 ID，非负整数。
        var warbeastIndex = state.statistics.nextWarbeastIndex || 0;

        state.statistics.nextWarbeastIndex = warbeastIndex + 1;

        return {
            id: "warbeast_" + warbeastIndex,
            speciesId: "converted_captive_beast",
            name: captive.name || captive.id,
            source: "captive_conversion",
            isTamed: false,
            breedingState: "idle",
            tamingProgress: 0,
            gestationSecondsRemaining: 0,
            restSecondsRemaining: 0,
            originalCaptiveId: captive.id,
            originalCaptiveType: captive.type,
            originalCaptiveRaceId: captive.raceId || "",
            isConvertedCaptive: true
        };
    }

    /**
     * 生成战兽个体名。
     *
     * @param {WarbeastSpeciesDefinition|null} speciesDefinition - 战兽物种定义；缺失时使用通用前缀。
     * @param {number} warbeastIndex - 战兽序号，非负整数。
     * @returns {string} 中文个体名。
     */
    function createWarbeastName(speciesDefinition, warbeastIndex) {
        // string[] 名称后缀池：按序号确定，保证同局内生成稳定。
        var nameSuffixes = [
            "裂牙",
            "湿背",
            "烂吼",
            "黑爪",
            "碎角",
            "酸舌",
            "煤眼",
            "疤脊"
        ];

        // string 物种名：缺失定义时回退为战兽。
        var speciesName = speciesDefinition ? speciesDefinition.name : "战兽";

        return speciesName + "·" + nameSuffixes[warbeastIndex % nameSuffixes.length];
    }

    /**
     * 预览战兽处置。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @param {"tame"|"breed"|"butcher"} dispositionId - 处置方式 ID。
     * @returns {Object.<string, string|number>} 预览字段字典。
     */
    function previewDisposition(state, warbeast, dispositionId) {
        // WarbeastSpeciesDefinition|null 物种定义：用于显示后代倾向和口粮。
        var speciesDefinition = getSpeciesDefinition(warbeast.speciesId);

        if (dispositionId === "tame") {
            return {
                summary: warbeast.isTamed ? "已驯化" : "推进驯化进度",
                tamingGain: TAMING_PROGRESS_GAIN,
                tamingProgress: Math.min(100, Number(warbeast.tamingProgress) + TAMING_PROGRESS_GAIN)
            };
        }

        if (dispositionId === "breed") {
            return {
                summary: "驯化战兽作为苗床，不需要洗脑",
                gestationMonths: 1,
                restMonths: 1,
                offspringTrait: speciesDefinition ? speciesDefinition.trait : "未知特质",
                foodWarning: "休养期间口粮翻倍"
            };
        }

        return {
            summary: "屠宰战兽并终止其苗床状态",
            fungusGain: game.definitions.POPULATION_CONSTANTS.warbeastButcherFungusGain
        };
    }

    /**
     * 判断战兽是否可执行处置。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @param {"tame"|"breed"|"butcher"} dispositionId - 处置方式 ID。
     * @returns {boolean} 是否可执行该处置。
     */
    function canApplyDisposition(state, warbeast, dispositionId) {
        if (!warbeast || state.isPaused) {
            return false;
        }

        if (dispositionId === "tame") {
            return !warbeast.isTamed && warbeast.breedingState !== "gestating";
        }

        if (dispositionId === "breed") {
            return warbeast.isTamed && warbeast.breedingState === "idle" && game.population.calculateFreeHousing(state) > 0;
        }

        if (dispositionId === "butcher") {
            return true;
        }

        return false;
    }

    /**
     * 执行战兽处置。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} warbeastId - 战兽稳定 ID。
     * @param {"tame"|"breed"|"butcher"} dispositionId - 处置方式 ID。
     * @returns {boolean} 是否执行成功。
     */
    function applyDisposition(state, warbeastId, dispositionId) {
        // WarbeastState|null 战兽对象：按 ID 找到本次处置目标。
        var warbeast = findWarbeastById(state, warbeastId);

        if (!canApplyDisposition(state, warbeast, dispositionId)) {
            return false;
        }

        if (dispositionId === "tame") {
            applyTaming(state, warbeast);
            return true;
        }

        if (dispositionId === "breed") {
            startBreeding(state, warbeast);
            return true;
        }

        if (dispositionId === "butcher") {
            butcherWarbeast(state, warbeast);
            return true;
        }

        return false;
    }

    /**
     * 推进战兽驯化。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入日志。
     * @param {WarbeastState} warbeast - 战兽对象，会提升驯化进度。
     * @returns {void} 无返回值。
     */
    function applyTaming(state, warbeast) {
        warbeast.tamingProgress = Math.min(100, Number(warbeast.tamingProgress) + TAMING_PROGRESS_GAIN);

        if (warbeast.tamingProgress >= 100) {
            warbeast.isTamed = true;
            game.simulation.addLog(state, "important", "战兽驯化完成：" + warbeast.name + "。");
            return;
        }

        game.simulation.addLog(state, "normal", "战兽驯化推进：" + warbeast.name + "，进度 " + Math.round(warbeast.tamingProgress) + "%。");
    }

    /**
     * 启动战兽苗床孕育。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入日志。
     * @param {WarbeastState} warbeast - 战兽对象，会进入孕育状态。
     * @returns {void} 无返回值。
     */
    function startBreeding(state, warbeast) {
        warbeast.breedingState = "gestating";
        warbeast.gestationSecondsRemaining = WARBEAST_GESTATION_SECONDS;
        warbeast.restSecondsRemaining = 0;
        game.simulation.addLog(state, "normal", "战兽苗床开始孕育：" + warbeast.name + "，需要一个月。");
    }

    /**
     * 屠宰战兽并获得固定菌菇。
     *
     * @param {GameState} state - 当前游戏状态对象，会移除战兽并增加菌菇。
     * @param {WarbeastState} warbeast - 战兽对象，会从列表中移除。
     * @returns {void} 无返回值。
     */
    function butcherWarbeast(state, warbeast) {
        // WarbeastState[] 保留列表：移除被屠宰战兽。
        var remainingWarbeasts = [];

        // number 循环索引：遍历当前战兽数组的整数下标。
        for (var warbeastIndex = 0; warbeastIndex < state.warbeasts.length; warbeastIndex += 1) {
            // WarbeastState 当前战兽：用于过滤目标 ID。
            var currentWarbeast = state.warbeasts[warbeastIndex];

            if (currentWarbeast.id !== warbeast.id) {
                remainingWarbeasts.push(currentWarbeast);
            }
        }

        state.warbeasts = remainingWarbeasts;
        game.resources.addResource(state, "fungus", game.definitions.POPULATION_CONSTANTS.warbeastButcherFungusGain);
        game.simulation.addLog(state, "important", "屠宰战兽：" + warbeast.name + "，获得菌菇 " + game.definitions.POPULATION_CONSTANTS.warbeastButcherFungusGain + "。");
    }

    /**
     * 推进战兽孕育和休养倒计时。
     *
     * @param {GameState} state - 当前游戏状态对象，会结算孕育和休养。
     * @param {number} deltaSeconds - 本次推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function updateWarbeasts(state, deltaSeconds) {
        if (!Array.isArray(state.warbeasts)) {
            state.warbeasts = [];
            return;
        }

        // number 循环索引：遍历战兽数组的整数下标。
        for (var warbeastIndex = 0; warbeastIndex < state.warbeasts.length; warbeastIndex += 1) {
            // WarbeastState 当前战兽：推进该个体倒计时。
            var warbeast = state.warbeasts[warbeastIndex];

            updateSingleWarbeast(state, warbeast, deltaSeconds);
        }
    }

    /**
     * 推进单只战兽状态。
     *
     * @param {GameState} state - 当前游戏状态对象，孕育完成时会新增哥布林。
     * @param {WarbeastState} warbeast - 战兽对象，会改写倒计时字段。
     * @param {number} deltaSeconds - 本次推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function updateSingleWarbeast(state, warbeast, deltaSeconds) {
        if (warbeast.breedingState === "gestating") {
            warbeast.gestationSecondsRemaining = Math.max(0, Number(warbeast.gestationSecondsRemaining) - deltaSeconds);

            if (warbeast.gestationSecondsRemaining <= 0) {
                resolveBreeding(state, warbeast);
            }
            return;
        }

        if (warbeast.breedingState === "resting") {
            warbeast.restSecondsRemaining = Math.max(0, Number(warbeast.restSecondsRemaining) - deltaSeconds);

            if (warbeast.restSecondsRemaining <= 0) {
                warbeast.breedingState = "idle";
                game.simulation.addLog(state, "normal", "战兽休养完成：" + warbeast.name + "。");
            }
        }
    }

    /**
     * 结算战兽苗床孕育。
     *
     * @param {GameState} state - 当前游戏状态对象，会新增哥布林。
     * @param {WarbeastState} warbeast - 战兽对象，会进入休养状态。
     * @returns {void} 无返回值。
     */
    function resolveBreeding(state, warbeast) {
        // Goblin 新生哥布林对象：由战兽苗床生成并应用物种偏置。
        var newGoblin = game.population.createGoblin(state, "warbeast_bed");

        applyWarbeastOffspringBonus(newGoblin, warbeast);
        state.goblins.push(newGoblin);
        warbeast.breedingState = "resting";
        warbeast.gestationSecondsRemaining = 0;
        warbeast.restSecondsRemaining = WARBEAST_REST_SECONDS;
        game.simulation.addLog(state, "important", "战兽苗床产出新哥布林：" + newGoblin.name + "。");
    }

    /**
     * 给战兽苗床后代应用属性和特质倾向。
     *
     * @param {Goblin} goblin - 新生哥布林对象，会被修改。
     * @param {WarbeastState} warbeast - 战兽对象，用于读取物种偏置。
     * @returns {void} 无返回值。
     */
    function applyWarbeastOffspringBonus(goblin, warbeast) {
        // WarbeastSpeciesDefinition|null 物种定义：控制后代属性偏置。
        var speciesDefinition = getSpeciesDefinition(warbeast.speciesId);

        if (!speciesDefinition) {
            return;
        }

        // string[] 属性 ID 数组：遍历物种定义中的属性加成。
        var attributeIds = Object.keys(speciesDefinition.attributeBonus || {});

        // number 循环索引：遍历属性加成键的整数下标。
        for (var attributeIndex = 0; attributeIndex < attributeIds.length; attributeIndex += 1) {
            // string 属性 ID：对应哥布林 attributes 字典中的键。
            var attributeId = attributeIds[attributeIndex];

            // number 属性加成：非负或有符号整数点。
            var attributeBonus = Number(speciesDefinition.attributeBonus[attributeId]) || 0;

            goblin.attributes[attributeId] = Math.max(1, Math.min(10, (Number(goblin.attributes[attributeId]) || 1) + attributeBonus));
        }

        goblin.traits.push(speciesDefinition.offspringTraitHint);
    }

    /**
     * 计算战兽口粮口数。
     *
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @returns {number} 口粮口数，非负浮点数；休养时翻倍。
     */
    function calculateFoodConsumerUnits(warbeast) {
        // WarbeastSpeciesDefinition|null 物种定义：读取基础口粮倍率。
        var speciesDefinition = getSpeciesDefinition(warbeast.speciesId);

        // number 基础口粮倍率：缺失定义时按 1 个标准人口口粮处理。
        var baseRatio = speciesDefinition ? Math.max(0, Number(speciesDefinition.foodConsumptionRatio) || 1) : 1;

        return warbeast.breedingState === "resting" ? baseRatio * 2 : baseRatio;
    }

    /**
     * 按 ID 查找战兽。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} warbeastId - 战兽稳定 ID。
     * @returns {WarbeastState|null} 匹配的战兽对象；找不到时返回 null。
     */
    function findWarbeastById(state, warbeastId) {
        if (!Array.isArray(state.warbeasts)) {
            return null;
        }

        // number 循环索引：遍历战兽数组的整数下标。
        for (var warbeastIndex = 0; warbeastIndex < state.warbeasts.length; warbeastIndex += 1) {
            // WarbeastState 当前战兽：用于匹配稳定 ID。
            var warbeast = state.warbeasts[warbeastIndex];

            if (warbeast.id === warbeastId) {
                return warbeast;
            }
        }

        return null;
    }

    /**
     * 从权重数组中随机选择 ID。
     *
     * @param {WeightedId[]} weightedIds - 权重数组；id 为稳定 ID，weight 为非负权重。
     * @returns {string|null} 选中的稳定 ID；无有效权重时返回 null。
     */
    function chooseWeightedId(weightedIds) {
        if (!Array.isArray(weightedIds) || weightedIds.length <= 0) {
            return null;
        }

        // number 权重总和：只累加正数权重。
        var totalWeight = 0;

        // number 权重循环索引：遍历候选数组的整数下标。
        for (var weightIndex = 0; weightIndex < weightedIds.length; weightIndex += 1) {
            // WeightedId 当前权重项：读取 id 和 weight。
            var weightedId = weightedIds[weightIndex];

            totalWeight += Math.max(0, Number(weightedId.weight) || 0);
        }

        if (totalWeight <= 0) {
            return null;
        }

        // number 随机权重游标：落在哪个累计区间就选择哪个 ID。
        var roll = Math.random() * totalWeight;

        // number 选择循环索引：遍历候选数组的整数下标。
        for (var selectIndex = 0; selectIndex < weightedIds.length; selectIndex += 1) {
            // WeightedId 当前候选项：用于扣减随机游标。
            var candidate = weightedIds[selectIndex];

            roll -= Math.max(0, Number(candidate.weight) || 0);
            if (roll <= 0) {
                return candidate.id;
            }
        }

        return weightedIds[weightedIds.length - 1].id;
    }

    // Object 战兽系统命名空间：提供捕获、处置、更新和口粮计算。
    game.warbeastsSystem = {
        getSpeciesDefinition: getSpeciesDefinition,
        tryCaptureFromRaidTarget: tryCaptureFromRaidTarget,
        createWarbeast: createWarbeast,
        createWarbeastFromCaptive: createWarbeastFromCaptive,
        previewDisposition: previewDisposition,
        canApplyDisposition: canApplyDisposition,
        applyDisposition: applyDisposition,
        updateWarbeasts: updateWarbeasts,
        calculateFoodConsumerUnits: calculateFoodConsumerUnits,
        findWarbeastById: findWarbeastById
    };
})(window.GoblinEmpire);
