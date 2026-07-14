/* 公共数据契约：集中声明运行时、存档和静态定义的基础形状。 */
/**
 * 初始化公共契约命名空间。
 *
 * @param {Window} globalObject - 浏览器全局对象，用于挂载 GoblinEmpire 命名空间。
 * @returns {void} 无返回值。
 */
(function (globalObject) {
    /**
     * @typedef {string} ResourceId
     * 稳定资源 ID；必须为 ASCII，作为存档键和定义引用。
     */

    /**
     * @typedef {string} BuildingId
     * 稳定建筑 ID；必须为 ASCII，作为存档键和定义引用。
     */

    /**
     * @typedef {string} TechnologyId
     * 稳定科技 ID；必须为 ASCII，作为存档键和定义引用。
     */

    /**
     * @typedef {string} JobId
     * 稳定职业 ID；必须为 ASCII，作为哥布林 jobId 和定义引用。
     */

    /**
     * @typedef {Object} Price
     * @property {ResourceId} resource - 资源稳定 ID，必须对应 ResourceDefinition.id。
     * @property {number} amount - 价格数量，非负资源数量。
     */

    /**
     * @typedef {Object} WeightedId
     * @property {string} id - 被引用的稳定 ID。
     * @property {number} weight - 随机抽取权重，非负浮点数。
     */

    /**
     * @typedef {Object} ResourceWaitEntry
     * @property {ResourceId} resource - 资源稳定 ID，必须对应 ResourceDefinition.id。
     * @property {number} missingAmount - 当前缺口数量，非负资源数量。
     * @property {number} perSecond - 当前每秒积累速度，有符号浮点数。
     * @property {number} seconds - 补齐该资源所需秒数，非负浮点数；不可达时为 Infinity。
     * @property {boolean} isReachable - 是否能按当前速度和容量补齐；true 表示该资源可等待获得。
     */

    /**
     * @typedef {Object} PriceWaitInfo
     * @property {boolean} isAffordable - 当前是否已经可支付；true 表示无需等待。
     * @property {boolean} isAvailable - 缺口是否能按当前资源速度补齐；false 表示至少一项资源不可达。
     * @property {number} seconds - 整体可用倒计时秒数，非负浮点数；不可达时为 Infinity。
     * @property {ResourceWaitEntry[]} entries - 每项缺口资源的等待明细。
     */

    /**
     * @typedef {Object} ResourceFlowEntry
     * @property {ResourceId} resource - 流量影响的资源稳定 ID。
     * @property {"output"|"consumption"} kind - 流量类型；output 为持续产出，consumption 为持续消耗。
     * @property {number} amount - 每秒资源数量，非负浮点数。
     * @property {string} source - 来源中文名称，例如建筑、职业、人口口粮或自动制作配方。
     * @property {string} detail - 来源明细中文说明，用于资源悬浮框。
     */

    /**
     * @typedef {Object} ResourceBonusEntry
     * @property {string} label - 加成来源中文名称。
     * @property {string} value - 加成值显示文本，例如 +5% 或 x1.10。
     */

    /**
     * @typedef {Object} ResourceFlowSummary
     * @property {ResourceId} resourceId - 当前分析的资源稳定 ID。
     * @property {ResourceFlowEntry[]} outputEntries - 当前资源持续产出明细数组。
     * @property {ResourceFlowEntry[]} consumptionEntries - 当前资源持续消耗明细数组。
     * @property {ResourceBonusEntry[]} bonusEntries - 当前资源持续流量加成明细数组。
     * @property {string[]} buffTexts - 当前资源相关 buff 和状态提示文本数组。
     * @property {number} totalOutputPerSecond - 总产出速度，单位资源/秒，非负浮点数。
     * @property {number} totalConsumptionPerSecond - 总消耗速度，单位资源/秒，非负浮点数。
     * @property {number} finalPerSecond - 最终产出速度，单位资源/秒，有符号浮点数。
     * @property {string} timeToFullText - 库存爆仓时间中文文本。
     */

    /**
     * @typedef {Object} LaborUsageEntry
     * @property {BuildingId} buildingId - 建筑稳定 ID，必须对应 BuildingDefinition.id。
     * @property {string} buildingName - 建筑中文显示名。
     * @property {number} activeCount - 当前启用建筑数量，非负整数。
     * @property {number} laborUsagePerBuilding - 单座启用建筑占用劳力数量，非负资源数量。
     * @property {number} rawUsage - 减免前劳力占用数量，非负资源数量。
     * @property {number} adjustedUsage - 应用总减免后的劳力占用数量，非负资源数量。
     */

    /**
     * @typedef {Object} LaborBreakdown
     * @property {number} aliveGoblinCount - 当前存活哥布林数量，非负整数。
     * @property {number} populationLabor - 存活哥布林派生劳力数量，非负资源数量。
     * @property {number} rawBuildingUsageTotal - 减免前建筑占用劳力总量，非负资源数量。
     * @property {number} reductionRatio - 建筑劳力占用减免比例，范围为 0-0.75。
     * @property {number} adjustedBuildingUsageTotal - 减免后建筑占用劳力总量，非负资源数量。
     * @property {boolean} isProductionLaborOverloaded - 是否生产建筑劳力占用超过人口供给；true 表示除菌菇床外建筑停产。
     * @property {LaborUsageEntry[]} buildingUsageEntries - 逐建筑占用明细数组。
     */

    /**
     * @typedef {Object} UnlockBundle
     * @property {string[]=} tabs - 要解锁的标签页 ID 数组。
     * @property {ResourceId[]=} resources - 要解锁的资源 ID 数组。
     * @property {BuildingId[]=} buildings - 要解锁的建筑 ID 数组。
     * @property {JobId[]=} jobs - 要解锁的职业 ID 数组。
     * @property {TechnologyId[]=} technologies - 要解锁的科技 ID 数组。
     * @property {string[]=} upgrades - 要解锁的工坊升级 ID 数组。
     * @property {string[]=} crafts - 要解锁的配方 ID 数组。
     * @property {string[]=} policies - 要解锁的政策 ID 数组。
     * @property {boolean=} isDefault - 是否默认解锁；true 表示新存档立即可见。
     */

    /**
     * @typedef {Object} StatisticUnlockRequirement
     * @property {string} id - 统计稳定 ID，必须对应 GameState.statistics 的 key。
     * @property {number} minValue - 解锁所需的最低统计值，非负累计数值。
     * @property {string} description - 中文条件说明，用于界面提示。
     */

    /**
     * @typedef {Object} BuildingUnlockRequirements
     * @property {StatisticUnlockRequirement[]=} statistics - 建筑显示前必须满足的统计门槛数组。
     */

    /**
     * @typedef {Object} ResourceDefinition
     * @property {ResourceId} id - 资源稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {"basic"|"crafted"|"rare"|"mystic"|"prestige"} category - 资源显示分组。
     * @property {number=} initialValue - 新存档初始库存，非负资源数量；省略时为 0。
     * @property {number} defaultMaxValue - 默认容量上限，非负资源数量。
     * @property {boolean} isVisibleAtStart - 新存档是否立即显示。
     * @property {boolean} isCapacityLimited - 是否受到容量上限限制。
     * @property {string} description - 中文说明，用于界面和后续提示。
     */

    /**
     * @typedef {Object} ResourceState
     * @property {ResourceId} id - 资源稳定 ID，必须对应 ResourceDefinition.id。
     * @property {number} value - 当前资源数量，非负浮点数。
     * @property {number} maxValue - 当前资源容量上限，非负浮点数。
     * @property {boolean} isVisible - 是否已经显示；true 表示初始可见或玩家见过。
     * @property {number} perSecond - 每秒变化量，有符号浮点数。
     * @property {number=} grossGainThisTick - 本次模拟尝试增加的资源总量，非负资源数量；临时字段，不进入存档。
     * @property {number=} actualGainThisTick - 本次模拟实际入库的资源总量，非负资源数量；临时字段，不进入存档。
     */

    /**
     * @typedef {Object.<string, ResourceState>} ResourceStateById
     * key: ResourceId 资源稳定 ID。
     * value: ResourceState 资源运行时状态。
     */

    /**
     * @typedef {Object} BuildingDefinition
     * @property {BuildingId} id - 建筑稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文功能描述。
     * @property {Price[]} basePrice - 基础价格数组；amount 为非负资源数量。
     * @property {number} priceRatio - 价格增长倍率，大于等于 1。
     * @property {Object.<string, number>} effects - 建筑效果字典；key 为效果 ID，value 为数值。
     * @property {number=} effects.laborUsage - 每个启用建筑占用的劳力数量，非负整数；菌菇床不使用该字段。
     * @property {number=} effects.laborUsageReductionRatio - 每个已拥有建筑降低生产建筑劳力占用的比例，范围通常为 0-1。
     * @property {number=} effects.weatherNegativeMitigationRatio - 每个已拥有建筑削弱资源产出负面天气的比例，范围通常为 0-1。
     * @property {number=} effects.weatherPositiveAmplificationRatio - 每个已拥有建筑放大资源产出正面天气的比例，范围通常为 0-1。
     * @property {UnlockBundle} unlock - 显示该建筑所需的解锁条件或默认解锁标记。
     * @property {BuildingUnlockRequirements=} unlockRequirements - 建筑显示前额外必须满足的运行时门槛。
     */

    /**
     * @typedef {Object} BuildingState
     * @property {BuildingId} id - 建筑稳定 ID，必须对应 BuildingDefinition.id。
     * @property {number} owned - 已拥有数量，非负整数。
     * @property {number} active - 当前启用数量，非负整数且不大于 owned。
     * @property {boolean} isUnlocked - 是否已解锁显示。
     */

    /**
     * @typedef {Object} TechnologyDefinition
     * @property {TechnologyId} id - 科技稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文功能描述。
     * @property {Price[]} price - 研究价格数组；amount 为非负资源数量。
     * @property {UnlockBundle} unlocks - 研究完成后立即应用的解锁包。
     * @property {UnlockBundle} unlock - 显示该科技所需的解锁条件或默认解锁标记。
     */

    /**
     * @typedef {Object} TechnologyState
     * @property {TechnologyId} id - 科技稳定 ID，必须对应 TechnologyDefinition.id。
     * @property {boolean} isUnlocked - 是否已解锁显示。
     * @property {boolean} isResearched - 是否已研究完成。
     */

    /**
     * @typedef {Object} JobDefinition
     * @property {JobId} id - 职业稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} skillId - 主要技能 ID，ASCII 字符串。
     * @property {Object.<string, number>} attributeWeights - 属性权重字典；key 为属性 ID，value 为权重。
     * @property {Object.<string, number>} baseOutput - 基础产出字典；key 为资源 ID，value 为每 tick 资源量。
     * @property {UnlockBundle} unlock - 显示该职业所需的解锁条件或默认解锁标记。
     */

    /**
     * @typedef {Object} Goblin
     * @property {string} id - 哥布林稳定 ID。
     * @property {string} name - 中文姓名。
     * @property {string=} nickname - 绰号或氏族名，可省略。
     * @property {string|null} faithId - 当前信仰 ID；null 表示祖灵祭坛建立前没有信仰。
     * @property {string|null} bloodlineId - 血脉 ID；null 表示没有神灵血脉，有值时必须对应 BloodlineDefinition.id。
     * @property {number} bloodlinePurity - 血脉纯度，范围 0-100 百分比；bloodlineId 为 null 时必须为 0。
     * @property {number} age - 年龄，非负浮点数，单位为年。
     * @property {number} baseLifespanYears - 出生基础寿命，单位为年。
     * @property {number} growthLifespanYears - 属性和技能成长提供的寿命，单位为年。
     * @property {number} technologyLifespanYears - 当前科技提供的寿命，单位为年。
     * @property {number} eventLifespanYears - 随机事件提供的寿命，单位为年。
     * @property {number} elderDeathCheckCount - 达到寿命后已通过的月初老死检查次数，非负整数。
     * @property {"natural"|"captive_bed"|"warbeast_bed"|"migrant"|"vassal"|"event"|"legacy"} origin - 来源 ID；natural 仅兼容旧存档，不再由当前规则生成。
     * @property {JobId=} jobId - 当前职业 ID；省略表示空闲。
     * @property {Object.<string, number>} attributes - 六项属性字典；key 为属性 ID，value 为 1-10 整数。
     * @property {string[]} traits - 特质 ID 数组。
     * @property {Object.<string, number>} skills - 技能经验字典；key 为技能 ID，value 为非负经验值。
     * @property {string[]} wounds - 伤病 ID 数组。
     * @property {boolean} isLeader - 是否为当前领袖。
     * @property {boolean} isPinned - 是否固定职业。
     * @property {boolean} isAlive - 是否存活。
     */

    /**
     * @typedef {Object} GoblinNamePool
     * @property {string[]} givenNames - 中文名池数组。
     * @property {string[]} nicknames - 中文绰号池数组。
     * @property {string[]} clanNames - 中文氏族名池数组。
     */

    /**
     * @typedef {Object} FactionDefinition
     * @property {string} id - 阵营稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {string} worldId - 所属世界 ID，必须对应 DiplomacyWorldDefinition.id。
     * @property {Price[]} cost - 单次贸易消耗数组。
     * @property {ResourceId} rewardResource - 单次贸易收益资源 ID。
     * @property {number} baseReward - 基础收益数量，非负资源数量。
     * @property {number} randomWidth - 收益波动比例，范围 0-1。
     * @property {number} relationChange - 成功贸易后的关系变化值。
     * @property {number} goodwillReward - 成功贸易后获得的善名数量，非负资源数量。
     * @property {number} requiredGoodwill - 执行贸易所需善名门槛，非负资源数量。
     * @property {UnlockBundle} unlock - 显示该阵营所需的解锁条件。
     */

    /**
     * @typedef {Object} DiplomacyWorldDefinition
     * @property {string} id - 世界层级稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
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
     * @property {WeightedId[]} captiveRaceWeights - 可能获得的俘虏种族权重数组；id 为 CaptiveRaceDefinition.id。
     * @property {number} warbeastCaptureChance - 掠夺成功后捕获战兽的概率，范围为 0-1。
     * @property {WeightedId[]} warbeastSpeciesWeights - 可能捕获的战兽物种权重数组；id 为 WarbeastSpeciesDefinition.id。
     * @property {number} relationPenalty - 掠夺后关系下降基础值，非负整数。
     * @property {number} infamyReward - 掠夺成功后获得的恶名数量，非负资源数量。
     * @property {number} infamyFailurePenalty - 掠夺失败后损失的恶名数量，非负资源数量。
     * @property {number} goodwillPenalty - 掠夺成功后损失的善名数量，非负资源数量。
     * @property {number} requiredInfamy - 发起掠夺所需恶名门槛，非负资源数量。
     * @property {UnlockBundle} unlock - 显示该目标所需的解锁条件。
     */

    /**
     * @typedef {Object} CaptiveState
     * @property {string} id - 俘虏稳定 ID。
     * @property {string} name - 俘虏中文姓名；生成后写入存档，确保每个俘虏可被单独识别。
     * @property {string} type - 俘虏类型 ID，必须对应 CaptiveTypeDefinition.id。
     * @property {string} raceId - 俘虏种族 ID，必须对应 CaptiveRaceDefinition.id，且不是哥布林。
     * @property {string|null} originalRaceId - 原始所属种族 ID；菌菇寄生体必须保留宿主受寄生前的种族，非寄生体为 null。
     * @property {string|null} faithId - 俘虏信仰 ID；菌菇寄生体固定为 mother_fungus，其他种族可为 null 或 FaithDefinition.id。
     * @property {string|null} bloodlineId - 血脉 ID；菌菇寄生体固定为 null，其他有值时必须对应 BloodlineDefinition.id。
     * @property {number} bloodlinePurity - 血脉纯度，范围 0-100 百分比；bloodlineId 为 null 时必须为 0。
     * @property {"common"|"skilled"|"elite"|"legendary"} quality - 俘虏质量 ID。
     * @property {string} source - 来源 ID 或事件名。
     * @property {"basic"|"strong"|"magic"|"craft"|"trade"|"obedient"|"corrupted"} traitHint - 繁衍或改造倾向 ID。
     * @property {string[]} traits - 俘虏额外特质 ID 数组；当前允许 tentacle_broodbed。
     * @property {number} age - 年龄，非负浮点数，单位为年。
     * @property {number} baseLifespanYears - 基础寿命，单位为年；新俘虏按质量随机后叠加种族寿命修正。
     * @property {number} technologyLifespanYears - 当前科技提供的寿命，单位为年。
     * @property {number} eventLifespanYears - 随机事件提供的寿命，单位为年。
     * @property {number} elderDeathCheckCount - 达到寿命后已通过的月初老死检查次数，非负整数。
     * @property {number} turnsHeld - 持有回合数，非负整数。
     * @property {"bed"|"modify"|"food"|"beast"=} disposition - 当前处置 ID，可省略。
     * @property {number} brainwashLevel - 洗脑程度，0-100 整数点；数值越高，新生属性越好且孕育失败率越低。
     * @property {boolean} isAutoBrainwashEnabled - 是否对该俘虏启用自动洗脑；true 表示食物充足且洗脑未满时自动消耗菌菇执行洗脑。
     * @property {boolean} isAutoBreedEnabled - 是否对该俘虏启用自动培育；true 表示公用苗床会在洗脑满值、空闲、食物和住房充足时自动开始培育。
     * @property {"idle"|"gestating"|"resting"} breedingState - 苗床繁育状态；idle 可培育，gestating 孕育中且锁定处置，resting 休养中且只锁定培育。
     * @property {string=} gestationWeatherId - 开始本次孕育时的天气 ID；只在 gestating 状态下用于锁定孕育修正。
     * @property {number} gestationSecondsRemaining - 孕育剩余游戏秒数，非负浮点数。
     * @property {number} restSecondsRemaining - 休养剩余游戏秒数，非负浮点数。
     */

    /**
     * @typedef {Object} WarbeastSpeciesDefinition
     * @property {string} id - 战兽物种稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} race - 战兽种族中文名，例如地底兽、菌兽或深渊兽。
     * @property {string} type - 战兽类型 ID，用于分类展示和后续规则扩展。
     * @property {string} trait - 战兽特质中文名，用于卡片和后代倾向说明。
     * @property {string} description - 中文说明。
     * @property {"basic"|"strong"|"magic"|"craft"|"trade"|"obedient"|"corrupted"} offspringTraitHint - 苗床后代倾向 ID。
     * @property {Object.<string, number>} attributeBonus - 后代属性偏置字典；key 为哥布林属性 ID，value 为整数加成。
     * @property {number} foodConsumptionRatio - 基础口粮倍率，非负浮点数；休养时会再翻倍。
     * @property {number} captureDifficulty - 捕获难度倍率，正浮点数；用于日志和后续平衡。
     * @property {number} raidStrength - 已驯化战兽随队掠夺时提供的独立战斗强度，非负浮点数。
     */

    /**
     * @typedef {Object} WarbeastState
     * @property {string} id - 战兽稳定 ID。
     * @property {string} speciesId - 战兽物种 ID，必须对应 WarbeastSpeciesDefinition.id。
     * @property {string} name - 中文个体名，生成后写入存档。
     * @property {string} source - 来源掠夺目标 ID 或事件 ID。
     * @property {boolean} isTamed - 是否已驯化；true 表示可作为苗床培育哥布林。
     * @property {"idle"|"gestating"|"resting"} breedingState - 战兽苗床状态；idle 可行动，gestating 孕育中，resting 休养中且口粮翻倍。
     * @property {number} tamingProgress - 驯化进度，范围 0-100。
     * @property {number} gestationSecondsRemaining - 孕育剩余游戏秒数，非负浮点数。
     * @property {number} restSecondsRemaining - 休养剩余游戏秒数，非负浮点数。
     * @property {string=} originalCaptiveId - 转化战兽来源俘虏 ID；普通捕获战兽省略。
     * @property {string=} originalCaptiveType - 转化战兽来源俘虏职业类型 ID；普通捕获战兽省略。
     * @property {string=} originalCaptiveRaceId - 转化战兽来源俘虏种族 ID；普通捕获战兽省略。
     * @property {boolean=} isConvertedCaptive - 是否由俘虏转化而来；true 表示种族显示原种族加“(兽)”。
     */

    /**
     * @typedef {Object} PolicyDefinition
     * @property {string} id - 政策稳定 ID。
     * @property {string} groupId - 政策组稳定 ID，同组政策互斥。
     * @property {string} groupName - 政策组中文显示名。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {string} effectSummary - 收益中文说明。
     * @property {string} costSummary - 代价中文说明。
     * @property {Object.<string, number>} effects - 政策效果字典；key 为效果 ID，value 为加成比例或数值。
     * @property {UnlockBundle} unlock - 显示该政策所需的解锁条件。
     */

    /**
     * @typedef {Object} PrestigePerkDefinition
     * @property {string} id - 威望天赋稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {Price[]} price - 威望价格数组。
     * @property {UnlockBundle} unlock - 显示该天赋所需的解锁条件。
     */

    /**
     * @typedef {Object} PactDefinition
     * @property {string} id - 深渊契约稳定 ID。
     * @property {string} name - 中文显示名。
     * @property {string} description - 中文说明。
     * @property {string} effectSummary - 收益中文说明。
     * @property {string} costSummary - 代价中文说明。
     * @property {Object.<string, number>} effects - 契约效果字典；key 为效果 ID，value 为加成比例或每秒数值。
     */

    /**
     * @typedef {Object} ExpeditionState
     * @property {string} id - 远征运行 ID。
     * @property {string} routeId - 远征路线 ID。
     * @property {string[]} memberIds - 成员哥布林 ID 数组。
     * @property {number} remainingSeconds - 剩余时间，非负秒数。
     * @property {boolean} isResolved - 是否已结算；true 表示不会再次结算。
     */

    /**
     * @typedef {Object} DiplomacyMissionState
     * @property {string} id - 外交行动运行 ID。
     * @property {"trade"|"raid"} modeId - 行动类型；trade 表示贸易，raid 表示掠夺。
     * @property {string} locationId - 贸易阵营 ID 或掠夺目标 ID。
     * @property {string} factionId - 关联势力 ID。
     * @property {string[]} raiderIds - 出战哥布林 ID 数组；贸易行动为空数组。
     * @property {string|null} warbeastId - 随队战兽 ID；未派战兽或贸易行动为 null。
     * @property {number} remainingSeconds - 剩余返程时间，非负秒数。
     * @property {number} totalSeconds - 起始往返时间，非负秒数。
     * @property {Object.<string, number>} resultSnapshot - 发起时冻结的结算数值；key 为收益、风险、战兽强度或声名字段 ID。
     */

    /**
     * @typedef {Object} CalendarState
     * @property {number} elapsedDays - 已经过的完整游戏日，非负整数天。
     * @property {number} dayProgressSeconds - 当前游戏日已推进秒数，非负浮点秒。
     * @property {boolean} isCalendarUnlocked - 是否已经研究历法；true 表示日志使用哥布林历纪年。
     * @property {number|null} calendarEpochDay - 历法解锁时的完整游戏日；未解锁时为 null。
     */

    /**
     * @typedef {Object} WeatherState
     * @property {string} currentWeatherId - 当前天气稳定 ID，必须对应 WeatherDefinition.id。
     * @property {number} startedElapsedDay - 当前天气开始时的完整游戏日，非负整数天。
     * @property {number} nextChangeElapsedDay - 下次天气变化的完整游戏日，正整数天。
     * @property {number} randomSeed - 当前存档的天气随机种子，正整数；用于让不同新局拥有不同天气序列。
     */

    /**
     * @typedef {Object} GameState
     * @property {number} version - 存档版本整数。
     * @property {boolean} isPaused - 是否暂停；true 表示模拟不推进。
     * @property {number} lastActiveTimestamp - 最后一次允许模拟推进的 Unix 毫秒时间戳。
     * @property {ResourceStateById} resourcesById - 资源运行时状态字典。
     * @property {Object.<string, BuildingState>} buildingsById - 建筑运行时状态字典。
     * @property {Object.<string, TechnologyState>} technologiesById - 科技运行时状态字典。
     * @property {Object.<string, boolean>} jobsUnlockedById - 职业解锁字典；key 为 JobId，value 表示是否解锁。
     * @property {Object.<string, boolean>} tabsUnlockedById - 标签页解锁字典；key 为标签页 ID，value 表示是否显示。
     * @property {Object.<string, boolean>} upgradesUnlockedById - 工坊升级解锁字典；key 为升级 ID，value 表示是否解锁。
     * @property {Object.<string, boolean>} craftsUnlockedById - 配方解锁字典；key 为配方 ID，value 表示是否解锁。
     * @property {Object.<string, boolean>} policiesUnlockedById - 政策解锁字典；key 为政策 ID，value 表示是否解锁。
     * @property {Goblin[]} goblins - 哥布林对象数组；人口权威来源。
     * @property {string=} leaderGoblinId - 当前领袖哥布林 ID，可省略。
     * @property {Object.<string, string>} policies - 政策选择字典；key 为政策组 ID，value 为政策 ID。
     * @property {Object.<string, boolean>} pacts - 深渊契约选择字典；key 为契约 ID，value 表示是否启用。
     * @property {ExpeditionState|null} activeExpedition - 当前远征状态；没有远征时为 null。
     * @property {DiplomacyMissionState[]} activeDiplomacyMissions - 在途外交/掠夺行动数组；返程完成后结算并移除。
     * @property {{runMode: "undecided"|"normal"|"challenge", activeChallengeId: string|null, completedById: Object.<string, boolean>}} challenges - 挑战状态；runMode 为本局模式选择，activeChallengeId 为当前挑战 ID，completedById 为永久完成标记。
     * @property {CalendarState} calendar - 日期运行时状态；保存季节日序、历法解锁状态和纪元日。
     * @property {WeatherState} weather - 天气运行时状态；保存当前天气和下次变化日。
     * @property {CaptiveState[]} captives - 俘虏运行时状态数组。
     * @property {WarbeastState[]} warbeasts - 战兽运行时状态数组。
     * @property {{legacy: number, perks: string[]}} prestige - 威望状态；legacy 为非负数量，perks 为已购天赋 ID。
     * @property {Object.<string, number>} statistics - 统计字典；key 为统计 ID，value 为累计数值。
     * @property {string} activeTabId - 当前标签页 ID。
     * @property {{id: string, level: "normal"|"important"|"warning", text: string, timestamp: number}[]} logs - 日志数组。
     */

    /**
     * @typedef {Object} SaveData
     * @property {number} version - 存档版本整数。
     * @property {number} timestamp - 保存时 Unix 毫秒时间戳。
     * @property {boolean} isPaused - 是否暂停。
     * @property {number} lastActiveTimestamp - 最后一次允许模拟推进的 Unix 毫秒时间戳。
     * @property {{id: string, value: number, isVisible: boolean}[]} resources - 资源存档数组，不含静态定义副本。
     * @property {{id: string, owned: number, active: number, isUnlocked: boolean}[]} buildings - 建筑存档数组，不含静态定义副本。
     * @property {{id: string, isResearched: boolean, isUnlocked: boolean}[]} technologies - 科技存档数组。
     * @property {{id: string, isUnlocked: boolean}[]} jobs - 职业解锁存档数组。
     * @property {Object.<string, boolean>} tabsUnlockedById - 标签页解锁存档字典；key 为标签页 ID。
     * @property {Object.<string, boolean>} upgradesUnlockedById - 工坊升级解锁存档字典；key 为升级 ID。
     * @property {Object.<string, boolean>} craftsUnlockedById - 配方解锁存档字典；key 为配方 ID。
     * @property {Object.<string, boolean>} policiesUnlockedById - 政策解锁存档字典；key 为政策 ID。
     * @property {Goblin[]} goblins - 哥布林对象存档数组。
     * @property {string=} leaderGoblinId - 当前领袖哥布林 ID，可省略。
     * @property {Object.<string, string>} policies - 政策选择字典。
     * @property {Object.<string, boolean>} pacts - 深渊契约选择字典。
     * @property {ExpeditionState|null} activeExpedition - 当前远征存档状态；没有时为 null。
     * @property {DiplomacyMissionState[]} activeDiplomacyMissions - 在途外交/掠夺行动存档数组。
     * @property {{runMode: "undecided"|"normal"|"challenge", activeChallengeId: string|null, completedById: Object.<string, boolean>}} challenges - 挑战存档状态；runMode 为新局入口选择结果。
     * @property {CalendarState} calendar - 日期存档状态；保存季节日序、历法解锁状态和纪元日。
     * @property {WeatherState} weather - 天气存档状态；保存当前天气和下次变化日。
     * @property {CaptiveState[]} captives - 俘虏存档数组。
     * @property {WarbeastState[]} warbeasts - 战兽存档数组。
     * @property {{legacy: number, perks: string[]}} prestige - 威望存档状态。
     * @property {Object.<string, number>} statistics - 统计存档字典。
     */

    // Object 全局命名空间：承载所有哥布林帝国浏览器脚本模块。
    globalObject.GoblinEmpire = globalObject.GoblinEmpire || {};
})(window);
