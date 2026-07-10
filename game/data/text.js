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
        initial: "一小撮哥布林在潮湿地穴里醒来。",
        paused: "生产已暂停，地穴时间停止推进。",
        resumed: "地穴重新开始运转。",
        saved: "存档已保存。",
        noLocalSave: "没有可加载的本地存档。",
        loaded: "存档已加载。",
        reset: "存档已重置，新的地穴从头开始。",
        imported: "导入存档已载入。",
        builtPrefix: "建造完成："
        ,
        bornPrefix: "新哥布林加入：",
        foodWarning: "菌菇不足，自然增长已经停止。",
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
        exportPrompt: "导出存档文本",
        importPrompt: "粘贴存档文本",
        resetConfirm: "确认清空本地存档并从头开始？此操作不会保留当前资源、建筑、科技、哥布林、威望和统计。",
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
        captiveBed: "制作苗床",
        captiveModify: "洗脑改造",
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
        foodConsumptionReductionRatio: "菌菇消耗减免",
        fungusOutputRatio: "菌菇产出倍率",
        housingMax: "人口上限",
        laborMax: "劳力上限",
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
        ancestralEchoPerSecond: "祖灵回响/秒",
        allBasicCapacity: "基础容量"
        ,
        militaryPowerMax: "军力上限",
        militaryPowerOutputRatio: "军力产出倍率",
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
            description: "初始食物，用于维持哥布林和建设菌菇床。"
        },
        rottenWood: {
            name: "朽木",
            description: "潮湿洞穴里的腐朽木料，用于搭建窝棚。"
        },
        rubble: {
            name: "碎石",
            description: "地穴里随处可搬的石块，用于早期建筑。"
        },
        labor: {
            name: "劳力",
            description: "由存活哥布林和建筑容量派生的行动资源。"
        },
        militaryPower: {
            name: "军力",
            description: "训练、装备和抢掠兵积累的暴力准备。"
        },
        crudeKnowledge: {
            name: "粗识",
            description: "刻痕、涂鸦和笨拙记录积累的早期科研资源。"
        },
        obedience: {
            name: "服从",
            description: "衡量哥布林是否听话的状态资源，影响产出和事故。"
        },
        coalSlag: {
            name: "煤渣",
            description: "粗黑易燃的矿业燃料，用于熔炉和早期冶炼。"
        },
        ironOre: {
            name: "铁矿",
            description: "夹在碎石里的金属原料，可由矿井和熔炉获得。"
        },
        ironPlate: {
            name: "铁片",
            description: "粗糙铁料切出的加工材料，用于工具和军工。"
        },
        woodenBeam: {
            name: "木梁",
            description: "把朽木捆扎成还能承重的粗糙梁材。"
        },
        stoneSlab: {
            name: "石板",
            description: "从碎石里挑出并凿平的基础建材。"
        },
        crudePickaxe: {
            name: "粗糙镐",
            description: "提高浅层采矿效率的劣质工具。"
        },
        reinforcedBasket: {
            name: "加固背篓",
            description: "让哥布林能多背一点碎石和煤渣。"
        },
        sawtoothAxe: {
            name: "锯齿斧",
            description: "切割朽木和兽皮的粗暴工具。"
        },
        blastFurnace: {
            name: "鼓风炉",
            description: "给粗熔炉提供更稳定的风口和炉温。"
        },
        leather: {
            name: "皮革",
            description: "早期军工、背篓和仓储会用到的韧性材料。"
        },
        boneShard: {
            name: "骨片",
            description: "祭祀和粗糙工具会用到的尖锐碎骨。"
        },
        coin: {
            name: "金币",
            description: "贸易、雇佣和政策需要的稀缺货币。"
        },
        steelIngot: {
            name: "钢锭",
            description: "中期工业和军工的高阶金属材料。"
        },
        gear: {
            name: "齿轮",
            description: "机械和自动化建筑需要的精密零件。"
        },
        autoChute: {
            name: "自动滑槽",
            description: "齿轮和钢锭拼出的粗暴送料槽，提高工程师自动制作速度。"
        },
        chainmail: {
            name: "锁子甲",
            description: "用铁片和皮革串成的粗糙护具，降低掠夺伤亡。"
        },
        handcart: {
            name: "轮车",
            description: "木梁和铁片拼成的运输车，提高贸易和仓储效率。"
        },
        overseerWhip: {
            name: "监工鞭",
            description: "皮革和金币制成的纪律工具，提高服从和稳定。"
        },
        ledger: {
            name: "账册",
            description: "记录贸易、税贡和政策开销的行政材料。"
        },
        loot: {
            name: "战利品",
            description: "掠夺和献祭都会消耗的粗暴财富。"
        },
        captive: {
            name: "俘虏",
            description: "掠夺带回的特殊人口资源；详细处置仍由俘虏列表记录。"
        },
        ancestralEcho: {
            name: "祖灵回响",
            description: "祭祀祖灵时获得的单局神秘资源。"
        },
        tar: {
            name: "焦油",
            description: "深层裂缝渗出的黏稠燃料，用于黑铁和深炉部件。"
        },
        blackIron: {
            name: "黑铁",
            description: "掺入焦油和煤渣反复烧出的沉重金属。"
        },
        runePlate: {
            name: "符文板",
            description: "刻入粗糙符文的黑铁板，是符文机械的基础。"
        },
        manaCrystal: {
            name: "魔晶",
            description: "带有深渊回声的晶体，用于符文和契约。"
        },
        warBanner: {
            name: "战旗",
            description: "把战利品和钢锭做成能鼓动抢掠兵的破旗。"
        },
        runeCarvingKnife: {
            name: "符文刻刀",
            description: "切刻符文板和魔晶的精细工具。"
        },
        deepFurnaceValve: {
            name: "深炉阀门",
            description: "控制深炉火力和焦油消耗的高阶部件。"
        },
        prestige: {
            name: "威望",
            description: "重置与帝国遗产相关的长期成长入口。"
        },
        abyssEcho: {
            name: "深渊回响",
            description: "从深渊门和契约中传出的终局神秘资源。"
        },
        relic: {
            name: "遗物",
            description: "远征从旧帝国和深渊裂缝中带回的稀有物。"
        },
        imperialLegacy: {
            name: "帝国遗产",
            description: "迁徙重置后保留的永久成长资源。"
        },
        riftShard: {
            name: "裂隙碎片",
            description: "挑战和裂隙工程使用的顶级资源。"
        }
    };

    // Object.<string, {name: string, description: string}> 建筑文本字典：key 为 BuildingId。
    var BUILDING_TEXT = {
        fungus_bed: {
            name: "菌菇床",
            description: "铺开潮湿菌毯，让地穴开始稳定冒出能吃的东西。"
        },
        mud_hut: {
            name: "窝棚",
            description: "歪斜但能住的泥木棚屋，提高人口上限和劳力上限。"
        },
        cave_room: {
            name: "洞室",
            description: "把潮湿岩壁凿出更稳定的居室，缓解人口扩张压力。"
        },
        barracks_cave: {
            name: "兵营洞",
            description: "把居住空间和武备堆场混在一起，提高人口和军力容量。"
        },
        spore_trench: {
            name: "孢子沟",
            description: "把菌菇孢子引到浅沟里，减少哥布林吃掉的菌菇。"
        },
        drip_channel: {
            name: "滴水渠",
            description: "让岩缝渗水流过菌床，提高菌菇生长效率。"
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
        rubble_yard: {
            name: "碎石场",
            description: "把搬来的碎石集中筛拣，提高碎石和煤渣产出。"
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
            description: "让抢掠兵互相殴打，积累军力和劳力。"
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
            description: "更坚固的高阶居所，提高人口容量和军力储备。"
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
        foraging: {
            name: "采菌",
            description: "把随手采菌变成更稳定的菌菇管理。"
        },
        digging: {
            name: "挖掘",
            description: "知道哪些石缝能挖，哪些石缝会塌。"
        },
        hut_building: {
            name: "窝棚搭建",
            description: "让窝棚不再完全靠运气站住。"
        },
        mining: {
            name: "采矿",
            description: "把搬碎石推进到真正的浅层采矿。"
        },
        metallurgy: {
            name: "冶金",
            description: "让哥布林学会维持炉火和分拣金属。"
        },
        beast_pen: {
            name: "兽栏",
            description: "把洞穴小兽从食物变成可管理的材料来源。"
        },
        crossbow: {
            name: "弓弩",
            description: "把劣质木梁和铁片拼成能吓人的远射武器。"
        },
        crude_tools: {
            name: "粗制工具",
            description: "用铁片和木梁制造能提升采集和制作的工具。"
        },
        clan_rules: {
            name: "氏族规矩",
            description: "把吼叫、惩罚和分赃写成粗糙规矩。"
        },
        census: {
            name: "人口普查",
            description: "把每个存活哥布林记进粗糙名单，方便筛选职业、特质和伤病。"
        },
        counting: {
            name: "计数",
            description: "让哥布林能数到比手指更多的东西。"
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
            description: "把战利品、骨片和恐惧献给祖灵。"
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
            description: "让魔晶、黑铁和粗识能被刻进符文板。"
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
            description: "积累劳力和军势，为后续掠夺系统准备。"
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
            description: "组织抢掠兵、战旗和战争营地，提高军力与战利品。"
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
            description: "深渊催生更多哥布林，也让每张嘴更难填饱。"
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
            description: "脆弱但会求援的地表村落，可带回劳工俘虏。"
        },
        noble_carriage: {
            name: "贵族车队",
            description: "有护卫、有账册、有贵族人质的地表车队。"
        },
        surface_barracks: {
            name: "地表军营",
            description: "装备齐整的地表驻军，战士俘虏和钢材收益都很诱人。"
        },
        ancient_ruin: {
            name: "古代遗迹",
            description: "残留魔晶和符文的危险遗迹，可能带回魔法资质者。"
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
