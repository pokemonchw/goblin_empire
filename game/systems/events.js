/* 事件系统：负责随机事件检查、冷却、临时效果和事故结果。 */
/**
 * 初始化事件系统模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 eventsSystem 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 事件检查间隔：每隔固定秒数评估一次事件概率。
    var EVENT_CHECK_INTERVAL_SECONDS = 5;

    /**
     * 推进事件计时和随机检查。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function updateEvents(state, deltaSeconds) {
        decrementTemporaryEffects(state, deltaSeconds);
        decrementEventCooldowns(state, deltaSeconds);

        // number 事件检查进度：保存在统计中以保持可检查。
        var eventCheckProgress = state.statistics.eventCheckProgress || 0;

        eventCheckProgress += deltaSeconds;

        while (eventCheckProgress >= EVENT_CHECK_INTERVAL_SECONDS) {
            eventCheckProgress -= EVENT_CHECK_INTERVAL_SECONDS;
            evaluateEventList(state);
        }

        state.statistics.eventCheckProgress = eventCheckProgress;
    }

    /**
     * 递减临时效果倒计时。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function decrementTemporaryEffects(state, deltaSeconds) {
        state.statistics.fungusBloomSeconds = Math.max(0, (state.statistics.fungusBloomSeconds || 0) - deltaSeconds);
        state.statistics.ritualFestivalSeconds = Math.max(0, (state.statistics.ritualFestivalSeconds || 0) - deltaSeconds);
        state.statistics.eventRiskPulseSeconds = Math.max(0, (state.statistics.eventRiskPulseSeconds || 0) - deltaSeconds);
    }

    /**
     * 递减事件冷却。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function decrementEventCooldowns(state, deltaSeconds) {
        // number 循环索引：遍历事件定义数组的整数下标。
        for (var eventIndex = 0; eventIndex < game.definitions.EVENT_DEFINITIONS.length; eventIndex += 1) {
            // EventDefinition 当前事件定义：用于读取冷却统计键。
            var eventDefinition = game.definitions.EVENT_DEFINITIONS[eventIndex];

            // string 冷却统计键：保存该事件剩余冷却秒数。
            var cooldownKey = getCooldownKey(eventDefinition.id);

            state.statistics[cooldownKey] = Math.max(0, (state.statistics[cooldownKey] || 0) - deltaSeconds);
        }
    }

    /**
     * 评估事件列表。
     *
     * @param {GameState} state - 当前游戏状态对象，可能被事件效果修改。
     * @returns {void} 无返回值。
     */
    function evaluateEventList(state) {
        // number 循环索引：遍历事件定义数组的整数下标。
        for (var eventIndex = 0; eventIndex < game.definitions.EVENT_DEFINITIONS.length; eventIndex += 1) {
            // EventDefinition 当前事件定义：用于判断条件和概率。
            var eventDefinition = game.definitions.EVENT_DEFINITIONS[eventIndex];

            if (!canTriggerEvent(state, eventDefinition)) {
                continue;
            }

            // 事件概率受服从和稳固类加成压制，避免事故在玩家治理良好时过度打断。
            if (Math.random() < calculateEventChance(state, eventDefinition)) {
                triggerEvent(state, eventDefinition.id);
            }
        }
    }

    /**
     * 判断事件是否可触发。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {boolean} 是否可触发；true 表示条件满足且不在冷却。
     */
    function canTriggerEvent(state, eventDefinition) {
        if ((state.statistics[getCooldownKey(eventDefinition.id)] || 0) > 0) {
            return false;
        }

        if (eventDefinition.conditionId === "has_fungus_economy") {
            return state.buildingsById.fungus_bed && state.buildingsById.fungus_bed.owned > 0;
        }

        if (eventDefinition.conditionId === "has_mines_and_low_obedience") {
            return state.buildingsById.shallow_mine && state.buildingsById.shallow_mine.owned > 0 && getObedienceValue(state) < 80;
        }

        if (eventDefinition.conditionId === "has_furnace_industry") {
            return state.buildingsById.crude_furnace && state.buildingsById.crude_furnace.owned > 0;
        }

        if (eventDefinition.conditionId === "has_ancestral_altar") {
            return state.buildingsById.ancestral_altar && state.buildingsById.ancestral_altar.owned > 0;
        }

        if (eventDefinition.conditionId === "has_black_market") {
            return state.buildingsById.black_market && state.buildingsById.black_market.owned > 0;
        }

        if (eventDefinition.conditionId === "has_chief_hall_low_obedience") {
            return state.buildingsById.chief_hall && state.buildingsById.chief_hall.owned > 0 && getObedienceValue(state) < 90;
        }

        if (eventDefinition.conditionId === "has_abyss_gate") {
            return state.buildingsById.abyss_gate && state.buildingsById.abyss_gate.owned > 0;
        }

        if (eventDefinition.conditionId === "current_weather") {
            return canTriggerWeatherEvent(state, eventDefinition);
        }

        return false;
    }

    /**
     * 计算事件触发概率。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {number} 本次检查触发概率，范围 0-1。
     */
    function calculateEventChance(state, eventDefinition) {
        // number 服从风险倍率：服从越高，事故类事件概率越低。
        var obedienceRiskModifier = Math.max(0.5, Math.min(2, 1 + (100 - getObedienceValue(state)) / 100));

        // Object.<string, number> 政策效果字典：读取事故风险和稳固修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 祖灵升级效果字典：读取骸骨护符等事故修正。
        var ritualEffects = game.rituals ? game.rituals.getRitualEffects(state) : {};

        // Object.<string, number> 契约效果字典：读取深渊契约事故修正。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 稳固减免比例：由统计和政策共同提供，范围在最终公式中钳制。
        var stabilityRatio = (state.statistics.stabilityRatio || 0) + (policyEffects.eventStabilityRatio || 0) + (ritualEffects.eventStabilityRatio || 0);

        // number 事故风险倍率：深挖和血月等政策会提高事故概率。
        var eventRiskMultiplier = 1 + (policyEffects.eventRiskRatio || 0) + (pactEffects.eventRiskRatio || 0);

        if ((state.statistics.eventRiskPulseSeconds || 0) > 0) {
            eventRiskMultiplier += 0.1;
        }

        if (game.challengesSystem) {
            // Object.<string, number> 挑战规则效果字典：叛乱时代会提高事故风险。
            var challengeRuleEffects = game.challengesSystem.getRuleEffects(state);

            eventRiskMultiplier += challengeRuleEffects.eventRiskRatio || 0;
        }

        if (eventDefinition.riskMode === "neutral" || eventDefinition.id === "fungus_bloom") {
            return eventDefinition.baseChancePerCheck;
        }

        if (eventDefinition.id === "blood_moon_festival") {
            return eventDefinition.baseChancePerCheck;
        }

        return Math.max(0, Math.min(1, eventDefinition.baseChancePerCheck * obedienceRiskModifier * eventRiskMultiplier * (1 - Math.max(0, Math.min(0.9, stabilityRatio)))));
    }

    /**
     * 触发指定事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会被事件效果直接修改。
     * @param {string} eventId - 事件稳定 ID。
     * @returns {boolean} 是否触发成功；true 表示事件效果已应用。
     */
    function triggerEvent(state, eventId) {
        // EventDefinition|null 事件定义：用于读取日志等级和冷却。
        var eventDefinition = getEventDefinition(eventId);

        if (!eventDefinition || !canTriggerEvent(state, eventDefinition)) {
            return false;
        }

        if (eventId === "fungus_bloom") {
            applyFungusBloom(state, eventDefinition);
            return true;
        }

        if (eventId === "mine_collapse") {
            applyMineCollapse(state, eventDefinition);
            return true;
        }

        if (eventId === "furnace_burst") {
            applyFurnaceBurst(state, eventDefinition);
            return true;
        }

        if (eventId === "blood_moon_festival") {
            applyBloodMoonFestival(state, eventDefinition);
            return true;
        }

        if (eventId === "caravan_passed") {
            applyCaravanPassed(state, eventDefinition);
            return true;
        }

        if (eventId === "chief_roar") {
            applyChiefRoar(state, eventDefinition);
            return true;
        }

        if (eventId === "abyss_whisper_event") {
            applyAbyssWhisper(state, eventDefinition);
            return true;
        }

        if (eventDefinition.conditionId === "current_weather") {
            applyWeatherEvent(state, eventDefinition);
            return true;
        }

        return false;
    }

    /**
     * 取得事件定义。
     *
     * @param {string} eventId - 事件稳定 ID。
     * @returns {EventDefinition|null} 事件定义；未找到时返回 null。
     */
    function getEventDefinition(eventId) {
        // number 循环索引：遍历事件定义数组的整数下标。
        for (var eventIndex = 0; eventIndex < game.definitions.EVENT_DEFINITIONS.length; eventIndex += 1) {
            // EventDefinition 当前事件定义：用于匹配事件 ID。
            var eventDefinition = game.definitions.EVENT_DEFINITIONS[eventIndex];

            if (eventDefinition.id === eventId) {
                return eventDefinition;
            }
        }

        return null;
    }

    /**
     * 应用菌潮事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入临时效果。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {void} 无返回值。
     */
    function applyFungusBloom(state, eventDefinition) {
        state.statistics.fungusBloomSeconds = 60;
        setCooldown(state, eventDefinition);
        game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，菌菇产出暂时提高。");
    }

    /**
     * 应用矿塌事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会伤害具体矿工或损失碎石。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {void} 无返回值。
     */
    function applyMineCollapse(state, eventDefinition) {
        // Goblin|null 受伤矿工：优先选择正在采矿的具体哥布林。
        var woundedGoblin = findWorkerByJob(state, "miner");

        if (woundedGoblin) {
            woundedGoblin.wounds.push("mine_collapse");
            game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，" + woundedGoblin.name + " 被塌落碎石砸伤。");
        } else {
            state.resourcesById.rubble.value = Math.max(0, state.resourcesById.rubble.value - 20);
            game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，碎石堆损失 20。");
        }

        setCooldown(state, eventDefinition);
    }

    /**
     * 应用熔炉爆燃事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会损失资源并可能伤害熔炼工。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {void} 无返回值。
     */
    function applyFurnaceBurst(state, eventDefinition) {
        // Goblin|null 受伤熔炼工：优先选择正在熔炼的具体哥布林。
        var woundedGoblin = findWorkerByJob(state, "smelter");

        state.resourcesById.coalSlag.value = Math.max(0, state.resourcesById.coalSlag.value - 10);
        state.resourcesById.ironOre.value = Math.max(0, state.resourcesById.ironOre.value - 5);

        if (woundedGoblin) {
            woundedGoblin.wounds.push("furnace_burst");
            game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，" + woundedGoblin.name + " 被炉火灼伤，煤渣和铁矿也被烧毁。");
        } else {
            game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，煤渣 -10，铁矿 -5。");
        }

        setCooldown(state, eventDefinition);
    }

    /**
     * 应用血月节日事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会开启节日献祭窗口。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {void} 无返回值。
     */
    function applyBloodMoonFestival(state, eventDefinition) {
        state.statistics.ritualFestivalSeconds = 120;
        game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，菌潮节祭暂时开放。");
        setCooldown(state, eventDefinition);
    }

    /**
     * 应用商队经过事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会获得金币并改善鼠人关系。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {void} 无返回值。
     */
    function applyCaravanPassed(state, eventDefinition) {
        // number 金币收益：黑市阶段的小额随机贸易馈赠。
        var coinGain = game.resources.addResource(state, "coin", 8);

        if (state.factionRelationsById && typeof state.factionRelationsById.rat_caravan === "number") {
            state.factionRelationsById.rat_caravan += 1;
        }

        game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，鼠人商队留下金币 " + coinGain.toFixed(1) + "。");
        setCooldown(state, eventDefinition);
    }

    /**
     * 应用酋长怒吼事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会恢复服从度。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {void} 无返回值。
     */
    function applyChiefRoar(state, eventDefinition) {
        // ResourceState|null 服从资源状态：用于恢复治理压力。
        var obedienceState = state.resourcesById.obedience || null;

        if (obedienceState) {
            obedienceState.value = Math.min(obedienceState.maxValue, obedienceState.value + 10);
        }

        game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，酋长的吼声让服从度回升。");
        setCooldown(state, eventDefinition);
    }

    /**
     * 应用深渊低语事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会获得深渊回响并提高短期风险。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {void} 无返回值。
     */
    function applyAbyssWhisper(state, eventDefinition) {
        // number 深渊回响收益：深渊门偶发低语带来的终局资源。
        var abyssEchoGain = game.resources.addResource(state, "abyssEcho", 12);

        state.statistics.eventRiskPulseSeconds = 60;
        game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，裂隙低语带来深渊回响 " + abyssEchoGain.toFixed(1) + "。");
        setCooldown(state, eventDefinition);
    }

    /**
     * 应用通用天气事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会按事件定义增减资源并写入冷却。
     * @param {EventDefinition} eventDefinition - 事件定义对象；resourceChanges 为一次性资源变化数组。
     * @returns {void} 无返回值。
     */
    function applyWeatherEvent(state, eventDefinition) {
        // WeatherEventResourceChange[] 资源变化列表：每项记录一个资源的一次性正负变化。
        var resourceChanges = eventDefinition.resourceChanges || [];

        // number 循环索引：遍历天气事件资源变化数组的整数下标。
        for (var changeIndex = 0; changeIndex < resourceChanges.length; changeIndex += 1) {
            // WeatherEventResourceChange 当前资源变化：用于写回事件即时收益或损失。
            var resourceChange = resourceChanges[changeIndex];

            applyWeatherEventResourceChange(state, resourceChange);
        }

        game.simulation.addLog(state, eventDefinition.logLevel, game.text.TEXT_REGISTRY.logs.eventPrefix + eventDefinition.name + "，" + (eventDefinition.logText || "地穴天气带来一次短暂波动。"));
        markWeatherEventTriggeredThisSeason(state);
        setCooldown(state, eventDefinition);
    }

    /**
     * 应用天气事件中的单项资源变化。
     *
     * @param {GameState} state - 当前游戏状态对象，会修改指定资源数量。
     * @param {WeatherEventResourceChange} resourceChange - 资源变化对象；amount 正数为获得，负数为损失。
     * @returns {void} 无返回值。
     */
    function applyWeatherEventResourceChange(state, resourceChange) {
        // ResourceState|null 资源状态：事件目标资源的运行时库存，缺失时跳过。
        var resourceState = state.resourcesById[resourceChange.resource] || null;

        if (!resourceState || resourceChange.amount === 0) {
            return;
        }

        if (resourceChange.amount > 0) {
            game.resources.addResource(state, resourceChange.resource, resourceChange.amount);
            return;
        }

        // number 损失后资源数量：一次性事件损失不能把库存扣成负数。
        var nextValue = Math.max(0, resourceState.value + resourceChange.amount);

        resourceState.value = nextValue;
    }

    /**
     * 判断当前天气事件是否满足天气和额外建筑条件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {EventDefinition} eventDefinition - 事件定义对象；weatherIds 限制可触发天气。
     * @returns {boolean} 是否允许触发；true 表示当前天气匹配且额外建筑条件满足。
     */
    function canTriggerWeatherEvent(state, eventDefinition) {
        if (hasWeatherEventTriggeredThisSeason(state)) {
            return false;
        }

        // WeatherDefinition 当前天气定义：用于匹配事件允许的天气 ID。
        var weatherDefinition = game.weather ? game.weather.getCurrentWeatherDefinition(state) : null;

        if (!weatherDefinition || !isWeatherAllowed(eventDefinition, weatherDefinition.id)) {
            return false;
        }

        if (eventDefinition.requiredBuildingId) {
            // BuildingState|null 必需建筑状态：天气事件可要求某个生产系统已经建立。
            var buildingState = state.buildingsById[eventDefinition.requiredBuildingId] || null;

            return Boolean(buildingState && buildingState.owned > 0);
        }

        return true;
    }

    /**
     * 判断当前季节是否已经触发过任一天气随机事件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否已经触发；true 表示本季不再允许天气事件。
     */
    function hasWeatherEventTriggeredThisSeason(state) {
        // string 当前季节键：按完整季节序号生成，换季后自然变化。
        var currentSeasonKey = getCurrentSeasonKey(state);

        return state.statistics.lastWeatherEventSeasonKey === currentSeasonKey;
    }

    /**
     * 记录当前季节已经触发过天气随机事件。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入 statistics.lastWeatherEventSeasonKey。
     * @returns {void} 无返回值。
     */
    function markWeatherEventTriggeredThisSeason(state) {
        state.statistics.lastWeatherEventSeasonKey = getCurrentSeasonKey(state);
    }

    /**
     * 取得当前季节键，用于限制天气随机事件每季最多一次。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 当前季节键；格式为 season-完整季节序号。
     */
    function getCurrentSeasonKey(state) {
        // number 已经过的完整游戏日：用于计算跨年份的季节序号。
        var elapsedDays = state.calendar ? Math.max(0, Math.floor(state.calendar.elapsedDays || 0)) : 0;

        // Object 季节日期：提供当前季节索引，便于与日期系统显示保持一致。
        var seasonalDate = game.calendar.getSeasonalDate(elapsedDays);

        // number 完整季节序号：由日期系统按季节长度计算，用于跨年份区分同名季节。
        var seasonSerial = game.calendar.getSeasonSerial(elapsedDays);

        return "season-" + seasonSerial + "-" + seasonalDate.seasonIndex;
    }

    /**
     * 判断天气 ID 是否在事件允许列表中。
     *
     * @param {EventDefinition} eventDefinition - 事件定义对象；weatherIds 省略时表示不限制天气。
     * @param {WeatherId} weatherId - 当前天气稳定 ID。
     * @returns {boolean} 是否允许；true 表示天气匹配或事件未声明天气限制。
     */
    function isWeatherAllowed(eventDefinition, weatherId) {
        // string[] 天气 ID 列表：限制该事件只能在指定天气中触发。
        var weatherIds = eventDefinition.weatherIds || [];

        if (weatherIds.length === 0) {
            return true;
        }

        return weatherIds.indexOf(weatherId) !== -1;
    }

    /**
     * 查找指定职业的存活哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {JobId} jobId - 职业稳定 ID。
     * @returns {Goblin|null} 找到的哥布林；没有时返回 null。
     */
    function findWorkerByJob(state, jobId) {
        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于匹配职业。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && goblin.jobId === jobId) {
                return goblin;
            }
        }

        return null;
    }

    /**
     * 设置事件冷却。
     *
     * @param {GameState} state - 当前游戏状态对象，会写入冷却秒数。
     * @param {EventDefinition} eventDefinition - 事件定义对象。
     * @returns {void} 无返回值。
     */
    function setCooldown(state, eventDefinition) {
        state.statistics[getCooldownKey(eventDefinition.id)] = eventDefinition.cooldownSeconds;
    }

    /**
     * 取得事件冷却统计键。
     *
     * @param {string} eventId - 事件稳定 ID。
     * @returns {string} 冷却统计键。
     */
    function getCooldownKey(eventId) {
        return "eventCooldown_" + eventId;
    }

    /**
     * 读取服从值。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 当前服从值；缺失时按 100。
     */
    function getObedienceValue(state) {
        return state.resourcesById.obedience ? state.resourcesById.obedience.value : 100;
    }

    // Object 事件系统命名空间：提供事件推进、概率和直接触发函数。
    game.eventsSystem = {
        updateEvents: updateEvents,
        triggerEvent: triggerEvent,
        getEventDefinition: getEventDefinition,
        calculateEventChance: calculateEventChance,
        canTriggerEvent: canTriggerEvent
    };
})(window.GoblinEmpire);
