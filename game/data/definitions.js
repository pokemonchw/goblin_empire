/* 静态定义入口：集中放置标签页和后续游戏数据表。 */
/**
 * 初始化静态定义模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 definitions 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * @typedef {Object} TabDefinition
     * @property {string} id - 标签页稳定 ID，作为 UI 切换键。
     * @property {string} name - 标签页中文显示名。
     * @property {string} description - 标签页中文说明。
     * @property {boolean} isVisibleAtStart - 新存档是否默认显示。
     */

    /**
     * @typedef {Object} ManualActionDefinition
     * @property {string} id - 手动行动稳定 ID。
     * @property {string} name - 中文按钮文本。
     * @property {string} description - 中文说明。
     * @property {ResourceId} resource - 获得的资源 ID。
     * @property {number} amount - 每次点击获得的资源数量，非负资源数量。
     */

    /**
     * @typedef {Object} PopulationConstants
     * @property {number} fungusConsumptionPerGoblinSecond - 单个哥布林或俘虏菌菇消耗，单位为菌菇/秒。
     */

    /**
     * @typedef {Object} CraftRecipeDefinition
     * @property {string} id - 配方稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {Price[]} price - 单次制作消耗的价格数组。
     * @property {ResourceId} outputResource - 产出资源稳定 ID。
     * @property {number} outputAmount - 单次基础产出数量，非负资源数量。
     * @property {UnlockBundle} unlock - 显示该配方所需的解锁条件。
     */

    /**
     * @typedef {Object} EventDefinition
     * @property {string} id - 事件稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} conditionId - 条件 ID，由事件系统解释。
     * @property {number} baseChancePerCheck - 每次检查的基础概率，范围 0-1。
     * @property {"normal"|"important"|"warning"} logLevel - 触发时使用的日志等级。
     * @property {number} cooldownSeconds - 事件冷却秒数，非负整数。
     * @property {"neutral"|"accident"=} riskMode - 风险模式；neutral 不吃事故风险倍率，accident 会吃服从和事故修正。
     * @property {WeatherId[]=} weatherIds - 允许触发的天气 ID 数组；省略表示不按天气限制。
     * @property {BuildingId=} requiredBuildingId - 额外要求拥有的建筑 ID；省略表示不要求建筑。
     * @property {WeatherEventResourceChange[]=} resourceChanges - 天气事件一次性资源变化数组；amount 可正可负。
     * @property {string=} logText - 通用天气事件日志正文，不含事件名前缀。
     */

    /**
     * @typedef {Object} WeatherEventResourceChange
     * @property {ResourceId} resource - 资源稳定 ID。
     * @property {number} amount - 一次性资源变化数量；正数为获得，负数为损失。
     */

    /**
     * @typedef {Object} CaptiveTypeDefinition
     * @property {string} id - 俘虏类型 ID。
     * @property {string} name - 中文显示名。
     * @property {string} traitHint - 倾向提示 ID。
     * @property {Object.<string, number>} attributeBias - 属性偏向字典；key 为属性 ID，value 为加成。
     * @property {Object.<string, number>} skillBias - 初始技能字典；key 为技能 ID，value 为初始经验。
     */

    /**
     * @typedef {Object} CaptiveQualityDefinition
     * @property {string} id - 俘虏质量 ID。
     * @property {string} name - 中文显示名。
     * @property {number} multiplier - 收益倍率，正数。
     * @property {number} escapeRisk - 逃脱风险，范围 0-1。
     * @property {number} retaliationRisk - 报复风险，范围 0-1。
     */

    /**
     * @typedef {Object} DiplomacyWorldDefinition
     * @property {string} id - 世界层级稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     */

    /**
     * @typedef {Object} FactionTradeDefinition
     * @property {string} id - 阵营稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {string} worldId - 所属世界 ID，必须对应 DiplomacyWorldDefinition.id。
     * @property {Price[]} cost - 单次贸易消耗。
     * @property {ResourceId} rewardResource - 收益资源 ID。
     * @property {number} baseReward - 基础收益数量。
     * @property {number} randomWidth - 收益波动比例，范围 0-1。
     * @property {number} relationChange - 成功贸易后的关系变化值。
     * @property {number} goodwillReward - 成功贸易后获得的善名数量，非负资源数量。
     * @property {number} requiredGoodwill - 执行贸易所需善名门槛，非负资源数量。
     * @property {number} distanceSeconds - 贸易队往返所需时间，非负秒数。
     * @property {UnlockBundle} unlock - 显示该阵营所需的解锁条件。
     */

    /**
     * @typedef {Object} RaidTargetDefinition
     * @property {string} id - 掠夺目标稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {string} factionId - 关联阵营 ID。
     * @property {string} worldId - 所属世界 ID，必须对应 DiplomacyWorldDefinition.id。
     * @property {number} minRaiders - 发起掠夺需要派出的最低战斗职业哥布林数量，正整数。
     * @property {number} targetStrength - 目标地点强度，非负数。
     * @property {Object.<string, number>} rewards - 成功收益字典；key 为资源 ID，value 为资源数量。
     * @property {string[]} captiveTypes - 可能获得的俘虏类型 ID 数组。
     * @property {number} relationPenalty - 掠夺后关系下降值，非负数。
     * @property {number} infamyReward - 掠夺成功后获得的恶名数量，非负资源数量。
     * @property {number} infamyFailurePenalty - 掠夺失败后损失的恶名数量，非负资源数量。
     * @property {number} goodwillPenalty - 掠夺成功后损失的善名数量，非负资源数量。
     * @property {number} requiredInfamy - 发起掠夺所需恶名门槛，非负资源数量。
     * @property {number} distanceSeconds - 掠夺队往返所需时间，非负秒数。
     * @property {UnlockBundle} unlock - 显示该目标所需的解锁条件。
     */

    /**
     * @typedef {Object} PolicyDefinition
     * @property {string} id - 政策稳定 ID。
     * @property {string} groupId - 政策组稳定 ID，同组只能选择一个政策。
     * @property {string} groupName - 政策组中文显示名。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {string} effectSummary - 收益中文说明。
     * @property {string} costSummary - 代价中文说明。
     * @property {Object.<string, number>} effects - 政策效果字典；key 为效果 ID，value 为数值。
     * @property {UnlockBundle} unlock - 显示该政策所需的解锁条件。
     */

    /**
     * @typedef {Object} RitualUpgradeDefinition
     * @property {string} id - 祖灵升级稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {Price[]} price - 购买价格数组。
     * @property {Object.<string, number>} effects - 单局倍率效果字典；key 为效果 ID，value 为数值。
     * @property {UnlockBundle} unlock - 显示该升级所需的解锁条件。
     */

    /**
     * @typedef {Object} SacrificeDefinition
     * @property {string} id - 献祭操作稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {Price[]} cost - 献祭消耗数组。
     * @property {number} ancestralEchoReward - 基础祖灵回响收益，非负资源数量。
     * @property {number} riskChance - 影响具体哥布林的概率，范围 0-1。
     * @property {boolean} affectsGoblin - 是否可能影响具体哥布林对象。
     * @property {number} goblinCost - 需要献祭的存活哥布林数量，非负整数。
     * @property {string} conditionId - 显示和执行条件 ID。
     * @property {string} conditionSummary - 解锁条件中文说明。
     * @property {UnlockBundle} unlock - 显示该献祭所需的解锁条件。
     */

    /**
     * @typedef {Object} PactDefinition
     * @property {string} id - 深渊契约稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {string} effectSummary - 收益中文说明。
     * @property {string} costSummary - 代价中文说明。
     * @property {Object.<string, number>} effects - 契约效果字典；key 为效果 ID，value 为数值。
     */

    /**
     * @typedef {Object} ExpeditionRouteDefinition
     * @property {string} id - 远征路线稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {number} durationSeconds - 远征持续秒数，非负数。
     * @property {number} difficulty - 路线难度，非负数。
     * @property {number} casualtyChance - 失败伤亡基础概率，范围 0-1。
     * @property {string} unlockSummary - 路线解锁条件中文说明。
     * @property {Object.<string, {min: number, max: number}>} rewards - 成功收益范围字典。
     */

    /**
     * @typedef {Object} PrestigePerkDefinition
     * @property {string} id - 威望天赋稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {number} cost - 帝国遗产成本，非负整数。
     * @property {string} effectSummary - 效果中文摘要。
     * @property {Object.<string, number>} effects - 永久效果字典；key 为效果 ID，value 为数值。
     */

    /**
     * @typedef {Object} ChallengeDefinition
     * @property {string} id - 挑战稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {string} ruleSummary - 规则中文摘要。
     * @property {string} rewardSummary - 奖励中文摘要。
     * @property {Object.<string, number>} ruleEffects - 挑战规则效果字典；key 为效果 ID。
     * @property {Object.<string, number>} rewardEffects - 完成奖励效果字典；key 为效果 ID。
     */

    /**
     * @typedef {Object} WeatherDefinition
     * @property {string} id - 天气稳定 ID，作为运行时和存档引用。
     * @property {string} name - 天气中文显示名。
     * @property {string} description - 天气中文说明。
     * @property {number[]} seasonWeights - 四季权重数组，依次对应春夏秋冬，数值为非负权重。
     * @property {number} minDurationDays - 最短持续游戏日数，正整数。
     * @property {number} maxDurationDays - 最长持续游戏日数，正整数。
     * @property {Object.<string, number>} effects - 天气效果字典；key 为效果 ID，value 为加成比例。
     */

    /**
     * @typedef {Object} PopulationConstants
     * @property {number} fungusConsumptionPerGoblinSecond - 单个哥布林或俘虏的菌菇口粮消耗，单位为菌菇/秒。
     * @property {number} starvationCheckDays - 断粮死亡检查间隔，单位为游戏日，正整数。
     * @property {number} starvationDeathRatio - 每次断粮死亡比例，范围为 0-1。
     */

    // number 当前应用版本：写入新存档的整数版本来源。
    var SAVE_VERSION = 18;

    // number 每秒 tick 数：基础模拟节奏，版本一要求默认为 5。
    var TICKS_PER_SECOND = 5;

    // PopulationConstants 人口常量：控制存活哥布林和俘虏的菌菇消耗，以及断粮死亡节奏。
    var POPULATION_CONSTANTS = {
        fungusConsumptionPerGoblinSecond: 3.125,
        starvationCheckDays: 3,
        starvationDeathRatio: 0.1
    };

    // WeatherDefinition[] 天气定义列表：控制地穴自然波动和生产倍率。
    var WEATHER_DEFINITIONS = [
        {
            id: "clear",
            name: "稳潮",
            description: "洞壁湿度稳定，菌床、矿道和炉火都按常态运转。",
            seasonWeights: [
                4,
                3,
                3,
                4
            ],
            minDurationDays: 30,
            maxDurationDays: 90,
            effects: {}
        },
        {
            id: "damp",
            name: "湿涌",
            description: "地下水汽沿裂缝翻涌，菌菇和朽木更易生长，矿道略显泥泞。",
            seasonWeights: [
                5,
                3,
                4,
                2
            ],
            minDurationDays: 30,
            maxDurationDays: 90,
            effects: {
                fungusOutputRatio: 0.15,
                rottenWoodOutputRatio: 0.1,
                miningOutputRatio: -0.05
            }
        },
        {
            id: "spore_rain",
            name: "孢雨",
            description: "发亮孢子像雨一样落下，菌菇疯长，但哥布林挖矿时容易打喷嚏。",
            seasonWeights: [
                4,
                2,
                5,
                1
            ],
            minDurationDays: 30,
            maxDurationDays: 90,
            effects: {
                fungusOutputRatio: 0.3,
                miningOutputRatio: -0.1
            }
        },
        {
            id: "cave_wind",
            name: "穿洞风",
            description: "冷风穿过长矿道，吹干木料并让矿工更容易听见岩层裂响。",
            seasonWeights: [
                2,
                4,
                3,
                5
            ],
            minDurationDays: 30,
            maxDurationDays: 90,
            effects: {
                rottenWoodOutputRatio: -0.05,
                miningOutputRatio: 0.12
            }
        },
        {
            id: "acid_fog",
            name: "酸雾",
            description: "带腐蚀味的雾从深处漫上来，菌床萎缩，炉火和矿道都需要额外照看。",
            seasonWeights: [
                1,
                3,
                2,
                1
            ],
            minDurationDays: 30,
            maxDurationDays: 90,
            effects: {
                fungusOutputRatio: -0.2,
                rottenWoodOutputRatio: -0.1,
                miningOutputRatio: -0.08,
                industrialOutputRatio: -0.05
            }
        },
        {
            id: "lust_wind",
            name: "欲风",
            description: "温热怪风裹着甜腥孢粉吹过苗床，俘虏更易被驯化和孕育，但新生个体会显得虚弱。",
            seasonWeights: [
                2,
                4,
                3,
                1
            ],
            minDurationDays: 30,
            maxDurationDays: 90,
            effects: {
                captiveBrainwashCostRatio: -0.5,
                captiveBrainwashGainRatio: 0.5,
                captiveBreedingFailureRiskRatio: -0.5,
                captiveNewbornAttributePenalty: 1
            }
        }
    ];

    // TabDefinition[] 标签页定义列表：控制主界面可见标签页和默认顺序。
    var TAB_DEFINITIONS = [
        {
            id: "cavern",
            name: game.text.TEXT_REGISTRY.tabs.cavern.name,
            description: game.text.TEXT_REGISTRY.tabs.cavern.description,
            isVisibleAtStart: true
        },
        {
            id: "clan",
            name: game.text.TEXT_REGISTRY.tabs.clan.name,
            description: game.text.TEXT_REGISTRY.tabs.clan.description,
            isVisibleAtStart: false
        },
        {
            id: "research",
            name: game.text.TEXT_REGISTRY.tabs.research.name,
            description: game.text.TEXT_REGISTRY.tabs.research.description,
            isVisibleAtStart: false
        },
        {
            id: "workshop",
            name: game.text.TEXT_REGISTRY.tabs.workshop.name,
            description: game.text.TEXT_REGISTRY.tabs.workshop.description,
            isVisibleAtStart: false
        },
        {
            id: "diplomacy",
            name: game.text.TEXT_REGISTRY.tabs.diplomacy.name,
            description: game.text.TEXT_REGISTRY.tabs.diplomacy.description,
            isVisibleAtStart: false
        },
        {
            id: "ritual",
            name: game.text.TEXT_REGISTRY.tabs.ritual.name,
            description: game.text.TEXT_REGISTRY.tabs.ritual.description,
            isVisibleAtStart: false
        },
        {
            id: "empire",
            name: game.text.TEXT_REGISTRY.tabs.empire.name,
            description: game.text.TEXT_REGISTRY.tabs.empire.description,
            isVisibleAtStart: false
        },
        {
            id: "abyss",
            name: game.text.TEXT_REGISTRY.tabs.abyss.name,
            description: game.text.TEXT_REGISTRY.tabs.abyss.description,
            isVisibleAtStart: false
        }
    ];

    // ResourceDefinition[] 资源定义列表：版本一基础资源表。
    var RESOURCE_DEFINITIONS = [
        {
            id: "fungus",
            name: game.text.TEXT_REGISTRY.resources.fungus.name,
            category: "basic",
            defaultMaxValue: 100,
            isVisibleAtStart: true,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.fungus.description
        },
        {
            id: "rottenWood",
            name: game.text.TEXT_REGISTRY.resources.rottenWood.name,
            category: "basic",
            defaultMaxValue: 100,
            isVisibleAtStart: true,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.rottenWood.description
        },
        {
            id: "rubble",
            name: game.text.TEXT_REGISTRY.resources.rubble.name,
            category: "basic",
            defaultMaxValue: 100,
            isVisibleAtStart: true,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.rubble.description
        },
        {
            id: "labor",
            name: game.text.TEXT_REGISTRY.resources.labor.name,
            category: "basic",
            defaultMaxValue: 0,
            isVisibleAtStart: true,
            isCapacityLimited: false,
            description: game.text.TEXT_REGISTRY.resources.labor.description
        },
        {
            id: "crudeKnowledge",
            name: game.text.TEXT_REGISTRY.resources.crudeKnowledge.name,
            category: "basic",
            defaultMaxValue: 0,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.crudeKnowledge.description
        },
        {
            id: "obedience",
            name: game.text.TEXT_REGISTRY.resources.obedience.name,
            category: "basic",
            defaultMaxValue: 100,
            isVisibleAtStart: true,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.obedience.description
        },
        {
            id: "coalSlag",
            name: game.text.TEXT_REGISTRY.resources.coalSlag.name,
            category: "rare",
            defaultMaxValue: 60,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.coalSlag.description
        },
        {
            id: "ironOre",
            name: game.text.TEXT_REGISTRY.resources.ironOre.name,
            category: "rare",
            defaultMaxValue: 50,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.ironOre.description
        },
        {
            id: "ironPlate",
            name: game.text.TEXT_REGISTRY.resources.ironPlate.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.ironPlate.description
        },
        {
            id: "woodenBeam",
            name: game.text.TEXT_REGISTRY.resources.woodenBeam.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.woodenBeam.description
        },
        {
            id: "stoneSlab",
            name: game.text.TEXT_REGISTRY.resources.stoneSlab.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.stoneSlab.description
        },
        {
            id: "crudePickaxe",
            name: game.text.TEXT_REGISTRY.resources.crudePickaxe.name,
            category: "crafted",
            defaultMaxValue: 10,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.crudePickaxe.description
        },
        {
            id: "reinforcedBasket",
            name: game.text.TEXT_REGISTRY.resources.reinforcedBasket.name,
            category: "crafted",
            defaultMaxValue: 10,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.reinforcedBasket.description
        },
        {
            id: "sawtoothAxe",
            name: game.text.TEXT_REGISTRY.resources.sawtoothAxe.name,
            category: "crafted",
            defaultMaxValue: 10,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.sawtoothAxe.description
        },
        {
            id: "blastFurnace",
            name: game.text.TEXT_REGISTRY.resources.blastFurnace.name,
            category: "crafted",
            defaultMaxValue: 10,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.blastFurnace.description
        },
        {
            id: "leather",
            name: game.text.TEXT_REGISTRY.resources.leather.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.leather.description
        },
        {
            id: "boneShard",
            name: game.text.TEXT_REGISTRY.resources.boneShard.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.boneShard.description
        },
        {
            id: "coin",
            name: game.text.TEXT_REGISTRY.resources.coin.name,
            category: "rare",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.coin.description
        },
        {
            id: "steelIngot",
            name: game.text.TEXT_REGISTRY.resources.steelIngot.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.steelIngot.description
        },
        {
            id: "gear",
            name: game.text.TEXT_REGISTRY.resources.gear.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.gear.description
        },
        {
            id: "autoChute",
            name: game.text.TEXT_REGISTRY.resources.autoChute.name,
            category: "crafted",
            defaultMaxValue: 20,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.autoChute.description
        },
        {
            id: "chainmail",
            name: game.text.TEXT_REGISTRY.resources.chainmail.name,
            category: "crafted",
            defaultMaxValue: 20,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.chainmail.description
        },
        {
            id: "handcart",
            name: game.text.TEXT_REGISTRY.resources.handcart.name,
            category: "crafted",
            defaultMaxValue: 20,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.handcart.description
        },
        {
            id: "overseerWhip",
            name: game.text.TEXT_REGISTRY.resources.overseerWhip.name,
            category: "crafted",
            defaultMaxValue: 20,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.overseerWhip.description
        },
        {
            id: "ledger",
            name: game.text.TEXT_REGISTRY.resources.ledger.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.ledger.description
        },
        {
            id: "loot",
            name: game.text.TEXT_REGISTRY.resources.loot.name,
            category: "rare",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.loot.description
        },
        {
            id: "infamy",
            name: game.text.TEXT_REGISTRY.resources.infamy.name,
            category: "rare",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.infamy.description
        },
        {
            id: "goodwill",
            name: game.text.TEXT_REGISTRY.resources.goodwill.name,
            category: "rare",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.goodwill.description
        },
        {
            id: "captive",
            name: game.text.TEXT_REGISTRY.resources.captive.name,
            category: "rare",
            defaultMaxValue: 0,
            isVisibleAtStart: false,
            isCapacityLimited: false,
            description: game.text.TEXT_REGISTRY.resources.captive.description
        },
        {
            id: "ancestralEcho",
            name: game.text.TEXT_REGISTRY.resources.ancestralEcho.name,
            category: "mystic",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.ancestralEcho.description
        },
        {
            id: "tar",
            name: game.text.TEXT_REGISTRY.resources.tar.name,
            category: "rare",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.tar.description
        },
        {
            id: "blackIron",
            name: game.text.TEXT_REGISTRY.resources.blackIron.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.blackIron.description
        },
        {
            id: "runePlate",
            name: game.text.TEXT_REGISTRY.resources.runePlate.name,
            category: "crafted",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.runePlate.description
        },
        {
            id: "manaCrystal",
            name: game.text.TEXT_REGISTRY.resources.manaCrystal.name,
            category: "mystic",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.manaCrystal.description
        },
        {
            id: "warBanner",
            name: game.text.TEXT_REGISTRY.resources.warBanner.name,
            category: "crafted",
            defaultMaxValue: 20,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.warBanner.description
        },
        {
            id: "runeCarvingKnife",
            name: game.text.TEXT_REGISTRY.resources.runeCarvingKnife.name,
            category: "crafted",
            defaultMaxValue: 20,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.runeCarvingKnife.description
        },
        {
            id: "deepFurnaceValve",
            name: game.text.TEXT_REGISTRY.resources.deepFurnaceValve.name,
            category: "crafted",
            defaultMaxValue: 20,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.deepFurnaceValve.description
        },
        {
            id: "prestige",
            name: game.text.TEXT_REGISTRY.resources.prestige.name,
            category: "prestige",
            defaultMaxValue: 0,
            isVisibleAtStart: false,
            isCapacityLimited: false,
            description: game.text.TEXT_REGISTRY.resources.prestige.description
        },
        {
            id: "abyssEcho",
            name: game.text.TEXT_REGISTRY.resources.abyssEcho.name,
            category: "mystic",
            defaultMaxValue: 100,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.abyssEcho.description
        },
        {
            id: "relic",
            name: game.text.TEXT_REGISTRY.resources.relic.name,
            category: "prestige",
            defaultMaxValue: 20,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.relic.description
        },
        {
            id: "imperialLegacy",
            name: game.text.TEXT_REGISTRY.resources.imperialLegacy.name,
            category: "prestige",
            defaultMaxValue: 0,
            isVisibleAtStart: false,
            isCapacityLimited: false,
            description: game.text.TEXT_REGISTRY.resources.imperialLegacy.description
        },
        {
            id: "riftShard",
            name: game.text.TEXT_REGISTRY.resources.riftShard.name,
            category: "prestige",
            defaultMaxValue: 50,
            isVisibleAtStart: false,
            isCapacityLimited: true,
            description: game.text.TEXT_REGISTRY.resources.riftShard.description
        }
    ];

    // BuildingDefinition[] 建筑定义列表：先提供 1.1 验收需要的最小建筑入口。
    var BUILDING_DEFINITIONS = [
        {
            id: "fungus_bed",
            name: game.text.TEXT_REGISTRY.buildings.fungus_bed.name,
            description: game.text.TEXT_REGISTRY.buildings.fungus_bed.description,
            basePrice: [
                game.pricing.createPrice("fungus", 10)
            ],
            priceRatio: 1.12,
            effects: {
                fungusPerTick: 0.125
            },
            unlock: {
                isDefault: true
            }
        },
        {
            id: "rotten_grove",
            name: game.text.TEXT_REGISTRY.buildings.rotten_grove.name,
            description: game.text.TEXT_REGISTRY.buildings.rotten_grove.description,
            basePrice: [
                game.pricing.createPrice("fungus", 60),
                game.pricing.createPrice("rubble", 20)
            ],
            priceRatio: 1.14,
            effects: {
                laborUsage: 5,
                rottenWoodPerTick: 0.06
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "mud_hut",
            name: game.text.TEXT_REGISTRY.buildings.mud_hut.name,
            description: game.text.TEXT_REGISTRY.buildings.mud_hut.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 5)
            ],
            priceRatio: 2.5,
            effects: {
                housingMax: 2
            },
            unlock: {
                isDefault: true,
                tabs: [
                    "clan"
                ]
            }
        },
        {
            id: "spore_trench",
            name: game.text.TEXT_REGISTRY.buildings.spore_trench.name,
            description: game.text.TEXT_REGISTRY.buildings.spore_trench.description,
            basePrice: [
                game.pricing.createPrice("fungus", 100),
                game.pricing.createPrice("rottenWood", 10)
            ],
            priceRatio: 1.15,
            effects: {
                foodConsumptionReductionRatio: 0.005
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "drying_rack",
            name: game.text.TEXT_REGISTRY.buildings.drying_rack.name,
            description: game.text.TEXT_REGISTRY.buildings.drying_rack.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 120),
                game.pricing.createPrice("rubble", 80)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 2,
                rottenWoodMax: 120,
                rottenWoodOutputRatio: 0.08
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "cave_room",
            name: game.text.TEXT_REGISTRY.buildings.cave_room.name,
            description: game.text.TEXT_REGISTRY.buildings.cave_room.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 200),
                game.pricing.createPrice("rubble", 250)
            ],
            priceRatio: 1.15,
            effects: {
                housingMax: 1
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "barracks_cave",
            name: game.text.TEXT_REGISTRY.buildings.barracks_cave.name,
            description: game.text.TEXT_REGISTRY.buildings.barracks_cave.description,
            basePrice: [
                game.pricing.createPrice("ironPlate", 25),
                game.pricing.createPrice("stoneSlab", 12),
                game.pricing.createPrice("steelIngot", 10)
            ],
            priceRatio: 1.15,
            effects: {
                housingMax: 1,
                raidStrengthRatio: 0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "drip_channel",
            name: game.text.TEXT_REGISTRY.buildings.drip_channel.name,
            description: game.text.TEXT_REGISTRY.buildings.drip_channel.description,
            basePrice: [
                game.pricing.createPrice("rubble", 75)
            ],
            priceRatio: 1.12,
            effects: {
                laborUsage: 2,
                fungusOutputRatio: 0.03
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "weather_totem",
            name: game.text.TEXT_REGISTRY.buildings.weather_totem.name,
            description: game.text.TEXT_REGISTRY.buildings.weather_totem.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 45),
                game.pricing.createPrice("rubble", 35),
                game.pricing.createPrice("crudeKnowledge", 20)
            ],
            priceRatio: 1.14,
            effects: {
                laborUsage: 1,
                weatherNegativeMitigationRatio: 0.04
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "spore_sluice",
            name: game.text.TEXT_REGISTRY.buildings.spore_sluice.name,
            description: game.text.TEXT_REGISTRY.buildings.spore_sluice.description,
            basePrice: [
                game.pricing.createPrice("fungus", 240),
                game.pricing.createPrice("rottenWood", 45),
                game.pricing.createPrice("rubble", 55)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 3,
                fungusMax: 1000,
                weatherPositiveAmplificationRatio: 0.04
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "graffiti_wall",
            name: game.text.TEXT_REGISTRY.buildings.graffiti_wall.name,
            description: game.text.TEXT_REGISTRY.buildings.graffiti_wall.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 25)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 3,
                crudeKnowledgeMax: 250,
                crudeKnowledgeOutputRatio: 0.1
            },
            unlock: {
                isDefault: true,
                tabs: [
                    "research"
                ],
                resources: [
                    "crudeKnowledge"
                ],
                jobs: [
                    "graffiti_apprentice"
                ]
            }
        },
        {
            id: "storage_pit",
            name: game.text.TEXT_REGISTRY.buildings.storage_pit.name,
            description: game.text.TEXT_REGISTRY.buildings.storage_pit.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 50)
            ],
            priceRatio: 1.75,
            effects: {
                fungusMax: 5000,
                rottenWoodMax: 200,
                rubbleMax: 250,
                coalSlagMax: 60,
                ironOreMax: 50
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "witch_doctor_hut",
            name: game.text.TEXT_REGISTRY.buildings.witch_doctor_hut.name,
            description: game.text.TEXT_REGISTRY.buildings.witch_doctor_hut.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 50),
                game.pricing.createPrice("rubble", 70),
                game.pricing.createPrice("crudeKnowledge", 100)
            ],
            priceRatio: 1.15,
            effects: {
                crudeKnowledgeMax: 500,
                obedienceMax: 25
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "wooden_storehouse",
            name: game.text.TEXT_REGISTRY.buildings.wooden_storehouse.name,
            description: game.text.TEXT_REGISTRY.buildings.wooden_storehouse.description,
            basePrice: [
                game.pricing.createPrice("woodenBeam", 2),
                game.pricing.createPrice("stoneSlab", 2)
            ],
            priceRatio: 1.15,
            effects: {
                rottenWoodMax: 150,
                rubbleMax: 200,
                coalSlagMax: 30,
                ironOreMax: 25
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "hauling_post",
            name: game.text.TEXT_REGISTRY.buildings.hauling_post.name,
            description: game.text.TEXT_REGISTRY.buildings.hauling_post.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 80),
                game.pricing.createPrice("rubble", 60)
            ],
            priceRatio: 1.14,
            effects: {
                rubbleOutputRatio: 0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "shallow_mine",
            name: game.text.TEXT_REGISTRY.buildings.shallow_mine.name,
            description: game.text.TEXT_REGISTRY.buildings.shallow_mine.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 100)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 15,
                rubbleOutputRatio: 0.2,
                coalSlagPerTick: 0.015
            },
            unlock: {
                isDefault: false,
                resources: [
                    "coalSlag"
                ]
            }
        },
        {
            id: "artisan_shed",
            name: game.text.TEXT_REGISTRY.buildings.artisan_shed.name,
            description: game.text.TEXT_REGISTRY.buildings.artisan_shed.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 100),
                game.pricing.createPrice("rubble", 400)
            ],
            priceRatio: 1.15,
            effects: {
                ironPlateMax: 50
            },
            unlock: {
                isDefault: false,
                tabs: [
                    "workshop"
                ],
                crafts: [
                    "wooden_beam",
                    "stone_slab",
                    "iron_plate",
                    "crude_pickaxe",
                    "reinforced_basket",
                    "sawtooth_axe",
                    "blast_furnace"
                ]
            }
        },
        {
            id: "crude_furnace",
            name: game.text.TEXT_REGISTRY.buildings.crude_furnace.name,
            description: game.text.TEXT_REGISTRY.buildings.crude_furnace.description,
            basePrice: [
                game.pricing.createPrice("rubble", 200)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 12,
                crudeFurnaceWoodCostPerSecond: 0.04,
                crudeFurnaceRubbleCostPerSecond: 0.025,
                crudeFurnaceIronOrePerSecond: 0.018,
                crudeFurnaceIronPlatePerSecond: 0.006
            },
            unlock: {
                isDefault: false,
                resources: [
                    "ironOre",
                    "ironPlate"
                ]
            }
        },
        {
            id: "pulley_gallery",
            name: game.text.TEXT_REGISTRY.buildings.pulley_gallery.name,
            description: game.text.TEXT_REGISTRY.buildings.pulley_gallery.description,
            basePrice: [
                game.pricing.createPrice("woodenBeam", 8),
                game.pricing.createPrice("ironPlate", 15)
            ],
            priceRatio: 1.16,
            effects: {
                laborUsageReductionRatio: 0.03
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rubble_yard",
            name: game.text.TEXT_REGISTRY.buildings.rubble_yard.name,
            description: game.text.TEXT_REGISTRY.buildings.rubble_yard.description,
            basePrice: [
                game.pricing.createPrice("stoneSlab", 4),
                game.pricing.createPrice("woodenBeam", 2)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 10,
                rubbleOutputRatio: 0.35,
                coalSlagPerTick: 0.015
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "charcoal_kiln",
            name: game.text.TEXT_REGISTRY.buildings.charcoal_kiln.name,
            description: game.text.TEXT_REGISTRY.buildings.charcoal_kiln.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 180),
                game.pricing.createPrice("rubble", 120),
                game.pricing.createPrice("coalSlag", 15)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 8,
                charcoalKilnWoodCostPerSecond: 0.03,
                charcoalKilnCoalSlagPerSecond: 0.012
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "vent_shaft",
            name: game.text.TEXT_REGISTRY.buildings.vent_shaft.name,
            description: game.text.TEXT_REGISTRY.buildings.vent_shaft.description,
            basePrice: [
                game.pricing.createPrice("woodenBeam", 6),
                game.pricing.createPrice("stoneSlab", 8),
                game.pricing.createPrice("ironPlate", 8)
            ],
            priceRatio: 1.16,
            effects: {
                laborUsage: 6,
                weatherNegativeMitigationRatio: 0.06,
                industrialOutputRatio: 0.01
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "beast_pen",
            name: game.text.TEXT_REGISTRY.buildings.beast_pen.name,
            description: game.text.TEXT_REGISTRY.buildings.beast_pen.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 120),
                game.pricing.createPrice("rubble", 80)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 6,
                leatherPerSecond: 0.01,
                boneShardPerSecond: 0.006
            },
            unlock: {
                isDefault: false,
                resources: [
                    "leather",
                    "boneShard"
                ]
            }
        },
        {
            id: "bad_wine_barrel",
            name: game.text.TEXT_REGISTRY.buildings.bad_wine_barrel.name,
            description: game.text.TEXT_REGISTRY.buildings.bad_wine_barrel.description,
            basePrice: [
                game.pricing.createPrice("fungus", 500),
                game.pricing.createPrice("woodenBeam", 2)
            ],
            priceRatio: 1.18,
            effects: {
                laborUsage: 3,
                obediencePerSecond: 0.01,
                fungusConsumptionIncreaseRatio: 0.005
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "chief_hall",
            name: game.text.TEXT_REGISTRY.buildings.chief_hall.name,
            description: game.text.TEXT_REGISTRY.buildings.chief_hall.description,
            basePrice: [
                game.pricing.createPrice("woodenBeam", 25),
                game.pricing.createPrice("stoneSlab", 25),
                game.pricing.createPrice("coin", 10)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 10,
                obediencePerSecond: 0.02
            },
            unlock: {
                isDefault: false,
                tabs: [
                    "empire"
                ]
            }
        },
        {
            id: "black_market",
            name: game.text.TEXT_REGISTRY.buildings.black_market.name,
            description: game.text.TEXT_REGISTRY.buildings.black_market.description,
            basePrice: [
                game.pricing.createPrice("coin", 15),
                game.pricing.createPrice("woodenBeam", 10)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 8,
                coinPerSecond: 0.01
            },
            unlock: {
                isDefault: false,
                resources: [
                    "coin"
                ]
            }
        },
        {
            id: "training_pit",
            name: game.text.TEXT_REGISTRY.buildings.training_pit.name,
            description: game.text.TEXT_REGISTRY.buildings.training_pit.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 100),
                game.pricing.createPrice("ironPlate", 20)
            ],
            priceRatio: 1.15,
            effects: {
                raidStrengthRatio: 0.08
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "overseer_platform",
            name: game.text.TEXT_REGISTRY.buildings.overseer_platform.name,
            description: game.text.TEXT_REGISTRY.buildings.overseer_platform.description,
            basePrice: [
                game.pricing.createPrice("ironPlate", 25),
                game.pricing.createPrice("ledger", 4),
                game.pricing.createPrice("coin", 20)
            ],
            priceRatio: 1.15,
            effects: {
                obedienceMax: 20,
                laborUsageReductionRatio: 0.04
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "weapon_shed",
            name: game.text.TEXT_REGISTRY.buildings.weapon_shed.name,
            description: game.text.TEXT_REGISTRY.buildings.weapon_shed.description,
            basePrice: [
                game.pricing.createPrice("ironPlate", 50),
                game.pricing.createPrice("woodenBeam", 10)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 8,
                lootMax: 100,
                raidStrengthRatio: 0.1
            },
            unlock: {
                isDefault: false,
                resources: [
                    "loot"
                ]
            }
        },
        {
            id: "captive_bed",
            name: game.text.TEXT_REGISTRY.buildings.captive_bed.name,
            description: game.text.TEXT_REGISTRY.buildings.captive_bed.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 250),
                game.pricing.createPrice("ironPlate", 40),
                game.pricing.createPrice("loot", 15)
            ],
            priceRatio: 1.15,
            effects: {
                captiveMax: 3
            },
            unlock: {
                isDefault: false,
                resources: [
                    "captive"
                ]
            }
        },
        {
            id: "brainwash_shed",
            name: game.text.TEXT_REGISTRY.buildings.brainwash_shed.name,
            description: game.text.TEXT_REGISTRY.buildings.brainwash_shed.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 180),
                game.pricing.createPrice("rubble", 120),
                game.pricing.createPrice("crudeKnowledge", 250)
            ],
            priceRatio: 1.15,
            effects: {
                crudeKnowledgeMax: 250,
                captiveModifyKnowledgeRatio: 0.15
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "ledger_room",
            name: game.text.TEXT_REGISTRY.buildings.ledger_room.name,
            description: game.text.TEXT_REGISTRY.buildings.ledger_room.description,
            basePrice: [
                game.pricing.createPrice("rottenWood", 300),
                game.pricing.createPrice("coin", 20),
                game.pricing.createPrice("ledger", 5)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 8,
                crudeKnowledgeMax: 500,
                ledgerPerSecond: 0.01
            },
            unlock: {
                isDefault: false,
                resources: [
                    "ledger"
                ]
            }
        },
        {
            id: "ancestral_altar",
            name: game.text.TEXT_REGISTRY.buildings.ancestral_altar.name,
            description: game.text.TEXT_REGISTRY.buildings.ancestral_altar.description,
            basePrice: [
                game.pricing.createPrice("stoneSlab", 250),
                game.pricing.createPrice("loot", 20)
            ],
            priceRatio: 1.15,
            effects: {
                laborUsage: 6,
                ancestralEchoPerSecond: 0.002,
                ancestralEchoMax: 500
            },
            unlock: {
                isDefault: false,
                tabs: [
                    "ritual"
                ],
                resources: [
                    "ancestralEcho"
                ]
            }
        },
        {
            id: "underground_port",
            name: game.text.TEXT_REGISTRY.buildings.underground_port.name,
            description: game.text.TEXT_REGISTRY.buildings.underground_port.description,
            basePrice: [
                game.pricing.createPrice("stoneSlab", 50),
                game.pricing.createPrice("ironPlate", 75),
                game.pricing.createPrice("woodenBeam", 50)
            ],
            priceRatio: 1.15,
            effects: {
                allBasicCapacity: 500
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "tar_well",
            name: game.text.TEXT_REGISTRY.buildings.tar_well.name,
            description: game.text.TEXT_REGISTRY.buildings.tar_well.description,
            basePrice: [
                game.pricing.createPrice("steelIngot", 10),
                game.pricing.createPrice("gear", 5),
                game.pricing.createPrice("stoneSlab", 50)
            ],
            priceRatio: 1.16,
            effects: {
                laborUsage: 12,
                tarPerSecond: 0.02,
                tarMax: 250
            },
            unlock: {
                isDefault: false,
                resources: [
                    "tar"
                ]
            }
        },
        {
            id: "deep_furnace",
            name: game.text.TEXT_REGISTRY.buildings.deep_furnace.name,
            description: game.text.TEXT_REGISTRY.buildings.deep_furnace.description,
            basePrice: [
                game.pricing.createPrice("steelIngot", 25),
                game.pricing.createPrice("gear", 10),
                game.pricing.createPrice("tar", 40)
            ],
            priceRatio: 1.16,
            effects: {
                laborUsage: 18,
                deepFurnaceSteelPerSecond: 0.006,
                deepFurnaceBlackIronPerSecond: 0.002,
                deepFurnaceTarCostPerSecond: 0.01
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "black_iron_fortress",
            name: game.text.TEXT_REGISTRY.buildings.black_iron_fortress.name,
            description: game.text.TEXT_REGISTRY.buildings.black_iron_fortress.description,
            basePrice: [
                game.pricing.createPrice("blackIron", 25),
                game.pricing.createPrice("steelIngot", 50),
                game.pricing.createPrice("warBanner", 2)
            ],
            priceRatio: 1.2,
            effects: {
                raidStrengthRatio: 0.15,
                lootMax: 250,
                fortressAchievement: 1
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "black_iron_dwelling",
            name: game.text.TEXT_REGISTRY.buildings.black_iron_dwelling.name,
            description: game.text.TEXT_REGISTRY.buildings.black_iron_dwelling.description,
            basePrice: [
                game.pricing.createPrice("blackIron", 10),
                game.pricing.createPrice("steelIngot", 15)
            ],
            priceRatio: 1.18,
            effects: {
                housingMax: 2,
                raidStrengthRatio: 0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rune_machine_room",
            name: game.text.TEXT_REGISTRY.buildings.rune_machine_room.name,
            description: game.text.TEXT_REGISTRY.buildings.rune_machine_room.description,
            basePrice: [
                game.pricing.createPrice("steelIngot", 50),
                game.pricing.createPrice("runePlate", 10),
                game.pricing.createPrice("manaCrystal", 10)
            ],
            priceRatio: 1.17,
            effects: {
                laborUsage: 20,
                crudeKnowledgeMax: 1500,
                runeMachineKnowledgePerSecond: 0.04,
                runeMachineManaCostPerSecond: 0.006
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "war_camp",
            name: game.text.TEXT_REGISTRY.buildings.war_camp.name,
            description: game.text.TEXT_REGISTRY.buildings.war_camp.description,
            basePrice: [
                game.pricing.createPrice("warBanner", 3),
                game.pricing.createPrice("steelIngot", 25),
                game.pricing.createPrice("loot", 50)
            ],
            priceRatio: 1.16,
            effects: {
                laborUsage: 12,
                raidStrengthRatio: 0.15,
                lootMax: 150
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "abyss_gate",
            name: game.text.TEXT_REGISTRY.buildings.abyss_gate.name,
            description: game.text.TEXT_REGISTRY.buildings.abyss_gate.description,
            basePrice: [
                game.pricing.createPrice("blackIron", 100),
                game.pricing.createPrice("runePlate", 25),
                game.pricing.createPrice("manaCrystal", 100)
            ],
            priceRatio: 1.25,
            effects: {
                laborUsage: 25,
                abyssEchoMax: 500,
                abyssEchoPerSecond: 0.004,
                abyssGateOpened: 1
            },
            unlock: {
                isDefault: false,
                tabs: [
                    "abyss"
                ],
                resources: [
                    "abyssEcho",
                    "relic",
                    "imperialLegacy",
                    "riftShard"
                ]
            }
        },
        {
            id: "sacrifice_pit",
            name: game.text.TEXT_REGISTRY.buildings.sacrifice_pit.name,
            description: game.text.TEXT_REGISTRY.buildings.sacrifice_pit.description,
            basePrice: [
                game.pricing.createPrice("blackIron", 50),
                game.pricing.createPrice("manaCrystal", 80)
            ],
            priceRatio: 1.18,
            effects: {
                laborUsage: 12,
                abyssEchoPerSecond: 0.01,
                eventRiskRatio: 0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "void_warehouse",
            name: game.text.TEXT_REGISTRY.buildings.void_warehouse.name,
            description: game.text.TEXT_REGISTRY.buildings.void_warehouse.description,
            basePrice: [
                game.pricing.createPrice("blackIron", 60),
                game.pricing.createPrice("manaCrystal", 120)
            ],
            priceRatio: 1.16,
            effects: {
                manaCrystalMax: 500,
                abyssEchoMax: 500,
                relicMax: 20,
                riftShardMax: 25
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "expedition_camp",
            name: game.text.TEXT_REGISTRY.buildings.expedition_camp.name,
            description: game.text.TEXT_REGISTRY.buildings.expedition_camp.description,
            basePrice: [
                game.pricing.createPrice("blackIron", 40),
                game.pricing.createPrice("runePlate", 10),
                game.pricing.createPrice("loot", 100)
            ],
            priceRatio: 1.16,
            effects: {
                relicMax: 10,
                abyssEchoMax: 150
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rift_anchor",
            name: game.text.TEXT_REGISTRY.buildings.rift_anchor.name,
            description: game.text.TEXT_REGISTRY.buildings.rift_anchor.description,
            basePrice: [
                game.pricing.createPrice("runePlate", 30),
                game.pricing.createPrice("manaCrystal", 150),
                game.pricing.createPrice("relic", 5)
            ],
            priceRatio: 1.2,
            effects: {
                riftShardMax: 100,
                abyssEchoMax: 300
            },
            unlock: {
                isDefault: false
            }
        }
    ];

    // TechnologyDefinition[] 科技定义列表：版本一研究入口。
    var TECHNOLOGY_DEFINITIONS = [
        {
            id: "marks",
            name: game.text.TEXT_REGISTRY.technologies.marks.name,
            description: game.text.TEXT_REGISTRY.technologies.marks.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 10)
            ],
            unlocks: {
                technologies: [
                    "deadwood_cultivation",
                    "foraging",
                    "digging",
                    "hut_building",
                    "mining"
                ]
            },
            unlock: {
                isDefault: true
            }
        },
        {
            id: "deadwood_cultivation",
            name: game.text.TEXT_REGISTRY.technologies.deadwood_cultivation.name,
            description: game.text.TEXT_REGISTRY.technologies.deadwood_cultivation.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 18),
                game.pricing.createPrice("rottenWood", 20)
            ],
            unlocks: {
                buildings: [
                    "rotten_grove"
                ],
                technologies: [
                    "woodcraft",
                    "big_club"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "foraging",
            name: game.text.TEXT_REGISTRY.technologies.foraging.name,
            description: game.text.TEXT_REGISTRY.technologies.foraging.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 25)
            ],
            unlocks: {
                buildings: [
                    "storage_pit",
                    "spore_trench"
                ],
                jobs: [
                    "forager"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "digging",
            name: game.text.TEXT_REGISTRY.technologies.digging.name,
            description: game.text.TEXT_REGISTRY.technologies.digging.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 20)
            ],
            unlocks: {
                buildings: [
                    "drip_channel"
                ],
                technologies: [
                    "weather_signs"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "hut_building",
            name: game.text.TEXT_REGISTRY.technologies.hut_building.name,
            description: game.text.TEXT_REGISTRY.technologies.hut_building.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 15)
            ],
            unlocks: {
                buildings: [
                    "mud_hut",
                    "cave_room",
                    "wooden_storehouse"
                ],
                technologies: [
                    "labor_rosters",
                    "woodcraft"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "labor_rosters",
            name: game.text.TEXT_REGISTRY.technologies.labor_rosters.name,
            description: game.text.TEXT_REGISTRY.technologies.labor_rosters.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 45),
                game.pricing.createPrice("rubble", 50)
            ],
            unlocks: {
                buildings: [
                    "hauling_post"
                ],
                technologies: [
                    "pulley_systems"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "weather_signs",
            name: game.text.TEXT_REGISTRY.technologies.weather_signs.name,
            description: game.text.TEXT_REGISTRY.technologies.weather_signs.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 40),
                game.pricing.createPrice("rubble", 30)
            ],
            unlocks: {
                buildings: [
                    "weather_totem",
                    "spore_sluice"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "woodcraft",
            name: game.text.TEXT_REGISTRY.technologies.woodcraft.name,
            description: game.text.TEXT_REGISTRY.technologies.woodcraft.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 60),
                game.pricing.createPrice("rottenWood", 120)
            ],
            unlocks: {
                buildings: [
                    "drying_rack"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "mining",
            name: game.text.TEXT_REGISTRY.technologies.mining.name,
            description: game.text.TEXT_REGISTRY.technologies.mining.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 50)
            ],
            unlocks: {
                resources: [
                    "coalSlag",
                    "ironOre"
                ],
                buildings: [
                    "shallow_mine",
                    "artisan_shed",
                    "crude_furnace"
                ],
                jobs: [
                    "miner"
                ],
                technologies: [
                    "metallurgy",
                    "beast_pen",
                    "crossbow",
                    "crude_tools",
                    "clan_rules"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "metallurgy",
            name: game.text.TEXT_REGISTRY.technologies.metallurgy.name,
            description: game.text.TEXT_REGISTRY.technologies.metallurgy.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 80),
                game.pricing.createPrice("coalSlag", 10)
            ],
            unlocks: {
                buildings: [
                    "rubble_yard"
                ],
                jobs: [
                    "smelter"
                ],
                technologies: [
                    "charcoal_burning",
                    "cave_ventilation"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "charcoal_burning",
            name: game.text.TEXT_REGISTRY.technologies.charcoal_burning.name,
            description: game.text.TEXT_REGISTRY.technologies.charcoal_burning.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 100),
                game.pricing.createPrice("rottenWood", 160),
                game.pricing.createPrice("coalSlag", 10)
            ],
            unlocks: {
                buildings: [
                    "charcoal_kiln"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "pulley_systems",
            name: game.text.TEXT_REGISTRY.technologies.pulley_systems.name,
            description: game.text.TEXT_REGISTRY.technologies.pulley_systems.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 130),
                game.pricing.createPrice("woodenBeam", 4),
                game.pricing.createPrice("ironPlate", 6)
            ],
            unlocks: {
                buildings: [
                    "pulley_gallery"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "cave_ventilation",
            name: game.text.TEXT_REGISTRY.technologies.cave_ventilation.name,
            description: game.text.TEXT_REGISTRY.technologies.cave_ventilation.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 140),
                game.pricing.createPrice("coalSlag", 15),
                game.pricing.createPrice("ironPlate", 4)
            ],
            unlocks: {
                buildings: [
                    "vent_shaft"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "beast_pen",
            name: game.text.TEXT_REGISTRY.technologies.beast_pen.name,
            description: game.text.TEXT_REGISTRY.technologies.beast_pen.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 60),
                game.pricing.createPrice("rubble", 80)
            ],
            unlocks: {
                buildings: [
                    "beast_pen"
                ],
                resources: [
                    "leather",
                    "boneShard"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "big_club",
            name: game.text.TEXT_REGISTRY.technologies.big_club.name,
            description: game.text.TEXT_REGISTRY.technologies.big_club.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 45),
                game.pricing.createPrice("rottenWood", 80)
            ],
            unlocks: {
                jobs: [
                    "raider"
                ],
                buildings: [
                    "training_pit",
                    "bad_wine_barrel",
                    "captive_bed"
                ],
                resources: [
                    "captive"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "crossbow",
            name: game.text.TEXT_REGISTRY.technologies.crossbow.name,
            description: game.text.TEXT_REGISTRY.technologies.crossbow.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 90),
                game.pricing.createPrice("ironPlate", 5)
            ],
            unlocks: {
                buildings: [
                    "weapon_shed",
                    "barracks_cave"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "crude_tools",
            name: game.text.TEXT_REGISTRY.technologies.crude_tools.name,
            description: game.text.TEXT_REGISTRY.technologies.crude_tools.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 70),
                game.pricing.createPrice("ironPlate", 3)
            ],
            unlocks: {
                jobs: [
                    "artisan"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "desire_enlightenment",
            name: game.text.TEXT_REGISTRY.technologies.desire_enlightenment.name,
            description: game.text.TEXT_REGISTRY.technologies.desire_enlightenment.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 35),
                game.pricing.createPrice("fungus", 100)
            ],
            unlocks: {
                technologies: [
                    "public_nursery"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "public_nursery",
            name: game.text.TEXT_REGISTRY.technologies.public_nursery.name,
            description: game.text.TEXT_REGISTRY.technologies.public_nursery.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 80),
                game.pricing.createPrice("fungus", 150)
            ],
            unlocks: {},
            unlock: {
                isDefault: false
            }
        },
        {
            id: "clan_rules",
            name: game.text.TEXT_REGISTRY.technologies.clan_rules.name,
            description: game.text.TEXT_REGISTRY.technologies.clan_rules.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 150),
                game.pricing.createPrice("ironPlate", 10)
            ],
            unlocks: {
                buildings: [
                    "chief_hall"
                ],
                policies: [
                    "trade_focus",
                    "raid_focus",
                    "intimidation",
                    "rationing",
                    "deep_digging",
                    "reinforcement",
                    "ancestor_veneration",
                    "blood_moon"
                ],
                technologies: [
                    "census",
                    "counting",
                    "calendar",
                    "overseer_drills",
                    "engineering",
                    "currency",
                    "writing",
                    "rituals",
                    "machinery",
                    "steel"
                ],
                jobs: [
                    "overseer"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "overseer_drills",
            name: game.text.TEXT_REGISTRY.technologies.overseer_drills.name,
            description: game.text.TEXT_REGISTRY.technologies.overseer_drills.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 260),
                game.pricing.createPrice("coin", 20),
                game.pricing.createPrice("ledger", 4)
            ],
            unlocks: {
                buildings: [
                    "overseer_platform"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "census",
            name: game.text.TEXT_REGISTRY.technologies.census.name,
            description: game.text.TEXT_REGISTRY.technologies.census.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 80)
            ],
            unlocks: {},
            unlock: {
                isDefault: false
            }
        },
        {
            id: "counting",
            name: game.text.TEXT_REGISTRY.technologies.counting.name,
            description: game.text.TEXT_REGISTRY.technologies.counting.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 120)
            ],
            unlocks: {
                resources: [
                    "ledger"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "calendar",
            name: game.text.TEXT_REGISTRY.technologies.calendar.name,
            description: game.text.TEXT_REGISTRY.technologies.calendar.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 160),
                game.pricing.createPrice("ledger", 3)
            ],
            unlocks: {},
            unlock: {
                isDefault: false
            }
        },
        {
            id: "engineering",
            name: game.text.TEXT_REGISTRY.technologies.engineering.name,
            description: game.text.TEXT_REGISTRY.technologies.engineering.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 160),
                game.pricing.createPrice("ironPlate", 10)
            ],
            unlocks: {
                buildings: [
                    "underground_port"
                ],
                jobs: [
                    "engineer"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "currency",
            name: game.text.TEXT_REGISTRY.technologies.currency.name,
            description: game.text.TEXT_REGISTRY.technologies.currency.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 140),
                game.pricing.createPrice("loot", 5)
            ],
            unlocks: {
                resources: [
                    "coin"
                ],
                buildings: [
                    "black_market"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "writing",
            name: game.text.TEXT_REGISTRY.technologies.writing.name,
            description: game.text.TEXT_REGISTRY.technologies.writing.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 180),
                game.pricing.createPrice("ledger", 5)
            ],
            unlocks: {
                buildings: [
                    "ledger_room"
                ],
                jobs: [
                    "accountant"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rituals",
            name: game.text.TEXT_REGISTRY.technologies.rituals.name,
            description: game.text.TEXT_REGISTRY.technologies.rituals.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 160),
                game.pricing.createPrice("boneShard", 20)
            ],
            unlocks: {
                buildings: [
                    "ancestral_altar",
                    "witch_doctor_hut",
                    "brainwash_shed"
                ],
                jobs: [
                    "witch_doctor"
                ],
                resources: [
                    "ancestralEcho"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "machinery",
            name: game.text.TEXT_REGISTRY.technologies.machinery.name,
            description: game.text.TEXT_REGISTRY.technologies.machinery.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 220),
                game.pricing.createPrice("ironPlate", 20)
            ],
            unlocks: {
                resources: [
                    "gear",
                    "autoChute",
                    "handcart"
                ],
                crafts: [
                    "gear",
                    "auto_chute",
                    "handcart"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "steel",
            name: game.text.TEXT_REGISTRY.technologies.steel.name,
            description: game.text.TEXT_REGISTRY.technologies.steel.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 240),
                game.pricing.createPrice("ironPlate", 30),
                game.pricing.createPrice("coalSlag", 30)
            ],
            unlocks: {
                resources: [
                    "steelIngot",
                    "chainmail",
                    "overseerWhip",
                    "tar",
                    "blackIron",
                    "runePlate",
                    "manaCrystal",
                    "prestige"
                ],
                crafts: [
                    "steel_ingot",
                    "chainmail",
                    "overseer_whip",
                    "black_iron",
                    "rune_plate",
                    "war_banner",
                    "rune_carving_knife",
                    "deep_furnace_valve"
                ],
                technologies: [
                    "surface_lore"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "surface_lore",
            name: game.text.TEXT_REGISTRY.technologies.surface_lore.name,
            description: game.text.TEXT_REGISTRY.technologies.surface_lore.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 280),
                game.pricing.createPrice("ledger", 10)
            ],
            unlocks: {
                buildings: [
                    "war_camp"
                ],
                technologies: [
                    "diplomacy"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "diplomacy",
            name: game.text.TEXT_REGISTRY.technologies.diplomacy.name,
            description: game.text.TEXT_REGISTRY.technologies.diplomacy.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 350),
                game.pricing.createPrice("ledger", 20)
            ],
            unlocks: {
                buildings: [
                    "underground_port"
                ],
                technologies: [
                    "runology"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "runology",
            name: game.text.TEXT_REGISTRY.technologies.runology.name,
            description: game.text.TEXT_REGISTRY.technologies.runology.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 600),
                game.pricing.createPrice("manaCrystal", 25)
            ],
            unlocks: {
                buildings: [
                    "rune_machine_room"
                ],
                jobs: [
                    "rune_smith"
                ],
                crafts: [
                    "rune_plate",
                    "rune_carving_knife"
                ],
                technologies: [
                    "black_iron_smelting"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "black_iron_smelting",
            name: game.text.TEXT_REGISTRY.technologies.black_iron_smelting.name,
            description: game.text.TEXT_REGISTRY.technologies.black_iron_smelting.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 900),
                game.pricing.createPrice("steelIngot", 100)
            ],
            unlocks: {
                buildings: [
                    "tar_well",
                    "deep_furnace",
                    "black_iron_fortress",
                    "black_iron_dwelling"
                ],
                jobs: [
                    "deep_miner",
                    "war_chief"
                ],
                crafts: [
                    "black_iron",
                    "deep_furnace_valve",
                    "war_banner"
                ],
                technologies: [
                    "imperial_code"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "imperial_code",
            name: game.text.TEXT_REGISTRY.technologies.imperial_code.name,
            description: game.text.TEXT_REGISTRY.technologies.imperial_code.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 1200),
                game.pricing.createPrice("coin", 200)
            ],
            unlocks: {
                resources: [
                    "prestige"
                ],
                technologies: [
                    "abyss_mapping"
                ],
                policies: [
                    "total_industry",
                    "cave_maintenance",
                    "imperial_bureaucracy",
                    "warlord_autonomy"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "abyss_mapping",
            name: game.text.TEXT_REGISTRY.technologies.abyss_mapping.name,
            description: game.text.TEXT_REGISTRY.technologies.abyss_mapping.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 1500),
                game.pricing.createPrice("runePlate", 25)
            ],
            unlocks: {
                buildings: [
                    "abyss_gate",
                    "expedition_camp"
                ],
                resources: [
                    "abyssEcho"
                ],
                technologies: [
                    "pact_lore"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "pact_lore",
            name: game.text.TEXT_REGISTRY.technologies.pact_lore.name,
            description: game.text.TEXT_REGISTRY.technologies.pact_lore.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 1800),
                game.pricing.createPrice("abyssEcho", 100)
            ],
            unlocks: {
                buildings: [
                    "sacrifice_pit",
                    "void_warehouse"
                ],
                technologies: [
                    "rift_engineering"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rift_engineering",
            name: game.text.TEXT_REGISTRY.technologies.rift_engineering.name,
            description: game.text.TEXT_REGISTRY.technologies.rift_engineering.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 2200),
                game.pricing.createPrice("relic", 5)
            ],
            unlocks: {
                buildings: [
                    "rift_anchor"
                ],
                resources: [
                    "riftShard"
                ],
                technologies: [
                    "migration_code"
                ]
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "migration_code",
            name: game.text.TEXT_REGISTRY.technologies.migration_code.name,
            description: game.text.TEXT_REGISTRY.technologies.migration_code.description,
            price: [
                game.pricing.createPrice("crudeKnowledge", 3000),
                game.pricing.createPrice("abyssEcho", 250),
                game.pricing.createPrice("riftShard", 10)
            ],
            unlocks: {
                resources: [
                    "imperialLegacy"
                ]
            },
            unlock: {
                isDefault: false
            }
        }
    ];

    // JobDefinition[] 职业定义列表：版本一基础职业。
    var JOB_DEFINITIONS = [
        {
            id: "woodcutter",
            name: game.text.TEXT_REGISTRY.jobs.woodcutter.name,
            skillId: "woodcutting",
            attributeWeights: {
                strength: 0.45,
                perception: 0.35,
                will: 0.2
            },
            baseOutput: {
                rottenWood: 0.018
            },
            unlock: {
                isDefault: true
            }
        },
        {
            id: "forager",
            name: game.text.TEXT_REGISTRY.jobs.forager.name,
            skillId: "foraging",
            attributeWeights: {
                perception: 0.5,
                dexterity: 0.25,
                cunning: 0.25
            },
            baseOutput: {
                fungus: 1
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "hauler",
            name: game.text.TEXT_REGISTRY.jobs.hauler.name,
            skillId: "hauling",
            attributeWeights: {
                strength: 0.55,
                will: 0.25,
                dexterity: 0.2
            },
            baseOutput: {
                rubble: 0.05
            },
            unlock: {
                isDefault: true
            }
        },
        {
            id: "graffiti_apprentice",
            name: game.text.TEXT_REGISTRY.jobs.graffiti_apprentice.name,
            skillId: "scribing",
            attributeWeights: {
                cunning: 0.45,
                perception: 0.35,
                attunement: 0.2
            },
            baseOutput: {
                crudeKnowledge: 0.035
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "miner",
            name: game.text.TEXT_REGISTRY.jobs.miner.name,
            skillId: "mining",
            attributeWeights: {
                strength: 0.55,
                perception: 0.25,
                will: 0.2
            },
            baseOutput: {
                rubble: 0.05,
                coalSlag: 0.015,
                ironOre: 0.004
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "smelter",
            name: game.text.TEXT_REGISTRY.jobs.smelter.name,
            skillId: "smelting",
            attributeWeights: {
                strength: 0.3,
                perception: 0.35,
                will: 0.35
            },
            baseOutput: {
                coalSlag: 0.015,
                ironOre: 0.01,
                ironPlate: 0.003
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "raider",
            name: game.text.TEXT_REGISTRY.jobs.raider.name,
            skillId: "raiding",
            attributeWeights: {
                strength: 0.5,
                dexterity: 0.2,
                cunning: 0.3
            },
            baseOutput: {
                loot: 0.001
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "artisan",
            name: game.text.TEXT_REGISTRY.jobs.artisan.name,
            skillId: "crafting",
            attributeWeights: {
                dexterity: 0.55,
                cunning: 0.25,
                perception: 0.2
            },
            baseOutput: {
                crudeKnowledge: 0.02
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "accountant",
            name: game.text.TEXT_REGISTRY.jobs.accountant.name,
            skillId: "scribing",
            attributeWeights: {
                cunning: 0.45,
                perception: 0.35,
                will: 0.2
            },
            baseOutput: {
                coin: 0.006,
                ledger: 0.01
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "overseer",
            name: game.text.TEXT_REGISTRY.jobs.overseer.name,
            skillId: "overseeing",
            attributeWeights: {
                will: 0.5,
                strength: 0.25,
                cunning: 0.25
            },
            baseOutput: {
                obedience: 0.02
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "witch_doctor",
            name: game.text.TEXT_REGISTRY.jobs.witch_doctor.name,
            skillId: "ritual",
            attributeWeights: {
                attunement: 0.55,
                will: 0.25,
                perception: 0.2
            },
            baseOutput: {
                ancestralEcho: 0.0015,
                obedience: 0.006
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "engineer",
            name: game.text.TEXT_REGISTRY.jobs.engineer.name,
            skillId: "crafting",
            attributeWeights: {
                dexterity: 0.5,
                perception: 0.25,
                cunning: 0.25
            },
            baseOutput: {
                gear: 0.002,
                crudeKnowledge: 0.02
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rune_smith",
            name: game.text.TEXT_REGISTRY.jobs.rune_smith.name,
            skillId: "crafting",
            attributeWeights: {
                attunement: 0.45,
                dexterity: 0.3,
                perception: 0.25
            },
            baseOutput: {
                manaCrystal: 0.001,
                crudeKnowledge: 0.03
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "war_chief",
            name: game.text.TEXT_REGISTRY.jobs.war_chief.name,
            skillId: "raiding",
            attributeWeights: {
                strength: 0.35,
                cunning: 0.35,
                will: 0.3
            },
            baseOutput: {
                loot: 0.006
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "deep_miner",
            name: game.text.TEXT_REGISTRY.jobs.deep_miner.name,
            skillId: "mining",
            attributeWeights: {
                strength: 0.35,
                perception: 0.35,
                attunement: 0.3
            },
            baseOutput: {
                tar: 0.006,
                blackIron: 0.001,
                manaCrystal: 0.0006
            },
            unlock: {
                isDefault: false
            }
        }
    ];

    // PolicyDefinition[] 政策定义列表：版本三城邦政策，按政策组互斥选择。
    var POLICY_DEFINITIONS = [
        {
            id: "trade_focus",
            groupId: "expansion",
            groupName: "扩张方式",
            name: game.text.TEXT_REGISTRY.policies.trade_focus.name,
            description: game.text.TEXT_REGISTRY.policies.trade_focus.description,
            effectSummary: "贸易收益 +15%，交易关系变化 +1。",
            costSummary: "掠夺队伍强度 -5%。",
            effects: {
                tradeRewardRatio: 0.15,
                tradeRelationBonus: 1,
                raidStrengthRatio: -0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "raid_focus",
            groupId: "expansion",
            groupName: "扩张方式",
            name: game.text.TEXT_REGISTRY.policies.raid_focus.name,
            description: game.text.TEXT_REGISTRY.policies.raid_focus.description,
            effectSummary: "掠夺队伍强度 +15%，战利品收益 +10%。",
            costSummary: "贸易收益 -10%。",
            effects: {
                raidStrengthRatio: 0.15,
                raidLootRatio: 0.1,
                tradeRewardRatio: -0.1
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "intimidation",
            groupId: "rule",
            groupName: "统治方式",
            name: game.text.TEXT_REGISTRY.policies.intimidation.name,
            description: game.text.TEXT_REGISTRY.policies.intimidation.description,
            effectSummary: "服从职业产出 +15%。",
            costSummary: "事故风险随低服从更明显。",
            effects: {
                obedienceOutputRatio: 0.15
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rationing",
            groupId: "rule",
            groupName: "统治方式",
            name: game.text.TEXT_REGISTRY.policies.rationing.name,
            description: game.text.TEXT_REGISTRY.policies.rationing.description,
            effectSummary: "菌菇人口消耗 -10%。",
            costSummary: "战利品收益 -5%。",
            effects: {
                fungusConsumptionRatio: -0.1,
                raidLootRatio: -0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "deep_digging",
            groupId: "mining",
            groupName: "矿业方式",
            name: game.text.TEXT_REGISTRY.policies.deep_digging.name,
            description: game.text.TEXT_REGISTRY.policies.deep_digging.description,
            effectSummary: "矿业职业产出 +15%。",
            costSummary: "事故概率 +10%。",
            effects: {
                miningOutputRatio: 0.15,
                eventRiskRatio: 0.1
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "reinforcement",
            groupId: "mining",
            groupName: "矿业方式",
            name: game.text.TEXT_REGISTRY.policies.reinforcement.name,
            description: game.text.TEXT_REGISTRY.policies.reinforcement.description,
            effectSummary: "事故概率 -15%。",
            costSummary: "矿业职业产出 -5%。",
            effects: {
                eventStabilityRatio: 0.15,
                miningOutputRatio: -0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "ancestor_veneration",
            groupId: "ritual",
            groupName: "祭祀方式",
            name: game.text.TEXT_REGISTRY.policies.ancestor_veneration.name,
            description: game.text.TEXT_REGISTRY.policies.ancestor_veneration.description,
            effectSummary: "祖灵回响职业产出 +15%，事故概率 -5%。",
            costSummary: "掠夺队伍强度 -5%。",
            effects: {
                ancestralEchoOutputRatio: 0.15,
                eventStabilityRatio: 0.05,
                raidStrengthRatio: -0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "blood_moon",
            groupId: "ritual",
            groupName: "祭祀方式",
            name: game.text.TEXT_REGISTRY.policies.blood_moon.name,
            description: game.text.TEXT_REGISTRY.policies.blood_moon.description,
            effectSummary: "祖灵回响职业产出 +25%，战利品收益 +10%。",
            costSummary: "事故概率 +15%。",
            effects: {
                ancestralEchoOutputRatio: 0.25,
                raidLootRatio: 0.1,
                eventRiskRatio: 0.15
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "total_industry",
            groupId: "industry",
            groupName: "工业路线",
            name: game.text.TEXT_REGISTRY.policies.total_industry.name,
            description: game.text.TEXT_REGISTRY.policies.total_industry.description,
            effectSummary: "工业建筑产出 +15%，工程师自动制作 +10%。",
            costSummary: "事故概率 +15%。",
            effects: {
                industrialOutputRatio: 0.15,
                autoCraftRatio: 0.1,
                eventRiskRatio: 0.15
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "cave_maintenance",
            groupId: "industry",
            groupName: "工业路线",
            name: game.text.TEXT_REGISTRY.policies.cave_maintenance.name,
            description: game.text.TEXT_REGISTRY.policies.cave_maintenance.description,
            effectSummary: "事故概率 -15%，菌菇消耗 -5%，服从产出 +5%。",
            costSummary: "工业建筑产出 -5%。",
            effects: {
                eventStabilityRatio: 0.15,
                fungusConsumptionRatio: -0.05,
                obedienceOutputRatio: 0.05,
                industrialOutputRatio: -0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "imperial_bureaucracy",
            groupId: "empire",
            groupName: "帝国路线",
            name: game.text.TEXT_REGISTRY.policies.imperial_bureaucracy.name,
            description: game.text.TEXT_REGISTRY.policies.imperial_bureaucracy.description,
            effectSummary: "工程师自动制作 +20%，贸易收益 +10%。",
            costSummary: "掠夺收益 -5%。",
            effects: {
                autoCraftRatio: 0.2,
                tradeRewardRatio: 0.1,
                raidLootRatio: -0.05
            },
            unlock: {
                isDefault: false
            }
        },
        {
            id: "warlord_autonomy",
            groupId: "empire",
            groupName: "帝国路线",
            name: game.text.TEXT_REGISTRY.policies.warlord_autonomy.name,
            description: game.text.TEXT_REGISTRY.policies.warlord_autonomy.description,
            effectSummary: "掠夺队伍强度 +15%，掠夺收益 +15%。",
            costSummary: "事故和内斗风险 +10%。",
            effects: {
                raidStrengthRatio: 0.15,
                raidLootRatio: 0.15,
                eventRiskRatio: 0.1
            },
            unlock: {
                isDefault: false
            }
        }
    ];

    // RitualUpgradeDefinition[] 祖灵升级定义列表：消耗祖灵回响提供本局倍率。
    var RITUAL_UPGRADE_DEFINITIONS = [
        {
            id: "ancestor_whisper",
            name: "祖灵低语",
            description: "让涂鸦和账册里偶尔出现能用的祖灵提示。",
            price: [
                game.pricing.createPrice("ancestralEcho", 100)
            ],
            effects: {
                crudeKnowledgeOutputRatio: 0.05
            },
            unlock: {
                isDefault: true
            }
        },
        {
            id: "bone_talisman",
            name: "骸骨护符",
            description: "把碎骨和回响绑在监工身上，压低矿塌和爆燃概率。",
            price: [
                game.pricing.createPrice("ancestralEcho", 250),
                game.pricing.createPrice("boneShard", 100)
            ],
            effects: {
                eventStabilityRatio: 0.05
            },
            unlock: {
                isDefault: true
            }
        },
        {
            id: "chief_sacred_name",
            name: "酋长圣名",
            description: "给酋长编一个祖灵认可的圣名，让服从恢复更快。",
            price: [
                game.pricing.createPrice("ancestralEcho", 500),
                game.pricing.createPrice("coin", 50)
            ],
            effects: {
                obedienceOutputRatio: 0.05
            },
            unlock: {
                isDefault: true
            }
        },
        {
            id: "war_drum_echo",
            name: "战鼓回音",
            description: "让抢掠兵出发前听见地下回声，提高战利品收获。",
            price: [
                game.pricing.createPrice("ancestralEcho", 1000),
                game.pricing.createPrice("loot", 100)
            ],
            effects: {
                raidLootRatio: 0.1
            },
            unlock: {
                isDefault: true
            }
        },
        {
            id: "cavern_sacred_fire",
            name: "地穴圣火",
            description: "用煤渣维持祖灵火盆，强化菌菇和工业链。",
            price: [
                game.pricing.createPrice("ancestralEcho", 2500),
                game.pricing.createPrice("coalSlag", 500)
            ],
            effects: {
                fungusOutputRatio: 0.05,
                industrialOutputRatio: 0.05
            },
            unlock: {
                isDefault: true
            }
        }
    ];

    // SacrificeDefinition[] 献祭定义列表：把资源或风险转化为祖灵回响。
    var SACRIFICE_DEFINITIONS = [
        {
            id: "loot_offering",
            name: "战利品献祭",
            description: "把抢来的破烂堆到祖灵祭坛下，换取稳定回响。",
            cost: [
                game.pricing.createPrice("loot", 10)
            ],
            ancestralEchoReward: 25,
            riskChance: 0,
            affectsGoblin: false,
            goblinCost: 0,
            conditionId: "always",
            conditionSummary: "已解锁祭祀标签。",
            unlock: {
                isDefault: true
            }
        },
        {
            id: "blood_oath",
            name: "血誓献祭",
            description: "让巫医或倒霉哥布林承受祖灵回声，收益更高但可能留下伤病。",
            cost: [
                game.pricing.createPrice("loot", 15),
                game.pricing.createPrice("boneShard", 5)
            ],
            ancestralEchoReward: 45,
            riskChance: 0.35,
            affectsGoblin: true,
            goblinCost: 0,
            conditionId: "always",
            conditionSummary: "已解锁祭祀标签。",
            unlock: {
                isDefault: true
            }
        },
        {
            id: "abyss_whisper",
            name: "深渊低语",
            description: "让巫医把深渊回响导入祖灵符号，收益高但更容易留下烙印。",
            cost: [
                game.pricing.createPrice("abyssEcho", 25),
                game.pricing.createPrice("loot", 20)
            ],
            ancestralEchoReward: 95,
            riskChance: 0.45,
            affectsGoblin: true,
            goblinCost: 0,
            conditionId: "abyss_echo_seen",
            conditionSummary: "需要显示深渊回响资源。",
            unlock: {
                isDefault: true
            }
        },
        {
            id: "blood_moon_sacrifice",
            name: "血月献祭",
            description: "在血月政策下把倒霉哥布林推入坑中，换取大量祖灵回响。",
            cost: [
                game.pricing.createPrice("loot", 50),
                game.pricing.createPrice("boneShard", 25)
            ],
            ancestralEchoReward: 180,
            riskChance: 0.25,
            affectsGoblin: true,
            goblinCost: 1,
            conditionId: "blood_moon_policy",
            conditionSummary: "需要祭祀方式政策选择血月献祭。",
            unlock: {
                isDefault: true
            }
        }
    ];

    // PactDefinition[] 深渊契约定义列表：终局强倍率和明确代价。
    var PACT_DEFINITIONS = [
        {
            id: "hunger_pact",
            name: game.text.TEXT_REGISTRY.pacts.hunger_pact.name,
            description: game.text.TEXT_REGISTRY.pacts.hunger_pact.description,
            effectSummary: "俘虏苗床产出的哥布林更难填饱。",
            costSummary: "菌菇人口消耗 +10%。",
            effects: {
                fungusConsumptionRatio: 0.1
            }
        },
        {
            id: "black_furnace_pact",
            name: game.text.TEXT_REGISTRY.pacts.black_furnace_pact.name,
            description: game.text.TEXT_REGISTRY.pacts.black_furnace_pact.description,
            effectSummary: "工业建筑产出 +15%。",
            costSummary: "事故概率 +15%。",
            effects: {
                industrialOutputRatio: 0.15,
                eventRiskRatio: 0.15
            }
        },
        {
            id: "rift_pact",
            name: game.text.TEXT_REGISTRY.pacts.rift_pact.name,
            description: game.text.TEXT_REGISTRY.pacts.rift_pact.description,
            effectSummary: "魔晶职业产出 +20%。",
            costSummary: "服从 -0.01/秒。",
            effects: {
                manaCrystalOutputRatio: 0.2,
                obedienceDrainPerSecond: 0.01
            }
        },
        {
            id: "war_pact",
            name: game.text.TEXT_REGISTRY.pacts.war_pact.name,
            description: game.text.TEXT_REGISTRY.pacts.war_pact.description,
            effectSummary: "掠夺队伍强度 +20%，掠夺收益 +25%。",
            costSummary: "贸易收益 -15%，事故概率 +5%。",
            effects: {
                raidStrengthRatio: 0.2,
                raidLootRatio: 0.25,
                tradeRewardRatio: -0.15,
                eventRiskRatio: 0.05
            }
        }
    ];

    // ExpeditionRouteDefinition[] 远征路线定义列表：深渊页的路线选择和风险评估来源。
    var EXPEDITION_ROUTE_DEFINITIONS = [
        {
            id: "normal_depths",
            name: "裂隙边缘侦察",
            description: "沿着深渊门附近的稳定裂缝搜集回响，适合作为第一支远征队的探路行动。",
            durationSeconds: 45,
            difficulty: 35,
            casualtyChance: 0.12,
            unlockSummary: "需要深渊门或深渊远征标签可见。",
            rewards: {
                abyssEcho: {
                    min: 25,
                    max: 45
                },
                manaCrystal: {
                    min: 2,
                    max: 5
                }
            }
        },
        {
            id: "ruin_route",
            name: "古代废矿搜索",
            description: "搜索旧帝国废矿和坍塌矿车，重点回收遗物与深渊回响。",
            durationSeconds: 60,
            difficulty: 55,
            casualtyChance: 0.2,
            unlockSummary: "需要深渊门或深渊远征标签可见。",
            rewards: {
                relic: {
                    min: 1,
                    max: 3
                },
                abyssEcho: {
                    min: 35,
                    max: 65
                }
            }
        },
        {
            id: "rift_route",
            name: "裂隙核心远征",
            description: "穿过不稳定裂隙核心，尝试带回裂隙碎片与高浓度魔晶。",
            durationSeconds: 75,
            difficulty: 75,
            casualtyChance: 0.28,
            unlockSummary: "需要裂隙碎片资源可见或裂隙工程阶段。",
            rewards: {
                riftShard: {
                    min: 1,
                    max: 4
                },
                manaCrystal: {
                    min: 5,
                    max: 12
                }
            }
        },
        {
            id: "high_risk_abyss",
            name: "高风险深渊路线",
            description: "深入回声最强的裂缝，收益和损失都会放大。",
            durationSeconds: 90,
            difficulty: 95,
            casualtyChance: 0.38,
            unlockSummary: "需要深渊门或深渊远征标签可见；建议有高技能成员。",
            rewards: {
                relic: {
                    min: 2,
                    max: 5
                },
                abyssEcho: {
                    min: 80,
                    max: 140
                },
                riftShard: {
                    min: 2,
                    max: 6
                }
            }
        }
    ];

    // PrestigePerkDefinition[] 威望天赋定义列表：迁徙后永久成长的购买项。
    var PRESTIGE_PERK_DEFINITIONS = [
        {
            id: "cave_engineering",
            name: game.text.TEXT_REGISTRY.prestigePerks.cave_engineering.name,
            description: game.text.TEXT_REGISTRY.prestigePerks.cave_engineering.description,
            cost: 5,
            effectSummary: "建筑价格 -1%。",
            effects: {
                buildingPriceRatio: -0.01
            }
        },
        {
            id: "old_ledger",
            name: game.text.TEXT_REGISTRY.prestigePerks.old_ledger.name,
            description: game.text.TEXT_REGISTRY.prestigePerks.old_ledger.description,
            cost: 25,
            effectSummary: "账册和符文板制作 +5%。",
            effects: {
                ledgerCraftRatio: 0.05,
                runePlateCraftRatio: 0.05
            }
        },
        {
            id: "greedy_bloodline",
            name: game.text.TEXT_REGISTRY.prestigePerks.greedy_bloodline.name,
            description: game.text.TEXT_REGISTRY.prestigePerks.greedy_bloodline.description,
            cost: 50,
            effectSummary: "金币和战利品收益 +10%。",
            effects: {
                coinLootGainRatio: 0.1
            }
        },
        {
            id: "deep_instinct",
            name: game.text.TEXT_REGISTRY.prestigePerks.deep_instinct.name,
            description: game.text.TEXT_REGISTRY.prestigePerks.deep_instinct.description,
            cost: 75,
            effectSummary: "矿物容量 +10%。",
            effects: {
                mineralCapacityRatio: 0.1
            }
        },
        {
            id: "black_iron_tradition",
            name: game.text.TEXT_REGISTRY.prestigePerks.black_iron_tradition.name,
            description: game.text.TEXT_REGISTRY.prestigePerks.black_iron_tradition.description,
            cost: 100,
            effectSummary: "钢锭、黑铁制作 +5%。",
            effects: {
                metalCraftRatio: 0.05
            }
        },
        {
            id: "ancestor_memory",
            name: game.text.TEXT_REGISTRY.prestigePerks.ancestor_memory.name,
            description: game.text.TEXT_REGISTRY.prestigePerks.ancestor_memory.description,
            cost: 150,
            effectSummary: "迁徙后保留少量祖灵回响。",
            effects: {
                ancestralEchoRetentionRatio: 0.05
            }
        },
        {
            id: "abyss_adaptation",
            name: game.text.TEXT_REGISTRY.prestigePerks.abyss_adaptation.name,
            description: game.text.TEXT_REGISTRY.prestigePerks.abyss_adaptation.description,
            cost: 250,
            effectSummary: "深渊契约代价 -5%。",
            effects: {
                pactCostRatio: -0.05
            }
        },
        {
            id: "imperial_bureaucracy",
            name: game.text.TEXT_REGISTRY.prestigePerks.imperial_bureaucracy.name,
            description: game.text.TEXT_REGISTRY.prestigePerks.imperial_bureaucracy.description,
            cost: 500,
            effectSummary: "职业预设获得永久支撑。",
            effects: {
                jobPresetSupport: 1
            }
        }
    ];

    // ChallengeDefinition[] 挑战定义列表：新局挑战规则和跨局奖励来源。
    var CHALLENGE_DEFINITIONS = [
        {
            id: "eternal_winter_cave",
            name: game.text.TEXT_REGISTRY.challenges.eternal_winter_cave.name,
            description: game.text.TEXT_REGISTRY.challenges.eternal_winter_cave.description,
            ruleSummary: "菌菇产出长期 -50%。",
            rewardSummary: "食物建筑永久 +5%。",
            ruleEffects: {
                fungusOutputRatio: -0.5
            },
            rewardEffects: {
                foodBuildingOutputRatio: 0.05
            }
        },
        {
            id: "no_trade_empire",
            name: game.text.TEXT_REGISTRY.challenges.no_trade_empire.name,
            description: game.text.TEXT_REGISTRY.challenges.no_trade_empire.description,
            ruleSummary: "禁止普通贸易，只能掠夺。",
            rewardSummary: "掠夺收益永久 +5%。",
            ruleEffects: {
                isTradeDisabled: 1
            },
            rewardEffects: {
                raidLootRatio: 0.05
            }
        },
        {
            id: "rebellion_age",
            name: game.text.TEXT_REGISTRY.challenges.rebellion_age.name,
            description: game.text.TEXT_REGISTRY.challenges.rebellion_age.description,
            ruleSummary: "服从上限 -25%，事故风险 +25%。",
            rewardSummary: "监工和酋长厅永久 +10%。",
            ruleEffects: {
                obedienceMaxRatio: -0.25,
                eventRiskRatio: 0.25
            },
            rewardEffects: {
                obedienceBuildingOutputRatio: 0.1
            }
        },
        {
            id: "poor_ore_layer",
            name: game.text.TEXT_REGISTRY.challenges.poor_ore_layer.name,
            description: game.text.TEXT_REGISTRY.challenges.poor_ore_layer.description,
            ruleSummary: "矿物产出 -40%。",
            rewardSummary: "仓储和加工倍率永久 +5%。",
            ruleEffects: {
                mineralOutputRatio: -0.4
            },
            rewardEffects: {
                storageAndProcessingRatio: 0.05
            }
        },
        {
            id: "no_rituals",
            name: game.text.TEXT_REGISTRY.challenges.no_rituals.name,
            description: game.text.TEXT_REGISTRY.challenges.no_rituals.description,
            ruleSummary: "禁用祖灵和深渊系统。",
            rewardSummary: "科研产出永久 +5%。",
            ruleEffects: {
                isRitualAndAbyssDisabled: 1
            },
            rewardEffects: {
                researchOutputRatio: 0.05
            }
        }
    ];

    // ManualActionDefinition[] 手动行动定义列表：版本一初始采集按钮。
    var MANUAL_ACTION_DEFINITIONS = [
        {
            id: "gather_fungus",
            name: "采菌",
            description: "从潮湿石缝里抠出一点能吃的菌菇。",
            resource: "fungus",
            amount: 1
        },
        {
            id: "pick_rotten_wood",
            name: "捡朽木",
            description: "捡起还能勉强支撑窝棚的腐木。",
            resource: "rottenWood",
            amount: 1
        },
        {
            id: "haul_rubble",
            name: "搬碎石",
            description: "把松动碎石搬回地穴深处备用。",
            resource: "rubble",
            amount: 1
        }
    ];

    // CraftRecipeDefinition[] 工坊配方定义列表：版本二基础手工制作入口。
    var CRAFT_RECIPE_DEFINITIONS = [
        {
            id: "wooden_beam",
            name: game.text.TEXT_REGISTRY.resources.woodenBeam.name,
            description: game.text.TEXT_REGISTRY.resources.woodenBeam.description,
            price: [
                game.pricing.createPrice("rottenWood", 175)
            ],
            outputResource: "woodenBeam",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "stone_slab",
            name: game.text.TEXT_REGISTRY.resources.stoneSlab.name,
            description: game.text.TEXT_REGISTRY.resources.stoneSlab.description,
            price: [
                game.pricing.createPrice("rubble", 250)
            ],
            outputResource: "stoneSlab",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "iron_plate",
            name: game.text.TEXT_REGISTRY.resources.ironPlate.name,
            description: game.text.TEXT_REGISTRY.resources.ironPlate.description,
            price: [
                game.pricing.createPrice("ironOre", 125)
            ],
            outputResource: "ironPlate",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "crude_pickaxe",
            name: game.text.TEXT_REGISTRY.resources.crudePickaxe.name,
            description: game.text.TEXT_REGISTRY.resources.crudePickaxe.description,
            price: [
                game.pricing.createPrice("rottenWood", 40),
                game.pricing.createPrice("ironPlate", 2)
            ],
            outputResource: "crudePickaxe",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "reinforced_basket",
            name: game.text.TEXT_REGISTRY.resources.reinforcedBasket.name,
            description: game.text.TEXT_REGISTRY.resources.reinforcedBasket.description,
            price: [
                game.pricing.createPrice("rottenWood", 60),
                game.pricing.createPrice("leather", 5)
            ],
            outputResource: "reinforcedBasket",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "sawtooth_axe",
            name: game.text.TEXT_REGISTRY.resources.sawtoothAxe.name,
            description: game.text.TEXT_REGISTRY.resources.sawtoothAxe.description,
            price: [
                game.pricing.createPrice("rottenWood", 50),
                game.pricing.createPrice("ironPlate", 4)
            ],
            outputResource: "sawtoothAxe",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "blast_furnace",
            name: game.text.TEXT_REGISTRY.resources.blastFurnace.name,
            description: game.text.TEXT_REGISTRY.resources.blastFurnace.description,
            price: [
                game.pricing.createPrice("coalSlag", 40),
                game.pricing.createPrice("ironPlate", 8)
            ],
            outputResource: "blastFurnace",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "steel_ingot",
            name: game.text.TEXT_REGISTRY.resources.steelIngot.name,
            description: game.text.TEXT_REGISTRY.resources.steelIngot.description,
            price: [
                game.pricing.createPrice("ironPlate", 20),
                game.pricing.createPrice("coalSlag", 30)
            ],
            outputResource: "steelIngot",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "gear",
            name: game.text.TEXT_REGISTRY.resources.gear.name,
            description: game.text.TEXT_REGISTRY.resources.gear.description,
            price: [
                game.pricing.createPrice("ironPlate", 10),
                game.pricing.createPrice("steelIngot", 1)
            ],
            outputResource: "gear",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "auto_chute",
            name: game.text.TEXT_REGISTRY.resources.autoChute.name,
            description: game.text.TEXT_REGISTRY.resources.autoChute.description,
            price: [
                game.pricing.createPrice("gear", 25),
                game.pricing.createPrice("steelIngot", 100)
            ],
            outputResource: "autoChute",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "chainmail",
            name: game.text.TEXT_REGISTRY.resources.chainmail.name,
            description: game.text.TEXT_REGISTRY.resources.chainmail.description,
            price: [
                game.pricing.createPrice("ironPlate", 100),
                game.pricing.createPrice("leather", 50)
            ],
            outputResource: "chainmail",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "handcart",
            name: game.text.TEXT_REGISTRY.resources.handcart.name,
            description: game.text.TEXT_REGISTRY.resources.handcart.description,
            price: [
                game.pricing.createPrice("woodenBeam", 25),
                game.pricing.createPrice("ironPlate", 10)
            ],
            outputResource: "handcart",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "overseer_whip",
            name: game.text.TEXT_REGISTRY.resources.overseerWhip.name,
            description: game.text.TEXT_REGISTRY.resources.overseerWhip.description,
            price: [
                game.pricing.createPrice("leather", 100),
                game.pricing.createPrice("coin", 20)
            ],
            outputResource: "overseerWhip",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "black_iron",
            name: game.text.TEXT_REGISTRY.resources.blackIron.name,
            description: game.text.TEXT_REGISTRY.resources.blackIron.description,
            price: [
                game.pricing.createPrice("steelIngot", 2),
                game.pricing.createPrice("tar", 10),
                game.pricing.createPrice("coalSlag", 20)
            ],
            outputResource: "blackIron",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rune_plate",
            name: game.text.TEXT_REGISTRY.resources.runePlate.name,
            description: game.text.TEXT_REGISTRY.resources.runePlate.description,
            price: [
                game.pricing.createPrice("blackIron", 2),
                game.pricing.createPrice("manaCrystal", 1)
            ],
            outputResource: "runePlate",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "war_banner",
            name: game.text.TEXT_REGISTRY.resources.warBanner.name,
            description: game.text.TEXT_REGISTRY.resources.warBanner.description,
            price: [
                game.pricing.createPrice("leather", 20),
                game.pricing.createPrice("steelIngot", 1),
                game.pricing.createPrice("loot", 15)
            ],
            outputResource: "warBanner",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "rune_carving_knife",
            name: game.text.TEXT_REGISTRY.resources.runeCarvingKnife.name,
            description: game.text.TEXT_REGISTRY.resources.runeCarvingKnife.description,
            price: [
                game.pricing.createPrice("steelIngot", 3),
                game.pricing.createPrice("manaCrystal", 2)
            ],
            outputResource: "runeCarvingKnife",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        },
        {
            id: "deep_furnace_valve",
            name: game.text.TEXT_REGISTRY.resources.deepFurnaceValve.name,
            description: game.text.TEXT_REGISTRY.resources.deepFurnaceValve.description,
            price: [
                game.pricing.createPrice("gear", 3),
                game.pricing.createPrice("blackIron", 2)
            ],
            outputResource: "deepFurnaceValve",
            outputAmount: 1,
            unlock: {
                isDefault: false
            }
        }
    ];

    // EventDefinition[] 事件定义列表：版本二事故和临时事件。
    var EVENT_DEFINITIONS = [
        {
            id: "fungus_bloom",
            name: "菌潮",
            conditionId: "has_fungus_economy",
            baseChancePerCheck: 0.03,
            logLevel: "important",
            cooldownSeconds: 180
        },
        {
            id: "mine_collapse",
            name: "矿塌",
            conditionId: "has_mines_and_low_obedience",
            baseChancePerCheck: 0.02,
            logLevel: "warning",
            cooldownSeconds: 240
        },
        {
            id: "furnace_burst",
            name: "熔炉爆燃",
            conditionId: "has_furnace_industry",
            baseChancePerCheck: 0.018,
            logLevel: "warning",
            cooldownSeconds: 240
        },
        {
            id: "blood_moon_festival",
            name: "血月菌潮",
            conditionId: "has_ancestral_altar",
            baseChancePerCheck: 0.015,
            logLevel: "important",
            cooldownSeconds: 360
        },
        {
            id: "caravan_passed",
            name: "商队经过",
            conditionId: "has_black_market",
            baseChancePerCheck: 0.018,
            logLevel: "normal",
            cooldownSeconds: 300
        },
        {
            id: "chief_roar",
            name: "酋长怒吼",
            conditionId: "has_chief_hall_low_obedience",
            baseChancePerCheck: 0.02,
            logLevel: "important",
            cooldownSeconds: 240
        },
        {
            id: "abyss_whisper_event",
            name: "深渊低语",
            conditionId: "has_abyss_gate",
            baseChancePerCheck: 0.012,
            logLevel: "warning",
            cooldownSeconds: 420
        },
        {
            id: "clear_stable_shift",
            name: "稳潮轮值",
            conditionId: "current_weather",
            baseChancePerCheck: 0.014,
            logLevel: "normal",
            cooldownSeconds: 240,
            riskMode: "neutral",
            weatherIds: [
                "clear"
            ],
            resourceChanges: [
                { resource: "obedience", amount: 6 },
                { resource: "crudeKnowledge", amount: 4 }
            ],
            logText: "洞壁水线稳定，守夜哥布林顺手整理了口令和刻痕。"
        },
        {
            id: "damp_mushroom_surge",
            name: "湿涌菌簇",
            conditionId: "current_weather",
            baseChancePerCheck: 0.018,
            logLevel: "important",
            cooldownSeconds: 260,
            riskMode: "neutral",
            weatherIds: [
                "damp"
            ],
            resourceChanges: [
                { resource: "fungus", amount: 45 },
                { resource: "rottenWood", amount: 15 }
            ],
            logText: "水汽把阴沟里的菌簇催得发亮，捡柴工也拖回一批湿软朽木。"
        },
        {
            id: "damp_flooded_gallery",
            name: "湿涌漫坑",
            conditionId: "current_weather",
            baseChancePerCheck: 0.012,
            logLevel: "warning",
            cooldownSeconds: 320,
            riskMode: "accident",
            weatherIds: [
                "damp"
            ],
            requiredBuildingId: "shallow_mine",
            resourceChanges: [
                { resource: "rubble", amount: -25 },
                { resource: "ironOre", amount: -8 }
            ],
            logText: "矿坑低处被浑水漫过，碎石和少量铁矿被冲进暗缝。"
        },
        {
            id: "spore_lantern_bloom",
            name: "孢灯暴绽",
            conditionId: "current_weather",
            baseChancePerCheck: 0.016,
            logLevel: "important",
            cooldownSeconds: 280,
            riskMode: "neutral",
            weatherIds: [
                "spore_rain"
            ],
            resourceChanges: [
                { resource: "fungus", amount: 70 },
                { resource: "crudeKnowledge", amount: 5 }
            ],
            logText: "一片发光孢灯在沟边暴绽，采菌工抢收了菌肉，也记下了孢粉纹路。"
        },
        {
            id: "spore_sneeze_panic",
            name: "孢粉喷嚏",
            conditionId: "current_weather",
            baseChancePerCheck: 0.012,
            logLevel: "warning",
            cooldownSeconds: 300,
            riskMode: "accident",
            weatherIds: [
                "spore_rain"
            ],
            resourceChanges: [
                { resource: "obedience", amount: -6 },
                { resource: "rubble", amount: -12 }
            ],
            logText: "孢粉钻进鼻孔，矿道里一阵乱喷嚏，队列和碎石堆都被搅乱。"
        },
        {
            id: "cave_wind_dry_timber",
            name: "风干柴堆",
            conditionId: "current_weather",
            baseChancePerCheck: 0.016,
            logLevel: "normal",
            cooldownSeconds: 260,
            riskMode: "neutral",
            weatherIds: [
                "cave_wind"
            ],
            requiredBuildingId: "charcoal_kiln",
            resourceChanges: [
                { resource: "rottenWood", amount: 35 },
                { resource: "coalSlag", amount: 6 }
            ],
            logText: "穿洞风把晾木架吹得干响，几堆朽木刚好能进窑压成煤渣。"
        },
        {
            id: "cave_wind_echo_warning",
            name: "岩层回声",
            conditionId: "current_weather",
            baseChancePerCheck: 0.014,
            logLevel: "normal",
            cooldownSeconds: 300,
            riskMode: "neutral",
            weatherIds: [
                "cave_wind"
            ],
            requiredBuildingId: "shallow_mine",
            resourceChanges: [
                { resource: "rubble", amount: 20 },
                { resource: "crudeKnowledge", amount: 6 }
            ],
            logText: "矿工听见风声穿过空腔，提前敲开一段松动岩层并记下裂响规律。"
        },
        {
            id: "acid_fog_corrosion",
            name: "酸雾腐蚀",
            conditionId: "current_weather",
            baseChancePerCheck: 0.012,
            logLevel: "warning",
            cooldownSeconds: 340,
            riskMode: "accident",
            weatherIds: [
                "acid_fog"
            ],
            requiredBuildingId: "crude_furnace",
            resourceChanges: [
                { resource: "rottenWood", amount: -20 },
                { resource: "ironOre", amount: -8 },
                { resource: "ironPlate", amount: -3 }
            ],
            logText: "酸雾钻进炉棚，朽木发黑，铁矿和铁片表面都被咬出麻点。"
        },
        {
            id: "acid_fog_etched_wall",
            name: "蚀痕壁画",
            conditionId: "current_weather",
            baseChancePerCheck: 0.012,
            logLevel: "normal",
            cooldownSeconds: 300,
            riskMode: "neutral",
            weatherIds: [
                "acid_fog"
            ],
            requiredBuildingId: "graffiti_wall",
            resourceChanges: [
                { resource: "crudeKnowledge", amount: 12 },
                { resource: "rubble", amount: 10 }
            ],
            logText: "雾气在洞壁咬出清晰纹路，涂鸦学徒刮下碎屑并抄走一串粗陋图形。"
        },
        {
            id: "lust_wind_sweet_haze",
            name: "甜腥雾障",
            conditionId: "current_weather",
            baseChancePerCheck: 0.014,
            logLevel: "warning",
            cooldownSeconds: 320,
            riskMode: "accident",
            weatherIds: [
                "lust_wind"
            ],
            requiredBuildingId: "brainwash_shed",
            resourceChanges: [
                { resource: "obedience", amount: -8 },
                { resource: "crudeKnowledge", amount: 10 }
            ],
            logText: "甜腥怪风让棚里的叫喊变得混乱，监工压住骚动后记下几条驯化偏方。"
        }
    ];

    // CaptiveTypeDefinition[] 俘虏类型定义列表：版本三掠夺入口支持十类女性俘虏。
    var CAPTIVE_TYPE_DEFINITIONS = [
        {
            id: "laborer",
            name: "村姑",
            traitHint: "basic",
            attributeBias: {
                strength: 1,
                will: 1
            },
            skillBias: {
                hauling: 30
            }
        },
        {
            id: "accountant",
            name: "商队女账房",
            traitHint: "trade",
            attributeBias: {
                cunning: 1,
                perception: 1
            },
            skillBias: {
                scribing: 40
            }
        },
        {
            id: "artisan",
            name: "工坊女匠",
            traitHint: "craft",
            attributeBias: {
                dexterity: 1,
                perception: 1
            },
            skillBias: {
                crafting: 40
            }
        },
        {
            id: "noble",
            name: "贵族小姐",
            traitHint: "obedient",
            attributeBias: {
                cunning: 1,
                will: 2
            },
            skillBias: {
                scribing: 60,
                overseeing: 25
            }
        },
        {
            id: "warrior",
            name: "村卫女兵",
            traitHint: "strong",
            attributeBias: {
                strength: 2,
                dexterity: 1
            },
            skillBias: {
                raiding: 70
            }
        },
        {
            id: "magic_talent",
            name: "魔法学徒",
            traitHint: "magic",
            attributeBias: {
                attunement: 2,
                will: 1
            },
            skillBias: {
                ritual: 60,
                crafting: 25
            }
        },
        {
            id: "undead_captive",
            name: "亡灵修女",
            traitHint: "corrupted",
            attributeBias: {
                attunement: 2,
                will: -1
            },
            skillBias: {
                ritual: 45,
                mining: 20
            }
        },
        {
            id: "ascetic",
            name: "苦修者",
            traitHint: "obedient",
            attributeBias: {
                will: 2,
                perception: 1
            },
            skillBias: {
                ritual: 45,
                hauling: 20
            }
        },
        {
            id: "herbalist",
            name: "采药女",
            traitHint: "basic",
            attributeBias: {
                perception: 2,
                dexterity: 1
            },
            skillBias: {
                foraging: 55,
                crafting: 15
            }
        },
        {
            id: "shrine_acolyte",
            name: "神龛侍祭",
            traitHint: "magic",
            attributeBias: {
                attunement: 1,
                will: 2
            },
            skillBias: {
                ritual: 55,
                scribing: 20
            }
        }
    ];

    // CaptiveQualityDefinition[] 俘虏质量定义列表：影响收益和风险。
    var CAPTIVE_QUALITY_DEFINITIONS = [
        {
            id: "common",
            name: "普通",
            multiplier: 1,
            escapeRisk: 0.12,
            retaliationRisk: 0.05
        },
        {
            id: "skilled",
            name: "熟练",
            multiplier: 1.5,
            escapeRisk: 0.16,
            retaliationRisk: 0.08
        },
        {
            id: "elite",
            name: "精英",
            multiplier: 2.25,
            escapeRisk: 0.22,
            retaliationRisk: 0.12
        },
        {
            id: "legendary",
            name: "传奇",
            multiplier: 3.5,
            escapeRisk: 0.3,
            retaliationRisk: 0.18
        }
    ];

    // DiplomacyWorldDefinition[] 外交世界定义列表：地点和势力先按三层世界分组。
    var DIPLOMACY_WORLD_DEFINITIONS = [
        {
            id: "underground",
            name: "地底",
            description: "地穴、矿盟和黑市构成的地下贸易与冲突网络。"
        },
        {
            id: "surface",
            name: "地表",
            description: "沼部、边境城邦和地表道路，提供高风险财富与军工资源。"
        },
        {
            id: "abyss",
            name: "深渊",
            description: "亡灵、遗迹和深渊使者相关的危险地点。"
        }
    ];

    // FactionTradeDefinition[] 外交对象定义列表：版本三基础贸易入口。
    var FACTION_DEFINITIONS = [
        {
            id: "rat_caravan",
            name: game.text.TEXT_REGISTRY.factions.rat_caravan.name,
            description: game.text.TEXT_REGISTRY.factions.rat_caravan.description,
            worldId: "underground",
            cost: [
                game.pricing.createPrice("fungus", 50)
            ],
            rewardResource: "coin",
            baseReward: 5,
            randomWidth: 0.25,
            relationChange: 2,
            goodwillReward: 2,
            requiredGoodwill: 0,
            distanceSeconds: 20,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "gray_dwarf_mine_league",
            name: game.text.TEXT_REGISTRY.factions.gray_dwarf_mine_league.name,
            description: game.text.TEXT_REGISTRY.factions.gray_dwarf_mine_league.description,
            worldId: "underground",
            cost: [
                game.pricing.createPrice("ironOre", 20)
            ],
            rewardResource: "coin",
            baseReward: 8,
            randomWidth: 0.2,
            relationChange: 2,
            goodwillReward: 2,
            requiredGoodwill: 0,
            distanceSeconds: 30,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "lizard_swamp_clan",
            name: game.text.TEXT_REGISTRY.factions.lizard_swamp_clan.name,
            description: game.text.TEXT_REGISTRY.factions.lizard_swamp_clan.description,
            worldId: "surface",
            cost: [
                game.pricing.createPrice("leather", 5)
            ],
            rewardResource: "coin",
            baseReward: 6,
            randomWidth: 0.35,
            relationChange: 2,
            goodwillReward: 2,
            requiredGoodwill: 0,
            distanceSeconds: 45,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "goblin_black_market",
            name: game.text.TEXT_REGISTRY.factions.goblin_black_market.name,
            description: game.text.TEXT_REGISTRY.factions.goblin_black_market.description,
            worldId: "underground",
            cost: [
                game.pricing.createPrice("loot", 5)
            ],
            rewardResource: "coin",
            baseReward: 12,
            randomWidth: 0.45,
            relationChange: 1,
            goodwillReward: 1,
            requiredGoodwill: 5,
            distanceSeconds: 35,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "undead_lord",
            name: game.text.TEXT_REGISTRY.factions.undead_lord.name,
            description: game.text.TEXT_REGISTRY.factions.undead_lord.description,
            worldId: "abyss",
            cost: [
                game.pricing.createPrice("loot", 30),
                game.pricing.createPrice("manaCrystal", 5)
            ],
            rewardResource: "ancestralEcho",
            baseReward: 35,
            randomWidth: 0.35,
            relationChange: 1,
            goodwillReward: 2,
            requiredGoodwill: 20,
            distanceSeconds: 75,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "abyss_emissary",
            name: game.text.TEXT_REGISTRY.factions.abyss_emissary.name,
            description: game.text.TEXT_REGISTRY.factions.abyss_emissary.description,
            worldId: "abyss",
            cost: [
                game.pricing.createPrice("blackIron", 20),
                game.pricing.createPrice("manaCrystal", 10)
            ],
            rewardResource: "abyssEcho",
            baseReward: 45,
            randomWidth: 0.4,
            relationChange: 1,
            goodwillReward: 2,
            requiredGoodwill: 35,
            distanceSeconds: 90,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "deep_gray_dwarf_court",
            name: game.text.TEXT_REGISTRY.factions.deep_gray_dwarf_court.name,
            description: game.text.TEXT_REGISTRY.factions.deep_gray_dwarf_court.description,
            worldId: "underground",
            cost: [
                game.pricing.createPrice("coin", 40),
                game.pricing.createPrice("ledger", 10)
            ],
            rewardResource: "blackIron",
            baseReward: 8,
            randomWidth: 0.2,
            relationChange: 1,
            goodwillReward: 2,
            requiredGoodwill: 25,
            distanceSeconds: 60,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "surface_border_city",
            name: game.text.TEXT_REGISTRY.factions.surface_border_city.name,
            description: game.text.TEXT_REGISTRY.factions.surface_border_city.description,
            worldId: "surface",
            cost: [
                game.pricing.createPrice("coin", 60),
                game.pricing.createPrice("loot", 20)
            ],
            rewardResource: "runePlate",
            baseReward: 4,
            randomWidth: 0.45,
            relationChange: 1,
            goodwillReward: 3,
            requiredGoodwill: 40,
            distanceSeconds: 70,
            unlock: {
                isDefault: true
            }
        }
    ];

    // RaidTargetDefinition[] 掠夺目标定义列表：版本三基础军事目标。
    var RAID_TARGET_DEFINITIONS = [
        {
            id: "fungus_farm_cave",
            name: game.text.TEXT_REGISTRY.raidTargets.fungus_farm_cave.name,
            description: game.text.TEXT_REGISTRY.raidTargets.fungus_farm_cave.description,
            factionId: "rat_caravan",
            worldId: "underground",
            minRaiders: 1,
            targetStrength: 15,
            rewards: {
                fungus: 120,
                loot: 3
            },
            captiveTypes: [
                "laborer",
                "herbalist"
            ],
            relationPenalty: 8,
            infamyReward: 3,
            infamyFailurePenalty: 1,
            goodwillPenalty: 1,
            requiredInfamy: 0,
            distanceSeconds: 25,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "caravan_camp",
            name: game.text.TEXT_REGISTRY.raidTargets.caravan_camp.name,
            description: game.text.TEXT_REGISTRY.raidTargets.caravan_camp.description,
            factionId: "goblin_black_market",
            worldId: "underground",
            minRaiders: 2,
            targetStrength: 30,
            rewards: {
                coin: 20,
                loot: 8
            },
            captiveTypes: [
                "accountant",
                "artisan"
            ],
            relationPenalty: 12,
            infamyReward: 5,
            infamyFailurePenalty: 2,
            goodwillPenalty: 2,
            requiredInfamy: 0,
            distanceSeconds: 35,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "mine_league_outpost",
            name: game.text.TEXT_REGISTRY.raidTargets.mine_league_outpost.name,
            description: game.text.TEXT_REGISTRY.raidTargets.mine_league_outpost.description,
            factionId: "gray_dwarf_mine_league",
            worldId: "underground",
            minRaiders: 3,
            targetStrength: 45,
            rewards: {
                ironOre: 80,
                coalSlag: 40,
                loot: 12
            },
            captiveTypes: [
                "artisan",
                "ascetic"
            ],
            relationPenalty: 15,
            infamyReward: 7,
            infamyFailurePenalty: 3,
            goodwillPenalty: 2,
            requiredInfamy: 8,
            distanceSeconds: 45,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "surface_village",
            name: game.text.TEXT_REGISTRY.raidTargets.surface_village.name,
            description: game.text.TEXT_REGISTRY.raidTargets.surface_village.description,
            factionId: "lizard_swamp_clan",
            worldId: "surface",
            minRaiders: 4,
            targetStrength: 55,
            rewards: {
                fungus: 200,
                leather: 20,
                loot: 18
            },
            captiveTypes: [
                "laborer",
                "artisan",
                "herbalist",
                "ascetic"
            ],
            relationPenalty: 20,
            infamyReward: 9,
            infamyFailurePenalty: 4,
            goodwillPenalty: 3,
            requiredInfamy: 15,
            distanceSeconds: 60,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "noble_carriage",
            name: game.text.TEXT_REGISTRY.raidTargets.noble_carriage.name,
            description: game.text.TEXT_REGISTRY.raidTargets.noble_carriage.description,
            factionId: "surface_border_city",
            worldId: "surface",
            minRaiders: 6,
            targetStrength: 90,
            rewards: {
                coin: 80,
                ledger: 20,
                loot: 35
            },
            captiveTypes: [
                "noble",
                "accountant",
                "shrine_acolyte"
            ],
            relationPenalty: 30,
            infamyReward: 12,
            infamyFailurePenalty: 5,
            goodwillPenalty: 5,
            requiredInfamy: 30,
            distanceSeconds: 75,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "surface_barracks",
            name: game.text.TEXT_REGISTRY.raidTargets.surface_barracks.name,
            description: game.text.TEXT_REGISTRY.raidTargets.surface_barracks.description,
            factionId: "surface_border_city",
            worldId: "surface",
            minRaiders: 8,
            targetStrength: 130,
            rewards: {
                steelIngot: 25,
                warBanner: 2,
                loot: 45
            },
            captiveTypes: [
                "warrior",
                "noble",
                "ascetic"
            ],
            relationPenalty: 40,
            infamyReward: 15,
            infamyFailurePenalty: 7,
            goodwillPenalty: 7,
            requiredInfamy: 45,
            distanceSeconds: 90,
            unlock: {
                isDefault: true
            }
        },
        {
            id: "ancient_ruin",
            name: game.text.TEXT_REGISTRY.raidTargets.ancient_ruin.name,
            description: game.text.TEXT_REGISTRY.raidTargets.ancient_ruin.description,
            factionId: "undead_lord",
            worldId: "abyss",
            minRaiders: 7,
            targetStrength: 150,
            rewards: {
                manaCrystal: 30,
                runePlate: 8,
                loot: 50
            },
            captiveTypes: [
                "magic_talent",
                "artisan",
                "undead_captive",
                "shrine_acolyte"
            ],
            relationPenalty: 45,
            infamyReward: 18,
            infamyFailurePenalty: 8,
            goodwillPenalty: 8,
            requiredInfamy: 55,
            distanceSeconds: 100,
            unlock: {
                isDefault: true
            }
        }
    ];

    // GoblinNamePool 哥布林姓名池：独立于存档，生成后姓名写入 Goblin 对象。
    var GOBLIN_NAME_POOL = {
        givenNames: [
            "咕噜",
            "疤牙",
            "泥爪",
            "碎耳",
            "黑鼻",
            "尖叫",
            "烂靴",
            "短棍",
            "骨哨",
            "煤团",
            "蛆灯",
            "锅底",
            "歪帽",
            "裂桶",
            "沼铃",
            "烟坨",
            "钉子",
            "菌渣",
            "黑浆",
            "桶咚",
            "铁沫",
            "酸泡",
            "吱吱",
            "烂账",
            "碎瓶",
            "矿渣",
            "咚锤",
            "泥哨",
            "灰蛙",
            "偷火",
            "劣酒",
            "铜铃",
            "臭袜",
            "磨锅",
            "短叉",
            "瘸灯",
            "盐疙",
            "锈桶",
            "黑糖",
            "灰帽",
            "咬币",
            "破锣",
            "菌泡",
            "铁钩",
            "泥账",
            "酸罐",
            "火星",
            "洞虱",
            "苔皮",
            "煤饼",
            "碎轮",
            "歪杖",
            "沼疙",
            "叮当",
            "烂绳",
            "黑罐",
            "磨刀",
            "灰瓶",
            "偷盐",
            "骨骰",
            "泥鼓",
            "锈锁",
            "菌粉",
            "短弩",
            "火痰",
            "酸酒",
            "煤坨",
            "破伞",
            "咕哒",
            "吱嘎",
            "烂图",
            "黑砧",
            "铁签",
            "臭油",
            "灰烬",
            "泥铲",
            "碎钟",
            "偷针",
            "骨锅",
            "酸苔",
            "锈币",
            "短靴",
            "煤烟",
            "裂鼓",
            "菌灯",
            "歪勺",
            "黑盐",
            "烂旗",
            "铁渣",
            "泥球",
            "火罐",
            "灰绳",
            "偷锤",
            "骨粉",
            "沼泡",
            "锈钉",
            "短斧",
            "煤炉",
            "咕噜巴",
            "吱哇",
            "烂木槌",
            "黑蘑",
            "铁皮锅",
            "泥哒",
            "酸骨汤",
            "碎石花",
            "偷月",
            "锅灰"
        ],
        nicknames: [
            "偷菌者",
            "啃石头",
            "坏点子",
            "湿袜子",
            "小尖牙",
            "乱涂者"
        ],
        clanNames: [
            "泥棚",
            "碎石",
            "孢子",
            "黑洞",
            "烂木",
            "滴水"
        ]
    };

    // Object 静态定义命名空间：只存放 game/ 内部运行时数据，不引用外部目录。
    game.definitions = {
        SAVE_VERSION: SAVE_VERSION,
        TICKS_PER_SECOND: TICKS_PER_SECOND,
        POPULATION_CONSTANTS: POPULATION_CONSTANTS,
        WEATHER_DEFINITIONS: WEATHER_DEFINITIONS,
        TAB_DEFINITIONS: TAB_DEFINITIONS,
        RESOURCE_DEFINITIONS: RESOURCE_DEFINITIONS,
        BUILDING_DEFINITIONS: BUILDING_DEFINITIONS,
        TECHNOLOGY_DEFINITIONS: TECHNOLOGY_DEFINITIONS,
        JOB_DEFINITIONS: JOB_DEFINITIONS,
        POLICY_DEFINITIONS: POLICY_DEFINITIONS,
        RITUAL_UPGRADE_DEFINITIONS: RITUAL_UPGRADE_DEFINITIONS,
        SACRIFICE_DEFINITIONS: SACRIFICE_DEFINITIONS,
        PACT_DEFINITIONS: PACT_DEFINITIONS,
        EXPEDITION_ROUTE_DEFINITIONS: EXPEDITION_ROUTE_DEFINITIONS,
        PRESTIGE_PERK_DEFINITIONS: PRESTIGE_PERK_DEFINITIONS,
        CHALLENGE_DEFINITIONS: CHALLENGE_DEFINITIONS,
        MANUAL_ACTION_DEFINITIONS: MANUAL_ACTION_DEFINITIONS,
        CRAFT_RECIPE_DEFINITIONS: CRAFT_RECIPE_DEFINITIONS,
        EVENT_DEFINITIONS: EVENT_DEFINITIONS,
        CAPTIVE_TYPE_DEFINITIONS: CAPTIVE_TYPE_DEFINITIONS,
        CAPTIVE_QUALITY_DEFINITIONS: CAPTIVE_QUALITY_DEFINITIONS,
        DIPLOMACY_WORLD_DEFINITIONS: DIPLOMACY_WORLD_DEFINITIONS,
        FACTION_DEFINITIONS: FACTION_DEFINITIONS,
        RAID_TARGET_DEFINITIONS: RAID_TARGET_DEFINITIONS,
        GOBLIN_NAME_POOL: GOBLIN_NAME_POOL
    };
})(window.GoblinEmpire);
