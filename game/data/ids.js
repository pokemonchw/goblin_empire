/* 稳定 ID 注册表：集中维护资源、建筑、科技、职业和扩展系统 ID。 */
/**
 * 初始化稳定 ID 注册表模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 ids 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * @typedef {Object} IdRegistry
     * @property {string[]} resources - 资源稳定 ID 数组；key 空间为 ResourceId。
     * @property {string[]} buildings - 建筑稳定 ID 数组；key 空间为 BuildingId。
     * @property {string[]} technologies - 科技稳定 ID 数组；key 空间为 TechnologyId。
     * @property {string[]} jobs - 职业稳定 ID 数组；key 空间为 JobId。
     * @property {string[]} policies - 政策稳定 ID 数组；key 空间为政策 ID。
     * @property {string[]} recipes - 配方稳定 ID 数组；key 空间为配方 ID。
     * @property {string[]} factions - 阵营稳定 ID 数组；key 空间为阵营 ID。
     * @property {string[]} raidTargets - 掠夺目标稳定 ID 数组；key 空间为掠夺目标 ID。
     * @property {string[]} prestigePerks - 威望天赋稳定 ID 数组；key 空间为威望天赋 ID。
     * @property {string[]} challenges - 挑战稳定 ID 数组；key 空间为挑战 ID。
     */

    // string[] 资源稳定 ID 列表：覆盖基础、工业、神秘和威望资源。
    var RESOURCE_IDS = [
        "fungus",
        "rottenWood",
        "rubble",
        "labor",
        "militaryPower",
        "crudeKnowledge",
        "obedience",
        "coalSlag",
        "ironOre",
        "ironPlate",
        "woodenBeam",
        "stoneSlab",
        "crudePickaxe",
        "reinforcedBasket",
        "sawtoothAxe",
        "blastFurnace",
        "leather",
        "boneShard",
        "coin",
        "steelIngot",
        "gear",
        "autoChute",
        "chainmail",
        "handcart",
        "overseerWhip",
        "ledger",
        "loot",
        "captive",
        "ancestralEcho",
        "tar",
        "blackIron",
        "runePlate",
        "manaCrystal",
        "warBanner",
        "runeCarvingKnife",
        "deepFurnaceValve",
        "prestige",
        "abyssEcho",
        "relic",
        "imperialLegacy",
        "riftShard"
    ];

    // string[] 建筑稳定 ID 列表：覆盖版本一到终局的主要建筑入口。
    var BUILDING_IDS = [
        "fungus_bed",
        "rotten_grove",
        "spore_trench",
        "drying_rack",
        "drip_channel",
        "mud_hut",
        "cave_room",
        "barracks_cave",
        "graffiti_wall",
        "witch_doctor_hut",
        "storage_pit",
        "wooden_storehouse",
        "shallow_mine",
        "rubble_yard",
        "charcoal_kiln",
        "artisan_shed",
        "crude_furnace",
        "beast_pen",
        "bad_wine_barrel",
        "chief_hall",
        "black_market",
        "training_pit",
        "weapon_shed",
        "captive_bed",
        "brainwash_shed",
        "ledger_room",
        "ancestral_altar",
        "underground_port",
        "tar_well",
        "deep_furnace",
        "black_iron_fortress",
        "black_iron_dwelling",
        "rune_machine_room",
        "war_camp",
        "abyss_gate",
        "sacrifice_pit",
        "void_warehouse",
        "expedition_camp",
        "rift_anchor"
    ];

    // string[] 科技稳定 ID 列表：覆盖设计文档中的阶段性科技。
    var TECHNOLOGY_IDS = [
        "marks",
        "deadwood_cultivation",
        "foraging",
        "digging",
        "hut_building",
        "woodcraft",
        "mining",
        "metallurgy",
        "charcoal_burning",
        "beast_pen",
        "crossbow",
        "crude_tools",
        "clan_rules",
        "census",
        "counting",
        "calendar",
        "engineering",
        "currency",
        "writing",
        "rituals",
        "machinery",
        "steel",
        "surface_lore",
        "diplomacy",
        "runology",
        "black_iron_smelting",
        "imperial_code",
        "abyss_mapping",
        "pact_lore",
        "rift_engineering",
        "migration_code"
    ];

    // string[] 职业稳定 ID 列表：职业人数由哥布林对象 jobId 派生。
    var JOB_IDS = [
        "woodcutter",
        "forager",
        "hauler",
        "graffiti_apprentice",
        "miner",
        "smelter",
        "raider",
        "artisan",
        "accountant",
        "overseer",
        "witch_doctor",
        "engineer",
        "rune_smith",
        "war_chief",
        "deep_miner"
    ];

    // string[] 政策稳定 ID 列表：按后续政策组引用。
    var POLICY_IDS = [
        "trade_focus",
        "raid_focus",
        "intimidation",
        "rationing",
        "deep_digging",
        "reinforcement",
        "ancestor_veneration",
        "blood_moon",
        "total_industry",
        "cave_maintenance",
        "imperial_bureaucracy",
        "warlord_autonomy"
    ];

    // string[] 配方稳定 ID 列表：工坊制作系统的可引用 key。
    var RECIPE_IDS = [
        "wooden_beam",
        "stone_slab",
        "iron_plate",
        "crude_pickaxe",
        "reinforced_basket",
        "sawtooth_axe",
        "blast_furnace",
        "steel_ingot",
        "gear",
        "auto_chute",
        "chainmail",
        "handcart",
        "overseer_whip",
        "black_iron",
        "rune_plate",
        "war_banner",
        "rune_carving_knife",
        "deep_furnace_valve"
    ];

    // string[] 阵营稳定 ID 列表：外交关系和贸易目标引用。
    var FACTION_IDS = [
        "rat_caravan",
        "gray_dwarf_mine_league",
        "lizard_swamp_clan",
        "goblin_black_market",
        "undead_lord",
        "abyss_emissary",
        "deep_gray_dwarf_court",
        "surface_border_city"
    ];

    // string[] 掠夺目标稳定 ID 列表：掠夺系统引用。
    var RAID_TARGET_IDS = [
        "fungus_farm_cave",
        "caravan_camp",
        "mine_league_outpost",
        "surface_village",
        "noble_carriage",
        "surface_barracks",
        "ancient_ruin"
    ];

    // string[] 威望天赋稳定 ID 列表：重置后永久成长引用。
    var PRESTIGE_PERK_IDS = [
        "cave_engineering",
        "old_ledger",
        "greedy_bloodline",
        "deep_instinct",
        "black_iron_tradition",
        "ancestor_memory",
        "abyss_adaptation",
        "imperial_bureaucracy"
    ];

    // string[] 挑战稳定 ID 列表：新局挑战模式引用。
    var CHALLENGE_IDS = [
        "eternal_winter_cave",
        "no_trade_empire",
        "rebellion_age",
        "poor_ore_layer",
        "no_rituals"
    ];

    // IdRegistry 稳定 ID 注册表：后续数据定义必须从这些 key 空间中取值。
    var ID_REGISTRY = {
        resources: RESOURCE_IDS,
        buildings: BUILDING_IDS,
        technologies: TECHNOLOGY_IDS,
        jobs: JOB_IDS,
        policies: POLICY_IDS,
        recipes: RECIPE_IDS,
        factions: FACTION_IDS,
        raidTargets: RAID_TARGET_IDS,
        prestigePerks: PRESTIGE_PERK_IDS,
        challenges: CHALLENGE_IDS
    };

    /**
     * 判断指定 ID 是否已登记到某个 key 空间。
     *
     * @param {string[]} allowedIds - 允许的稳定 ID 数组。
     * @param {string} candidateId - 待检查的稳定 ID 字符串。
     * @returns {boolean} 是否已登记；true 表示 candidateId 存在于 allowedIds。
     */
    function isRegisteredId(allowedIds, candidateId) {
        return allowedIds.indexOf(candidateId) !== -1;
    }

    // Object ID 模块命名空间：提供稳定 ID 列表和校验函数。
    game.ids = {
        ID_REGISTRY: ID_REGISTRY,
        isRegisteredId: isRegisteredId
    };
})(window.GoblinEmpire);
