/* 天气系统：负责地穴天气轮换、存档状态规范化和生产倍率查询。 */
/**
 * 初始化天气系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 weather 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 默认最短天气持续天数：旧存档补齐天气时使用的正整数游戏日。
    var DEFAULT_WEATHER_MIN_DURATION_DAYS = 30;

    // number 天气随机种子最大值：用于生成每局独立的非负整数种子。
    var WEATHER_RANDOM_SEED_MAX = 2147483647;

    /**
     * 创建初始天气状态。
     *
     * @returns {WeatherState} 天气运行时状态；新局从稳潮开始。
     */
    function createInitialWeather() {
        // number 天气随机种子：每个新局独立生成，保存后用于稳定天气序列。
        var randomSeed = createWeatherRandomSeed();

        // WeatherDefinition|null 初始天气定义：新局以稳潮开局，并按天气定义抽取首段持续时间。
        var initialWeatherDefinition = getWeatherDefinition("clear");

        // number 初始天气持续天数：单位游戏日，定义缺失时使用默认最短时长。
        var initialDurationDays = initialWeatherDefinition ? calculateWeatherDurationDays(initialWeatherDefinition, 0, randomSeed) : DEFAULT_WEATHER_MIN_DURATION_DAYS;

        return {
            currentWeatherId: "clear",
            startedElapsedDay: 0,
            nextChangeElapsedDay: initialDurationDays,
            randomSeed: randomSeed
        };
    }

    /**
     * 规范化天气状态，补齐旧存档缺失字段。
     *
     * @param {Object|null|undefined} savedWeather - 存档中的天气状态，可能为空或来自旧版本。
     * @param {CalendarState=} calendarState - 当前日期状态；省略时按第 0 天处理。
     * @returns {WeatherState} 规范化后的天气运行时状态。
     */
    function normalizeWeatherState(savedWeather, calendarState) {
        // Object 原始天气状态：读取旧存档字段并逐项兜底。
        var rawWeather = savedWeather || {};

        // number 当前完整游戏日：用于确保下次天气变化日在未来。
        var elapsedDays = calendarState ? Math.max(0, Math.floor(Number(calendarState.elapsedDays) || 0)) : 0;

        // string 当前天气 ID：必须匹配天气定义，否则回退稳潮。
        var currentWeatherId = isKnownWeatherId(rawWeather.currentWeatherId) ? rawWeather.currentWeatherId : "clear";

        // number 天气随机种子：每个存档独立保存，旧存档缺失时补一个新种子。
        var randomSeed = normalizeWeatherRandomSeed(rawWeather.randomSeed);

        // number 天气开始日：非负整数游戏日，不能晚于当前日。
        var startedElapsedDay = Math.min(elapsedDays, Math.max(0, Math.floor(Number(rawWeather.startedElapsedDay) || 0)));

        // number 下次变化日：非负整数游戏日，必须大于当前日。
        var nextChangeElapsedDay = Math.floor(Number(rawWeather.nextChangeElapsedDay) || 0);

        if (nextChangeElapsedDay <= elapsedDays) {
            // WeatherDefinition|null 当前天气定义：旧存档缺少下次变化日时，用当前天气规则补齐一段 30-90 天游玩周期。
            var currentWeatherDefinition = getWeatherDefinition(currentWeatherId);

            // number 补齐持续天数：单位游戏日，定义缺失时使用默认最短时长。
            var fallbackDurationDays = currentWeatherDefinition ? calculateWeatherDurationDays(currentWeatherDefinition, elapsedDays, randomSeed) : DEFAULT_WEATHER_MIN_DURATION_DAYS;

            nextChangeElapsedDay = elapsedDays + fallbackDurationDays;
        }

        return {
            currentWeatherId: currentWeatherId,
            startedElapsedDay: startedElapsedDay,
            nextChangeElapsedDay: nextChangeElapsedDay,
            randomSeed: randomSeed
        };
    }

    /**
     * 推进天气状态，在持续时间结束后切换到下一种天气。
     *
     * @param {GameState} state - 当前游戏状态对象，会直接修改 weather 字段。
     * @returns {void} 无返回值。
     */
    function updateWeather(state) {
        if (!state.weather) {
            state.weather = createInitialWeather();
        }

        // number 天气随机种子：旧运行状态缺失时补齐并写回，保证后续轮换使用同一局随机源。
        var randomSeed = normalizeWeatherRandomSeed(state.weather.randomSeed);

        state.weather.randomSeed = randomSeed;

        // CalendarState 日期状态：用于读取完整游戏日和季节。
        var calendarState = state.calendar || game.calendar.createInitialCalendar();

        // number 当前完整游戏日：天气只在新游戏日边界后切换。
        var elapsedDays = Math.max(0, Math.floor(Number(calendarState.elapsedDays) || 0));

        if (elapsedDays < state.weather.nextChangeElapsedDay) {
            return;
        }

        // WeatherDefinition 下一天气定义：按季节权重、日期和存档随机种子确定性选择。
        var nextWeatherDefinition = chooseNextWeatherDefinition(state.weather.currentWeatherId, elapsedDays, randomSeed);

        // number 下一段持续日数：由天气定义、日期和存档随机种子确定，单位游戏日。
        var durationDays = calculateWeatherDurationDays(nextWeatherDefinition, elapsedDays, randomSeed);

        state.weather.currentWeatherId = nextWeatherDefinition.id;
        state.weather.startedElapsedDay = elapsedDays;
        state.weather.nextChangeElapsedDay = elapsedDays + durationDays;

        if (game.simulation && game.simulation.addLog) {
            game.simulation.addLog(state, "normal", "天气转为" + nextWeatherDefinition.name + "：" + nextWeatherDefinition.description);
        }
    }

    /**
     * 获取当前天气定义。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {WeatherDefinition} 当前天气定义；缺失时回退稳潮。
     */
    function getCurrentWeatherDefinition(state) {
        // string 当前天气 ID：从运行状态读取，缺失时按稳潮处理。
        var currentWeatherId = state.weather ? state.weather.currentWeatherId : "clear";

        // WeatherDefinition|null 天气定义：按稳定 ID 查找。
        var weatherDefinition = getWeatherDefinition(currentWeatherId);

        return weatherDefinition || getWeatherDefinition("clear");
    }

    /**
     * 按稳定 ID 取得天气定义。
     *
     * @param {string} weatherId - 天气稳定 ID。
     * @returns {WeatherDefinition|null} 天气定义；未找到时返回 null。
     */
    function getWeatherDefinition(weatherId) {
        // number 循环索引：遍历天气定义数组的整数下标。
        for (var weatherIndex = 0; weatherIndex < game.definitions.WEATHER_DEFINITIONS.length; weatherIndex += 1) {
            // WeatherDefinition 当前天气定义：用于匹配稳定 ID。
            var weatherDefinition = game.definitions.WEATHER_DEFINITIONS[weatherIndex];

            if (weatherDefinition.id === weatherId) {
                return weatherDefinition;
            }
        }

        return null;
    }

    /**
     * 计算当前天气效果字典。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object.<string, number>} 天气效果字典；key 为效果 ID，value 为加成比例。
     */
    function getWeatherEffects(state) {
        // WeatherDefinition 当前天气定义：用于读取效果字典。
        var weatherDefinition = getCurrentWeatherDefinition(state);

        return weatherDefinition.effects || {};
    }

    /**
     * 计算指定资源的天气产出倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 资源稳定 ID。
     * @returns {number} 天气产出倍率，至少为 0。
     */
    function calculateResourceOutputMultiplier(state, resourceId) {
        // Object.<string, number> 天气效果字典：读取资源类别加成。
        var weatherEffects = getWeatherEffects(state);

        // number 加成比例：按资源所属生产类别选择天气影响。
        var ratioBonus = 0;

        if (resourceId === "fungus") {
            ratioBonus += weatherEffects.fungusOutputRatio || 0;
        }

        if (resourceId === "rottenWood") {
            ratioBonus += weatherEffects.rottenWoodOutputRatio || 0;
        }

        if (resourceId === "rubble" || resourceId === "coalSlag" || resourceId === "ironOre") {
            ratioBonus += weatherEffects.miningOutputRatio || 0;
        }

        if (resourceId === "ironPlate" || resourceId === "steelIngot" || resourceId === "blackIron") {
            ratioBonus += weatherEffects.industrialOutputRatio || 0;
        }

        ratioBonus = applyWeatherOutputControls(state, ratioBonus);

        return Math.max(0, 1 + ratioBonus);
    }

    /**
     * 计算指定职业的天气产出倍率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {JobDefinition} jobDefinition - 职业定义对象。
     * @returns {number} 天气职业产出倍率，至少为 0。
     */
    function calculateJobOutputMultiplier(state, jobDefinition) {
        // string[] 产出资源 ID 数组：用于找到该职业受影响最大的资源类别。
        var outputResourceIds = Object.keys(jobDefinition.baseOutput);

        // number 最低倍率：多资源职业取最低天气倍率，避免负面天气被其他产出绕开。
        var lowestMultiplier = 1;

        // number 循环索引：遍历职业产出资源 ID 的整数下标。
        for (var resourceIndex = 0; resourceIndex < outputResourceIds.length; resourceIndex += 1) {
            // ResourceId 当前资源 ID：用于查询资源天气倍率。
            var resourceId = outputResourceIds[resourceIndex];

            // number 当前资源倍率：至少为 0。
            var resourceMultiplier = calculateResourceOutputMultiplier(state, resourceId);

            lowestMultiplier = Math.min(lowestMultiplier, resourceMultiplier);
        }

        return lowestMultiplier;
    }

    /**
     * 格式化当前天气状态文本。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 天气状态中文文本，包含名称和剩余日数。
     */
    function formatCurrentWeather(state) {
        // WeatherDefinition 当前天气定义：用于显示名称。
        var weatherDefinition = getCurrentWeatherDefinition(state);

        // number 当前完整游戏日：用于计算剩余天数。
        var elapsedDays = state.calendar ? Math.max(0, Math.floor(Number(state.calendar.elapsedDays) || 0)) : 0;

        // number 剩余游戏日：至少为 0 的整数天数。
        var remainingDays = state.weather ? Math.max(0, state.weather.nextChangeElapsedDay - elapsedDays) : DEFAULT_WEATHER_MIN_DURATION_DAYS;

        return weatherDefinition.name + "（约 " + remainingDays + " 日）";
    }

    /**
     * 格式化当前天气影响摘要。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 天气影响中文摘要；无影响时返回常态文本。
     */
    function formatWeatherEffectSummary(state) {
        // Object.<string, number> 天气效果字典：用于生成摘要。
        var weatherEffects = getWeatherEffects(state);

        // string[] 摘要文本数组：逐项描述非零天气效果。
        var summaryTexts = [];

        appendEffectSummary(summaryTexts, "菌菇", applyWeatherOutputControls(state, weatherEffects.fungusOutputRatio || 0));
        appendEffectSummary(summaryTexts, "朽木", applyWeatherOutputControls(state, weatherEffects.rottenWoodOutputRatio || 0));
        appendEffectSummary(summaryTexts, "矿道", applyWeatherOutputControls(state, weatherEffects.miningOutputRatio || 0));
        appendEffectSummary(summaryTexts, "炉火", applyWeatherOutputControls(state, weatherEffects.industrialOutputRatio || 0));
        appendEffectSummary(summaryTexts, "洗脑消耗", weatherEffects.captiveBrainwashCostRatio || 0);
        appendEffectSummary(summaryTexts, "洗脑提升", weatherEffects.captiveBrainwashGainRatio || 0);
        appendEffectSummary(summaryTexts, "孕育失败", weatherEffects.captiveBreedingFailureRiskRatio || 0);

        if (weatherEffects.captiveNewbornAttributePenalty) {
            summaryTexts.push("新生属性-" + weatherEffects.captiveNewbornAttributePenalty);
        }

        if (summaryTexts.length === 0) {
            return "无生产修正";
        }

        return summaryTexts.join("，");
    }

    /**
     * 应用天气调控建筑对资源产出天气比例的修正。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {number} ratioBonus - 天气对资源产出的原始加成比例，可正可负。
     * @returns {number} 调控后的天气加成比例，可正可负。
     */
    function applyWeatherOutputControls(state, ratioBonus) {
        if (Math.abs(ratioBonus) < 0.001) {
            return 0;
        }

        if (ratioBonus > 0) {
            // number 有利天气放大比例：由孢潮闸等建筑按拥有数累加。
            var amplificationRatio = getOwnedWeatherEffectTotal(state, "weatherPositiveAmplificationRatio");

            return ratioBonus * (1 + Math.max(0, amplificationRatio));
        }

        // number 恶劣天气削弱比例：由潮痕桩和通风井按拥有数累加，最多削弱 85% 负面影响。
        var mitigationRatio = Math.min(0.85, Math.max(0, getOwnedWeatherEffectTotal(state, "weatherNegativeMitigationRatio")));

        return ratioBonus * (1 - mitigationRatio);
    }

    /**
     * 汇总已拥有天气建筑的指定效果。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} effectId - 天气建筑效果 ID。
     * @returns {number} 效果总和，非负或有符号浮点数，取决于效果定义。
     */
    function getOwnedWeatherEffectTotal(state, effectId) {
        if (!state || !state.buildingsById) {
            return 0;
        }

        // number 效果总和：按已拥有建筑数量累加。
        var effectTotal = 0;

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取指定天气调控效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取已拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (!buildingState || buildingState.owned <= 0 || !buildingDefinition.effects[effectId]) {
                continue;
            }

            effectTotal += buildingDefinition.effects[effectId] * buildingState.owned;
        }

        return effectTotal;
    }

    /**
     * 判断天气 ID 是否存在于定义表。
     *
     * @param {string} weatherId - 待检查天气稳定 ID。
     * @returns {boolean} 是否为已知天气 ID；true 表示可用于运行状态。
     */
    function isKnownWeatherId(weatherId) {
        return Boolean(getWeatherDefinition(weatherId));
    }

    /**
     * 按季节权重、日期和存档随机种子选择下一种天气。
     *
     * @param {string} currentWeatherId - 当前天气稳定 ID，用于降低连续重复概率。
     * @param {number} elapsedDays - 当前完整游戏日，非负整数天。
     * @param {number} randomSeed - 当前存档天气随机种子，非负整数。
     * @returns {WeatherDefinition} 下一天气定义。
     */
    function chooseNextWeatherDefinition(currentWeatherId, elapsedDays, randomSeed) {
        // Object 季节日期：包含季节索引，用于读取四季权重。
        var seasonalDate = game.calendar.getSeasonalDate(elapsedDays);

        // number 权重总和：所有候选天气的非负权重总量。
        var weightTotal = 0;

        // number 循环索引：遍历天气定义数组的整数下标。
        for (var weatherIndex = 0; weatherIndex < game.definitions.WEATHER_DEFINITIONS.length; weatherIndex += 1) {
            // WeatherDefinition 当前天气定义：用于累计季节权重。
            var weatherDefinition = game.definitions.WEATHER_DEFINITIONS[weatherIndex];

            weightTotal += getSeasonWeight(weatherDefinition, seasonalDate.seasonIndex, currentWeatherId);
        }

        if (weightTotal <= 0) {
            return getWeatherDefinition("clear");
        }

        // number 随机槽位：由日期和存档随机种子产生的确定性权重位置。
        var weightedRoll = deterministicRatio(elapsedDays, randomSeed, 17) * weightTotal;

        // number 累计权重：用于找到命中的天气定义。
        var accumulatedWeight = 0;

        // number 选择循环索引：遍历天气定义数组的整数下标。
        for (var choiceIndex = 0; choiceIndex < game.definitions.WEATHER_DEFINITIONS.length; choiceIndex += 1) {
            // WeatherDefinition 候选天气定义：用于判断权重命中。
            var candidateDefinition = game.definitions.WEATHER_DEFINITIONS[choiceIndex];

            accumulatedWeight += getSeasonWeight(candidateDefinition, seasonalDate.seasonIndex, currentWeatherId);

            if (weightedRoll <= accumulatedWeight) {
                return candidateDefinition;
            }
        }

        return game.definitions.WEATHER_DEFINITIONS[0];
    }

    /**
     * 计算天气在当前季节的有效权重。
     *
     * @param {WeatherDefinition} weatherDefinition - 天气定义对象。
     * @param {number} seasonIndex - 季节索引，0 为春，1 为夏，2 为秋，3 为冬。
     * @param {string} currentWeatherId - 当前天气稳定 ID。
     * @returns {number} 有效权重，非负数。
     */
    function getSeasonWeight(weatherDefinition, seasonIndex, currentWeatherId) {
        // number 原始权重：来自天气定义的四季权重数组。
        var baseWeight = Math.max(0, Number(weatherDefinition.seasonWeights[seasonIndex]) || 0);

        if (weatherDefinition.id === currentWeatherId) {
            return baseWeight * 0.35;
        }

        return baseWeight;
    }

    /**
     * 计算天气持续天数。
     *
     * @param {WeatherDefinition} weatherDefinition - 天气定义对象。
     * @param {number} elapsedDays - 当前完整游戏日，非负整数天。
     * @param {number} randomSeed - 当前存档天气随机种子，非负整数。
     * @returns {number} 天气持续游戏日数，正整数。
     */
    function calculateWeatherDurationDays(weatherDefinition, elapsedDays, randomSeed) {
        // number 最短持续天数：来自天气定义，至少为 1。
        var minDurationDays = Math.max(1, Math.floor(weatherDefinition.minDurationDays));

        // number 最长持续天数：来自天气定义，至少等于最短持续天数。
        var maxDurationDays = Math.max(minDurationDays, Math.floor(weatherDefinition.maxDurationDays));

        // number 持续天数跨度：包含端点的可选整数数量。
        var durationSpan = maxDurationDays - minDurationDays + 1;

        // number 持续偏移：由日期和存档随机种子产生的非负整数。
        var durationOffset = Math.floor(deterministicRatio(elapsedDays, randomSeed, 41) * durationSpan);

        return minDurationDays + Math.min(durationSpan - 1, durationOffset);
    }

    /**
     * 追加单项天气效果摘要。
     *
     * @param {string[]} summaryTexts - 摘要文本数组，会追加非零效果。
     * @param {string} labelText - 效果中文标签。
     * @param {number} ratio - 加成比例，有符号小数。
     * @returns {void} 无返回值。
     */
    function appendEffectSummary(summaryTexts, labelText, ratio) {
        if (Math.abs(ratio) < 0.001) {
            return;
        }

        summaryTexts.push(labelText + (ratio >= 0 ? "+" : "") + Math.round(ratio * 100) + "%");
    }

    /**
     * 根据日期和存档随机种子生成 0-1 确定性比例。
     *
     * @param {number} elapsedDays - 当前完整游戏日，非负整数天。
     * @param {number} randomSeed - 当前存档天气随机种子，非负整数。
     * @param {number} salt - 扰动整数，用于区分选择和持续时间。
     * @returns {number} 确定性比例，范围为 0-1。
     */
    function deterministicRatio(elapsedDays, randomSeed, salt) {
        // number 种子值：由日期、存档随机种子和扰动常数组合。
        var seed = (Math.floor(elapsedDays) + 1) * 1103515245 + randomSeed * 2654435761 + salt * 12345;

        // number 正弦片段：用于产生轻量确定性伪随机值。
        var sineValue = Math.sin(seed) * 10000;

        return sineValue - Math.floor(sineValue);
    }

    /**
     * 创建天气随机种子，用于让不同新局拥有不同天气序列。
     *
     * @returns {number} 天气随机种子，范围为 1 到 WEATHER_RANDOM_SEED_MAX 的整数。
     */
    function createWeatherRandomSeed() {
        // number 时间种子：当前毫秒时间取模后的非负整数。
        var timeSeed = Date.now() % WEATHER_RANDOM_SEED_MAX;

        // number 浏览器随机种子：当前新局随机值映射成的非负整数。
        var randomPart = Math.floor(Math.random() * WEATHER_RANDOM_SEED_MAX);

        return Math.max(1, Math.floor((timeSeed + randomPart) % WEATHER_RANDOM_SEED_MAX));
    }

    /**
     * 规范化天气随机种子，旧存档缺失时生成新的存档级种子。
     *
     * @param {number|undefined} savedRandomSeed - 存档中的天气随机种子，可能缺失或无效。
     * @returns {number} 有效天气随机种子，范围为 1 到 WEATHER_RANDOM_SEED_MAX 的整数。
     */
    function normalizeWeatherRandomSeed(savedRandomSeed) {
        // number 已保存种子：从存档字段转为整数，用于判断是否可复用。
        var parsedSeed = Math.floor(Number(savedRandomSeed) || 0);

        if (parsedSeed > 0) {
            return parsedSeed % WEATHER_RANDOM_SEED_MAX || WEATHER_RANDOM_SEED_MAX;
        }

        return createWeatherRandomSeed();
    }

    // Object 天气系统命名空间：提供天气状态、推进、查询和格式化函数。
    game.weather = {
        createInitialWeather: createInitialWeather,
        normalizeWeatherState: normalizeWeatherState,
        updateWeather: updateWeather,
        getWeatherDefinition: getWeatherDefinition,
        getCurrentWeatherDefinition: getCurrentWeatherDefinition,
        getWeatherEffects: getWeatherEffects,
        calculateResourceOutputMultiplier: calculateResourceOutputMultiplier,
        calculateJobOutputMultiplier: calculateJobOutputMultiplier,
        applyWeatherOutputControls: applyWeatherOutputControls,
        formatCurrentWeather: formatCurrentWeather,
        formatWeatherEffectSummary: formatWeatherEffectSummary
    };
})(window.GoblinEmpire);
