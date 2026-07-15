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
     * @property {string[]} weather - 天气稳定 ID 数组；key 空间为 WeatherId。
     * @property {string[]} faiths - 信仰稳定 ID 数组；key 空间为 FaithDefinition.id。
     * @property {string[]} bloodlines - 血脉稳定 ID 数组；key 空间为 BloodlineDefinition.id。
     */

    // string[] 资源稳定 ID 列表：覆盖基础、工业、神秘和威望资源。
    var RESOURCE_IDS = [
        "fungus",
        "rottenWood",
        "rubble",
        "labor",
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
        "infamy",
        "goodwill",
        "captive",
        "ancestorSpirit",
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
        "weather_totem",
        "spore_sluice",
        "mud_hut",
        "cave_room",
        "barracks_cave",
        "graffiti_wall",
        "witch_doctor_hut",
        "storage_pit",
        "wooden_storehouse",
        "hauling_post",
        "shallow_mine",
        "rubble_yard",
        "charcoal_kiln",
        "artisan_shed",
        "crude_furnace",
        "pulley_gallery",
        "vent_shaft",
        "beast_pen",
        "bad_wine_barrel",
        "chief_hall",
        "black_market",
        "training_pit",
        "overseer_platform",
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
        "spore_identification",
        "mycelium_tracing",
        "safe_fungus_harvest",
        "fungus_gathering_mastery",
        "decay_grading",
        "dry_core_search",
        "vermin_probing",
        "wood_scavenging_mastery",
        "rock_sorting",
        "seam_listening",
        "braced_hauling",
        "rubble_hauling_mastery",
        "deadwood_cultivation",
        "foraging",
        "digging",
        "weather_signs",
        "hut_building",
        "labor_rosters",
        "woodcraft",
        "mining",
        "metallurgy",
        "charcoal_burning",
        "pulley_systems",
        "cave_ventilation",
        "beast_pen",
        "big_club",
        "crossbow",
        "crude_tools",
        "desire_enlightenment",
        "public_nursery",
        "human_beast",
        "clan_rules",
        "overseer_drills",
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

    // string[] 天气稳定 ID 列表：控制地穴自然波动和存档校验。
    var WEATHER_IDS = [
        "clear",
        "damp",
        "spore_rain",
        "cave_wind",
        "acid_fog",
        "lust_wind"
    ];

    // string[] 信仰稳定 ID 列表：覆盖无信仰、哥布林祖灵和非哥布林神灵。
    var FAITH_IDS = [
        "none",
        "goblin_ancestor",
        "mother_fungus",
        "stone_throne",
        "golden_river",
        "forge_sun",
        "silent_moon",
        "mirror_stars",
        "fertile_sea",
        "crimson_abyss"
    ];

    // string[] 血脉稳定 ID 列表：每条血脉都源于同名或对应神灵。
    var BLOODLINE_IDS = [
        "stone_throne",
        "golden_river",
        "forge_sun",
        "silent_moon",
        "mirror_stars",
        "fertile_sea",
        "crimson_abyss"
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
        "surface_border_city",
        "spore_crown_symbiotes"
    ];

    // string[] 掠夺目标稳定 ID 列表：掠夺系统引用。
    var RAID_TARGET_IDS = [
        "fungus_farm_cave",
        "caravan_camp",
        "mine_league_outpost",
        "surface_village",
        "noble_carriage",
        "surface_barracks",
        "ancient_ruin",
        "spore_drift_tunnel",
        "hypha_nursery",
        "spore_crown_hive"
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
        challenges: CHALLENGE_IDS,
        weather: WEATHER_IDS,
        faiths: FAITH_IDS,
        bloodlines: BLOODLINE_IDS
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
