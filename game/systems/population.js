/* 人口派生统计：负责从哥布林对象和建筑效果计算住房条件。 */
/**
 * 初始化人口统计模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 population 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // string[] 技能 ID 列表：新哥布林必须带齐十项职业技能键。
    var GOBLIN_SKILL_IDS = [
        "foraging",
        "woodcutting",
        "hauling",
        "mining",
        "smelting",
        "crafting",
        "raiding",
        "scribing",
        "ritual",
        "overseeing"
    ];

    /**
     * 统计存活哥布林数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 存活哥布林数量，非负整数。
     */
    function countAliveGoblins(state) {
        // number 存活数量：从哥布林对象数组派生的人口权威数字。
        var aliveCount = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于判断是否存活。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive) {
                aliveCount += 1;
            }
        }

        return aliveCount;
    }

    /**
     * 统计需要消耗菌菇口粮的总口数。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 食物口数，非负浮点数；包含存活哥布林、当前关押俘虏和战兽。
     */
    function countFungusConsumers(state) {
        // number 存活人口：当前需要完整口粮的哥布林数量，非负整数。
        var aliveCount = countAliveGoblins(state);

        // number 俘虏数量：当前关押且需要口粮维持的俘虏数量，非负整数。
        var captiveCount = Array.isArray(state.captives) ? state.captives.length : 0;

        // number 战兽口粮口数：当前战兽按物种倍率消耗菌菇，休养时会翻倍。
        var warbeastConsumerUnits = countWarbeastFungusConsumers(state);

        return aliveCount + captiveCount + warbeastConsumerUnits;
    }

    /**
     * 统计战兽口粮口数。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 战兽食物口数，非负浮点数。
     */
    function countWarbeastFungusConsumers(state) {
        if (!Array.isArray(state.warbeasts) || !game.warbeastsSystem) {
            return 0;
        }

        // number 口粮口数总和：按每只战兽物种倍率累加。
        var consumerUnits = 0;

        // number 循环索引：遍历战兽数组的整数下标。
        for (var warbeastIndex = 0; warbeastIndex < state.warbeasts.length; warbeastIndex += 1) {
            // WarbeastState 当前战兽：用于读取口粮倍率。
            var warbeast = state.warbeasts[warbeastIndex];

            consumerUnits += game.warbeastsSystem.calculateFoodConsumerUnits(warbeast);
        }

        return consumerUnits;
    }

    /**
     * 计算当前住房上限。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 当前住房上限，非负整数。
     */
    function calculateHousingMax(state) {
        // number 住房上限：由已拥有建筑的 housingMax 效果派生。
        var housingMax = 0;

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取 housingMax 效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (buildingState && buildingDefinition.effects.housingMax) {
                housingMax += buildingState.owned * buildingDefinition.effects.housingMax;
            }
        }

        return housingMax;
    }

    /**
     * 计算当前住房空位。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 当前住房空位，非负整数。
     */
    function calculateFreeHousing(state) {
        return Math.max(0, calculateHousingMax(state) - countAliveGoblins(state));
    }

    /**
     * 统计空闲哥布林数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 空闲存活哥布林数量，非负整数。
     */
    function countIdleGoblins(state) {
        // number 空闲数量：存活且没有 jobId 的哥布林数量。
        var idleCount = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于判断是否空闲。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && !goblin.jobId) {
                idleCount += 1;
            }
        }

        return idleCount;
    }

    /**
     * 计算拥挤度。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 拥挤度比例，范围为 0 到 1；0 表示未拥挤。
     */
    function calculateCrowdingRatio(state) {
        // number 住房上限：由建筑效果派生的非负整数。
        var housingMax = calculateHousingMax(state);

        if (housingMax <= 0) {
            return countAliveGoblins(state) > 0 ? 1 : 0;
        }

        return Math.min(1, Math.max(0, (countAliveGoblins(state) - housingMax) / housingMax));
    }

    /**
     * 创建哥布林对象。
     *
     * @param {GameState} state - 当前游戏状态对象，会读取并更新 nextGoblinIndex 统计值。
     * @param {"captive_bed"|"warbeast_bed"|"migrant"|"vassal"|"event"|"legacy"} origin - 哥布林来源 ID。
     * @returns {Goblin} 新哥布林对象。
     */
    function createGoblin(state, origin) {
        // number 哥布林序号：用于生成稳定 ID 和确定性姓名。
        var goblinIndex = state.statistics.nextGoblinIndex || 0;

        // GoblinNamePool 姓名池：独立于存档的中文姓名来源。
        var namePool = game.definitions.GOBLIN_NAME_POOL;

        // string 名字：按序号从姓名池确定性选取。
        var givenName = namePool.givenNames[goblinIndex % namePool.givenNames.length];

        // string 绰号：按序号从绰号池确定性选取。
        var nickname = namePool.nicknames[goblinIndex % namePool.nicknames.length];

        // string 氏族名：按序号从氏族名池确定性选取。
        var clanName = namePool.clanNames[goblinIndex % namePool.clanNames.length];

        state.statistics.nextGoblinIndex = goblinIndex + 1;

        // Goblin 新生哥布林对象：先创建基础字段，再补入寿命拆分。
        var goblin = {
            id: "goblin_" + goblinIndex,
            name: givenName + "·" + clanName,
            nickname: nickname,
            age: 0,
            origin: origin,
            jobId: undefined,
            attributes: createGoblinAttributes(goblinIndex),
            traits: createGoblinTraits(goblinIndex),
            skills: createGoblinSkills(),
            wounds: [],
            isLeader: false,
            isPinned: false,
            isAlive: true
        };

        applyInitialGoblinLifespan(state, goblin);
        return goblin;
    }

    /**
     * 写入新生哥布林的寿命拆分字段。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Goblin} goblin - 新生哥布林对象，会被写入寿命字段。
     * @returns {void} 无返回值。
     */
    function applyInitialGoblinLifespan(state, goblin) {
        goblin.baseLifespanYears = game.definitions.POPULATION_CONSTANTS.baseGoblinLifespanYears;
        goblin.growthLifespanYears = calculateGoblinGrowthLifespanYears(goblin);
        goblin.technologyLifespanYears = calculateTechnologyLifespanBonusYears(state);
        goblin.eventLifespanYears = 0;
        goblin.elderDeathCheckCount = 0;
    }

    /**
     * 创建哥布林十项技能字典。
     *
     * @returns {Object.<string, number>} 技能经验字典；key 为技能 ID，value 初始为 0。
     */
    function createGoblinSkills() {
        // Object.<string, number> 技能字典：新个体保存所有设计技能键。
        var skills = {};

        // number 循环索引：遍历技能 ID 数组的整数下标。
        for (var skillIndex = 0; skillIndex < GOBLIN_SKILL_IDS.length; skillIndex += 1) {
            // string 当前技能 ID：用于写入初始经验。
            var skillId = GOBLIN_SKILL_IDS[skillIndex];

            skills[skillId] = 0;
        }

        return skills;
    }

    /**
     * 创建哥布林六项属性。
     *
     * @param {number} goblinIndex - 哥布林序号，非负整数。
     * @returns {Object.<string, number>} 属性字典；六项属性值均为 1-10 整数。
     */
    function createGoblinAttributes(goblinIndex) {
        return {
            strength: 3 + (goblinIndex % 5),
            dexterity: 3 + ((goblinIndex + 1) % 5),
            cunning: 3 + ((goblinIndex + 2) % 5),
            perception: 3 + ((goblinIndex + 3) % 5),
            will: 3 + ((goblinIndex + 4) % 5),
            attunement: 2 + (goblinIndex % 4)
        };
    }

    /**
     * 创建哥布林初始特质。
     *
     * @param {number} goblinIndex - 哥布林序号，非负整数。
     * @returns {string[]} 特质 ID 数组。
     */
    function createGoblinTraits(goblinIndex) {
        // string[][] 特质池：按序号给新哥布林一个可读倾向。
        var traitPool = [
            [
                "greedy"
            ],
            [
                "nimble"
            ],
            [
                "obedient"
            ],
            [
                "troublemaker"
            ]
        ];

        return traitPool[goblinIndex % traitPool.length].slice();
    }

    /**
     * 推进人口派生劳力和口粮菌菇消耗。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function updatePopulation(state, deltaSeconds) {
        updateLaborFromPopulation(state);
        consumeFungusForPopulation(state, deltaSeconds);
    }

    /**
     * 按跨过的月初推进年龄并检查老死。
     *
     * @param {GameState} state - 当前游戏状态对象，会更新哥布林年龄和死亡状态。
     * @param {number} previousElapsedDays - 本次日期推进前的完整游戏日，非负整数天。
     * @param {number} currentElapsedDays - 本次日期推进后的完整游戏日，非负整数天。
     * @returns {void} 无返回值。
     */
    function updateMonthlyAgingAndLifespan(state, previousElapsedDays, currentElapsedDays) {
        // number 上次月份序号：每 30 天递增 1，代表已越过的月初数量。
        var previousMonthSerial = Math.floor(Math.max(0, Number(previousElapsedDays) || 0) / 30);

        // number 当前月份序号：每 30 天递增 1，代表当前已越过的月初数量。
        var currentMonthSerial = Math.floor(Math.max(0, Number(currentElapsedDays) || 0) / 30);

        if (currentMonthSerial <= previousMonthSerial) {
            return;
        }

        // number 月份序号：逐月结算，避免长时间离线时跳过老死骰。
        for (var monthSerial = previousMonthSerial + 1; monthSerial <= currentMonthSerial; monthSerial += 1) {
            applyOneMonthAging(state, monthSerial);
        }
    }

    /**
     * 结算一个月初的人口年龄增长和老死骰。
     *
     * @param {GameState} state - 当前游戏状态对象，会直接修改哥布林对象。
     * @param {number} monthSerial - 当前结算的月份序号，非负整数。
     * @returns {void} 无返回值。
     */
    function applyOneMonthAging(state, monthSerial) {
        refreshTechnologyLifespanBonus(state);

        // Goblin[] 老死哥布林列表：本月死亡后用于合并日志。
        var elderDeadGoblins = [];

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于年龄增长和寿命检查。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive) {
                continue;
            }

            normalizeGoblinLifespanFields(state, goblin);
            // number 年龄推进量：每个生存月只增加十二分之一年，寿命字段保持年制。
            var ageGainYears = 1 / 12;

            goblin.age = Math.max(0, Number(goblin.age) || 0) + ageGainYears;
            goblin.growthLifespanYears = calculateGoblinGrowthLifespanYears(goblin);

            if (shouldGoblinDieOfOldAge(goblin)) {
                applyOldAgeDeath(goblin);
                elderDeadGoblins.push(goblin);
            }
        }

        if (elderDeadGoblins.length > 0) {
            state.statistics.totalOldAgeDeaths = (state.statistics.totalOldAgeDeaths || 0) + elderDeadGoblins.length;
            game.simulation.addLog(state, "important", "月初点名时，" + formatGoblinNames(elderDeadGoblins) + " 老死了。");
        }

        state.statistics.lastLifespanMonthSerial = monthSerial;
    }

    /**
     * 判断哥布林本月是否老死。
     *
     * @param {Goblin} goblin - 当前哥布林对象，会在未死亡时增加老死检查次数。
     * @returns {boolean} 是否老死；true 表示本月应标记死亡。
     */
    function shouldGoblinDieOfOldAge(goblin) {
        // number 总寿命：寿命各组成部分相加后的年数。
        var totalLifespanYears = calculateGoblinTotalLifespanYears(goblin);

        if (goblin.age < totalLifespanYears) {
            goblin.elderDeathCheckCount = 0;
            return false;
        }

        // number 已检查次数：达到寿命后每月未死会让下月概率提高。
        var elderDeathCheckCount = Math.max(0, Math.floor(Number(goblin.elderDeathCheckCount) || 0));

        // number 老死概率：首次 10%，每月递增 10%，最高 100%。
        var deathChance = Math.min(1, game.definitions.POPULATION_CONSTANTS.elderDeathBaseChance + elderDeathCheckCount * game.definitions.POPULATION_CONSTANTS.elderDeathChanceIncreasePerMonth);

        // number 随机骰：0-1 浮点比例，低于概率时死亡。
        var deathRoll = Math.random();

        if (deathRoll < deathChance) {
            return true;
        }

        goblin.elderDeathCheckCount = elderDeathCheckCount + 1;
        return false;
    }

    /**
     * 标记哥布林因老死死亡。
     *
     * @param {Goblin} goblin - 当前哥布林对象，会被直接修改。
     * @returns {void} 无返回值。
     */
    function applyOldAgeDeath(goblin) {
        goblin.isAlive = false;
        goblin.jobId = null;
        goblin.elderDeathCheckCount = 0;
        if (goblin.wounds.indexOf("old_age") === -1) {
            goblin.wounds.push("old_age");
        }
    }

    /**
     * 计算哥布林成长带来的寿命加成。
     *
     * @param {Goblin} goblin - 哥布林对象，不会被修改。
     * @returns {number} 成长寿命加成，单位年，范围 0 到 maxGrowthLifespanYears。
     */
    function calculateGoblinGrowthLifespanYears(goblin) {
        // string[] 属性 ID 数组：遍历六项属性计算体质基础。
        var attributeIds = Object.keys(goblin.attributes || {});

        // number 属性总值：六维属性累加，非负整数。
        var attributeTotal = 0;

        // number 属性循环索引：遍历属性 ID 数组的整数下标。
        for (var attributeIndex = 0; attributeIndex < attributeIds.length; attributeIndex += 1) {
            // string 当前属性 ID：用于读取属性值。
            var attributeId = attributeIds[attributeIndex];

            attributeTotal += Math.max(0, Number(goblin.attributes[attributeId]) || 0);
        }

        // string[] 技能 ID 数组：遍历技能字典，把经验折算成长期强健度。
        var skillIds = Object.keys(goblin.skills || {});

        // number 技能总经验：全部职业经验累加，非负数。
        var skillTotal = 0;

        // number 技能循环索引：遍历技能 ID 数组的整数下标。
        for (var skillIndex = 0; skillIndex < skillIds.length; skillIndex += 1) {
            // string 当前技能 ID：用于读取技能经验。
            var skillId = skillIds[skillIndex];

            skillTotal += Math.max(0, Number(goblin.skills[skillId]) || 0);
        }

        // number 属性寿命加成：超过普通新生基准 24 点后，每 4 点加 1 年。
        var attributeBonusYears = Math.max(0, Math.floor((attributeTotal - 24) / 4));

        // number 技能寿命加成：经验代表长期训练和生存本领，每 800 经验加 1 年。
        var skillBonusYears = Math.floor(skillTotal / 800);

        return Math.min(game.definitions.POPULATION_CONSTANTS.maxGrowthLifespanYears, attributeBonusYears + skillBonusYears);
    }

    /**
     * 计算当前科技提供的总寿命加成。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 科技寿命加成，单位年，非负整数。
     */
    function calculateTechnologyLifespanBonusYears(state) {
        // number 科技寿命加成：累加已完成寿命科技的年数。
        var technologyBonusYears = 0;

        // LifespanTechnologyBonus[] 科技加成列表：来自静态定义表。
        var lifespanTechnologyBonuses = game.definitions.LIFESPAN_TECHNOLOGY_BONUSES || [];

        // number 循环索引：遍历科技寿命加成列表。
        for (var bonusIndex = 0; bonusIndex < lifespanTechnologyBonuses.length; bonusIndex += 1) {
            // LifespanTechnologyBonus 当前科技寿命加成定义。
            var lifespanTechnologyBonus = lifespanTechnologyBonuses[bonusIndex];

            // TechnologyState|null 科技状态：用于判断是否已研究。
            var technologyState = state.technologiesById[lifespanTechnologyBonus.technologyId] || null;

            if (technologyState && technologyState.isResearched) {
                technologyBonusYears += Math.max(0, Math.floor(Number(lifespanTechnologyBonus.years) || 0));
            }
        }

        return technologyBonusYears;
    }

    /**
     * 把当前科技寿命加成同步到所有存活个体。
     *
     * @param {GameState} state - 当前游戏状态对象，会更新哥布林寿命字段。
     * @returns {void} 无返回值。
     */
    function refreshTechnologyLifespanBonus(state) {
        // number 科技寿命加成：当前所有已研究科技提供的总年数。
        var technologyBonusYears = calculateTechnologyLifespanBonusYears(state);

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于写入科技寿命加成。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive) {
                normalizeGoblinLifespanFields(state, goblin);
                goblin.technologyLifespanYears = technologyBonusYears;
                if (Math.max(0, Number(goblin.age) || 0) < calculateGoblinTotalLifespanYears(goblin)) {
                    goblin.elderDeathCheckCount = 0;
                }
            }
        }
    }

    /**
     * 补齐哥布林寿命字段。
     *
     * @param {GameState} state - 当前游戏状态对象，用于读取科技寿命加成。
     * @param {Goblin} goblin - 哥布林对象，会被补齐寿命字段。
     * @returns {void} 无返回值。
     */
    function normalizeGoblinLifespanFields(state, goblin) {
        if (typeof goblin.baseLifespanYears !== "number") {
            goblin.baseLifespanYears = game.definitions.POPULATION_CONSTANTS.baseGoblinLifespanYears;
        }
        if (typeof goblin.growthLifespanYears !== "number") {
            goblin.growthLifespanYears = calculateGoblinGrowthLifespanYears(goblin);
        }
        if (typeof goblin.technologyLifespanYears !== "number") {
            goblin.technologyLifespanYears = calculateTechnologyLifespanBonusYears(state);
        }
        if (typeof goblin.eventLifespanYears !== "number") {
            goblin.eventLifespanYears = 0;
        }
        if (typeof goblin.elderDeathCheckCount !== "number") {
            goblin.elderDeathCheckCount = 0;
        }
    }

    /**
     * 计算哥布林总寿命。
     *
     * @param {Goblin} goblin - 哥布林对象，不会被修改。
     * @returns {number} 总寿命，单位年，非负整数。
     */
    function calculateGoblinTotalLifespanYears(goblin) {
        return Math.max(0, Math.floor(Number(goblin.baseLifespanYears) || 0)) +
            Math.max(0, Math.floor(Number(goblin.growthLifespanYears) || 0)) +
            Math.max(0, Math.floor(Number(goblin.technologyLifespanYears) || 0)) +
            Math.max(0, Math.floor(Number(goblin.eventLifespanYears) || 0));
    }

    /**
     * 对随机存活哥布林添加事件寿命。
     *
     * @param {GameState} state - 当前游戏状态对象，会修改被选中的哥布林。
     * @param {number} bonusYears - 寿命加成，单位年，非负整数。
     * @returns {Goblin|null} 获得寿命的哥布林；没有候选时返回 null。
     */
    function applyRandomGoblinLifespanEventBonus(state, bonusYears) {
        // Goblin[] 存活哥布林列表：随机事件候选池。
        var aliveGoblins = getAliveGoblins(state);

        if (aliveGoblins.length <= 0) {
            return null;
        }

        // number 随机下标：从存活候选中选择一个。
        var randomIndex = Math.floor(Math.random() * aliveGoblins.length);

        // Goblin 目标哥布林：获得事件寿命加成。
        var targetGoblin = aliveGoblins[randomIndex];

        normalizeGoblinLifespanFields(state, targetGoblin);
        targetGoblin.eventLifespanYears += Math.max(0, Math.floor(Number(bonusYears) || 0));
        targetGoblin.elderDeathCheckCount = 0;
        return targetGoblin;
    }

    /**
     * 按存活人口刷新劳力。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @returns {void} 无返回值。
     */
    function updateLaborFromPopulation(state) {
        // ResourceState 劳力状态：用于写入派生劳力数量。
        var laborState = state.resourcesById.labor;

        if (!laborState) {
            return;
        }

        // number 建筑劳力占用：所有启用生产建筑保留的劳力数量，非负浮点数。
        var buildingLaborUsage = calculateBuildingLaborUsage(state);

        // number 人口派生劳力：存活哥布林提供的基础劳力数量，非负整数。
        var populationLabor = countAliveGoblins(state) * 10;

        laborState.value = Math.max(0, populationLabor - buildingLaborUsage);
    }

    /**
     * 分析劳力来源和建筑占用，用于资源卡片浮窗展示。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {LaborBreakdown} 劳力派生、占用减免和逐建筑占用明细。
     */
    function analyzeLaborBreakdown(state) {
        // number 存活哥布林数量：每个存活个体提供固定基础劳力。
        var aliveGoblinCount = countAliveGoblins(state);

        // number 人口派生劳力：存活哥布林提供的基础劳力数量，非负资源数量。
        var populationLabor = aliveGoblinCount * 10;

        // LaborUsageEntry[] 建筑占用条目：逐建筑记录启用数量和减免前后占用。
        var buildingUsageEntries = collectBuildingLaborUsageEntries(state);

        // number 减免前建筑占用总量：所有启用生产建筑的原始占用之和。
        var rawBuildingUsageTotal = sumRawLaborUsage(buildingUsageEntries);

        // number 劳力占用减免比例：绞盘和监工设施降低生产建筑占用，上限为 75%。
        var reductionRatio = calculateLaborUsageReductionRatio(state);

        // number 循环索引：遍历建筑占用条目的整数下标。
        for (var entryIndex = 0; entryIndex < buildingUsageEntries.length; entryIndex += 1) {
            // LaborUsageEntry 当前建筑占用条目：用于写入减免后的占用数量。
            var usageEntry = buildingUsageEntries[entryIndex];

            usageEntry.adjustedUsage = usageEntry.rawUsage * (1 - reductionRatio);
        }

        return {
            aliveGoblinCount: aliveGoblinCount,
            populationLabor: populationLabor,
            rawBuildingUsageTotal: rawBuildingUsageTotal,
            reductionRatio: reductionRatio,
            adjustedBuildingUsageTotal: rawBuildingUsageTotal * (1 - reductionRatio),
            isProductionLaborOverloaded: rawBuildingUsageTotal * (1 - reductionRatio) > populationLabor,
            buildingUsageEntries: buildingUsageEntries
        };
    }

    /**
     * 判断生产建筑劳力占用是否超过存活人口供给。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否劳力过载；true 表示除菌菇床外的建筑生产应停止。
     */
    function isProductionLaborOverloaded(state) {
        // LaborBreakdown 劳力摘要：用于复用人口劳力和减免后建筑占用口径。
        var laborBreakdown = analyzeLaborBreakdown(state);

        return laborBreakdown.isProductionLaborOverloaded;
    }

    /**
     * 统计启用生产建筑占用的劳力。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 建筑占用劳力数量，非负浮点数。
     */
    function calculateBuildingLaborUsage(state) {
        // LaborUsageEntry[] 建筑占用条目：用于统计减免前占用总量。
        var buildingUsageEntries = collectBuildingLaborUsageEntries(state);

        // number 占用劳力总量：按启用建筑数量乘单建筑占用累加，非负资源数量。
        var rawLaborUsage = sumRawLaborUsage(buildingUsageEntries);

        // number 劳力占用减免比例：绞盘和监工设施降低生产建筑占用，上限防止完全免费自动化。
        var reductionRatio = calculateLaborUsageReductionRatio(state);

        return rawLaborUsage * (1 - reductionRatio);
    }

    /**
     * 收集逐建筑劳力占用条目。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {LaborUsageEntry[]} 逐建筑占用明细数组。
     */
    function collectBuildingLaborUsageEntries(state) {
        // LaborUsageEntry[] 占用条目数组：保存每类启用生产建筑的劳力占用。
        var usageEntries = [];

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取劳力占用效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取启用数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (!buildingState || buildingState.active <= 0 || !buildingDefinition.effects.laborUsage) {
                continue;
            }

            // number 减免前占用：单座劳力占用乘启用数量，非负资源数量。
            var rawUsage = buildingDefinition.effects.laborUsage * buildingState.active;

            usageEntries.push({
                buildingId: buildingDefinition.id,
                buildingName: buildingDefinition.name,
                activeCount: buildingState.active,
                laborUsagePerBuilding: buildingDefinition.effects.laborUsage,
                rawUsage: rawUsage,
                adjustedUsage: rawUsage
            });
        }

        return usageEntries;
    }

    /**
     * 汇总减免前建筑劳力占用。
     *
     * @param {LaborUsageEntry[]} usageEntries - 逐建筑占用明细数组。
     * @returns {number} 减免前劳力占用总量，非负资源数量。
     */
    function sumRawLaborUsage(usageEntries) {
        // number 占用总量：累加所有建筑条目的减免前劳力占用。
        var rawUsageTotal = 0;

        // number 循环索引：遍历建筑占用条目的整数下标。
        for (var entryIndex = 0; entryIndex < usageEntries.length; entryIndex += 1) {
            // LaborUsageEntry 当前建筑占用条目：用于读取减免前占用。
            var usageEntry = usageEntries[entryIndex];

            rawUsageTotal += usageEntry.rawUsage;
        }

        return rawUsageTotal;
    }

    /**
     * 计算生产建筑劳力占用减免比例。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 劳力占用减免比例，范围为 0-0.75。
     */
    function calculateLaborUsageReductionRatio(state) {
        // number 减免比例总和：按拥有建筑数量乘减免效果累加。
        var reductionRatio = 0;

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取劳力占用减免效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于读取拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (!buildingState || buildingState.owned <= 0 || !buildingDefinition.effects.laborUsageReductionRatio) {
                continue;
            }

            reductionRatio += buildingDefinition.effects.laborUsageReductionRatio * buildingState.owned;
        }

        return Math.min(0.75, Math.max(0, reductionRatio));
    }

    /**
     * 按哥布林与俘虏口数消耗菌菇。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点数。
     * @returns {void} 无返回值。
     */
    function consumeFungusForPopulation(state, deltaSeconds) {
        // number 食物口数：用于判断本次是否存在菌菇消耗，包含哥布林和俘虏。
        var fungusConsumerCount = countFungusConsumers(state);

        // ResourceState 菌菇状态：用于扣除人口食物消耗。
        var fungusState = state.resourcesById.fungus;

        if (fungusConsumerCount <= 0 || !fungusState) {
            return;
        }

        // number 菌菇每秒消耗：人口口粮压力，单位为菌菇/秒。
        var fungusCostPerSecond = calculateFungusConsumptionPerSecond(state);

        // number 菌菇消耗：本次模拟需要扣除的菌菇数量。
        var fungusCost = fungusCostPerSecond * deltaSeconds;

        // number 本轮菌菇溢出产出：满仓时被容量截断、但仍可先作为口粮吃掉的资源数量。
        var clippedFungusGain = Math.max(0, (fungusState.grossGainThisTick || 0) - (fungusState.actualGainThisTick || 0));

        // number 可用菌菇：当前库存加上本轮被容量截掉的菌菇产出，代表同一结算段内可用于口粮的总量。
        var availableFungus = fungusState.value + clippedFungusGain;

        // boolean 是否断粮：本次口粮消耗超过本轮可用菌菇，true 表示需要累计断粮惩罚时间。
        var isStarving = fungusCost > availableFungus;

        fungusState.value = Math.min(fungusState.maxValue, Math.max(0, availableFungus - fungusCost));
        fungusState.perSecond -= fungusCostPerSecond;

        if (isStarving && !state.statistics.hasWarnedFoodShortage) {
            state.statistics.hasWarnedFoodShortage = 1;
            game.simulation.addLog(state, "warning", game.text.TEXT_REGISTRY.logs.foodWarning);
            prepareStarvationConsequence(state);
        }

        if (isStarving) {
            updateStarvationConsequence(state, deltaSeconds);
        } else {
            clearStarvationConsequence(state);
        }

        if (!isStarving && state.statistics.hasWarnedFoodShortage) {
            state.statistics.hasWarnedFoodShortage = 0;
        }
    }

    /**
     * 计算哥布林与俘虏菌菇每秒消耗。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 菌菇消耗速度，单位为菌菇/秒，非负浮点数。
     */
    function calculateFungusConsumptionPerSecond(state) {
        // number 食物口数：哥布林、俘虏和战兽都会消耗菌菇口粮。
        var fungusConsumerCount = countFungusConsumers(state);

        // Object.<string, number> 政策效果字典：读取食物消耗修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：读取深渊契约食物代价。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // number 消耗倍率：配给政策可降低消耗，契约可增加消耗，下限为 0。
        var consumptionMultiplier = Math.max(0, 1 + (policyEffects.fungusConsumptionRatio || 0) + (pactEffects.fungusConsumptionRatio || 0));

        return fungusConsumerCount * game.definitions.POPULATION_CONSTANTS.fungusConsumptionPerGoblinSecond * consumptionMultiplier;
    }

    /**
     * 准备断粮后果接口。
     *
     * @param {GameState} state - 当前游戏状态对象，会记录断粮后果待处理标记。
     * @returns {void} 无返回值。
     */
    function prepareStarvationConsequence(state) {
        state.statistics.pendingStarvationConsequence = 1;
    }

    /**
     * 推进断粮后果计时并在每满三天时随机杀死部分口粮对象。
     *
     * @param {GameState} state - 当前游戏状态对象，会累计断粮秒数并移除俘虏或标记具体哥布林死亡。
     * @param {number} deltaSeconds - 本次模拟推进秒数，非负浮点秒。
     * @returns {void} 无返回值。
     */
    function updateStarvationConsequence(state, deltaSeconds) {
        prepareStarvationConsequence(state);

        // number 断粮累计秒数：保存连续断粮时长，单位为模拟秒。
        var starvationSeconds = (state.statistics.starvationSeconds || 0) + Math.max(0, deltaSeconds);

        // number 触发间隔秒数：每 3 个游戏日触发一次死亡结算，单位为模拟秒。
        var starvationCheckSeconds = game.calendar.getSecondsPerDay() * game.definitions.POPULATION_CONSTANTS.starvationCheckDays;

        while (starvationSeconds >= starvationCheckSeconds && countStarvationVictims(state) > 0) {
            starvationSeconds -= starvationCheckSeconds;
            applyStarvationDeaths(state);
        }

        state.statistics.starvationSeconds = starvationSeconds;
    }

    /**
     * 清理断粮后果计时。
     *
     * @param {GameState} state - 当前游戏状态对象，会清除断粮待处理标记和累计秒数。
     * @returns {void} 无返回值。
     */
    function clearStarvationConsequence(state) {
        state.statistics.pendingStarvationConsequence = 0;
        state.statistics.starvationSeconds = 0;
    }

    /**
     * 统计当前可被断粮杀死的对象数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 可被断粮杀死的俘虏、战兽和哥布林总数，非负整数。
     */
    function countStarvationVictims(state) {
        // number 存活哥布林数量：断粮死亡在俘虏不足时才会作用到这些对象。
        var aliveGoblinCount = countAliveGoblins(state);

        // number 俘虏数量：断粮死亡的优先候选数量。
        var captiveCount = Array.isArray(state.captives) ? state.captives.length : 0;

        // number 战兽数量：断粮死亡会在俘虏之后、哥布林之前作用到这些对象。
        var warbeastCount = Array.isArray(state.warbeasts) ? state.warbeasts.length : 0;

        return aliveGoblinCount + captiveCount + warbeastCount;
    }

    /**
     * 随机杀死当前口粮对象的 10%，至少 1 个；俘虏优先，其次战兽，最后哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，会移除被选中的俘虏和战兽，或把被选中的哥布林标记为死亡。
     * @returns {Goblin[]} 本次断粮死亡的哥布林对象数组。
     */
    function applyStarvationDeaths(state) {
        // number 可死亡对象数量：按当前存活哥布林和当前俘虏共同计算断粮死亡比例。
        var starvationVictimCount = countStarvationVictims(state);

        if (starvationVictimCount <= 0) {
            return [];
        }

        // number 死亡数量：当前口粮对象的 10% 向上取整，至少 1 个。
        var deathCount = Math.max(1, Math.ceil(starvationVictimCount * game.definitions.POPULATION_CONSTANTS.starvationDeathRatio));

        // number 剩余死亡数量：先用于抽取俘虏，俘虏不足时再抽取哥布林。
        var remainingDeathCount = deathCount;

        // string[] 死亡俘虏姓名列表：用于写入日志和统计。
        var deadCaptiveNames = [];

        while (remainingDeathCount > 0 && Array.isArray(state.captives) && state.captives.length > 0) {
            // number 随机俘虏下标：从当前关押俘虏中抽取优先饿死对象。
            var captiveIndex = Math.floor(Math.random() * state.captives.length);

            // CaptiveState 死亡俘虏：本次断粮选中的具体俘虏对象。
            var deadCaptive = state.captives.splice(captiveIndex, 1)[0];

            deadCaptiveNames.push(deadCaptive.name || deadCaptive.id);
            remainingDeathCount -= 1;
        }

        if (deadCaptiveNames.length > 0) {
            // number 俘虏返还菌菇：断粮死亡俘虏被粗暴处理后带回的食物数量。
            var captiveFungusGain = deadCaptiveNames.length * game.definitions.POPULATION_CONSTANTS.captiveStarvationFungusGain;

            addCaptiveStarvationFungus(state, captiveFungusGain);
            state.statistics.totalCaptiveStarvationDeaths = (state.statistics.totalCaptiveStarvationDeaths || 0) + deadCaptiveNames.length;
        }

        // string[] 死亡战兽姓名列表：用于写入日志和统计。
        var deadWarbeastNames = [];

        while (remainingDeathCount > 0 && Array.isArray(state.warbeasts) && state.warbeasts.length > 0) {
            // number 随机战兽下标：从当前战兽中抽取断粮死亡对象。
            var warbeastIndex = Math.floor(Math.random() * state.warbeasts.length);

            // WarbeastState 死亡战兽：本次断粮选中的具体战兽对象。
            var deadWarbeast = state.warbeasts.splice(warbeastIndex, 1)[0];

            deadWarbeastNames.push(deadWarbeast.name || deadWarbeast.id);
            remainingDeathCount -= 1;
        }

        if (deadWarbeastNames.length > 0) {
            // number 战兽回收菌菇：断粮死亡战兽按固定屠宰收益回收。
            var warbeastFungusGain = deadWarbeastNames.length * game.definitions.POPULATION_CONSTANTS.warbeastButcherFungusGain;

            addCaptiveStarvationFungus(state, warbeastFungusGain);
            state.statistics.totalWarbeastStarvationDeaths = (state.statistics.totalWarbeastStarvationDeaths || 0) + deadWarbeastNames.length;
        }

        // Goblin[] 存活哥布林列表：俘虏不足以覆盖死亡数量时才作为随机死亡候选池。
        var aliveGoblins = getAliveGoblins(state);

        // Goblin[] 死亡哥布林列表：用于写入日志和统计。
        var deadGoblins = [];

        // number 死亡循环索引：控制随机抽取次数的非负整数。
        for (var deathIndex = 0; deathIndex < remainingDeathCount && aliveGoblins.length > 0; deathIndex += 1) {
            // number 随机候选下标：从剩余存活候选池中抽取。
            var randomIndex = Math.floor(Math.random() * aliveGoblins.length);

            // Goblin 死亡哥布林：本次断粮选中的具体对象。
            var deadGoblin = aliveGoblins.splice(randomIndex, 1)[0];

            deadGoblin.isAlive = false;
            deadGoblin.jobId = null;
            deadGoblin.wounds.push("starvation");
            deadGoblins.push(deadGoblin);
        }

        state.statistics.totalStarvationDeaths = (state.statistics.totalStarvationDeaths || 0) + deadGoblins.length;

        if (deadCaptiveNames.length > 0 || deadWarbeastNames.length > 0 || deadGoblins.length > 0) {
            game.simulation.addLog(state, "important", formatStarvationDeathLog(deadCaptiveNames, deadWarbeastNames, deadGoblins));
        }

        if (deadCaptiveNames.length > 0 && game.captivesSystem && game.captivesSystem.syncCaptiveResource) {
            game.captivesSystem.syncCaptiveResource(state);
        }

        return deadGoblins;
    }

    /**
     * 发放俘虏断粮死亡返还的菌菇。
     *
     * @param {GameState} state - 当前游戏状态对象，会直接增加菌菇库存。
     * @param {number} fungusAmount - 返还菌菇数量，非负资源数量；不吃资源收益倍率，只受容量上限限制。
     * @returns {number} 实际增加的菌菇数量，范围为 0 到 fungusAmount。
     */
    function addCaptiveStarvationFungus(state, fungusAmount) {
        // ResourceState|null 菌菇状态：用于写入断粮俘虏返还的食物。
        var fungusState = state.resourcesById.fungus || null;

        if (!fungusState || fungusAmount <= 0) {
            return 0;
        }

        // number 增加前菌菇：用于计算实际增加量。
        var previousFungusValue = fungusState.value;

        // number 目标菌菇：返还后尚未按容量截断的菌菇数量。
        var targetFungusValue = fungusState.value + fungusAmount;

        fungusState.value = Math.min(fungusState.maxValue, targetFungusValue);
        fungusState.isVisible = true;
        return Math.max(0, fungusState.value - previousFungusValue);
    }

    /**
     * 取得当前所有存活哥布林对象。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Goblin[]} 存活哥布林对象数组。
     */
    function getAliveGoblins(state) {
        // Goblin[] 存活哥布林列表：用于断粮死亡随机候选池。
        var aliveGoblins = [];

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于判断是否可被断粮杀死。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive) {
                aliveGoblins.push(goblin);
            }
        }

        return aliveGoblins;
    }

    /**
     * 格式化哥布林姓名列表。
     *
     * @param {Goblin[]} goblins - 哥布林对象数组。
     * @returns {string} 中文姓名列表文本。
     */
    function formatGoblinNames(goblins) {
        // string[] 姓名文本数组：用于断粮死亡日志。
        var nameTexts = [];

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：读取显示姓名。
            var goblin = goblins[goblinIndex];

            nameTexts.push(goblin.name + "（" + goblin.nickname + "）");
        }

        return nameTexts.join("、");
    }

    /**
     * 格式化断粮死亡日志。
     *
     * @param {string[]} captiveNames - 断粮死亡俘虏姓名数组。
     * @param {string[]} warbeastNames - 断粮死亡战兽姓名数组。
     * @param {Goblin[]} goblins - 断粮死亡哥布林对象数组。
     * @returns {string} 中文日志文本，说明死亡名单和回收菌菇。
     */
    function formatStarvationDeathLog(captiveNames, warbeastNames, goblins) {
        // string[] 日志片段数组：按俘虏、战兽和哥布林分别描述死亡对象。
        var logParts = [];

        if (captiveNames.length > 0) {
            // number 俘虏返还菌菇：用于在日志中显示本次回收的菌菇资源数量。
            var captiveFungusGain = captiveNames.length * game.definitions.POPULATION_CONSTANTS.captiveStarvationFungusGain;

            logParts.push("俘虏 " + captiveNames.join("、") + " 饿死并被回收，菌菇 +" + captiveFungusGain);
        }

        if (warbeastNames.length > 0) {
            // number 战兽返还菌菇：断粮死亡战兽按屠宰收益回收。
            var warbeastFungusGain = warbeastNames.length * game.definitions.POPULATION_CONSTANTS.warbeastButcherFungusGain;

            logParts.push("战兽 " + warbeastNames.join("、") + " 饿死并被回收，菌菇 +" + warbeastFungusGain);
        }

        if (goblins.length > 0) {
            logParts.push(formatGoblinNames(goblins) + " 饿死了");
        }

        return "断粮持续三天，" + logParts.join("；") + "。";
    }

    // Object 人口模块命名空间：提供从状态派生人口和住房统计的函数。
    game.population = {
        countAliveGoblins: countAliveGoblins,
        countFungusConsumers: countFungusConsumers,
        countWarbeastFungusConsumers: countWarbeastFungusConsumers,
        countIdleGoblins: countIdleGoblins,
        calculateHousingMax: calculateHousingMax,
        calculateFreeHousing: calculateFreeHousing,
        calculateCrowdingRatio: calculateCrowdingRatio,
        calculateFungusConsumptionPerSecond: calculateFungusConsumptionPerSecond,
        createGoblin: createGoblin,
        updateLaborFromPopulation: updateLaborFromPopulation,
        consumeFungusForPopulation: consumeFungusForPopulation,
        analyzeLaborBreakdown: analyzeLaborBreakdown,
        isProductionLaborOverloaded: isProductionLaborOverloaded,
        calculateBuildingLaborUsage: calculateBuildingLaborUsage,
        calculateLaborUsageReductionRatio: calculateLaborUsageReductionRatio,
        updatePopulation: updatePopulation,
        updateMonthlyAgingAndLifespan: updateMonthlyAgingAndLifespan,
        refreshTechnologyLifespanBonus: refreshTechnologyLifespanBonus,
        calculateTechnologyLifespanBonusYears: calculateTechnologyLifespanBonusYears,
        calculateGoblinGrowthLifespanYears: calculateGoblinGrowthLifespanYears,
        calculateGoblinTotalLifespanYears: calculateGoblinTotalLifespanYears,
        normalizeGoblinLifespanFields: normalizeGoblinLifespanFields,
        applyRandomGoblinLifespanEventBonus: applyRandomGoblinLifespanEventBonus,
        prepareStarvationConsequence: prepareStarvationConsequence,
        updateStarvationConsequence: updateStarvationConsequence,
        countStarvationVictims: countStarvationVictims,
        addCaptiveStarvationFungus: addCaptiveStarvationFungus,
        applyStarvationDeaths: applyStarvationDeaths
    };
})(window.GoblinEmpire);
