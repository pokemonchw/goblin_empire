/* 中文文本表：集中管理玩家可见的按钮、状态、日志和静态定义文案。 */
/**
 * 初始化中文文本表模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 text 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * @typedef {Object} TextRegistry
     * @property {Object.<string, string>} buttons - 按钮文案字典；key 为语义 ID，value 为中文文案。
     * @property {Object.<string, string>} status - 状态文案字典；key 为状态 ID，value 为中文文案。
     * @property {Object.<string, string>} categories - 资源分组文案字典；key 为资源分组 ID，value 为中文文案。
     * @property {Object.<string, string>} logs - 日志文案字典；key 为日志 ID，value 为中文文案。
     * @property {Object.<string, string>} ui - 界面说明文案字典；key 为界面语义 ID，value 为中文文案。
     * @property {Object.<string, string>} effects - 建筑效果文案字典；key 为效果 ID，value 为中文标签。
     * @property {Object.<string, {name: string, description: string}>} tabs - 标签页文本字典；key 为标签页 ID。
     * @property {Object.<string, {name: string, description: string}>} resources - 资源文本字典；key 为 ResourceId。
     * @property {Object.<string, {name: string, description: string}>} buildings - 建筑文本字典；key 为 BuildingId。
     * @property {Object.<string, {name: string, description: string}>} technologies - 科技文本字典；key 为 TechnologyId。
     * @property {Object.<string, {name: string, description: string}>} jobs - 职业文本字典；key 为 JobId。
     * @property {Object.<string, {name: string, description: string}>} policies - 政策文本字典；key 为政策 ID。
     * @property {Object.<string, {name: string, description: string}>} pacts - 深渊契约文本字典；key 为契约 ID。
     * @property {Object.<string, {name: string, description: string}>} factions - 阵营文本字典；key 为阵营 ID。
     * @property {Object.<string, {name: string, description: string}>} raidTargets - 掠夺目标文本字典；key 为掠夺目标 ID。
     */

    // Object.<string, string> 按钮文案字典：key 为语义 ID，value 为中文按钮文本。
    var BUTTON_TEXT = {
        pause: "暂停",
        resume: "继续",
        save: "保存",
        load: "加载",
        resetSave: "重置",
        exportSave: "导出",
        importSave: "导入"
    };

    // Object.<string, string> 状态文案字典：key 为状态 ID，value 为中文状态文本。
    var STATUS_TEXT = {
        running: "运行中",
        paused: "已暂停",
        goblins: "哥布林",
        housing: "住房",
        freeGoblins: "空闲",
        crowding: "拥挤度",
        tickRate: "模拟节奏",
        calendarRate: "历法速度",
        status: "状态"
    };

    // Object.<string, string> 资源分组文案字典：key 为资源分组 ID，value 为中文分组名。
    var CATEGORY_TEXT = {
        basic: "基础",
        crafted: "加工",
        rare: "稀有",
        mystic: "神秘",
        prestige: "威望"
    };

    // Object.<string, string> 日志文案字典：key 为日志 ID，value 为中文日志文本。
    var LOG_TEXT = {
        initial: "一只从哥布林洞穴逃脱的雌性人类在地穴中生下了你。",
        paused: "生产已暂停，地穴时间停止推进。",
        resumed: "地穴重新开始运转。",
        saved: "存档已保存。",
        noLocalSave: "没有可加载的本地存档。",
        loaded: "存档已加载。",
        reset: "存档已重置，新的地穴从头开始。",
        extinct: "最后的俘虏和哥布林都死光了，旧地穴崩溃，游戏回到初始界面。",
        imported: "导入存档已载入。",
        exportedToPanel: "导出文本已写入顶部存档文本框。",
        importPanelOpened: "请把存档文本粘贴到顶部存档文本框后点击载入文本。",
        builtPrefix: "建造完成：",
        destroyedPrefix: "建筑摧毁：",
        bornPrefix: "新哥布林加入：",
        foodWarning: "菌菇不足，存活哥布林开始挨饿。",
        researchedPrefix: "研究完成："
        ,
        resourceMissingPrefix: "资源不足：",
        capacityFullPrefix: "容量已满："
        ,
        eventPrefix: "事件："
    };

    // Object.<string, string> 界面说明文案字典：key 为界面语义 ID，value 为中文文案。
    var UI_TEXT = {
        resourcePending: "资源表将在 1.1 接入。",
        cavernConsole: "地穴控制台",
        skeletonReady: "从这里处理早期采集、基础建筑、新局模式和地穴剖面反馈。",
        pausedHint: "当前已暂停，后续状态变更按钮会被拦截。",
        runningHint: "当前运行中。",
        exportInlineHint: "这里是当前存档文本，可直接复制保存。",
        importInlineHint: "把存档 JSON 文本粘贴到这里，然后点击载入文本。",
        importEmpty: "导入失败：存档文本为空。",
        corruptedSave: "存档损坏，无法加载：",
        importFailed: "导入失败：",
        manualGather: "手动采集",
        basicBuildings: "基础建筑",
        costPrefix: "成本：",
        effectPrefix: "效果：",
        missingPrefix: "缺少："
        ,
        availabilityPrefix: "可用倒计时：",
        unavailable: "不可用",
        censusTitle: "人口普查",
        noGoblins: "还没有存活的哥布林。",
        attributePrefix: "属性：",
        traitPrefix: "特质：",
        woundPrefix: "伤病："
        ,
        jobsTitle: "职业分配",
        presetsTitle: "职业预设"
        ,
        researchTitle: "粗识研究",
        completed: "已完成",
        censusFilters: "筛选",
        jobFilter: "职业",
        traitFilter: "特质",
        woundFilter: "伤病",
        workshopTitle: "手工配方",
        craftRatio: "制作倍率",
        craftAll: "全部",
        captivesTitle: "俘虏",
        noCaptives: "当前没有俘虏。",
        captiveBed: "培育新生",
        captiveModify: "洗脑改造",
        captiveAutoBrainwashOn: "自动洗脑：开",
        captiveAutoBrainwashOff: "自动洗脑：关",
        captiveAutoBreedOn: "自动培育：开",
        captiveAutoBreedOff: "自动培育：关",
        captiveFood: "做成食物",
        policiesTitle: "政策",
        policyActive: "生效中",
        policyEffectPrefix: "收益：",
        policyCostPrefix: "代价：",
        ritualUpgradesTitle: "祖灵升级",
        sacrificesTitle: "献祭",
        ritualPurchased: "已供奉",
        ritualRewardPrefix: "收益：",
        ritualRiskPrefix: "风险：",
        pactsTitle: "深渊契约",
        pactActive: "契约中",
        migrationTitle: "帝国迁徙",
        migrationGainPrefix: "本次可获得：",
        migrationKeepPrefix: "保留：",
        migrationLosePrefix: "清空内容：",
        migrationBlocked: "需要研究迁徙法典并结束当前远征。",
        migrateEmpire: "迁徙帝国",
        prestigePerksTitle: "威望天赋",
        prestigePerkPurchased: "已购买"
    };

    // Object.<string, string> 建筑效果文案字典：key 为效果 ID，value 为中文标签。
    var EFFECT_TEXT = {
        fungusPerTick: "菌菇基础产出/tick",
        laborUsage: "劳力占用",
        laborUsageReductionRatio: "劳力占用减免",
        rottenWoodPerTick: "朽木基础产出/tick",
        foodConsumptionReductionRatio: "菌菇消耗减免",
        fungusOutputRatio: "菌菇产出倍率",
        rottenWoodOutputRatio: "朽木产出倍率",
        weatherNegativeMitigationRatio: "恶劣天气削弱",
        weatherPositiveAmplificationRatio: "有利天气放大",
        housingMax: "人口上限",
        crudeKnowledgeMax: "粗识上限",
        crudeKnowledgeOutputRatio: "粗识产出倍率",
        fungusMax: "菌菇上限",
        rottenWoodMax: "朽木上限",
        rubbleMax: "碎石上限",
        coalSlagMax: "煤渣上限",
        ironOreMax: "铁矿上限",
        ironPlateMax: "铁片上限",
        rubbleOutputRatio: "碎石产出倍率",
        coalSlagPerTick: "煤渣基础产出/tick",
        charcoalKilnWoodCostPerSecond: "闷炭朽木消耗/秒",
        charcoalKilnCoalSlagPerSecond: "闷炭煤渣/秒",
        crudeFurnaceIronOrePerSecond: "铁矿熔炼/秒",
        crudeFurnaceIronPlatePerSecond: "铁片熔炼/秒",
        crudeFurnaceWoodCostPerSecond: "朽木消耗/秒",
        crudeFurnaceRubbleCostPerSecond: "碎石消耗/秒",
        leatherPerSecond: "皮革/秒",
        boneShardPerSecond: "骨片/秒",
        obediencePerSecond: "服从/秒",
        fungusConsumptionIncreaseRatio: "菌菇消耗增加"
        ,
        coinPerSecond: "金币/秒",
        ledgerPerSecond: "账册/秒",
        lootMax: "战利品上限",
        captiveMax: "俘虏容量",
        ancestralEchoPerSecond: "祖灵回响/秒",
        allBasicCapacity: "基础容量"
        ,
        raidStrengthRatio: "掠夺队伍强度",
        ancestralEchoMax: "祖灵回响上限",
        tarMax: "焦油上限",
        blackIronMax: "黑铁上限",
        runePlateMax: "符文板上限",
        manaCrystalMax: "魔晶上限",
        tarPerSecond: "焦油/秒",
        deepFurnaceSteelPerSecond: "钢锭深炉/秒",
        deepFurnaceBlackIronPerSecond: "黑铁深炉/秒",
        deepFurnaceTarCostPerSecond: "焦油消耗/秒",
        runeMachineKnowledgePerSecond: "粗识符文/秒",
        runeMachineManaCostPerSecond: "魔晶消耗/秒",
        fortressAchievement: "黑铁要塞成就",
        abyssEchoMax: "深渊回响上限",
        relicMax: "遗物上限",
        riftShardMax: "裂隙碎片上限",
        abyssEchoPerSecond: "深渊回响/秒",
        abyssGateOpened: "深渊门开启",
        eventRiskRatio: "事故风险"
    };

    // Object.<string, {name: string, description: string}> 标签页文本字典：key 为标签页 ID。
    var TAB_TEXT = {
        cavern: {
            name: "地穴",
            description: "处理采集、基础建设和早期生存。"
        },
        clan: {
            name: "氏族",
            description: "管理人口普查、职业分配和个体哥布林。"
        },
        research: {
            name: "研究",
            description: "研究粗糙记号和地穴技术。"
        },
        workshop: {
            name: "工坊",
            description: "制作材料、升级工具和自动化配方。"
        },
        diplomacy: {
            name: "外交",
            description: "处理贸易、关系、掠夺和俘虏。"
        },
        ritual: {
            name: "祭祀",
            description: "献祭战利品并向祖灵索取力量。"
        },
        empire: {
            name: "帝国",
            description: "查看政策、统计、法令和成就。"
        },
        abyss: {
            name: "深渊",
            description: "编成远征队、签订契约并准备迁徙。"
        }
    };

    // Object.<string, {name: string, description: string}> 资源文本字典：key 为 ResourceId。
    var RESOURCE_TEXT = {
        fungus: {
            name: "菌菇",
            description: "湿冷菌毯上掰下来的口粮，喂饱哥布林和俘虏，也能铺成新的菌菇床。"
        },
        rottenWood: {
            name: "朽木",
            description: "从烂根和塌架里拖回的湿木，可搭窝棚、烧炉火，也能捆成木梁。"
        },
        rubble: {
            name: "碎石",
            description: "矿壁上敲落的碎块，是储坑、石板、矿井和祭坛最粗笨的骨架。"
        },
        labor: {
            name: "劳力",
            description: "存活哥布林能挤出的干活劲头；启用建筑会占走它，过载时地穴生产会停摆。"
        },
        crudeKnowledge: {
            name: "粗识",
            description: "墙上刻痕、乱涂符号和笨账本堆出的粗糙知识，用来研究地穴技术。"
        },
        obedience: {
            name: "服从",
            description: "哥布林听鞭子和酋长吼声的程度；越稳，产出越顺，事故越少。"
        },
        coalSlag: {
            name: "煤渣",
            description: "浅矿和炉底扒出的黑渣，脏但能烧，是熔炉、钢锭和深层工业的燃料。"
        },
        ironOre: {
            name: "铁矿",
            description: "碎石里露出的沉重矿脉，丢进粗熔炉后才能变成工具和兵器的铁料。"
        },
        ironPlate: {
            name: "铁片",
            description: "敲扁、切裂、还带毛边的铁料，工具、仓储和抢掠军备都要抢着用。"
        },
        woodenBeam: {
            name: "木梁",
            description: "用烂木捆扎出的承重梁，撑住仓库、工坊和更深的地穴结构。"
        },
        stoneSlab: {
            name: "石板",
            description: "从碎石堆里挑平的厚板，给仓库、矿井和祖灵祭坛垫出硬底。"
        },
        crudePickaxe: {
            name: "粗糙镐",
            description: "铁片绑木柄做成的劣镐，让搬石工敢把浅层矿壁敲得更深。"
        },
        reinforcedBasket: {
            name: "加固背篓",
            description: "用木梁和铁片加固的背篓，能多塞碎石、煤渣，也更适合地穴搬运。"
        },
        sawtoothAxe: {
            name: "锯齿斧",
            description: "边缘像兽牙一样乱的斧头，砍朽木、剥兽皮都比空手强。"
        },
        blastFurnace: {
            name: "鼓风炉",
            description: "给粗熔炉塞上风口和炉腹，让矿渣烧得更热，铁片和钢锭更听话。"
        },
        leather: {
            name: "皮革",
            description: "洞兽皮鞣出的韧料，能缝背篓、护具和监工鞭。"
        },
        boneShard: {
            name: "骨片",
            description: "从兽骨和祭品里敲下的尖碎骨，可做粗器，也能摆上祖灵祭坛。"
        },
        coin: {
            name: "金币",
            description: "地表和黑市都认的闪亮硬货，能换贸易、雇佣、账册和暂时的规矩。"
        },
        steelIngot: {
            name: "钢锭",
            description: "铁片与煤渣反复烧打出的硬锭，是中期工业、军工和要塞的脊梁。"
        },
        gear: {
            name: "齿轮",
            description: "哥布林难得咬合准的金属轮，机械、自动滑槽和符文设备都离不开它。"
        },
        autoChute: {
            name: "自动滑槽",
            description: "齿轮拖着钢槽乱响送料，能让工程师少跑腿，把低阶制作推得更快。"
        },
        chainmail: {
            name: "锁子甲",
            description: "铁片和皮革串成的沉重护具，抢掠兵穿上后没那么容易倒在路上。"
        },
        handcart: {
            name: "轮车",
            description: "木梁、铁片和吱呀轮子拼出的拖车，能把货物、贡品和赃物推得更远。"
        },
        overseerWhip: {
            name: "监工鞭",
            description: "皮革缠金币坠成的响鞭，抽在地上就能让哥布林想起谁说了算。"
        },
        ledger: {
            name: "账册",
            description: "脏手印和歪数字写满的册子，记录贸易、税贡、政策和帝国命令。"
        },
        loot: {
            name: "战利品",
            description: "抢来的锅、旗、银杯和骨饰；能分赃稳人心，也能堆上祭坛换回响。"
        },
        infamy: {
            name: "恶名",
            description: "一次次成功抢掠传出去的凶名；失败会让它掉价，足够高时才能吓开更肥的目标。"
        },
        goodwill: {
            name: "善名",
            description: "商队愿意再来一次的薄信誉；掠夺会撕破它，高阶贸易势力只和有善名的地穴做生意。"
        },
        captive: {
            name: "俘虏",
            description: "抢回地穴的地表人口，可洗脑、培育新生，实在断粮时也会被当成食物。"
        },
        ancestralEcho: {
            name: "祖灵回响",
            description: "战利品、骨片和牺牲唤来的地下回声，本局内可换取祖灵赐下的粗暴加护。"
        },
        tar: {
            name: "焦油",
            description: "深层裂缝渗出的黑黏燃料，沾上就难洗，却能喂饱深炉和黑铁工艺。"
        },
        blackIron: {
            name: "黑铁",
            description: "钢、煤渣和焦油熬出的暗色重金属，用来铸要塞、军备和帝国级工程。"
        },
        runePlate: {
            name: "符文板",
            description: "刻满歪斜符文的黑铁板，能把粗识、魔晶和深渊低语压进机械里。"
        },
        manaCrystal: {
            name: "魔晶",
            description: "带着深渊回声发冷光的晶体，符文、契约和晚期机关都会吞噬它。"
        },
        warBanner: {
            name: "战旗",
            description: "用战利品、皮革和钢锭竖起的破旗，能把抢掠兵吼成一支更像样的队伍。"
        },
        runeCarvingKnife: {
            name: "符文刻刀",
            description: "黑铁细刃磨出的刻刀，专门割开符文板和魔晶表面的深渊纹路。"
        },
        deepFurnaceValve: {
            name: "深炉阀门",
            description: "能扛住焦油火的沉重阀件，控制深炉呼吸，决定黑铁工业烧得多狠。"
        },
        prestige: {
            name: "威望",
            description: "旧帝国崩塌前留下的名号和传说，指向迁徙后的帝国遗产。"
        },
        abyssEcho: {
            name: "深渊回响",
            description: "深渊门后传来的低语回声，契约、远征和终局设施都要用它当价码。"
        },
        relic: {
            name: "遗物",
            description: "远征队从旧帝国废墟和裂缝边缘拖回的怪东西，稀少但能改写后期工程。"
        },
        imperialLegacy: {
            name: "帝国遗产",
            description: "帝国迁徙后还能带走的制度、血脉和地下传承，用来购买永久天赋。"
        },
        riftShard: {
            name: "裂隙碎片",
            description: "从不稳定裂隙里撬下的碎片，挑战奖励和顶级工程都会争抢它。"
        }
    };

    // Object.<string, {name: string, description: string}> 建筑文本字典：key 为 BuildingId。
    var BUILDING_TEXT = {
        fungus_bed: {
            name: "菌菇床",
            description: "铺开潮湿菌毯，让地穴开始稳定冒出能吃的东西。"
        },
        rotten_grove: {
            name: "腐木圃",
            description: "把拾来的朽木半埋进湿泥和菌丝里，缓慢长出可用的腐枝。"
        },
        mud_hut: {
            name: "窝棚",
            description: "歪斜但能住的泥木棚屋，提高人口上限。"
        },
        cave_room: {
            name: "洞室",
            description: "把潮湿岩壁凿出更稳定的居室，缓解人口扩张压力。"
        },
        barracks_cave: {
            name: "兵营洞",
            description: "把居住空间和武备堆场混在一起，提高人口容量并给抢掠队集结。"
        },
        spore_trench: {
            name: "孢子沟",
            description: "把菌菇孢子引到浅沟里，减少哥布林吃掉的菌菇。"
        },
        drying_rack: {
            name: "晾木架",
            description: "用碎石垫高湿木，让捡柴工更容易分拣还能用的朽木。"
        },
        drip_channel: {
            name: "滴水渠",
            description: "让岩缝渗水流过菌床，提高菌菇生长效率。"
        },
        weather_totem: {
            name: "潮痕桩",
            description: "把骨片、刻痕和湿泥堆成观测桩，提前安排菌床、矿道和炉火的防潮活。"
        },
        spore_sluice: {
            name: "孢潮闸",
            description: "用腐木和碎石挡板调节孢雨与湿涌，让有利天气更容易被菌床和木圃吃干榨净。"
        },
        graffiti_wall: {
            name: "涂鸦墙",
            description: "给哥布林乱画记号的墙面，提高粗识上限并解锁研究。"
        },
        witch_doctor_hut: {
            name: "巫医棚",
            description: "给巫医存放骨片、符号和臭草，提高粗识与服从上限。"
        },
        storage_pit: {
            name: "储物坑",
            description: "挖出阴冷储坑，显著提高基础资源和矿业资源容量。"
        },
        wooden_storehouse: {
            name: "木架仓",
            description: "用木梁和石板搭起分层仓架，提高基础材料容量。"
        },
        hauling_post: {
            name: "搬运桩",
            description: "把背篓、绳子和碎石路径固定成粗糙搬运点，提高碎石搬运效率。"
        },
        shallow_mine: {
            name: "浅矿井",
            description: "向地穴侧壁挖出浅井，带来碎石加成和煤渣入口。"
        },
        artisan_shed: {
            name: "工匠棚",
            description: "给笨手笨脚的哥布林留出加工材料的棚位。"
        },
        crude_furnace: {
            name: "粗熔炉",
            description: "用朽木和碎石维持低劣炉火，缓慢烧出铁矿和铁片。"
        },
        pulley_gallery: {
            name: "绞盘廊",
            description: "沿矿道装上木轴和绳轮，让少数哥布林拖动更多矿车和炉料。"
        },
        vent_shaft: {
            name: "通风井",
            description: "给矿道和熔炉开出可控风口，降低酸雾、湿涌和孢雨对生产的拖累。"
        },
        rubble_yard: {
            name: "碎石场",
            description: "把搬来的碎石集中筛拣，提高碎石和煤渣产出。"
        },
        charcoal_kiln: {
            name: "闷炭窑",
            description: "把多余朽木封进泥窑慢烧，换取更稳定的煤渣燃料。"
        },
        beast_pen: {
            name: "兽栏",
            description: "圈养洞穴小兽，获得皮革和骨片入口。"
        },
        bad_wine_barrel: {
            name: "劣酒桶",
            description: "用发臭菌菇酿成劣酒，提高服从但增加食物压力。"
        },
        chief_hall: {
            name: "酋长厅",
            description: "让哥布林开始服从一个更大的吼叫声，解锁帝国管理。"
        },
        black_market: {
            name: "黑市",
            description: "用金币和恐吓建立交易入口，解锁外交。"
        },
        training_pit: {
            name: "训练坑",
            description: "让抢掠兵互相殴打，提高掠夺队伍的临场强度。"
        },
        overseer_platform: {
            name: "监工台",
            description: "让监工站在高台上挥鞭点名，压低生产建筑的劳力占用。"
        },
        weapon_shed: {
            name: "兵器坊",
            description: "用木梁和铁片粗制军备，提高抢掠准备。"
        },
        captive_bed: {
            name: "囚笼苗床",
            description: "把俘虏关进繁衍用的木笼，扩大俘虏处置容量。"
        },
        brainwash_shed: {
            name: "洗脑棚",
            description: "用涂鸦、骨片和粗识改造俘虏，提高洗脑处置收益。"
        },
        ledger_room: {
            name: "账房",
            description: "集中账册和算筹，提升粗识与金币效率。"
        },
        ancestral_altar: {
            name: "祖灵祭坛",
            description: "用战利品和石板呼唤祖灵，解锁祭祀。"
        },
        underground_port: {
            name: "地底仓港",
            description: "连接地穴仓储和贸易路线，大幅提高材料容量。"
        },
        tar_well: {
            name: "焦油井",
            description: "从深层裂缝里抽出焦油，给深炉和黑铁工业供料。"
        },
        deep_furnace: {
            name: "深炉",
            description: "消耗焦油维持高温，自动产出钢锭和黑铁。"
        },
        black_iron_fortress: {
            name: "黑铁要塞",
            description: "用黑铁封住主洞口，作为黑铁帝国的阶段性成就。"
        },
        black_iron_dwelling: {
            name: "黑铁居所",
            description: "更坚固的高阶居所，提高人口容量并容纳武装哥布林。"
        },
        rune_machine_room: {
            name: "符文机房",
            description: "以魔晶驱动符文机械，显著提高粗识上限和产出。"
        },
        war_camp: {
            name: "战争营地",
            description: "集结战旗、军备和战争头目，强化后期掠夺。"
        },
        abyss_gate: {
            name: "深渊门",
            description: "把帝国通向更深处，解锁深渊页和终局资源。"
        },
        sacrifice_pit: {
            name: "献祭坑",
            description: "向深渊而非祖灵献祭，获得深渊回响但提高风险。"
        },
        void_warehouse: {
            name: "虚空仓库",
            description: "用黑铁和魔晶稳定虚空夹层，提高深渊资源容量。"
        },
        expedition_camp: {
            name: "远征营",
            description: "为深层路线和遗物回收准备远征队。"
        },
        rift_anchor: {
            name: "裂隙锚",
            description: "把裂隙碎片固定成可反复利用的终局工程。"
        }
    };

    // Object.<string, {name: string, description: string}> 科技文本字典：key 为 TechnologyId。
    var TECHNOLOGY_TEXT = {
        marks: {
            name: "记号",
            description: "学会用刻痕记录潮湿、饥饿和下一次采菌。"
        },
        deadwood_cultivation: {
            name: "朽木栽培",
            description: "把朽木当成可培育材料，而不是只靠地穴边缘碰运气。"
        },
        foraging: {
            name: "采菌",
            description: "把随手采菌变成更稳定的菌菇管理。"
        },
        digging: {
            name: "挖掘",
            description: "知道哪些石缝能挖，哪些石缝会塌。"
        },
        weather_signs: {
            name: "潮痕观测",
            description: "学会从洞壁水线、孢粉厚度和风声里判断下一段地穴天气。"
        },
        hut_building: {
            name: "窝棚搭建",
            description: "让窝棚不再完全靠运气站住。"
        },
        labor_rosters: {
            name: "劳力名册",
            description: "把空闲哥布林、搬石工和临时苦役刻进同一张调度名单。"
        },
        woodcraft: {
            name: "木架工艺",
            description: "学会晾晒、捆扎和堆放朽木，让木料链能支撑后续建筑。"
        },
        mining: {
            name: "采矿",
            description: "把搬碎石推进到真正的浅层采矿。"
        },
        metallurgy: {
            name: "冶金",
            description: "让哥布林学会维持炉火和分拣金属。"
        },
        charcoal_burning: {
            name: "闷炭术",
            description: "用泥窑控制朽木慢烧，把不稳的燃料转成可用煤渣。"
        },
        pulley_systems: {
            name: "绞盘系统",
            description: "用木梁、铁片和绳轮把重复搬运交给矿道机械。"
        },
        cave_ventilation: {
            name: "通风支护",
            description: "把矿井支柱、风口和炉火排烟连成一套抗天气的生产结构，存活个体寿命 +6 月。"
        },
        beast_pen: {
            name: "兽栏",
            description: "把洞穴小兽从食物变成可管理的材料来源。"
        },
        big_club: {
            name: "大木棒",
            description: "挑出够粗的朽木，削成能把胆子砸出来的第一批武器。"
        },
        crossbow: {
            name: "弓弩",
            description: "把劣质木梁和铁片拼成能吓人的远射武器。"
        },
        crude_tools: {
            name: "粗制工具",
            description: "用铁片和木梁制造能提升采集和制作的工具。"
        },
        desire_enlightenment: {
            name: "欲望启蒙",
            description: "把对俘虏的改造从临时粗活变成可持续的固定流程。"
        },
        public_nursery: {
            name: "公用苗床",
            description: "把洗脑完成的俘虏排入公共苗床名册，按最有价值的血统自动补充新生。"
        },
        clan_rules: {
            name: "氏族规矩",
            description: "把吼叫、惩罚和分赃写成粗糙规矩。"
        },
        overseer_drills: {
            name: "监工操典",
            description: "规定站岗、换班和鞭打节奏，让生产建筑少拖走空闲劳力。"
        },
        census: {
            name: "人口普查",
            description: "把每个存活哥布林记进粗糙名单，方便筛选职业、特质和伤病。"
        },
        counting: {
            name: "计数",
            description: "让哥布林能数到比手指更多的东西。"
        },
        calendar: {
            name: "历法",
            description: "把春夏秋冬刻成哥布林自己的纪年，从研究完成当天算作哥布林历第一年。"
        },
        engineering: {
            name: "工程",
            description: "把棚子、仓港和机械当成可重复建造的结构。"
        },
        currency: {
            name: "货币",
            description: "承认闪亮金币能换来暂时的服从和贸易。"
        },
        writing: {
            name: "书写",
            description: "从涂鸦进化到账册和命令。"
        },
        rituals: {
            name: "祭祀",
            description: "把战利品、骨片和恐惧献给祖灵，借祖灵回响让存活个体寿命 +12 月。"
        },
        machinery: {
            name: "机械",
            description: "用齿轮和工匠经验减少重复劳动。"
        },
        steel: {
            name: "钢铁",
            description: "把铁片推进到更稳定的军工材料。"
        },
        surface_lore: {
            name: "地表学",
            description: "整理从俘虏和斥候处得来的地表情报。"
        },
        diplomacy: {
            name: "外交术",
            description: "把黑市交易推进为可计算的高阶外交。"
        },
        runology: {
            name: "符文学",
            description: "让魔晶、黑铁和粗识能被刻进符文板，存活个体寿命 +18 月。"
        },
        black_iron_smelting: {
            name: "黑铁铸造",
            description: "掌握焦油和钢锭烧制黑铁的高阶工艺。"
        },
        imperial_code: {
            name: "帝国法典",
            description: "把城邦规矩升级为帝国级命令和统计制度。"
        },
        abyss_mapping: {
            name: "深渊测绘",
            description: "绘制通往更深处的裂隙路径，准备打开深渊门。"
        },
        pact_lore: {
            name: "契约学",
            description: "理解深渊契约的收益和代价。"
        },
        rift_engineering: {
            name: "裂隙工程",
            description: "让裂隙碎片成为稳定工程材料。"
        },
        migration_code: {
            name: "迁徙法典",
            description: "为帝国迁徙和威望结算建立最后的规则。"
        }
    };

    // Object.<string, {name: string, description: string}> 职业文本字典：key 为 JobId。
    var JOB_TEXT = {
        woodcutter: {
            name: "捡柴工",
            description: "在地穴边缘翻找朽木。"
        },
        forager: {
            name: "采菌工",
            description: "专门照看和采收菌菇。"
        },
        hauler: {
            name: "搬石工",
            description: "把碎石搬回可用的堆场。"
        },
        graffiti_apprentice: {
            name: "涂鸦学徒",
            description: "在墙上刻下粗糙记号，积累粗识。"
        },
        miner: {
            name: "矿工",
            description: "在浅矿井里敲碎石、煤渣和少量铁矿。"
        },
        smelter: {
            name: "熔炼工",
            description: "看守粗熔炉并筛出煤渣、铁矿和铁片。"
        },
        raider: {
            name: "抢掠兵",
            description: "积累军势，为后续掠夺系统准备。"
        },
        artisan: {
            name: "工匠",
            description: "在工匠棚里改善制作效率。"
        },
        accountant: {
            name: "账房",
            description: "记录金币、账册和政策开销。"
        },
        overseer: {
            name: "监工",
            description: "维持服从并压低事故风险。"
        },
        witch_doctor: {
            name: "巫医",
            description: "处理祖灵回响和祭祀风险。"
        },
        engineer: {
            name: "工程师",
            description: "为自动制作和机械维护打基础。"
        },
        rune_smith: {
            name: "符文匠",
            description: "用魔晶和黑铁提升符文板、魔晶和粗识效率。"
        },
        war_chief: {
            name: "战争头目",
            description: "组织抢掠兵、战旗和战争营地，提高队伍强度与战利品。"
        },
        deep_miner: {
            name: "深矿师",
            description: "深入黑铁矿层，带回焦油、黑铁和魔晶线索。"
        }
    };

    // Object.<string, {name: string, description: string}> 政策文本字典：key 为政策 ID。
    var POLICY_TEXT = {
        trade_focus: {
            name: "贸易路线",
            description: "把扩张重心放在商队、仓港和账册上。"
        },
        raid_focus: {
            name: "掠夺传统",
            description: "把扩张重心放在抢掠兵、军备和恐吓上。"
        },
        intimidation: {
            name: "恐吓统治",
            description: "用监工和公开惩罚压住地穴秩序。"
        },
        rationing: {
            name: "战利品分配",
            description: "定期分赃和配给，换取更稳定的繁衍与消耗。"
        },
        deep_digging: {
            name: "深挖",
            description: "让矿工追着矿脉往更危险的深处敲。"
        },
        reinforcement: {
            name: "稳固",
            description: "用木梁、石板和监工时间加固矿道。"
        },
        ancestor_veneration: {
            name: "祖灵崇拜",
            description: "把祭祀做成祖灵秩序的一部分。"
        },
        blood_moon: {
            name: "血月献祭",
            description: "用更凶的献祭换取更快的祖灵回应。"
        },
        total_industry: {
            name: "全面工业化",
            description: "让深炉、齿轮和黑铁车间压过一切生活秩序。"
        },
        cave_maintenance: {
            name: "洞穴维护",
            description: "把一部分劳力用于通风、支护、菌菇沟和居住维护。"
        },
        imperial_bureaucracy: {
            name: "帝国官僚",
            description: "用账册和法令把自动化、贸易和统计统一起来。"
        },
        warlord_autonomy: {
            name: "军阀自治",
            description: "放任战争头目扩张据点，以更高内斗风险换取军事收益。"
        }
    };

    // Object.<string, {name: string, description: string}> 深渊契约文本字典：key 为契约 ID。
    var PACT_TEXT = {
        hunger_pact: {
            name: "饥饿契约",
            description: "深渊让苗床后代更难填饱，也让每张嘴都索求更多。"
        },
        black_furnace_pact: {
            name: "黑炉契约",
            description: "让炉火吞下更多风险，换来更强工业产出。"
        },
        rift_pact: {
            name: "裂隙契约",
            description: "让魔晶更活跃，同时压低服从的稳定恢复。"
        },
        war_pact: {
            name: "战争契约",
            description: "深渊偏爱征服，但贸易关系会被战争气味拖累。"
        }
    };

    // Object.<string, {name: string, description: string}> 阵营文本字典：key 为阵营 ID。
    var FACTION_TEXT = {
        rat_caravan: {
            name: "鼠人商队",
            description: "来往地底裂缝的小贩，愿意用金币换食物。"
        },
        gray_dwarf_mine_league: {
            name: "灰矮人矿盟",
            description: "守着矿脉和秤砣的严苛矿业同盟。"
        },
        lizard_swamp_clan: {
            name: "蜥蜴人沼部",
            description: "从湿热水道带来皮革和稀奇材料的部族。"
        },
        goblin_black_market: {
            name: "地精黑市",
            description: "比哥布林更会算账，也更会骗钱的地下黑市。"
        },
        undead_lord: {
            name: "亡灵领主",
            description: "在旧墓穴和深渊裂缝间索取战利品与魔晶的冷酷势力。"
        },
        abyss_emissary: {
            name: "深渊使者",
            description: "从裂隙边缘传话的深渊代理，交易深渊回响和裂隙碎片。"
        },
        deep_gray_dwarf_court: {
            name: "深层灰矮人王庭",
            description: "比矿盟更深、更富、更记仇的灰矮人贵族王庭。"
        },
        surface_border_city: {
            name: "地表边境城邦",
            description: "地表边境的商税城邦，富有且会组织报复。"
        }
    };

    // Object.<string, {name: string, description: string}> 掠夺目标文本字典：key 为掠夺目标 ID。
    var RAID_TARGET_TEXT = {
        fungus_farm_cave: {
            name: "菌菇农洞",
            description: "防备松散的农洞，主要产出菌菇和少量俘虏。"
        },
        caravan_camp: {
            name: "商队营地",
            description: "鼠人和地精混杂的临时营地，金币和俘虏风险并存。"
        },
        mine_league_outpost: {
            name: "矿盟哨站",
            description: "灰矮人矿盟的边缘哨站，有铁矿和强烈报复风险。"
        },
        surface_village: {
            name: "地表村落",
            description: "脆弱但会求援的地表村落，可带回村姑、采药女和村中匠人。"
        },
        noble_carriage: {
            name: "贵族车队",
            description: "有护卫、有账册、有贵族小姐和侍祭随行的地表车队。"
        },
        surface_barracks: {
            name: "地表军营",
            description: "装备齐整的地表驻军，村卫女兵和钢材收益都很诱人。"
        },
        ancient_ruin: {
            name: "古代遗迹",
            description: "残留魔晶和符文的危险遗迹，可能带回魔法学徒或亡灵修女。"
        }
    };

    // Object.<string, {name: string, description: string}> 威望天赋文本字典：key 为威望天赋 ID。
    var PRESTIGE_PERK_TEXT = {
        cave_engineering: {
            name: "地穴工程学",
            description: "把旧帝国的塌方教训写进新地穴，建筑价格 -1%。"
        },
        old_ledger: {
            name: "老账本",
            description: "保留会计氏族的旧账法，账册和符文板制作 +5%。"
        },
        greedy_bloodline: {
            name: "贪婪血脉",
            description: "会闻到金币和战利品的后代更容易活下来，金币和战利品收益 +10%。"
        },
        deep_instinct: {
            name: "深挖本能",
            description: "迁徙后的哥布林更懂得沿着矿脉扩仓，矿物容量 +10%。"
        },
        black_iron_tradition: {
            name: "黑铁传统",
            description: "深炉规矩变成氏族传统，钢锭和黑铁制作 +5%。"
        },
        ancestor_memory: {
            name: "祖灵记忆",
            description: "一小部分祖灵回响跟随迁徙队进入新地穴。"
        },
        abyss_adaptation: {
            name: "深渊适应",
            description: "长期接触深渊后，契约代价 -5%。"
        },
        imperial_bureaucracy: {
            name: "帝国官僚",
            description: "迁徙队带走职业分派名册，职业预设获得永久支撑。"
        }
    };

    // Object.<string, {name: string, description: string}> 挑战文本字典：key 为挑战 ID。
    var CHALLENGE_TEXT = {
        eternal_winter_cave: {
            name: "永冬地穴",
            description: "菌菇产出长期 -50%，完成后食物建筑永久 +5%。"
        },
        no_trade_empire: {
            name: "无贸易帝国",
            description: "禁止普通贸易，只能掠夺，完成后掠夺收益永久 +5%。"
        },
        rebellion_age: {
            name: "叛乱时代",
            description: "服从上限降低且内斗风险提高，完成后监工和酋长厅永久 +10%。"
        },
        poor_ore_layer: {
            name: "贫矿层",
            description: "矿物产出 -40%，完成后仓储和加工倍率永久 +5%。"
        },
        no_rituals: {
            name: "无祭祀",
            description: "禁用祖灵和深渊系统，完成后科研产出永久 +5%。"
        }
    };

    // TextRegistry 中文文本注册表：集中提供玩家可见文本。
    var TEXT_REGISTRY = {
        buttons: BUTTON_TEXT,
        status: STATUS_TEXT,
        categories: CATEGORY_TEXT,
        logs: LOG_TEXT,
        ui: UI_TEXT,
        effects: EFFECT_TEXT,
        tabs: TAB_TEXT,
        resources: RESOURCE_TEXT,
        buildings: BUILDING_TEXT,
        technologies: TECHNOLOGY_TEXT,
        jobs: JOB_TEXT,
        policies: POLICY_TEXT,
        pacts: PACT_TEXT,
        prestigePerks: PRESTIGE_PERK_TEXT,
        challenges: CHALLENGE_TEXT,
        factions: FACTION_TEXT,
        raidTargets: RAID_TARGET_TEXT
    };

    /**
     * 读取中文文本；缺失时返回 fallback。
     *
     * @param {Object.<string, string>} textMap - 文本文案字典；key 为文本 ID，value 为中文文案。
     * @param {string} textId - 文本 ID 字符串。
     * @param {string} fallbackText - 缺失时使用的中文兜底文案。
     * @returns {string} 中文显示文本。
     */
    function getText(textMap, textId, fallbackText) {
        return textMap[textId] || fallbackText;
    }

    // Object 文本模块命名空间：提供集中中文文本和读取函数。
    game.text = {
        TEXT_REGISTRY: TEXT_REGISTRY,
        getText: getText
    };
})(window.GoblinEmpire);
