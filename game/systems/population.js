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
     * @returns {number} 食物口数，非负整数；包含存活哥布林和当前关押俘虏。
     */
    function countFungusConsumers(state) {
        // number 存活人口：当前需要完整口粮的哥布林数量，非负整数。
        var aliveCount = countAliveGoblins(state);

        // number 俘虏数量：当前关押且需要口粮维持的俘虏数量，非负整数。
        var captiveCount = Array.isArray(state.captives) ? state.captives.length : 0;

        return aliveCount + captiveCount;
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
     * @param {"captive_bed"|"migrant"|"vassal"|"event"|"legacy"} origin - 哥布林来源 ID。
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

        return {
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

        laborState.value = Math.min(laborState.maxValue, countAliveGoblins(state) * 10);
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

        fungusState.value = Math.max(0, fungusState.value - fungusCost);
        fungusState.perSecond -= fungusCostPerSecond;

        if (fungusState.value <= 0 && !state.statistics.hasWarnedFoodShortage) {
            state.statistics.hasWarnedFoodShortage = 1;
            game.simulation.addLog(state, "warning", game.text.TEXT_REGISTRY.logs.foodWarning);
            prepareStarvationConsequence(state);
        }
    }

    /**
     * 计算哥布林与俘虏菌菇每秒消耗。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 菌菇消耗速度，单位为菌菇/秒，非负浮点数。
     */
    function calculateFungusConsumptionPerSecond(state) {
        // number 食物口数：哥布林和俘虏都会消耗同规格菌菇口粮。
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

    // Object 人口模块命名空间：提供从状态派生人口和住房统计的函数。
    game.population = {
        countAliveGoblins: countAliveGoblins,
        countFungusConsumers: countFungusConsumers,
        countIdleGoblins: countIdleGoblins,
        calculateHousingMax: calculateHousingMax,
        calculateFreeHousing: calculateFreeHousing,
        calculateCrowdingRatio: calculateCrowdingRatio,
        calculateFungusConsumptionPerSecond: calculateFungusConsumptionPerSecond,
        createGoblin: createGoblin,
        updatePopulation: updatePopulation,
        prepareStarvationConsequence: prepareStarvationConsequence
    };
})(window.GoblinEmpire);
