/* 渲染模块：把 GameState 投影为三栏管理界面。 */
/**
 * 初始化渲染模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 render 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    // number 自动刷新间隔：DOM 最快刷新毫秒数，避免 tick 过密替换可点击节点。
    var AUTO_RENDER_INTERVAL_MS = 500;

    // number 上次自动刷新时间：Unix 毫秒时间戳，用于限制自动渲染频率。
    var lastAutoRenderTimestamp = 0;

    // Object.<string, string> 俘虏倾向中文名表：key 为 traitHint 稳定 ID，value 为卡片显示文本。
    var CAPTIVE_TRAIT_HINT_LABELS = {
        basic: "基础生存倾向",
        strong: "强壮战斗倾向",
        magic: "魔性符文倾向",
        craft: "工坊制作倾向",
        trade: "账册贸易倾向",
        obedient: "服从统御倾向",
        corrupted: "腐化深渊倾向"
    };

    // Object.<string, string> 属性中文名表：key 为属性稳定 ID，value 为俘虏浮窗显示文本。
    var ATTRIBUTE_LABELS = {
        strength: "强壮",
        dexterity: "灵巧",
        cunning: "狡诈",
        perception: "感知",
        will: "意志",
        attunement: "魔性"
    };

    // Object.<string, string> 技能中文名表：key 为技能稳定 ID，value 为俘虏浮窗显示文本。
    var SKILL_LABELS = {
        foraging: "采菌",
        woodcutting: "伐木",
        hauling: "搬运",
        mining: "采矿",
        smelting: "冶炼",
        crafting: "制作",
        raiding: "掠夺",
        scribing: "撰刻",
        ritual: "祭祀",
        overseeing: "监工"
    };

    /**
     * 创建一个文本节点容器。
     *
     * @param {string} tagName - HTML 标签名字符串。
     * @param {string} textContent - 要写入的中文或数字文本。
     * @returns {HTMLElement} 创建好的元素。
     */
    function createTextElement(tagName, textContent) {
        // HTMLElement 新建元素：承载指定文本。
        var element = document.createElement(tagName);

        element.textContent = textContent;
        return element;
    }

    /**
     * 向定义列表追加一行键值明细。
     *
     * @param {HTMLElement} listElement - dl 列表元素，会被追加 div/dt/dd 子节点。
     * @param {string} labelText - 明细标签中文文本。
     * @param {string} valueText - 明细值中文或数字文本。
     * @returns {void} 无返回值。
     */
    function appendDefinitionDetail(listElement, labelText, valueText) {
        // HTMLElement 明细行元素：承载一个 dt/dd 键值对。
        var rowElement = document.createElement("div");

        rowElement.appendChild(createTextElement("dt", labelText));
        rowElement.appendChild(createTextElement("dd", valueText));
        listElement.appendChild(rowElement);
    }

    /**
     * 在卡片上追加资源可用倒计时。
     *
     * @param {HTMLElement} cardElement - 卡片元素，会被追加倒计时文本。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {void} 无返回值。
     */
    function appendPriceAvailabilityText(cardElement, state, price) {
        // string 可用倒计时文本：已可支付时为空字符串。
        var availabilityText = game.resources.formatPriceAvailabilityText(state, price);

        if (availabilityText) {
            cardElement.appendChild(createTextElement("p", availabilityText));
        }
    }

    /**
     * 渲染运行状态和顶栏按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function renderTopbar(state) {
        // HTMLElement 运行状态元素：显示“运行中”或“已暂停”。
        var runStatusElement = document.getElementById("run-status");

        // HTMLButtonElement 暂停按钮元素：根据状态切换文案。
        var pauseButtonElement = document.getElementById("pause-toggle");

        runStatusElement.textContent = state.isPaused ? game.text.TEXT_REGISTRY.status.paused : game.text.TEXT_REGISTRY.status.running;
        runStatusElement.classList.toggle("is-paused", state.isPaused);
        pauseButtonElement.textContent = state.isPaused ? game.text.TEXT_REGISTRY.buttons.resume : game.text.TEXT_REGISTRY.buttons.pause;
    }

    /**
     * 渲染资源列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function renderResources(state) {
        // HTMLElement 资源列表容器：承载所有可见资源行。
        var resourceListElement = document.getElementById("resource-list");

        resourceListElement.innerHTML = "";

        // string[] 资源分组顺序：控制资源栏的固定显示次序。
        var categoryOrder = [
            "basic",
            "crafted",
            "rare",
            "mystic",
            "prestige"
        ];

        // number 分组循环索引：遍历资源分组顺序的整数下标。
        for (var categoryIndex = 0; categoryIndex < categoryOrder.length; categoryIndex += 1) {
            // string 当前资源分组 ID：用于筛选同组资源。
            var categoryId = categoryOrder[categoryIndex];

            // HTMLElement 分组容器：承载当前分组标题和资源行。
            var groupElement = document.createElement("div");

            // boolean 分组是否有可见资源：用于隐藏空分组。
            var hasVisibleResource = false;

            groupElement.className = "resource-group";
            groupElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.categories[categoryId]));

            // number 循环索引：遍历资源定义数组的整数下标。
            for (var resourceIndex = 0; resourceIndex < game.definitions.RESOURCE_DEFINITIONS.length; resourceIndex += 1) {
                // ResourceDefinition 当前资源定义：用于查找运行时状态并渲染。
                var resourceDefinition = game.definitions.RESOURCE_DEFINITIONS[resourceIndex];

                if (resourceDefinition.category !== categoryId) {
                    continue;
                }

                // ResourceState 当前资源状态：包含数量、容量、可见性和每秒变化。
                var resourceState = state.resourcesById[resourceDefinition.id];

                if (!resourceState || !resourceState.isVisible) {
                    continue;
                }

                // HTMLElement 资源行元素：显示资源名称和数值。
                var rowElement = document.createElement("div");

                rowElement.className = "resource-row";
                rowElement.tabIndex = 0;

                // boolean 是否达到容量：无容量资源不触发爆仓样式。
                var isResourceFull = Boolean(resourceDefinition.isCapacityLimited && resourceState.value >= resourceState.maxValue);

                rowElement.classList.toggle("is-full", isResourceFull);
                rowElement.appendChild(createTextElement("span", resourceDefinition.name));
                rowElement.appendChild(createTextElement("span", formatResourceValue(resourceState, resourceDefinition)));

                if (Math.abs(resourceState.perSecond) >= 0.001) {
                    // HTMLElement 每秒变化元素：用正负颜色提示资源趋势。
                    var deltaElement = createTextElement("span", formatSignedNumber(resourceState.perSecond) + "/秒");

                    deltaElement.className = resourceState.perSecond >= 0 ? "delta-positive" : "delta-negative";
                    rowElement.appendChild(deltaElement);
                }

                rowElement.appendChild(createResourceTooltip(state, resourceDefinition));
                groupElement.appendChild(rowElement);
                hasVisibleResource = true;
            }

            if (hasVisibleResource) {
                resourceListElement.appendChild(groupElement);
            }
        }
    }

    /**
     * 创建资源悬浮框。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceDefinition} resourceDefinition - 当前资源定义对象。
     * @returns {HTMLElement} 资源悬浮框元素。
     */
    function createResourceTooltip(state, resourceDefinition) {
        // ResourceFlowSummary 资源流量摘要：包含产出、消耗、加成、buff 和爆仓时间。
        var flowSummary = game.resourceFlows.analyzeResourceFlow(state, resourceDefinition.id);

        // HTMLElement 悬浮框元素：承载资源详细流量。
        var tooltipElement = document.createElement("div");

        tooltipElement.className = "resource-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", resourceDefinition.name + "明细"));

        // HTMLElement 明细列表元素：以键值形式显示流量字段。
        var listElement = document.createElement("dl");

        appendTooltipDefinition(listElement, "说明", resourceDefinition.description);
        appendTooltipDefinition(listElement, "总产出速度", formatRate(flowSummary.totalOutputPerSecond));
        appendTooltipDefinition(listElement, "产出明细", formatFlowEntries(flowSummary.outputEntries));
        if (flowSummary.totalOutputPerSecond <= 0 && resourceDefinition.id !== "labor") {
            // Object 取得路径摘要：补充手动、制作、贸易、掠夺或远征等非持续来源。
            var resourceAcquisition = game.buildingDecisions.getResourceAcquisition(state, resourceDefinition.id);

            appendTooltipDefinition(listElement, "取得方向", resourceAcquisition.text);
        }

        // boolean 是否为劳力资源：劳力浮窗只展示人口来源和建筑占用，不展示常规消耗/净产出字段。
        var isLaborResource = resourceDefinition.id === "labor";

        if (isLaborResource) {
            // LaborBreakdown 劳力摘要：用于显示人口派生来源和建筑占用明细。
            var laborBreakdown = game.population.analyzeLaborBreakdown(state);

            appendTooltipDefinition(listElement, "劳力来源", formatLaborSourceText(laborBreakdown));
            appendTooltipDefinition(listElement, "建筑占用", formatLaborUsageEntries(laborBreakdown.buildingUsageEntries));
            appendTooltipDefinition(listElement, "占用减免", formatLaborReductionText(laborBreakdown));
            appendTooltipDefinition(listElement, "生产状态", formatLaborProductionStatusText(laborBreakdown));
        }

        appendTooltipDefinition(listElement, "加成", formatBonusEntries(flowSummary.bonusEntries));
        appendTooltipDefinition(listElement, "buff 明细", flowSummary.buffTexts.length > 0 ? flowSummary.buffTexts.join("；") : "无");

        if (!isLaborResource) {
            appendTooltipDefinition(listElement, "总消耗", formatRate(flowSummary.totalConsumptionPerSecond));
            appendTooltipDefinition(listElement, "消耗明细", formatFlowEntries(flowSummary.consumptionEntries));
            appendTooltipDefinition(listElement, "最终产出", formatSignedNumber(flowSummary.finalPerSecond) + "/秒");
            appendTooltipDefinition(listElement, "库存爆仓时间", flowSummary.timeToFullText);
        }

        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 追加悬浮框定义行。
     *
     * @param {HTMLElement} listElement - 定义列表元素，会被追加一行。
     * @param {string} termText - 字段名中文文本。
     * @param {string} detailText - 字段值中文文本。
     * @returns {void} 无返回值。
     */
    function appendTooltipDefinition(listElement, termText, detailText) {
        // HTMLElement 行元素：承载一个字段的名称和值。
        var rowElement = document.createElement("div");

        // HTMLElement 字段名元素：显示悬浮框字段名称。
        var termElement = document.createElement("dt");

        // HTMLElement 字段值元素：显示悬浮框字段内容。
        var detailElement = document.createElement("dd");

        termElement.textContent = termText;
        detailElement.textContent = detailText;
        rowElement.appendChild(termElement);
        rowElement.appendChild(detailElement);
        listElement.appendChild(rowElement);
    }

    /**
     * 格式化流量条目列表。
     *
     * @param {ResourceFlowEntry[]} flowEntries - 流量条目数组；每项包含 source、amount 和 detail。
     * @returns {string} 中文流量明细文本。
     */
    function formatFlowEntries(flowEntries) {
        if (flowEntries.length === 0) {
            return "无";
        }

        // string[] 文本数组：逐项保存来源和每秒数量。
        var texts = [];

        // number 循环索引：遍历流量条目的整数下标。
        for (var entryIndex = 0; entryIndex < flowEntries.length; entryIndex += 1) {
            // ResourceFlowEntry 当前流量条目：用于格式化来源、数量和说明。
            var flowEntry = flowEntries[entryIndex];

            texts.push(flowEntry.source + " " + formatRate(flowEntry.amount) + "（" + flowEntry.detail + "）");
        }

        return texts.join("；");
    }

    /**
     * 格式化劳力来源文本。
     *
     * @param {LaborBreakdown} laborBreakdown - 劳力派生和占用摘要对象。
     * @returns {string} 劳力来源中文文本。
     */
    function formatLaborSourceText(laborBreakdown) {
        // string[] 来源文本数组：保存人口派生劳力说明。
        var sourceTexts = [];

        sourceTexts.push("存活哥布林 " + laborBreakdown.aliveGoblinCount + " x 10 = " + formatNumber(laborBreakdown.populationLabor));

        return sourceTexts.join("；");
    }

    /**
     * 格式化建筑劳力占用明细。
     *
     * @param {LaborUsageEntry[]} usageEntries - 逐建筑占用明细数组。
     * @returns {string} 建筑劳力占用中文文本。
     */
    function formatLaborUsageEntries(usageEntries) {
        if (usageEntries.length === 0) {
            return "无";
        }

        // string[] 占用文本数组：逐项保存建筑名称、启用数量和减免后占用。
        var usageTexts = [];

        // number 循环索引：遍历建筑占用条目的整数下标。
        for (var entryIndex = 0; entryIndex < usageEntries.length; entryIndex += 1) {
            // LaborUsageEntry 当前建筑占用条目：用于显示单项占用。
            var usageEntry = usageEntries[entryIndex];

            usageTexts.push(usageEntry.buildingName + " x" + usageEntry.activeCount + "：" + formatNumber(usageEntry.laborUsagePerBuilding) + "/座，合计 -" + formatNumber(usageEntry.adjustedUsage));
        }

        return usageTexts.join("；");
    }

    /**
     * 格式化建筑劳力占用减免文本。
     *
     * @param {LaborBreakdown} laborBreakdown - 劳力派生和占用摘要对象。
     * @returns {string} 建筑劳力减免中文文本。
     */
    function formatLaborReductionText(laborBreakdown) {
        if (laborBreakdown.rawBuildingUsageTotal <= 0) {
            return "无建筑占用";
        }

        if (laborBreakdown.reductionRatio <= 0) {
            return "无减免，当前占用 -" + formatNumber(laborBreakdown.adjustedBuildingUsageTotal);
        }

        return "减免前 -" + formatNumber(laborBreakdown.rawBuildingUsageTotal) + "，减免 " + Math.round(laborBreakdown.reductionRatio * 100) + "%，当前占用 -" + formatNumber(laborBreakdown.adjustedBuildingUsageTotal);
    }

    /**
     * 格式化劳力过载下的建筑生产状态。
     *
     * @param {LaborBreakdown} laborBreakdown - 劳力派生和占用摘要对象。
     * @returns {string} 建筑生产状态中文文本。
     */
    function formatLaborProductionStatusText(laborBreakdown) {
        if (laborBreakdown.isProductionLaborOverloaded) {
            return "劳力过载，除菌菇床外建筑停产";
        }

        return "劳力覆盖建筑占用";
    }

    /**
     * 格式化加成条目列表。
     *
     * @param {ResourceBonusEntry[]} bonusEntries - 加成条目数组；每项包含 label 和 value。
     * @returns {string} 中文加成明细文本。
     */
    function formatBonusEntries(bonusEntries) {
        if (bonusEntries.length === 0) {
            return "无";
        }

        // string[] 文本数组：逐项保存加成名称和值。
        var texts = [];

        // number 循环索引：遍历加成条目的整数下标。
        for (var entryIndex = 0; entryIndex < bonusEntries.length; entryIndex += 1) {
            // ResourceBonusEntry 当前加成条目：用于格式化名称和值。
            var bonusEntry = bonusEntries[entryIndex];

            texts.push(bonusEntry.label + " " + bonusEntry.value);
        }

        return texts.join("；");
    }

    /**
     * 格式化非负每秒速度。
     *
     * @param {number} amount - 每秒数量，非负浮点数。
     * @returns {string} 每秒速度文本。
     */
    function formatRate(amount) {
        return amount.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + "/秒";
    }

    /**
     * 格式化普通资源数量。
     *
     * @param {number} amount - 资源数量，非负或有符号浮点数。
     * @returns {string} 去掉多余尾零的资源数量文本。
     */
    function formatNumber(amount) {
        return amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    }

    /**
     * 格式化个体年龄。
     *
     * @param {number} ageYears - 个体年龄，单位年，非负浮点数。
     * @returns {string} 年龄显示文本，单位年；不足一年时保留一位小数。
     */
    function formatAgeYears(ageYears) {
        // number 安全年龄：收敛非法输入后的非负年数。
        var safeAgeYears = Math.max(0, Number(ageYears) || 0);

        if (safeAgeYears < 1) {
            return safeAgeYears.toFixed(1) + " 年";
        }

        return formatNumber(safeAgeYears) + " 年";
    }

    /**
     * 格式化资源数量和容量。
     *
     * @param {ResourceState} resourceState - 资源状态对象，包含当前值、容量和每秒变化。
     * @param {ResourceDefinition} resourceDefinition - 资源定义对象，用于判断是否显示容量。
     * @returns {string} 资源数量显示文本。
     */
    function formatResourceValue(resourceState, resourceDefinition) {
        if (!resourceDefinition.isCapacityLimited) {
            return resourceState.value.toFixed(1);
        }

        return resourceState.value.toFixed(1) + " / " + resourceState.maxValue.toFixed(0);
    }

    /**
     * 渲染重要状态列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function renderStatus(state) {
        // HTMLElement 状态列表容器：承载人口、空闲和暂停状态。
        var statusListElement = document.getElementById("status-list");

        // number 存活人口：从哥布林对象数组派生的非负整数。
        var aliveCount = game.population.countAliveGoblins(state);

        // number 住房上限：由建筑效果派生的非负整数。
        var housingMax = game.population.calculateHousingMax(state);

        // number 住房空位：用于提示苗床繁育后的可用居住空间。
        var freeHousing = game.population.calculateFreeHousing(state);

        // number 空闲人口：从哥布林对象 jobId 派生的非负整数。
        var idleCount = game.population.countIdleGoblins(state);

        // number 拥挤度比例：范围 0-1，用于状态栏显示。
        var crowdingRatio = game.population.calculateCrowdingRatio(state);

        // ResourceState 服从资源状态：用于显示纪律压力。
        var obedienceState = state.resourcesById.obedience;

        // string 当前天气文本：显示天气名称和剩余游戏日。
        var weatherText = game.weather ? game.weather.formatCurrentWeather(state) : "未记录";

        // string 天气影响文本：显示当前天气对生产的主要修正。
        var weatherEffectText = game.weather ? game.weather.formatWeatherEffectSummary(state) : "无生产修正";

        statusListElement.innerHTML = "";
        statusListElement.appendChild(createDefinitionRow(game.text.TEXT_REGISTRY.status.goblins, String(aliveCount)));
        statusListElement.appendChild(createDefinitionRow(game.text.TEXT_REGISTRY.status.freeGoblins, String(idleCount)));
        statusListElement.appendChild(createDefinitionRow(game.text.TEXT_REGISTRY.status.housing, freeHousing + " / " + housingMax));
        statusListElement.appendChild(createDefinitionRow("服从度", obedienceState ? obedienceState.value.toFixed(0) + " / " + obedienceState.maxValue.toFixed(0) : "未解锁"));
        statusListElement.appendChild(createDefinitionRow("天气", weatherText));
        statusListElement.appendChild(createDefinitionRow("天气影响", weatherEffectText));
        statusListElement.appendChild(createDefinitionRow(game.text.TEXT_REGISTRY.status.crowding, Math.round(crowdingRatio * 100) + "%"));
        statusListElement.appendChild(createDefinitionRow(game.text.TEXT_REGISTRY.status.tickRate, game.definitions.TICKS_PER_SECOND + " tick/秒"));
        statusListElement.appendChild(createDefinitionRow(game.text.TEXT_REGISTRY.status.calendarRate, game.calendar.getSecondsPerDay() + " 秒/天"));
        statusListElement.appendChild(createDefinitionRow(game.text.TEXT_REGISTRY.status.status, state.isPaused ? game.text.TEXT_REGISTRY.status.paused : game.text.TEXT_REGISTRY.status.running));
    }

    /**
     * 创建定义列表行。
     *
     * @param {string} termText - 左侧中文字段名。
     * @param {string} descriptionText - 右侧显示值文本。
     * @returns {HTMLElement} 定义列表行元素。
     */
    function createDefinitionRow(termText, descriptionText) {
        // HTMLElement 行元素：包装 dt 和 dd。
        var rowElement = document.createElement("div");

        // HTMLElement 字段名元素：显示状态名称。
        var termElement = document.createElement("dt");

        // HTMLElement 字段值元素：显示状态值。
        var descriptionElement = document.createElement("dd");

        termElement.textContent = termText;
        descriptionElement.textContent = descriptionText;
        rowElement.appendChild(termElement);
        rowElement.appendChild(descriptionElement);
        return rowElement;
    }

    /**
     * 渲染标签页按钮和当前内容。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function renderTabs(state) {
        // HTMLElement 标签页按钮容器：承载所有已解锁标签。
        var tabListElement = document.getElementById("tab-list");

        // HTMLElement 标签页内容容器：承载当前标签内容。
        var tabContentElement = document.getElementById("tab-content");

        tabListElement.innerHTML = "";
        tabContentElement.innerHTML = "";

        // number 循环索引：遍历标签页定义数组的整数下标。
        for (var tabIndex = 0; tabIndex < game.definitions.TAB_DEFINITIONS.length; tabIndex += 1) {
            // Object 当前标签页定义：包含 id、名称、说明和初始可见性。
            var tabDefinition = game.definitions.TAB_DEFINITIONS[tabIndex];

            if (
                !tabDefinition.isVisibleAtStart &&
                !state.tabsUnlockedById[tabDefinition.id] &&
                state.activeTabId !== tabDefinition.id
            ) {
                continue;
            }

            // HTMLButtonElement 标签按钮元素：切换当前管理视图。
            var tabButtonElement = document.createElement("button");

            tabButtonElement.type = "button";
            tabButtonElement.dataset.tabId = tabDefinition.id;
            tabButtonElement.textContent = tabDefinition.name;
            tabButtonElement.setAttribute("role", "tab");
            tabButtonElement.setAttribute("aria-selected", String(state.activeTabId === tabDefinition.id));
            tabListElement.appendChild(tabButtonElement);
        }

        renderActiveTabContent(state, tabContentElement);
    }

    /**
     * 判断当前是否应保留标签页 DOM，避免输入或点击过程中的节点被自动刷新替换。
     *
     * @returns {boolean} 是否应跳过标签页重建；true 表示当前有输入、浮窗或指针交互需要保持。
     */
    function shouldPreserveInteractiveTabDom() {
        // Element|null 当前聚焦元素：用于判断玩家是否正在搜索框输入。
        var activeElement = document.activeElement;

        // HTMLElement|null 标签页内容容器：用于判断活动元素或鼠标是否位于内容区。
        var tabContentElement = document.getElementById("tab-content");

        // HTMLElement|null 标签页按钮容器：用于保护标签切换点击过程。
        var tabListElement = document.getElementById("tab-list");

        if (activeElement && activeElement.dataset && (activeElement.dataset.censusFilterKey || activeElement.dataset.researchSearch || activeElement.dataset.buildingSearch)) {
            return true;
        }

        if (activeElement && activeElement.classList && activeElement.classList.contains("building-card")) {
            return true;
        }

        if (activeElement && activeElement.classList && activeElement.classList.contains("research-catalog-slip")) {
            return true;
        }

        // HTMLElement|null 正在悬停的建筑列表浮窗：激活期间保留列表 DOM，避免自动刷新反复销毁并重建行与浮窗。
        var activeCatalogBuildingTooltipElement = document.querySelector(".building-blueprint-entry:hover > .building-tooltip.is-tooltip-active, .building-blueprint-entry:focus-within > .building-tooltip.is-tooltip-active");

        if (activeCatalogBuildingTooltipElement) {
            return true;
        }

        // HTMLElement|null 已打开关联控制区：浮框打开期间保留研究页 DOM，直到玩家主动关闭或跳转。
        var openResearchRelationsElement = document.querySelector(".research-relations.is-open");

        if (openResearchRelationsElement) {
            return true;
        }

        if (game.runtime && game.runtime.isPointerPressingInteractiveDom) {
            return Boolean(
                (tabContentElement && tabContentElement.contains(game.runtime.pointerDownElement)) ||
                (tabListElement && tabListElement.contains(game.runtime.pointerDownElement))
            );
        }

        return false;
    }

    /**
     * 渲染当前标签页内容。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入子元素。
     * @returns {void} 无返回值。
     */
    function renderActiveTabContent(state, tabContentElement) {
        if (state.activeTabId === "tutorial") {
            renderTutorialTab(tabContentElement);
            return;
        }

        if (state.activeTabId === "clan") {
            renderClanTab(state, tabContentElement);
            return;
        }

        if (state.activeTabId === "research") {
            renderResearchTab(state, tabContentElement);
            return;
        }

        if (state.activeTabId === "workshop") {
            renderWorkshopTab(state, tabContentElement);
            return;
        }

        if (state.activeTabId === "diplomacy") {
            renderDiplomacyTab(state, tabContentElement);
            return;
        }

        if (state.activeTabId === "empire") {
            renderEmpireTab(state, tabContentElement);
            return;
        }

        if (state.activeTabId === "ritual") {
            renderRitualTab(state, tabContentElement);
            return;
        }

        if (state.activeTabId === "abyss") {
            renderAbyssTab(state, tabContentElement);
            return;
        }

        // HTMLElement 标题元素：显示当前标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.cavern.name);

        // HTMLElement 卡片元素：显示地穴页当前可管理的基础入口。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.cavernConsole));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.skeletonReady));
        cardElement.appendChild(createTextElement("p", state.isPaused ? game.text.TEXT_REGISTRY.ui.pausedHint : game.text.TEXT_REGISTRY.ui.runningHint));
        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(cardElement);

        // boolean 是否处于未开始新局：true 表示只渲染启动前的两个入口卡片。
        var isRunModeSelectionOpen = game.challengesSystem.isRunModeSelectionOpen(state);

        if (isRunModeSelectionOpen) {
            tabContentElement.appendChild(renderChallengeSelection(state));
            return;
        }

        tabContentElement.appendChild(renderCaveProfile(state));
        tabContentElement.appendChild(renderManualActions(state));
        tabContentElement.appendChild(renderBuildingActions(state));
    }

    /**
     * 渲染新手教程标签页，按第一局推进顺序展示阶段目标与操作建议。
     *
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入教程卡片。
     * @returns {void} 无返回值。
     */
    function renderTutorialTab(tabContentElement) {
        // HTMLElement 标题元素：显示新手教程标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.tutorial.name);
        // HTMLElement 引导元素：说明教程用途和实际数值来源。
        var introductionElement = createTextElement("p", "按顺序推进即可完成第一局起步。具体成本、效果与解锁条件以游戏按钮显示为准。");
        // HTMLElement 教程卡片网格：承载所有阶段说明。
        var tutorialGridElement = document.createElement("div");

        tutorialGridElement.className = "tutorial-grid";
        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(introductionElement);
        tabContentElement.appendChild(tutorialGridElement);

        // number 循环索引：遍历教程阶段的整数下标。
        for (var sectionIndex = 0; sectionIndex < game.text.TEXT_REGISTRY.tutorialSections.length; sectionIndex += 1) {
            // TutorialSectionText 当前教程阶段：包含标题、目标和操作步骤。
            var tutorialSection = game.text.TEXT_REGISTRY.tutorialSections[sectionIndex];
            // HTMLElement 教程阶段卡片：显示一个推进阶段。
            var sectionElement = document.createElement("section");
            // HTMLOListElement 操作步骤列表：按推荐顺序显示本阶段动作。
            var stepListElement = document.createElement("ol");

            sectionElement.className = "action-card tutorial-card";
            sectionElement.appendChild(createTextElement("h3", tutorialSection.title));
            sectionElement.appendChild(createTextElement("p", tutorialSection.goal));

            // number 步骤循环索引：遍历当前阶段操作建议的整数下标。
            for (var stepIndex = 0; stepIndex < tutorialSection.steps.length; stepIndex += 1) {
                // string 当前步骤文本：说明玩家下一项具体操作。
                var stepText = tutorialSection.steps[stepIndex];
                // HTMLLIElement 步骤列表项：显示单条操作建议。
                var stepItemElement = createTextElement("li", stepText);

                stepListElement.appendChild(stepItemElement);
            }

            sectionElement.appendChild(stepListElement);
            tutorialGridElement.appendChild(sectionElement);
        }
    }

    /**
     * 只重绘外交标签页内容，避免外交子标签和派出人数按钮触发整页 DOM 重建。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否完成外交页局部刷新；false 表示当前不在外交页。
     */
    function renderDiplomacyTabOnly(state) {
        if (state.activeTabId !== "diplomacy") {
            return false;
        }

        // HTMLElement|null 标签页内容容器：局部刷新时只替换中部外交工作区。
        var tabContentElement = document.getElementById("tab-content");

        if (!tabContentElement) {
            return false;
        }

        tabContentElement.innerHTML = "";
        renderDiplomacyTab(state, tabContentElement);
        return true;
    }

    /**
     * 只重绘地穴标签页内容，避免建筑筛选、分区和搜索触发资源栏与日志栏重建。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否完成地穴页局部刷新；false 表示当前不在地穴页。
     */
    function renderCavernTabOnly(state) {
        if (state.activeTabId !== "cavern") {
            return false;
        }

        // HTMLElement|null 标签页内容容器：局部刷新时只替换中部地穴工作区。
        var tabContentElement = document.getElementById("tab-content");

        if (!tabContentElement) {
            return false;
        }

        tabContentElement.innerHTML = "";
        renderActiveTabContent(state, tabContentElement);
        restoreBuildingNavigationScrollPositions();
        return true;
    }

    /**
     * 只重绘地穴页中的建设工作台，供筛选、分区、排序与搜索等纯视图操作使用。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否完成建设工作台局部刷新；false 表示当前页面没有工作台。
     */
    function renderBuildingWorkspaceOnly(state) {
        if (state.activeTabId !== "cavern") {
            return false;
        }

        // HTMLElement|null 旧建设工作台：只替换该节点，保留地穴剖面与采集区 DOM。
        var buildingWorkspaceElement = document.querySelector(".building-workspace");

        if (!buildingWorkspaceElement) {
            return false;
        }

        // HTMLElement|null 旧筛选栏：替换前保存横向滚动位置，避免筛选后跳回左侧。
        var buildingFilterElement = buildingWorkspaceElement.querySelector(".building-filter-bar");
        // HTMLElement|null 旧分区导航栏：替换前保存横向滚动位置。
        var buildingRouteElement = buildingWorkspaceElement.querySelector(".building-route-navigation");

        if (buildingFilterElement) {
            game.runtime.buildingFilterScrollLeft = buildingFilterElement.scrollLeft;
        }

        if (buildingRouteElement) {
            game.runtime.buildingRouteScrollLeft = buildingRouteElement.scrollLeft;
        }

        buildingWorkspaceElement.replaceWith(renderBuildingActions(state));
        restoreBuildingNavigationScrollPositions();
        return true;
    }

    /**
     * 只重绘建设指挥板的结果区，确保建筑搜索输入框节点、焦点与输入法组合状态保持不变。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否完成建设结果区局部刷新；false 表示当前页面没有结果区。
     */
    function renderBuildingWorkspaceResultsOnly(state) {
        if (state.activeTabId !== "cavern") {
            return false;
        }

        // HTMLElement|null 旧建设结果区：仅该节点随搜索词变化，工具栏输入框不会被替换。
        var workspaceBodyElement = document.querySelector(".building-workspace .building-command-body");

        if (!workspaceBodyElement) {
            return false;
        }

        // Object[] 全部已揭示建筑视图模型：用于生成搜索后的目录或原决策队列。
        var allViewModels = game.buildingView.collectBuildingViewModels(state);
        // HTMLElement 新建设结果区：根据当前搜索词确定目录或决策队列内容。
        var refreshedWorkspaceBodyElement = renderBuildingCommandBody(state, allViewModels);

        workspaceBodyElement.replaceWith(refreshedWorkspaceBodyElement);
        restoreBuildingNavigationScrollPositions();
        return true;
    }

    /**
     * 渲染地穴剖面视觉反馈。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 地穴剖面元素。
     */
    function renderCaveProfile(state) {
        // HTMLElement 剖面元素：根据关键建筑显示地穴阶段反馈。
        var profileElement = document.createElement("section");

        // HTMLElement 网格元素：承载阶段格子。
        var gridElement = document.createElement("div");

        profileElement.appendChild(createTextElement("h3", "地穴剖面"));
        profileElement.className = "cave-profile";
        gridElement.className = "cave-profile-grid";
        gridElement.appendChild(createCaveProfileCell("菌床", hasBuildingOwned(state, "fungus_bed")));
        gridElement.appendChild(createCaveProfileCell("窝棚", hasBuildingOwned(state, "mud_hut")));
        gridElement.appendChild(createCaveProfileCell("储物", hasBuildingOwned(state, "storage_pit")));
        gridElement.appendChild(createCaveProfileCell("涂鸦", hasBuildingOwned(state, "graffiti_wall")));
        gridElement.appendChild(createCaveProfileCell("矿井", hasBuildingOwned(state, "shallow_mine")));
        gridElement.appendChild(createCaveProfileCell("熔炉", hasBuildingOwned(state, "crude_furnace")));
        gridElement.appendChild(createCaveProfileCell("祭坛", hasBuildingOwned(state, "ancestral_altar")));
        gridElement.appendChild(createCaveProfileCell("深渊", hasBuildingOwned(state, "abyss_gate")));
        profileElement.appendChild(gridElement);
        return profileElement;
    }

    /**
     * 创建地穴剖面格子。
     *
     * @param {string} labelText - 格子中文标签。
     * @param {boolean} isActive - 是否已激活；true 表示相关建筑已拥有。
     * @returns {HTMLElement} 地穴剖面格子元素。
     */
    function createCaveProfileCell(labelText, isActive) {
        // HTMLElement 格子元素：显示一个地穴阶段。
        var cellElement = document.createElement("div");

        cellElement.className = isActive ? "cave-cell is-active" : "cave-cell";
        cellElement.textContent = labelText;
        return cellElement;
    }

    /**
     * 渲染新局模式选择。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 模式选择区块元素。
     */
    function renderChallengeSelection(state) {
        if (game.challengesSystem.isRunModeSelectionOpen(state)) {
            return renderNewRunModeCard(state);
        }

        // HTMLElement 区块元素：承载当前模式状态或新局模式按钮。
        var sectionElement = document.createElement("section");

        sectionElement.appendChild(createTextElement("h3", "新局模式"));

        if (state.challenges.activeChallengeId) {
            // ChallengeDefinition|null 当前挑战定义：用于显示挑战名称。
            var activeChallengeDefinition = game.challengesSystem.getChallengeDefinition(state.challenges.activeChallengeId);

            sectionElement.appendChild(createTextElement("p", "当前挑战：" + (activeChallengeDefinition ? activeChallengeDefinition.name : state.challenges.activeChallengeId)));
            return sectionElement;
        }

        if (state.challenges.runMode === "normal") {
            sectionElement.appendChild(createTextElement("p", "当前模式：正常模式。"));
            return sectionElement;
        }

        if (!game.challengesSystem.isFreshRun(state)) {
            sectionElement.appendChild(createTextElement("p", "当前模式：正常模式，本局未启用挑战。"));
            return sectionElement;
        }

        // HTMLElement 网格元素：承载挑战选择卡片。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";
        gridElement.appendChild(renderNormalModeCard(state));

        // number 循环索引：遍历挑战定义数组的整数下标。
        for (var challengeIndex = 0; challengeIndex < game.definitions.CHALLENGE_DEFINITIONS.length; challengeIndex += 1) {
            // ChallengeDefinition 当前挑战定义：用于渲染挑战选择卡片。
            var challengeDefinition = game.definitions.CHALLENGE_DEFINITIONS[challengeIndex];

            gridElement.appendChild(renderChallengeCard(state, challengeDefinition));
        }

        sectionElement.appendChild(gridElement);
        return sectionElement;
    }

    /**
     * 渲染未开始状态的新局模式卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 新局模式卡片元素。
     */
    function renderNewRunModeCard(state) {
        // HTMLElement 卡片元素：承载正常模式和挑战模式入口，确保未开始时只占一个卡片。
        var cardElement = document.createElement("div");

        // HTMLElement 按钮行元素：承载正常模式按钮和所有挑战按钮。
        var buttonRowElement = document.createElement("div");

        cardElement.className = "action-card";
        buttonRowElement.className = "toolbar";
        cardElement.appendChild(createTextElement("h3", "新局模式"));
        cardElement.appendChild(createTextElement("p", "选择正常模式进入标准地穴生存流程；选择挑战模式会立刻记录挑战规则和跨局奖励目标。"));
        buttonRowElement.appendChild(createNormalModeButton(state));

        // number 循环索引：遍历挑战定义数组的整数下标。
        for (var challengeIndex = 0; challengeIndex < game.definitions.CHALLENGE_DEFINITIONS.length; challengeIndex += 1) {
            // ChallengeDefinition 当前挑战定义：用于创建挑战入口按钮。
            var challengeDefinition = game.definitions.CHALLENGE_DEFINITIONS[challengeIndex];

            buttonRowElement.appendChild(createChallengeModeButton(state, challengeDefinition));
        }

        cardElement.appendChild(buttonRowElement);
        return cardElement;
    }

    /**
     * 创建正常模式选择按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLButtonElement} 正常模式按钮元素。
     */
    function createNormalModeButton(state) {
        // HTMLButtonElement 选择按钮：点击后写入本局正常模式。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.normalRunMode = "normal";
        buttonElement.textContent = "开始正常模式";
        buttonElement.disabled = state.isPaused;
        return buttonElement;
    }

    /**
     * 创建挑战模式选择按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ChallengeDefinition} challengeDefinition - 挑战定义对象。
     * @returns {HTMLButtonElement} 挑战模式按钮元素。
     */
    function createChallengeModeButton(state, challengeDefinition) {
        // HTMLButtonElement 选择按钮：点击后写入新局挑战。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.challengeId = challengeDefinition.id;
        buttonElement.textContent = challengeDefinition.name;
        buttonElement.title = "规则：" + challengeDefinition.ruleSummary + "；奖励：" + challengeDefinition.rewardSummary;
        buttonElement.disabled = state.isPaused;
        return buttonElement;
    }

    /**
     * 渲染正常模式入口卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 正常模式卡片元素。
     */
    function renderNormalModeCard(state) {
        // HTMLElement 卡片元素：承载正常模式说明和进入按钮。
        var cardElement = document.createElement("div");

        // HTMLButtonElement 选择按钮：点击后写入本局正常模式。
        var buttonElement = document.createElement("button");

        cardElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.normalRunMode = "normal";
        buttonElement.textContent = "开始正常模式";
        buttonElement.disabled = state.isPaused;
        cardElement.appendChild(createTextElement("h3", "正常模式"));
        cardElement.appendChild(createTextElement("p", "从基础地穴开始，不启用挑战惩罚，按标准资源、人口和研究节奏推进。"));
        cardElement.appendChild(createTextElement("p", "适合首次游玩、继续普通长期局，或完成迁徙后的常规重开。"));
        cardElement.appendChild(buttonElement);
        return cardElement;
    }

    /**
     * 渲染单个挑战选择卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ChallengeDefinition} challengeDefinition - 挑战定义对象。
     * @returns {HTMLElement} 挑战卡片元素。
     */
    function renderChallengeCard(state, challengeDefinition) {
        // HTMLElement 卡片元素：承载挑战规则、奖励和选择按钮。
        var cardElement = document.createElement("div");

        // HTMLButtonElement 选择按钮：点击后写入新局挑战。
        var buttonElement = document.createElement("button");

        cardElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.challengeId = challengeDefinition.id;
        buttonElement.textContent = challengeDefinition.name;
        buttonElement.disabled = state.isPaused;
        cardElement.appendChild(createTextElement("h3", challengeDefinition.name));
        cardElement.appendChild(createTextElement("p", challengeDefinition.description));
        cardElement.appendChild(createTextElement("p", "规则：" + challengeDefinition.ruleSummary));
        cardElement.appendChild(createTextElement("p", "奖励：" + challengeDefinition.rewardSummary));
        cardElement.appendChild(buttonElement);
        return cardElement;
    }

    /**
     * 渲染氏族标签页。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会在完成人口普查研究后写入人口普查。
     * @returns {void} 无返回值。
     */
    function renderClanTab(state, tabContentElement) {
        // HTMLElement 标题元素：显示氏族标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.clan.name);

        // boolean 是否已完成人口普查研究：控制普查卡片和筛选控件显示。
        var isCensusResearched = hasTechnologyResearched(state, "census");

        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(renderClanPressureSummary(state));
        tabContentElement.appendChild(renderJobControls(state));

        if (isCensusResearched) {
            appendCensusSection(state, tabContentElement);
        }

        tabContentElement.appendChild(renderCaptiveSection(state));
        tabContentElement.appendChild(renderWarbeastSection(state));
    }

    /**
     * 渲染并追加人口普查区块，只有完成人口普查研究后才会调用。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入人口普查区块。
     * @returns {void} 无返回值。
     */
    function appendCensusSection(state, tabContentElement) {
        // HTMLElement 普查区块：承载哥布林对象列表。
        var censusElement = document.createElement("section");

        censusElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.censusTitle));
        censusElement.appendChild(renderCensusFilters(state));

        if (game.population.countAliveGoblins(state) <= 0) {
            censusElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.noGoblins));
            tabContentElement.appendChild(censusElement);
            return;
        }

        // Object.<string, string> 普查筛选条件：按职业、特质和伤病过滤。
        var censusFilters = getCensusFilters(state);

        // number 匹配数量：统计筛选后的存活哥布林数量。
        var matchedCount = 0;

        // number 显示上限：无筛选时限制大人口渲染，筛选时展示更多匹配项。
        var displayLimit = hasCensusFilter(censusFilters) ? 100 : 60;

        // HTMLElement 列表元素：显示存活哥布林基础信息。
        var listElement = document.createElement("div");

        listElement.className = "action-grid";

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于渲染人口普查卡片。
            var goblin = state.goblins[goblinIndex];

            if (!goblin.isAlive || !doesGoblinMatchCensusFilters(goblin, censusFilters)) {
                continue;
            }

            matchedCount += 1;

            if (matchedCount <= displayLimit) {
                listElement.appendChild(renderGoblinCard(goblin));
            }
        }

        censusElement.appendChild(createTextElement("p", "显示 " + Math.min(matchedCount, displayLimit) + " / " + matchedCount + " 个匹配哥布林。"));
        censusElement.appendChild(listElement);
        tabContentElement.appendChild(censusElement);
    }

    /**
     * 渲染氏族人口压力摘要。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 氏族压力摘要元素。
     */
    function renderClanPressureSummary(state) {
        // HTMLElement 摘要卡片：显示人口、固定职业、伤病、劳力、服从和拥挤。
        var cardElement = document.createElement("div");

        // number 存活人口：用于人口状态摘要。
        var aliveCount = game.population.countAliveGoblins(state);

        // number 固定职业数量：统计已固定哥布林。
        var pinnedCount = countPinnedGoblins(state);

        // number 伤病数量：统计至少有一个伤病的存活哥布林。
        var woundedCount = countWoundedGoblins(state);

        // ResourceState 劳力资源状态：用于显示劳力资源。
        var laborState = state.resourcesById.labor;

        // ResourceState 服从资源状态：用于显示服从条。
        var obedienceState = state.resourcesById.obedience;

        // number 拥挤度比例：用于显示拥挤条。
        var crowdingRatio = game.population.calculateCrowdingRatio(state);

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "人口状态"));
        cardElement.appendChild(createTextElement("p", "哥布林：" + aliveCount + "，空闲：" + game.population.countIdleGoblins(state) + "，固定职业：" + pinnedCount + "，伤病：" + woundedCount));
        cardElement.appendChild(createTextElement("p", "劳力：" + (laborState ? laborState.value.toFixed(1) : "未解锁")));
        cardElement.appendChild(createProgressBar("服从度", obedienceState ? obedienceState.value / Math.max(1, obedienceState.maxValue) : 0));
        cardElement.appendChild(createProgressBar("拥挤度", crowdingRatio));
        return cardElement;
    }

    /**
     * 创建百分比进度条。
     *
     * @param {string} labelText - 进度条中文标签。
     * @param {number} ratio - 进度比例，范围建议 0-1。
     * @returns {HTMLElement} 进度条元素。
     */
    function createProgressBar(labelText, ratio) {
        // HTMLElement 容器元素：承载标签和进度条。
        var wrapperElement = document.createElement("div");

        // HTMLElement 填充元素：显示比例宽度。
        var fillElement = document.createElement("span");

        // number 钳制比例：避免异常状态撑破布局。
        var clampedRatio = Math.max(0, Math.min(1, ratio));

        wrapperElement.className = "progress-row";
        wrapperElement.appendChild(createTextElement("span", labelText + " " + Math.round(clampedRatio * 100) + "%"));
        fillElement.style.width = Math.round(clampedRatio * 100) + "%";
        wrapperElement.appendChild(fillElement);
        return wrapperElement;
    }

    /**
     * 统计固定职业哥布林数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 固定职业数量，非负整数。
     */
    function countPinnedGoblins(state) {
        // number 固定数量：统计存活且 isPinned 的哥布林。
        var pinnedCount = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于统计固定状态。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && goblin.isPinned) {
                pinnedCount += 1;
            }
        }

        return pinnedCount;
    }

    /**
     * 统计伤病哥布林数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 伤病哥布林数量，非负整数。
     */
    function countWoundedGoblins(state) {
        // number 伤病数量：统计存活且有伤病的哥布林。
        var woundedCount = 0;

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于统计伤病状态。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && goblin.wounds.length > 0) {
                woundedCount += 1;
            }
        }

        return woundedCount;
    }

    /**
     * 渲染俘虏区块。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 俘虏区块元素。
     */
    function renderCaptiveSection(state) {
        // HTMLElement 区块元素：承载俘虏列表和处置预览。
        var sectionElement = document.createElement("section");

        sectionElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.captivesTitle));

        if (state.captives.length === 0) {
            sectionElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.noCaptives));
            return sectionElement;
        }

        // HTMLElement 列表元素：承载类似资源列表的俘虏卡片行。
        var listElement = document.createElement("div");

        listElement.className = "captive-list";

        // number 循环索引：遍历俘虏数组的整数下标。
        for (var captiveIndex = 0; captiveIndex < state.captives.length; captiveIndex += 1) {
            // CaptiveState 当前俘虏：用于渲染俘虏卡片行。
            var captive = state.captives[captiveIndex];

            listElement.appendChild(renderCaptiveCard(state, captive));
        }

        sectionElement.appendChild(listElement);
        return sectionElement;
    }

    /**
     * 渲染俘虏卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CaptiveState} captive - 俘虏运行时对象。
     * @returns {HTMLElement} 俘虏卡片元素。
     */
    function renderCaptiveCard(state, captive) {
        // HTMLElement 卡片行元素：承载单个俘虏的摘要、倒计时和处置按钮。
        var cardElement = document.createElement("div");

        // CaptiveTypeDefinition|null 俘虏类型定义：用于显示中文类型名。
        var captiveTypeDefinition = game.captivesSystem.getCaptiveTypeDefinition(captive.type);

        // CaptiveQualityDefinition|null 俘虏质量定义：用于显示中文质量名。
        var qualityDefinition = game.captivesSystem.getCaptiveQualityDefinition(captive.quality);

        // string 类型显示名：包含质量和类型，用于行内第一列。
        var typeLabel = (qualityDefinition ? qualityDefinition.name : captive.quality) + " " + (captiveTypeDefinition ? captiveTypeDefinition.name : captive.type);

        // string 姓名显示名：旧状态缺失 name 时回退到稳定 ID，便于开发期定位。
        var captiveName = captive.name || captive.id;

        cardElement.className = "captive-row resource-row";
        cardElement.tabIndex = 0;

        // HTMLElement 摘要元素：显示俘虏种类和姓名。
        var summaryElement = document.createElement("div");

        summaryElement.className = "captive-summary";
        summaryElement.appendChild(createTextElement("strong", typeLabel));
        summaryElement.appendChild(createTextElement("span", captiveName));
        cardElement.appendChild(summaryElement);

        // HTMLElement 倒计时元素：显示当前 CD 或可操作状态。
        var cooldownElement = createTextElement("span", formatCaptiveCooldown(captive));

        cooldownElement.className = "captive-cooldown";
        cardElement.appendChild(cooldownElement);

        // HTMLElement 操作按钮组：固定显示三个处置入口。
        var actionsElement = document.createElement("div");

        actionsElement.className = "captive-actions";
        appendCaptiveActionButton(actionsElement, state, captive, "bed", game.text.TEXT_REGISTRY.ui.captiveBed);
        appendCaptiveActionButton(actionsElement, state, captive, "modify", game.text.TEXT_REGISTRY.ui.captiveModify);
        appendCaptiveAutoBrainwashButton(actionsElement, state, captive);
        appendCaptiveAutoBreedButton(actionsElement, state, captive);
        appendCaptiveBeastConversionButton(actionsElement, state, captive);
        appendCaptiveActionButton(actionsElement, state, captive, "food", game.text.TEXT_REGISTRY.ui.captiveFood);
        cardElement.appendChild(actionsElement);
        cardElement.appendChild(renderCaptiveTooltip(state, captive, captiveTypeDefinition, qualityDefinition));
        return cardElement;
    }

    /**
     * 渲染战兽区块。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 战兽区块元素。
     */
    function renderWarbeastSection(state) {
        // HTMLElement 区块元素：承载战兽列表和处置预览。
        var sectionElement = document.createElement("section");

        sectionElement.appendChild(createTextElement("h3", "战兽"));

        if (!Array.isArray(state.warbeasts) || state.warbeasts.length === 0) {
            sectionElement.appendChild(createTextElement("p", "暂无战兽。"));
            return sectionElement;
        }

        // HTMLElement 列表元素：承载战兽卡片行。
        var listElement = document.createElement("div");

        listElement.className = "captive-list";

        // number 循环索引：遍历战兽数组的整数下标。
        for (var warbeastIndex = 0; warbeastIndex < state.warbeasts.length; warbeastIndex += 1) {
            // WarbeastState 当前战兽：用于渲染战兽卡片。
            var warbeast = state.warbeasts[warbeastIndex];

            listElement.appendChild(renderWarbeastCard(state, warbeast));
        }

        sectionElement.appendChild(listElement);
        return sectionElement;
    }

    /**
     * 渲染战兽卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @returns {HTMLElement} 战兽卡片元素。
     */
    function renderWarbeastCard(state, warbeast) {
        // HTMLElement 卡片行元素：承载单个战兽摘要、倒计时和处置按钮。
        var cardElement = document.createElement("div");

        // WarbeastSpeciesDefinition|null 物种定义：用于显示战兽中文信息。
        var speciesDefinition = game.warbeastsSystem.getSpeciesDefinition(warbeast.speciesId);

        // string 物种显示名：包含物种和当前显示种族，便于区分战兽功能。
        var speciesLabel = (speciesDefinition ? speciesDefinition.name : warbeast.speciesId) + " / " + formatWarbeastRaceLabel(warbeast, speciesDefinition);

        cardElement.className = "captive-row resource-row";
        cardElement.tabIndex = 0;

        // HTMLElement 摘要元素：显示战兽物种和个体名。
        var summaryElement = document.createElement("div");

        summaryElement.className = "captive-summary";
        summaryElement.appendChild(createTextElement("strong", speciesLabel));
        summaryElement.appendChild(createTextElement("span", warbeast.name || warbeast.id));
        cardElement.appendChild(summaryElement);

        // HTMLElement 倒计时元素：显示驯化或苗床状态。
        var cooldownElement = createTextElement("span", formatWarbeastCooldown(warbeast));

        cooldownElement.className = "captive-cooldown";
        cardElement.appendChild(cooldownElement);

        // HTMLElement 操作按钮组：显示驯化、苗床和屠宰入口。
        var actionsElement = document.createElement("div");

        actionsElement.className = "captive-actions";
        appendWarbeastActionButton(actionsElement, state, warbeast, "tame", "驯化");
        appendWarbeastActionButton(actionsElement, state, warbeast, "breed", "作为苗床");
        appendWarbeastActionButton(actionsElement, state, warbeast, "butcher", "屠宰");
        cardElement.appendChild(actionsElement);
        cardElement.appendChild(renderWarbeastTooltip(state, warbeast, speciesDefinition));
        return cardElement;
    }

    /**
     * 追加战兽处置按钮。
     *
     * @param {HTMLElement} actionsElement - 处置按钮组元素，会被追加按钮。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @param {"tame"|"breed"|"butcher"} dispositionId - 处置方式 ID。
     * @param {string} labelText - 处置按钮中文文本。
     * @returns {void} 无返回值。
     */
    function appendWarbeastActionButton(actionsElement, state, warbeast, dispositionId, labelText) {
        // HTMLButtonElement 处置按钮：点击后执行战兽处置。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.warbeastId = warbeast.id;
        buttonElement.dataset.warbeastDisposition = dispositionId;
        buttonElement.textContent = labelText;
        buttonElement.disabled = state.isPaused || !game.warbeastsSystem.canApplyDisposition(state, warbeast, dispositionId);
        actionsElement.appendChild(buttonElement);
    }

    /**
     * 渲染战兽悬浮框。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @param {WarbeastSpeciesDefinition|null} speciesDefinition - 战兽物种定义；缺失时显示物种 ID。
     * @returns {HTMLElement} 战兽悬浮框元素。
     */
    function renderWarbeastTooltip(state, warbeast, speciesDefinition) {
        // HTMLElement 悬浮框元素：承载战兽详细信息。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表：显示驯化、口粮和苗床规则。
        var listElement = document.createElement("dl");

        // Object.<string, string|number> 驯化预览：读取本次驯化进度。
        var tamePreview = game.warbeastsSystem.previewDisposition(state, warbeast, "tame");

        // Object.<string, string|number> 苗床预览：读取孕育和休养规则。
        var breedPreview = game.warbeastsSystem.previewDisposition(state, warbeast, "breed");

        // Object.<string, string|number> 屠宰预览：读取固定菌菇收益。
        var butcherPreview = game.warbeastsSystem.previewDisposition(state, warbeast, "butcher");

        tooltipElement.className = "resource-tooltip captive-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", warbeast.name || warbeast.id));
        appendDefinitionDetail(listElement, "物种", speciesDefinition ? speciesDefinition.name : warbeast.speciesId);
        appendDefinitionDetail(listElement, "种族", formatWarbeastRaceLabel(warbeast, speciesDefinition));
        appendDefinitionDetail(listElement, "信仰", "无信仰");
        appendDefinitionDetail(listElement, "类型", speciesDefinition ? speciesDefinition.type : "未知");
        appendDefinitionDetail(listElement, "特质", speciesDefinition ? speciesDefinition.trait : "未知");
        appendDefinitionDetail(listElement, "来源", formatCaptiveSource(warbeast.source));
        appendDefinitionDetail(listElement, "说明", speciesDefinition ? speciesDefinition.description : "缺失战兽定义");
        appendDefinitionDetail(listElement, "驯化", warbeast.isTamed ? "已驯化" : Math.round(Number(warbeast.tamingProgress) || 0) + "%，本次 +" + tamePreview.tamingGain);
        appendDefinitionDetail(listElement, "口粮", formatNumber(game.warbeastsSystem.calculateFoodConsumerUnits(warbeast)) + " 口；休养时翻倍");
        appendDefinitionDetail(listElement, "苗床", breedPreview.summary + "，孕育 " + breedPreview.gestationMonths + " 个月，休养 " + breedPreview.restMonths + " 个月");
        appendDefinitionDetail(listElement, "后代偏置", speciesDefinition ? formatNumericBonusMap(speciesDefinition.attributeBonus, ATTRIBUTE_LABELS) : "未知");
        appendDefinitionDetail(listElement, "屠宰", "固定菌菇 +" + butcherPreview.fungusGain);
        appendDefinitionDetail(listElement, "状态", formatWarbeastBreedingState(warbeast));
        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 格式化战兽种族显示。
     *
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @param {WarbeastSpeciesDefinition|null} speciesDefinition - 战兽物种定义；普通战兽从中读取种族。
     * @returns {string} 战兽种族中文文本；俘虏转化战兽显示原俘虏种族并追加“(兽)”。
     */
    function formatWarbeastRaceLabel(warbeast, speciesDefinition) {
        if (warbeast.isConvertedCaptive) {
            // CaptiveRaceDefinition|null 原俘虏种族定义：用于显示转化前种族。
            var raceDefinition = game.captivesSystem.getCaptiveRaceDefinition(warbeast.originalCaptiveRaceId);

            return (raceDefinition ? raceDefinition.name : warbeast.originalCaptiveRaceId || "未知种族") + "(兽)";
        }

        return speciesDefinition ? speciesDefinition.race : "未知";
    }

    /**
     * 格式化战兽卡片行倒计时。
     *
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @returns {string} CD 中文文本；空闲时显示驯化或可行动。
     */
    function formatWarbeastCooldown(warbeast) {
        if (warbeast.breedingState === "gestating") {
            return "孕育 " + formatSecondsAsDays(warbeast.gestationSecondsRemaining) + " 天";
        }

        if (warbeast.breedingState === "resting") {
            return "休养 " + formatSecondsAsDays(warbeast.restSecondsRemaining) + " 天";
        }

        if (!warbeast.isTamed) {
            return "驯化 " + Math.round(Number(warbeast.tamingProgress) || 0) + "%";
        }

        return "可行动";
    }

    /**
     * 格式化战兽苗床状态。
     *
     * @param {WarbeastState} warbeast - 战兽运行时对象，不会被修改。
     * @returns {string} 中文状态文本。
     */
    function formatWarbeastBreedingState(warbeast) {
        if (warbeast.breedingState === "gestating") {
            return "孕育中，约 " + formatSecondsAsDays(warbeast.gestationSecondsRemaining) + " 天后产出新哥布林";
        }

        if (warbeast.breedingState === "resting") {
            return "休养中，约 " + formatSecondsAsDays(warbeast.restSecondsRemaining) + " 天后解除苗床锁定；当前口粮翻倍";
        }

        if (!warbeast.isTamed) {
            return "未驯化，需要驯化到 100% 后才能作为苗床";
        }

        return "已驯化，可作为苗床或屠宰";
    }

    /**
     * 格式化俘虏倾向提示。
     *
     * @param {string} traitHintId - 俘虏倾向稳定 ID，例如 basic、trade 或 magic。
     * @returns {string} 中文倾向显示文本；未知 ID 保留原值便于排查旧存档。
     */
    function formatCaptiveTraitHint(traitHintId) {
        // string 中文倾向名称：从显示名表读取，未命中时回退到稳定 ID。
        var traitHintLabel = CAPTIVE_TRAIT_HINT_LABELS[traitHintId];

        return traitHintLabel || traitHintId || "未知倾向";
    }

    /**
     * 格式化俘虏来源。
     *
     * @param {string} sourceId - 俘虏来源 ID 或中文事件名；掠夺来源通常为 RaidTargetDefinition.id。
     * @returns {string} 中文来源文本；未知旧存档来源保留原值便于排查。
     */
    function formatCaptiveSource(sourceId) {
        if (!sourceId) {
            return "未知来源";
        }

        if (sourceId === "captive_conversion") {
            return "俘虏转化";
        }

        // RaidTargetDefinition|null 掠夺目标定义：用于把存档中的英文目标 ID 转成中文地点名。
        var raidTargetDefinition = game.raids ? game.raids.getRaidTargetDefinition(sourceId) : null;

        if (raidTargetDefinition) {
            return raidTargetDefinition.name;
        }

        return sourceId;
    }

    /**
     * 追加俘虏处置按钮。
     *
     * @param {HTMLElement} actionsElement - 处置按钮组元素，会被追加按钮。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CaptiveState} captive - 俘虏运行时对象。
     * @param {"bed"|"modify"|"food"|"beast"} dispositionId - 处置方式 ID。
     * @param {string} labelText - 处置按钮中文文本。
     * @returns {void} 无返回值。
     */
    function appendCaptiveActionButton(actionsElement, state, captive, dispositionId, labelText) {
        // HTMLButtonElement 处置按钮：点击后执行该俘虏处置。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.captiveId = captive.id;
        buttonElement.dataset.captiveDisposition = dispositionId;
        buttonElement.textContent = labelText;
        buttonElement.disabled = state.isPaused || !game.captivesSystem.canApplyDisposition(state, captive, dispositionId);
        actionsElement.appendChild(buttonElement);
    }

    /**
     * 追加俘虏战兽转化按钮。
     *
     * @param {HTMLElement} actionsElement - 处置按钮组元素，会在科技完成后追加按钮。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CaptiveState} captive - 俘虏运行时对象。
     * @returns {void} 无返回值；未完成人即是兽时不追加按钮。
     */
    function appendCaptiveBeastConversionButton(actionsElement, state, captive) {
        if (!game.captivesSystem.hasHumanBeast(state)) {
            return;
        }

        appendCaptiveActionButton(actionsElement, state, captive, "beast", game.text.TEXT_REGISTRY.ui.captiveConvertBeast);
    }

    /**
     * 追加俘虏自动洗脑按钮。
     *
     * @param {HTMLElement} actionsElement - 处置按钮组元素，会被追加按钮。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CaptiveState} captive - 俘虏运行时对象。
     * @returns {void} 无返回值；未完成欲望启蒙时不追加按钮。
     */
    function appendCaptiveAutoBrainwashButton(actionsElement, state, captive) {
        if (!game.captivesSystem.hasDesireEnlightenment(state)) {
            return;
        }

        // HTMLButtonElement 自动洗脑按钮：只切换当前俘虏的自动洗脑开关。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.captiveAutoBrainwashId = captive.id;
        buttonElement.textContent = captive.isAutoBrainwashEnabled ? game.text.TEXT_REGISTRY.ui.captiveAutoBrainwashOn : game.text.TEXT_REGISTRY.ui.captiveAutoBrainwashOff;
        buttonElement.disabled = state.isPaused;
        actionsElement.appendChild(buttonElement);
    }

    /**
     * 追加俘虏自动培育按钮。
     *
     * @param {HTMLElement} actionsElement - 处置按钮组元素，会被追加按钮。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CaptiveState} captive - 俘虏运行时对象。
     * @returns {void} 无返回值；未完成公用苗床时不追加按钮。
     */
    function appendCaptiveAutoBreedButton(actionsElement, state, captive) {
        if (!game.captivesSystem.hasPublicNursery(state)) {
            return;
        }

        // HTMLButtonElement 自动培育按钮：只切换当前俘虏的自动培育开关。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.captiveAutoBreedId = captive.id;
        buttonElement.textContent = captive.isAutoBreedEnabled ? game.text.TEXT_REGISTRY.ui.captiveAutoBreedOn : game.text.TEXT_REGISTRY.ui.captiveAutoBreedOff;
        buttonElement.disabled = state.isPaused;
        actionsElement.appendChild(buttonElement);
    }

    /**
     * 格式化俘虏种族活跃世界。
     *
     * @param {CaptiveRaceDefinition|null} raceDefinition - 俘虏种族定义；缺失时返回未知。
     * @returns {string} 世界中文名称；找不到定义时回退世界 ID 或未知世界。
     */
    function formatCaptiveRaceWorldName(raceDefinition) {
        if (!raceDefinition) {
            return "未知世界";
        }

        // number 世界循环索引：遍历外交世界定义数组的整数下标。
        for (var worldIndex = 0; worldIndex < game.definitions.DIPLOMACY_WORLD_DEFINITIONS.length; worldIndex += 1) {
            // DiplomacyWorldDefinition 当前世界定义：用于匹配种族 worldId。
            var worldDefinition = game.definitions.DIPLOMACY_WORLD_DEFINITIONS[worldIndex];

            if (worldDefinition.id === raceDefinition.worldId) {
                return worldDefinition.name;
            }
        }

        return raceDefinition.worldId || "未知世界";
    }

    /**
     * 格式化俘虏种族主要势力。
     *
     * @param {CaptiveRaceDefinition|null} raceDefinition - 俘虏种族定义；缺失时返回未知。
     * @returns {string} 势力中文名称；找不到定义时回退势力 ID 或未知势力。
     */
    function formatCaptiveRaceFactionName(raceDefinition) {
        if (!raceDefinition) {
            return "未知势力";
        }

        // number 势力循环索引：遍历外交势力定义数组的整数下标。
        for (var factionIndex = 0; factionIndex < game.definitions.FACTION_DEFINITIONS.length; factionIndex += 1) {
            // FactionTradeDefinition 当前势力定义：用于匹配种族 factionId。
            var factionDefinition = game.definitions.FACTION_DEFINITIONS[factionIndex];

            if (factionDefinition.id === raceDefinition.factionId) {
                return factionDefinition.name;
            }
        }

        return raceDefinition.factionId || "未知势力";
    }

    /**
     * 渲染俘虏悬浮框。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @param {CaptiveTypeDefinition|null} captiveTypeDefinition - 俘虏类型定义；缺失时显示类型 ID。
     * @param {CaptiveQualityDefinition|null} qualityDefinition - 俘虏质量定义；缺失时显示质量 ID。
     * @returns {HTMLElement} 俘虏悬浮框元素。
     */
    function renderCaptiveTooltip(state, captive, captiveTypeDefinition, qualityDefinition) {
        // HTMLElement 悬浮框元素：承载俘虏详细信息。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表：按用户要求显示来源、倾向、洗脑、孕育和风险详情。
        var listElement = document.createElement("dl");

        // Object.<string, string|number> 培育预览：读取孕育成功率、失败率和继承概率。
        var bedPreview = game.captivesSystem.previewDisposition(captive, "bed", state);

        // Object.<string, string|number> 洗脑预览：读取固定菌菇消耗、洗脑提升和风险。
        var modifyPreview = game.captivesSystem.previewDisposition(captive, "modify", state);

        // CaptiveRaceDefinition|null 种族定义：用于显示俘虏来源种族和世界。
        var raceDefinition = game.captivesSystem.getCaptiveRaceDefinition(captive.raceId);

        // number 孕育成功率：0-1 浮点比例，由失败率反推。
        var breedingSuccessRate = 1 - Number(bedPreview.failureRisk || 0);

        // number 逃跑率：0-1 浮点比例，来自俘虏质量风险。
        var escapeRate = Number(modifyPreview.escapeRisk || bedPreview.escapeRisk || 0);

        // number 反抗率：0-1 浮点比例，当前沿用质量报复风险作为反抗事件风险。
        var resistanceRate = Number(modifyPreview.retaliationRisk || bedPreview.retaliationRisk || 0);

        // Price[] 洗脑固定消耗显示价格：用于判断当前菌菇是否足够。
        var brainwashPrice = [
            {
                resource: "fungus",
                amount: Number(modifyPreview.brainwashCost || 100)
            }
        ];

        // boolean 是否可支付洗脑消耗：true 表示当前菌菇库存不少于固定成本。
        var canPayBrainwash = game.resources.canAfford(state, brainwashPrice);

        tooltipElement.className = "resource-tooltip captive-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", captive.name || captive.id));
        appendDefinitionDetail(listElement, "品质", qualityDefinition ? qualityDefinition.name : captive.quality);
        appendDefinitionDetail(listElement, "种族", raceDefinition ? raceDefinition.name : (captive.raceId || "未知种族"));
        if (captive.originalRaceId) {
            // CaptiveRaceDefinition|null 原始种族定义：展示菌菇寄生前的宿主种族特质。
            var originalRaceDefinition = game.captivesSystem.getCaptiveRaceDefinition(captive.originalRaceId);

            appendDefinitionDetail(listElement, "原始所属种族", originalRaceDefinition ? originalRaceDefinition.name : captive.originalRaceId);
            if (originalRaceDefinition) {
                appendDefinitionDetail(listElement, "保留原种族属性", formatNumericBonusMap(originalRaceDefinition.attributeBonus, ATTRIBUTE_LABELS));
                appendDefinitionDetail(listElement, "保留原种族技能", formatNumericBonusMap(originalRaceDefinition.skillBonus, SKILL_LABELS));
            }
        }
        appendDefinitionDetail(listElement, "信仰", game.faithSystem.formatFaithName(captive.faithId));
        appendDefinitionDetail(listElement, "血脉", formatBloodline(captive));
        appendDefinitionDetail(listElement, "职业", captiveTypeDefinition ? captiveTypeDefinition.name : captive.type);
        if (raceDefinition) {
            appendDefinitionDetail(listElement, "活跃世界", formatCaptiveRaceWorldName(raceDefinition));
            appendDefinitionDetail(listElement, "主要势力", formatCaptiveRaceFactionName(raceDefinition));
            appendDefinitionDetail(listElement, "种族生态", raceDefinition.description);
            appendDefinitionDetail(listElement, "种族属性", formatNumericBonusMap(raceDefinition.attributeBonus, ATTRIBUTE_LABELS));
            appendDefinitionDetail(listElement, "种族技能", formatNumericBonusMap(raceDefinition.skillBonus, SKILL_LABELS));
            appendDefinitionDetail(listElement, "种族寿命", formatSignedNumber(Number(raceDefinition.lifespanYears) || 0) + " 年");
        }
        appendDefinitionDetail(listElement, "来源", formatCaptiveSource(captive.source));
        appendDefinitionDetail(listElement, "倾向", formatCaptiveTraitHint(captive.traitHint));
        appendDefinitionDetail(listElement, "额外特质", Array.isArray(captive.traits) && captive.traits.indexOf("tentacle_broodbed") !== -1 ? "触手苗床" : "无");
        appendDefinitionDetail(listElement, "年龄", formatAgeYears(captive.age));
        appendDefinitionDetail(listElement, "寿命", game.captivesSystem.calculateCaptiveTotalLifespanYears(captive) + " 年");
        appendDefinitionDetail(listElement, "寿命拆分", "基础 " + Math.floor(Number(captive.baseLifespanYears) || 0) + "，科研 " + Math.floor(Number(captive.technologyLifespanYears) || 0) + "，事件 " + Math.floor(Number(captive.eventLifespanYears) || 0) + " 年");
        appendDefinitionDetail(listElement, "洗脑程度", Math.round(Number(captive.brainwashLevel) || 0) + "%");
        if (game.captivesSystem.hasDesireEnlightenment(state)) {
            appendDefinitionDetail(listElement, "自动洗脑", captive.isAutoBrainwashEnabled ? "已开启" : "已关闭");
        }
        if (game.captivesSystem.hasPublicNursery(state)) {
            appendDefinitionDetail(listElement, "自动培育", captive.isAutoBreedEnabled ? "已开启" : "已关闭");
            appendDefinitionDetail(listElement, "培育排序值", formatNumber(game.captivesSystem.calculateCaptiveAttributeValue(captive)));
        }
        appendDefinitionDetail(listElement, "洗脑消耗", "菌菇 " + brainwashPrice[0].amount + (canPayBrainwash ? "" : "（不足）"));
        appendDefinitionDetail(listElement, "洗脑提升", "+" + modifyPreview.brainwashGain);
        appendDefinitionDetail(listElement, "孕育成功率", formatRatioAsPercent(breedingSuccessRate));
        appendDefinitionDetail(listElement, "孕育失败率", formatRatioAsPercent(bedPreview.failureRisk));
        appendDefinitionDetail(listElement, "逃跑率", formatRatioAsPercent(escapeRate));
        appendDefinitionDetail(listElement, "反抗率", formatRatioAsPercent(resistanceRate));
        appendDefinitionDetail(listElement, "继承倾向", formatRatioAsPercent(bedPreview.inheritedTraitChance));
        appendDefinitionDetail(listElement, "属性加成", "+" + bedPreview.attributeBonus);
        appendDefinitionDetail(listElement, "属性惩罚", "-" + Number(bedPreview.attributePenalty || 0));
        appendDefinitionDetail(listElement, "状态", formatCaptiveBreedingState(captive));
        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 格式化俘虏卡片行倒计时。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {string} CD 中文文本；空闲时显示可行动。
     */
    function formatCaptiveCooldown(captive) {
        if (captive.breedingState === "gestating") {
            return "CD " + formatSecondsAsDays(captive.gestationSecondsRemaining) + " 天";
        }

        if (captive.breedingState === "resting") {
            return "休养 " + formatSecondsAsDays(captive.restSecondsRemaining) + " 天";
        }

        return "可行动";
    }

    /**
     * 格式化俘虏苗床状态。
     *
     * @param {CaptiveState} captive - 俘虏运行时对象，不会被修改。
     * @returns {string} 中文状态文本。
     */
    function formatCaptiveBreedingState(captive) {
        if (captive.breedingState === "gestating") {
            return "孕育中，约 " + formatSecondsAsDays(captive.gestationSecondsRemaining) + " 天后结算";
        }

        if (captive.breedingState === "resting") {
            return "休养中，约 " + formatSecondsAsDays(captive.restSecondsRemaining) + " 天后解除培育锁定；仍可洗脑改造或做成食物";
        }

        if (Number(captive.brainwashLevel) <= 0) {
            return "洗脑程度为 0，需先洗脑改造后才能培育新生";
        }

        if (captive.disposition === "bed") {
            return "苗床空闲，可再次培育新生";
        }

        return "待处置";
    }

    /**
     * 将游戏秒数换算为天数文本。
     *
     * @param {number} secondsRemaining - 剩余游戏秒数，非负浮点数。
     * @returns {number} 剩余游戏天数，非负整数，至少为 1。
     */
    function formatSecondsAsDays(secondsRemaining) {
        // number 剩余天数：按日期系统的现实秒/游戏日口径换算。
        var daysRemaining = Math.ceil(game.calendar.calculateDaysFromSeconds(secondsRemaining));

        return Math.max(1, daysRemaining);
    }

    /**
     * 格式化俘虏处置预览。
     *
     * @param {Object.<string, string|number>} preview - 处置预览对象。
     * @returns {string} 中文预览文本。
     */
    function formatPreview(preview) {
        // string[] 预览字段文本：用于拼接收益和风险。
        var previewTexts = [];

        // string[] 预览字段键：用于遍历预览对象。
        var previewKeys = Object.keys(preview);

        // number 循环索引：遍历预览字段键的整数下标。
        for (var previewIndex = 0; previewIndex < previewKeys.length; previewIndex += 1) {
            // string 当前字段键：用于读取预览值。
            var previewKey = previewKeys[previewIndex];

            previewTexts.push(formatPreviewField(previewKey, preview[previewKey]));
        }

        return previewTexts.join("，");
    }

    /**
     * 格式化单个俘虏处置预览字段。
     *
     * @param {string} previewKey - 预览字段键，允许 summary、inheritedTraitChance、escapeRisk、retaliationRisk、failureRisk、brainwashCost、fungusGain、obedienceSwing。
     * @param {string|number} previewValue - 预览字段值；概率字段为 0-1 浮点比例，收益字段为资源数量或描述文本。
     * @returns {string} 中文字段文本。
     */
    function formatPreviewField(previewKey, previewValue) {
        if (previewKey === "summary") {
            return String(previewValue);
        }

        if (previewKey === "inheritedTraitChance") {
            return "继承倾向概率 " + formatRatioAsPercent(previewValue);
        }

        if (previewKey === "gestationMonths") {
            return "孕育 " + previewValue + " 个月";
        }

        if (previewKey === "restMonths") {
            return "休养 " + previewValue + " 个月";
        }

        if (previewKey === "brainwashLevel") {
            return "洗脑程度 " + previewValue + "%";
        }

        if (previewKey === "brainwashGain") {
            return "洗脑提升 " + previewValue;
        }

        if (previewKey === "brainwashCost") {
            return "洗脑消耗 菌菇 " + previewValue;
        }

        if (previewKey === "attributeBonus") {
            return "属性加成 +" + previewValue;
        }

        if (previewKey === "attributePenalty") {
            return "属性惩罚 -" + previewValue;
        }

        if (previewKey === "escapeRisk") {
            return "逃脱风险 " + formatRatioAsPercent(previewValue);
        }

        if (previewKey === "retaliationRisk") {
            return "报复风险 " + formatRatioAsPercent(previewValue);
        }

        if (previewKey === "failureRisk") {
            return "失败风险 " + formatRatioAsPercent(previewValue);
        }

        if (previewKey === "fungusGain") {
            return "菌菇收益 " + previewValue;
        }

        if (previewKey === "obedienceSwing") {
            return "服从波动 " + previewValue;
        }

        return previewKey + " " + previewValue;
    }

    /**
     * 将 0-1 比例格式化为百分比文本。
     *
     * @param {string|number} ratioValue - 概率或风险比例；number 时按 0-1 浮点比例处理，string 时直接转为文本。
     * @returns {string} 百分比文本；number 输入返回整数百分比。
     */
    function formatRatioAsPercent(ratioValue) {
        // number 比例数值：概率或风险的 0-1 浮点比例。
        var numericRatio = Number(ratioValue);

        if (Number.isNaN(numericRatio)) {
            return String(ratioValue);
        }

        return Math.round(numericRatio * 100) + "%";
    }

    /**
     * 渲染人口普查筛选控件基础。
     *
     * @returns {HTMLElement} 筛选控件容器。
     */
    function renderCensusFilters(state) {
        // HTMLElement 筛选容器：承载职业、特质和伤病筛选入口。
        var filterElement = document.createElement("div");

        // Object.<string, string> 普查筛选条件：用于恢复输入框文本。
        var censusFilters = getCensusFilters(state);

        filterElement.className = "toolbar";
        filterElement.appendChild(createTextElement("span", game.text.TEXT_REGISTRY.ui.censusFilters));
        filterElement.appendChild(createTextElement("span", game.text.TEXT_REGISTRY.ui.jobFilter));
        filterElement.appendChild(createFilterInput("census-job-filter", "job", censusFilters.job));
        filterElement.appendChild(createTextElement("span", game.text.TEXT_REGISTRY.ui.traitFilter));
        filterElement.appendChild(createFilterInput("census-trait-filter", "trait", censusFilters.trait));
        filterElement.appendChild(createTextElement("span", game.text.TEXT_REGISTRY.ui.woundFilter));
        filterElement.appendChild(createFilterInput("census-wound-filter", "wound", censusFilters.wound));
        return filterElement;
    }

    /**
     * 创建人口普查筛选输入框。
     *
     * @param {string} inputId - 输入框 DOM ID。
     * @param {string} filterKey - 筛选字段 key，用于保存运行时筛选文本。
     * @param {string} valueText - 当前筛选文本。
     * @returns {HTMLInputElement} 筛选输入框元素。
     */
    function createFilterInput(inputId, filterKey, valueText) {
        // HTMLInputElement 输入框元素：作为后续筛选逻辑的 UI 基础。
        var inputElement = document.createElement("input");

        inputElement.id = inputId;
        inputElement.type = "search";
        inputElement.value = valueText;
        inputElement.dataset.censusFilterKey = filterKey;
        inputElement.disabled = false;
        return inputElement;
    }

    /**
     * 读取人口普查筛选条件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {{job: string, trait: string, wound: string}} 筛选条件对象。
     */
    function getCensusFilters(state) {
        // Object|null 运行时筛选状态：只影响当前 UI，不写入存档。
        var runtimeFilters = game.runtime && game.runtime.censusFilters ? game.runtime.censusFilters : null;

        return {
            job: runtimeFilters ? runtimeFilters.job || "" : "",
            trait: runtimeFilters ? runtimeFilters.trait || "" : "",
            wound: runtimeFilters ? runtimeFilters.wound || "" : ""
        };
    }

    /**
     * 判断是否存在普查筛选条件。
     *
     * @param {{job: string, trait: string, wound: string}} censusFilters - 筛选条件对象。
     * @returns {boolean} 是否有任意筛选文本。
     */
    function hasCensusFilter(censusFilters) {
        return Boolean(censusFilters.job || censusFilters.trait || censusFilters.wound);
    }

    /**
     * 判断哥布林是否匹配普查筛选。
     *
     * @param {Goblin} goblin - 当前哥布林对象，不会被修改。
     * @param {{job: string, trait: string, wound: string}} censusFilters - 筛选条件对象。
     * @returns {boolean} 是否匹配全部非空筛选条件。
     */
    function doesGoblinMatchCensusFilters(goblin, censusFilters) {
        if (censusFilters.job && String(goblin.jobId || "空闲").indexOf(censusFilters.job) === -1) {
            return false;
        }

        if (censusFilters.trait && goblin.traits.join("，").indexOf(censusFilters.trait) === -1) {
            return false;
        }

        if (censusFilters.wound && goblin.wounds.join("，").indexOf(censusFilters.wound) === -1) {
            return false;
        }

        return true;
    }

    /**
     * 渲染研究标签页。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入研究列表。
     * @returns {void} 无返回值。
     */
    function renderResearchTab(state, tabContentElement) {
        // HTMLElement 标题元素：显示研究标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.research.name);

        // HTMLElement 研究工作台元素：采用与建筑列表一致的稳定目录和固定检查器。
        var workspaceElement = document.createElement("section");

        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(renderResearchSummary(state));
        workspaceElement.className = "research-workspace";
        workspaceElement.appendChild(renderResearchControls());
        workspaceElement.appendChild(renderResearchCommandBody(state));
        tabContentElement.appendChild(workspaceElement);
    }

    /**
     * 只替换研究目录结果与检查器，确保搜索输入框原节点、焦点和输入法组合状态不变。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否完成研究工作台局部刷新；false 表示当前页面没有研究结果区。
     */
    function renderResearchWorkspaceResultsOnly(state) {
        if (state.activeTabId !== "research") {
            return false;
        }

        // HTMLElement|null 旧研究结果区：搜索和筛选只能替换这一最小容器。
        var commandBodyElement = document.querySelector(".research-workspace .research-command-body");

        if (!commandBodyElement) {
            return false;
        }

        commandBodyElement.replaceWith(renderResearchCommandBody(state));
        return true;
    }

    /**
     * 只更新研究签选中态和固定检查器，避免选择科技时重建完整六路线目录。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyId} selectedTechnologyId - 新选择的科技稳定 ID。
     * @returns {boolean} 是否完成选择局部刷新；false 表示目标未渲染或检查器不存在。
     */
    function renderResearchSelectionOnly(state, selectedTechnologyId) {
        if (state.activeTabId !== "research") {
            return false;
        }

        // HTMLButtonElement|null 旧选中研究签：需要移除当前态并恢复其快速详情浮窗。
        var previousSlipElement = document.querySelector(".research-catalog-slip[aria-current=\"true\"]");
        // HTMLButtonElement|null 新选中研究签：只更新该节点，不重建目录。
        var selectedSlipElement = document.querySelector(".research-catalog-slip[data-research-select-id=\"" + selectedTechnologyId + "\"]");
        // HTMLElement|null 旧固定检查器：将被单独替换为新选择的详情。
        var inspectorElement = document.querySelector(".research-workspace .research-inspector");

        if (!selectedSlipElement || !inspectorElement) {
            return false;
        }

        if (previousSlipElement && previousSlipElement !== selectedSlipElement) {
            // TechnologyId 旧选中科技 ID：用于恢复该研究签的快速详情浮窗。
            var previousTechnologyId = previousSlipElement.dataset.researchSelectId;
            // TechnologyDefinition|null 旧选中科技定义：定义存在时生成浮窗。
            var previousTechnologyDefinition = game.technology.getTechnologyDefinition(previousTechnologyId);
            // HTMLElement|null 旧研究签条目：作为恢复浮窗的父容器。
            var previousEntryElement = previousSlipElement.closest(".research-slip-entry");

            previousSlipElement.setAttribute("aria-current", "false");
            if (previousTechnologyDefinition && previousEntryElement && !previousEntryElement.querySelector(".research-tooltip")) {
                previousEntryElement.appendChild(createResearchSlipTooltip(state, previousTechnologyDefinition, getTechnologyResearchStatus(state, previousTechnologyDefinition)));
            }
        }

        // HTMLElement|null 新研究签条目：选中项依赖检查器，不保留重复浮窗。
        var selectedEntryElement = selectedSlipElement.closest(".research-slip-entry");
        // HTMLElement|null 新研究签旧浮窗：存在时移除，避免与固定检查器重复。
        var selectedTooltipElement = selectedEntryElement ? selectedEntryElement.querySelector(".research-tooltip") : null;

        selectedSlipElement.setAttribute("aria-current", "true");
        if (selectedTooltipElement) {
            selectedTooltipElement.remove();
        }
        inspectorElement.replaceWith(renderResearchInspector(state));
        return true;
    }

    /**
     * 在科技图谱插入页面并取得真实宽度后恢复各路线的横向滚动位置。
     *
     * @param {HTMLElement} graphElement - 已连接到页面的科技图谱容器。
     * @returns {void} 无返回值；会按 ResearchLineId 修改各路线的 scrollLeft。
     */
    function restoreResearchLaneScrollPositions(graphElement) {
        // NodeListOf<HTMLElement> 科研路线元素列表：每条路线独立恢复自己的滚动像素值。
        var laneElements = graphElement.querySelectorAll(".research-lane[data-research-line-scroll-id]");

        // number 路线循环索引：遍历当前可见的科研分类卡片。
        for (var laneIndex = 0; laneIndex < laneElements.length; laneIndex += 1) {
            // HTMLElement 科研路线元素：从 dataset 读取稳定路线 ID。
            var laneElement = laneElements[laneIndex];

            // number 路线横向滚动位置：运行时保存的非负 CSS 像素值。
            var savedLaneScrollLeft = game.runtime.researchScrollLeftByLineId && game.runtime.researchScrollLeftByLineId[laneElement.dataset.researchLineScrollId];

            laneElement.scrollLeft = Number(savedLaneScrollLeft) || 0;
        }
    }

    /**
     * 按当前可见科技节点的真实前置关系绘制图谱连线。
     *
     * @param {HTMLElement} graphElement - 已插入页面的研究图谱容器，会追加一层 SVG 连线画布。
     * @returns {void} 无返回值。
     */
    function renderResearchConnections(graphElement) {
        // SVGSVGElement|null 旧连线画布：路线独立滚动后重绘前先移除，避免重复叠加。
        var existingConnectionCanvasElement = graphElement.querySelector(".research-connections");

        if (existingConnectionCanvasElement) {
            existingConnectionCanvasElement.remove();
        }

        // string SVG 命名空间：用于创建可随图谱滚动的矢量连线元素。
        var svgNamespace = "http://www.w3.org/2000/svg";

        // DOMRect 图谱边界：作为节点视口坐标转换为图谱内容坐标的原点。
        var graphBounds = graphElement.getBoundingClientRect();

        // SVGSVGElement 连线画布：覆盖完整可滚动内容，但不拦截卡片交互。
        var connectionCanvasElement = document.createElementNS(svgNamespace, "svg");

        connectionCanvasElement.classList.add("research-connections");
        connectionCanvasElement.setAttribute("width", String(graphElement.scrollWidth));
        connectionCanvasElement.setAttribute("height", String(graphElement.scrollHeight));
        connectionCanvasElement.setAttribute("aria-hidden", "true");

        // number 科技循环索引：遍历全部静态科技定义并寻找当前同时可见的父子节点。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 子科技定义：其前置数组决定需要绘制的真实连接。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            // HTMLElement|null 子科技卡片：筛选或渐进揭示隐藏节点时为空。
            var childCardElement = document.getElementById("research-node-" + technologyDefinition.id);

            if (!childCardElement || !graphElement.contains(childCardElement)) {
                continue;
            }

            // TechnologyId[] 父科技 ID 数组：包含必须全部完成和任选其一两类真实科技前置。
            var parentTechnologyIds = technologyDefinition.prerequisiteTechnologyIds.concat(technologyDefinition.alternativePrerequisiteTechnologyIds);

            // number 父科技循环索引：逐条绘制当前视图中存在的父子关系。
            for (var parentIndex = 0; parentIndex < parentTechnologyIds.length; parentIndex += 1) {
                // TechnologyId 父科技 ID：用于定位连线起点卡片。
                var parentTechnologyId = parentTechnologyIds[parentIndex];

                // HTMLElement|null 父科技卡片：父节点未揭示或被筛选掉时不绘制误导性短线。
                var parentCardElement = document.getElementById("research-node-" + parentTechnologyId);

                if (!parentCardElement || !graphElement.contains(parentCardElement)) {
                    continue;
                }

                // boolean 是否任选前置：true 使用虚线，表达任一父节点完成即可。
                var isAlternativePrerequisite = technologyDefinition.alternativePrerequisiteTechnologyIds.indexOf(parentTechnologyId) !== -1;

                connectionCanvasElement.appendChild(createResearchConnectionPath(svgNamespace, graphElement, graphBounds, parentCardElement, childCardElement, isAlternativePrerequisite));
            }
        }

        graphElement.prepend(connectionCanvasElement);
    }

    /**
     * 在单条科研路线横向滚动后重绘节点连线。
     *
     * @param {Event} event - 路线滚动事件；target 必须是所属研究泳道元素。
     * @returns {void} 无返回值；会在下一动画帧替换图谱连线画布。
     */
    function refreshResearchConnectionsAfterLaneScroll(event) {
        // HTMLElement|null 滚动路线元素：用于定位所属科技图谱。
        var laneElement = event.target;

        // HTMLElement|null 图谱元素：承载全部路线和连线画布。
        var graphElement = laneElement && laneElement.closest ? laneElement.closest(".research-graph") : null;

        if (!graphElement || game.runtime.isResearchConnectionRefreshQueued) {
            return;
        }

        game.runtime.isResearchConnectionRefreshQueued = true;
        window.requestAnimationFrame(function () {
            game.runtime.isResearchConnectionRefreshQueued = false;
            renderResearchConnections(graphElement);
        });
    }

    /**
     * 创建一条连接父科技卡片与子科技卡片的曲线路径。
     *
     * @param {string} svgNamespace - SVG 元素命名空间字符串。
     * @param {HTMLElement} graphElement - 研究图谱容器，用于读取当前滚动偏移。
     * @param {DOMRect} graphBounds - 图谱视口边界，作为内容坐标原点。
     * @param {HTMLElement} parentCardElement - 父科技卡片，作为路径起点。
     * @param {HTMLElement} childCardElement - 子科技卡片，作为路径终点。
     * @param {boolean} isAlternativePrerequisite - true 表示任选前置并绘制虚线，false 表示必需前置。
     * @returns {SVGPathElement} 可追加到研究连线画布的路径元素。
     */
    function createResearchConnectionPath(svgNamespace, graphElement, graphBounds, parentCardElement, childCardElement, isAlternativePrerequisite) {
        // DOMRect 父卡片边界：用于计算路径起点。
        var parentBounds = parentCardElement.getBoundingClientRect();

        // DOMRect 子卡片边界：用于计算路径终点。
        var childBounds = childCardElement.getBoundingClientRect();

        // boolean 是否适合横向连接：子卡片左边缘位于父卡片右边缘之后。
        var isForwardConnection = childBounds.left >= parentBounds.right;

        // number 起点横坐标：横向连接取父卡右边缘，否则取父卡水平中心，单位为 CSS 像素。
        var startX = (isForwardConnection ? parentBounds.right : parentBounds.left + parentBounds.width / 2) - graphBounds.left + graphElement.scrollLeft;

        // number 起点纵坐标：横向连接取父卡垂直中心，否则取父卡下边缘，单位为 CSS 像素。
        var startY = (isForwardConnection ? parentBounds.top + parentBounds.height / 2 : parentBounds.bottom) - graphBounds.top + graphElement.scrollTop;

        // number 终点横坐标：横向连接取子卡左边缘，否则取子卡水平中心，单位为 CSS 像素。
        var endX = (isForwardConnection ? childBounds.left : childBounds.left + childBounds.width / 2) - graphBounds.left + graphElement.scrollLeft;

        // number 终点纵坐标：横向连接取子卡垂直中心，否则取子卡上边缘，单位为 CSS 像素。
        var endY = (isForwardConnection ? childBounds.top + childBounds.height / 2 : childBounds.top) - graphBounds.top + graphElement.scrollTop;

        // number 控制点中轴：让路径在卡片间隙内平滑转向，单位为 CSS 像素。
        var controlAxis = isForwardConnection ? (startX + endX) / 2 : (startY + endY) / 2;

        // string SVG 路径指令：横向跨时代与纵向同列关系分别使用对应方向的三次贝塞尔曲线。
        var pathCommands = isForwardConnection
            ? "M " + startX + " " + startY + " C " + controlAxis + " " + startY + ", " + controlAxis + " " + endY + ", " + endX + " " + endY
            : "M " + startX + " " + startY + " C " + startX + " " + controlAxis + ", " + endX + " " + controlAxis + ", " + endX + " " + endY;

        // SVGPathElement 连线路径：通过 class 区分必需前置和任选前置样式。
        var pathElement = document.createElementNS(svgNamespace, "path");

        pathElement.setAttribute("d", pathCommands);
        pathElement.setAttribute("class", "research-connection" + (isAlternativePrerequisite ? " is-alternative" : ""));
        return pathElement;
    }

    /**
     * 渲染研究资源和线路摘要。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 研究摘要元素。
     */
    function renderResearchSummary(state) {
        // HTMLElement 摘要元素：承载研究资源和线路计数。
        var summaryElement = document.createElement("div");

        // ResearchEraDefinition 当前研究时代：由已完成科技的最深时代计算，只用于进度叙事。
        var currentEraDefinition = getCurrentResearchEra(state);

        // number 已完成科技数量：用于顶部总进度摘要的非负整数。
        var researchedCount = getResearchedTechnologyCount(state);

        summaryElement.className = "action-card research-overview";
        summaryElement.appendChild(createTextElement("h3", "研究总览 · " + currentEraDefinition.name));
        summaryElement.appendChild(createTextElement("p", "粗识：" + formatResearchResourceWithFlow(state, "crudeKnowledge") + "，账册：" + formatResearchResourceWithFlow(state, "ledger") + "，魔晶：" + formatResearchResourceWithFlow(state, "manaCrystal")));
        summaryElement.appendChild(createTextElement("p", "已完成 " + researchedCount + " / " + game.definitions.TECHNOLOGY_DEFINITIONS.length + " 项科技。" + getResearchRecommendation(state)));
        return summaryElement;
    }

    /**
     * 渲染研究筛选与排序控件。
     *
     * @returns {HTMLElement} 研究控件元素。
     */
    function renderResearchControls() {
        // HTMLElement 控件元素：常驻搜索框不随研究结果刷新重建。
        var controlsElement = document.createElement("div");

        controlsElement.className = "research-command-toolbar";

        // HTMLInputElement 搜索输入框：按科技名称、介绍和效果标签过滤，不改变科技状态。
        var searchInputElement = document.createElement("input");

        searchInputElement.type = "search";
        searchInputElement.className = "game-search-input";
        searchInputElement.placeholder = "搜索科技";
        searchInputElement.value = game.runtime.researchSearchText || "";
        searchInputElement.dataset.researchSearch = "true";
        searchInputElement.setAttribute("aria-label", "搜索科技名称或效果");
        controlsElement.appendChild(searchInputElement);
        // HTMLButtonElement 图鉴切换按钮：在有限决策队列与完整六路线目录之间切换。
        var catalogButtonElement = document.createElement("button");

        catalogButtonElement.type = "button";
        catalogButtonElement.dataset.researchCatalogToggle = "true";
        catalogButtonElement.textContent = game.runtime.researchViewId === "catalog" ? "返回决策队列" : "打开研究图鉴";
        controlsElement.appendChild(catalogButtonElement);
        return controlsElement;
    }

    /**
     * 渲染研究目录筛选、稳定路线列表和固定检查器。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 研究结果与检查器共同容器。
     */
    function renderResearchCommandBody(state) {
        // HTMLElement 结果容器元素：是搜索输入允许替换的最小刷新边界。
        var bodyElement = document.createElement("div");
        // HTMLElement 目录列元素：承载筛选和六条稳定路线。
        var catalogElement = document.createElement("div");
        // TechnologyDefinition[] 匹配科技数组：只含已揭示且符合筛选的科技。
        var visibleTechnologies = getVisibleResearchTechnologies(state);

        ensureSelectedResearchTechnology(state);
        bodyElement.className = "research-command-body";
        catalogElement.className = "research-catalog";
        // boolean 是否显示完整图鉴：搜索始终进入图鉴，清空后恢复玩家选择的视图。
        var isCatalogVisible = Boolean((game.runtime.researchSearchText || "").trim()) || game.runtime.researchViewId === "catalog";

        if (isCatalogVisible) {
            catalogElement.appendChild(renderResearchCatalogFilters());
            catalogElement.appendChild(renderResearchCatalog(state, visibleTechnologies));
        } else {
            catalogElement.appendChild(renderResearchDecisionQueue(state));
        }
        bodyElement.appendChild(catalogElement);
        bodyElement.appendChild(renderResearchInspector(state));
        return bodyElement;
    }

    /**
     * 渲染研究决策队列；队列只提供有限选择，不直接执行研究。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 含当前目标、可立即研究和需处理三个区段的队列元素。
     */
    function renderResearchDecisionQueue(state) {
        // HTMLElement 队列元素：承载三个固定区段。
        var queueElement = document.createElement("div");
        // ResearchQueueSnapshot 决策快照：由独立系统诊断知识经济、依赖和推进收益。
        var queueSnapshot = game.researchDecisions.getResearchQueueSnapshot(state, game.runtime.researchDecisionRuntime, Date.now());

        queueElement.className = "research-decision-queue";
        queueElement.appendChild(createTextElement("p", "研究参谋按知识经济、依赖距离、系统收益与路线覆盖给出有限选择；不会自动花费资源。"));
        appendResearchDecisionSection(queueElement, state, "当前目标", queueSnapshot.target, "暂无可由现有来源稳定到达的主目标；可先处理阻断或选择立即研究项。");
        appendResearchDecisionSection(queueElement, state, "可立即研究", queueSnapshot.available, "当前没有资源与前置均齐备的科技。");
        appendResearchDecisionSection(queueElement, state, "先处理", queueSnapshot.attention, "当前没有容量、来源或依赖阻断需要处理。");
        return queueElement;
    }

    /**
     * 向研究决策队列追加一个固定区段。
     *
     * @param {HTMLElement} queueElement - 队列父元素，会被追加内容。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} title - 区段中文标题。
     * @param {ResearchDecisionProfile[]} decisionProfiles - 本区段科技决策档案数组。
     * @param {string} emptyText - 空区段说明文案。
     * @returns {void} 无返回值；会修改 queueElement 子节点。
     */
    function appendResearchDecisionSection(queueElement, state, title, decisionProfiles, emptyText) {
        // HTMLElement 区段元素：包含标题与研究签列表。
        var sectionElement = document.createElement("section");
        // HTMLElement 列表元素：复用研究签的视觉和选择行为。
        var listElement = document.createElement("div");

        sectionElement.className = "research-decision-section";
        sectionElement.appendChild(createTextElement("h4", title + "　" + decisionProfiles.length));
        listElement.className = "research-catalog-list";
        // number 科技循环索引：按决策顺序生成研究签。
        for (var technologyIndex = 0; technologyIndex < decisionProfiles.length; technologyIndex += 1) {
            // ResearchDecisionProfile 当前决策档案：签面后追加推荐理由与唯一瓶颈。
            var decisionProfile = decisionProfiles[technologyIndex];
            // HTMLElement 研究签条目：复用图鉴的完整选择、焦点与浮窗行为。
            var slipEntryElement = renderResearchCatalogSlip(state, decisionProfile.definition);
            // HTMLButtonElement|null 研究签按钮：理由放入同一可聚焦节点，确保键盘和读屏能读取。
            var slipButtonElement = slipEntryElement.querySelector(".research-catalog-slip");
            // HTMLElement 推荐说明：占据签面整行并使用共享次要文本样式。
            var decisionExplanationElement = createTextElement("small", decisionProfile.reasonText + " " + decisionProfile.bottleneckText);

            decisionExplanationElement.className = "research-decision-explanation";
            if (slipButtonElement) { slipButtonElement.appendChild(decisionExplanationElement); }
            listElement.appendChild(slipEntryElement);
        }
        if (decisionProfiles.length <= 0) { listElement.appendChild(createTextElement("p", emptyText)); }
        sectionElement.appendChild(listElement);
        queueElement.appendChild(sectionElement);
    }

    /**
     * 在当前已揭示科技中保证固定检查器存在有效选择。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {void} 无返回值；可能修改运行时 selectedResearchTechnologyId。
     */
    function ensureSelectedResearchTechnology(state) {
        // TechnologyDefinition[] 已揭示科技数组：不受当前搜索和筛选影响。
        var revealedTechnologies = getAllRevealedResearchTechnologies(state);
        // TechnologyDefinition|null 原选择定义：用于判断上次选择是否仍已揭示。
        var selectedTechnologyDefinition = game.technology.getTechnologyDefinition(game.runtime.selectedResearchTechnologyId || "");

        if (selectedTechnologyDefinition && getTechnologyResearchStatus(state, selectedTechnologyDefinition) !== "unknown") {
            return;
        }

        // TechnologyDefinition|null 默认选择：依次取可研究、等待资源和稳定顺序第一项。
        var defaultTechnologyDefinition = revealedTechnologies.find(function (technologyDefinition) { return getTechnologyResearchStatus(state, technologyDefinition) === "available"; }) ||
            revealedTechnologies.find(function (technologyDefinition) { return getTechnologyResearchStatus(state, technologyDefinition) === "unaffordable"; }) || revealedTechnologies[0];

        game.runtime.selectedResearchTechnologyId = defaultTechnologyDefinition ? defaultTechnologyDefinition.id : "";
    }

    /**
     * 取得全部已揭示科技并按路线、层级和布局字段稳定排序。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {TechnologyDefinition[]} 不包含 unknown 状态的科技定义数组。
     */
    function getAllRevealedResearchTechnologies(state) {
        // TechnologyDefinition[] 已揭示科技数组：保持静态路线内顺序。
        var revealedTechnologies = game.definitions.TECHNOLOGY_DEFINITIONS.filter(function (technologyDefinition) {
            return getTechnologyResearchStatus(state, technologyDefinition) !== "unknown";
        });

        revealedTechnologies.sort(function (leftTechnology, rightTechnology) {
            return getResearchLineOrder(leftTechnology.lineId) - getResearchLineOrder(rightTechnology.lineId) || leftTechnology.tier - rightTechnology.tier || leftTechnology.layoutOrder - rightTechnology.layoutOrder;
        });
        return revealedTechnologies;
    }

    /**
     * 渲染研究目录的五态筛选与里程碑开关。
     *
     * @returns {HTMLElement} 研究筛选栏元素。
     */
    function renderResearchCatalogFilters() {
        // HTMLElement 筛选栏元素：筛选只改变目录可见集合。
        var filterElement = document.createElement("div");
        // Object.<string, string> 筛选文案字典：key 为受控研究状态，value 为中文按钮名。
        var filterLabelById = { all: "全部", available: "可研究", unaffordable: "等待资源", preview: "前置受阻", researched: "已完成" };
        // string[] 筛选 ID 数组：定义固定展示顺序。
        var filterIds = ["all", "available", "unaffordable", "preview", "researched"];

        filterElement.className = "research-catalog-filters";
        // number 筛选循环索引：生成五个固定状态按钮。
        for (var filterIndex = 0; filterIndex < filterIds.length; filterIndex += 1) {
            // string 当前筛选 ID：绑定视图状态与选中语义。
            var filterId = filterIds[filterIndex];
            // HTMLButtonElement 筛选按钮：点击后局部替换结果区。
            var filterButtonElement = createResearchButton("researchFilter", filterId, filterLabelById[filterId]);

            filterButtonElement.setAttribute("aria-pressed", String((game.runtime.researchFilter || "all") === filterId));
            filterElement.appendChild(filterButtonElement);
        }
        // HTMLButtonElement 里程碑开关：与状态筛选组合使用。
        var milestoneButtonElement = createResearchButton("researchMilestoneToggle", "true", game.runtime.isResearchMilestoneOnly ? "✓ 仅里程碑" : "仅里程碑");

        milestoneButtonElement.setAttribute("aria-pressed", String(Boolean(game.runtime.isResearchMilestoneOnly)));
        filterElement.appendChild(milestoneButtonElement);
        return filterElement;
    }

    /**
     * 渲染按六路线分区的单列研究目录。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition[]} visibleTechnologies - 已通过状态、里程碑和搜索筛选的科技数组。
     * @returns {HTMLElement} 六路线研究目录或空态元素。
     */
    function renderResearchCatalog(state, visibleTechnologies) {
        // HTMLElement 路线容器元素：承载稳定分区列表。
        var routesElement = document.createElement("div");

        routesElement.className = "research-route-groups";
        if (visibleTechnologies.length <= 0) {
            routesElement.appendChild(createTextElement("p", "当前搜索与筛选条件下没有已揭示科技。"));
            return routesElement;
        }

        // number 路线循环索引：按静态研究路线顺序生成分区。
        for (var lineIndex = 0; lineIndex < game.definitions.RESEARCH_LINE_DEFINITIONS.length; lineIndex += 1) {
            // ResearchLineDefinition 当前路线定义：提供名称、说明和颜色类。
            var lineDefinition = game.definitions.RESEARCH_LINE_DEFINITIONS[lineIndex];
            // TechnologyDefinition[] 当前路线科技数组：继承上游稳定顺序。
            var lineTechnologies = visibleTechnologies.filter(function (technologyDefinition) { return technologyDefinition.lineId === lineDefinition.id; });

            if (lineTechnologies.length <= 0) {
                continue;
            }

            // HTMLElement 路线区块元素：包含路线标题和单列研究签。
            var routeElement = document.createElement("section");
            // HTMLElement 研究签列表元素：每行一项科技。
            var listElement = document.createElement("div");

            routeElement.className = "research-catalog-route " + lineDefinition.colorToken;
            routeElement.appendChild(createTextElement("h4", lineDefinition.name + "　" + lineTechnologies.length + " 项匹配"));
            routeElement.appendChild(createTextElement("p", lineDefinition.description));
            listElement.className = "research-catalog-list";
            // number 科技循环索引：按层级与布局顺序生成研究签。
            for (var technologyIndex = 0; technologyIndex < lineTechnologies.length; technologyIndex += 1) {
                listElement.appendChild(renderResearchCatalogSlip(state, lineTechnologies[technologyIndex]));
            }
            routeElement.appendChild(listElement);
            routesElement.appendChild(routeElement);
        }
        return routesElement;
    }

    /**
     * 渲染只负责选择的单列研究签，研究操作留在固定检查器。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {HTMLElement} 研究签与可选详情浮窗容器。
     */
    function renderResearchCatalogSlip(state, technologyDefinition) {
        // HTMLElement 条目容器：为未选中科技承载浮窗。
        var entryElement = document.createElement("div");
        // HTMLButtonElement 研究签按钮：点击只改变检查器选择。
        var slipElement = document.createElement("button");
        // string 当前研究状态：决定状态字形和行动结论。
        var researchStatus = getTechnologyResearchStatus(state, technologyDefinition);
        // boolean 是否预览：true 时不得显示价格、缺口或解锁数值。
        var isPreview = researchStatus === "preview";

        entryElement.className = "research-slip-entry";
        slipElement.type = "button";
        slipElement.className = "research-catalog-slip " + technologyDefinition.lineId + " is-" + researchStatus;
        slipElement.dataset.researchSelectId = technologyDefinition.id;
        slipElement.setAttribute("aria-current", String(game.runtime.selectedResearchTechnologyId === technologyDefinition.id));
        slipElement.innerHTML = "<span aria-hidden=\"true\">" + getResearchStatusSymbol(researchStatus) + "</span>" +
            "<strong>" + technologyDefinition.name + "</strong>" +
            "<span>" + getResearchStatusLabel(researchStatus) + "</span>" +
            "<small>" + getResearchEraName(technologyDefinition.eraId) + " · T" + technologyDefinition.tier + " · " + technologyDefinition.effectTags[0] + "</small>" +
            "<small>" + (isPreview ? formatTechnologyPrerequisiteSummary(state, technologyDefinition) : getResearchSingleBottleneck(state, technologyDefinition, researchStatus)) + "</small>";
        entryElement.appendChild(slipElement);
        if (game.runtime.selectedResearchTechnologyId !== technologyDefinition.id) {
            entryElement.appendChild(createResearchSlipTooltip(state, technologyDefinition, researchStatus));
        }
        return entryElement;
    }

    /**
     * 创建研究签详情浮窗；预览科技只公开用途剪影与具名前置。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @param {string} researchStatus - 当前研究状态 ID。
     * @returns {HTMLElement} 不包含执行按钮的研究详情浮窗。
     */
    function createResearchSlipTooltip(state, technologyDefinition, researchStatus) {
        if (researchStatus !== "preview") {
            return createTechnologyCardTooltip(state, technologyDefinition, state.technologiesById[technologyDefinition.id], researchStatus);
        }

        // HTMLElement 预览浮窗元素：不公开成本、解锁数值或未知后继。
        var tooltipElement = document.createElement("div");
        // HTMLElement 预览明细列表：仅包含当前允许公开的字段。
        var listElement = document.createElement("dl");

        tooltipElement.className = "building-tooltip research-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", technologyDefinition.name));
        appendTooltipDefinition(listElement, "用途剪影", technologyDefinition.effectTags.join(" / "));
        appendTooltipDefinition(listElement, "前置条件", formatTechnologyPrerequisiteSummary(state, technologyDefinition));
        appendTooltipDefinition(listElement, "研究状态", getResearchStatusLabel(researchStatus));
        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 渲染当前选择科技的固定检查器。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 研究检查器元素。
     */
    function renderResearchInspector(state) {
        // HTMLElement 检查器元素：集中显示完整资料和唯一研究操作。
        var inspectorElement = document.createElement("aside");
        // TechnologyDefinition|null 选中科技定义：空值时显示无内容提示。
        var technologyDefinition = game.technology.getTechnologyDefinition(game.runtime.selectedResearchTechnologyId || "");

        inspectorElement.className = "research-inspector";
        inspectorElement.setAttribute("aria-live", "polite");
        if (!technologyDefinition || getTechnologyResearchStatus(state, technologyDefinition) === "unknown") {
            inspectorElement.appendChild(createTextElement("p", "选择一项已揭示科技查看完整研究资料。"));
            return inspectorElement;
        }

        // string 当前研究状态：决定检查器公开字段和按钮状态。
        var researchStatus = getTechnologyResearchStatus(state, technologyDefinition);
        // boolean 是否预览：预览不公开成本与解锁数值。
        var isPreview = researchStatus === "preview";
        // HTMLElement 明细列表元素：按交互规格固定顺序显示资料。
        var detailListElement = document.createElement("dl");

        inspectorElement.className += " " + technologyDefinition.lineId;
        inspectorElement.appendChild(createTextElement("h3", technologyDefinition.name));
        inspectorElement.appendChild(createTextElement("p", getResearchLineName(technologyDefinition.lineId) + " · " + getResearchEraName(technologyDefinition.eraId) + " · T" + technologyDefinition.tier + " · " + getResearchStatusLabel(researchStatus)));
        inspectorElement.appendChild(createTextElement("p", isPreview ? "推进具名前置后公开完整研究资料。" : technologyDefinition.description));
        appendTooltipDefinition(detailListElement, "核心效果", technologyDefinition.effectTags.join(" / "));
        if (!isPreview) {
            appendTooltipDefinition(detailListElement, "研究成本", formatPriceList(technologyDefinition.price));
            appendTooltipDefinition(detailListElement, "当前瓶颈", getResearchSingleBottleneck(state, technologyDefinition, researchStatus));
        }
        appendTooltipDefinition(detailListElement, "前置条件", formatTechnologyPrerequisiteSummary(state, technologyDefinition));
        if (!isPreview) {
            appendTooltipDefinition(detailListElement, "解锁内容", formatUnlockPreview(technologyDefinition.unlocks || {}));
            appendTooltipDefinition(detailListElement, "后续方向", formatTechnologySuccessors(technologyDefinition.id));
        }
        inspectorElement.appendChild(detailListElement);
        inspectorElement.appendChild(renderResearchInspectorRelations(state, technologyDefinition, isPreview));
        if (!isPreview) {
            // HTMLButtonElement 研究按钮：提交前仍由研究系统重新校验状态和资源。
            var researchButtonElement = document.createElement("button");
            // string[] 缺口文本数组：用于生成等待、容量或来源按钮文案。
            var missingTexts = game.resources.getMissingResourceTexts(state, technologyDefinition.price);

            researchButtonElement.type = "button";
            researchButtonElement.dataset.technologyId = technologyDefinition.id;
            researchButtonElement.disabled = researchStatus !== "available" || state.isPaused;
            researchButtonElement.textContent = getResearchButtonLabel(state, researchStatus, missingTexts);
            inspectorElement.appendChild(researchButtonElement);
        }
        return inspectorElement;
    }

    /**
     * 渲染检查器内已揭示前置与后继关系按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前选中科技定义。
     * @param {boolean} isPreview - true 只显示具名前置，false 同时显示后继。
     * @returns {HTMLElement} 关系定位按钮容器。
     */
    function renderResearchInspectorRelations(state, technologyDefinition, isPreview) {
        // HTMLElement 关系容器元素：承载具名定位按钮。
        var relationsElement = document.createElement("div");
        // TechnologyId[] 前置科技 ID：仅保留当前已揭示目标。
        var prerequisiteTechnologyIds = getRevealedRelatedTechnologyIds(state, technologyDefinition.prerequisiteTechnologyIds.concat(technologyDefinition.alternativePrerequisiteTechnologyIds));
        // TechnologyId[] 后继科技 ID：预览态不公开，正式态仅保留已揭示目标。
        var successorTechnologyIds = isPreview ? [] : getRevealedRelatedTechnologyIds(state, getTechnologySuccessorIds(technologyDefinition.id));
        // TechnologyId[] 关系科技 ID：按前置后继顺序生成按钮。
        var relatedTechnologyIds = prerequisiteTechnologyIds.concat(successorTechnologyIds);

        relationsElement.className = "research-inspector-relations";
        // number 关系循环索引：为每项已揭示关系生成定位按钮。
        for (var relationIndex = 0; relationIndex < relatedTechnologyIds.length; relationIndex += 1) {
            // TechnologyId 关系科技 ID：用于读取中文名称和定位目标。
            var relatedTechnologyId = relatedTechnologyIds[relationIndex];
            // TechnologyDefinition|null 关系科技定义：定义存在时显示中文名。
            var relatedTechnologyDefinition = game.technology.getTechnologyDefinition(relatedTechnologyId);
            // HTMLButtonElement 关系按钮：点击后清除筛选并选择目标。
            var relationButtonElement = document.createElement("button");

            relationButtonElement.type = "button";
            relationButtonElement.dataset.researchRelationTargetId = relatedTechnologyId;
            relationButtonElement.textContent = (relationIndex < prerequisiteTechnologyIds.length ? "前置：" : "后继：") + (relatedTechnologyDefinition ? relatedTechnologyDefinition.name : relatedTechnologyId);
            relationsElement.appendChild(relationButtonElement);
        }
        return relationsElement;
    }

    /**
     * 取得研究签唯一瓶颈文本。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @param {string} researchStatus - 当前研究状态 ID。
     * @returns {string} 可执行、等待、前置或完成结论。
     */
    function getResearchSingleBottleneck(state, technologyDefinition, researchStatus) {
        if (researchStatus === "researched") { return "研究已完成"; }
        if (researchStatus === "preview") { return formatTechnologyPrerequisiteSummary(state, technologyDefinition); }
        if (researchStatus === "available") { return state.isPaused ? "已暂停" : "资源已齐备"; }
        return formatActionAvailabilityText(state, technologyDefinition.price);
    }

    /**
     * 取得研究状态字形，供高密度目录快速扫描。
     *
     * @param {string} researchStatus - 当前研究状态 ID。
     * @returns {string} 单字符状态图形。
     */
    function getResearchStatusSymbol(researchStatus) {
        if (researchStatus === "available") { return "◆"; }
        if (researchStatus === "unaffordable") { return "◒"; }
        if (researchStatus === "preview") { return "◇"; }
        if (researchStatus === "researched") { return "✓"; }
        return "?";
    }

    /**
     * 按稳定 ID 取得研究时代中文名。
     *
     * @param {ResearchEraId} eraId - 研究时代稳定 ID。
     * @returns {string} 时代中文名；定义缺失时返回 ID。
     */
    function getResearchEraName(eraId) {
        // ResearchEraDefinition|undefined 匹配时代定义：用于读取中文名。
        var eraDefinition = game.definitions.RESEARCH_ERA_DEFINITIONS.find(function (candidateDefinition) { return candidateDefinition.id === eraId; });

        return eraDefinition ? eraDefinition.name : eraId;
    }

    /**
     * 按稳定 ID 取得研究路线中文名。
     *
     * @param {ResearchLineId} lineId - 研究路线稳定 ID。
     * @returns {string} 路线中文名；定义缺失时返回 ID。
     */
    function getResearchLineName(lineId) {
        // ResearchLineDefinition|undefined 匹配路线定义：用于读取中文名。
        var lineDefinition = game.definitions.RESEARCH_LINE_DEFINITIONS.find(function (candidateDefinition) { return candidateDefinition.id === lineId; });

        return lineDefinition ? lineDefinition.name : lineId;
    }

    /**
     * 渲染六条路线徽签，点击同一路线第二次会恢复全局图谱。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 路线导航元素。
     */
    function renderResearchLineNavigation(state) {
        // HTMLElement 路线导航元素：承载六个路线筛选徽签。
        var navigationElement = document.createElement("nav");

        navigationElement.className = "research-line-navigation";
        navigationElement.setAttribute("aria-label", "研究路线筛选");

        // number 路线循环索引：遍历正式路线定义的整数下标。
        for (var lineIndex = 0; lineIndex < game.definitions.RESEARCH_LINE_DEFINITIONS.length; lineIndex += 1) {
            // ResearchLineDefinition 路线定义：本轮用于生成徽签和进度。
            var lineDefinition = game.definitions.RESEARCH_LINE_DEFINITIONS[lineIndex];

            // HTMLButtonElement 路线按钮：点击后只改变运行时聚焦路线。
            var lineButtonElement = document.createElement("button");

            // Object 路线计数：done、available 和 total 均为非负整数。
            var lineCounts = getResearchLineCounts(state, lineDefinition.id);

            lineButtonElement.type = "button";
            lineButtonElement.className = "research-line-chip " + lineDefinition.colorToken + (game.runtime.researchLineId === lineDefinition.id ? " is-selected" : "");
            lineButtonElement.dataset.researchLineId = lineDefinition.id;
            lineButtonElement.setAttribute("aria-pressed", game.runtime.researchLineId === lineDefinition.id ? "true" : "false");
            lineButtonElement.textContent = lineDefinition.name + " " + lineCounts.done + "/" + lineCounts.total + " · 可研究 " + lineCounts.available;
            navigationElement.appendChild(lineButtonElement);
        }

        return navigationElement;
    }

    /**
     * 按“路线泳道 × 时代列”渲染有限宽度科技图谱。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} graphElement - 图谱容器，会被写入路线和节点。
     * @returns {void} 无返回值。
     */
    function renderResearchGraph(state, graphElement) {
        // string 当前聚焦路线 ID：空字符串表示显示全部路线。
        var focusedLineId = game.runtime.researchLineId || "";

        // number 路线循环索引：遍历路线定义的整数下标。
        for (var lineIndex = 0; lineIndex < game.definitions.RESEARCH_LINE_DEFINITIONS.length; lineIndex += 1) {
            // ResearchLineDefinition 路线定义：用于构造本轮泳道。
            var lineDefinition = game.definitions.RESEARCH_LINE_DEFINITIONS[lineIndex];

            if (focusedLineId && focusedLineId !== lineDefinition.id) {
                continue;
            }

            // HTMLElement 泳道元素：包含固定路线标题与四个时代列。
            var laneElement = document.createElement("section");

            laneElement.className = "research-lane " + lineDefinition.colorToken;
            laneElement.dataset.researchLineScrollId = lineDefinition.id;
            laneElement.appendChild(createResearchLaneHeading(lineDefinition));

            // number 时代循环索引：遍历四个时代定义的整数下标。
            for (var eraIndex = 0; eraIndex < game.definitions.RESEARCH_ERA_DEFINITIONS.length; eraIndex += 1) {
                // ResearchEraDefinition 时代定义：用于构造泳道内时代列。
                var eraDefinition = game.definitions.RESEARCH_ERA_DEFINITIONS[eraIndex];

                // HTMLElement 时代列元素：承载本路线本时代的全部可见节点。
                var eraColumnElement = document.createElement("div");

                eraColumnElement.className = "research-era-column";
                eraColumnElement.dataset.eraId = eraDefinition.id;
                eraColumnElement.appendChild(createTextElement("h4", eraDefinition.name));

                // HTMLElement[] 专精链卡片数组：默认在所属时代列折叠展示三条采集强化链。
                var specializationCardElements = createResearchSpecializationCards(state, lineDefinition.id, eraDefinition.id);

                // number 专精链卡循环索引：遍历当前路线时代的折叠链卡。
                for (var specializationIndex = 0; specializationIndex < specializationCardElements.length; specializationIndex += 1) {
                    eraColumnElement.appendChild(specializationCardElements[specializationIndex]);
                }

                // TechnologyDefinition[] 时代节点数组：按层级与显式布局顺序生成。
                var eraTechnologies = getResearchTechnologiesForLane(state, lineDefinition.id, eraDefinition.id);

                // number 科技循环索引：遍历当前时代节点的整数下标。
                for (var technologyIndex = 0; technologyIndex < eraTechnologies.length; technologyIndex += 1) {
                    // TechnologyDefinition 当前科技定义：用于渲染研究卡片。
                    var technologyDefinition = eraTechnologies[technologyIndex];

                    eraColumnElement.appendChild(renderTechnologyCard(state, technologyDefinition));
                }

                if (eraTechnologies.length === 0 && specializationCardElements.length === 0) {
                    if ((!game.runtime.researchFilter || game.runtime.researchFilter === "all") && !game.runtime.researchSearchText && doesResearchLaneEraHaveNodes(lineDefinition.id, eraDefinition.id)) {
                        eraColumnElement.appendChild(createUnknownResearchCard());
                    } else {
                        eraColumnElement.appendChild(createTextElement("p", "—"));
                    }
                }

                laneElement.appendChild(eraColumnElement);
            }

            laneElement.addEventListener("scroll", refreshResearchConnectionsAfterLaneScroll, { passive: true });
            graphElement.appendChild(laneElement);
        }
    }

    /**
     * 创建指定路线时代中的折叠采集专精链卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResearchLineId} lineId - 正式路线稳定 ID。
     * @param {ResearchEraId} eraId - 研究时代稳定 ID。
     * @returns {HTMLElement[]} 当前应显示的专精链节点组数组。
     */
    function createResearchSpecializationCards(state, lineId, eraId) {
        // HTMLElement[] 专精链节点组数组：每组包含总卡及其展开后的四个直属节点。
        var cardElements = [];

        if ((game.runtime.researchFilter && game.runtime.researchFilter !== "all") || game.runtime.researchSearchText) {
            return cardElements;
        }

        // number 专精链循环索引：遍历三条静态采集专精定义。
        for (var specializationIndex = 0; specializationIndex < game.definitions.RESEARCH_SPECIALIZATION_DEFINITIONS.length; specializationIndex += 1) {
            // ResearchSpecializationDefinition 专精链定义：用于匹配路线时代并计算进度。
            var specializationDefinition = game.definitions.RESEARCH_SPECIALIZATION_DEFINITIONS[specializationIndex];

            if (specializationDefinition.lineId !== lineId || specializationDefinition.eraId !== eraId) {
                continue;
            }

            // boolean 专精链是否展开：决定按钮文案和链内节点是否另行渲染。
            var isExpanded = isResearchSpecializationExpanded(specializationDefinition.id);

            // number 已完成专精节点数量：范围为 0 至 technologyIds.length 的整数。
            var researchedNodeCount = 0;

            // number 专精科技循环索引：遍历链内科技 ID 的整数下标。
            for (var technologyIndex = 0; technologyIndex < specializationDefinition.technologyIds.length; technologyIndex += 1) {
                if (hasTechnologyResearched(state, specializationDefinition.technologyIds[technologyIndex])) {
                    researchedNodeCount += 1;
                }
            }

            // HTMLElement 专精链卡片：显示整体进度并提供展开操作。
            var cardElement = document.createElement("article");

            // HTMLElement 专精链节点组：保证展开节点紧跟总卡，不混入普通科技排序流。
            var groupElement = document.createElement("div");

            // HTMLButtonElement 展开按钮：点击后只改变运行时图谱展示状态。
            var expandButtonElement = document.createElement("button");

            cardElement.className = "research-card research-specialization-card is-compact" + (isExpanded ? " is-expanded" : "");
            cardElement.appendChild(createTextElement("strong", specializationDefinition.name));
            cardElement.appendChild(createTextElement("p", "紧凑支线 · 已完成 " + researchedNodeCount + "/" + specializationDefinition.technologyIds.length));
            cardElement.appendChild(createTextElement("p", formatResearchSpecializationNames(specializationDefinition)));
            expandButtonElement.type = "button";
            expandButtonElement.dataset.researchSpecializationId = specializationDefinition.id;
            expandButtonElement.textContent = isExpanded ? "收起专精节点" : "展开 4 个节点";
            cardElement.appendChild(expandButtonElement);
            groupElement.className = "research-specialization-group";
            groupElement.appendChild(cardElement);

            if (isExpanded) {
                // number 展开节点循环索引：严格按专精定义中的推进顺序渲染四项科技。
                for (var expandedNodeIndex = 0; expandedNodeIndex < specializationDefinition.technologyIds.length; expandedNodeIndex += 1) {
                    // TechnologyId 展开科技 ID：用于读取直属节点定义并生成真实研究卡片。
                    var expandedTechnologyId = specializationDefinition.technologyIds[expandedNodeIndex];

                    // TechnologyDefinition|null 展开科技定义：定义缺失时跳过，避免生成无效操作卡片。
                    var expandedTechnologyDefinition = game.technology.getTechnologyDefinition(expandedTechnologyId);

                    if (expandedTechnologyDefinition && isTechnologyRevealed(state, expandedTechnologyDefinition)) {
                        groupElement.appendChild(renderTechnologyCard(state, expandedTechnologyDefinition));
                    }
                }
            }

            cardElements.push(groupElement);
        }

        return cardElements;
    }

    /**
     * 格式化专精链内四项科技名称。
     *
     * @param {ResearchSpecializationDefinition} specializationDefinition - 当前专精链定义。
     * @returns {string} 按推进顺序连接的科技中文名。
     */
    function formatResearchSpecializationNames(specializationDefinition) {
        // string[] 科技名称数组：按专精链定义顺序生成。
        var technologyNames = [];

        // number 科技循环索引：遍历链内科技 ID 的整数下标。
        for (var technologyIndex = 0; technologyIndex < specializationDefinition.technologyIds.length; technologyIndex += 1) {
            // TechnologyDefinition|null 科技定义：用于读取中文显示名。
            var technologyDefinition = game.technology.getTechnologyDefinition(specializationDefinition.technologyIds[technologyIndex]);

            technologyNames.push(technologyDefinition ? technologyDefinition.name : specializationDefinition.technologyIds[technologyIndex]);
        }

        return technologyNames.join(" → ");
    }

    /**
     * 判断采集专精链是否已由玩家展开。
     *
     * @param {string} specializationId - 专精链稳定 ID。
     * @returns {boolean} 当前运行时展开字典中为 true 时返回 true。
     */
    function isResearchSpecializationExpanded(specializationId) {
        return Boolean(game.runtime.researchSpecializationsExpandedById && game.runtime.researchSpecializationsExpandedById[specializationId]);
    }

    /**
     * 判断科技是否由默认图谱中的采集专精节点组负责渲染。
     *
     * @param {TechnologyId} technologyId - 科技稳定 ID。
     * @returns {boolean} 默认无筛选图谱中属于任一专精链时返回 true。
     */
    function isTechnologyInResearchSpecializationGroup(technologyId) {
        if ((game.runtime.researchFilter && game.runtime.researchFilter !== "all") || game.runtime.researchSearchText) {
            return false;
        }

        // number 专精链循环索引：遍历三条采集专精定义。
        for (var specializationIndex = 0; specializationIndex < game.definitions.RESEARCH_SPECIALIZATION_DEFINITIONS.length; specializationIndex += 1) {
            // ResearchSpecializationDefinition 专精链定义：用于检查成员与展开状态。
            var specializationDefinition = game.definitions.RESEARCH_SPECIALIZATION_DEFINITIONS[specializationIndex];

            if (specializationDefinition.technologyIds.indexOf(technologyId) !== -1) {
                return true;
            }
        }

        return false;
    }

    /**
     * 判断指定路线与时代是否存在静态节点。
     *
     * @param {ResearchLineId} lineId - 正式路线稳定 ID。
     * @param {ResearchEraId} eraId - 研究时代稳定 ID。
     * @returns {boolean} 静态定义中存在节点时返回 true。
     */
    function doesResearchLaneEraHaveNodes(lineId, eraId) {
        // number 科技循环索引：遍历全部科技定义的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 科技定义：用于匹配路线与时代。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            if (technologyDefinition.lineId === lineId && technologyDefinition.eraId === eraId) {
                return true;
            }
        }

        return false;
    }

    /**
     * 创建不泄露具体科技内容的未知节点剪影。
     *
     * @returns {HTMLElement} 未知节点卡片元素。
     */
    function createUnknownResearchCard() {
        // HTMLElement 未知卡片元素：只显示类别级揭示提示，不包含科技名或成本。
        var cardElement = document.createElement("article");

        cardElement.className = "research-card is-unknown";
        cardElement.appendChild(createTextElement("strong", "？ 未知节点"));
        cardElement.appendChild(createTextElement("p", "推进本路线或相邻前置后揭示。"));
        return cardElement;
    }

    /**
     * 渲染熟练玩家使用的紧凑科技列表，排序仍来自路线、时代、层级和布局字段。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} graphElement - 紧凑列表容器，会被写入科技卡片。
     * @returns {void} 无返回值。
     */
    function renderResearchCompactList(state, graphElement) {
        // TechnologyDefinition[] 可见科技数组：复用统一揭示、筛选和稳定排序规则。
        var visibleTechnologies = getVisibleResearchTechnologies(state);

        // number 科技循环索引：遍历紧凑列表节点的整数下标。
        for (var technologyIndex = 0; technologyIndex < visibleTechnologies.length; technologyIndex += 1) {
            // TechnologyDefinition 科技定义：用于渲染紧凑卡片。
            var technologyDefinition = visibleTechnologies[technologyIndex];

            if (!doesTechnologyMatchResearchSearch(technologyDefinition)) {
                continue;
            }

            graphElement.appendChild(renderTechnologyCard(state, technologyDefinition));
        }
    }

    /**
     * 创建路线泳道标题。
     *
     * @param {ResearchLineDefinition} lineDefinition - 当前路线定义。
     * @returns {HTMLElement} 路线标题元素。
     */
    function createResearchLaneHeading(lineDefinition) {
        // HTMLElement 标题元素：展示路线名称、徽记和职责。
        var headingElement = document.createElement("header");

        headingElement.className = "research-lane-heading";
        headingElement.appendChild(createTextElement("strong", lineDefinition.name));
        headingElement.appendChild(createTextElement("span", lineDefinition.description));
        return headingElement;
    }

    /**
     * 创建研究筛选或排序按钮。
     *
     * @param {"researchFilter"|"researchSort"|"researchView"|"researchLocateAvailable"} dataKey - dataset 字段名。
     * @param {string} valueText - dataset 字段值。
     * @param {string} labelText - 按钮中文文本。
     * @returns {HTMLButtonElement} 研究控制按钮。
     */
    function createResearchButton(dataKey, valueText, labelText) {
        // HTMLButtonElement 按钮元素：点击后写入运行时研究筛选或排序。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset[dataKey] = valueText;
        buttonElement.textContent = labelText;
        return buttonElement;
    }

    /**
     * 取得筛选和排序后的科技定义。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {TechnologyDefinition[]} 可见科技定义数组。
     */
    function getVisibleResearchTechnologies(state) {
        // string 研究筛选 ID：默认显示全部已解锁科技。
        var researchFilter = game.runtime && game.runtime.researchFilter ? game.runtime.researchFilter : "all";

        // string 研究排序 ID：默认按线路排序。
        var researchSort = game.runtime && game.runtime.researchSort ? game.runtime.researchSort : "line";

        // TechnologyDefinition[] 可见科技定义数组：从已解锁科技中筛选。
        var visibleTechnologies = [];

        // number 循环索引：遍历科技定义数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 当前科技定义：用于筛选。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            // TechnologyState 当前科技状态：用于判断显示和完成态。
            var technologyState = state.technologiesById[technologyDefinition.id];

            if (!technologyState || getTechnologyResearchStatus(state, technologyDefinition) === "unknown") {
                continue;
            }

            // string 研究状态 ID：用于统一列表和图谱筛选语义。
            var researchStatus = getTechnologyResearchStatus(state, technologyDefinition);

            if (!doesTechnologyMatchResearchFilter(technologyDefinition, researchStatus, researchFilter) || (game.runtime.isResearchMilestoneOnly && technologyDefinition.nodeSize !== "milestone") || !doesTechnologyMatchResearchSearch(technologyDefinition)) {
                continue;
            }

            visibleTechnologies.push(technologyDefinition);
        }

        visibleTechnologies.sort(function (leftTechnology, rightTechnology) {
            if (researchSort === "cost") {
                return getTechnologyCostScore(leftTechnology) - getTechnologyCostScore(rightTechnology);
            }

            return getResearchLineOrder(leftTechnology.lineId) - getResearchLineOrder(rightTechnology.lineId) || leftTechnology.tier - rightTechnology.tier || leftTechnology.layoutOrder - rightTechnology.layoutOrder;
        });
        return visibleTechnologies;
    }

    /**
     * 取得指定路线与时代中符合当前筛选的科技定义。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResearchLineId} lineId - 正式研究路线稳定 ID。
     * @param {ResearchEraId} eraId - 研究时代稳定 ID。
     * @returns {TechnologyDefinition[]} 已揭示或可预览的科技定义数组，按层级和布局顺序排列。
     */
    function getResearchTechnologiesForLane(state, lineId, eraId) {
        // string 当前研究筛选 ID：空值时按 all 处理。
        var researchFilter = game.runtime.researchFilter || "all";

        // TechnologyDefinition[] 结果数组：只包含指定路线、时代并匹配状态筛选的节点。
        var matchingTechnologies = [];

        // number 科技循环索引：遍历全部科技定义的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 科技定义：用于检查路线、时代和状态。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            if (technologyDefinition.lineId !== lineId || technologyDefinition.eraId !== eraId) {
                continue;
            }

            if (isTechnologyInResearchSpecializationGroup(technologyDefinition.id)) {
                continue;
            }

            if (!doesTechnologyMatchResearchSearch(technologyDefinition)) {
                continue;
            }

            // string 研究状态 ID：取值为 unknown、preview、unaffordable、available 或 researched。
            var researchStatus = getTechnologyResearchStatus(state, technologyDefinition);

            if (researchStatus === "unknown" || !doesTechnologyMatchResearchFilter(technologyDefinition, researchStatus, researchFilter)) {
                continue;
            }

            matchingTechnologies.push(technologyDefinition);
        }

        matchingTechnologies.sort(function (leftTechnology, rightTechnology) {
            return leftTechnology.tier - rightTechnology.tier || leftTechnology.layoutOrder - rightTechnology.layoutOrder;
        });
        return matchingTechnologies;
    }

    /**
     * 判断科技是否匹配研究搜索文本。
     *
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {boolean} 名称、介绍、建议或效果标签包含搜索文本时返回 true；空搜索返回 true。
     */
    function doesTechnologyMatchResearchSearch(technologyDefinition) {
        // string 搜索文本：转为小写并去除首尾空白，空字符串表示不筛选。
        var searchText = String(game.runtime.researchSearchText || "").trim().toLowerCase();

        if (!searchText) {
            return true;
        }

        // string[] 成本资源名称数组：搜索允许按研究所需资源定位科技。
        var priceResourceNames = technologyDefinition.price.map(function (priceEntry) { return formatResourceIdList([priceEntry.resource]); });
        // string[] 前置科技名称数组：搜索允许按具名前置定位科技。
        var prerequisiteNames = technologyDefinition.prerequisiteTechnologyIds.concat(technologyDefinition.alternativePrerequisiteTechnologyIds).map(function (technologyId) {
            // TechnologyDefinition|null 前置科技定义：用于读取玩家可见中文名。
            var prerequisiteDefinition = game.technology.getTechnologyDefinition(technologyId);

            return prerequisiteDefinition ? prerequisiteDefinition.name : "";
        });
        // string 科技检索文本：只拼接静态中文展示字段，不读取 DOM。
        var searchableText = [technologyDefinition.name, technologyDefinition.description, technologyDefinition.recommendedFor, technologyDefinition.effectTags.join(" "), priceResourceNames.join(" "), prerequisiteNames.join(" ")].join(" ").toLowerCase();

        return searchableText.indexOf(searchText) !== -1;
    }

    /**
     * 判断科技是否匹配研究页状态筛选。
     *
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @param {string} researchStatus - 当前研究状态 ID。
     * @param {string} researchFilter - 当前筛选 ID。
     * @returns {boolean} 是否应在当前筛选下显示。
     */
    function doesTechnologyMatchResearchFilter(technologyDefinition, researchStatus, researchFilter) {
        if (researchFilter === "all") {
            return true;
        }

        if (researchFilter === "milestone") {
            return technologyDefinition.nodeSize === "milestone";
        }

        return researchStatus === researchFilter;
    }

    /**
     * 计算科技节点当前状态，状态判断不修改游戏进度。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {"unknown"|"preview"|"unaffordable"|"available"|"researched"} 节点状态 ID。
     */
    function getTechnologyResearchStatus(state, technologyDefinition) {
        // TechnologyState|undefined 科技运行时状态：用于读取真实解锁和完成标记。
        var technologyState = state.technologiesById[technologyDefinition.id];

        if (technologyState && technologyState.isResearched) {
            return "researched";
        }

        // boolean 前置是否满足：AND 前置全部完成，且存在 OR 前置时至少完成一项。
        var hasPrerequisites = areTechnologyPrerequisitesMet(state, technologyDefinition);

        if (technologyState && technologyState.isUnlocked && hasPrerequisites) {
            return game.resources.canAfford(state, technologyDefinition.price) ? "available" : "unaffordable";
        }

        if (isTechnologyRevealed(state, technologyDefinition)) {
            return "preview";
        }

        return "unknown";
    }

    /**
     * 判断科技展示前置是否完成。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {boolean} 是否满足 AND 与 OR 展示前置；无前置时返回 true。
     */
    function areTechnologyPrerequisitesMet(state, technologyDefinition) {
        // number AND 前置循环索引：遍历必须全部完成的科技 ID。
        for (var prerequisiteIndex = 0; prerequisiteIndex < technologyDefinition.prerequisiteTechnologyIds.length; prerequisiteIndex += 1) {
            // TechnologyId 前置科技 ID：用于读取对应完成状态。
            var prerequisiteTechnologyId = technologyDefinition.prerequisiteTechnologyIds[prerequisiteIndex];

            if (!hasTechnologyResearched(state, prerequisiteTechnologyId)) {
                return false;
            }
        }

        if (technologyDefinition.alternativePrerequisiteTechnologyIds.length === 0) {
            return true;
        }

        // number OR 前置循环索引：遍历完成任意一个即可的科技 ID。
        for (var alternativeIndex = 0; alternativeIndex < technologyDefinition.alternativePrerequisiteTechnologyIds.length; alternativeIndex += 1) {
            // TechnologyId 备选前置科技 ID：用于读取对应完成状态。
            var alternativeTechnologyId = technologyDefinition.alternativePrerequisiteTechnologyIds[alternativeIndex];

            if (hasTechnologyResearched(state, alternativeTechnologyId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 判断未解锁科技是否已达到渐进揭示条件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {boolean} 是否显示名称和预览卡；只提前展示当前节点之后一层。
     */
    function isTechnologyRevealed(state, technologyDefinition) {
        // TechnologyState|undefined 科技运行时状态：真实已解锁项始终揭示。
        var technologyState = state.technologiesById[technologyDefinition.id];

        if (technologyState && technologyState.isUnlocked) {
            return true;
        }

        if (technologyDefinition.revealCondition.mode === "always") {
            return true;
        }

        // TechnologyId[] 揭示父科技 ID 数组：完成父节点或父节点已显示时允许预览一层。
        var revealTechnologyIds = technologyDefinition.revealCondition.technologyIds;

        // number 揭示科技循环索引：遍历可触发预览的父科技 ID。
        for (var revealIndex = 0; revealIndex < revealTechnologyIds.length; revealIndex += 1) {
            // TechnologyId 揭示科技 ID：用于读取父节点运行时状态。
            var revealTechnologyId = revealTechnologyIds[revealIndex];

            // TechnologyState|undefined 揭示父科技状态：已解锁即允许展示下一层剪影。
            var revealTechnologyState = state.technologiesById[revealTechnologyId];

            if (revealTechnologyState && revealTechnologyState.isUnlocked) {
                return true;
            }
        }

        return false;
    }

    /**
     * 渲染单项科技卡片，正面包含核心效果、完整成本、缺口和前置状态。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {HTMLElement} 可键盘访问的科技卡片元素。
     */
    function renderTechnologyCard(state, technologyDefinition) {
        // string 研究状态 ID：控制文案、边框和操作按钮。
        var researchStatus = getTechnologyResearchStatus(state, technologyDefinition);

        // TechnologyState 科技运行时状态：初始状态保证每项定义都有对应对象。
        var technologyState = state.technologiesById[technologyDefinition.id];

        // HTMLElement 卡片元素：承载正面信息，并作为悬浮详情的指针与键盘触发区。
        var cardElement = document.createElement("article");

        // HTMLElement 标题元素：显示科技名、层级和状态图形。
        var headingElement = document.createElement("header");

        // HTMLElement 成本元素：显示完整成本与不足差额。
        var costElement = document.createElement("p");

        // string[] 缺口文本数组：资源不足时显示每项差额。
        var missingTexts = game.resources.getMissingResourceTexts(state, technologyDefinition.price);

        // HTMLButtonElement 研究按钮：只有 available 状态且未暂停时可点击。
        var researchButtonElement = document.createElement("button");

        cardElement.id = "research-node-" + technologyDefinition.id;
        cardElement.className = "research-card is-" + researchStatus + " is-" + technologyDefinition.nodeSize + " connection-" + getTechnologyConnectionType(technologyDefinition);
        if (game.runtime.recentlyResearchedTechnologyId === technologyDefinition.id) {
            cardElement.className += " is-newly-researched";
            game.runtime.recentlyResearchedTechnologyId = "";
        }
        cardElement.dataset.technologyNodeId = technologyDefinition.id;
        cardElement.tabIndex = 0;
        cardElement.setAttribute("aria-describedby", "research-tooltip-" + technologyDefinition.id);

        headingElement.appendChild(createTextElement("strong", technologyDefinition.name));
        headingElement.appendChild(createTextElement("span", "T" + technologyDefinition.tier + " · " + getResearchStatusLabel(researchStatus)));
        cardElement.appendChild(headingElement);
        cardElement.appendChild(createTextElement("p", technologyDefinition.effectTags.join(" / ") + "：" + technologyDefinition.description));

        costElement.className = "research-card-cost";
        costElement.textContent = "成本：" + formatPriceList(technologyDefinition.price);
        if (missingTexts.length > 0 && researchStatus !== "researched") {
            costElement.appendChild(createTextElement("span", " 缺口：" + missingTexts.join("，")));
        }
        cardElement.appendChild(costElement);
        cardElement.appendChild(createTextElement("p", formatTechnologyPrerequisiteSummary(state, technologyDefinition)));

        // TechnologyId[] 前置研究 ID 数组：合并必须前置与任选前置，供左侧关联浮框展示。
        var prerequisiteTechnologyIds = getRevealedRelatedTechnologyIds(state, technologyDefinition.prerequisiteTechnologyIds.concat(technologyDefinition.alternativePrerequisiteTechnologyIds));

        // TechnologyId[] 后置研究 ID 数组：收集所有直接依赖当前研究的科技，供右侧关联浮框展示。
        var successorTechnologyIds = getRevealedRelatedTechnologyIds(state, getTechnologySuccessorIds(technologyDefinition.id));

        if (prerequisiteTechnologyIds.length > 0 || successorTechnologyIds.length > 0) {
            cardElement.appendChild(createResearchRelationsControl(technologyDefinition.id, prerequisiteTechnologyIds, successorTechnologyIds));
        }

        // TechnologyId|null 首个未完成前置科技 ID：存在时提供一次点击定位父节点。
        var unfinishedPrerequisiteTechnologyId = getFirstUnfinishedPrerequisiteTechnologyId(state, technologyDefinition);

        if (unfinishedPrerequisiteTechnologyId) {
            // HTMLButtonElement 定位父节点按钮：不修改科技状态，只聚焦图谱中的前置卡片。
            var prerequisiteButtonElement = document.createElement("button");

            prerequisiteButtonElement.type = "button";
            prerequisiteButtonElement.className = "research-prerequisite-link";
            prerequisiteButtonElement.dataset.researchFocusTechnologyId = unfinishedPrerequisiteTechnologyId;
            prerequisiteButtonElement.textContent = "定位未完成前置";
            cardElement.appendChild(prerequisiteButtonElement);
        }

        researchButtonElement.type = "button";
        researchButtonElement.dataset.technologyId = technologyDefinition.id;
        researchButtonElement.disabled = researchStatus !== "available" || state.isPaused;
        researchButtonElement.textContent = getResearchButtonLabel(state, researchStatus, missingTexts);
        cardElement.appendChild(researchButtonElement);
        cardElement.appendChild(createTechnologyCardTooltip(state, technologyDefinition, technologyState, researchStatus));
        return cardElement;
    }

    /**
     * 创建研究关联控制区；按钮打开后，前置与后置研究分别显示在按钮左右两侧。
     *
     * @param {TechnologyId} technologyId - 当前科技稳定 ID。
     * @param {TechnologyId[]} prerequisiteTechnologyIds - 直接前置科技 ID 数组。
     * @param {TechnologyId[]} successorTechnologyIds - 直接后置科技 ID 数组。
     * @returns {HTMLElement} 包含关联按钮与双侧半透明浮框的控制区元素。
     */
    function createResearchRelationsControl(technologyId, prerequisiteTechnologyIds, successorTechnologyIds) {
        // HTMLElement 关联控制区元素：作为按钮和左右浮框的共同定位容器。
        var controlElement = document.createElement("div");

        // HTMLButtonElement 查看关联按钮：点击时由事件模块切换双侧浮框。
        var toggleButtonElement = document.createElement("button");

        controlElement.className = "research-relations";
        controlElement.dataset.researchRelationsFor = technologyId;
        toggleButtonElement.type = "button";
        toggleButtonElement.className = "research-relations-toggle";
        toggleButtonElement.dataset.researchRelationsToggle = technologyId;
        toggleButtonElement.setAttribute("aria-expanded", "false");
        toggleButtonElement.textContent = "查看关联";
        controlElement.appendChild(toggleButtonElement);

        if (prerequisiteTechnologyIds.length > 0) {
            controlElement.appendChild(createResearchRelationPopover("prerequisites", "前置研究", prerequisiteTechnologyIds));
        }

        if (successorTechnologyIds.length > 0) {
            controlElement.appendChild(createResearchRelationPopover("successors", "后置研究", successorTechnologyIds));
        }

        return controlElement;
    }

    /**
     * 创建一侧研究关联浮框，列表项可定位到对应研究卡片。
     *
     * @param {"prerequisites"|"successors"} relationSide - 浮框方向；前置在左，后置在右。
     * @param {string} headingText - 浮框中文标题。
     * @param {TechnologyId[]} relatedTechnologyIds - 可跳转的关联科技 ID 数组。
     * @returns {HTMLElement} 默认隐藏的半透明关联浮框元素。
     */
    function createResearchRelationPopover(relationSide, headingText, relatedTechnologyIds) {
        // HTMLElement 关联浮框元素：承载单侧标题与研究按钮列表。
        var popoverElement = document.createElement("div");

        // HTMLElement 关联列表元素：保持多个研究项的稳定纵向顺序。
        var listElement = document.createElement("div");

        popoverElement.className = "research-relations-popover is-" + relationSide;
        popoverElement.hidden = true;
        popoverElement.appendChild(createTextElement("strong", headingText));
        listElement.className = "research-relations-list";

        // number 关联科技循环索引：遍历直接前置或后置研究 ID。
        for (var relationIndex = 0; relationIndex < relatedTechnologyIds.length; relationIndex += 1) {
            // TechnologyId 关联科技 ID：用于读取显示名并绑定跳转目标。
            var relatedTechnologyId = relatedTechnologyIds[relationIndex];

            // TechnologyDefinition|null 关联科技定义：用于读取玩家可见中文名。
            var relatedTechnologyDefinition = game.technology.getTechnologyDefinition(relatedTechnologyId);

            // HTMLButtonElement 关联研究按钮：点击后恢复完整图谱并定位对应卡片。
            var relationButtonElement = document.createElement("button");

            relationButtonElement.type = "button";
            relationButtonElement.dataset.researchRelationTargetId = relatedTechnologyId;
            relationButtonElement.textContent = relatedTechnologyDefinition ? relatedTechnologyDefinition.name : relatedTechnologyId;
            listElement.appendChild(relationButtonElement);
        }

        popoverElement.appendChild(listElement);
        return popoverElement;
    }

    /**
     * 取得直接依赖指定科技的全部后置研究。
     *
     * @param {TechnologyId} technologyId - 当前科技稳定 ID。
     * @returns {TechnologyId[]} 直接后置科技 ID 数组，按静态定义顺序排列。
     */
    function getTechnologySuccessorIds(technologyId) {
        // TechnologyId[] 后置科技 ID 数组：只收集直接引用当前科技的定义。
        var successorTechnologyIds = [];

        // number 科技循环索引：遍历全部科技定义以反向查找依赖。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 科技定义：检查其必须前置与任选前置数组。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            if (technologyDefinition.prerequisiteTechnologyIds.indexOf(technologyId) !== -1 || technologyDefinition.alternativePrerequisiteTechnologyIds.indexOf(technologyId) !== -1) {
                successorTechnologyIds.push(technologyDefinition.id);
            }
        }

        return successorTechnologyIds;
    }

    /**
     * 过滤尚未揭示的关联研究，避免关联列表提前泄露未知节点名称。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyId[]} technologyIds - 待过滤的关联科技 ID 数组。
     * @returns {TechnologyId[]} 当前已揭示、能够在完整图谱中定位的科技 ID 数组。
     */
    function getRevealedRelatedTechnologyIds(state, technologyIds) {
        // TechnologyId[] 已揭示科技 ID 数组：保留原始关联定义顺序。
        var revealedTechnologyIds = [];

        // number 关联科技循环索引：遍历待过滤的科技 ID。
        for (var technologyIndex = 0; technologyIndex < technologyIds.length; technologyIndex += 1) {
            // TechnologyId 关联科技 ID：用于读取定义并判断当前揭示状态。
            var technologyId = technologyIds[technologyIndex];

            // TechnologyDefinition|null 关联科技定义：不存在时不生成无效跳转项。
            var technologyDefinition = game.technology.getTechnologyDefinition(technologyId);

            if (technologyDefinition && getTechnologyResearchStatus(state, technologyDefinition) !== "unknown") {
                revealedTechnologyIds.push(technologyId);
            }
        }

        return revealedTechnologyIds;
    }

    /**
     * 创建科技卡片悬浮详情框，由卡片悬停或键盘聚焦时显示。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @param {TechnologyState} technologyState - 当前科技运行时状态。
     * @param {string} researchStatus - 当前研究状态 ID。
     * @returns {HTMLElement} 科技详情浮窗元素，默认隐藏且不接收指针事件。
     */
    function createTechnologyCardTooltip(state, technologyDefinition, technologyState, researchStatus) {
        // HTMLElement 浮窗元素：由统一浮窗事件在科技卡片悬停或聚焦时定位和显示。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表元素：展示介绍、建议、等待、前后继与解锁包。
        var listElement = document.createElement("dl");

        tooltipElement.className = "building-tooltip research-tooltip";
        tooltipElement.id = "research-tooltip-" + technologyDefinition.id;
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", technologyDefinition.name));
        appendTooltipDefinition(listElement, "研究介绍", technologyDefinition.description);
        appendTooltipDefinition(listElement, "瓶颈建议", technologyDefinition.recommendedFor);
        appendTooltipDefinition(listElement, "预计等待", researchStatus === "researched" ? "已完成" : formatActionAvailabilityText(state, technologyDefinition.price));
        appendTooltipDefinition(listElement, "前置条件", formatTechnologyPrerequisiteSummary(state, technologyDefinition));
        appendTooltipDefinition(listElement, "解锁内容", formatUnlockPreview(technologyDefinition.unlocks || {}));
        appendTooltipDefinition(listElement, "后续方向", formatTechnologySuccessors(technologyDefinition.id));
        appendTooltipDefinition(listElement, "研究状态", getResearchStatusLabel(researchStatus));
        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 渲染单个科技研究行。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 科技定义对象。
     * @param {TechnologyState} technologyState - 科技运行时状态对象。
     * @returns {HTMLElement} 科技研究行元素。
     */
    function renderTechnologyRow(state, technologyDefinition, technologyState) {
        // boolean 当前是否可研究：综合暂停、完成状态和资源库存。
        var canResearch = game.technology.canResearch(state, technologyDefinition);

        // string[] 缺口文本数组：资源不足时显示在研究行成本信息中。
        var missingTexts = game.resources.getMissingResourceTexts(state, technologyDefinition.price);

        // string 研究线路名称：用于行内固定字段和悬浮框。
        var lineName = getTechnologyLine(technologyDefinition.id);

        // string 可用倒计时文本：可研究时显示“可用”，资源不足时显示等待时间或不可用。
        var availabilityText = technologyState.isResearched ? "已完成" : formatActionAvailabilityText(state, technologyDefinition.price);

        // string 按钮文本：按完成、暂停、可研究和缺资源状态显示。
        var buttonText = "缺资源";

        // HTMLElement 行元素：承载单个研究的基础字段、倒计时和按钮。
        var rowElement = document.createElement("div");

        // HTMLElement 主信息元素：承载研究名称和完成状态。
        var mainElement = document.createElement("div");

        // HTMLElement 名称元素：显示研究中文名。
        var nameElement = document.createElement("strong");

        // HTMLElement 状态元素：显示已完成或待研究状态。
        var statusElement = document.createElement("span");

        // HTMLElement 线路元素：显示研究所属线路。
        var lineElement = document.createElement("div");

        // HTMLElement 成本元素：显示研究消耗和缺失资源。
        var costElement = document.createElement("div");

        // HTMLElement 倒计时元素：显示当前资源速度下何时可研究。
        var availabilityElement = document.createElement("div");

        // HTMLButtonElement 研究按钮：点击后尝试研究科技。
        var buttonElement = document.createElement("button");

        rowElement.className = canResearch ? "building-row research-row is-affordable" : "building-row research-row is-locked";
        rowElement.tabIndex = 0;

        mainElement.className = "building-main research-main";
        nameElement.textContent = technologyDefinition.name;
        statusElement.textContent = technologyState.isResearched ? game.text.TEXT_REGISTRY.ui.completed : "待研究";
        mainElement.appendChild(nameElement);
        mainElement.appendChild(statusElement);

        lineElement.className = "research-line";
        lineElement.textContent = "线路：" + lineName;

        costElement.className = "building-cost";
        costElement.textContent = "研究消耗：" + formatPriceList(technologyDefinition.price);

        if (missingTexts.length > 0 && !technologyState.isResearched) {
            // HTMLElement 缺口元素：和研究消耗同列显示，便于横向扫描。
            var missingElement = createTextElement("span", "缺失：" + missingTexts.join("，"));

            missingElement.className = "building-missing";
            costElement.appendChild(missingElement);
        }

        availabilityElement.className = "building-availability";
        availabilityElement.textContent = "可用倒计时：" + availabilityText;

        buttonElement.type = "button";
        buttonElement.dataset.technologyId = technologyDefinition.id;
        buttonElement.disabled = !canResearch;
        if (technologyState.isResearched) {
            buttonText = "完成";
        } else if (canResearch) {
            buttonText = "研究";
        } else if (state.isPaused) {
            buttonText = "已暂停";
        }
        buttonElement.textContent = buttonText;

        rowElement.appendChild(mainElement);
        rowElement.appendChild(lineElement);
        rowElement.appendChild(costElement);
        rowElement.appendChild(availabilityElement);
        rowElement.appendChild(buttonElement);
        rowElement.appendChild(createTechnologyTooltip(technologyDefinition, technologyState, lineName));
        return rowElement;
    }

    /**
     * 创建研究悬浮详情框。
     *
     * @param {TechnologyDefinition} technologyDefinition - 科技定义对象，用于读取介绍、价格和解锁包。
     * @param {TechnologyState} technologyState - 科技运行时状态对象，用于显示完成状态。
     * @param {string} lineName - 研究线路中文名称。
     * @returns {HTMLElement} 研究悬浮框元素。
     */
    function createTechnologyTooltip(technologyDefinition, technologyState, lineName) {
        // HTMLElement 悬浮框元素：承载研究介绍、消耗和解锁详情。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表元素：用键值行展示研究详情。
        var listElement = document.createElement("dl");

        tooltipElement.className = "building-tooltip research-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", technologyDefinition.name));
        appendTooltipDefinition(listElement, "研究介绍", technologyDefinition.description);
        appendTooltipDefinition(listElement, "线路", lineName);
        appendTooltipDefinition(listElement, "研究消耗", formatPriceList(technologyDefinition.price));
        appendTooltipDefinition(listElement, "解锁内容", formatUnlockPreview(technologyDefinition.unlocks || {}));
        appendTooltipDefinition(listElement, "研究状态", technologyState.isResearched ? "已完成" : "未完成");
        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 格式化研究相关资源。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 研究资源 ID。
     * @returns {string} 资源数量文本。
     */
    function formatResearchResource(state, resourceId) {
        // ResourceState 资源状态：用于读取数量和容量。
        var resourceState = state.resourcesById[resourceId];

        if (!resourceState || !resourceState.isVisible) {
            return "隐藏";
        }

        return resourceState.value.toFixed(1) + " / " + resourceState.maxValue.toFixed(0);
    }

    /**
     * 格式化科技线路完成计数。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 科技线路完成计数文本。
     */
    function formatResearchLineCounts(state) {
        // Object.<string, {done: number, total: number}> 线路计数字典：按线路统计完成数和总数。
        var countsByLine = {};

        // number 循环索引：遍历科技定义数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 当前科技定义：用于统计线路。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            // string 线路 ID：由科技 ID 推导。
            var lineId = getTechnologyLine(technologyDefinition.id);

            if (!countsByLine[lineId]) {
                countsByLine[lineId] = {
                    done: 0,
                    total: 0
                };
            }

            countsByLine[lineId].total += 1;

            if (state.technologiesById[technologyDefinition.id] && state.technologiesById[technologyDefinition.id].isResearched) {
                countsByLine[lineId].done += 1;
            }
        }

        // string[] 线路文本数组：用于拼接显示。
        var lineTexts = [];

        // string[] 线路 ID 数组：固定显示顺序。
        var lineIds = ["生存", "矿业", "制度", "军工", "符文", "深渊"];

        // number 线路循环索引：遍历线路 ID 数组的整数下标。
        for (var lineIndex = 0; lineIndex < lineIds.length; lineIndex += 1) {
            // string 线路 ID：用于读取计数。
            var currentLineId = lineIds[lineIndex];

            // Object 线路计数：缺失时使用 0。
            var lineCounts = countsByLine[currentLineId] || { done: 0, total: 0 };

            lineTexts.push(currentLineId + " " + lineCounts.done + "/" + lineCounts.total);
        }

        return lineTexts.join("，");
    }

    /**
     * 推导科技线路。
     *
     * @param {string} technologyId - 科技稳定 ID。
     * @returns {string} 科技线路中文名。
     */
    function getTechnologyLine(technologyId) {
        // TechnologyDefinition|null 科技定义：正式路线 ID 只从静态定义读取。
        var technologyDefinition = game.technology.getTechnologyDefinition(technologyId);

        if (!technologyDefinition) {
            return "未知路线";
        }

        // ResearchLineDefinition|null 路线定义：用于返回玩家可见中文名。
        var lineDefinition = getResearchLineDefinition(technologyDefinition.lineId);

        return lineDefinition ? lineDefinition.name : "未知路线";
    }

    /**
     * 取得正式研究路线定义。
     *
     * @param {ResearchLineId} lineId - 正式路线稳定 ID。
     * @returns {ResearchLineDefinition|null} 路线定义；找不到时返回 null。
     */
    function getResearchLineDefinition(lineId) {
        // number 路线循环索引：遍历路线定义的整数下标。
        for (var lineIndex = 0; lineIndex < game.definitions.RESEARCH_LINE_DEFINITIONS.length; lineIndex += 1) {
            // ResearchLineDefinition 路线定义：用于匹配稳定 ID。
            var lineDefinition = game.definitions.RESEARCH_LINE_DEFINITIONS[lineIndex];

            if (lineDefinition.id === lineId) {
                return lineDefinition;
            }
        }

        return null;
    }

    /**
     * 取得路线固定排序值。
     *
     * @param {ResearchLineId} lineId - 正式路线稳定 ID。
     * @returns {number} 路线排序整数；未知路线返回最大安全整数。
     */
    function getResearchLineOrder(lineId) {
        // ResearchLineDefinition|null 路线定义：用于读取固定排序值。
        var lineDefinition = getResearchLineDefinition(lineId);

        return lineDefinition ? lineDefinition.order : Number.MAX_SAFE_INTEGER;
    }

    /**
     * 统计指定路线的完成、可研究和总节点数。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResearchLineId} lineId - 正式路线稳定 ID。
     * @returns {{done: number, available: number, total: number}} 三项均为非负整数的路线计数。
     */
    function getResearchLineCounts(state, lineId) {
        // Object 路线计数：done、available 和 total 均为非负整数。
        var lineCounts = { done: 0, available: 0, total: 0 };

        // number 科技循环索引：遍历全部科技定义的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 科技定义：用于匹配路线并计算状态。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            if (technologyDefinition.lineId !== lineId) {
                continue;
            }

            lineCounts.total += 1;
            // string 研究状态 ID：用于累加完成和可研究数量。
            var researchStatus = getTechnologyResearchStatus(state, technologyDefinition);

            if (researchStatus === "researched") {
                lineCounts.done += 1;
            } else if (researchStatus === "available") {
                lineCounts.available += 1;
            }
        }

        return lineCounts;
    }

    /**
     * 取得顶部进度摘要所显示的当前时代。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {ResearchEraDefinition} 当前最深已研究时代；新局返回第一个时代。
     */
    function getCurrentResearchEra(state) {
        // ResearchEraDefinition 当前时代定义：从首个时代开始，遇到更深已完成节点时更新。
        var currentEraDefinition = game.definitions.RESEARCH_ERA_DEFINITIONS[0];

        // number 科技循环索引：遍历全部科技定义的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 科技定义：用于检查完成状态与所属时代。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            if (!hasTechnologyResearched(state, technologyDefinition.id)) {
                continue;
            }

            // ResearchEraDefinition|null 科技时代定义：用于比较固定排序值。
            var technologyEraDefinition = getResearchEraDefinition(technologyDefinition.eraId);

            if (technologyEraDefinition && technologyEraDefinition.order > currentEraDefinition.order) {
                currentEraDefinition = technologyEraDefinition;
            }
        }

        return currentEraDefinition;
    }

    /**
     * 取得研究时代定义。
     *
     * @param {ResearchEraId} eraId - 研究时代稳定 ID。
     * @returns {ResearchEraDefinition|null} 时代定义；找不到时返回 null。
     */
    function getResearchEraDefinition(eraId) {
        // number 时代循环索引：遍历时代定义的整数下标。
        for (var eraIndex = 0; eraIndex < game.definitions.RESEARCH_ERA_DEFINITIONS.length; eraIndex += 1) {
            // ResearchEraDefinition 时代定义：用于匹配稳定 ID。
            var eraDefinition = game.definitions.RESEARCH_ERA_DEFINITIONS[eraIndex];

            if (eraDefinition.id === eraId) {
                return eraDefinition;
            }
        }

        return null;
    }

    /**
     * 统计全部已完成科技数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 已完成科技数量，非负整数。
     */
    function getResearchedTechnologyCount(state) {
        // number 已完成数量：遍历科技状态后累加的非负整数。
        var researchedCount = 0;

        // number 科技循环索引：遍历全部科技定义的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            if (hasTechnologyResearched(state, game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex].id)) {
                researchedCount += 1;
            }
        }

        return researchedCount;
    }

    /**
     * 格式化研究资源库存、容量与每秒净变化。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ResourceId} resourceId - 研究资源稳定 ID。
     * @returns {string} 库存、容量和有符号每秒速率文本；隐藏资源返回“隐藏”。
     */
    function formatResearchResourceWithFlow(state, resourceId) {
        // ResourceState 资源状态：用于读取库存、容量与每秒速率。
        var resourceState = state.resourcesById[resourceId];

        if (!resourceState || !resourceState.isVisible) {
            return "隐藏";
        }

        // string 速率符号：非负速率显式显示加号。
        var rateSign = resourceState.perSecond >= 0 ? "+" : "";

        return resourceState.value.toFixed(1) + " / " + resourceState.maxValue.toFixed(0) + "（" + rateSign + resourceState.perSecond.toFixed(2) + "/秒）";
    }

    /**
     * 生成当前研究瓶颈提示，不修改状态或科技排序。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 一句带原因的研究建议。
     */
    function getResearchRecommendation(state) {
        // ResourceState 菌菇状态：用于判断食物净产出是否为负。
        var fungusState = state.resourcesById.fungus;

        if (fungusState && fungusState.perSecond < 0) {
            return " 当前提示：食物净产出为负，先查看生存繁衍路线。";
        }

        // ResourceState 粗识状态：用于判断是否接近容量上限。
        var knowledgeState = state.resourcesById.crudeKnowledge;

        if (knowledgeState && knowledgeState.maxValue > 0 && knowledgeState.value >= knowledgeState.maxValue * 0.9) {
            return " 当前提示：粗识接近容量上限，优先研究可支付节点或扩建研究设施。";
        }

        return " 当前提示：定位可研究会按时代、层级和路线寻找最早节点。";
    }

    /**
     * 格式化科技前置摘要，并明确标出未完成父节点或特殊触发。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {string} 玩家可见的前置条件摘要。
     */
    function formatTechnologyPrerequisiteSummary(state, technologyDefinition) {
        // string[] 前置摘要数组：包含 AND、OR 与特殊触发条件文本。
        var prerequisiteTexts = [];

        // number AND 前置循环索引：遍历必须完成的父科技 ID。
        for (var prerequisiteIndex = 0; prerequisiteIndex < technologyDefinition.prerequisiteTechnologyIds.length; prerequisiteIndex += 1) {
            // TechnologyId 前置科技 ID：用于查找中文名与完成状态。
            var prerequisiteTechnologyId = technologyDefinition.prerequisiteTechnologyIds[prerequisiteIndex];

            prerequisiteTexts.push(formatTechnologyReference(prerequisiteTechnologyId, state));
        }

        if (technologyDefinition.alternativePrerequisiteTechnologyIds.length > 0) {
            // string[] OR 前置文本数组：列出任意完成一项即可的父科技。
            var alternativeTexts = [];

            // number OR 前置循环索引：遍历备选父科技 ID。
            for (var alternativeIndex = 0; alternativeIndex < technologyDefinition.alternativePrerequisiteTechnologyIds.length; alternativeIndex += 1) {
                // TechnologyId 备选前置科技 ID：用于查找中文名与完成状态。
                var alternativeTechnologyId = technologyDefinition.alternativePrerequisiteTechnologyIds[alternativeIndex];

                alternativeTexts.push(formatTechnologyReference(alternativeTechnologyId, state));
            }

            prerequisiteTexts.push("任一：" + alternativeTexts.join(" / "));
        }

        // number 触发条件循环索引：遍历非科技系统触发条件。
        for (var triggerIndex = 0; triggerIndex < technologyDefinition.triggerConditions.length; triggerIndex += 1) {
            // TechnologyTriggerCondition 触发条件：用于展示具名来源而非伪装成无前置。
            var triggerCondition = technologyDefinition.triggerConditions[triggerIndex];

            prerequisiteTexts.push(triggerCondition.label);
        }

        return prerequisiteTexts.length > 0 ? "前置：" + prerequisiteTexts.join("；") : "前置：研究入口";
    }

    /**
     * 格式化单个父科技引用及其完成图形。
     *
     * @param {TechnologyId} technologyId - 父科技稳定 ID。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 带“✓”或“○”状态图形的科技名。
     */
    function formatTechnologyReference(technologyId, state) {
        // TechnologyDefinition|null 科技定义：用于读取中文名。
        var technologyDefinition = game.technology.getTechnologyDefinition(technologyId);

        return (hasTechnologyResearched(state, technologyId) ? "✓ " : "○ ") + (technologyDefinition ? technologyDefinition.name : technologyId);
    }

    /**
     * 格式化科技真实后继方向。
     *
     * @param {TechnologyId} technologyId - 当前科技稳定 ID。
     * @returns {string} 后继科技中文名列表；终点返回“路线终点”。
     */
    function formatTechnologySuccessors(technologyId) {
        // string[] 后继名称数组：从真实 unlocks.technologies 反向读取，避免 UI 自行猜测。
        var successorNames = [];

        // number 科技循环索引：遍历全部科技定义的整数下标。
        for (var technologyIndex = 0; technologyIndex < game.definitions.TECHNOLOGY_DEFINITIONS.length; technologyIndex += 1) {
            // TechnologyDefinition 科技定义：用于检查其展示前置是否引用当前科技。
            var technologyDefinition = game.definitions.TECHNOLOGY_DEFINITIONS[technologyIndex];

            if (technologyDefinition.prerequisiteTechnologyIds.indexOf(technologyId) !== -1 || technologyDefinition.alternativePrerequisiteTechnologyIds.indexOf(technologyId) !== -1) {
                successorNames.push(technologyDefinition.name);
            }
        }

        return successorNames.length > 0 ? successorNames.join("，") : "路线终点";
    }

    /**
     * 取得研究状态中文标签，文字与图形共同表达状态。
     *
     * @param {string} researchStatus - 研究状态 ID。
     * @returns {string} 带状态图形的中文标签。
     */
    function getResearchStatusLabel(researchStatus) {
        // Object.<string, string> 状态标签字典：key 为封闭研究状态 ID，value 为图形与中文标签。
        var statusLabelsById = {
            unknown: "？ 未知",
            preview: "◇ 待前置",
            unaffordable: "△ 资源不足",
            available: "◆ 可研究",
            researched: "✓ 已完成"
        };

        return statusLabelsById[researchStatus] || researchStatus;
    }

    /**
     * 取得研究按钮文案。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} researchStatus - 当前研究状态 ID。
     * @param {string[]} missingTexts - 当前资源缺口文本数组。
     * @returns {string} 精确描述完成、暂停、前置、缺口或可研究状态的按钮文案。
     */
    function getResearchButtonLabel(state, researchStatus, missingTexts) {
        if (researchStatus === "researched") {
            return "已完成";
        }

        if (researchStatus === "preview") {
            return "需完成前置";
        }

        if (state.isPaused) {
            return "已暂停";
        }

        if (researchStatus === "unaffordable") {
            return missingTexts.length > 0 ? "缺少资源" : "资源不足";
        }

        return "研究";
    }

    /**
     * 取得节点连接线类型，供主干、跨路线和特殊系统触发使用不同线型。
     *
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {"none"|"main"|"cross"|"special"} 连接线类型 ID。
     */
    function getTechnologyConnectionType(technologyDefinition) {
        if (technologyDefinition.triggerConditions.length > 0) {
            return "special";
        }

        // TechnologyId[] 全部展示父科技 ID：用于判断是否存在跨路线依赖。
        var parentTechnologyIds = technologyDefinition.prerequisiteTechnologyIds.concat(technologyDefinition.alternativePrerequisiteTechnologyIds);

        if (parentTechnologyIds.length === 0) {
            return "none";
        }

        // number 父科技循环索引：遍历前置定义的整数下标。
        for (var parentIndex = 0; parentIndex < parentTechnologyIds.length; parentIndex += 1) {
            // TechnologyDefinition|null 父科技定义：用于比较路线 ID。
            var parentTechnology = game.technology.getTechnologyDefinition(parentTechnologyIds[parentIndex]);

            if (parentTechnology && parentTechnology.lineId !== technologyDefinition.lineId) {
                return "cross";
            }
        }

        return "main";
    }

    /**
     * 取得首个未完成前置科技，供预览卡一次点击定位。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyDefinition} technologyDefinition - 当前科技定义。
     * @returns {TechnologyId|null} 首个未完成父科技 ID；无需定位时返回 null。
     */
    function getFirstUnfinishedPrerequisiteTechnologyId(state, technologyDefinition) {
        // number AND 前置循环索引：优先返回必须完成但尚未完成的父科技。
        for (var prerequisiteIndex = 0; prerequisiteIndex < technologyDefinition.prerequisiteTechnologyIds.length; prerequisiteIndex += 1) {
            // TechnologyId 前置科技 ID：用于检查完成状态。
            var prerequisiteTechnologyId = technologyDefinition.prerequisiteTechnologyIds[prerequisiteIndex];

            if (!hasTechnologyResearched(state, prerequisiteTechnologyId)) {
                return prerequisiteTechnologyId;
            }
        }

        if (technologyDefinition.alternativePrerequisiteTechnologyIds.length === 0 || areTechnologyPrerequisitesMet(state, technologyDefinition)) {
            return null;
        }

        return technologyDefinition.alternativePrerequisiteTechnologyIds[0];
    }

    /**
     * 计算科技成本排序值。
     *
     * @param {TechnologyDefinition} technologyDefinition - 科技定义对象。
     * @returns {number} 成本排序值，非负资源数量。
     */
    function getTechnologyCostScore(technologyDefinition) {
        // number 成本合计：按价格数量简单累加用于排序。
        var costScore = 0;

        // number 循环索引：遍历科技价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < technologyDefinition.price.length; priceIndex += 1) {
            // Price 当前价格项：用于累加成本数量。
            var priceEntry = technologyDefinition.price[priceIndex];

            costScore += priceEntry.amount;
        }

        return costScore;
    }

    /**
     * 格式化科技解锁包预览。
     *
     * @param {UnlockBundle} unlocks - 科技完成后应用的解锁包。
     * @returns {string} 解锁包中文预览文本。
     */
    function formatUnlockPreview(unlocks) {
        // string[] 预览文本数组：按解锁字段拼接。
        var previewTexts = [];

        appendUnlockPreview(previewTexts, "资源", unlocks.resources, "resource");
        appendUnlockPreview(previewTexts, "科技", unlocks.technologies, "technology");
        appendUnlockPreview(previewTexts, "建筑", unlocks.buildings, "building");
        appendUnlockPreview(previewTexts, "职业", unlocks.jobs, "job");
        appendUnlockPreview(previewTexts, "标签", unlocks.tabs, "tab");
        appendUnlockPreview(previewTexts, "配方", unlocks.crafts || unlocks.recipes, "craft");
        appendUnlockPreview(previewTexts, "升级", unlocks.upgrades, "upgrade");
        appendUnlockPreview(previewTexts, "政策", unlocks.policies, "policy");
        return previewTexts.length > 0 ? previewTexts.join("；") : "无";
    }

    /**
     * 追加单类解锁预览。
     *
     * @param {string[]} previewTexts - 预览文本数组，会被写入。
     * @param {string} labelText - 解锁类别中文名。
     * @param {string[]} unlockIds - 解锁 ID 数组，可省略。
     * @param {"resource"|"technology"|"building"|"job"|"tab"|"craft"|"upgrade"|"policy"} definitionType - 解锁对象类别，用于查找中文显示名。
     * @returns {void} 无返回值。
     */
    function appendUnlockPreview(previewTexts, labelText, unlockIds, definitionType) {
        if (!unlockIds || unlockIds.length === 0) {
            return;
        }

        // string[] 显示名数组：将稳定 ID 转为中文名称后展示在研究卡片中。
        var displayNames = [];

        // number 循环索引：遍历当前类别解锁 ID 数组的整数下标。
        for (var unlockIndex = 0; unlockIndex < unlockIds.length; unlockIndex += 1) {
            // string 当前解锁 ID：用于按类别查找中文显示名。
            var unlockId = unlockIds[unlockIndex];

            displayNames.push(formatUnlockDisplayName(definitionType, unlockId));
        }

        previewTexts.push(labelText + " " + displayNames.join("，"));
    }

    /**
     * 格式化单个解锁对象的显示名。
     *
     * @param {"resource"|"technology"|"building"|"job"|"tab"|"craft"|"upgrade"|"policy"} definitionType - 解锁对象类别，用于选择定义表。
     * @param {string} unlockId - 解锁对象稳定 ID。
     * @returns {string} 已登记且非空的中文显示名。
     * @throws {Error} 定义或严格中文名缺失时抛出开发错误。
     */
    function formatUnlockDisplayName(definitionType, unlockId) {
        if (definitionType === "resource") {
            return game.resources.getResourceDisplayName(unlockId);
        }

        if (definitionType === "technology") {
            // TechnologyDefinition|null 科技定义：用于读取科技中文名。
            var technologyDefinition = game.technology.getTechnologyDefinition(unlockId);

            return getStrictDefinitionDisplayName("科技", unlockId, technologyDefinition);
        }

        if (definitionType === "building") {
            // BuildingDefinition|null 建筑定义：用于读取建筑中文名。
            var buildingDefinition = game.buildings.getBuildingDefinition(unlockId);

            return getStrictDefinitionDisplayName("建筑", unlockId, buildingDefinition);
        }

        if (definitionType === "job") {
            // JobDefinition|null 职业定义：用于读取职业中文名。
            var jobDefinition = game.jobs.getJobDefinition(unlockId);

            return getStrictDefinitionDisplayName("职业", unlockId, jobDefinition);
        }

        if (definitionType === "policy" && game.policiesSystem) {
            // PolicyDefinition|null 政策定义：用于读取政策中文名。
            var policyDefinition = game.policiesSystem.getPolicyDefinition(unlockId);

            return getStrictDefinitionDisplayName("政策", unlockId, policyDefinition);
        }

        if (definitionType === "craft" && game.crafting) {
            // CraftRecipeDefinition|null 配方定义：用于读取配方中文名。
            var recipeDefinition = game.crafting.getRecipeDefinition(unlockId);

            return getStrictDefinitionDisplayName("配方", unlockId, recipeDefinition);
        }

        if (definitionType === "upgrade" && game.rituals) {
            // RitualUpgradeDefinition|null 祖灵升级定义：用于读取升级中文名。
            var upgradeDefinition = game.rituals.getRitualUpgradeDefinition(unlockId);

            return getStrictDefinitionDisplayName("升级", unlockId, upgradeDefinition);
        }

        if (definitionType === "tab") {
            return findDefinitionNameById(game.definitions.TAB_DEFINITIONS, unlockId);
        }

        throw new Error("不支持的显示名定义类别：" + definitionType + "，ID：" + unlockId);
    }

    /**
     * 严格读取 ID 对应定义的中文显示名。
     *
     * @param {string} definitionTypeName - 定义类别中文名，用于开发错误。
     * @param {string} definitionId - 稳定内部 ID，仅用于查表和开发错误。
     * @param {{name: string}|null|undefined} definition - 已查询的定义对象。
     * @returns {string} 非空且包含中文字符的玩家显示名。
     * @throws {Error} 定义缺失、名称为空或名称不含中文字符时抛出开发错误。
     */
    function getStrictDefinitionDisplayName(definitionTypeName, definitionId, definition) {
        if (!definition || typeof definition.name !== "string" || !/[\u3400-\u9fff]/.test(definition.name)) {
            throw new Error(definitionTypeName + "缺少严格中文显示名：" + definitionId);
        }

        return definition.name;
    }

    /**
     * 从带 name 字段的定义表中查找中文显示名。
     *
     * @param {{id: string, name: string}[]} definitionList - 定义列表；每项必须包含稳定 ID 和中文显示名。
     * @param {string} definitionId - 要查找的稳定 ID。
     * @returns {string} 已登记且非空的中文显示名。
     * @throws {Error} 定义缺失或没有严格中文名时抛出开发错误。
     */
    function findDefinitionNameById(definitionList, definitionId) {
        // number 循环索引：遍历定义列表的整数下标。
        for (var definitionIndex = 0; definitionIndex < definitionList.length; definitionIndex += 1) {
            // {id: string, name: string} 当前定义项：包含稳定 ID 和中文显示名。
            var definitionEntry = definitionList[definitionIndex];

            if (definitionEntry.id === definitionId) {
                return getStrictDefinitionDisplayName("定义", definitionId, definitionEntry);
            }
        }

        throw new Error("定义缺少严格中文显示名：" + definitionId);
    }

    /**
     * 渲染工坊标签页。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入配方卡片。
     * @returns {void} 无返回值。
     */
    function renderWorkshopTab(state, tabContentElement) {
        // HTMLElement 标题元素：显示工坊标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.workshop.name);

        // HTMLElement 网格元素：承载所有已解锁配方卡片。
        var gridElement = document.createElement("div");

        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.workshopTitle));
        tabContentElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.craftRatio + " x" + game.crafting.calculateCraftMultiplier(state).toFixed(2)));
        // CraftRecipeDefinition|null 自动制作配方定义：用于把运行时配方 ID 转为玩家中文名。
        var autoCraftRecipeDefinition = state.statistics.autoCraftRecipeId ? game.crafting.getRecipeDefinition(state.statistics.autoCraftRecipeId) : null;
        // string 自动制作配方名称：未选择与异常定义均使用中文安全文本。
        var autoCraftRecipeName = state.statistics.autoCraftRecipeId ? getStrictDefinitionDisplayName("配方", state.statistics.autoCraftRecipeId, autoCraftRecipeDefinition) : "未选择";

        tabContentElement.appendChild(createTextElement("p", "工程师：" + game.jobs.countAssigned(state, "engineer") + "，自动制作：" + autoCraftRecipeName + "，速度 " + game.crafting.calculateAutoCraftRate(state).toFixed(2) + "/秒"));
        gridElement.className = "action-grid";

        // number 循环索引：遍历配方定义数组的整数下标。
        for (var recipeIndex = 0; recipeIndex < game.definitions.CRAFT_RECIPE_DEFINITIONS.length; recipeIndex += 1) {
            // CraftRecipeDefinition 当前配方定义：用于渲染工坊卡片。
            var recipeDefinition = game.definitions.CRAFT_RECIPE_DEFINITIONS[recipeIndex];

            if (!game.crafting.isRecipeUnlocked(state, recipeDefinition.id)) {
                continue;
            }

            gridElement.appendChild(renderRecipeCard(state, recipeDefinition));
        }

        tabContentElement.appendChild(gridElement);
    }

    /**
     * 渲染帝国标签页。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入政策组。
     * @returns {void} 无返回值。
     */
    function renderEmpireTab(state, tabContentElement) {
        // HTMLElement 标题元素：显示帝国标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.empire.name);

        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(createTextElement("h3", "治理状态"));
        tabContentElement.appendChild(renderEmpireGovernanceStatus(state));
        tabContentElement.appendChild(createTextElement("h3", "行政建筑与法令"));
        tabContentElement.appendChild(renderAdministrativeStatus(state));
        tabContentElement.appendChild(createTextElement("h3", "统计与成就"));
        tabContentElement.appendChild(renderEmpireAchievements(state));
        tabContentElement.appendChild(createTextElement("h3", "遗产预估"));
        tabContentElement.appendChild(renderLegacyEstimate(state));
        tabContentElement.appendChild(createTextElement("h3", "数值调试"));
        tabContentElement.appendChild(renderBalanceDebugPanel(state));
        tabContentElement.appendChild(createTextElement("h3", "阶段节奏校验"));
        tabContentElement.appendChild(renderPaceChecklist(state));
        tabContentElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.policiesTitle));
        tabContentElement.appendChild(renderPolicyGroups(state));
    }

    /**
     * 渲染帝国治理状态和关键资源。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 治理状态网格元素。
     */
    function renderEmpireGovernanceStatus(state) {
        // HTMLElement 网格元素：承载治理建筑、服从、事故和关键资源状态。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";
        gridElement.appendChild(renderGovernanceCard(state));
        gridElement.appendChild(renderEmpireResourceCard(state));
        return gridElement;
    }

    /**
     * 渲染治理状态卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 治理状态卡片元素。
     */
    function renderGovernanceCard(state) {
        // HTMLElement 卡片元素：显示酋长厅、服从度、事故风险和声望。
        var cardElement = document.createElement("div");

        // BuildingState|null 酋长厅状态：用于读取拥有数。
        var chiefHallState = state.buildingsById.chief_hall || null;

        // ResourceState|null 服从度状态：用于读取当前治理压力。
        var obedienceState = state.resourcesById.obedience || null;

        // ResourceState|null 声望状态：用于读取氏族声望。
        var reputationState = state.resourcesById.reputation || null;

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "治理核心"));
        cardElement.appendChild(createTextElement("p", "酋长厅：" + (chiefHallState ? chiefHallState.owned : 0) + " 座"));
        cardElement.appendChild(createTextElement("p", "服从度：" + (obedienceState ? obedienceState.value.toFixed(1) + " / " + obedienceState.maxValue.toFixed(0) + "（" + formatSignedNumber(obedienceState.perSecond) + "/秒）" : "未显示")));
        cardElement.appendChild(createTextElement("p", "事故风险：" + formatEmpireEventRisk(state)));
        cardElement.appendChild(createTextElement("p", "氏族声望：" + (reputationState ? reputationState.value.toFixed(1) + " / " + reputationState.maxValue.toFixed(0) : "未显示")));
        return cardElement;
    }

    /**
     * 渲染帝国关键资源卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 关键资源卡片元素。
     */
    function renderEmpireResourceCard(state) {
        // HTMLElement 卡片元素：显示金币、账册和战利品。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "关键资源"));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "coin")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "ledger")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "loot")));
        return cardElement;
    }

    /**
     * 格式化帝国事故风险摘要。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 事故风险和稳定修正中文文本。
     */
    function formatEmpireEventRisk(state) {
        // Object.<string, number> 政策效果字典：用于事故修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：用于事故修正。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // Object.<string, number> 挑战效果字典：用于事故修正。
        var challengeEffects = game.challengesSystem ? game.challengesSystem.getRuleEffects(state) : {};

        // number 风险提升比例：正数表示事故更频繁。
        var eventRiskRatio = (policyEffects.eventRiskRatio || 0) + (pactEffects.eventRiskRatio || 0) + (challengeEffects.eventRiskRatio || 0);

        // number 稳定减免比例：正数表示事故被压低。
        var stabilityRatio = (state.statistics.stabilityRatio || 0) + (policyEffects.eventStabilityRatio || 0);

        return "风险 " + formatSignedNumber(eventRiskRatio * 100) + "%，稳定 " + formatSignedNumber(stabilityRatio * 100) + "%";
    }

    /**
     * 渲染行政建筑和法令能力。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 行政建筑网格元素。
     */
    function renderAdministrativeStatus(state) {
        // HTMLElement 网格元素：承载行政建筑和法令能力卡。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";
        gridElement.appendChild(renderAdministrativeBuildingCard(state, "chief_hall"));
        gridElement.appendChild(renderAdministrativeBuildingCard(state, "ledger_room"));
        gridElement.appendChild(renderAdministrativeBuildingCard(state, "black_iron_fortress"));
        gridElement.appendChild(renderDecreeCapacityCard(state));
        return gridElement;
    }

    /**
     * 渲染单个行政建筑状态卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} buildingId - 建筑稳定 ID。
     * @returns {HTMLElement} 行政建筑卡片元素。
     */
    function renderAdministrativeBuildingCard(state, buildingId) {
        // BuildingDefinition|null 建筑定义：用于显示名称、价格和效果。
        var buildingDefinition = game.buildings.getBuildingDefinition(buildingId);

        // BuildingState|null 建筑状态：用于显示拥有数和解锁状态。
        var buildingState = state.buildingsById[buildingId] || null;

        // HTMLElement 卡片元素：承载行政建筑状态。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";

        if (!buildingDefinition || !buildingState) {
            cardElement.appendChild(createTextElement("h3", buildingId));
            cardElement.appendChild(createTextElement("p", "建筑定义缺失。"));
            return cardElement;
        }

        // Price[] 当前价格：行政建筑状态卡用于展示缺口和倒计时。
        var price = game.buildings.getBuildingPrice(state, buildingDefinition);

        // string[] 缺口文本数组：资源不足时显示行政建筑缺口。
        var missingTexts = game.resources.getMissingResourceTexts(state, price);

        cardElement.appendChild(createTextElement("h3", buildingDefinition.name));
        cardElement.appendChild(createTextElement("p", buildingDefinition.description));
        cardElement.appendChild(createTextElement("p", "状态：" + (buildingState.isUnlocked ? "已解锁" : "未解锁") + "，拥有 " + buildingState.owned + " 座"));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.costPrefix + formatPriceList(price)));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.effectPrefix + formatBuildingEffects(buildingDefinition.effects)));
        cardElement.appendChild(createTextElement("p", "解锁：" + formatBuildingUnlockCondition(state, buildingDefinition)));

        if (missingTexts.length > 0) {
            cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.missingPrefix + missingTexts.join("，")));
            appendPriceAvailabilityText(cardElement, state, price);
        } else if (!buildingState.isUnlocked) {
            cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.availabilityPrefix + game.text.TEXT_REGISTRY.ui.unavailable));
        }

        return cardElement;
    }

    /**
     * 渲染法令能力卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 法令能力卡片元素。
     */
    function renderDecreeCapacityCard(state) {
        // HTMLElement 卡片元素：显示等价治理能力。
        var cardElement = document.createElement("div");

        // BuildingState|null 酋长厅状态：用于计算法令槽位。
        var chiefHallState = state.buildingsById.chief_hall || null;

        // number 酋长厅拥有数：每座提供一个基础治理槽。
        var chiefHallCount = chiefHallState ? chiefHallState.owned : 0;

        // number 法令槽位数量：用已启用政策组数量表达治理能力。
        var decreeSlotCount = chiefHallCount + Math.floor(chiefHallCount / 3);

        // string[] 当前政策 ID 数组：从各政策组状态中收集已启用政策。
        var activePolicyIds = Object.keys(state.policies).map(function (policyGroupId) { return state.policies[policyGroupId]; }).filter(Boolean);
        // string[] 当前政策中文名数组：定义异常时由严格显示名助手立即抛出开发错误。
        var activePolicyNames = activePolicyIds.map(function (policyId) {
            // PolicyDefinition|null 当前政策定义：用于玩家可见中文名。
            var policyDefinition = game.policiesSystem.getPolicyDefinition(policyId);
            return getStrictDefinitionDisplayName("政策", policyId, policyDefinition);
        });

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "法令能力"));
        cardElement.appendChild(createTextElement("p", "酋长厅等级：" + chiefHallCount + "，法令槽位：" + decreeSlotCount));
        cardElement.appendChild(createTextElement("p", "当前政策：" + (activePolicyNames.length > 0 ? activePolicyNames.join("，") : "无")));
        cardElement.appendChild(createTextElement("p", "说明：每座酋长厅提供 1 个治理槽，每 3 座额外提供 1 个帝国法令槽。"));
        return cardElement;
    }

    /**
     * 渲染帝国统计和成就入口。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 成就网格元素。
     */
    function renderEmpireAchievements(state) {
        // HTMLElement 网格元素：承载统计和成就卡。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";
        gridElement.appendChild(renderEmpireStatisticsCard(state));
        gridElement.appendChild(renderAchievementCard(state));
        return gridElement;
    }

    /**
     * 渲染帝国统计卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 统计卡片元素。
     */
    function renderEmpireStatisticsCard(state) {
        // HTMLElement 卡片元素：显示长期统计。
        var cardElement = document.createElement("div");

        // number 历史最高人口：使用当前人口补足尚未 tick 的统计。
        var highestPopulation = Math.max(state.statistics.highestPopulation || 0, game.population.countAliveGoblins(state));

        // number 历史粗识总量：使用当前库存补足旧存档。
        var totalKnowledge = Math.max(state.statistics.totalCrudeKnowledgeEarned || 0, state.resourcesById.crudeKnowledge ? state.resourcesById.crudeKnowledge.value : 0);

        // number 深渊门数量：用于成就和遗产预估。
        var abyssGateCount = state.buildingsById.abyss_gate ? state.buildingsById.abyss_gate.owned : 0;

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "长期统计"));
        cardElement.appendChild(createTextElement("p", "历史最高人口：" + highestPopulation));
        cardElement.appendChild(createTextElement("p", "历史总粗识：" + totalKnowledge.toFixed(1)));
        cardElement.appendChild(createTextElement("p", "深渊门数量：" + abyssGateCount));
        cardElement.appendChild(createTextElement("p", "成就奖励：" + game.prestigeSystem.calculateLegacyBreakdown(state).achievementReward + " 帝国遗产"));
        return cardElement;
    }

    /**
     * 渲染成就入口卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 成就卡片元素。
     */
    function renderAchievementCard(state) {
        // HTMLElement 卡片元素：显示关键成就完成状态。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "成就入口"));
        cardElement.appendChild(createTextElement("p", "建立酋长厅：" + formatDone(hasBuildingOwned(state, "chief_hall") || Boolean(state.statistics.hasBuiltChiefHall))));
        cardElement.appendChild(createTextElement("p", "建成黑铁要塞：" + formatDone(hasBuildingOwned(state, "black_iron_fortress") || Boolean(state.statistics.hasBuiltBlackIronFortress))));
        cardElement.appendChild(createTextElement("p", "首次打开深渊门：" + formatDone(hasBuildingOwned(state, "abyss_gate") || Boolean(state.statistics.hasOpenedAbyssGate))));
        cardElement.appendChild(createTextElement("p", "第一次帝国迁徙：" + formatDone(Boolean(state.statistics.hasMigratedEmpire))));
        cardElement.appendChild(createTextElement("p", "挑战完成：" + formatDone(countCompletedChallengesForUi(state) > 0) + "（" + countCompletedChallengesForUi(state) + " 项）"));
        return cardElement;
    }

    /**
     * 渲染帝国遗产预估卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 遗产预估卡片元素。
     */
    function renderLegacyEstimate(state) {
        // HTMLElement 卡片元素：显示策划公式和每项来源。
        var cardElement = document.createElement("div");

        // Object.<string, number> 遗产拆分字典：由威望系统按同一公式计算。
        var legacyBreakdown = game.prestigeSystem.calculateLegacyBreakdown(state);

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "帝国遗产"));
        cardElement.appendChild(createTextElement("p", "预计获得：" + legacyBreakdown.total + " 帝国遗产"));
        cardElement.appendChild(createTextElement("p", "人口来源：sqrt(" + legacyBreakdown.highestPopulation + ") = " + legacyBreakdown.populationLegacy.toFixed(2)));
        cardElement.appendChild(createTextElement("p", "粗识来源：log10(" + legacyBreakdown.totalKnowledge.toFixed(1) + " + 1) x3 = " + legacyBreakdown.knowledgeLegacy.toFixed(2)));
        cardElement.appendChild(createTextElement("p", "深渊门来源：" + legacyBreakdown.abyssGateCount + " x5 = " + legacyBreakdown.abyssGateLegacy.toFixed(0)));
        cardElement.appendChild(createTextElement("p", "成就来源：" + legacyBreakdown.achievementReward));
        return cardElement;
    }

    /**
     * 格式化行政建筑解锁条件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑定义对象。
     * @returns {string} 建筑解锁条件中文文本。
     */
    function formatBuildingUnlockCondition(state, buildingDefinition) {
        if (buildingDefinition.unlock && buildingDefinition.unlock.isDefault) {
            return "默认可见";
        }

        // string[] 条件文本数组：显示建筑解锁后带出的标签和资源。
        var conditionTexts = [];

        if (buildingDefinition.unlock && buildingDefinition.unlock.tabs) {
            conditionTexts.push("解锁标签 " + buildingDefinition.unlock.tabs.join("，"));
        }

        if (buildingDefinition.unlock && buildingDefinition.unlock.resources) {
            conditionTexts.push("显示资源 " + buildingDefinition.unlock.resources.join("，"));
        }

        if (buildingDefinition.unlockRequirements && buildingDefinition.unlockRequirements.statistics) {
            appendStatisticRequirementTexts(state, conditionTexts, buildingDefinition.unlockRequirements.statistics);
        }

        return conditionTexts.length > 0 ? conditionTexts.join("；") : "由科技、建筑或阶段解锁";
    }

    /**
     * 追加统计门槛文本，用于解释建筑额外解锁条件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string[]} conditionTexts - 条件文本数组，会被追加统计门槛说明。
     * @param {StatisticUnlockRequirement[]} statisticRequirements - 统计门槛数组；每项包含 id、minValue 和 description。
     * @returns {void} 无返回值。
     */
    function appendStatisticRequirementTexts(state, conditionTexts, statisticRequirements) {
        // number 循环索引：遍历统计门槛数组的整数下标。
        for (var requirementIndex = 0; requirementIndex < statisticRequirements.length; requirementIndex += 1) {
            // StatisticUnlockRequirement 当前统计门槛：用于生成中文条件说明。
            var statisticRequirement = statisticRequirements[requirementIndex];

            // number 当前统计值：缺省按 0 处理，非负累计数值。
            var statisticValue = Math.max(0, Number(state.statistics[statisticRequirement.id]) || 0);

            // number 最低统计值：达到该值才显示为满足。
            var minValue = Math.max(0, Number(statisticRequirement.minValue) || 0);

            // string 条件说明：优先使用数据表中文说明。
            var requirementDescription = statisticRequirement.description || statisticRequirement.id + " >= " + minValue;

            conditionTexts.push(requirementDescription + "（" + (statisticValue >= minValue ? "满足" : "未满足") + "）");
        }
    }

    /**
     * 格式化完成状态。
     *
     * @param {boolean} isDone - 是否完成；true 显示已完成，false 显示未完成。
     * @returns {string} 完成状态中文文本。
     */
    function formatDone(isDone) {
        return isDone ? "已完成" : "未完成";
    }

    /**
     * 统计界面展示用的已完成挑战数量。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 已完成挑战数量，非负整数。
     */
    function countCompletedChallengesForUi(state) {
        // number 已完成挑战数量：用于成就入口显示。
        var completedCount = 0;

        if (!state.challenges || !state.challenges.completedById) {
            return 0;
        }

        // string[] 挑战 ID 数组：遍历挑战完成字典。
        var challengeIds = Object.keys(state.challenges.completedById);

        // number 循环索引：遍历挑战 ID 数组的整数下标。
        for (var challengeIndex = 0; challengeIndex < challengeIds.length; challengeIndex += 1) {
            // string 当前挑战 ID：用于读取完成标记。
            var challengeId = challengeIds[challengeIndex];

            if (state.challenges.completedById[challengeId] || state.statistics["challengeCompleted_" + challengeId]) {
                completedCount += 1;
            }
        }

        return completedCount;
    }

    /**
     * 渲染数值调试面板。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 数值调试面板元素。
     */
    function renderBalanceDebugPanel(state) {
        // HTMLElement 面板元素：承载产出、成本、人口和事件风险调试信息。
        var panelElement = document.createElement("div");

        panelElement.className = "action-grid";
        panelElement.appendChild(renderProductionBreakdownDebug(state));
        panelElement.appendChild(renderBuildingCostPreviewDebug(state));
        panelElement.appendChild(renderPopulationPressureDebug(state));
        panelElement.appendChild(renderEventRiskDebug(state));
        return panelElement;
    }

    /**
     * 渲染每秒产出拆分调试卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 产出拆分卡片元素。
     */
    function renderProductionBreakdownDebug(state) {
        // HTMLElement 卡片元素：显示各资源当前每秒合计变化。
        var cardElement = document.createElement("div");

        // number 已显示行数：限制调试卡高度。
        var shownCount = 0;

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "每秒产出拆分"));

        // number 循环索引：遍历资源定义数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < game.definitions.RESOURCE_DEFINITIONS.length; resourceIndex += 1) {
            // ResourceDefinition 当前资源定义：用于显示中文名。
            var resourceDefinition = game.definitions.RESOURCE_DEFINITIONS[resourceIndex];

            // ResourceState 当前资源状态：读取每秒变化。
            var resourceState = state.resourcesById[resourceDefinition.id];

            if (!resourceState || Math.abs(resourceState.perSecond) < 0.001) {
                continue;
            }

            shownCount += 1;
            cardElement.appendChild(createTextElement("p", resourceDefinition.name + "：" + formatSignedNumber(resourceState.perSecond) + "/秒（职业、建筑、事件和挑战合计）"));
        }

        if (shownCount === 0) {
            cardElement.appendChild(createTextElement("p", "当前没有可观测的每秒变化。"));
        }

        return cardElement;
    }

    /**
     * 渲染建筑成本预览调试卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 建筑成本预览卡片元素。
     */
    function renderBuildingCostPreviewDebug(state) {
        // HTMLElement 卡片元素：显示已解锁建筑的下一次成本。
        var cardElement = document.createElement("div");

        // number 已显示建筑数：限制预览长度。
        var shownCount = 0;

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "建筑成本预览"));

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于读取价格。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 当前建筑状态：用于判断是否解锁。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (!buildingState || !buildingState.isUnlocked) {
                continue;
            }

            shownCount += 1;
            cardElement.appendChild(createTextElement("p", buildingDefinition.name + "（已有 " + buildingState.owned + "）：" + formatPriceList(game.buildings.getBuildingPrice(state, buildingDefinition))));

            if (shownCount >= 8) {
                break;
            }
        }

        if (shownCount === 0) {
            cardElement.appendChild(createTextElement("p", "当前没有已解锁建筑。"));
        }

        return cardElement;
    }

    /**
     * 渲染人口压力调试卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 人口压力卡片元素。
     */
    function renderPopulationPressureDebug(state) {
        // HTMLElement 卡片元素：显示苗床繁育入口、食物消耗和拥挤度来源。
        var cardElement = document.createElement("div");

        // number 存活人口：用于食物消耗和拥挤度。
        var aliveCount = game.population.countAliveGoblins(state);

        // number 食物口数：当前消耗菌菇的哥布林、俘虏和战兽总数。
        var fungusConsumerCount = game.population.countFungusConsumers(state);

        // number 住房上限：用于拥挤度来源。
        var housingMax = game.population.calculateHousingMax(state);

        // number 拥挤度比例：来自人口系统。
        var crowdingRatio = game.population.calculateCrowdingRatio(state);

        // number 菌菇消耗：当前哥布林、俘虏和战兽理论消耗，单位菌菇/秒。
        var fungusConsumption = game.population.calculateFungusConsumptionPerSecond(state);

        // number 待处置俘虏数量：苗床繁育的直接入口数量。
        var captiveCount = state.captives.length;

        // number 战兽口粮口数：战兽按物种倍率统计，休养时翻倍。
        var warbeastConsumerCount = game.population.countWarbeastFungusConsumers(state);

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "人口压力"));
        cardElement.appendChild(createTextElement("p", "人口/住房：" + aliveCount + " / " + housingMax));
        cardElement.appendChild(createTextElement("p", "口粮口数：" + formatNumber(fungusConsumerCount) + "（俘虏 " + captiveCount + "，战兽 " + formatNumber(warbeastConsumerCount) + "）"));
        cardElement.appendChild(createTextElement("p", "拥挤度：" + Math.round(crowdingRatio * 100) + "%"));
        cardElement.appendChild(createTextElement("p", "菌菇消耗：" + fungusConsumption.toFixed(2) + "/秒"));
        cardElement.appendChild(createTextElement("p", "繁育入口：俘虏卡牌培育新生，驯化战兽苗床"));
        cardElement.appendChild(createTextElement("p", "待处置俘虏：" + captiveCount));
        return cardElement;
    }

    /**
     * 渲染事故概率和政策修正调试卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 事件风险卡片元素。
     */
    function renderEventRiskDebug(state) {
        // HTMLElement 卡片元素：显示事故基础概率和修正来源。
        var cardElement = document.createElement("div");

        // Object.<string, number> 政策效果字典：用于事故修正。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 契约效果字典：用于事故修正。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        // Object.<string, number> 挑战规则效果字典：用于事故修正。
        var challengeEffects = game.challengesSystem ? game.challengesSystem.getRuleEffects(state) : {};

        // number 稳定减免比例：展示当前政策和统计带来的风险降低。
        var stabilityRatio = (state.statistics.stabilityRatio || 0) + (policyEffects.eventStabilityRatio || 0);

        // number 事故风险倍率：展示政策、契约和挑战带来的风险提高。
        var eventRiskRatio = (policyEffects.eventRiskRatio || 0) + (pactEffects.eventRiskRatio || 0) + (challengeEffects.eventRiskRatio || 0);

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "事故概率"));
        cardElement.appendChild(createTextElement("p", "稳定减免：" + Math.round(stabilityRatio * 100) + "%"));
        cardElement.appendChild(createTextElement("p", "风险修正：" + formatSignedNumber(eventRiskRatio * 100) + "%"));
        cardElement.appendChild(createTextElement("p", "政策组：" + formatPolicySummary(state)));

        // number 循环索引：遍历事件定义数组的整数下标。
        for (var eventIndex = 0; eventIndex < game.definitions.EVENT_DEFINITIONS.length && eventIndex < 4; eventIndex += 1) {
            // EventDefinition 当前事件定义：用于显示基础概率。
            var eventDefinition = game.definitions.EVENT_DEFINITIONS[eventIndex];

            cardElement.appendChild(createTextElement("p", eventDefinition.name + " 基础：" + Math.round(eventDefinition.baseChancePerCheck * 1000) / 10 + "%/检查"));
        }

        return cardElement;
    }

    /**
     * 渲染阶段节奏校验列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 阶段节奏校验元素。
     */
    function renderPaceChecklist(state) {
        // HTMLElement 区块元素：承载时间段里程碑和重点风险。
        var sectionElement = document.createElement("section");

        // HTMLElement 阶段网格元素：承载阶段校验卡片。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";
        sectionElement.appendChild(gridElement);
        gridElement.appendChild(renderPaceCard("0-1 分钟", "完成第一个菌菇床和窝棚", hasBuildingOwned(state, "fungus_bed") && hasBuildingOwned(state, "mud_hut")));
        gridElement.appendChild(renderPaceCard("1-5 分钟", "解锁研究，建立采菌/捡柴职业循环", hasBuildingOwned(state, "graffiti_wall") && game.jobs.isJobUnlocked(state, "forager") && game.jobs.isJobUnlocked(state, "woodcutter")));
        gridElement.appendChild(renderPaceCard("5-15 分钟", "解锁储物坑、浅矿井、工匠棚", hasBuildingOwned(state, "storage_pit") && hasBuildingOwned(state, "shallow_mine") && hasBuildingOwned(state, "artisan_shed")));
        gridElement.appendChild(renderPaceCard("15-30 分钟", "完成第一条加工链，建造粗熔炉", hasBuildingOwned(state, "crude_furnace")));
        gridElement.appendChild(renderPaceCard("30-60 分钟", "进入矿坑氏族阶段", hasTechnologyResearched(state, "mining") && game.population.countAliveGoblins(state) >= 5));
        gridElement.appendChild(renderPaceCard("1-3 小时", "建立酋长厅、黑市、训练坑；自然老死后建立祖灵祭坛", hasBuildingOwned(state, "chief_hall") && hasBuildingOwned(state, "black_market") && hasBuildingOwned(state, "training_pit") && hasBuildingOwned(state, "ancestral_altar")));
        gridElement.appendChild(renderPaceCard("3-8 小时", "进入钢铁、机械、政策分支和自动制作阶段", hasTechnologyResearched(state, "steel") && hasTechnologyResearched(state, "machinery") && hasTechnologyResearched(state, "imperial_code")));
        gridElement.appendChild(renderPaceCard("8-20 小时", "建成黑铁要塞、符文机房和高阶外交网络", hasBuildingOwned(state, "black_iron_fortress") && hasBuildingOwned(state, "rune_machine_room") && hasTechnologyResearched(state, "diplomacy")));
        gridElement.appendChild(renderPaceCard("20-60 小时", "打开深渊门，完成第一次帝国迁徙", hasBuildingOwned(state, "abyss_gate") && state.statistics.hasMigratedEmpire));
        sectionElement.appendChild(renderRiskChecklist(state));
        return sectionElement;
    }

    /**
     * 渲染单个阶段校验卡。
     *
     * @param {string} timeRange - 目标时间段中文文本。
     * @param {string} targetText - 阶段目标中文文本。
     * @param {boolean} isComplete - 是否已完成；true 表示目标达成。
     * @returns {HTMLElement} 阶段校验卡片元素。
     */
    function renderPaceCard(timeRange, targetText, isComplete) {
        // HTMLElement 卡片元素：显示阶段目标和状态。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", timeRange));
        cardElement.appendChild(createTextElement("p", targetText));
        cardElement.appendChild(createTextElement("p", isComplete ? "状态：已达成" : "状态：未达成"));
        return cardElement;
    }

    /**
     * 渲染重点风险检查列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 风险检查卡片元素。
     */
    function renderRiskChecklist(state) {
        // HTMLElement 卡片元素：显示当前数值风险提示。
        var cardElement = document.createElement("div");

        // number 存活人口：用于判断早期食物压力和职业意义。
        var aliveCount = game.population.countAliveGoblins(state);

        // number 菌菇每秒变化：用于判断是否可能频繁死局。
        var fungusPerSecond = state.resourcesById.fungus ? state.resourcesById.fungus.perSecond : 0;

        // number 空闲人口：用于判断职业选择是否仍有意义。
        var idleCount = game.population.countIdleGoblins(state);

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "重点风险检查"));
        cardElement.appendChild(createTextElement("p", "早期菌菇压力：" + (aliveCount <= 3 && fungusPerSecond < -0.2 ? "需关注" : "正常")));
        cardElement.appendChild(createTextElement("p", "容量卡死：" + (hasBuildingOwned(state, "storage_pit") || state.resourcesById.fungus.value < state.resourcesById.fungus.maxValue ? "正常" : "需关注")));
        cardElement.appendChild(createTextElement("p", "手工制作决策：" + (hasBuildingOwned(state, "artisan_shed") && game.definitions.CRAFT_RECIPE_DEFINITIONS.length > 0 ? "正常" : "观察中")));
        cardElement.appendChild(createTextElement("p", "苗床繁育节奏：" + (aliveCount > 0 && idleCount / aliveCount > 0.7 ? "需关注" : "正常")));
        cardElement.appendChild(createTextElement("p", "个体曲线：" + (aliveCount > 80 ? "需关注大列表和属性影响" : "正常")));
        return cardElement;
    }

    /**
     * 判断建筑是否拥有。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingId} buildingId - 建筑稳定 ID。
     * @returns {boolean} 是否拥有至少 1 个建筑。
     */
    function hasBuildingOwned(state, buildingId) {
        return Boolean(state.buildingsById[buildingId] && state.buildingsById[buildingId].owned > 0);
    }

    /**
     * 判断科技是否已研究。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {TechnologyId} technologyId - 科技稳定 ID。
     * @returns {boolean} 是否已研究。
     */
    function hasTechnologyResearched(state, technologyId) {
        return Boolean(state.technologiesById[technologyId] && state.technologiesById[technologyId].isResearched);
    }

    /**
     * 格式化政策摘要。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string} 当前政策选择摘要文本。
     */
    function formatPolicySummary(state) {
        // string[] 政策文本数组：用于显示当前所有政策选择。
        var policyTexts = [];

        // string[] 政策组 ID 数组：遍历当前政策选择字典。
        var policyGroupIds = Object.keys(state.policies);

        // number 循环索引：遍历政策组 ID 数组的整数下标。
        for (var policyGroupIndex = 0; policyGroupIndex < policyGroupIds.length; policyGroupIndex += 1) {
            // string 政策组 ID：用于读取当前政策 ID。
            var policyGroupId = policyGroupIds[policyGroupIndex];

            policyTexts.push(policyGroupId + "=" + state.policies[policyGroupId]);
        }

        return policyTexts.length > 0 ? policyTexts.join("，") : "无";
    }

    /**
     * 渲染政策组列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 政策组容器元素。
     */
    function renderPolicyGroups(state) {
        // HTMLElement 容器元素：承载所有已解锁政策组。
        var containerElement = document.createElement("div");

        // string[] 已渲染政策组 ID 数组：避免同组重复创建区块。
        var renderedGroupIds = [];

        // number 循环索引：遍历政策定义数组的整数下标。
        for (var policyIndex = 0; policyIndex < game.definitions.POLICY_DEFINITIONS.length; policyIndex += 1) {
            // PolicyDefinition 当前政策定义：用于判断政策组是否需要渲染。
            var policyDefinition = game.definitions.POLICY_DEFINITIONS[policyIndex];

            if (!game.policiesSystem.isPolicyUnlocked(state, policyDefinition.id) || renderedGroupIds.indexOf(policyDefinition.groupId) !== -1) {
                continue;
            }

            renderedGroupIds.push(policyDefinition.groupId);
            containerElement.appendChild(renderPolicyGroup(state, policyDefinition.groupId, policyDefinition.groupName));
        }

        return containerElement;
    }

    /**
     * 渲染单个政策组。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} groupId - 政策组稳定 ID。
     * @param {string} groupName - 政策组中文显示名。
     * @returns {HTMLElement} 政策组区块元素。
     */
    function renderPolicyGroup(state, groupId, groupName) {
        // HTMLElement 区块元素：承载同组互斥政策。
        var sectionElement = document.createElement("section");

        // HTMLElement 网格元素：承载政策卡片。
        var gridElement = document.createElement("div");

        sectionElement.appendChild(createTextElement("h3", groupName));
        gridElement.className = "action-grid";

        // number 循环索引：遍历政策定义数组的整数下标。
        for (var policyIndex = 0; policyIndex < game.definitions.POLICY_DEFINITIONS.length; policyIndex += 1) {
            // PolicyDefinition 当前政策定义：用于筛选同组政策。
            var policyDefinition = game.definitions.POLICY_DEFINITIONS[policyIndex];

            if (policyDefinition.groupId !== groupId || !game.policiesSystem.isPolicyUnlocked(state, policyDefinition.id)) {
                continue;
            }

            gridElement.appendChild(renderPolicyCard(state, policyDefinition));
        }

        sectionElement.appendChild(gridElement);
        return sectionElement;
    }

    /**
     * 渲染单个政策卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {PolicyDefinition} policyDefinition - 政策定义对象。
     * @returns {HTMLElement} 政策卡片元素。
     */
    function renderPolicyCard(state, policyDefinition) {
        // HTMLElement 卡片元素：承载政策说明和切换按钮。
        var cardElement = document.createElement("div");

        // boolean 是否当前生效：同组当前政策 ID 等于此政策 ID。
        var isActive = state.policies[policyDefinition.groupId] === policyDefinition.id;

        // HTMLButtonElement 政策按钮：点击后切换同组政策。
        var buttonElement = document.createElement("button");

        cardElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.policyId = policyDefinition.id;
        buttonElement.textContent = isActive ? game.text.TEXT_REGISTRY.ui.policyActive : policyDefinition.name;
        buttonElement.disabled = state.isPaused || isActive;
        cardElement.appendChild(createTextElement("h3", policyDefinition.name));
        cardElement.appendChild(createTextElement("p", policyDefinition.description));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.policyEffectPrefix + policyDefinition.effectSummary));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.policyCostPrefix + policyDefinition.costSummary));
        cardElement.appendChild(buttonElement);
        return cardElement;
    }

    /**
     * 渲染祭祀标签页。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入升级和献祭卡片。
     * @returns {void} 无返回值。
     */
    function renderRitualTab(state, tabContentElement) {
        // HTMLElement 标题元素：显示祭祀标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.ritual.name);

        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(createTextElement("h3", "祭祀状态"));
        tabContentElement.appendChild(renderRitualStatus(state));
        tabContentElement.appendChild(createTextElement("h3", "祭祀政策"));
        tabContentElement.appendChild(renderRitualPolicyComparison(state));
        tabContentElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.ritualUpgradesTitle));
        tabContentElement.appendChild(renderRitualUpgrades(state));
        tabContentElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.sacrificesTitle));
        tabContentElement.appendChild(renderSacrifices(state));
    }

    /**
     * 渲染祭祀状态概览。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 祭祀状态网格元素。
     */
    function renderRitualStatus(state) {
        // HTMLElement 网格元素：承载神秘资源、建筑和事故状态。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";
        gridElement.appendChild(renderRitualResourceStatus(state));
        gridElement.appendChild(renderRitualBuildingStatus(state));
        gridElement.appendChild(renderRitualRiskStatus(state));
        return gridElement;
    }

    /**
     * 渲染祭祀资源状态卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 神秘资源状态卡片元素。
     */
    function renderRitualResourceStatus(state) {
        // HTMLElement 卡片元素：显示祖灵、祖灵回响、战利品和深渊回响。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "神秘资源"));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "ancestorSpirit")));
        cardElement.appendChild(createTextElement("p", "战斗祖灵加成：" + formatSignedNumber(calculateAncestorSpiritCombatBonusRatio(state) * 100) + "% 全属性。"));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "ancestralEcho")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "loot")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "abyssEcho")));
        return cardElement;
    }

    /**
     * 计算祖灵对战斗职业哥布林的全属性加成比例。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 战斗职业全属性加成比例，非负小数；每 1 点祖灵为 0.01。
     */
    function calculateAncestorSpiritCombatBonusRatio(state) {
        if (game.jobs && game.jobs.calculateAncestorSpiritAttributeRatio) {
            return game.jobs.calculateAncestorSpiritAttributeRatio(state);
        }

        // ResourceState|null 祖灵资源状态：用于读取当前祖灵数量。
        var ancestorSpiritState = state.resourcesById.ancestorSpirit || null;

        // number 当前祖灵数量：资源缺失时按 0 处理。
        var ancestorSpiritAmount = ancestorSpiritState ? Math.max(0, Number(ancestorSpiritState.value) || 0) : 0;

        return ancestorSpiritAmount * 0.01;
    }

    /**
     * 渲染祭祀建筑和巫医状态卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 祭祀建筑状态卡片元素。
     */
    function renderRitualBuildingStatus(state) {
        // HTMLElement 卡片元素：显示祖灵祭坛、巫医和献祭坑连接情况。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "祭祀建筑"));
        cardElement.appendChild(createTextElement("p", formatRitualBuilding(state, "ancestral_altar")));
        cardElement.appendChild(createTextElement("p", "巫医：" + game.jobs.countAssigned(state, "witch_doctor") + "，职业产出已计入祖灵回响。"));
        cardElement.appendChild(createTextElement("p", formatRitualBuilding(state, "sacrifice_pit")));
        return cardElement;
    }

    /**
     * 渲染祭祀事故风险状态卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 祭祀事故状态卡片元素。
     */
    function renderRitualRiskStatus(state) {
        // HTMLElement 卡片元素：显示事故风险、稳定减免和祭祀挑战状态。
        var cardElement = document.createElement("div");

        // Object.<string, number> 政策效果字典：用于解释事故风险来源。
        var policyEffects = game.policiesSystem ? game.policiesSystem.getPolicyEffects(state) : {};

        // Object.<string, number> 祖灵升级效果字典：用于显示护符类减免。
        var ritualEffects = game.rituals.getRitualEffects(state);

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "事故风险"));
        cardElement.appendChild(createTextElement("p", "政策风险：" + formatSignedNumber((policyEffects.eventRiskRatio || 0) * 100) + "%，政策稳定：" + formatSignedNumber((policyEffects.eventStabilityRatio || 0) * 100) + "%"));
        cardElement.appendChild(createTextElement("p", "祖灵护持：" + formatSignedNumber((ritualEffects.eventStabilityRatio || 0) * 100) + "%，献祭坑每座 +5% 事故风险。"));
        cardElement.appendChild(createTextElement("p", game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state) ? "挑战规则：祭祀与深渊已禁用。" : "挑战规则：祭祀可用。"));
        return cardElement;
    }

    /**
     * 渲染祭祀政策对照。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 祭祀政策对照网格元素。
     */
    function renderRitualPolicyComparison(state) {
        // HTMLElement 网格元素：承载祖灵崇拜和血月献祭政策卡。
        var gridElement = document.createElement("div");

        // string[] 祭祀政策 ID 数组：只展示运行时可切换的互斥祭祀政策。
        var ritualPolicyIds = [
            "ancestor_veneration",
            "blood_moon"
        ];

        gridElement.className = "action-grid";

        // number 循环索引：遍历祭祀政策 ID 数组的整数下标。
        for (var policyIndex = 0; policyIndex < ritualPolicyIds.length; policyIndex += 1) {
            // string 当前政策 ID：用于读取政策定义。
            var policyId = ritualPolicyIds[policyIndex];

            // PolicyDefinition|null 政策定义：用于显示收益、代价和状态。
            var policyDefinition = game.policiesSystem.getPolicyDefinition(policyId);

            if (!policyDefinition || !game.policiesSystem.isPolicyUnlocked(state, policyId)) {
                continue;
            }

            gridElement.appendChild(renderRitualPolicyCard(state, policyDefinition));
        }

        return gridElement;
    }

    /**
     * 渲染单个祭祀政策卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {PolicyDefinition} policyDefinition - 政策定义对象。
     * @returns {HTMLElement} 祭祀政策卡片元素。
     */
    function renderRitualPolicyCard(state, policyDefinition) {
        // HTMLElement 卡片元素：显示祭祀政策收益、代价和当前状态。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", policyDefinition.name));
        cardElement.appendChild(createTextElement("p", state.policies.ritual === policyDefinition.id ? "当前祭祀方式：已启用" : "当前祭祀方式：未启用"));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.policyEffectPrefix + policyDefinition.effectSummary));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.policyCostPrefix + policyDefinition.costSummary));
        return cardElement;
    }

    /**
     * 格式化祭祀资源状态。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} resourceId - 资源稳定 ID。
     * @returns {string} 资源库存、容量和每秒变化中文文本。
     */
    function formatRitualResource(state, resourceId) {
        // ResourceState|null 资源状态：用于读取当前库存、容量和变化率。
        var resourceState = state.resourcesById[resourceId] || null;

        if (!resourceState || !resourceState.isVisible) {
            return game.resources.getResourceDisplayName(resourceId) + "：未显示";
        }

        return game.resources.getResourceDisplayName(resourceId) + "：" + resourceState.value.toFixed(1) + " / " + resourceState.maxValue.toFixed(0) + "（" + formatSignedNumber(resourceState.perSecond) + "/秒）";
    }

    /**
     * 格式化祭祀建筑状态。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} buildingId - 建筑稳定 ID。
     * @returns {string} 建筑拥有数和效果中文文本。
     */
    function formatRitualBuilding(state, buildingId) {
        // BuildingDefinition|null 建筑定义：用于读取中文名和效果。
        var buildingDefinition = game.buildings.getBuildingDefinition(buildingId);

        // BuildingState|null 建筑状态：用于读取拥有数和解锁状态。
        var buildingState = state.buildingsById[buildingId] || null;

        if (!buildingDefinition || !buildingState || !buildingState.isUnlocked) {
            return (buildingDefinition ? buildingDefinition.name : buildingId) + "：未解锁";
        }

        return buildingDefinition.name + "：已有 " + buildingState.owned + "，效果 " + formatBuildingEffects(buildingDefinition.effects);
    }

    /**
     * 渲染祖灵升级列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 祖灵升级网格元素。
     */
    function renderRitualUpgrades(state) {
        // HTMLElement 网格元素：承载祖灵升级卡片。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";

        // number 循环索引：遍历祖灵升级定义数组的整数下标。
        for (var upgradeIndex = 0; upgradeIndex < game.definitions.RITUAL_UPGRADE_DEFINITIONS.length; upgradeIndex += 1) {
            // RitualUpgradeDefinition 当前升级定义：用于渲染升级卡片。
            var upgradeDefinition = game.definitions.RITUAL_UPGRADE_DEFINITIONS[upgradeIndex];

            gridElement.appendChild(renderRitualUpgradeCard(state, upgradeDefinition));
        }

        return gridElement;
    }

    /**
     * 渲染单个祖灵升级卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {RitualUpgradeDefinition} upgradeDefinition - 祖灵升级定义对象。
     * @returns {HTMLElement} 祖灵升级卡片元素。
     */
    function renderRitualUpgradeCard(state, upgradeDefinition) {
        // HTMLElement 卡片元素：承载升级说明和购买按钮。
        var cardElement = document.createElement("div");

        // boolean 是否已购买：控制按钮显示和禁用。
        var isPurchased = game.rituals.isRitualUpgradePurchased(state, upgradeDefinition.id);

        // HTMLButtonElement 升级按钮：点击后购买祖灵升级。
        var buttonElement = document.createElement("button");

        // string[] 缺口文本数组：资源不足时显示祖灵升级缺口。
        var missingTexts = game.resources.getMissingResourceTexts(state, upgradeDefinition.price);

        cardElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.ritualUpgradeId = upgradeDefinition.id;
        buttonElement.textContent = isPurchased ? game.text.TEXT_REGISTRY.ui.ritualPurchased : upgradeDefinition.name;
        buttonElement.disabled = state.isPaused || isPurchased || !game.resources.canAfford(state, upgradeDefinition.price) || (game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state));
        cardElement.appendChild(createTextElement("h3", upgradeDefinition.name));
        cardElement.appendChild(createTextElement("p", upgradeDefinition.description));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.costPrefix + formatPriceList(upgradeDefinition.price)));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.ritualRewardPrefix + formatEffectMap(upgradeDefinition.effects)));
        if (missingTexts.length > 0 && !isPurchased) {
            cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.missingPrefix + missingTexts.join("，")));
            appendPriceAvailabilityText(cardElement, state, upgradeDefinition.price);
        }
        cardElement.appendChild(buttonElement);
        return cardElement;
    }

    /**
     * 渲染献祭操作列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 献祭操作网格元素。
     */
    function renderSacrifices(state) {
        // HTMLElement 网格元素：承载献祭卡片。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";

        // number 循环索引：遍历献祭定义数组的整数下标。
        for (var sacrificeIndex = 0; sacrificeIndex < game.definitions.SACRIFICE_DEFINITIONS.length; sacrificeIndex += 1) {
            // SacrificeDefinition 当前献祭定义：用于渲染献祭卡片。
            var sacrificeDefinition = game.definitions.SACRIFICE_DEFINITIONS[sacrificeIndex];

            gridElement.appendChild(renderSacrificeCard(state, sacrificeDefinition));
        }

        return gridElement;
    }

    /**
     * 渲染单个献祭卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {SacrificeDefinition} sacrificeDefinition - 献祭定义对象。
     * @returns {HTMLElement} 献祭卡片元素。
     */
    function renderSacrificeCard(state, sacrificeDefinition) {
        // HTMLElement 卡片元素：承载献祭预览和按钮。
        var cardElement = document.createElement("div");

        // Object.<string, number|boolean|Price[]> 献祭预览：包含收益、风险和可用状态。
        var preview = game.rituals.previewSacrifice(state, sacrificeDefinition.id);

        // HTMLButtonElement 献祭按钮：点击后执行献祭。
        var buttonElement = document.createElement("button");

        // string[] 缺口文本数组：资源不足时显示献祭缺口。
        var missingTexts = game.resources.getMissingResourceTexts(state, sacrificeDefinition.cost);

        cardElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.sacrificeId = sacrificeDefinition.id;
        buttonElement.textContent = sacrificeDefinition.name;
        buttonElement.disabled = state.isPaused || !preview.isAvailable || !game.resources.canAfford(state, sacrificeDefinition.cost) || (game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state));
        cardElement.appendChild(createTextElement("h3", sacrificeDefinition.name));
        cardElement.appendChild(createTextElement("p", sacrificeDefinition.description));
        cardElement.appendChild(createTextElement("p", "解锁：" + sacrificeDefinition.conditionSummary + "（" + (preview.isAvailable ? "满足" : "未满足") + "）"));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.costPrefix + formatPriceList(sacrificeDefinition.cost)));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.ritualRewardPrefix + "祖灵回响 +" + preview.ancestralEchoReward.toFixed(1)));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.ritualRiskPrefix + "影响具体哥布林：" + (preview.affectsGoblin ? "可能" : "不会") + "，概率 " + Math.round(preview.riskChance * 100) + "%，人口消耗 " + (preview.goblinCost || 0)));
        if (missingTexts.length > 0) {
            cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.missingPrefix + missingTexts.join("，")));
            appendPriceAvailabilityText(cardElement, state, sacrificeDefinition.cost);
        } else if (!preview.isAvailable) {
            cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.availabilityPrefix + game.text.TEXT_REGISTRY.ui.unavailable));
        }
        cardElement.appendChild(buttonElement);
        return cardElement;
    }

    /**
     * 渲染深渊标签页。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入契约和远征卡片。
     * @returns {void} 无返回值。
     */
    function renderAbyssTab(state, tabContentElement) {
        // HTMLElement 标题元素：显示深渊标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.abyss.name);

        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(createTextElement("h3", "深渊状态"));
        tabContentElement.appendChild(renderAbyssStatus(state));
        tabContentElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.pactsTitle));
        tabContentElement.appendChild(renderPactCards(state));
        tabContentElement.appendChild(createTextElement("h3", "深渊远征"));
        tabContentElement.appendChild(renderActiveExpedition(state));
        tabContentElement.appendChild(renderExpeditionRoutes(state));
        tabContentElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.migrationTitle));
        tabContentElement.appendChild(renderMigrationPanel(state));
        tabContentElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.prestigePerksTitle));
        tabContentElement.appendChild(renderPrestigePerkCards(state));
    }

    /**
     * 渲染深渊资源和风险状态。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 深渊状态网格元素。
     */
    function renderAbyssStatus(state) {
        // HTMLElement 网格元素：承载深渊资源、建筑和规则状态。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";
        gridElement.appendChild(renderAbyssResourceStatus(state));
        gridElement.appendChild(renderAbyssInfrastructureStatus(state));
        gridElement.appendChild(renderAbyssRuleStatus(state));
        return gridElement;
    }

    /**
     * 渲染深渊资源状态卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 深渊资源卡片元素。
     */
    function renderAbyssResourceStatus(state) {
        // HTMLElement 卡片元素：显示魔晶、深渊回响、遗物、帝国遗产和裂隙碎片。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "深渊资源"));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "manaCrystal")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "abyssEcho")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "relic")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "imperialLegacy")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "riftShard")));
        return cardElement;
    }

    /**
     * 渲染深渊设施和远征状态卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 深渊设施卡片元素。
     */
    function renderAbyssInfrastructureStatus(state) {
        // HTMLElement 卡片元素：显示深渊门、远征营地和远征队。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "深渊设施"));
        cardElement.appendChild(createTextElement("p", formatRitualBuilding(state, "abyss_gate")));
        cardElement.appendChild(createTextElement("p", formatRitualBuilding(state, "expedition_camp")));
        cardElement.appendChild(createTextElement("p", state.activeExpedition ? "远征队：进行中" : "远征队：空闲"));
        return cardElement;
    }

    /**
     * 渲染深渊腐化和事故规则状态。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 深渊规则卡片元素。
     */
    function renderAbyssRuleStatus(state) {
        // HTMLElement 卡片元素：显示腐化、契约和挑战对深渊的影响。
        var cardElement = document.createElement("div");

        // Object.<string, number> 契约效果字典：用于解释腐化和事故压力。
        var pactEffects = game.pacts ? game.pacts.getPactEffects(state) : {};

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "腐化与风险"));
        cardElement.appendChild(createTextElement("p", "腐化压力：" + formatAbyssCorruptionPressure(state, pactEffects)));
        cardElement.appendChild(createTextElement("p", "事故风险：" + formatEmpireEventRisk(state)));
        cardElement.appendChild(createTextElement("p", game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state) ? "挑战规则：深渊系统禁用。" : "挑战规则：深渊系统可用。"));
        return cardElement;
    }

    /**
     * 格式化深渊腐化压力。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object.<string, number>} pactEffects - 契约效果字典；key 为效果 ID，value 为数值。
     * @returns {string} 腐化压力中文摘要。
     */
    function formatAbyssCorruptionPressure(state, pactEffects) {
        // BuildingState|null 深渊门状态：每座深渊门都会提高深渊接触强度。
        var abyssGateState = state.buildingsById.abyss_gate || null;

        // BuildingState|null 献祭坑状态：献祭坑提供深渊回响但增加风险。
        var sacrificePitState = state.buildingsById.sacrifice_pit || null;

        // ResourceState|null 裂隙碎片状态：库存越多代表越接近裂隙核心阶段。
        var riftShardState = state.resourcesById.riftShard || null;

        // number 深渊门腐化点数：每座深渊门计 2 点压力。
        var gatePressure = (abyssGateState ? abyssGateState.owned : 0) * 2;

        // number 献祭坑腐化点数：每座献祭坑计 1 点压力。
        var pitPressure = sacrificePitState ? sacrificePitState.owned : 0;

        // number 裂隙碎片腐化点数：每 10 个裂隙碎片计 1 点压力。
        var shardPressure = riftShardState ? Math.floor(riftShardState.value / 10) : 0;

        // number 契约腐化点数：契约事故和服从代价换算为压力摘要。
        var pactPressure = Math.round(((pactEffects.eventRiskRatio || 0) + (pactEffects.obedienceDrainPerSecond || 0) * 10) * 10);

        // number 腐化压力总点数：仅用于 UI 分档，不作为隐藏模拟状态。
        var totalPressure = Math.max(0, gatePressure + pitPressure + shardPressure + pactPressure);

        if (totalPressure >= 8) {
            return "高（" + totalPressure + "）：深渊门、裂隙碎片或契约代价正在显著抬高风险。";
        }

        if (totalPressure >= 4) {
            return "中（" + totalPressure + "）：需要关注事故和服从消耗。";
        }

        return "低（" + totalPressure + "）：深渊接触仍可控。";
    }

    /**
     * 渲染当前远征状态。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 当前远征状态元素。
     */
    function renderActiveExpedition(state) {
        // HTMLElement 状态元素：显示当前远征剩余时间和成员。
        var statusElement = document.createElement("div");

        statusElement.className = "status-list";

        if (!state.activeExpedition) {
            statusElement.appendChild(createTextElement("p", "当前没有进行中的远征。"));
            return statusElement;
        }

        // ExpeditionRouteDefinition|null 路线定义：用于显示中文路线名。
        var routeDefinition = game.expeditions.getRouteDefinition(state.activeExpedition.routeId);

        // string 路线名称：未找到定义时回退为路线 ID。
        var routeName = routeDefinition ? routeDefinition.name : state.activeExpedition.routeId;

        statusElement.appendChild(createTextElement("p", "进行中：" + routeName));
        statusElement.appendChild(createTextElement("p", "剩余：" + Math.ceil(state.activeExpedition.remainingSeconds) + " 秒"));
        statusElement.appendChild(createTextElement("p", "成员：" + state.activeExpedition.memberIds.join("，")));
        return statusElement;
    }

    /**
     * 渲染远征路线卡片列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 远征路线卡片网格元素。
     */
    function renderExpeditionRoutes(state) {
        // HTMLElement 网格元素：承载远征路线卡片。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";

        // number 循环索引：遍历远征路线定义数组的整数下标。
        for (var routeIndex = 0; routeIndex < game.definitions.EXPEDITION_ROUTE_DEFINITIONS.length; routeIndex += 1) {
            // ExpeditionRouteDefinition 当前路线定义：用于渲染路线卡片。
            var routeDefinition = game.definitions.EXPEDITION_ROUTE_DEFINITIONS[routeIndex];

            gridElement.appendChild(renderExpeditionRouteCard(state, routeDefinition));
        }

        return gridElement;
    }

    /**
     * 渲染单条远征路线卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {ExpeditionRouteDefinition} routeDefinition - 远征路线定义对象。
     * @returns {HTMLElement} 远征路线卡片元素。
     */
    function renderExpeditionRouteCard(state, routeDefinition) {
        // HTMLElement 卡片元素：承载远征路线风险、收益和按钮。
        var cardElement = document.createElement("div");

        // Object.<string, number|string|Goblin[]|Object> 预览对象：用于显示路线风险和成员。
        var preview = game.expeditions.previewExpedition(state, routeDefinition.id);

        // HTMLButtonElement 远征按钮：点击后启动该路线。
        var buttonElement = document.createElement("button");

        cardElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.expeditionRouteId = routeDefinition.id;
        buttonElement.textContent = routeDefinition.name;
        buttonElement.disabled = state.isPaused || Boolean(state.activeExpedition) || preview.members.length === 0 || (game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state));
        cardElement.appendChild(createTextElement("h3", routeDefinition.name));
        cardElement.appendChild(createTextElement("p", routeDefinition.description));
        cardElement.appendChild(createTextElement("p", "解锁：" + routeDefinition.unlockSummary));
        cardElement.appendChild(createTextElement("p", "耗时：" + routeDefinition.durationSeconds + " 秒"));
        cardElement.appendChild(createTextElement("p", "成功：" + Math.round(preview.successChance * 100) + "%；伤亡：" + Math.round(preview.casualtyChance * 100) + "%"));
        cardElement.appendChild(createTextElement("p", "收益：" + preview.rewardSummary));
        cardElement.appendChild(createTextElement("p", "成员：" + (preview.memberSummary || "无可用哥布林")));
        cardElement.appendChild(createTextElement("p", "契约：" + preview.pactInfluence));
        cardElement.appendChild(buttonElement);
        return cardElement;
    }

    /**
     * 渲染帝国迁徙预览面板。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 帝国迁徙面板元素。
     */
    function renderMigrationPanel(state) {
        // HTMLElement 面板元素：承载迁徙收益、保留和清除说明。
        var panelElement = document.createElement("div");

        // Object.<string, boolean|number|string[]> 迁徙预览：用于显示本次重置结果。
        var preview = game.prestigeSystem.previewMigration(state);

        // HTMLButtonElement 迁徙按钮：点击后直接执行可用的帝国迁徙。
        var buttonElement = document.createElement("button");

        panelElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.empireMigration = "1";
        buttonElement.textContent = game.text.TEXT_REGISTRY.ui.migrateEmpire;
        buttonElement.disabled = state.isPaused || !preview.canMigrate;
        panelElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.migrationGainPrefix + preview.earnedLegacy + " 帝国遗产"));
        panelElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.migrationKeepPrefix + preview.keepTexts.join("，")));
        panelElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.migrationLosePrefix + preview.loseTexts.join("，")));

        if (!preview.canMigrate) {
            panelElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.migrationBlocked));
            panelElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.availabilityPrefix + game.text.TEXT_REGISTRY.ui.unavailable));
        }

        panelElement.appendChild(buttonElement);
        return panelElement;
    }

    /**
     * 渲染威望天赋卡片列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 威望天赋卡片网格元素。
     */
    function renderPrestigePerkCards(state) {
        // HTMLElement 网格元素：承载威望天赋卡片。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";

        // number 循环索引：遍历威望天赋定义数组的整数下标。
        for (var perkIndex = 0; perkIndex < game.definitions.PRESTIGE_PERK_DEFINITIONS.length; perkIndex += 1) {
            // PrestigePerkDefinition 当前威望天赋定义：用于渲染购买卡片。
            var perkDefinition = game.definitions.PRESTIGE_PERK_DEFINITIONS[perkIndex];

            gridElement.appendChild(renderPrestigePerkCard(state, perkDefinition));
        }

        return gridElement;
    }

    /**
     * 渲染单个威望天赋卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {PrestigePerkDefinition} perkDefinition - 威望天赋定义对象。
     * @returns {HTMLElement} 威望天赋卡片元素。
     */
    function renderPrestigePerkCard(state, perkDefinition) {
        // HTMLElement 卡片元素：承载威望天赋说明和购买按钮。
        var cardElement = document.createElement("div");

        // boolean 是否已购买：用于按钮文案和禁用状态。
        var isPurchased = game.prestigeSystem.isPrestigePerkPurchased(state, perkDefinition.id);

        // HTMLButtonElement 购买按钮：点击后购买威望天赋。
        var buttonElement = document.createElement("button");

        cardElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.prestigePerkId = perkDefinition.id;
        buttonElement.textContent = isPurchased ? game.text.TEXT_REGISTRY.ui.prestigePerkPurchased : perkDefinition.name;
        buttonElement.disabled = state.isPaused || isPurchased || state.prestige.legacy < perkDefinition.cost;
        cardElement.appendChild(createTextElement("h3", perkDefinition.name));
        cardElement.appendChild(createTextElement("p", perkDefinition.description));
        cardElement.appendChild(createTextElement("p", "成本：帝国遗产 " + perkDefinition.cost));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.policyEffectPrefix + perkDefinition.effectSummary));
        if (!isPurchased && state.prestige.legacy < perkDefinition.cost) {
            cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.availabilityPrefix + game.text.TEXT_REGISTRY.ui.unavailable));
        }
        cardElement.appendChild(buttonElement);
        return cardElement;
    }

    /**
     * 渲染契约卡片列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 契约卡片网格元素。
     */
    function renderPactCards(state) {
        // HTMLElement 网格元素：承载深渊契约卡片。
        var gridElement = document.createElement("div");

        gridElement.className = "action-grid";

        // number 循环索引：遍历契约定义数组的整数下标。
        for (var pactIndex = 0; pactIndex < game.definitions.PACT_DEFINITIONS.length; pactIndex += 1) {
            // PactDefinition 当前契约定义：用于渲染契约卡片。
            var pactDefinition = game.definitions.PACT_DEFINITIONS[pactIndex];

            gridElement.appendChild(renderPactCard(state, pactDefinition));
        }

        return gridElement;
    }

    /**
     * 渲染单个契约卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {PactDefinition} pactDefinition - 契约定义对象。
     * @returns {HTMLElement} 契约卡片元素。
     */
    function renderPactCard(state, pactDefinition) {
        // HTMLElement 卡片元素：承载契约收益、代价和切换按钮。
        var cardElement = document.createElement("div");

        // boolean 是否已启用：用于按钮显示。
        var isActive = game.pacts.isPactActive(state, pactDefinition.id);

        // HTMLButtonElement 契约按钮：点击后切换契约。
        var buttonElement = document.createElement("button");

        cardElement.className = "action-card";
        buttonElement.type = "button";
        buttonElement.dataset.pactId = pactDefinition.id;
        buttonElement.textContent = isActive ? game.text.TEXT_REGISTRY.ui.pactActive : pactDefinition.name;
        buttonElement.disabled = state.isPaused || (game.challengesSystem && game.challengesSystem.isRitualAndAbyssDisabled(state));
        cardElement.appendChild(createTextElement("h3", pactDefinition.name));
        cardElement.appendChild(createTextElement("p", pactDefinition.description));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.policyEffectPrefix + pactDefinition.effectSummary));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.policyCostPrefix + pactDefinition.costSummary));
        cardElement.appendChild(buttonElement);
        return cardElement;
    }

    /**
     * 渲染单个配方卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CraftRecipeDefinition} recipeDefinition - 配方定义对象。
     * @returns {HTMLElement} 配方卡片元素。
     */
    function renderRecipeCard(state, recipeDefinition) {
        // HTMLElement 卡片元素：承载单个配方制作入口。
        var cardElement = document.createElement("div");

        // ResourceDefinition|null 产出资源定义：用于显示中文产物名。
        var outputDefinition = game.resources.getResourceDefinition(recipeDefinition.outputResource);

        // string 产出名称：优先使用资源中文名。
        var outputName = outputDefinition ? outputDefinition.name : recipeDefinition.outputResource;

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", recipeDefinition.name));
        cardElement.appendChild(createTextElement("p", recipeDefinition.description));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.costPrefix + formatPriceList(recipeDefinition.price)));
        cardElement.appendChild(createTextElement("p", "产出：" + outputName + " x" + recipeDefinition.outputAmount));

        // string[] 缺口文本数组：用于显示暂时不可制作原因。
        var missingTexts = game.resources.getMissingResourceTexts(state, recipeDefinition.price);

        if (missingTexts.length > 0) {
            cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.missingPrefix + missingTexts.join("，")));
            appendPriceAvailabilityText(cardElement, state, recipeDefinition.price);
        }

        cardElement.appendChild(createCraftButton(state, recipeDefinition, 1, "1"));
        cardElement.appendChild(createCraftButton(state, recipeDefinition, 10, "10"));
        cardElement.appendChild(createCraftButton(state, recipeDefinition, 100, "100"));
        cardElement.appendChild(createCraftButton(state, recipeDefinition, "all", game.text.TEXT_REGISTRY.ui.craftAll));
        cardElement.appendChild(createAutoCraftButton(state, recipeDefinition));
        return cardElement;
    }

    /**
     * 创建自动制作选择按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CraftRecipeDefinition} recipeDefinition - 配方定义对象。
     * @returns {HTMLButtonElement} 自动制作按钮元素。
     */
    function createAutoCraftButton(state, recipeDefinition) {
        // HTMLButtonElement 按钮元素：选择工程师自动制作配方。
        var buttonElement = document.createElement("button");

        // boolean 是否当前自动制作配方：用于禁用重复选择。
        var isSelected = state.statistics.autoCraftRecipeId === recipeDefinition.id;

        buttonElement.type = "button";
        buttonElement.dataset.autoCraftRecipeId = recipeDefinition.id;
        buttonElement.textContent = isSelected ? "自动中" : "自动";
        buttonElement.disabled = state.isPaused || isSelected;
        return buttonElement;
    }

    /**
     * 创建制作按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {CraftRecipeDefinition} recipeDefinition - 配方定义对象。
     * @param {number|string} craftCount - 制作次数；"all" 表示全部。
     * @param {string} labelText - 按钮中文文本。
     * @returns {HTMLButtonElement} 制作按钮元素。
     */
    function createCraftButton(state, recipeDefinition, craftCount, labelText) {
        // HTMLButtonElement 按钮元素：执行指定批量制作。
        var buttonElement = document.createElement("button");

        // number 校验次数：用于判断按钮是否应启用。
        var checkCount = craftCount === "all" ? game.crafting.calculateMaxCraftable(state, recipeDefinition) : craftCount;

        buttonElement.type = "button";
        buttonElement.dataset.recipeId = recipeDefinition.id;
        buttonElement.dataset.craftCount = String(craftCount);
        buttonElement.textContent = labelText;
        buttonElement.disabled = !game.crafting.canCraft(state, recipeDefinition, checkCount);
        return buttonElement;
    }

    /**
     * 渲染外交标签页。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} tabContentElement - 标签页内容容器，会被写入外交或掠夺子标签列表。
     * @returns {void} 无返回值。
     */
    function renderDiplomacyTab(state, tabContentElement) {
        // HTMLElement 标题元素：显示外交标签页名称。
        var headingElement = createTextElement("h2", game.text.TEXT_REGISTRY.tabs.diplomacy.name);

        // string 当前外交子标签 ID：运行时界面状态，默认显示外交。
        var activeSubtabId = getActiveDiplomacySubtab();

        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(renderDiplomacySubtabButtons(state, activeSubtabId));
        tabContentElement.appendChild(renderActiveDiplomacyMissionList(state));

        if (activeSubtabId === "raid") {
            tabContentElement.appendChild(renderRaidSubtab(state));
            return;
        }

        tabContentElement.appendChild(renderTradeSubtab(state));
    }

    /**
     * 读取当前外交子标签。
     *
     * @returns {string} 外交子标签 ID；取值为 diplomacy 或 raid。
     */
    function getActiveDiplomacySubtab() {
        if (!game.runtime || game.runtime.activeDiplomacySubtab !== "raid") {
            return "diplomacy";
        }

        return "raid";
    }

    /**
     * 渲染外交页的二级标签按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} activeSubtabId - 当前外交子标签 ID。
     * @returns {HTMLElement} 子标签按钮容器。
     */
    function renderDiplomacySubtabButtons(state, activeSubtabId) {
        // HTMLElement 子标签容器：承载外交和掠夺两个二级标签。
        var subtabListElement = document.createElement("div");

        // HTMLButtonElement 外交按钮：切换到贸易与关系地点列表。
        var diplomacyButtonElement = createDiplomacySubtabButton("diplomacy", "外交", activeSubtabId === "diplomacy", false);

        // HTMLButtonElement 掠夺按钮：切换到军事地点列表，未解锁战斗职业时置灰。
        var raidButtonElement = createDiplomacySubtabButton("raid", "掠夺", activeSubtabId === "raid", !isRaidSubtabUnlocked(state));

        subtabListElement.className = "tab-list diplomacy-subtabs";
        subtabListElement.setAttribute("role", "tablist");
        subtabListElement.appendChild(diplomacyButtonElement);
        subtabListElement.appendChild(raidButtonElement);
        return subtabListElement;
    }

    /**
     * 渲染在途外交行动列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 在途行动区块。
     */
    function renderActiveDiplomacyMissionList(state) {
        // HTMLElement 区块元素：承载返程中的贸易队和掠夺队。
        var sectionElement = document.createElement("section");

        // HTMLElement 列表元素：按紧凑行显示在途行动。
        var listElement = document.createElement("div");

        sectionElement.className = "active-mission-section";
        listElement.className = "location-list";
        sectionElement.appendChild(createTextElement("h3", "在途行动"));

        if (!Array.isArray(state.activeDiplomacyMissions) || state.activeDiplomacyMissions.length <= 0) {
            sectionElement.appendChild(createTextElement("p", "当前没有返程中的贸易队或掠夺队。"));
            return sectionElement;
        }

        // number 行动循环索引：遍历在途外交行动数组的整数下标。
        for (var missionIndex = 0; missionIndex < state.activeDiplomacyMissions.length; missionIndex += 1) {
            // DiplomacyMissionState 当前行动：用于渲染返程状态行。
            var mission = state.activeDiplomacyMissions[missionIndex];

            listElement.appendChild(renderActiveDiplomacyMissionRow(mission));
        }

        sectionElement.appendChild(listElement);
        return sectionElement;
    }

    /**
     * 渲染单个在途外交行动行。
     *
     * @param {DiplomacyMissionState} mission - 在途外交行动状态，不会被修改。
     * @returns {HTMLElement} 在途行动行元素。
     */
    function renderActiveDiplomacyMissionRow(mission) {
        // HTMLElement 行元素：显示行动类型、地点和剩余时间。
        var rowElement = document.createElement("div");

        // string 行动类型文本：区分贸易队和掠夺队。
        var modeText = mission.modeId === "raid" ? "掠夺队" : "贸易队";

        rowElement.className = "resource-row location-row active-mission-row";
        rowElement.appendChild(createLocationMainElement(getDiplomacyMissionName(mission), modeText));
        rowElement.appendChild(createTextElement("span", "剩余 " + formatSecondsText(mission.remainingSeconds)));
        rowElement.appendChild(createTextElement("span", "总程 " + formatSecondsText(mission.totalSeconds)));
        rowElement.appendChild(createTextElement("span", mission.modeId === "raid" ? "成员 " + mission.raiderIds.length : "商队返程"));
        return rowElement;
    }

    /**
     * 获取在途外交行动的中文地点名。
     *
     * @param {DiplomacyMissionState} mission - 在途外交行动状态，不会被修改。
     * @returns {string} 中文地点名；缺失定义时回退显示稳定 ID。
     */
    function getDiplomacyMissionName(mission) {
        if (mission.modeId === "raid") {
            // RaidTargetDefinition|null 掠夺目标定义：用于显示中文地点名。
            var raidTargetDefinition = game.raids.getRaidTargetDefinition(mission.locationId);

            return raidTargetDefinition ? raidTargetDefinition.name : mission.locationId;
        }

        // FactionTradeDefinition|null 阵营定义：用于显示中文贸易地点名。
        var factionDefinition = game.diplomacy.getFactionDefinition(mission.locationId);

        return factionDefinition ? factionDefinition.name : mission.locationId;
    }

    /**
     * 创建外交二级标签按钮。
     *
     * @param {string} subtabId - 子标签稳定 ID。
     * @param {string} labelText - 按钮中文显示文本。
     * @param {boolean} isSelected - 是否为当前选中子标签；true 表示高亮。
     * @param {boolean} isDisabled - 是否禁用；true 表示当前不可切换。
     * @returns {HTMLButtonElement} 子标签按钮元素。
     */
    function createDiplomacySubtabButton(subtabId, labelText, isSelected, isDisabled) {
        // HTMLButtonElement 按钮元素：写入子标签切换数据属性。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.diplomacySubtab = subtabId;
        buttonElement.textContent = labelText;
        buttonElement.disabled = isDisabled;
        buttonElement.setAttribute("role", "tab");
        buttonElement.setAttribute("aria-selected", String(isSelected));
        return buttonElement;
    }

    /**
     * 判断掠夺子标签是否解锁。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {boolean} 是否解锁；true 表示抢掠兵或战争头目职业已经解锁。
     */
    function isRaidSubtabUnlocked(state) {
        return game.jobs.isJobUnlocked(state, "raider") || game.jobs.isJobUnlocked(state, "war_chief");
    }

    /**
     * 渲染外交子标签内容。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 外交地点子标签区块。
     */
    function renderTradeSubtab(state) {
        // HTMLElement 区块元素：承载贸易地点的世界和势力子标签。
        var sectionElement = document.createElement("section");

        sectionElement.appendChild(createTextElement("h3", "外交地点"));
        sectionElement.appendChild(renderDiplomacyLocationGroups(state, "diplomacy"));
        return sectionElement;
    }

    /**
     * 渲染掠夺子标签内容。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 掠夺地点子标签区块。
     */
    function renderRaidSubtab(state) {
        // HTMLElement 区块元素：承载掠夺地点的世界和势力子标签。
        var sectionElement = document.createElement("section");

        sectionElement.appendChild(createTextElement("h3", "掠夺地点"));
        sectionElement.appendChild(createTextElement("p", "派出抢掠兵或战争头目，按地点距离返程后结算；掠夺不消耗劳力，每名战斗哥布林消耗 100 菌菇。"));

        if (!isRaidSubtabUnlocked(state)) {
            sectionElement.appendChild(createTextElement("p", "需要解锁抢掠兵或战争头目后才能发起掠夺。"));
            return sectionElement;
        }

        sectionElement.appendChild(renderDiplomacyLocationGroups(state, "raid"));
        return sectionElement;
    }

    /**
     * 渲染外交或掠夺地点的世界与势力子标签。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @returns {HTMLElement} 地点分组容器。
     */
    function renderDiplomacyLocationGroups(state, modeId) {
        // HTMLElement 容器元素：承载世界子标签、势力子标签和当前地点列表。
        var containerElement = document.createElement("div");

        // DiplomacyWorldDefinition|null 当前世界定义：由子标签状态或可用地点推断。
        var activeWorldDefinition = getActiveDiplomacyWorldDefinition(modeId);

        containerElement.className = "location-world-list";
        containerElement.appendChild(renderDiplomacyWorldSubtabs(modeId, activeWorldDefinition));

        if (!activeWorldDefinition) {
            containerElement.appendChild(createTextElement("p", "暂无可用地点。"));
            return containerElement;
        }

        // FactionTradeDefinition|null 当前势力定义：由子标签状态或当前世界第一个可用势力推断。
        var activeFactionDefinition = getActiveDiplomacyFactionDefinition(modeId, activeWorldDefinition.id);

        containerElement.appendChild(renderDiplomacyFactionSubtabs(modeId, activeWorldDefinition.id, activeFactionDefinition));

        if (!activeFactionDefinition) {
            containerElement.appendChild(createTextElement("p", "当前世界暂无可用势力。"));
            return containerElement;
        }

        containerElement.appendChild(renderDiplomacyFactionSection(state, modeId, activeFactionDefinition));
        return containerElement;
    }

    /**
     * 读取当前模式的世界子标签定义。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @returns {DiplomacyWorldDefinition|null} 当前世界定义；没有可用地点时返回 null。
     */
    function getActiveDiplomacyWorldDefinition(modeId) {
        // DiplomacyWorldDefinition[] 可用世界定义数组：只包含当前模式有地点的世界。
        var availableWorldDefinitions = getAvailableDiplomacyWorldDefinitions(modeId);

        if (availableWorldDefinitions.length <= 0) {
            return null;
        }

        // string|null 当前世界 ID：读取运行时 UI 状态。
        var activeWorldId = game.runtime && game.runtime.activeDiplomacyWorldByModeId ? game.runtime.activeDiplomacyWorldByModeId[modeId] : null;

        // number 世界循环索引：遍历可用世界定义数组的整数下标。
        for (var worldIndex = 0; worldIndex < availableWorldDefinitions.length; worldIndex += 1) {
            // DiplomacyWorldDefinition 当前世界定义：用于匹配运行时选中状态。
            var worldDefinition = availableWorldDefinitions[worldIndex];

            if (worldDefinition.id === activeWorldId) {
                return worldDefinition;
            }
        }

        return availableWorldDefinitions[0];
    }

    /**
     * 获取当前模式下有地点的世界定义。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @returns {DiplomacyWorldDefinition[]} 可用世界定义数组。
     */
    function getAvailableDiplomacyWorldDefinitions(modeId) {
        // DiplomacyWorldDefinition[] 可用世界定义数组：用于渲染世界子标签。
        var availableWorldDefinitions = [];

        // number 世界循环索引：遍历固定三世界定义的整数下标。
        for (var worldIndex = 0; worldIndex < game.definitions.DIPLOMACY_WORLD_DEFINITIONS.length; worldIndex += 1) {
            // DiplomacyWorldDefinition 当前世界定义：用于检查是否存在当前模式地点。
            var worldDefinition = game.definitions.DIPLOMACY_WORLD_DEFINITIONS[worldIndex];

            if (getAvailableDiplomacyFactionDefinitions(modeId, worldDefinition.id).length > 0) {
                availableWorldDefinitions.push(worldDefinition);
            }
        }

        return availableWorldDefinitions;
    }

    /**
     * 渲染世界子标签按钮。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {DiplomacyWorldDefinition|null} activeWorldDefinition - 当前世界定义。
     * @returns {HTMLElement} 世界子标签容器。
     */
    function renderDiplomacyWorldSubtabs(modeId, activeWorldDefinition) {
        // HTMLElement 子标签容器：承载地底、地表和深渊按钮。
        var subtabListElement = document.createElement("div");

        // DiplomacyWorldDefinition[] 可用世界定义数组：只渲染当前模式有地点的世界。
        var availableWorldDefinitions = getAvailableDiplomacyWorldDefinitions(modeId);

        subtabListElement.className = "tab-list diplomacy-subtabs location-subtabs";
        subtabListElement.setAttribute("role", "tablist");

        // number 世界循环索引：遍历可用世界定义数组的整数下标。
        for (var worldIndex = 0; worldIndex < availableWorldDefinitions.length; worldIndex += 1) {
            // DiplomacyWorldDefinition 当前世界定义：用于创建子标签按钮。
            var worldDefinition = availableWorldDefinitions[worldIndex];

            subtabListElement.appendChild(createDiplomacyWorldSubtabButton(modeId, worldDefinition, activeWorldDefinition && activeWorldDefinition.id === worldDefinition.id));
        }

        return subtabListElement;
    }

    /**
     * 创建世界子标签按钮。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {DiplomacyWorldDefinition} worldDefinition - 世界定义对象。
     * @param {boolean} isSelected - 是否为当前选中世界。
     * @returns {HTMLButtonElement} 世界子标签按钮。
     */
    function createDiplomacyWorldSubtabButton(modeId, worldDefinition, isSelected) {
        // HTMLButtonElement 按钮元素：写入世界子标签切换数据属性。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.diplomacyMode = modeId;
        buttonElement.dataset.diplomacyWorldSubtab = worldDefinition.id;
        buttonElement.textContent = worldDefinition.name;
        buttonElement.setAttribute("role", "tab");
        buttonElement.setAttribute("aria-selected", String(isSelected));
        return buttonElement;
    }

    /**
     * 读取当前世界下的势力子标签定义。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {string} worldId - 世界稳定 ID。
     * @returns {FactionTradeDefinition|null} 当前势力定义；没有可用势力时返回 null。
     */
    function getActiveDiplomacyFactionDefinition(modeId, worldId) {
        // FactionTradeDefinition[] 可用势力定义数组：只包含当前世界有地点的势力。
        var availableFactionDefinitions = getAvailableDiplomacyFactionDefinitions(modeId, worldId);

        if (availableFactionDefinitions.length <= 0) {
            return null;
        }

        // string 子标签作用域 ID：区分外交/掠夺和世界。
        var scopeId = modeId + "_" + worldId;

        // string|null 当前势力 ID：读取运行时 UI 状态。
        var activeFactionId = game.runtime && game.runtime.activeDiplomacyFactionByScopeId ? game.runtime.activeDiplomacyFactionByScopeId[scopeId] : null;

        // number 势力循环索引：遍历可用势力定义数组的整数下标。
        for (var factionIndex = 0; factionIndex < availableFactionDefinitions.length; factionIndex += 1) {
            // FactionTradeDefinition 当前势力定义：用于匹配运行时选中状态。
            var factionDefinition = availableFactionDefinitions[factionIndex];

            if (factionDefinition.id === activeFactionId) {
                return factionDefinition;
            }
        }

        return availableFactionDefinitions[0];
    }

    /**
     * 获取当前世界下有地点的势力定义。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {string} worldId - 世界稳定 ID。
     * @returns {FactionTradeDefinition[]} 可用势力定义数组。
     */
    function getAvailableDiplomacyFactionDefinitions(modeId, worldId) {
        // FactionTradeDefinition[] 可用势力定义数组：用于渲染势力子标签。
        var availableFactionDefinitions = [];

        // number 势力循环索引：遍历阵营定义数组的整数下标。
        for (var factionIndex = 0; factionIndex < game.definitions.FACTION_DEFINITIONS.length; factionIndex += 1) {
            // FactionTradeDefinition 当前势力定义：用于判断世界和当前模式地点。
            var factionDefinition = game.definitions.FACTION_DEFINITIONS[factionIndex];

            if (factionDefinition.worldId === worldId && hasDiplomacyLocationForFaction(modeId, factionDefinition.id)) {
                availableFactionDefinitions.push(factionDefinition);
            }
        }

        return availableFactionDefinitions;
    }

    /**
     * 判断势力在当前模式下是否存在地点。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {string} factionId - 势力稳定 ID。
     * @returns {boolean} 是否存在可显示地点。
     */
    function hasDiplomacyLocationForFaction(modeId, factionId) {
        if (modeId === "diplomacy") {
            return Boolean(game.diplomacy.getFactionDefinition(factionId));
        }

        // number 掠夺目标循环索引：遍历掠夺目标定义数组的整数下标。
        for (var targetIndex = 0; targetIndex < game.definitions.RAID_TARGET_DEFINITIONS.length; targetIndex += 1) {
            // RaidTargetDefinition 当前掠夺目标定义：用于匹配势力 ID。
            var targetDefinition = game.definitions.RAID_TARGET_DEFINITIONS[targetIndex];

            if (targetDefinition.factionId === factionId) {
                return true;
            }
        }

        return false;
    }

    /**
     * 渲染势力子标签按钮。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {string} worldId - 世界稳定 ID。
     * @param {FactionTradeDefinition|null} activeFactionDefinition - 当前势力定义。
     * @returns {HTMLElement} 势力子标签容器。
     */
    function renderDiplomacyFactionSubtabs(modeId, worldId, activeFactionDefinition) {
        // HTMLElement 子标签容器：承载当前世界下的势力按钮。
        var subtabListElement = document.createElement("div");

        // FactionTradeDefinition[] 可用势力定义数组：只渲染当前世界有地点的势力。
        var availableFactionDefinitions = getAvailableDiplomacyFactionDefinitions(modeId, worldId);

        subtabListElement.className = "tab-list diplomacy-subtabs location-subtabs";
        subtabListElement.setAttribute("role", "tablist");

        // number 势力循环索引：遍历可用势力定义数组的整数下标。
        for (var factionIndex = 0; factionIndex < availableFactionDefinitions.length; factionIndex += 1) {
            // FactionTradeDefinition 当前势力定义：用于创建子标签按钮。
            var factionDefinition = availableFactionDefinitions[factionIndex];

            subtabListElement.appendChild(createDiplomacyFactionSubtabButton(modeId, worldId, factionDefinition, activeFactionDefinition && activeFactionDefinition.id === factionDefinition.id));
        }

        return subtabListElement;
    }

    /**
     * 创建势力子标签按钮。
     *
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {string} worldId - 世界稳定 ID。
     * @param {FactionTradeDefinition} factionDefinition - 势力定义对象。
     * @param {boolean} isSelected - 是否为当前选中势力。
     * @returns {HTMLButtonElement} 势力子标签按钮。
     */
    function createDiplomacyFactionSubtabButton(modeId, worldId, factionDefinition, isSelected) {
        // HTMLButtonElement 按钮元素：写入势力子标签切换数据属性。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.diplomacyMode = modeId;
        buttonElement.dataset.diplomacyWorldId = worldId;
        buttonElement.dataset.diplomacyFactionSubtab = factionDefinition.id;
        buttonElement.textContent = factionDefinition.name;
        buttonElement.setAttribute("role", "tab");
        buttonElement.setAttribute("aria-selected", String(isSelected));
        return buttonElement;
    }

    /**
     * 渲染单个世界下的势力分组。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {DiplomacyWorldDefinition} worldDefinition - 世界定义对象。
     * @returns {HTMLElement|null} 世界区块；没有地点时返回 null。
     */
    function renderDiplomacyWorldSection(state, modeId, worldDefinition) {
        // HTMLElement 世界区块元素：显示地底、地表或深渊标题。
        var sectionElement = document.createElement("section");

        // number 已渲染势力数：用于判断该世界是否存在当前模式地点。
        var renderedFactionCount = 0;

        sectionElement.className = "location-world-section";
        sectionElement.appendChild(createTextElement("h3", worldDefinition.name));

        // number 势力循环索引：遍历阵营定义数组的整数下标。
        for (var factionIndex = 0; factionIndex < game.definitions.FACTION_DEFINITIONS.length; factionIndex += 1) {
            // FactionTradeDefinition 当前势力定义：用于二级分组标题和地点归属。
            var factionDefinition = game.definitions.FACTION_DEFINITIONS[factionIndex];

            if (factionDefinition.worldId !== worldDefinition.id) {
                continue;
            }

            // HTMLElement|null 势力区块：没有当前模式地点时返回 null。
            var factionSectionElement = renderDiplomacyFactionSection(state, modeId, factionDefinition);

            if (factionSectionElement) {
                renderedFactionCount += 1;
                sectionElement.appendChild(factionSectionElement);
            }
        }

        if (renderedFactionCount === 0) {
            return null;
        }

        return sectionElement;
    }

    /**
     * 渲染单个势力下的地点列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} modeId - 地点模式 ID；diplomacy 表示贸易地点，raid 表示掠夺地点。
     * @param {FactionTradeDefinition} factionDefinition - 阵营定义对象。
     * @returns {HTMLElement|null} 势力区块；没有当前模式地点时返回 null。
     */
    function renderDiplomacyFactionSection(state, modeId, factionDefinition) {
        // HTMLElement 势力区块元素：承载同一势力下的地点列表。
        var sectionElement = document.createElement("section");

        // HTMLElement 列表元素：使用资源列表风格展示地点行。
        var listElement = document.createElement("div");

        // number 已渲染地点数：用于判断是否返回该势力区块。
        var renderedLocationCount = 0;

        sectionElement.className = "location-faction-section";
        listElement.className = "location-list";
        sectionElement.appendChild(createTextElement("h4", factionDefinition.name));

        if (modeId === "diplomacy") {
            listElement.appendChild(renderFactionLocationRow(state, factionDefinition));
            renderedLocationCount += 1;
        } else {
            renderedLocationCount = appendRaidTargetRowsForFaction(state, factionDefinition, listElement);
        }

        if (renderedLocationCount === 0) {
            return null;
        }

        sectionElement.appendChild(listElement);
        return sectionElement;
    }

    /**
     * 按势力追加掠夺地点行。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {FactionTradeDefinition} factionDefinition - 阵营定义对象。
     * @param {HTMLElement} listElement - 地点列表元素，会被追加掠夺行。
     * @returns {number} 已追加的地点行数量，非负整数。
     */
    function appendRaidTargetRowsForFaction(state, factionDefinition, listElement) {
        // number 已追加地点数：统计当前势力下的掠夺目标。
        var renderedLocationCount = 0;

        // number 掠夺目标循环索引：遍历掠夺目标定义数组的整数下标。
        for (var targetIndex = 0; targetIndex < game.definitions.RAID_TARGET_DEFINITIONS.length; targetIndex += 1) {
            // RaidTargetDefinition 当前掠夺目标定义：用于匹配势力和渲染列表行。
            var targetDefinition = game.definitions.RAID_TARGET_DEFINITIONS[targetIndex];

            if (targetDefinition.factionId !== factionDefinition.id) {
                continue;
            }

            renderedLocationCount += 1;
            listElement.appendChild(renderRaidTargetLocationRow(state, targetDefinition, factionDefinition));
        }

        return renderedLocationCount;
    }

    /**
     * 渲染单个外交地点行。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {FactionTradeDefinition} factionDefinition - 阵营定义对象。
     * @returns {HTMLElement} 外交地点列表行。
     */
    function renderFactionLocationRow(state, factionDefinition) {
        // HTMLElement 行元素：资源列表风格的贸易地点入口。
        var rowElement = document.createElement("div");

        // Object.<string, number|string|boolean|Price[]> 贸易预览：包含成本、收益范围、关系变化和善名门槛。
        var preview = game.diplomacy.previewTrade(state, factionDefinition.id);

        // ResourceDefinition|null 收益资源定义：用于显示中文资源名。
        var rewardDefinition = game.resources.getResourceDefinition(factionDefinition.rewardResource);

        // HTMLButtonElement 贸易按钮：点击后执行贸易。
        var buttonElement = document.createElement("button");

        // string[] 缺口文本数组：资源不足时显示贸易缺口。
        var missingTexts = game.resources.getMissingResourceTexts(state, factionDefinition.cost);

        // number 在途贸易队数量：显示同一地点尚未返程的行动数量。
        var activeMissionCount = game.diplomacy.countActiveMissionsForLocation(state, "trade", factionDefinition.id);

        rowElement.className = "resource-row location-row";
        rowElement.tabIndex = 0;
        buttonElement.type = "button";
        buttonElement.dataset.tradeFactionId = factionDefinition.id;
        buttonElement.textContent = "派出";
        buttonElement.disabled = state.isPaused || !preview.canTradeByGoodwill || !game.resources.canAfford(state, factionDefinition.cost) || (game.challengesSystem && game.challengesSystem.isTradeDisabled(state));

        rowElement.appendChild(createLocationMainElement(factionDefinition.name, ""));
        if (missingTexts.length > 0 || activeMissionCount > 0) {
            rowElement.appendChild(createTextElement("span", missingTexts.length > 0 ? game.text.TEXT_REGISTRY.ui.missingPrefix + missingTexts.join("，") : "在途 " + activeMissionCount));
        }
        rowElement.appendChild(buttonElement);
        rowElement.appendChild(renderFactionLocationTooltip(state, factionDefinition, preview, rewardDefinition, missingTexts));
        return rowElement;
    }

    /**
     * 创建地点行左侧主信息。
     *
     * @param {string} nameText - 地点或势力中文名称。
     * @param {string} detailText - 右侧短说明文本；空字符串表示不显示详情。
     * @returns {HTMLElement} 主信息元素。
     */
    function createLocationMainElement(nameText, detailText) {
        // HTMLElement 主信息元素：包含名称和短状态。
        var mainElement = document.createElement("span");

        // HTMLElement 名称元素：显示地点或势力名称。
        var nameElement = document.createElement("strong");

        mainElement.className = "location-main";
        nameElement.textContent = nameText;
        mainElement.appendChild(nameElement);
        if (detailText) {
            // HTMLElement 详情元素：显示关系、强度等短状态。
            var detailElement = document.createElement("span");

            detailElement.textContent = detailText;
            mainElement.appendChild(detailElement);
        }
        return mainElement;
    }

    /**
     * 格式化地点距离秒数。
     *
     * @param {number} seconds - 距离对应的返程秒数，非负浮点数。
     * @returns {string} 秒数中文文本；低于 60 秒显示秒，达到 60 秒显示约几分钟。
     */
    function formatSecondsText(seconds) {
        // number 标准秒数：把异常输入收敛为非负整数秒。
        var normalizedSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));

        if (normalizedSeconds < 60) {
            return normalizedSeconds + " 秒";
        }

        return "约 " + Math.ceil(normalizedSeconds / 60) + " 分钟";
    }

    /**
     * 渲染单个掠夺地点行。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {FactionTradeDefinition} factionDefinition - 阵营定义对象。
     * @returns {HTMLElement} 掠夺地点列表行。
     */
    function renderRaidTargetLocationRow(state, targetDefinition, factionDefinition) {
        // HTMLElement 行元素：资源列表风格的掠夺地点入口。
        var rowElement = document.createElement("div");

        // Object.<string, number> 掠夺派出人数缓存：key 为掠夺目标 ID，value 为玩家通过按钮选择的派出人数。
        var raidMemberCountsByTargetId = game.runtime && game.runtime.raidMemberCountsByTargetId ? game.runtime.raidMemberCountsByTargetId : {};

        // number 当前派出人数：优先使用玩家按钮选择值，缺省按目标最低人数预览。
        var configuredRaiderCount = raidMemberCountsByTargetId[targetDefinition.id] || targetDefinition.minRaiders;

        // string|null 已选随队战兽 ID：按地点保存在运行时 UI 缓存，不写入存档。
        var selectedWarbeastId = game.runtime && game.runtime.raidWarbeastByTargetId ? game.runtime.raidWarbeastByTargetId[targetDefinition.id] || null : null;

        // Object.<string, number|string|boolean|Price[]|Object> 掠夺预览：包含队伍强度、成功率和风险。
        var preview = game.raids.previewRaid(state, targetDefinition.id, configuredRaiderCount, selectedWarbeastId);

        // number 当前可显示派出人数：限制在最低需求和可用战斗职业人数之间。
        var displayedRaiderCount = Math.min(Math.max(configuredRaiderCount, targetDefinition.minRaiders), Math.max(preview.availableRaiderCount, targetDefinition.minRaiders));

        // HTMLElement 派出人数控件：使用与职业分配一致的按钮加减模式。
        var memberControlElement = renderRaidMemberControls(state, targetDefinition, preview, displayedRaiderCount);

        // HTMLSelectElement 随队战兽选择器：每次掠夺最多选择一只可用战兽。
        var warbeastSelectElement = renderRaidWarbeastSelect(state, targetDefinition.id, preview.selectedWarbeastId);

        // string[] 掠夺成本缺口文本：菌菇不足时用于行内摘要和浮窗。
        var missingCostTexts = game.resources.getMissingResourceTexts(state, preview.cost);

        // number 在途掠夺队数量：显示同一目标尚未返程的行动数量。
        var activeMissionCount = game.diplomacy.countActiveMissionsForLocation(state, "raid", targetDefinition.id);

        // HTMLButtonElement 掠夺按钮：点击后执行掠夺。
        var buttonElement = document.createElement("button");

        // HTMLElement 掠夺操作区：把人数控件和发起按钮固定在同一网格列中，避免按钮被摘要字段挤出行尾。
        var actionElement = document.createElement("div");

        rowElement.className = "resource-row location-row raid-location-row";
        rowElement.tabIndex = 0;
        rowElement.dataset.raidMemberCount = String(displayedRaiderCount);
        actionElement.className = "raid-location-actions";
        buttonElement.type = "button";
        buttonElement.dataset.raidTargetId = targetDefinition.id;
        buttonElement.textContent = "派出";
        buttonElement.disabled = state.isPaused || !preview.canStart;
        actionElement.appendChild(memberControlElement);
        actionElement.appendChild(warbeastSelectElement);
        actionElement.appendChild(buttonElement);
        rowElement.appendChild(createLocationMainElement(targetDefinition.name, ""));
        if (!preview.canStart || activeMissionCount > 0) {
            rowElement.appendChild(createTextElement("span", preview.canStart ? "在途 " + activeMissionCount : getRaidMissingSummary(preview, targetDefinition, missingCostTexts)));
        }
        rowElement.appendChild(actionElement);
        rowElement.appendChild(renderRaidTargetLocationTooltip(state, targetDefinition, factionDefinition, preview, missingCostTexts));
        return rowElement;
    }

    /**
     * 渲染掠夺随队战兽选择器。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @param {string|null} selectedWarbeastId - 当前选择的战兽 ID；null 表示不派战兽。
     * @returns {HTMLSelectElement} 随队战兽下拉选择器。
     */
    function renderRaidWarbeastSelect(state, targetId, selectedWarbeastId) {
        // HTMLSelectElement 选择器元素：提供不派战兽和所有可用战兽选项。
        var selectElement = document.createElement("select");

        // HTMLOptionElement 空选项：允许玩家不派战兽。
        var emptyOptionElement = document.createElement("option");

        // WarbeastState[] 可用战兽数组：已驯化、未孕育且未随其他队伍出征。
        var availableWarbeasts = game.warbeastsSystem ? game.warbeastsSystem.getAvailableRaidWarbeasts(state) : [];

        selectElement.dataset.raidWarbeastTargetId = targetId;
        selectElement.setAttribute("aria-label", "随队战兽");
        emptyOptionElement.value = "";
        emptyOptionElement.textContent = "不派战兽";
        selectElement.appendChild(emptyOptionElement);

        // number 战兽循环索引：遍历可选战兽的整数下标。
        for (var warbeastIndex = 0; warbeastIndex < availableWarbeasts.length; warbeastIndex += 1) {
            // WarbeastState 当前战兽：用于创建名称和强度选项。
            var warbeast = availableWarbeasts[warbeastIndex];

            // WarbeastSpeciesDefinition|null 物种定义：用于显示战斗强度。
            var speciesDefinition = game.warbeastsSystem.getSpeciesDefinition(warbeast.speciesId);

            // HTMLOptionElement 战兽选项：value 使用个体稳定 ID。
            var optionElement = document.createElement("option");

            optionElement.value = warbeast.id;
            optionElement.textContent = warbeast.name + "（强度 " + (speciesDefinition ? speciesDefinition.raidStrength : 0) + "）";
            optionElement.selected = warbeast.id === selectedWarbeastId;
            selectElement.appendChild(optionElement);
        }

        return selectElement;
    }

    /**
     * 渲染掠夺派出人数按钮控件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {Object.<string, number|string|boolean|Price[]|Object>} preview - 掠夺预览对象。
     * @param {number} displayedRaiderCount - 当前显示的派出人数，正整数。
     * @returns {HTMLElement} 派出人数按钮控件元素。
     */
    function renderRaidMemberControls(state, targetDefinition, preview, displayedRaiderCount) {
        // HTMLElement 控件元素：承载减号、数量、加号和最大按钮。
        var controlElement = document.createElement("div");

        // HTMLElement 数量元素：显示本次将派出的战斗职业人数。
        var countElement = document.createElement("span");

        controlElement.className = "raid-member-controls";
        countElement.className = "raid-member-count";
        countElement.textContent = "派出 " + displayedRaiderCount;
        controlElement.appendChild(createRaidMemberButton(targetDefinition.id, "remove", "-", state.isPaused || displayedRaiderCount <= targetDefinition.minRaiders));
        controlElement.appendChild(countElement);
        controlElement.appendChild(createRaidMemberButton(targetDefinition.id, "add", "+", state.isPaused || preview.availableRaiderCount < targetDefinition.minRaiders || displayedRaiderCount >= preview.availableRaiderCount));
        controlElement.appendChild(createRaidMemberButton(targetDefinition.id, "max", "最大分配", state.isPaused || preview.availableRaiderCount < targetDefinition.minRaiders || displayedRaiderCount >= preview.availableRaiderCount));
        return controlElement;
    }

    /**
     * 创建掠夺派出人数操作按钮。
     *
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @param {string} actionId - 派出人数操作 ID；remove、add 或 max。
     * @param {string} labelText - 按钮中文显示文本。
     * @param {boolean} isDisabled - 是否禁用；true 表示当前不可执行。
     * @returns {HTMLButtonElement} 派出人数操作按钮。
     */
    function createRaidMemberButton(targetId, actionId, labelText, isDisabled) {
        // HTMLButtonElement 按钮元素：调整单个掠夺目标的派出人数。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.raidMemberTargetId = targetId;
        buttonElement.dataset.raidMemberAction = actionId;
        buttonElement.textContent = labelText;
        buttonElement.disabled = isDisabled;
        return buttonElement;
    }

    /**
     * 格式化掠夺成本显示文本。
     *
     * @param {Object.<string, number|string|boolean|Price[]|Object>} preview - 掠夺预览对象；读取 cost、canStartByRaiders 和 canStartByInfamy。
     * @returns {string} 掠夺成本中文文本；非资源原因导致暂时不可掠夺时数量显示为“不可用”。
     */
    function formatRaidCostText(preview) {
        // boolean 是否为暂时不可掠夺地点：战斗职业或恶名不足时不显示误导性的菌菇数量。
        var isTemporarilyUnavailable = !preview.canStartByRaiders || !preview.canStartByInfamy;

        if (isTemporarilyUnavailable) {
            // Price|null 菌菇成本项：用于保留“菌菇”资源名，只把数量替换为不可用。
            var fungusPriceEntry = getPriceEntryByResourceId(preview.cost, "fungus");

            if (fungusPriceEntry) {
                return game.resources.getResourceDisplayName(fungusPriceEntry.resource) + " 不可用";
            }

            return "不可用";
        }

        return formatPriceList(preview.cost);
    }

    /**
     * 从价格数组中查找指定资源价格项。
     *
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @param {string} resourceId - 资源稳定 ID。
     * @returns {Price|null} 匹配的价格项；不存在时返回 null。
     */
    function getPriceEntryByResourceId(price, resourceId) {
        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前价格项：用于匹配指定资源 ID。
            var priceEntry = price[priceIndex];

            if (priceEntry.resource === resourceId) {
                return priceEntry;
            }
        }

        return null;
    }

    /**
     * 获取掠夺地点行的缺口摘要。
     *
     * @param {Object.<string, number|string|boolean|Price[]|Object>} preview - 掠夺预览对象。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {string[]} missingCostTexts - 菌菇成本缺口文本数组。
     * @returns {string} 缺口摘要文本。
     */
    function getRaidMissingSummary(preview, targetDefinition, missingCostTexts) {
        if (!preview.canStartByRaiders) {
            return game.text.TEXT_REGISTRY.ui.missingPrefix + "战斗职业 " + Math.max(0, targetDefinition.minRaiders - preview.availableRaiderCount);
        }

        if (!preview.canStartByInfamy) {
            return game.text.TEXT_REGISTRY.ui.missingPrefix + "恶名 " + Math.max(0, preview.requiredInfamy - preview.infamyAmount).toFixed(0);
        }

        if (!preview.canStartByCost && missingCostTexts.length > 0) {
            return game.text.TEXT_REGISTRY.ui.missingPrefix + missingCostTexts.join("，");
        }

        return "不可发起";
    }

    /**
     * 渲染外交地点悬浮详情。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {FactionTradeDefinition} factionDefinition - 阵营定义对象。
     * @param {Object.<string, number|string|boolean|Price[]>} preview - 贸易预览对象。
     * @param {ResourceDefinition|null} rewardDefinition - 收益资源定义；缺失时显示资源 ID。
     * @param {string[]} missingTexts - 资源缺口文本数组。
     * @returns {HTMLElement} 外交地点悬浮框元素。
     */
    function renderFactionLocationTooltip(state, factionDefinition, preview, rewardDefinition, missingTexts) {
        // HTMLElement 浮窗元素：显示贸易地点完整详情。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表：承载描述、成本、收益、声名和缺口。
        var listElement = document.createElement("dl");

        tooltipElement.className = "resource-tooltip location-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", factionDefinition.name));
        appendDefinitionDetail(listElement, "说明", factionDefinition.description);
        appendDefinitionDetail(listElement, "关系", String(game.diplomacy.getRelation(state, factionDefinition.id)));
        appendDefinitionDetail(listElement, "消耗", formatPriceList(factionDefinition.cost));
        appendDefinitionDetail(listElement, "距离", formatSecondsText(preview.distanceSeconds) + " 后返程结算");
        appendDefinitionDetail(listElement, "善名", "门槛 " + preview.requiredGoodwill + "，当前 " + preview.goodwillAmount.toFixed(1) + "，交易成功 +" + preview.goodwillReward);
        appendDefinitionDetail(listElement, "收益", (rewardDefinition ? rewardDefinition.name : factionDefinition.rewardResource) + " " + preview.minReward.toFixed(1) + "-" + preview.maxReward.toFixed(1));
        appendDefinitionDetail(listElement, "成功率", Math.round(preview.successChance * 100) + "%，关系 " + (preview.relationChange >= 0 ? "+" : "") + preview.relationChange);

        if (!preview.canTradeByGoodwill) {
            appendDefinitionDetail(listElement, "缺少", "善名 " + Math.max(0, preview.requiredGoodwill - preview.goodwillAmount).toFixed(0));
        }

        if (missingTexts.length > 0) {
            appendDefinitionDetail(listElement, "缺少", missingTexts.join("，"));
            appendDefinitionDetail(listElement, "倒计时", game.resources.formatPriceAvailabilityText(state, factionDefinition.cost));
        }

        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 渲染掠夺地点悬浮详情。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {RaidTargetDefinition} targetDefinition - 掠夺目标定义对象。
     * @param {FactionTradeDefinition} factionDefinition - 阵营定义对象。
     * @param {Object.<string, number|string|boolean|Price[]|Object>} preview - 掠夺预览对象。
     * @param {string[]} missingCostTexts - 菌菇成本缺口文本数组。
     * @returns {HTMLElement} 掠夺地点悬浮框元素。
     */
    function renderRaidTargetLocationTooltip(state, targetDefinition, factionDefinition, preview, missingCostTexts) {
        // HTMLElement 浮窗元素：显示掠夺地点完整详情。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表：承载风险、收益、声名和缺口。
        var listElement = document.createElement("dl");

        tooltipElement.className = "resource-tooltip location-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", targetDefinition.name));
        appendDefinitionDetail(listElement, "势力", factionDefinition.name);
        appendDefinitionDetail(listElement, "说明", targetDefinition.description);
        appendDefinitionDetail(listElement, "队伍", "最低 " + targetDefinition.minRaiders + "，可派出 " + preview.availableRaiderCount + "，目标强度 " + targetDefinition.targetStrength);
        appendDefinitionDetail(listElement, "消耗", formatRaidCostText(preview));
        appendDefinitionDetail(listElement, "距离", formatSecondsText(preview.distanceSeconds) + " 后返程结算");
        appendDefinitionDetail(listElement, "恶名", "门槛 " + preview.requiredInfamy + "，当前 " + preview.infamyAmount.toFixed(1));
        appendDefinitionDetail(listElement, "强度", "队伍 " + preview.teamStrength.toFixed(1) + "，成功率 " + Math.round(preview.successChance * 100) + "%");
        appendDefinitionDetail(listElement, "随队战兽", String(preview.selectedWarbeastName) + "，战斗强度 +" + Number(preview.warbeastStrength || 0).toFixed(1));
        appendDefinitionDetail(listElement, "伤亡", "受伤 " + Math.round(preview.casualtyChance * 100) + "%，死亡 " + Math.round(preview.deathChance * 100) + "%");
        appendDefinitionDetail(listElement, "关系", "下降 " + preview.relationPenalty + "，报复可能 " + Math.round(preview.retaliationChance * 100) + "%");
        appendDefinitionDetail(listElement, "声名", "成功恶名 +" + preview.infamyReward + "、善名 -" + preview.goodwillPenalty + "；失败恶名 -" + preview.infamyFailurePenalty);
        appendDefinitionDetail(listElement, "收益", formatRewardDictionary(targetDefinition.rewards));
        appendDefinitionDetail(listElement, "俘虏职业", String(preview.captiveTypes));
        appendDefinitionDetail(listElement, "俘虏种族", String(preview.captiveRaces));
        appendDefinitionDetail(listElement, "战兽", String(preview.warbeastSpecies) + "（捕获 " + Math.round(Number(preview.warbeastCaptureChance || 0) * 100) + "%）");
        appendDefinitionDetail(listElement, "罕见捕获", "触手怪在任何世界、势力和地点均为固定 0.1%");

        if (!preview.canStartByRaiders) {
            appendDefinitionDetail(listElement, "缺少", "战斗职业哥布林 " + Math.max(0, targetDefinition.minRaiders - preview.availableRaiderCount));
        }

        if (!preview.canStartByInfamy) {
            appendDefinitionDetail(listElement, "缺少", "恶名 " + Math.max(0, preview.requiredInfamy - preview.infamyAmount).toFixed(0));
        }

        if (!preview.canStartByCost && missingCostTexts.length > 0) {
            appendDefinitionDetail(listElement, "缺少", missingCostTexts.join("，"));
            appendDefinitionDetail(listElement, "倒计时", game.resources.formatPriceAvailabilityText(state, preview.cost));
        }

        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 格式化资源奖励字典。
     *
     * @param {Object.<string, number>} rewardsByResourceId - 奖励字典；key 为资源 ID，value 为资源数量。
     * @returns {string} 中文奖励列表。
     */
    function formatRewardDictionary(rewardsByResourceId) {
        // string[] 奖励文本数组：逐资源保存中文名称和数量。
        var rewardTexts = [];

        // string[] 奖励资源 ID 数组：Object.keys 返回奖励字典的稳定 ID。
        var resourceIds = Object.keys(rewardsByResourceId);

        // number 循环索引：遍历奖励资源 ID 数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // string 资源 ID：当前奖励资源稳定 ID。
            var resourceId = resourceIds[resourceIndex];

            rewardTexts.push(game.resources.getResourceDisplayName(resourceId) + " " + rewardsByResourceId[resourceId]);
        }

        return rewardTexts.join("，");
    }

    /**
     * 渲染职业分配控件。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 职业分配区块元素。
     */
    function renderJobControls(state) {
        // HTMLElement 区块元素：承载职业按钮和预设按钮。
        var sectionElement = document.createElement("section");

        // HTMLElement 职业网格：显示每个已解锁职业。
        var gridElement = document.createElement("div");

        sectionElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.jobsTitle));
        gridElement.className = "action-grid";

        // number 循环索引：遍历职业定义数组的整数下标。
        for (var jobIndex = 0; jobIndex < game.definitions.JOB_DEFINITIONS.length; jobIndex += 1) {
            // JobDefinition 当前职业定义：用于渲染职业分配卡片。
            var jobDefinition = game.definitions.JOB_DEFINITIONS[jobIndex];

            if (!game.jobs.isJobVisibleForAssignment(state, jobDefinition.id)) {
                continue;
            }

            gridElement.appendChild(renderJobCard(state, jobDefinition));
        }

        sectionElement.appendChild(renderPresetControls(state));
        sectionElement.appendChild(gridElement);
        return sectionElement;
    }

    /**
     * 渲染单个职业卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {JobDefinition} jobDefinition - 职业定义对象。
     * @returns {HTMLElement} 职业卡片元素。
     */
    function renderJobCard(state, jobDefinition) {
        // HTMLElement 卡片元素：承载职业人数和操作按钮。
        var cardElement = document.createElement("div");

        // number 职业人数：从哥布林对象 jobId 派生。
        var assignedCount = game.jobs.countAssigned(state, jobDefinition.id);

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", jobDefinition.name + " x" + assignedCount));
        cardElement.appendChild(createTextElement("p", formatJobOutput(jobDefinition)));
        cardElement.appendChild(createJobButton(jobDefinition.id, "add", "+", state.isPaused || game.population.countIdleGoblins(state) <= 0));
        cardElement.appendChild(createJobButton(jobDefinition.id, "remove", "-", state.isPaused || assignedCount <= 0));
        cardElement.appendChild(createJobButton(jobDefinition.id, "clear", "全部撤下", state.isPaused || assignedCount <= 0));
        cardElement.appendChild(createJobButton(jobDefinition.id, "max", "最大分配", state.isPaused || game.population.countIdleGoblins(state) <= 0));
        return cardElement;
    }

    /**
     * 创建职业操作按钮。
     *
     * @param {JobId} jobId - 职业稳定 ID。
     * @param {string} actionId - 职业操作 ID。
     * @param {string} labelText - 按钮中文文本。
     * @param {boolean} isDisabled - 是否禁用；true 表示当前不可执行。
     * @returns {HTMLButtonElement} 职业操作按钮。
     */
    function createJobButton(jobId, actionId, labelText, isDisabled) {
        // HTMLButtonElement 按钮元素：执行单个职业操作。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.jobId = jobId;
        buttonElement.dataset.jobAction = actionId;
        buttonElement.textContent = labelText;
        buttonElement.disabled = isDisabled;
        return buttonElement;
    }

    /**
     * 渲染职业预设按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 预设按钮容器。
     */
    function renderPresetControls(state) {
        // HTMLElement 容器元素：承载职业预设按钮。
        var presetElement = document.createElement("div");

        // string[] 预设 ID 数组：按界面顺序显示。
        var presetIds = [
            "survival",
            "mining",
            "research",
            "war",
            "ritual"
        ];

        presetElement.className = "toolbar";
        presetElement.appendChild(createTextElement("span", game.text.TEXT_REGISTRY.ui.presetsTitle));
        presetElement.appendChild(createPresetButton(state, "clear_all", "全部撤下"));

        // number 循环索引：遍历预设 ID 数组的整数下标。
        for (var presetIndex = 0; presetIndex < presetIds.length; presetIndex += 1) {
            // string 当前预设 ID：用于写入按钮数据。
            var presetId = presetIds[presetIndex];

            if (!isPresetVisible(state, presetId)) {
                continue;
            }

            presetElement.appendChild(createPresetButton(state, presetId, getPresetName(presetId) + "：" + formatJobPresetPreview(game.jobs.previewJobPreset(state, presetId))));
        }

        return presetElement;
    }

    /**
     * 创建职业预设按钮。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} presetId - 预设 ID。
     * @param {string} labelText - 按钮中文文本。
     * @returns {HTMLButtonElement} 职业预设按钮。
     */
    function createPresetButton(state, presetId, labelText) {
        // HTMLButtonElement 预设按钮：点击后应用职业预设。
        var presetButtonElement = document.createElement("button");

        presetButtonElement.type = "button";
        presetButtonElement.dataset.jobPreset = presetId;
        presetButtonElement.textContent = labelText;
        presetButtonElement.disabled = state.isPaused;
        return presetButtonElement;
    }

    /**
     * 判断职业预设是否可见。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} presetId - 预设 ID。
     * @returns {boolean} 是否显示该预设。
     */
    function isPresetVisible(state, presetId) {
        if (presetId === "survival") {
            return game.jobs.isJobUnlocked(state, "forager") || game.jobs.isJobUnlocked(state, "woodcutter");
        }

        if (presetId === "mining") {
            return game.jobs.isJobUnlocked(state, "miner");
        }

        if (presetId === "research") {
            return game.jobs.isJobUnlocked(state, "graffiti_apprentice") || game.jobs.isJobUnlocked(state, "accountant");
        }

        if (presetId === "war") {
            return game.jobs.isJobUnlocked(state, "raider") || game.jobs.isJobUnlocked(state, "war_chief");
        }

        if (presetId === "ritual") {
            return game.jobs.isJobUnlocked(state, "witch_doctor") || game.jobs.isJobUnlocked(state, "rune_smith");
        }

        return false;
    }

    /**
     * 取得职业预设中文名。
     *
     * @param {string} presetId - 预设 ID。
     * @returns {string} 预设中文名。
     */
    function getPresetName(presetId) {
        // Object.<string, string> 预设中文名字典：key 为预设 ID，value 为显示名。
        var presetNames = {
            survival: "生存",
            mining: "采矿",
            research: "研究",
            war: "战争",
            ritual: "祭祀"
        };

        return presetNames[presetId] || presetId;
    }

    /**
     * 格式化职业预设预览。
     *
     * @param {Object.<string, number>} previewCounts - 预览结果字典；key 为职业 ID 或 pinned/idle。
     * @returns {string} 预设预览中文文本。
     */
    function formatJobPresetPreview(previewCounts) {
        // string[] 预览文本数组：每项为职业名和人数。
        var previewTexts = [];

        // string[] 预览键数组：遍历预览结果。
        var previewKeys = Object.keys(previewCounts);

        // number 循环索引：遍历预览键数组的整数下标。
        for (var previewIndex = 0; previewIndex < previewKeys.length; previewIndex += 1) {
            // string 当前预览键：职业 ID 或特殊状态。
            var previewKey = previewKeys[previewIndex];

            previewTexts.push(getJobPreviewName(previewKey) + " " + previewCounts[previewKey]);
        }

        return previewTexts.length > 0 ? previewTexts.join("，") : "无可分配";
    }

    /**
     * 取得预览中的职业或状态中文名。
     *
     * @param {string} previewKey - 职业 ID 或 pinned/idle。
     * @returns {string} 中文显示名。
     */
    function getJobPreviewName(previewKey) {
        if (previewKey === "pinned") {
            return "固定";
        }

        if (previewKey === "idle") {
            return "空闲";
        }

        // JobDefinition|null 职业定义：用于显示中文职业名。
        var jobDefinition = game.jobs.getJobDefinition(previewKey);

        return jobDefinition ? jobDefinition.name : previewKey;
    }

    /**
     * 格式化职业产出。
     *
     * @param {JobDefinition} jobDefinition - 职业定义对象。
     * @returns {string} 职业产出中文文本。
     */
    function formatJobOutput(jobDefinition) {
        // string[] 资源 ID 数组：用于遍历基础产出字典。
        var resourceIds = Object.keys(jobDefinition.baseOutput);

        // string[] 产出文本数组：每项为资源名和每 tick 数值。
        var outputTexts = [];

        // number 循环索引：遍历资源 ID 数组的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // ResourceId 当前资源 ID：用于查找中文资源名。
            var resourceId = resourceIds[resourceIndex];

            outputTexts.push(game.resources.getResourceDisplayName(resourceId) + " +" + jobDefinition.baseOutput[resourceId] + "/tick");
        }

        return outputTexts.join("，");
    }

    /**
     * 渲染单个哥布林普查卡片。
     *
     * @param {Goblin} goblin - 存活哥布林对象，不会被修改。
     * @returns {HTMLElement} 哥布林卡片元素。
     */
    function renderGoblinCard(goblin) {
        // HTMLElement 卡片元素：承载单个哥布林信息。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", goblin.name));
        cardElement.appendChild(createTextElement("p", "年龄：" + formatAgeYears(goblin.age) + "，寿命：" + game.population.calculateGoblinTotalLifespanYears(goblin) + " 年"));
        cardElement.appendChild(createTextElement("p", "寿命拆分：基础 " + Math.floor(Number(goblin.baseLifespanYears) || 0) + "，成长 " + Math.floor(Number(goblin.growthLifespanYears) || 0) + "，科研 " + Math.floor(Number(goblin.technologyLifespanYears) || 0) + "，事件 " + Math.floor(Number(goblin.eventLifespanYears) || 0) + " 年"));
        cardElement.appendChild(createTextElement("p", "信仰：" + game.faithSystem.formatFaithName(goblin.faithId)));
        cardElement.appendChild(createTextElement("p", "血脉：" + formatBloodline(goblin)));
        cardElement.appendChild(createTextElement("p", "职业：" + (goblin.jobId || "空闲")));
        cardElement.appendChild(createTextElement("p", "领袖：" + (goblin.isLeader ? "是" : "否") + "，固定：" + (goblin.isPinned ? "是" : "否")));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.attributePrefix + formatAttributes(goblin.attributes)));
        cardElement.appendChild(createTextElement("p", "技能：" + formatTopSkills(goblin.skills)));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.traitPrefix + (goblin.traits.length > 0 ? goblin.traits.join("，") : "无")));
        cardElement.appendChild(createTextElement("p", game.text.TEXT_REGISTRY.ui.woundPrefix + (goblin.wounds.length > 0 ? goblin.wounds.join("，") : "无")));
        cardElement.appendChild(createGoblinButton(goblin.id, "unassign", "撤下职业", !goblin.jobId));
        cardElement.appendChild(createGoblinButton(goblin.id, "pin", goblin.isPinned ? "取消固定" : "固定职业", false));
        cardElement.appendChild(createGoblinButton(goblin.id, "leader", "设为领袖", goblin.isLeader));
        return cardElement;
    }

    /**
     * 格式化个体血脉。
     *
     * @param {Goblin|CaptiveState} individual - 哥布林或俘虏对象，不会被修改。
     * @returns {string} 血脉显示文本；无血脉时返回“无”。
     */
    function formatBloodline(individual) {
        // BloodlineDefinition|null 血脉定义：用于显示血脉中文名和来源神灵。
        var bloodlineDefinition = game.captivesSystem && game.captivesSystem.getBloodlineDefinition ? game.captivesSystem.getBloodlineDefinition(individual.bloodlineId) : null;

        if (!bloodlineDefinition) {
            return "无";
        }

        // number 血脉纯度：百分比整数，范围 1-100。
        var bloodlinePurity = Math.max(1, Math.min(100, Math.round(Number(individual.bloodlinePurity) || 0)));

        return bloodlineDefinition.name + " " + bloodlinePurity + "%（源于" + game.faithSystem.formatFaithName(bloodlineDefinition.deityFaithId) + "）";
    }

    /**
     * 创建哥布林操作按钮。
     *
     * @param {string} goblinId - 哥布林稳定 ID。
     * @param {string} actionId - 哥布林操作 ID。
     * @param {string} labelText - 按钮中文文本。
     * @param {boolean} isDisabled - 是否禁用；true 表示不可执行。
     * @returns {HTMLButtonElement} 哥布林操作按钮。
     */
    function createGoblinButton(goblinId, actionId, labelText, isDisabled) {
        // HTMLButtonElement 按钮元素：执行单个哥布林操作。
        var buttonElement = document.createElement("button");

        buttonElement.type = "button";
        buttonElement.dataset.goblinId = goblinId;
        buttonElement.dataset.goblinAction = actionId;
        buttonElement.textContent = labelText;
        buttonElement.disabled = isDisabled;
        return buttonElement;
    }

    /**
     * 格式化前三项技能。
     *
     * @param {Object.<string, number>} skills - 技能经验字典；key 为技能 ID，value 为非负经验值。
     * @returns {string} 前三项技能文本；没有技能时返回“无”。
     */
    function formatTopSkills(skills) {
        // string[] 技能 ID 数组：按经验排序前的技能键。
        var skillIds = Object.keys(skills);

        skillIds.sort(function (leftSkillId, rightSkillId) {
            return skills[rightSkillId] - skills[leftSkillId];
        });

        if (skillIds.length === 0) {
            return "无";
        }

        // string[] 技能文本数组：最多三个技能和经验值。
        var skillTexts = [];

        // number 循环上限：技能数量和 3 的较小值。
        var skillLimit = Math.min(3, skillIds.length);

        // number 循环索引：遍历前三项技能的整数下标。
        for (var skillIndex = 0; skillIndex < skillLimit; skillIndex += 1) {
            // string 当前技能 ID：用于读取经验。
            var skillId = skillIds[skillIndex];

            skillTexts.push(skillId + " " + skills[skillId].toFixed(1));
        }

        return skillTexts.join("，");
    }

    /**
     * 格式化哥布林属性。
     *
     * @param {Object.<string, number>} attributes - 属性字典；key 为属性 ID，value 为 1-10 整数。
     * @returns {string} 属性显示文本。
     */
    function formatAttributes(attributes) {
        return "力" + attributes.strength + " 灵" + attributes.dexterity + " 狡" + attributes.cunning + " 感" + attributes.perception + " 志" + attributes.will + " 魔" + attributes.attunement;
    }

    /**
     * 渲染手动采集按钮区。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 手动采集按钮区元素。
     */
    function renderManualActions(state) {
        // HTMLElement 区块元素：承载手动采集按钮。
        var sectionElement = document.createElement("section");

        // HTMLElement 按钮网格元素：排列采集按钮卡片。
        var gridElement = document.createElement("div");

        sectionElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.manualGather));
        gridElement.className = "action-grid";

        // number 循环索引：遍历手动行动定义数组的整数下标。
        for (var actionIndex = 0; actionIndex < game.definitions.MANUAL_ACTION_DEFINITIONS.length; actionIndex += 1) {
            // ManualActionDefinition 当前行动定义：用于渲染按钮名称、描述和产出。
            var actionDefinition = game.definitions.MANUAL_ACTION_DEFINITIONS[actionIndex];

            // HTMLElement 卡片元素：承载单个手动行动。
            var cardElement = document.createElement("div");

            // HTMLButtonElement 行动按钮：点击后执行采集。
            var buttonElement = document.createElement("button");

            // number 当前单次采集数量：包含该行动独立科技树的固定增产。
            var currentActionAmount = game.resources.getManualActionAmount(state, actionDefinition);

            cardElement.className = "action-card";
            buttonElement.type = "button";
            buttonElement.dataset.actionId = actionDefinition.id;
            buttonElement.textContent = actionDefinition.name;
            buttonElement.disabled = state.isPaused;
            cardElement.appendChild(buttonElement);
            cardElement.appendChild(createTextElement("p", actionDefinition.description));
            cardElement.appendChild(createTextElement("p", "+" + currentActionAmount + " " + game.resources.getResourceDisplayName(actionDefinition.resource)));
            cardElement.appendChild(createTextElement("p", "每次点击有 " + Math.round(actionDefinition.eventChance * 100) + "% 概率触发采集事件"));
            gridElement.appendChild(cardElement);
        }

        sectionElement.appendChild(gridElement);
        return sectionElement;
    }

    /**
     * 渲染建筑购买区。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 建筑购买区元素。
     */
    function renderBuildingActions(state) {
        // HTMLElement 区块元素：承载建设指挥板标题、工具栏、决策区与固定检查器。
        var sectionElement = document.createElement("section");

        // Object[] 全部已揭示建筑视图模型：完全隐藏建筑不进入统计、队列或图鉴。
        var allViewModels = game.buildingView.collectBuildingViewModels(state);

        // Object 建设阶段摘要：由关键建筑拥有量确定性推导，不写入存档。
        var stageSummary = getBuildingStageSummary(state);

        // LaborBreakdown 当前劳力摘要：标题栏显示建筑占用与人口劳力。
        var laborBreakdown = game.population.analyzeLaborBreakdown(state);

        // number 当前存活人口：标题栏住房占用的非负整数人数。
        var aliveCount = game.population.countAliveGoblins(state);

        // number 当前住房上限：标题栏住房容量的非负整数床位数。
        var housingMax = game.population.calculateHousingMax(state);

        // HTMLElement 标题栏元素：把阶段、住房和劳力放在同一管理基线。
        var headingElement = document.createElement("header");

        headingElement.className = "building-command-heading";
        headingElement.appendChild(createTextElement("h3", "建设指挥板"));
        headingElement.appendChild(createTextElement("span", "阶段：" + stageSummary.name));
        headingElement.appendChild(createTextElement("span", "住房 " + aliveCount + "/" + housingMax));
        headingElement.appendChild(createTextElement("span", "劳力 " + formatNumber(laborBreakdown.adjustedBuildingUsageTotal) + "/" + formatNumber(laborBreakdown.populationLabor)));
        headingElement.appendChild(createTextElement("small", stageSummary.description));
        sectionElement.appendChild(headingElement);
        sectionElement.className = "building-workspace";

        synchronizeNewBuildingReveals(state, allViewModels);
        ensureSelectedBuilding(allViewModels);
        sectionElement.appendChild(renderBuildingCommandToolbar(allViewModels));

        sectionElement.appendChild(renderBuildingCommandBody(state, allViewModels));
        return sectionElement;
    }

    /**
     * 渲染建设指挥板结果区，在目录搜索结果与决策队列之间切换。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} allViewModels - 按设计顺序排列的全部已揭示建筑视图模型。
     * @returns {HTMLElement} 建设结果区元素。
     */
    function renderBuildingCommandBody(state, allViewModels) {
        // HTMLElement 主体容器：决策队列使用双栏，图鉴使用无独立详情卡的整宽列表。
        var workspaceBodyElement = document.createElement("div");

        workspaceBodyElement.className = "building-command-body";
        if (game.runtime.buildingViewId === "catalog" || (game.runtime.buildingSearchText || "").trim()) {
            workspaceBodyElement.classList.add("is-catalog-view");
            workspaceBodyElement.appendChild(renderBuildingCatalog(state, allViewModels));
        } else {
            workspaceBodyElement.appendChild(renderBuildingDecisionQueue(state, allViewModels));
            workspaceBodyElement.appendChild(renderSelectedBuildingDetails(state, allViewModels));
        }
        return workspaceBodyElement;
    }

    /**
     * 根据关键建筑推导当前建设阶段摘要。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {Object} 阶段摘要；name 为 string 标题，description 为 string 定向说明。
     */
    function getBuildingStageSummary(state) {
        // BuildingState|null 深渊门状态：存在且 owned 大于零时进入最终阶段。
        var abyssGateState = state.buildingsById.abyss_gate || null;
        // BuildingState|null 酋长厅状态：用于判定城邦经营阶段。
        var chiefHallState = state.buildingsById.chief_hall || null;
        // BuildingState|null 工匠棚状态：用于判定矿业扩张阶段。
        var artisanShedState = state.buildingsById.artisan_shed || null;
        // BuildingState|null 涂鸦墙状态：用于判定氏族成形阶段。
        var graffitiWallState = state.buildingsById.graffiti_wall || null;

        if (abyssGateState && abyssGateState.owned > 0) { return { name: "深渊帝国", description: "建设后期容量与远征设施" }; }
        if (chiefHallState && chiefHallState.owned > 0) { return { name: "城邦经营", description: "平衡军工、贸易、祭祀与治理" }; }
        if (artisanShedState && artisanShedState.owned > 0) { return { name: "矿业扩张", description: "打通采矿、冶炼和加工链" }; }
        if (graffitiWallState && graffitiWallState.owned > 0) { return { name: "氏族成形", description: "扩张人口并建立研究循环" }; }
        return { name: "求生扎根", description: "先稳定菌菇、住房与基础储备" };
    }

    /**
     * 确保固定检查器始终拥有一个有效选择。
     *
     * @param {Object[]} viewModels - 按设计顺序排列的已揭示建筑视图模型数组。
     * @returns {void} 无返回值；必要时会修改运行时 selectedBuildingId 偏好。
     */
    function ensureSelectedBuilding(viewModels) {
        // boolean 当前选择是否仍存在：true 时保持玩家上一轮选择。
        var hasExistingSelection = viewModels.some(function (viewModel) { return viewModel.definition.id === game.runtime.selectedBuildingId; });

        if (hasExistingSelection || viewModels.length <= 0) { return; }

        // Object|null 默认选择模型：优先等待项，其次可建项，最后取设计顺序第一项。
        var selectedViewModel = viewModels.find(function (viewModel) { return viewModel.buildingViewStatus === "unaffordable"; }) ||
            viewModels.find(function (viewModel) { return viewModel.buildingViewStatus === "available"; }) || viewModels[0];

        game.runtime.selectedBuildingId = selectedViewModel.definition.id;
    }

    /**
     * 渲染建设指挥板的搜索、图鉴与管理工具栏。
     *
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 工具栏元素。
     */
    function renderBuildingCommandToolbar(viewModels) {
        // HTMLElement 工具栏元素：只承载三项常用入口。
        var toolbarElement = renderBuildingToolbar();
        // HTMLButtonElement|null 图鉴切换按钮：补充已揭示/总数计数与明确动作。
        var catalogButtonElement = toolbarElement.querySelector("[data-building-view-id]");

        if (catalogButtonElement) {
            catalogButtonElement.textContent = game.runtime.buildingViewId === "catalog" ? "返回决策队列" : "打开建筑图鉴 " + viewModels.length + "/" + game.definitions.BUILDING_DEFINITIONS.length;
        }
        return toolbarElement;
    }

    /**
     * 渲染最多七项的确定性建筑决策队列。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 决策队列元素。
     */
    function renderBuildingDecisionQueue(state, viewModels) {
        // HTMLElement 队列容器元素：包含下一步、可立即建造和需处理三个固定区段。
        var queueElement = document.createElement("div");
        // BuildingQueueSnapshot 决策快照：排序、风险过滤、意图覆盖和防抖均由纯决策模块完成。
        var queueSnapshot = game.buildingDecisions.getBuildingQueueSnapshot(state, viewModels, game.runtime.buildingDecisionRuntime, Date.now());

        queueElement.className = "building-decision-queue";
        queueElement.appendChild(renderBuildingQueueSection(state, "当前目标", queueSnapshot.target, "没有需要等待的明确目标；可直接建设或前往图鉴查看。"));
        queueElement.appendChild(renderBuildingQueueSection(state, "可立即建造", queueSnapshot.available, "当前没有安全且可支付的建设方案。"));
        queueElement.appendChild(renderBuildingQueueSection(state, "先处理", queueSnapshot.attention, "当前未发现建设阻断或建造后严重风险。"));
        return queueElement;
    }

    /**
     * 渲染决策队列的一个固定区段。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} headingText - 区段中文标题。
     * @param {BuildingDecisionProfile[]} decisionProfiles - 本区最多三项建筑决策档案数组。
     * @param {string} emptyText - 无候选项时显示的具体结论。
     * @returns {HTMLElement} 队列区段元素。
     */
    function renderBuildingQueueSection(state, headingText, decisionProfiles, emptyText) {
        // HTMLElement 区段元素：承载标题和蓝图签。
        var sectionElement = document.createElement("section");

        sectionElement.className = "building-queue-section";
        sectionElement.appendChild(createTextElement("h4", headingText));
        if (decisionProfiles.length <= 0) {
            sectionElement.appendChild(createTextElement("p", emptyText));
            return sectionElement;
        }
        // number 模型循环索引：按区段排序依次生成蓝图签。
        for (var modelIndex = 0; modelIndex < decisionProfiles.length; modelIndex += 1) {
            sectionElement.appendChild(renderBuildingBlueprintSlip(state, decisionProfiles[modelIndex].viewModel, false, decisionProfiles[modelIndex]));
        }
        return sectionElement;
    }

    /**
     * 渲染可选择的决策蓝图签或只读图鉴列表行。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 单个建筑视图模型。
     * @param {boolean} isCatalogRow - true 表示图鉴列表行，false 表示决策队列签。
     * @param {BuildingDecisionProfile=} decisionProfile - 决策队列档案；图鉴行省略。
     * @returns {HTMLElement} 包含决策选择按钮或只读图鉴行及悬浮详情的建筑条目。
     */
    function renderBuildingBlueprintSlip(state, viewModel, isCatalogRow, decisionProfile) {
        // HTMLElement 蓝图条目容器：为未选中建筑承载不参与布局的详情浮窗。
        var entryElement = document.createElement("div");
        // HTMLElement 建筑交互元素：决策队列为选择按钮，图鉴为只可聚焦的浏览行。
        var buildingElement = document.createElement(isCatalogRow ? "div" : "button");
        // number 已拥有数量：未拥有时不显示乘零。
        var ownedCount = viewModel.state ? viewModel.state.owned : 0;
        // string 建筑显示名：预览态匿名，避免泄露正式名称。
        var displayName = viewModel.isPreview ? "未知设施" : viewModel.definition.name;
        // string 主效果标签：只显示第一项受控效果标签。
        var primaryEffect = game.buildingView.getEffectTagLabel(viewModel.definition.effectTags[0]);
        // string 行动结论：可建、等待、容量、来源、前置、暂停或过载。
        var actionText = !viewModel.isPreview && viewModel.willOverloadLabor ? "将过载" : getBuildingAvailabilityLabel(viewModel);

        entryElement.className = "building-blueprint-entry";
        buildingElement.className = "building-blueprint-slip building-status-" + viewModel.buildingViewStatus + (isCatalogRow ? " is-catalog-row" : "");
        if (isCatalogRow) {
            buildingElement.tabIndex = 0;
            buildingElement.setAttribute("aria-label", displayName + "，" + actionText + "；聚焦查看详情");
        } else {
            // HTMLButtonElement 决策选择按钮：只更新固定检查器，不直接建造。
            var decisionButtonElement = /** @type {HTMLButtonElement} */ (buildingElement);

            decisionButtonElement.type = "button";
            decisionButtonElement.dataset.buildingSelectId = viewModel.definition.id;
            decisionButtonElement.setAttribute("aria-current", String(game.runtime.selectedBuildingId === viewModel.definition.id));
        }
        buildingElement.innerHTML = "<span class=\"building-slip-symbol\" aria-hidden=\"true\">" + getBuildingStatusSymbol(viewModel.buildingViewStatus) + "</span>" +
            "<strong>" + displayName + (ownedCount > 0 ? " ×" + ownedCount : "") + "</strong>" +
            "<span class=\"building-slip-action\">" + actionText + "</span>" +
            "<small>" + primaryEffect + "</small>" +
            "<small class=\"building-slip-bottleneck\">" + (decisionProfile ? getBuildingDecisionReason(decisionProfile) : getBuildingSingleBottleneck(viewModel)) + "</small>";
        entryElement.appendChild(buildingElement);
        if (isCatalogRow || game.runtime.selectedBuildingId !== viewModel.definition.id) {
            entryElement.appendChild(createBuildingViewTooltip(state, viewModel));
        }
        return entryElement;
    }

    /**
     * 将结构化决策理由格式化为玩家可验证的中文短句。
     *
     * @param {BuildingDecisionProfile} decisionProfile - 建筑决策档案。
     * @returns {string} 现状、建筑效果与行动方向组成的单句理由。
     */
    function getBuildingDecisionReason(decisionProfile) {
        // Object 建筑视图模型：用于读取建筑名称、效果和缺口。
        var viewModel = decisionProfile.viewModel;
        // Object.<string, string|number> 理由字段：由决策层生成的受控数据。
        var reasonTokens = decisionProfile.reasonTokens;
        if (reasonTokens.dependencyTargetName && reasonTokens.dependencyResourceId) { return "为“" + reasonTokens.dependencyTargetName + "”解除" + formatResourceIdList([reasonTokens.dependencyResourceId]) + "阻断" + (reasonTokens.blockerCoverageCount > 1 ? "等 " + reasonTokens.blockerCoverageCount + " 项" : ""); }
        if (reasonTokens.dependencyTargetName) { return "为“" + reasonTokens.dependencyTargetName + "”铺路 → " + getBuildingSingleBottleneck(viewModel); }
        if (decisionProfile.bottleneck && decisionProfile.bottleneck.type === "labor_risk") {
            // LaborBreakdown 劳力摘要：只用于格式化建造后的明确占用数字。
            var laborBreakdown = game.population.analyzeLaborBreakdown(game.runtime.state);
            // number 建造后劳力占用：单位劳力，非负浮点数。
            var usageAfterPurchase = laborBreakdown.adjustedBuildingUsageTotal + viewModel.laborUsage * (1 - laborBreakdown.reductionRatio);
            return "建造后劳力 " + formatNumber(usageAfterPurchase) + "/" + formatNumber(laborBreakdown.populationLabor) + " → " + decisionProfile.bottleneck.action;
        }
        if (decisionProfile.bottleneck && decisionProfile.bottleneck.type === "chain_risk") { return formatResourceIdList([decisionProfile.bottleneck.resourceId]) + "净流量不足 → " + decisionProfile.bottleneck.action; }
        if (decisionProfile.bottleneck && decisionProfile.bottleneck.type === "capacity") {
            // ResourceState 容量受阻资源状态：用于显示当前容量。
            var resourceState = game.runtime.state.resourcesById[decisionProfile.bottleneck.resourceId];
            return formatResourceIdList([decisionProfile.bottleneck.resourceId]) + "容量 " + formatNumber(resourceState ? resourceState.maxValue : 0) + " → " + decisionProfile.bottleneck.action;
        }
        if (decisionProfile.bottleneck && (decisionProfile.bottleneck.type === "discrete_source" || decisionProfile.bottleneck.type === "source_missing")) { return formatResourceIdList([decisionProfile.bottleneck.resourceId]) + "无法自动等待 → " + decisionProfile.bottleneck.action; }
        if (reasonTokens.reservedForTargetName) { return "会占用“" + reasonTokens.reservedForTargetName + "”所需资源" + (Number.isFinite(reasonTokens.reservationDelaySeconds) ? "，约延迟 " + formatDuration(reasonTokens.reservationDelaySeconds) : "，当前无法自动补回") + " → 非紧急时暂缓"; }
        if (reasonTokens.kind === "progression" && reasonTokens.ownedCount === 0) { return "首座开放新系统 → " + getBuildingAvailabilityLabel(viewModel); }
        if (decisionProfile.primaryIntentId === "expand_housing") { return "住房压力 → 建成后增加 " + formatNumber(viewModel.definition.effects.housingMax || 0) + " 住房"; }
        if (decisionProfile.primaryIntentId === "survive_food") { return "口粮压力 → 建成后改善菌菇供给"; }
        if (decisionProfile.primaryIntentId === "recover_labor") { return "劳力紧张 → 建成后降低生产占用"; }
        return getBuildingSingleBottleneck(viewModel);
    }

    /**
     * 获取蓝图签唯一瓶颈文本。
     *
     * @param {Object} viewModel - 建筑视图模型。
     * @returns {string} 最多一个资源缺口或具名前置说明。
     */
    function getBuildingSingleBottleneck(viewModel) {
        if (viewModel.isPreview) { return viewModel.unlockText; }
        if (viewModel.capacityBlockedResourceIds.length > 0) { return formatResourceIdList([viewModel.capacityBlockedResourceIds[0]]) + "容量不足"; }
        if (viewModel.sourceBlockedResourceIds.length > 0) { return getResourceAcquisitionText(viewModel.sourceBlockedResourceIds[0]); }
        if (viewModel.waitInfo.entries.length > 0) {
            // ResourceWaitEntry 首要等待条目：统一等待模型已按资源系统给出最大等待。
            var waitEntry = viewModel.waitInfo.entries[0];
            return "缺 " + formatNumber(waitEntry.missingAmount) + " " + formatResourceIdList([waitEntry.resource]);
        }
        return viewModel.willOverloadLabor ? "建成后生产将停摆" : "资源已齐备";
    }

    /**
     * 渲染按六个稳定分区组织的完整建筑图鉴。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 图鉴筛选和分区建筑列表容器。
     */
    function renderBuildingCatalog(state, viewModels) {
        // HTMLElement 图鉴容器元素：原位替换决策队列。
        var catalogElement = document.createElement("div");
        // HTMLElement 筛选栏元素：只保留四个状态和仅已拥有开关。
        var filterElement = document.createElement("div");
        // Object.<string, string> 筛选文案字典：key 为受控筛选 ID，value 为玩家可见名称。
        var filterLabelById = { all: "全部", available: "可建", waiting: "等待", blocked: "受阻" };
        // string[] 筛选 ID 数组：决定固定按钮顺序。
        var filterIds = ["all", "available", "waiting", "blocked"];
        // Function 当前筛选谓词：由四种受控状态和拥有开关共同决定。
        var filterPredicate = getBuildingFilterPredicate(game.runtime.buildingFilter || "all");
        // string 标准化搜索词：匹配名称、说明、效果、成本和解锁条件。
        var searchText = (game.runtime.buildingSearchText || "").trim().toLowerCase();
        // Object[] 匹配模型数组：保持原定义设计顺序，不执行用户排序。
        var matchedModels = viewModels.filter(function (viewModel) {
            return filterPredicate(viewModel) && (!game.runtime.isBuildingOwnedOnly || (viewModel.state && viewModel.state.owned > 0)) && doesBuildingMatchSearch(viewModel, searchText);
        });

        catalogElement.className = "building-catalog";
        filterElement.className = "building-catalog-filters";
        // number 筛选循环索引：生成四个固定状态按钮。
        for (var filterIndex = 0; filterIndex < filterIds.length; filterIndex += 1) {
            // string 当前筛选 ID：用于按钮数据和选中态。
            var filterId = filterIds[filterIndex];
            // HTMLButtonElement 筛选按钮：切换后只局部重绘建设指挥板。
            var filterButtonElement = document.createElement("button");

            filterButtonElement.type = "button";
            filterButtonElement.dataset.buildingFilter = filterId;
            filterButtonElement.setAttribute("aria-pressed", String((game.runtime.buildingFilter || "all") === filterId));
            filterButtonElement.textContent = filterLabelById[filterId];
            filterElement.appendChild(filterButtonElement);
        }
        // HTMLButtonElement 仅已拥有开关：通过拥有量大于零筛选。
        var ownedButtonElement = document.createElement("button");

        ownedButtonElement.type = "button";
        ownedButtonElement.dataset.buildingOwnedOnlyToggle = "true";
        ownedButtonElement.setAttribute("aria-pressed", String(Boolean(game.runtime.isBuildingOwnedOnly)));
        ownedButtonElement.textContent = game.runtime.isBuildingOwnedOnly ? "✓ 仅已拥有" : "仅已拥有";
        filterElement.appendChild(ownedButtonElement);
        catalogElement.appendChild(filterElement);

        if (matchedModels.length <= 0) {
            // HTMLElement 空结果元素：说明条件并提供清除入口。
            var emptyElement = document.createElement("div");
            // HTMLButtonElement 清除筛选按钮：恢复全部状态、拥有开关和搜索词。
            var clearButtonElement = document.createElement("button");

            emptyElement.className = "building-catalog-empty";
            emptyElement.appendChild(createTextElement("p", "当前搜索与筛选条件下没有建筑。"));
            clearButtonElement.type = "button";
            clearButtonElement.dataset.buildingFilterClear = "true";
            clearButtonElement.textContent = "清除筛选";
            emptyElement.appendChild(clearButtonElement);
            catalogElement.appendChild(emptyElement);
            return catalogElement;
        }

        // number 分区循环索引：按静态六分区顺序生成稳定列表。
        for (var routeIndex = 0; routeIndex < game.definitions.BUILDING_ROUTE_DEFINITIONS.length; routeIndex += 1) {
            // BuildingRouteDefinition 当前建筑分区定义：提供稳定 ID 与中文名。
            var routeDefinition = game.definitions.BUILDING_ROUTE_DEFINITIONS[routeIndex];
            // Object[] 当前分区全部已揭示模型：用于标题计数。
            var revealedRouteModels = viewModels.filter(function (viewModel) { return viewModel.definition.routeId === routeDefinition.id; });
            // Object[] 当前分区匹配模型：保持 designOrder 原顺序。
            var matchedRouteModels = matchedModels.filter(function (viewModel) { return viewModel.definition.routeId === routeDefinition.id; });

            if (matchedRouteModels.length <= 0) { continue; }
            // HTMLElement 分区元素：承载标题与单列建筑列表。
            var routeElement = document.createElement("section");
            // HTMLElement 建筑列表元素：每行一栋建筑并保持设计顺序。
            var buildingListElement = document.createElement("div");

            routeElement.className = "building-catalog-route route-" + routeDefinition.id;
            routeElement.appendChild(createTextElement("h4", routeDefinition.name + "　" + revealedRouteModels.length + "/" + countBuildingDefinitionsByRoute(routeDefinition.id)));
            buildingListElement.className = "building-catalog-list";
            // number 模型循环索引：按 designOrder 生成建筑列表行。
            for (var modelIndex = 0; modelIndex < matchedRouteModels.length; modelIndex += 1) {
                buildingListElement.appendChild(renderBuildingBlueprintSlip(state, matchedRouteModels[modelIndex], true));
            }
            routeElement.appendChild(buildingListElement);
            if (routeDefinition.id === "industry") {
                // HTMLButtonElement 生产链次级入口：仅工业分区显示，不常驻首屏。
                var industryButtonElement = document.createElement("button");

                industryButtonElement.type = "button";
                industryButtonElement.dataset.industryChainToggle = "true";
                industryButtonElement.className = "building-secondary-action";
                industryButtonElement.textContent = game.runtime.isIndustryChainOpen ? "收起工业生产链" : "查看工业生产链";
                routeElement.appendChild(industryButtonElement);
                if (game.runtime.isIndustryChainOpen) { routeElement.appendChild(renderIndustryChain(state)); }
            }
            catalogElement.appendChild(routeElement);
        }
        return catalogElement;
    }

    /**
     * 统计指定分区的静态建筑定义总数。
     *
     * @param {BuildingRouteId} routeId - 六分区之一的稳定 ID。
     * @returns {number} 分区建筑定义数量，非负整数。
     */
    function countBuildingDefinitionsByRoute(routeId) {
        return game.definitions.BUILDING_DEFINITIONS.filter(function (buildingDefinition) { return buildingDefinition.routeId === routeId; }).length;
    }

    /**
     * 渲染原生 Canvas 地穴建设图；建筑只作为空间节点绘制，不生成列表、网格或卡片 DOM。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 地穴建设图容器，包含画布、图例和唯一详情浮框。
     */
    function renderBuildingCaveMap(state, viewModels) {
        // HTMLElement 建设图容器：为画布和绝对定位详情浮框提供坐标系。
        var mapElement = document.createElement("section");
        // HTMLCanvasElement 建设画布：绘制分区、隧道和建筑节点。
        var canvasElement = document.createElement("canvas");
        // HTMLElement 详情浮框：全图只创建一个，按命中节点动态填充。
        var popoverElement = document.createElement("div");
        // HTMLElement 图例元素：解释节点图形而不承担建筑浏览功能。
        var legendElement = document.createElement("div");
        // Object[] 可绘制建筑模型：应用当前分区、搜索和状态筛选。
        var visibleViewModels = getVisibleBuildingMapModels(viewModels);

        mapElement.className = "building-cave-map";
        canvasElement.className = "building-map-canvas";
        canvasElement.dataset.buildingMapCanvas = "true";
        canvasElement.setAttribute("aria-label", "地穴建设图；移动指针或点击建筑节点查看详情");
        canvasElement.tabIndex = 0;
        // Object[] 画布建筑模型：事件命中后读取，不作为游戏权威状态。
        canvasElement.buildingViewModels = visibleViewModels;
        // Object[] 节点命中区：drawBuildingCaveMap 写入 x、y、radius 和 buildingId。
        canvasElement.buildingHitAreas = [];
        popoverElement.className = "building-map-popover";
        popoverElement.dataset.buildingMapPopover = "true";
        popoverElement.setAttribute("role", "tooltip");
        popoverElement.hidden = true;
        legendElement.className = "building-map-legend";
        legendElement.appendChild(createTextElement("span", "◆ 可建"));
        legendElement.appendChild(createTextElement("span", "△ 等待"));
        legendElement.appendChild(createTextElement("span", "× 受阻"));
        legendElement.appendChild(createTextElement("span", "◇ 接近解锁"));
        mapElement.appendChild(canvasElement);
        mapElement.appendChild(popoverElement);
        mapElement.appendChild(legendElement);

        window.requestAnimationFrame(function () {
            drawBuildingCaveMap(canvasElement, visibleViewModels);
        });
        return mapElement;
    }

    /**
     * 获取当前筛选、搜索和分区聚焦后的建筑地图模型。
     *
     * @param {Object[]} viewModels - 全部已揭示建筑视图模型数组。
     * @returns {Object[]} 保持稳定排序的地图模型数组。
     */
    function getVisibleBuildingMapModels(viewModels) {
        // Function 当前状态筛选谓词：只影响地图投影。
        var filterPredicate = getBuildingFilterPredicate(game.runtime.buildingFilter || "all");
        // string 标准化搜索词：匹配名称、效果、资源和解锁来源。
        var searchText = (game.runtime.buildingSearchText || "").trim().toLowerCase();
        // Object[] 可见地图模型：不会修改原始视图模型数组。
        var visibleViewModels = viewModels.filter(function (viewModel) {
            // boolean 是否属于聚焦分区：目录视图或未聚焦时允许全部分区。
            var isInFocusedRoute = game.runtime.buildingViewId === "catalog" || !game.runtime.buildingRouteId || viewModel.definition.routeId === game.runtime.buildingRouteId;

            return isInFocusedRoute && filterPredicate(viewModel) && doesBuildingMatchSearch(viewModel, searchText);
        });

        sortBuildingViewModels(visibleViewModels, game.runtime.buildingSort || "status");
        return visibleViewModels;
    }

    /**
     * 绘制地穴建设图，并生成与绘制节点一致的命中区域。
     *
     * @param {HTMLCanvasElement} canvasElement - 建设图画布，会修改像素尺寸和 buildingHitAreas。
     * @param {Object[]} viewModels - 当前要绘制的建筑模型数组。
     * @returns {void} 无返回值。
     */
    function drawBuildingCaveMap(canvasElement, viewModels) {
        // CanvasRenderingContext2D|null 绘图上下文：不可用时不绘制。
        var context = canvasElement.getContext("2d");

        if (!context) {
            return;
        }

        // number 画布 CSS 宽度：随中栏可用空间变化，单位 CSS 像素。
        var cssWidth = Math.max(280, canvasElement.clientWidth || 900);
        // number 画布 CSS 高度：固定管理视野高度，单位 CSS 像素。
        var cssHeight = cssWidth < 760 ? 820 : (game.runtime.buildingRouteId ? 620 : 720);
        // number 设备像素倍率：高清屏保持文字和线条锐利，范围至少 1。
        var pixelRatio = Math.max(1, window.devicePixelRatio || 1);

        canvasElement.width = Math.round(cssWidth * pixelRatio);
        canvasElement.height = Math.round(cssHeight * pixelRatio);
        canvasElement.style.height = cssHeight + "px";
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);
        drawBuildingMapBackground(context, cssWidth, cssHeight);

        // Object.<string, Object> 分区锚点字典：key 为 BuildingRouteId，value 包含 x、y 和 color。
        var anchorByRouteId = getBuildingMapAnchors(cssWidth, cssHeight);

        drawBuildingMapTunnels(context, anchorByRouteId);
        drawBuildingMapRouteLabels(context, anchorByRouteId);
        canvasElement.buildingHitAreas = [];

        // Object.<string, number> 分区节点计数字典：key 为 BuildingRouteId，value 为当前分区已布局节点数。
        var routeNodeCountById = {};

        for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) {
            // Object 当前建筑模型：用于计算空间位置和状态外观。
            var viewModel = viewModels[modelIndex];
            // BuildingRouteId 当前建筑分区 ID：决定围绕哪个洞室锚点布局。
            var routeId = viewModel.definition.routeId;
            // number 当前分区节点序号：用于生成确定性螺旋位置，非负整数。
            var routeNodeIndex = routeNodeCountById[routeId] || 0;
            // Object 分区锚点：包含 CSS 像素坐标和边线颜色。
            var anchor = anchorByRouteId[routeId];
            // Object 节点位置：包含 x、y 和 radius，单位 CSS 像素。
            var nodePosition = getBuildingMapNodePosition(anchor, routeNodeIndex, cssWidth, cssHeight, Boolean(game.runtime.buildingRouteId));

            routeNodeCountById[routeId] = routeNodeIndex + 1;
            drawBuildingMapNode(context, viewModel, nodePosition, anchor.color);
            canvasElement.buildingHitAreas.push({
                buildingId: viewModel.definition.id,
                x: nodePosition.x,
                y: nodePosition.y,
                radius: nodePosition.radius
            });
        }

        if (viewModels.length <= 0) {
            context.fillStyle = "#a99d84";
            context.font = "14px sans-serif";
            context.textAlign = "center";
            context.fillText("当前筛选下没有已揭示建筑", cssWidth / 2, cssHeight / 2);
        }
    }

    /**
     * 绘制低饱和岩层背景和洞室纹理。
     *
     * @param {CanvasRenderingContext2D} context - 二维绘图上下文，会写入像素。
     * @param {number} width - CSS 画布宽度，单位像素。
     * @param {number} height - CSS 画布高度，单位像素。
     * @returns {void} 无返回值。
     */
    function drawBuildingMapBackground(context, width, height) {
        // CanvasGradient 背景渐变：由中心暖褐过渡到边缘深岩色。
        var gradient = context.createRadialGradient(width * 0.5, height * 0.45, 30, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);

        gradient.addColorStop(0, "#29251d");
        gradient.addColorStop(1, "#12130f");
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        context.strokeStyle = "rgba(126, 105, 67, 0.10)";
        context.lineWidth = 1;
        for (var ringIndex = 0; ringIndex < 9; ringIndex += 1) {
            context.beginPath();
            context.ellipse(width * 0.5, height * 0.5, 90 + ringIndex * 58, 55 + ringIndex * 42, -0.12, 0, Math.PI * 2);
            context.stroke();
        }
    }

    /**
     * 计算六个建设分区的固定空间锚点。
     *
     * @param {number} width - CSS 画布宽度，单位像素。
     * @param {number} height - CSS 画布高度，单位像素。
     * @returns {Object.<string, Object>} 分区锚点字典；每个值包含 x、y、color。
     */
    function getBuildingMapAnchors(width, height) {
        return {
            survival: { x: width * 0.20, y: height * 0.25, color: "#7f9855" },
            storage: { x: width * 0.50, y: height * 0.16, color: "#9a8052" },
            industry: { x: width * 0.80, y: height * 0.28, color: "#b56d42" },
            governance: { x: width * 0.22, y: height * 0.72, color: "#c0964b" },
            military: { x: width * 0.53, y: height * 0.78, color: "#a75249" },
            abyss: { x: width * 0.82, y: height * 0.70, color: "#4d9290" }
        };
    }

    /**
     * 绘制分区之间的隧道连线，表达帝国结构而非严格前置关系。
     *
     * @param {CanvasRenderingContext2D} context - 二维绘图上下文。
     * @param {Object.<string, Object>} anchorByRouteId - 分区锚点字典。
     * @returns {void} 无返回值。
     */
    function drawBuildingMapTunnels(context, anchorByRouteId) {
        // string[][] 隧道连接对数组：每项包含两个 BuildingRouteId。
        var routePairs = [["survival", "storage"], ["storage", "industry"], ["survival", "governance"], ["storage", "military"], ["industry", "abyss"], ["governance", "military"], ["military", "abyss"]];

        context.lineWidth = 8;
        context.strokeStyle = "rgba(91, 78, 57, 0.42)";
        for (var pairIndex = 0; pairIndex < routePairs.length; pairIndex += 1) {
            // Object 起点锚点：隧道连接的第一个分区。
            var startAnchor = anchorByRouteId[routePairs[pairIndex][0]];
            // Object 终点锚点：隧道连接的第二个分区。
            var endAnchor = anchorByRouteId[routePairs[pairIndex][1]];

            context.beginPath();
            context.moveTo(startAnchor.x, startAnchor.y);
            context.quadraticCurveTo((startAnchor.x + endAnchor.x) / 2, (startAnchor.y + endAnchor.y) / 2 - 18, endAnchor.x, endAnchor.y);
            context.stroke();
        }
    }

    /**
     * 绘制六个分区名称。
     *
     * @param {CanvasRenderingContext2D} context - 二维绘图上下文。
     * @param {Object.<string, Object>} anchorByRouteId - 分区锚点字典。
     * @returns {void} 无返回值。
     */
    function drawBuildingMapRouteLabels(context, anchorByRouteId) {
        context.font = "600 14px sans-serif";
        context.textAlign = "center";
        for (var routeIndex = 0; routeIndex < game.definitions.BUILDING_ROUTE_DEFINITIONS.length; routeIndex += 1) {
            // BuildingRouteDefinition 当前分区定义：用于显示符号和中文名。
            var routeDefinition = game.definitions.BUILDING_ROUTE_DEFINITIONS[routeIndex];
            // Object 当前分区锚点：用于放置标题。
            var anchor = anchorByRouteId[routeDefinition.id];

            context.fillStyle = anchor.color;
            context.fillText(routeDefinition.symbol + " " + routeDefinition.name, anchor.x, anchor.y - 64);
        }
    }

    /**
     * 计算建筑节点围绕分区洞室的确定性螺旋位置。
     *
     * @param {Object} anchor - 分区锚点；包含 x、y 和 color。
     * @param {number} nodeIndex - 分区内节点序号，非负整数。
     * @param {number} width - CSS 画布宽度，单位像素。
     * @param {number} height - CSS 画布高度，单位像素。
     * @param {boolean} isFocusedRoute - true 表示单分区聚焦，节点可使用更大范围。
     * @returns {Object} 节点位置；包含 x、y、radius，单位 CSS 像素。
     */
    function getBuildingMapNodePosition(anchor, nodeIndex, width, height, isFocusedRoute) {
        // number 黄金角：让节点自然分散而不形成规则表格，单位弧度。
        var goldenAngle = 2.399963;
        // number 节点环距：聚焦单区时扩大空间，单位 CSS 像素。
        var ringDistance = isFocusedRoute ? 42 : 31;
        // number 螺旋半径：随节点序号平方根增长，单位 CSS 像素。
        var spiralRadius = 24 + Math.sqrt(nodeIndex) * ringDistance;
        // number 节点角度：加入分区锚点坐标扰动，保持确定但不机械。
        var angle = nodeIndex * goldenAngle + anchor.x * 0.001;
        // number 横坐标：限制在画布安全边距内，单位 CSS 像素。
        var x = Math.max(42, Math.min(width - 42, anchor.x + Math.cos(angle) * spiralRadius));
        // number 纵坐标：椭圆压缩后限制在画布安全边距内，单位 CSS 像素。
        var y = Math.max(54, Math.min(height - 54, anchor.y + Math.sin(angle) * spiralRadius * 0.72));

        return { x: x, y: y, radius: isFocusedRoute ? 22 : 18 };
    }

    /**
     * 绘制单个建筑节点、拥有量和短名称。
     *
     * @param {CanvasRenderingContext2D} context - 二维绘图上下文。
     * @param {Object} viewModel - 建筑视图模型。
     * @param {Object} position - 节点位置；包含 x、y、radius。
     * @param {string} routeColor - 所属分区 CSS 颜色。
     * @returns {void} 无返回值。
     */
    function drawBuildingMapNode(context, viewModel, position, routeColor) {
        // Object.<string, string> 状态填充色字典：key 为建筑封闭状态 ID。
        var fillColorByStatus = { available: "#5f7d42", unaffordable: "#6d5a38", blocked: "#432d29", preview: "#252722", paused: "#3e3d38" };
        // string 状态图形：保证颜色不是唯一表达。
        var statusSymbol = getBuildingStatusSymbol(viewModel.buildingViewStatus);

        context.beginPath();
        context.arc(position.x, position.y, position.radius, 0, Math.PI * 2);
        context.fillStyle = fillColorByStatus[viewModel.buildingViewStatus] || "#292a25";
        context.fill();
        context.lineWidth = viewModel.isKeyBuilding ? 4 : 2;
        context.strokeStyle = routeColor;
        if (viewModel.isPreview || viewModel.buildingViewStatus === "blocked") {
            context.setLineDash([4, 3]);
        }
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = "#eee3c9";
        context.font = "700 12px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(statusSymbol, position.x, position.y);
        context.font = "11px sans-serif";
        context.textBaseline = "top";
        context.fillStyle = "#d8ceb7";
        context.fillText(viewModel.isPreview ? "未知设施" : viewModel.definition.name, position.x, position.y + position.radius + 5);
        if (!viewModel.isPreview && viewModel.state.owned > 0) {
            context.fillStyle = "#d9ad52";
            context.font = "10px sans-serif";
            context.fillText("×" + viewModel.state.owned, position.x + position.radius - 2, position.y - position.radius - 5);
        }
    }

    /**
     * 按画布坐标查找命中的建筑节点 ID。
     *
     * @param {HTMLCanvasElement} canvasElement - 建设图画布；buildingHitAreas 由绘制函数生成。
     * @param {number} clientX - 指针视口横坐标，单位 CSS 像素。
     * @param {number} clientY - 指针视口纵坐标，单位 CSS 像素。
     * @returns {BuildingId|string} 命中的建筑 ID；未命中时返回空字符串。
     */
    function getBuildingMapHitId(canvasElement, clientX, clientY) {
        // DOMRect 画布视口边界：用于把指针坐标转换为画布 CSS 坐标。
        var canvasRect = canvasElement.getBoundingClientRect();
        // number 画布横坐标：单位 CSS 像素。
        var canvasX = clientX - canvasRect.left;
        // number 画布纵坐标：单位 CSS 像素。
        var canvasY = clientY - canvasRect.top;
        // Object[] 命中区数组：每项包含 buildingId、x、y 和 radius。
        var hitAreas = canvasElement.buildingHitAreas || [];

        for (var hitIndex = hitAreas.length - 1; hitIndex >= 0; hitIndex -= 1) {
            // Object 当前命中区：用于计算指针到节点圆心的距离。
            var hitArea = hitAreas[hitIndex];
            // number 横向距离：指针与节点圆心的 CSS 像素差。
            var deltaX = canvasX - hitArea.x;
            // number 纵向距离：指针与节点圆心的 CSS 像素差。
            var deltaY = canvasY - hitArea.y;

            if (deltaX * deltaX + deltaY * deltaY <= Math.pow(hitArea.radius + 8, 2)) {
                return hitArea.buildingId;
            }
        }

        return "";
    }

    /**
     * 在建设图内显示命中建筑的唯一详情浮框。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLCanvasElement} canvasElement - 建设图画布。
     * @param {BuildingId} buildingId - 要显示的建筑稳定 ID。
     * @param {number} clientX - 浮框锚点视口横坐标，单位 CSS 像素。
     * @param {number} clientY - 浮框锚点视口纵坐标，单位 CSS 像素。
     * @returns {void} 无返回值；会更新浮框 DOM 和位置。
     */
    function showBuildingMapPopover(state, canvasElement, buildingId, clientX, clientY) {
        // HTMLElement|null 地图容器：用于限制浮框坐标范围。
        var mapElement = canvasElement.closest(".building-cave-map");
        // HTMLElement|null 详情浮框：全图唯一动态详情节点。
        var popoverElement = mapElement ? mapElement.querySelector("[data-building-map-popover]") : null;

        if (!mapElement || !popoverElement) {
            return;
        }

        // Object|null 建筑视图模型：从画布当前投影中按稳定 ID 查找。
        var viewModel = null;
        // Object[] 当前画布模型数组：不会作为游戏权威状态。
        var viewModels = canvasElement.buildingViewModels || [];

        for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) {
            if (viewModels[modelIndex].definition.id === buildingId) {
                viewModel = viewModels[modelIndex];
                break;
            }
        }

        if (!viewModel) {
            hideBuildingMapPopover(canvasElement);
            return;
        }

        // HTMLElement 临时详情浮框：复用统一建筑详情字段生成函数。
        var detailElement = createBuildingViewTooltip(state, viewModel);

        popoverElement.innerHTML = "";
        while (detailElement.firstChild) {
            popoverElement.appendChild(detailElement.firstChild);
        }
        // HTMLElement 浮框操作区：固定详情时提供建造与管理操作。
        var actionsElement = document.createElement("div");
        // HTMLButtonElement 建造按钮：复用既有建筑购买事件入口。
        var buyButtonElement = document.createElement("button");

        actionsElement.className = "building-map-popover-actions";
        buyButtonElement.type = "button";
        buyButtonElement.dataset.buildingId = buildingId;
        buyButtonElement.disabled = viewModel.buildingViewStatus !== "available";
        buyButtonElement.textContent = getBuildingActionLabel(viewModel);
        actionsElement.appendChild(buyButtonElement);
        if (!viewModel.isPreview && viewModel.state.owned > 0) {
            appendBuildingDestroyControls(actionsElement, state, viewModel);
        }
        popoverElement.appendChild(actionsElement);
        popoverElement.hidden = false;
        popoverElement.dataset.buildingId = buildingId;
        popoverElement.classList.toggle("is-pinned", game.runtime.pinnedBuildingMapId === buildingId);

        // DOMRect 地图视口边界：用于把指针坐标换算为容器内部位置。
        var mapRect = mapElement.getBoundingClientRect();
        // number 浮框宽度：显示后测量的 CSS 像素宽度。
        var popoverWidth = popoverElement.offsetWidth;
        // number 浮框高度：显示后测量的 CSS 像素高度。
        var popoverHeight = popoverElement.offsetHeight;
        // number 浮框左坐标：限制在地图容器内，单位 CSS 像素。
        var leftPosition = Math.max(8, Math.min(mapRect.width - popoverWidth - 8, clientX - mapRect.left + 16));
        // number 浮框顶坐标：优先显示在指针下方，空间不足时翻到上方。
        var topPosition = clientY - mapRect.top + 16;

        if (topPosition + popoverHeight > mapRect.height - 8) {
            topPosition = Math.max(8, clientY - mapRect.top - popoverHeight - 16);
        }
        popoverElement.style.left = leftPosition + "px";
        popoverElement.style.top = topPosition + "px";
    }

    /**
     * 隐藏建设图详情浮框。
     *
     * @param {HTMLCanvasElement} canvasElement - 建设图画布。
     * @returns {void} 无返回值。
     */
    function hideBuildingMapPopover(canvasElement) {
        // HTMLElement|null 地图容器：用于查找唯一详情浮框。
        var mapElement = canvasElement.closest(".building-cave-map");
        // HTMLElement|null 详情浮框：存在时隐藏并清除当前建筑 ID。
        var popoverElement = mapElement ? mapElement.querySelector("[data-building-map-popover]") : null;

        if (popoverElement) {
            popoverElement.hidden = true;
            popoverElement.dataset.buildingId = "";
            popoverElement.classList.remove("is-pinned");
        }
    }

    /**
     * 渲染建筑工作台顶部三个常驻入口。
     *
     * @returns {HTMLElement} 搜索与目录切换入口容器。
     */
    function renderBuildingToolbar() {
        // HTMLElement 顶部工具栏元素：默认严格保持三个操作入口。
        var toolbarElement = document.createElement("div");
        // HTMLInputElement 搜索输入框：匹配建筑语义字段。
        var searchInputElement = document.createElement("input");
        // HTMLButtonElement 视图切换按钮：在总览和目录之间切换。
        var viewButtonElement = document.createElement("button");

        toolbarElement.className = "building-toolbar";
        searchInputElement.type = "search";
        searchInputElement.className = "game-search-input";
        searchInputElement.dataset.buildingSearch = "true";
        searchInputElement.value = game.runtime.buildingSearchText || "";
        searchInputElement.placeholder = "搜索建筑、住房、劳力、铁矿……";
        searchInputElement.setAttribute("aria-label", "搜索建筑、效果、资源或解锁系统");
        viewButtonElement.type = "button";
        viewButtonElement.dataset.buildingViewId = game.runtime.buildingViewId === "catalog" ? "overview" : "catalog";
        viewButtonElement.textContent = game.runtime.buildingViewId === "catalog" ? "返回总览" : "目录";
        toolbarElement.appendChild(searchInputElement);
        toolbarElement.appendChild(viewButtonElement);
        return toolbarElement;
    }

    /**
     * 渲染当前选中建筑的常驻详情面板。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 常驻详情面板元素。
     */
    function renderSelectedBuildingDetails(state, viewModels) {
        // HTMLElement 详情面板元素：桌面常驻，窄屏作为可滚动详情区。
        var detailElement = document.createElement("aside");
        // Object|null 选中建筑模型：未选中或已隐藏时为 null。
        var selectedViewModel = null;

        detailElement.className = "building-detail-panel";
        for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) {
            if (viewModels[modelIndex].definition.id === game.runtime.selectedBuildingId) {
                selectedViewModel = viewModels[modelIndex];
                break;
            }
        }
        if (!selectedViewModel) {
            detailElement.appendChild(createTextElement("h4", "建筑详情"));
            detailElement.appendChild(createTextElement("p", "选择一栋建筑查看效果与成本。"));
            return detailElement;
        }
        if (game.runtime.isBuildingInspectorOpen) {
            detailElement.classList.add("is-active");
        }
        if (game.runtime.recentlyBuiltBuildingId === selectedViewModel.definition.id) {
            detailElement.classList.add("is-build-success");
        }
        // HTMLButtonElement 窄屏详情关闭按钮：桌面隐藏，关闭后保留原列表滚动位置。
        var closeDetailButtonElement = document.createElement("button");

        closeDetailButtonElement.type = "button";
        closeDetailButtonElement.dataset.buildingDetailClose = "true";
        closeDetailButtonElement.className = "building-detail-close";
        closeDetailButtonElement.textContent = "关闭详情";
        detailElement.appendChild(closeDetailButtonElement);
        // string 检查器标题 ID：建立 aside 与当前建筑名称的无障碍关联。
        var inspectorTitleId = "building-inspector-title";
        // HTMLElement 检查器标题元素：移动端抽屉打开后的焦点语义锚点。
        var inspectorTitleElement = createTextElement("h4", selectedViewModel.definition.name);

        inspectorTitleElement.id = inspectorTitleId;
        inspectorTitleElement.tabIndex = -1;
        detailElement.setAttribute("aria-labelledby", inspectorTitleId);
        detailElement.appendChild(inspectorTitleElement);
        if (game.runtime.recentlyBuiltBuildingId === selectedViewModel.definition.id) {
            // HTMLElement 克制播报元素：通知读屏器建造结果，不抢夺焦点。
            var liveElement = createTextElement("p", "已建造" + selectedViewModel.definition.name + "，当前拥有 " + selectedViewModel.state.owned + " 座");

            liveElement.className = "building-live-result";
            liveElement.setAttribute("aria-live", "polite");
            detailElement.appendChild(liveElement);
            window.setTimeout(function () { game.runtime.recentlyBuiltBuildingId = ""; }, 500);
        }
        if (selectedViewModel.isPreview) {
            detailElement.appendChild(createTextElement("p", "用途剪影：" + game.buildingView.getEffectTagLabel(selectedViewModel.definition.effectTags[0])));
            detailElement.appendChild(createTextElement("p", "解锁条件：" + selectedViewModel.unlockText));
            return detailElement;
        }
        detailElement.appendChild(createTextElement("p", selectedViewModel.definition.description));
        detailElement.appendChild(createTextElement("p", "决策结论：" + getBuildingAvailabilityLabel(selectedViewModel) + (selectedViewModel.willOverloadLabor ? "；建造后劳力将过载。" : "；建造后劳力仍可覆盖。")));
        detailElement.appendChild(createTextElement("p", "解锁来源　" + selectedViewModel.unlockText));
        detailElement.appendChild(renderBuildingCostLedger(state, selectedViewModel));
        detailElement.appendChild(createTextElement("p", "下一座价格　" + formatPriceList(selectedViewModel.nextPrice) + "；价格倍率 ×" + selectedViewModel.definition.priceRatio.toFixed(2)));
        // ResourceId[] 解法资源 ID 数组：容量阻断优先，其次为暂无来源阻断。
        var solutionResourceIds = selectedViewModel.capacityBlockedResourceIds.concat(selectedViewModel.sourceBlockedResourceIds);

        for (var solutionIndex = 0; solutionIndex < solutionResourceIds.length; solutionIndex += 1) {
            // ResourceId 当前阻断资源 ID：用于查找容量或生产来源建筑。
            var solutionResourceId = solutionResourceIds[solutionIndex];
            // boolean 是否为容量阻断：true 查找容量建筑，false 查找持续来源建筑。
            var isCapacitySolution = selectedViewModel.capacityBlockedResourceIds.indexOf(solutionResourceId) >= 0;
            // Object|null 解法建筑模型：只允许定位当前已揭示建筑。
            var solutionViewModel = findBuildingSolutionViewModel(viewModels, solutionResourceId, isCapacitySolution);

            if (solutionViewModel) {
                // HTMLButtonElement 解法定位按钮：只切换分区并选中，不自动购买。
                var solutionButtonElement = document.createElement("button");

                solutionButtonElement.type = "button";
                solutionButtonElement.dataset.buildingSolutionId = solutionViewModel.definition.id;
                solutionButtonElement.textContent = "查看" + game.resources.getResourceDisplayName(solutionResourceId) + (isCapacitySolution ? "容量" : "来源") + "：" + solutionViewModel.definition.name;
                detailElement.appendChild(solutionButtonElement);
            }
        }
        detailElement.appendChild(createTextElement("h5", "建成后"));
        detailElement.appendChild(createTextElement("p", "单座增量　" + formatBuildingEffects(selectedViewModel.definition.effects)));
        detailElement.appendChild(createTextElement("p", "当前累计　" + formatBuildingAccumulatedEffects(selectedViewModel.definition.effects, selectedViewModel.state.owned)));
        detailElement.appendChild(createTextElement("p", "开放内容　" + formatUnlockBundle(selectedViewModel.definition.unlock)));
        detailElement.appendChild(createTextElement("p", "拥有/启用　" + selectedViewModel.state.owned + " / " + selectedViewModel.state.active + "；单座劳力 +" + formatNumber(selectedViewModel.laborUsage)));
        if (selectedViewModel.willOverloadLabor) {
            detailElement.appendChild(createTextElement("p", "⚠ 建成后劳力过载，除菌菇床外的生产建筑将停产。"));
        }
        // HTMLButtonElement 详情主建造按钮：与列表共用既有购买系统。
        var buyButtonElement = document.createElement("button");

        buyButtonElement.type = "button";
        buyButtonElement.className = "building-primary-action";
        buyButtonElement.dataset.buildingId = selectedViewModel.definition.id;
        buyButtonElement.disabled = selectedViewModel.buildingViewStatus !== "available";
        buyButtonElement.textContent = getBuildingActionLabel(selectedViewModel);
        // HTMLElement 建筑操作行：并排承载建造与已拥有建筑的摧毁入口。
        var buildingActionElement = document.createElement("div");

        buildingActionElement.className = "building-detail-actions";
        if (game.runtime.confirmBuildingRiskId === selectedViewModel.definition.id) {
            detailElement.appendChild(createTextElement("p", "风险确认：建造后建筑劳力将超过人口供给，除菌菇床外的生产建筑会停产。"));
            // HTMLButtonElement 风险确认按钮：确认后调用既有单座购买入口。
            var riskConfirmButtonElement = document.createElement("button");
            // HTMLButtonElement 风险取消按钮：关闭确认且不修改状态。
            var riskCancelButtonElement = document.createElement("button");

            riskConfirmButtonElement.type = "button";
            riskConfirmButtonElement.dataset.buildingRiskConfirmId = selectedViewModel.definition.id;
            riskConfirmButtonElement.textContent = "确认建造";
            riskCancelButtonElement.type = "button";
            riskCancelButtonElement.dataset.buildingRiskCancel = "true";
            riskCancelButtonElement.textContent = "取消";
            buildingActionElement.appendChild(riskConfirmButtonElement);
            buildingActionElement.appendChild(riskCancelButtonElement);
        } else {
            buildingActionElement.appendChild(buyButtonElement);
        }
        if (selectedViewModel.state.owned > 0) {
            appendBuildingDestroyControls(buildingActionElement, state, selectedViewModel);
        }
        detailElement.appendChild(buildingActionElement);
        detailElement.appendChild(createTextElement("p", "摧毁返还　" + formatPriceList(selectedViewModel.refundPrice) + "；一次性解锁、成就和统计不会回滚"));
        return detailElement;
    }

    /**
     * 渲染建筑检查器中的逐资源成本账目。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 正式解锁建筑的视图模型。
     * @returns {HTMLElement} 成本账目元素；每行显示库存、需求和单一结论。
     */
    function renderBuildingCostLedger(state, viewModel) {
        // HTMLElement 账目容器元素：使用对齐列展示资源成本。
        var ledgerElement = document.createElement("section");

        ledgerElement.className = "building-cost-ledger";
        ledgerElement.appendChild(createTextElement("h5", "本次成本"));
        // number 价格循环索引：按静态价格顺序逐项生成账目行。
        for (var priceIndex = 0; priceIndex < viewModel.price.length; priceIndex += 1) {
            // Price 当前成本项：包含资源稳定 ID 与非负需求量。
            var priceEntry = viewModel.price[priceIndex];
            // ResourceState|null 当前资源状态：缺失时按零库存和零容量处理。
            var resourceState = state.resourcesById[priceEntry.resource] || null;
            // number 当前库存：非负资源量。
            var currentAmount = resourceState ? resourceState.value : 0;
            // number 当前缺口：非负资源量。
            var missingAmount = Math.max(0, priceEntry.amount - currentAmount);
            // HTMLElement 账目行元素：固定资源名、库存/需求和结论三列。
            var rowElement = document.createElement("div");
            // string 成本结论：足够、缺口、容量阻断或暂无来源之一。
            var conclusionText = missingAmount <= 0 ? "足够 ●" : "缺 " + formatNumber(missingAmount) + " ◐";

            if (resourceState && resourceState.maxValue < priceEntry.amount) { conclusionText = "容量 " + formatNumber(resourceState.maxValue) + " < " + formatNumber(priceEntry.amount) + " ×"; }
            else if (viewModel.sourceBlockedResourceIds.indexOf(priceEntry.resource) >= 0) { conclusionText = getResourceAcquisitionText(priceEntry.resource) + " ×"; }
            rowElement.appendChild(createTextElement("span", game.resources.getResourceDisplayName(priceEntry.resource)));
            rowElement.appendChild(createTextElement("span", formatNumber(currentAmount) + " / " + formatNumber(priceEntry.amount)));
            rowElement.appendChild(createTextElement("span", conclusionText));
            ledgerElement.appendChild(rowElement);
        }
        return ledgerElement;
    }

    /**
     * 查找能够处理资源容量或持续来源阻断的已揭示建筑。
     *
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @param {ResourceId} resourceId - 当前阻断资源稳定 ID。
     * @param {boolean} isCapacitySolution - true 查容量效果，false 查持续产出效果。
     * @returns {Object|null} 首个按设计顺序匹配的建筑模型；不存在时返回 null。
     */
    function findBuildingSolutionViewModel(viewModels, resourceId, isCapacitySolution) {
        // string 容量效果键：资源 ID 加 Max 的统一数据字段名。
        var capacityEffectId = resourceId + "Max";

        // number 模型循环索引：保持静态建筑设计顺序查找解法。
        for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) {
            // Object 当前建筑模型：用于检查效果字段。
            var viewModel = viewModels[modelIndex];
            // string[] 效果键数组：允许识别资源每 tick 或每秒产出字段。
            var effectIds = Object.keys(viewModel.definition.effects);

            if (isCapacitySolution && (viewModel.definition.effects[capacityEffectId] || viewModel.definition.effects.allBasicCapacity)) {
                return viewModel;
            }
            if (!isCapacitySolution) {
                // number 效果循环索引：匹配以资源 ID 开头且包含 Per 的持续产出字段。
                for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
                    if (effectIds[effectIndex].indexOf(resourceId) === 0 && effectIds[effectIndex].indexOf("Per") > 0 && viewModel.definition.effects[effectIds[effectIndex]] > 0) {
                        return viewModel;
                    }
                }
            }
        }

        return null;
    }

    /**
     * 渲染矿业工业分区的只读生产链。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 可折叠生产链区域。
     */
    function renderIndustryChain(state) {
        // HTMLElement 生产链区域：默认只显示切换入口。
        var chainElement = document.createElement("section");
        // HTMLButtonElement 生产链开关：不改变游戏状态。
        var toggleButtonElement = document.createElement("button");

        chainElement.className = "industry-chain";
        toggleButtonElement.type = "button";
        toggleButtonElement.dataset.industryChainToggle = "true";
        toggleButtonElement.setAttribute("aria-expanded", String(game.runtime.isIndustryChainOpen));
        toggleButtonElement.textContent = game.runtime.isIndustryChainOpen ? "收起生产链" : "查看生产链";
        chainElement.appendChild(toggleButtonElement);
        if (!game.runtime.isIndustryChainOpen) {
            return chainElement;
        }
        // string[] 工业链资源 ID：按上游到下游固定排列。
        var resourceIds = ["rottenWood", "coalSlag", "ironOre", "ironPlate", "steelIngot", "blackIron"];
        // string[] 工业链节点文本：显示库存、容量与当前净流量。
        var nodeTexts = [];

        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // ResourceId 当前资源 ID：用于读取定义和流量状态。
            var resourceId = resourceIds[resourceIndex];
            // ResourceDefinition|null 当前资源定义：用于显示中文名。
            var resourceDefinition = game.resources.getResourceDefinition(resourceId);
            // ResourceState|null 当前资源状态：用于显示库存、容量和净流量。
            var resourceState = state.resourcesById[resourceId] || null;

            if (resourceDefinition && resourceState) {
                nodeTexts.push(resourceDefinition.name + " " + formatNumber(resourceState.value) + "/" + formatNumber(resourceState.maxValue) + "（" + formatSignedNumber(resourceState.perSecond) + "/秒）");
            }
        }
        chainElement.appendChild(createTextElement("p", nodeTexts.join(" → ")));
        chainElement.appendChild(createTextElement("p", "朽木 → 闷炭窑 → 煤渣；铁矿 → 粗熔炉 → 铁片；煤渣 + 铁片 → 深炉 → 钢锭 → 黑铁。红字净流量表示链路当前断供。"));
        return chainElement;
    }

    /**
     * 渲染建设总览卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 建设总览卡元素。
     */
    function renderBuildingOverview(state, viewModels) {
        // HTMLElement 总览卡元素：显示建设阶段核心指标和首要瓶颈。
        var overviewElement = document.createElement("section");

        // number 正式解锁建筑数：不包含接近解锁预览。
        var unlockedCount = countBuildingModels(viewModels, function (viewModel) { return !viewModel.isPreview; });

        // number 已拥有建筑总座数：累加所有建筑拥有数量，非负整数。
        var ownedCount = sumBuildingOwned(viewModels);

        // number 可立即建造数：状态为 available 的建筑数量。
        var availableCount = countBuildingModels(viewModels, function (viewModel) { return viewModel.buildingViewStatus === "available"; });

        // number 等待资源数：资源不足但等待可达的建筑数量。
        var waitingCount = countBuildingModels(viewModels, function (viewModel) { return viewModel.buildingViewStatus === "unaffordable"; });

        // number 前置未满数：接近解锁建筑数量。
        var previewCount = countBuildingModels(viewModels, function (viewModel) { return viewModel.isPreview; });

        // number 当前存活人口：用于显示住房使用量，非负整数。
        var aliveCount = game.population.countAliveGoblins(state);

        // number 当前住房上限：由建筑效果派生，非负整数。
        var housingMax = game.population.calculateHousingMax(state);

        // LaborBreakdown 劳力摘要：用于显示建筑占用、人口供给和过载状态。
        var laborBreakdown = game.population.analyzeLaborBreakdown(state);

        // string 首要建设瓶颈：由当前状态确定性推导。
        var bottleneckText = getPrimaryBuildingBottleneck(state, viewModels);

        overviewElement.className = "card building-overview";
        overviewElement.appendChild(createTextElement("h4", "建设总览"));

        // HTMLElement 指标网格元素：将六项高频建设指标保持在同一视线。
        var metricsElement = document.createElement("div");

        metricsElement.className = "building-overview-metrics";
        metricsElement.appendChild(createTextElement("span", "已解锁 " + unlockedCount + " / " + game.definitions.BUILDING_DEFINITIONS.length));
        metricsElement.appendChild(createTextElement("span", "拥有 " + ownedCount + " 座"));
        metricsElement.appendChild(createTextElement("span", "住房 " + aliveCount + " / " + housingMax));
        metricsElement.appendChild(createTextElement("span", "建筑劳力 " + formatNumber(laborBreakdown.adjustedBuildingUsageTotal) + " / " + formatNumber(laborBreakdown.populationLabor) + (laborBreakdown.isProductionLaborOverloaded ? "（过载）" : "")));
        metricsElement.appendChild(createTextElement("span", "可建造 " + availableCount));
        metricsElement.appendChild(createTextElement("span", "等待资源 " + waitingCount + "｜前置未满 " + previewCount));
        overviewElement.appendChild(metricsElement);
        // HTMLButtonElement 瓶颈定位按钮：只切换筛选并定位相关建筑，不执行购买。
        var bottleneckButtonElement = document.createElement("button");

        bottleneckButtonElement.type = "button";
        bottleneckButtonElement.dataset.buildingBottleneckLocate = "true";
        bottleneckButtonElement.textContent = "当前瓶颈：" + bottleneckText;
        overviewElement.appendChild(bottleneckButtonElement);
        return overviewElement;
    }

    /**
     * 渲染建筑状态筛选按钮。
     *
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 筛选按钮组元素。
     */
    function renderBuildingFilters(viewModels) {
        // HTMLElement 筛选容器元素：承载封闭状态和叠加标记筛选。
        var filterElement = document.createElement("div");

        // Object[] 筛选定义数组：id 为运行时筛选值，name 为中文文案。
        var filterDefinitions = [
            { id: "all", name: "全部" }, { id: "available", name: "可建造" },
            { id: "attention", name: "需关注" },
            { id: "unaffordable", name: "资源不足" }, { id: "waiting", name: "等待可达" },
            { id: "blocked", name: "当前不可达" }, { id: "preview", name: "接近解锁" },
            { id: "owned", name: "已拥有" }, { id: "key", name: "关键建筑" }
        ];

        // string 当前筛选 ID：未设置时默认为 all。
        var activeFilterId = game.runtime.buildingFilter || "all";

        filterElement.className = "building-filter-bar";
        filterElement.setAttribute("aria-label", "建筑状态筛选");

        // number 筛选循环索引：遍历筛选定义的整数下标。
        var visibleFilterCount = game.runtime.isBuildingFilterPanelOpen ? filterDefinitions.length : 3;
        for (var filterIndex = 0; filterIndex < visibleFilterCount; filterIndex += 1) {
            // Object 当前筛选定义：包含 id 和 name。
            var filterDefinition = filterDefinitions[filterIndex];

            // HTMLButtonElement 筛选按钮元素：只修改运行时视图偏好。
            var filterButtonElement = document.createElement("button");

            filterButtonElement.type = "button";
            filterButtonElement.dataset.buildingFilter = filterDefinition.id;
            filterButtonElement.setAttribute("aria-pressed", String(activeFilterId === filterDefinition.id));
            filterButtonElement.textContent = filterDefinition.name + " " + countBuildingModels(viewModels, getBuildingFilterPredicate(filterDefinition.id));
            filterElement.appendChild(filterButtonElement);
        }

        // HTMLButtonElement 高级筛选开关：低频筛选和排序默认收起。
        var advancedButtonElement = document.createElement("button");

        advancedButtonElement.type = "button";
        advancedButtonElement.dataset.buildingFilterPanelToggle = "true";
        advancedButtonElement.textContent = game.runtime.isBuildingFilterPanelOpen ? "收起筛选" : "筛选";
        filterElement.appendChild(advancedButtonElement);

        // HTMLSelectElement 排序选择元素：切换当前视图排序，不写入游戏存档。
        var sortSelectElement = document.createElement("select");

        sortSelectElement.dataset.buildingSort = "true";
        sortSelectElement.setAttribute("aria-label", "建筑排序方式");
        appendSelectOption(sortSelectElement, "status", "状态优先", (game.runtime.buildingSort || "status") === "status");
        appendSelectOption(sortSelectElement, "recommended", "推荐程度", game.runtime.buildingSort === "recommended");
        appendSelectOption(sortSelectElement, "design", "设计顺序", game.runtime.buildingSort === "design");
        appendSelectOption(sortSelectElement, "owned", "拥有数量", game.runtime.buildingSort === "owned");
        appendSelectOption(sortSelectElement, "wait", "等待时间", game.runtime.buildingSort === "wait");
        appendSelectOption(sortSelectElement, "new", "最近解锁", game.runtime.buildingSort === "new");
        if (game.runtime.isBuildingFilterPanelOpen) {
            filterElement.appendChild(sortSelectElement);
        }
        return filterElement;
    }

    /**
     * 渲染六条建设路线导航。
     *
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 路线导航元素。
     */
    function renderBuildingRouteNavigation(state, viewModels) {
        // HTMLElement 路线导航元素：允许横向滚动并保持徽签完整。
        var navigationElement = document.createElement("nav");

        navigationElement.className = "building-route-navigation building-district-grid";
        navigationElement.setAttribute("aria-label", "建设路线");

        // number 路线循环索引：遍历路线定义的整数下标。
        for (var routeIndex = 0; routeIndex < game.definitions.BUILDING_ROUTE_DEFINITIONS.length; routeIndex += 1) {
            // BuildingRouteDefinition 当前路线定义：用于统计和显示路线徽签。
            var routeDefinition = game.definitions.BUILDING_ROUTE_DEFINITIONS[routeIndex];

            // Object[] 当前路线视图模型：用于计算揭示、拥有和可建造数量。
            var routeModels = viewModels.filter(function (viewModel) { return viewModel.definition.routeId === routeDefinition.id; });
            // Object 分区摘要：包含两个结果指标和一个异常/行动结论。
            var routeSummary = getBuildingRouteSummary(state, routeDefinition.id, routeModels);

            // HTMLButtonElement 路线按钮元素：再次点击当前路线恢复全部路线。
            var routeButtonElement = document.createElement("button");

            routeButtonElement.type = "button";
            routeButtonElement.dataset.buildingRouteId = routeDefinition.id;
            routeButtonElement.setAttribute("aria-pressed", String(game.runtime.buildingRouteId === routeDefinition.id));
            routeButtonElement.innerHTML = "<strong>" + routeDefinition.symbol + " " + routeDefinition.name + (game.runtime.newBuildingRouteIdsById[routeDefinition.id] ? " · 新" : "") + "</strong><small>" + routeSummary.alertText + "</small>";
            routeButtonElement.title = routeSummary.metricTexts.join("｜");
            navigationElement.appendChild(routeButtonElement);
        }

        return navigationElement;
    }

    /**
     * 生成建设分区的两个结果指标和一个异常结论。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingRouteId} routeId - 建设分区稳定 ID。
     * @param {Object[]} routeModels - 当前分区已揭示建筑模型数组。
     * @returns {Object} 分区摘要；metricTexts 为两个 string 指标，alertText 为一个 string 异常或行动结论。
     */
    function getBuildingRouteSummary(state, routeId, routeModels) {
        // string[] 结果指标文本：固定恰好两个，保持六张卡排版一致。
        var metricTexts = [];
        // LaborBreakdown 劳力摘要：工业分区显示建筑占用与人口供给。
        var laborBreakdown = game.population.analyzeLaborBreakdown(state);
        // ResourceState|null 菌菇状态：生存分区显示当前口粮净变化。
        var fungusState = state.resourcesById.fungus || null;
        // ResourceState|null 粗识状态：治理分区显示研究资源净变化。
        var knowledgeState = state.resourcesById.crudeKnowledge || null;
        // ResourceState|null 服从状态：治理分区显示当前秩序值。
        var obedienceState = state.resourcesById.obedience || null;
        // ResourceState|null 俘虏状态：军事分区显示俘虏容量压力。
        var captiveState = state.resourcesById.captive || null;
        // ResourceState|null 祖灵状态：军事分区显示祭祀持续产量。
        var ancestorState = state.resourcesById.ancestralEcho || null;
        // ResourceState|null 魔晶状态：深渊分区显示后期资源库存。
        var manaState = state.resourcesById.manaCrystal || null;
        // ResourceState|null 深渊回响状态：深渊分区显示远征资源库存。
        var abyssState = state.resourcesById.abyssEcho || null;

        if (routeId === "survival") {
            metricTexts = ["住房 " + game.population.countAliveGoblins(state) + " / " + game.population.calculateHousingMax(state), "口粮 " + formatSignedNumber(fungusState ? fungusState.perSecond : 0) + "/秒"];
        } else if (routeId === "storage") {
            // number 已满容量资源数：统计可见且到达上限的资源种类。
            var fullResourceCount = countFullVisibleResources(state);

            metricTexts = ["爆仓资源 " + fullResourceCount, "仓储建筑 " + sumBuildingOwned(routeModels) + " 座"];
        } else if (routeId === "industry") {
            metricTexts = ["工业劳力 " + formatNumber(laborBreakdown.adjustedBuildingUsageTotal) + " / " + formatNumber(laborBreakdown.populationLabor), "工业建筑 " + sumBuildingOwned(routeModels) + " 座"];
        } else if (routeId === "governance") {
            metricTexts = ["粗识 " + formatSignedNumber(knowledgeState ? knowledgeState.perSecond : 0) + "/秒", "服从 " + formatNumber(obedienceState ? obedienceState.value : 0) + "%"];
        } else if (routeId === "military") {
            metricTexts = ["俘虏 " + formatNumber(captiveState ? captiveState.value : 0) + " / " + formatNumber(captiveState ? captiveState.maxValue : 0), "祖灵 " + formatSignedNumber(ancestorState ? ancestorState.perSecond : 0) + "/秒"];
        } else {
            metricTexts = ["魔晶 " + formatNumber(manaState ? manaState.value : 0), "深渊回响 " + formatNumber(abyssState ? abyssState.value : 0)];
        }

        // number 需关注建筑数：容量、来源、前置或劳力风险的模型数量。
        var attentionCount = countBuildingModels(routeModels, getBuildingFilterPredicate("attention"));
        // number 可建造建筑数：当前可立即支付且未暂停的模型数量。
        var availableCount = countBuildingModels(routeModels, function (viewModel) { return viewModel.buildingViewStatus === "available"; });
        // string 异常或行动结论：每张卡只显示一条。
        var alertText = attentionCount > 0 ? "需关注 " + attentionCount + " 项" : "可建 " + availableCount + " 项";

        return { metricTexts: metricTexts, alertText: alertText };
    }

    /**
     * 统计当前已显示且达到容量上限的资源种类。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {number} 爆仓资源种类数，非负整数。
     */
    function countFullVisibleResources(state) {
        // number 已满资源数：累加可见、容量大于零且库存达到上限的资源。
        var fullResourceCount = 0;
        // ResourceId[] 资源 ID 数组：遍历运行时资源字典的受控键。
        var resourceIds = Object.keys(state.resourcesById);

        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            // ResourceState 当前资源状态：用于判断可见性和容量占用。
            var resourceState = state.resourcesById[resourceIds[resourceIndex]];

            if (resourceState.isVisible && resourceState.maxValue > 0 && resourceState.value >= resourceState.maxValue) {
                fullResourceCount += 1;
            }
        }

        return fullResourceCount;
    }

    /**
     * 渲染按路线分组的建筑主体列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 路线分组列表元素。
     */
    function renderBuildingRouteGroups(state, viewModels) {
        // HTMLElement 分组容器元素：承载当前路线与筛选匹配的建筑行。
        var groupsElement = document.createElement("div");

        // Function 当前筛选谓词：只影响视图，不改变原始模型数组。
        var filterPredicate = getBuildingFilterPredicate(game.runtime.buildingFilter || "all");
        // string 标准化搜索词：用于匹配建筑语义字段，不区分大小写。
        var searchText = (game.runtime.buildingSearchText || "").trim().toLowerCase();

        groupsElement.className = "building-route-groups";

        // number 路线循环索引：按固定路线顺序生成分组。
        for (var routeIndex = 0; routeIndex < game.definitions.BUILDING_ROUTE_DEFINITIONS.length; routeIndex += 1) {
            // BuildingRouteDefinition 当前路线定义：用于标题和分组键。
            var routeDefinition = game.definitions.BUILDING_ROUTE_DEFINITIONS[routeIndex];

            if (game.runtime.buildingViewId !== "catalog" && game.runtime.buildingRouteId && game.runtime.buildingRouteId !== routeDefinition.id) {
                continue;
            }

            // Object[] 当前路线筛选后模型：随后按用户选择稳定排序。
            var routeModels = viewModels.filter(function (viewModel) {
                return viewModel.definition.routeId === routeDefinition.id && filterPredicate(viewModel) && doesBuildingMatchSearch(viewModel, searchText);
            });

            if (routeModels.length <= 0) {
                continue;
            }

            sortBuildingViewModels(routeModels, game.runtime.buildingSort || "status");
            groupsElement.appendChild(renderBuildingRouteGroup(state, routeDefinition, routeModels));
        }

        if (!groupsElement.firstChild) {
            groupsElement.appendChild(createTextElement("p", "当前筛选下没有已揭示建筑。"));
        }

        return groupsElement;
    }

    /**
     * 渲染单条建设路线分组。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingRouteDefinition} routeDefinition - 当前路线静态定义。
     * @param {Object[]} routeModels - 当前路线筛选并排序后的模型数组。
     * @returns {HTMLElement} 路线分组元素。
     */
    function renderBuildingRouteGroup(state, routeDefinition, routeModels) {
        // HTMLElement 路线分组元素：包含标题、折叠按钮和建筑列表。
        var groupElement = document.createElement("section");

        // HTMLElement 分组标题元素：显示路线进度。
        var headingElement = document.createElement("header");

        // boolean 是否折叠：从运行时本地视图偏好读取。
        var isCollapsed = Boolean(game.runtime.collapsedBuildingRoutesById && game.runtime.collapsedBuildingRoutesById[routeDefinition.id]);

        // HTMLButtonElement 折叠按钮元素：使用 aria-expanded 表达状态。
        var collapseButtonElement = document.createElement("button");

        groupElement.className = "building-route-group building-route-" + routeDefinition.id;
        headingElement.className = "building-route-heading";
        headingElement.appendChild(createTextElement("strong", routeDefinition.symbol + " " + routeDefinition.name));
        headingElement.appendChild(createTextElement("span", "已揭示 " + routeModels.length + "｜拥有 " + sumBuildingOwned(routeModels) + " 座｜可建造 " + countBuildingModels(routeModels, function (viewModel) { return viewModel.buildingViewStatus === "available"; })));
        collapseButtonElement.type = "button";
        collapseButtonElement.dataset.buildingRouteCollapseId = routeDefinition.id;
        collapseButtonElement.setAttribute("aria-expanded", String(!isCollapsed));
        collapseButtonElement.textContent = isCollapsed ? "展开" : "收起";
        headingElement.appendChild(collapseButtonElement);
        groupElement.appendChild(headingElement);

        if (!isCollapsed) {
            // HTMLElement 建筑卡片网格：以可扫视的空间卡片取代纵向数据行。
            var listElement = document.createElement("div");

            listElement.className = "building-card-grid";

            // number 模型循环索引：遍历当前路线建筑模型的整数下标。
            for (var modelIndex = 0; modelIndex < routeModels.length; modelIndex += 1) {
                listElement.appendChild(renderBuildingViewCard(state, routeModels[modelIndex]));
            }

            groupElement.appendChild(listElement);
        }

        return groupElement;
    }

    /**
     * 渲染视图模型驱动的单个建筑卡片。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 建筑视图模型，包含状态、价格、阻断和劳力风险。
     * @returns {HTMLElement} 建筑卡片元素。
     */
    function renderBuildingViewCard(state, viewModel) {
        // BuildingDefinition 建筑定义：用于显示身份、效果和静态展示标签。
        var buildingDefinition = viewModel.definition;

        // BuildingState 建筑状态：用于显示拥有和启用数量。
        var buildingState = viewModel.state;

        // HTMLElement 卡片元素：在固定网格中展示身份、结论、核心效果和主操作。
        var cardElement = document.createElement("article");

        cardElement.className = "building-card building-status-" + viewModel.buildingViewStatus + (viewModel.isKeyBuilding ? " is-milestone" : "") + (game.runtime.newBuildingIdsById[buildingDefinition.id] ? " is-new" : "");
        cardElement.id = "building-card-" + buildingDefinition.id;
        cardElement.tabIndex = 0;
        cardElement.dataset.buildingSelectId = buildingDefinition.id;

        // HTMLElement 身份区元素：状态图形、建筑名和效果标签。
        var identityElement = document.createElement("div");

        identityElement.className = "building-identity";
        identityElement.appendChild(createTextElement("span", getBuildingStatusSymbol(viewModel.buildingViewStatus)));
        identityElement.appendChild(createTextElement("strong", buildingDefinition.name));
        if (game.runtime.newBuildingIdsById[buildingDefinition.id]) {
            // HTMLElement 新内容标记：首次选中建筑后清除。
            var newMarkerElement = createTextElement("span", "新");

            newMarkerElement.className = "building-new-marker";
            identityElement.appendChild(newMarkerElement);
        }

        if (!viewModel.isPreview) {
            // number 标签循环索引：遍历受控效果标签的整数下标。
            for (var tagIndex = 0; tagIndex < Math.min(2, buildingDefinition.effectTags.length); tagIndex += 1) {
                // HTMLElement 标签元素：显示受控中文效果短标签。
                var tagElement = createTextElement("span", game.buildingView.getEffectTagLabel(buildingDefinition.effectTags[tagIndex]));

                tagElement.className = "building-effect-tag";
                identityElement.appendChild(tagElement);
            }
        } else {
            identityElement.appendChild(createTextElement("span", "用途剪影：" + game.buildingView.getEffectTagLabel(buildingDefinition.effectTags[0])));
        }

        if (!viewModel.isPreview) {
            // HTMLElement 拥有数量徽签：直接读取 BuildingState.owned，不从按钮或 DOM 推导。
            var ownedBadgeElement = createTextElement("span", buildingState.owned + " 座");

            ownedBadgeElement.className = "building-owned-badge";
            identityElement.appendChild(ownedBadgeElement);
        }

        // HTMLElement 成本区元素：预览行只显示具名前置，不泄露数值。
        var costElement = document.createElement("div");

        costElement.className = "building-cost";
        costElement.textContent = viewModel.isPreview ? "前置：" + viewModel.unlockText : "所需：" + formatPriceList(viewModel.price);

        if (!viewModel.isPreview && viewModel.waitInfo.entries.length > 0) {
            // string[] 缺口文本数组：逐资源显示当前差额。
            var missingTexts = game.resources.getMissingResourceTexts(state, viewModel.price);

            // HTMLElement 缺口元素：紧邻完整价格显示。
            var missingElement = createTextElement("span", "缺：" + missingTexts.join("，"));

            missingElement.className = "building-missing";
            costElement.appendChild(missingElement);
        }

        // HTMLElement 可用性区元素：明确区分等待、容量、来源、前置与暂停。
        var availabilityElement = createTextElement("div", getBuildingAvailabilityLabel(viewModel));

        availabilityElement.className = "building-availability";

        // HTMLElement 操作区元素：承载建造和安全摧毁流程。
        var actionsElement = document.createElement("div");

        // HTMLButtonElement 建造按钮元素：状态按钮文案使用封闭集合。
        var buyButtonElement = document.createElement("button");

        actionsElement.className = "building-actions";
        buyButtonElement.type = "button";
        buyButtonElement.dataset.buildingId = buildingDefinition.id;
        buyButtonElement.disabled = viewModel.buildingViewStatus !== "available";
        buyButtonElement.textContent = getBuildingActionLabel(viewModel);
        buyButtonElement.setAttribute("aria-label", "建造" + buildingDefinition.name);
        actionsElement.appendChild(buyButtonElement);
        if (!viewModel.isPreview && buildingState.owned > 0) {
            appendBuildingDestroyControls(actionsElement, state, viewModel);
        }

        cardElement.appendChild(identityElement);
        cardElement.appendChild(availabilityElement);
        if (!viewModel.isPreview) {
            cardElement.appendChild(createTextElement("p", formatBuildingCardEffectSummary(buildingDefinition)));
        }
        cardElement.appendChild(costElement);
        cardElement.appendChild(actionsElement);
        cardElement.appendChild(createBuildingViewTooltip(state, viewModel));

        return cardElement;
    }

    /**
     * 格式化建筑卡片上的一句核心效果摘要。
     *
     * @param {BuildingDefinition} buildingDefinition - 建筑静态定义。
     * @returns {string} 最多两个受控效果标签与下一座效果摘要。
     */
    function formatBuildingCardEffectSummary(buildingDefinition) {
        // string[] 核心标签文本：最多保留两个以控制卡片信息密度。
        var effectTagTexts = [];
        // string[] 建筑效果 ID 数组：卡片正面只取第一项，完整效果进入浮框。
        var effectIds = Object.keys(buildingDefinition.effects);

        for (var tagIndex = 0; tagIndex < Math.min(2, buildingDefinition.effectTags.length); tagIndex += 1) {
            effectTagTexts.push(game.buildingView.getEffectTagLabel(buildingDefinition.effectTags[tagIndex]));
        }

        // string 第一项效果摘要：不存在效果时明确显示系统入口。
        var primaryEffectText = effectIds.length > 0 ? (game.text.TEXT_REGISTRY.effects[effectIds[0]] || effectIds[0]) + " +" + buildingDefinition.effects[effectIds[0]] : "系统入口";

        return effectTagTexts.join(" · ") + "｜" + primaryEffectText;
    }

    /**
     * 判断建筑是否匹配统一搜索词。
     *
     * @param {Object} viewModel - 建筑视图模型，不会被修改。
     * @param {string} searchText - 已转小写的搜索词；空字符串表示全部匹配。
     * @returns {boolean} 是否匹配名称、说明、标签、价格资源或解锁文案。
     */
    function doesBuildingMatchSearch(viewModel, searchText) {
        if (!searchText) {
            return true;
        }
        // string[] 可搜索文本数组：由统一模型和静态定义生成。
        var searchableTexts = [viewModel.definition.name, viewModel.definition.description, viewModel.unlockText];
        // number 标签循环索引：加入所有效果标签中文名。
        for (var tagIndex = 0; tagIndex < viewModel.definition.effectTags.length; tagIndex += 1) {
            searchableTexts.push(game.buildingView.getEffectTagLabel(viewModel.definition.effectTags[tagIndex]));
        }
        // number 价格循环索引：加入当前成本资源中文名。
        for (var priceIndex = 0; priceIndex < viewModel.price.length; priceIndex += 1) {
            searchableTexts.push(game.resources.getResourceDisplayName(viewModel.price[priceIndex].resource));
        }
        return searchableTexts.join(" ").toLowerCase().indexOf(searchText) >= 0;
    }

    /**
     * 创建完整建筑浮窗；正式建筑包含原展开详情全部字段，预览建筑只包含允许公开的信息。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 建筑视图模型。
     * @returns {HTMLElement} 建筑浮窗元素。
     */
    function createBuildingViewTooltip(state, viewModel) {
        // BuildingDefinition 建筑定义：用于读取介绍、效果、价格倍率和解锁内容。
        var buildingDefinition = viewModel.definition;

        // HTMLElement 浮窗元素：由鼠标悬停或键盘聚焦整行显示。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表元素：承载完整建筑信息键值行。
        var listElement = document.createElement("dl");

        tooltipElement.className = "building-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", viewModel.isPreview ? "未知设施" : buildingDefinition.name));

        if (viewModel.isPreview) {
            appendTooltipDefinition(listElement, "用途剪影", game.buildingView.getEffectTagLabel(buildingDefinition.effectTags[0]));
            appendTooltipDefinition(listElement, "解锁条件", viewModel.unlockText);
            appendTooltipDefinition(listElement, "当前状态", "需完成前置；完整成本与效果将在正式解锁后显示");
            tooltipElement.appendChild(listElement);
            return tooltipElement;
        }

        appendTooltipDefinition(listElement, "建筑介绍", buildingDefinition.description);
        appendTooltipDefinition(listElement, "拥有/启用", viewModel.state.owned + " / " + viewModel.state.active);
        appendTooltipDefinition(listElement, "本次成本", formatPriceList(viewModel.price));
        appendTooltipDefinition(listElement, "价格倍率", "x" + buildingDefinition.priceRatio.toFixed(2));
        appendTooltipDefinition(listElement, "下次预估", formatPriceList(viewModel.nextPrice));
        appendTooltipDefinition(listElement, "摧毁返还", formatPriceList(viewModel.refundPrice));
        appendTooltipDefinition(listElement, "单座效果", formatBuildingEffects(buildingDefinition.effects));
        appendTooltipDefinition(listElement, "当前累计", formatBuildingAccumulatedEffects(buildingDefinition.effects, viewModel.state.owned));
        appendTooltipDefinition(listElement, "下一座", formatBuildingEffects(buildingDefinition.effects));
        appendTooltipDefinition(listElement, "劳力占用", "单座 " + formatNumber(viewModel.laborUsage) + "；该类当前 " + formatNumber(viewModel.totalLaborUsage) + (viewModel.willOverloadLabor ? "；建造后将过载" : "；建造后不过载"));
        appendTooltipDefinition(listElement, "解锁来源", viewModel.unlockText);
        appendTooltipDefinition(listElement, "建成开放", formatUnlockBundle(buildingDefinition.unlock));
        appendTooltipDefinition(listElement, "成本瓶颈", formatBuildingCostBottlenecks(state, viewModel));
        appendTooltipDefinition(listElement, "摧毁风险", getBuildingDestroyRiskText(state, viewModel) + "；一次性解锁、成就与统计不会回滚");
        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 向操作区添加摧毁按钮或行内确认条。
     *
     * @param {HTMLElement} actionsElement - 建筑操作区元素，会被追加控件。
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 建筑视图模型。
     * @returns {void} 无返回值。
     */
    function appendBuildingDestroyControls(actionsElement, state, viewModel) {
        // boolean 是否正在确认摧毁：运行时视图偏好只允许一个建筑进入确认。
        var isConfirming = game.runtime.confirmDestroyBuildingId === viewModel.definition.id;

        if (!isConfirming) {
            // HTMLButtonElement 摧毁请求按钮：首次点击只打开确认条。
            var destroyRequestButtonElement = document.createElement("button");

            destroyRequestButtonElement.type = "button";
            destroyRequestButtonElement.dataset.buildingDestroyRequestId = viewModel.definition.id;
            destroyRequestButtonElement.disabled = state.isPaused;
            destroyRequestButtonElement.textContent = state.isPaused ? "已暂停" : "摧毁";
            destroyRequestButtonElement.className = "danger-button";
            destroyRequestButtonElement.setAttribute("aria-label", "摧毁" + viewModel.definition.name);
            actionsElement.appendChild(destroyRequestButtonElement);
            return;
        }

        // HTMLElement 确认条元素：明确显示返还与容量、住房、生产风险。
        var confirmationElement = createTextElement("span", "返还 " + formatPriceList(viewModel.refundPrice) + "；" + getBuildingDestroyRiskText(state, viewModel));

        confirmationElement.className = "building-destroy-confirmation";
        actionsElement.appendChild(confirmationElement);

        // HTMLButtonElement 确认摧毁按钮：确认后才修改游戏状态。
        var confirmButtonElement = document.createElement("button");

        confirmButtonElement.type = "button";
        confirmButtonElement.dataset.buildingDestroyId = viewModel.definition.id;
        confirmButtonElement.textContent = "确认摧毁";
        confirmButtonElement.className = "danger-button";
        actionsElement.appendChild(confirmButtonElement);

        // HTMLButtonElement 取消按钮：关闭确认条且不修改状态。
        var cancelButtonElement = document.createElement("button");

        cancelButtonElement.type = "button";
        cancelButtonElement.dataset.buildingDestroyCancel = "true";
        cancelButtonElement.textContent = "取消";
        actionsElement.appendChild(cancelButtonElement);
    }

    /**
     * 渲染建筑可点击详情层。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 建筑视图模型。
     * @returns {HTMLElement} 建筑详情层元素。
     */
    function renderBuildingDetails(state, viewModel) {
        // HTMLElement 详情层元素：触屏和键盘均可读取完整信息。
        var detailsElement = document.createElement("section");

        // BuildingDefinition 建筑定义：用于读取效果、解锁与价格倍率。
        var buildingDefinition = viewModel.definition;

        detailsElement.className = "building-details";
        detailsElement.appendChild(createTextElement("p", buildingDefinition.description));
        detailsElement.appendChild(createTextElement("p", "拥有/启用：" + viewModel.state.owned + " / " + viewModel.state.active));
        detailsElement.appendChild(createTextElement("p", "本次成本：" + formatPriceList(viewModel.price) + "｜倍率 x" + buildingDefinition.priceRatio.toFixed(2) + "｜下次预估：" + formatPriceList(viewModel.nextPrice)));
        detailsElement.appendChild(createTextElement("p", "摧毁返还：" + formatPriceList(viewModel.refundPrice)));
        detailsElement.appendChild(createTextElement("p", "单座/下一座增量：" + formatBuildingEffects(buildingDefinition.effects)));
        detailsElement.appendChild(createTextElement("p", "当前累计效果：" + formatBuildingAccumulatedEffects(buildingDefinition.effects, viewModel.state.owned)));
        detailsElement.appendChild(createTextElement("p", "劳力：单座 " + formatNumber(viewModel.laborUsage) + "｜该类当前 " + formatNumber(viewModel.totalLaborUsage) + (viewModel.willOverloadLabor ? "｜建造后将过载" : "｜建造后不过载")));
        detailsElement.appendChild(createTextElement("p", "解锁来源：" + viewModel.unlockText + "｜建成开放：" + formatUnlockBundle(buildingDefinition.unlock)));
        detailsElement.appendChild(createTextElement("p", "成本瓶颈：" + formatBuildingCostBottlenecks(state, viewModel)));
        detailsElement.appendChild(createTextElement("p", "摧毁风险：" + getBuildingDestroyRiskText(state, viewModel) + "；一次性解锁、成就与统计不会回滚。"));
        return detailsElement;
    }

    /**
     * 渲染建设建议卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {HTMLElement} 建设建议卡元素。
     */
    function renderBuildingAdviceCard(state, viewModels) {
        // string[] 建设建议数组：按生存、硬阻断、劳力、入口和来源优先级生成。
        var adviceTexts = getBuildingAdviceTexts(state, viewModels);

        // HTMLElement 建议卡元素：没有可靠建议时明确显示无明显瓶颈。
        var adviceCardElement = document.createElement("section");

        adviceCardElement.className = "card";
        adviceCardElement.appendChild(createTextElement("h4", "建设建议"));

        if (adviceTexts.length <= 0) {
            adviceCardElement.appendChild(createTextElement("p", "当前没有明显建设瓶颈。"));
        } else {
            // HTMLOListElement 建议列表元素：最多包含三条可解释建议。
            var adviceListElement = document.createElement("ol");

            // number 建议循环索引：遍历建议文本的整数下标。
            for (var adviceIndex = 0; adviceIndex < adviceTexts.length; adviceIndex += 1) {
                // HTMLLIElement 建议列表项：承载只定位、不购买的建议按钮。
                var adviceItemElement = document.createElement("li");

                // HTMLButtonElement 建议定位按钮：点击后定位当前首个瓶颈或关键建筑。
                var adviceButtonElement = document.createElement("button");

                adviceButtonElement.type = "button";
                adviceButtonElement.dataset.buildingAdviceLocate = "true";
                adviceButtonElement.textContent = adviceTexts[adviceIndex];
                adviceItemElement.appendChild(adviceButtonElement);
                adviceListElement.appendChild(adviceItemElement);
            }

            adviceCardElement.appendChild(adviceListElement);
        }

        return adviceCardElement;
    }

    /**
     * 渲染建筑工作台内的最近建设日志卡。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {HTMLElement} 最近建设日志卡元素。
     */
    function renderRecentBuildingLogCard(state) {
        // HTMLElement 日志卡容器元素：保持在建筑工作台主体右侧或窄屏下方。
        var logContainerElement = document.createElement("aside");

        logContainerElement.className = "building-log-adviser";

        // HTMLElement 日志卡元素：筛选当前日志中的建设、解锁和劳力记录。
        var logCardElement = document.createElement("section");

        logCardElement.className = "card";
        logCardElement.appendChild(createTextElement("h4", "最近建设日志"));

        // string[] 最近建设日志文本数组：最多保留五条，保持现有日期前缀。
        var buildingLogTexts = getRecentBuildingLogTexts(state);

        if (buildingLogTexts.length <= 0) {
            logCardElement.appendChild(createTextElement("p", "尚无建设记录。"));
        } else {
            // HTMLOListElement 建设日志列表元素：显示筛选后的最近记录。
            var buildingLogListElement = document.createElement("ol");

            // number 日志循环索引：遍历最近建设记录的整数下标。
            for (var logIndex = 0; logIndex < buildingLogTexts.length; logIndex += 1) {
                buildingLogListElement.appendChild(createTextElement("li", buildingLogTexts[logIndex]));
            }

            logCardElement.appendChild(buildingLogListElement);
        }

        logContainerElement.appendChild(logCardElement);
        return logContainerElement;
    }

    /**
     * 在左侧重要状态下方渲染建设建议，并保持非建筑界面时隐藏。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {void} 无返回值；会重建侧栏建议容器内容。
     */
    function renderSidebarBuildingAdvice(state) {
        // HTMLElement 侧栏建议容器：位于重要状态卡片之后。
        var adviceContainerElement = document.getElementById("sidebar-building-advice");

        // 建设建议已并入决策队列，侧栏只保留空容器以兼容现有页面骨架。
        adviceContainerElement.hidden = true;
        adviceContainerElement.innerHTML = "";
    }

    /**
     * 同步新揭示建筑基线、路线“新”标记与日志。
     *
     * @param {GameState} state - 当前游戏状态对象，新揭示时会追加重要日志。
     * @param {Object[]} viewModels - 当前已揭示建筑视图模型数组。
     * @returns {void} 无返回值；会更新运行时视图标记并在后续新揭示时写日志。
     */
    function synchronizeNewBuildingReveals(state, viewModels) {
        if (!game.runtime.revealedBuildingIdsById) {
            game.runtime.revealedBuildingIdsById = {};
            // number 初始模型循环索引：建立首屏基线，避免把默认建筑当成新揭示。
            for (var initialIndex = 0; initialIndex < viewModels.length; initialIndex += 1) {
                game.runtime.revealedBuildingIdsById[viewModels[initialIndex].definition.id] = true;
            }
            return;
        }

        // number 模型循环索引：查找相对上次渲染新进入列表的建筑。
        for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) {
            // Object 当前建筑模型：用于读取 ID、名称和所属路线。
            var viewModel = viewModels[modelIndex];

            if (!game.runtime.revealedBuildingIdsById[viewModel.definition.id]) {
                game.runtime.revealedBuildingIdsById[viewModel.definition.id] = true;
                game.runtime.newBuildingRouteIdsById[viewModel.definition.routeId] = true;
                game.runtime.newBuildingIdsById[viewModel.definition.id] = true;
                game.simulation.addLog(state, "important", "新的建筑接近可建造：" + viewModel.definition.name + "。");
            }
        }
    }

    /**
     * 统计满足条件的建筑模型数量。
     *
     * @param {Object[]} viewModels - 建筑视图模型数组。
     * @param {Function} predicate - 接收单个模型并返回 boolean 的筛选函数。
     * @returns {number} 匹配模型数量，非负整数。
     */
    function countBuildingModels(viewModels, predicate) {
        return viewModels.filter(predicate).length;
    }

    /**
     * 累加建筑拥有总数。
     *
     * @param {Object[]} viewModels - 建筑视图模型数组。
     * @returns {number} 已拥有建筑总座数，非负整数。
     */
    function sumBuildingOwned(viewModels) {
        // number 拥有总数：累加每个运行时建筑状态的 owned 字段。
        var ownedTotal = 0;

        // number 模型循环索引：遍历模型数组的整数下标。
        for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) {
            ownedTotal += viewModels[modelIndex].state ? viewModels[modelIndex].state.owned : 0;
        }

        return ownedTotal;
    }

    /**
     * 获取指定建筑筛选的谓词函数。
     *
     * @param {string} filterId - 筛选稳定 ID。
     * @returns {Function} 接收建筑视图模型并返回 boolean 的函数。
     */
    function getBuildingFilterPredicate(filterId) {
        if (filterId === "available") { return function (viewModel) { return viewModel.buildingViewStatus === "available"; }; }
        if (filterId === "attention") { return function (viewModel) { return viewModel.buildingViewStatus === "blocked" || viewModel.isPreview || viewModel.willOverloadLabor; }; }
        if (filterId === "unaffordable") { return function (viewModel) { return viewModel.buildingViewStatus === "unaffordable" || viewModel.buildingViewStatus === "blocked"; }; }
        if (filterId === "waiting") { return function (viewModel) { return viewModel.buildingViewStatus === "unaffordable"; }; }
        if (filterId === "blocked") { return function (viewModel) { return viewModel.buildingViewStatus === "blocked" || viewModel.isPreview; }; }
        if (filterId === "preview") { return function (viewModel) { return viewModel.isPreview; }; }
        if (filterId === "owned") { return function (viewModel) { return viewModel.state && viewModel.state.owned > 0; }; }
        if (filterId === "key") { return function (viewModel) { return viewModel.isKeyBuilding; }; }
        return function () { return true; };
    }

    /**
     * 按用户选择稳定排序建筑模型。
     *
     * @param {Object[]} viewModels - 建筑视图模型数组，会被原地排序。
     * @param {string} sortId - recommended、status、design、owned、wait 或 new。
     * @returns {void} 无返回值；副作用为修改数组顺序。
     */
    function sortBuildingViewModels(viewModels, sortId) {
        // Object.<string, number> 状态权重字典：key 为封闭状态 ID，value 越小越靠前。
        var statusOrderById = { available: 0, unaffordable: 1, blocked: 2, paused: 3, preview: 4, hidden: 5 };

        viewModels.sort(function (leftModel, rightModel) {
            if (sortId === "recommended") {
                // number 左侧推荐权重：硬阻断解法和系统入口优先，常规等待靠后。
                var leftWeight = getBuildingRecommendationWeight(leftModel);
                // number 右侧推荐权重：与左侧使用同一确定性规则。
                var rightWeight = getBuildingRecommendationWeight(rightModel);

                return leftWeight - rightWeight || leftModel.definition.designOrder - rightModel.definition.designOrder;
            }
            if (sortId === "owned") {
                return rightModel.state.owned - leftModel.state.owned || leftModel.definition.designOrder - rightModel.definition.designOrder;
            }
            if (sortId === "design") {
                return leftModel.definition.designOrder - rightModel.definition.designOrder;
            }
            if (sortId === "wait") {
                return leftModel.waitInfo.seconds - rightModel.waitInfo.seconds || leftModel.definition.designOrder - rightModel.definition.designOrder;
            }
            if (sortId === "new") {
                return Number(Boolean(game.runtime.newBuildingIdsById[rightModel.definition.id])) - Number(Boolean(game.runtime.newBuildingIdsById[leftModel.definition.id])) || leftModel.definition.designOrder - rightModel.definition.designOrder;
            }
            if (leftModel.buildingViewStatus === "unaffordable" && rightModel.buildingViewStatus === "unaffordable") {
                return leftModel.waitInfo.seconds - rightModel.waitInfo.seconds || leftModel.definition.designOrder - rightModel.definition.designOrder;
            }
            return statusOrderById[leftModel.buildingViewStatus] - statusOrderById[rightModel.buildingViewStatus] || leftModel.definition.designOrder - rightModel.definition.designOrder;
        });
    }

    /**
     * 计算建筑推荐排序权重，不生成面向玩家的不透明评分。
     *
     * @param {Object} viewModel - 建筑视图模型，不会被修改。
     * @returns {number} 离散排序权重，数值越小越靠前。
     */
    function getBuildingRecommendationWeight(viewModel) {
        if (viewModel.capacityBlockedResourceIds.length > 0 || viewModel.sourceBlockedResourceIds.length > 0) { return 0; }
        if (viewModel.isKeyBuilding && viewModel.buildingViewStatus === "available") { return 1; }
        if (viewModel.willOverloadLabor) { return 2; }
        if (viewModel.buildingViewStatus === "available") { return 3; }
        if (viewModel.buildingViewStatus === "unaffordable") { return 4; }
        return 5;
    }

    /**
     * 向选择框追加选项。
     *
     * @param {HTMLSelectElement} selectElement - 目标选择框，会被追加 option。
     * @param {string} value - 选项稳定值。
     * @param {string} label - 选项中文文案。
     * @param {boolean} isSelected - true 表示当前选中；false 表示未选中。
     * @returns {void} 无返回值。
     */
    function appendSelectOption(selectElement, value, label, isSelected) {
        // HTMLOptionElement 选项元素：承载排序值与显示文案。
        var optionElement = document.createElement("option");

        optionElement.value = value;
        optionElement.textContent = label;
        optionElement.selected = isSelected;
        selectElement.appendChild(optionElement);
    }

    /**
     * 获取建筑状态图形符号。
     *
     * @param {string} statusId - 建筑封闭状态 ID。
     * @returns {string} 不依赖颜色的状态图形。
     */
    function getBuildingStatusSymbol(statusId) {
        // Object.<string, string> 状态符号字典：key 为状态 ID，value 为可读图形。
        var symbolByStatusId = { available: "●", unaffordable: "◐", blocked: "×", preview: "◇", paused: "Ⅱ", hidden: "·" };

        return symbolByStatusId[statusId] || "·";
    }

    /**
     * 获取建筑可用性文字。
     *
     * @param {Object} viewModel - 建筑视图模型。
     * @returns {string} 可用、等待时间或明确阻断原因。
     */
    function getBuildingAvailabilityLabel(viewModel) {
        if (viewModel.isPreview) { return "需完成前置"; }
        if (viewModel.buildingViewStatus === "paused") { return "已暂停"; }
        if (viewModel.buildingViewStatus === "available") { return "可立即建造"; }
        if (viewModel.capacityBlockedResourceIds.length > 0) { return "容量受限：" + formatResourceIdList(viewModel.capacityBlockedResourceIds); }
        if (viewModel.sourceBlockedResourceIds.length > 0) { return getResourceAcquisitionText(viewModel.sourceBlockedResourceIds[0]); }
        return "等待约 " + formatSecondsAsClock(viewModel.waitInfo.seconds);
    }

    /**
     * 获取建筑主操作按钮封闭文案。
     *
     * @param {Object} viewModel - 建筑视图模型。
     * @returns {string} 建造、缺少资源、容量受限、暂无来源、需完成前置或已暂停。
     */
    function getBuildingActionLabel(viewModel) {
        if (viewModel.isPreview) { return "需完成前置"; }
        if (viewModel.buildingViewStatus === "paused") { return "已暂停"; }
        if (viewModel.buildingViewStatus === "available") { return "建造"; }
        if (viewModel.capacityBlockedResourceIds.length > 0) { return "容量不足"; }
        if (viewModel.sourceBlockedResourceIds.length > 0) { return "需先取得资源"; }
        return "等待资源 " + formatSecondsAsClock(viewModel.waitInfo.seconds);
    }

    /**
     * 格式化资源 ID 数组为中文名列表。
     *
     * @param {ResourceId[]} resourceIds - 资源稳定 ID 数组。
     * @returns {string} 中文资源名顿号列表。
     */
    function formatResourceIdList(resourceIds) {
        // string[] 资源名称数组：按输入顺序映射中文名。
        var resourceNames = [];

        // number 资源循环索引：遍历资源 ID 的整数下标。
        for (var resourceIndex = 0; resourceIndex < resourceIds.length; resourceIndex += 1) {
            resourceNames.push(game.resources.getResourceDisplayName(resourceIds[resourceIndex]));
        }

        return resourceNames.join("、");
    }

    /**
     * 使用建筑决策与资源浮窗共享的来源查询格式化单项取得方向。
     *
     * @param {ResourceId} resourceId - 当前缺口资源稳定 ID。
     * @returns {string} 含中文资源名和真实持续或离散取得方向的短句。
     */
    function getResourceAcquisitionText(resourceId) {
        // Object 取得路径摘要：type 为受控来源类型，text 为具体行动方向。
        var acquisition = game.buildingDecisions.getResourceAcquisition(game.runtime.state, resourceId);

        return formatResourceIdList([resourceId]) + "：" + acquisition.text;
    }

    /**
     * 格式化秒数为建筑等待时钟。
     *
     * @param {number} seconds - 非负等待秒数。
     * @returns {string} HH:MM:SS 格式时间；非有限值返回不可达。
     */
    function formatSecondsAsClock(seconds) {
        if (!Number.isFinite(seconds)) { return "不可达"; }
        // number 总秒数：向上取整避免仍缺资源时显示零秒。
        var totalSeconds = Math.max(0, Math.ceil(seconds));
        // number 小时数：完整小时整数。
        var hours = Math.floor(totalSeconds / 3600);
        // number 分钟数：扣除小时后的完整分钟整数。
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        // number 剩余秒数：0-59 整数。
        var remainingSeconds = totalSeconds % 60;
        return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(remainingSeconds).padStart(2, "0");
    }

    /**
     * 格式化建筑累计效果。
     *
     * @param {Object.<string, number>} effects - 单座建筑效果字典。
     * @param {number} ownedCount - 已拥有建筑数量，非负整数。
     * @returns {string} 当前累计效果文本。
     */
    function formatBuildingAccumulatedEffects(effects, ownedCount) {
        // Object.<string, number> 累计效果字典：key 与单座效果一致，value 乘拥有数量。
        var accumulatedEffects = {};
        // string[] 效果 ID 数组：用于遍历单座效果键。
        var effectIds = Object.keys(effects);
        // number 效果循环索引：遍历效果 ID 的整数下标。
        for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
            // string 当前效果 ID：用于写入累计值。
            var effectId = effectIds[effectIndex];
            accumulatedEffects[effectId] = effects[effectId] * ownedCount;
        }
        return formatBuildingEffects(accumulatedEffects);
    }

    /**
     * 格式化建筑建成后开放内容。
     *
     * @param {UnlockBundle} unlockBundle - 建筑解锁包。
     * @returns {string} 标签页、资源、职业、配方等开放内容；无则返回无一次性开放。
     */
    function formatUnlockBundle(unlockBundle) {
        // string[] 开放内容文本数组：按系统类别汇总中文显示名。
        var unlockTexts = [];
        if ((unlockBundle.tabs || []).length > 0) { unlockTexts.push("标签页 " + formatUnlockIdList("tab", unlockBundle.tabs)); }
        if ((unlockBundle.resources || []).length > 0) { unlockTexts.push("资源 " + formatUnlockIdList("resource", unlockBundle.resources)); }
        if ((unlockBundle.jobs || []).length > 0) { unlockTexts.push("职业 " + formatUnlockIdList("job", unlockBundle.jobs)); }
        if ((unlockBundle.crafts || []).length > 0) { unlockTexts.push("配方 " + formatUnlockIdList("craft", unlockBundle.crafts)); }
        if ((unlockBundle.buildings || []).length > 0) { unlockTexts.push("建筑 " + formatUnlockIdList("building", unlockBundle.buildings)); }
        return unlockTexts.length > 0 ? unlockTexts.join("；") : "无一次性开放";
    }

    /**
     * 将同类解锁 ID 数组格式化为中文名称列表。
     *
     * @param {"resource"|"building"|"job"|"tab"|"craft"} definitionType - 解锁对象类别，用于选择统一定义表。
     * @param {string[]} unlockIds - 稳定 ID 数组；每项必须属于指定解锁类别。
     * @returns {string} 使用顿号连接的中文显示名；缺失定义时保留稳定 ID 以暴露配置错误。
     */
    function formatUnlockIdList(definitionType, unlockIds) {
        // string[] 中文显示名数组：与输入稳定 ID 顺序一致。
        var displayNames = [];

        // number 解锁循环索引：遍历稳定 ID 数组的整数下标。
        for (var unlockIndex = 0; unlockIndex < unlockIds.length; unlockIndex += 1) {
            // string 当前解锁 ID：用于查询对应静态定义的中文名。
            var unlockId = unlockIds[unlockIndex];

            displayNames.push(formatUnlockDisplayName(definitionType, unlockId));
        }
        return displayNames.join("、");
    }

    /**
     * 格式化成本瓶颈逐项说明。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 建筑视图模型。
     * @returns {string} 缺口、净产量、等待与容量说明。
     */
    function formatBuildingCostBottlenecks(state, viewModel) {
        if (viewModel.waitInfo.entries.length <= 0) { return "资源已齐备"; }
        // string[] 瓶颈明细数组：逐缺口资源生成可解释文本。
        var bottleneckTexts = [];
        // number 条目循环索引：遍历缺口资源的整数下标。
        for (var entryIndex = 0; entryIndex < viewModel.waitInfo.entries.length; entryIndex += 1) {
            // ResourceWaitEntry 当前缺口条目：读取差额、净产量和等待秒数。
            var waitEntry = viewModel.waitInfo.entries[entryIndex];
            // ResourceState|null 当前资源状态：用于显示容量上限。
            var resourceState = state.resourcesById[waitEntry.resource] || null;
            bottleneckTexts.push(formatResourceIdList([waitEntry.resource]) + "缺 " + formatNumber(waitEntry.missingAmount) + "，净产量 " + formatNumber(waitEntry.perSecond) + "/秒，" + (waitEntry.isReachable ? "约 " + formatSecondsAsClock(waitEntry.seconds) : "不可等待") + "，容量 " + (resourceState ? formatNumber(resourceState.maxValue) : "0"));
        }
        return bottleneckTexts.join("；");
    }

    /**
     * 获取摧毁一座建筑的可逆效果风险说明。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object} viewModel - 建筑视图模型。
     * @returns {string} 容量、住房、生产和劳力变化说明。
     */
    function getBuildingDestroyRiskText(state, viewModel) {
        // string[] 风险文本数组：只列出当前建筑实际包含的关键可逆效果。
        var riskTexts = [];
        // Object.<string, number> 单座效果字典：用于识别风险类别。
        var effects = viewModel.definition.effects;
        if (effects.housingMax) { riskTexts.push("住房 -" + effects.housingMax + (game.population.countAliveGoblins(state) > game.population.calculateHousingMax(state) - effects.housingMax ? "（将低于人口）" : "")); }
        if (viewModel.laborUsage > 0) { riskTexts.push("建筑劳力占用减少 " + formatNumber(viewModel.laborUsage)); }
        if (Object.keys(effects).some(function (effectId) { return /Max$/.test(effectId); })) { riskTexts.push("资源容量降低，超额库存会被截断"); }
        if (Object.keys(effects).some(function (effectId) { return /PerTick$|PerSecond$|OutputRatio$/.test(effectId); })) { riskTexts.push("持续生产能力降低"); }
        return riskTexts.length > 0 ? riskTexts.join("；") : "无明显即时风险";
    }

    /**
     * 获取当前首要建设瓶颈。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {string} 确定性瓶颈说明。
     */
    function getPrimaryBuildingBottleneck(state, viewModels) {
        // number 当前人口数量：用于住房压力判断。
        var aliveCount = game.population.countAliveGoblins(state);
        // number 当前住房上限：用于住房压力判断。
        var housingMax = game.population.calculateHousingMax(state);
        if (housingMax <= aliveCount) { return "住房将满"; }
        if (game.population.analyzeLaborBreakdown(state).isProductionLaborOverloaded) { return "劳力过载"; }
        // number 模型循环索引：按设计顺序查找首个容量或来源阻断。
        for (var modelIndex = 0; modelIndex < viewModels.length; modelIndex += 1) {
            if (viewModels[modelIndex].capacityBlockedResourceIds.length > 0) { return formatResourceIdList(viewModels[modelIndex].capacityBlockedResourceIds) + "容量不足"; }
            if (viewModels[modelIndex].sourceBlockedResourceIds.length > 0) { return getResourceAcquisitionText(viewModels[modelIndex].sourceBlockedResourceIds[0]); }
        }
        return "当前没有明显建设瓶颈";
    }

    /**
     * 生成最多三条确定性建设建议。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Object[]} viewModels - 已揭示建筑视图模型数组。
     * @returns {string[]} 建设建议文本数组，最多三条。
     */
    function getBuildingAdviceTexts(state, viewModels) {
        // string[] 建议文本数组：按明确优先级追加并在三条时停止。
        var adviceTexts = [];
        // number 当前存活人口：用于判断住房阻断。
        var aliveCount = game.population.countAliveGoblins(state);
        // number 当前住房上限：用于判断住房阻断。
        var housingMax = game.population.calculateHousingMax(state);
        if (housingMax <= aliveCount) { adviceTexts.push("住房 " + aliveCount + "/" + housingMax + "，新的哥布林无法获得床位；可查看窝棚、洞室或黑铁居所。"); }
        if (state.resourcesById.fungus && state.resourcesById.fungus.perSecond < 0 && adviceTexts.length < 3) { adviceTexts.push("菌菇净产量为 " + formatNumber(state.resourcesById.fungus.perSecond) + "/秒，库存会持续下降；可查看菌菇床、孢子沟或采菌职业。"); }
        // LaborBreakdown 当前劳力摘要：用于判断建筑生产过载。
        var laborBreakdown = game.population.analyzeLaborBreakdown(state);
        if (laborBreakdown.isProductionLaborOverloaded && adviceTexts.length < 3) { adviceTexts.push("建筑劳力 " + formatNumber(laborBreakdown.adjustedBuildingUsageTotal) + "/" + formatNumber(laborBreakdown.populationLabor) + " 已过载，除菌菇床外生产停摆；可查看住房或劳力减免建筑。"); }
        // number 模型循环索引：按定义顺序追加硬阻断、入口和来源建议。
        for (var modelIndex = 0; modelIndex < viewModels.length && adviceTexts.length < 3; modelIndex += 1) {
            // Object 当前建筑模型：用于检查容量、来源和关键入口。
            var viewModel = viewModels[modelIndex];
            if (viewModel.capacityBlockedResourceIds.length > 0) { adviceTexts.push(formatResourceIdList(viewModel.capacityBlockedResourceIds) + "容量阻断“" + viewModel.definition.name + "”的价格；可查看仓储运输路线。"); continue; }
            if (viewModel.buildingViewStatus === "available" && viewModel.isKeyBuilding) { adviceTexts.push("关键建筑“" + viewModel.definition.name + "”当前可建，会开放新的核心系统；可定位后自行决定是否投入。"); continue; }
            if (viewModel.sourceBlockedResourceIds.length > 0) { adviceTexts.push("“" + viewModel.definition.name + "”需要先处理：" + getResourceAcquisitionText(viewModel.sourceBlockedResourceIds[0]) + "。"); }
        }
        // number 资源循环索引：没有更高优先级建议时查找已满容量资源。
        for (var resourceIndex = 0; resourceIndex < game.definitions.RESOURCE_DEFINITIONS.length && adviceTexts.length < 3; resourceIndex += 1) {
            // ResourceDefinition 当前资源定义：用于读取运行时库存并推荐容量或消费出口。
            var resourceDefinition = game.definitions.RESOURCE_DEFINITIONS[resourceIndex];
            // ResourceState|null 当前资源状态：仅处理可见、受容量限制且已满仓的资源。
            var resourceState = state.resourcesById[resourceDefinition.id] || null;
            if (resourceState && resourceState.isVisible && resourceDefinition.isCapacityLimited && resourceState.maxValue > 0 && resourceState.value >= resourceState.maxValue) {
                adviceTexts.push(resourceDefinition.name + "已满仓，后续持续产出会溢出；可查看仓储路线或对应消费出口。");
            }
        }
        return adviceTexts.slice(0, 3);
    }

    /**
     * 获取最近建设相关日志文本。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {string[]} 最近五条带既有日期前缀的建设日志。
     */
    function getRecentBuildingLogTexts(state) {
        // string[] 建设日志文本数组：按现有日志新旧顺序筛选。
        var logTexts = [];
        // number 日志循环索引：遍历日志数组的整数下标。
        for (var logIndex = 0; logIndex < state.logs.length && logTexts.length < 5; logIndex += 1) {
            // Object 当前日志记录：包含 text 和日期字段。
            var logEntry = state.logs[logIndex];
            if (/建造|摧毁|建筑|劳力|解锁|开启/.test(logEntry.text)) { logTexts.push(logEntry.text); }
        }
        return logTexts;
    }

    /**
     * 渲染单个建筑行。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {BuildingDefinition} buildingDefinition - 建筑定义对象。
     * @param {BuildingState} buildingState - 建筑运行时状态对象。
     * @returns {HTMLElement} 建筑行元素。
     */
    function renderBuildingRow(state, buildingDefinition, buildingState) {
        // Price[] 当前价格：按拥有数量缩放后的购买成本。
        var price = game.buildings.getBuildingPrice(state, buildingDefinition);

        // Price[] 摧毁返还资源：按最后一座建筑成本的 10% 预览。
        var refundPrice = game.buildings.getBuildingDestroyRefund(state, buildingDefinition);

        // boolean 当前是否可购买：综合暂停、解锁和资源库存。
        var canBuy = game.buildings.canBuyBuilding(state, buildingDefinition);

        // boolean 当前是否可摧毁：拥有数量大于 0 且未暂停。
        var canDestroy = buildingState.owned > 0 && !state.isPaused;

        // string[] 缺口文本数组：资源不足时显示在建筑行成本信息中。
        var missingTexts = game.resources.getMissingResourceTexts(state, price);

        // string 可用倒计时文本：可购买时显示“可用”，否则显示预计等待或不可用。
        var availabilityText = formatActionAvailabilityText(state, price);

        // HTMLElement 行元素：承载单个建筑的基础信息、状态和建造按钮。
        var rowElement = document.createElement("div");

        // HTMLElement 主信息元素：承载建筑名称和拥有数量。
        var mainElement = document.createElement("div");

        // HTMLElement 名称元素：显示建筑中文名。
        var nameElement = document.createElement("strong");

        // HTMLElement 拥有数元素：显示当前拥有数量。
        var ownedElement = document.createElement("span");

        // HTMLElement 成本元素：显示所需资源和缺失资源。
        var costElement = document.createElement("div");

        // HTMLElement 倒计时元素：显示当前资源速度下何时可建。
        var availabilityElement = document.createElement("div");

        // HTMLElement 按钮组元素：承载建造和摧毁按钮。
        var actionsElement = document.createElement("div");

        // HTMLButtonElement 购买按钮：点击后尝试购买建筑。
        var buyButtonElement = document.createElement("button");

        // HTMLButtonElement|null 摧毁按钮：拥有数量大于 0 时点击摧毁一座建筑。
        var destroyButtonElement = null;

        rowElement.className = canBuy ? "building-row is-affordable" : "building-row is-locked";
        rowElement.tabIndex = 0;

        mainElement.className = "building-main";
        nameElement.textContent = buildingDefinition.name;
        ownedElement.textContent = "拥有 " + buildingState.owned;
        mainElement.appendChild(nameElement);
        mainElement.appendChild(ownedElement);

        costElement.className = "building-cost";
        costElement.textContent = "所需：" + formatPriceList(price);

        if (missingTexts.length > 0) {
            // HTMLElement 缺口元素：和所需资源同列显示，避免藏到按钮下方。
            var missingElement = createTextElement("span", "缺失：" + missingTexts.join("，"));

            missingElement.className = "building-missing";
            costElement.appendChild(missingElement);
        }

        availabilityElement.className = "building-availability";
        availabilityElement.textContent = "可用倒计时：" + availabilityText;

        actionsElement.className = "building-actions";

        buyButtonElement.type = "button";
        buyButtonElement.dataset.buildingId = buildingDefinition.id;
        buyButtonElement.disabled = !canBuy;
        buyButtonElement.textContent = canBuy ? "建造" : "缺资源";
        actionsElement.appendChild(buyButtonElement);

        if (buildingState.owned > 0) {
            destroyButtonElement = document.createElement("button");
            destroyButtonElement.type = "button";
            destroyButtonElement.dataset.buildingDestroyId = buildingDefinition.id;
            destroyButtonElement.disabled = !canDestroy;
            destroyButtonElement.textContent = "摧毁";
            destroyButtonElement.className = "danger-button";
            actionsElement.appendChild(destroyButtonElement);
        }

        rowElement.appendChild(mainElement);
        rowElement.appendChild(costElement);
        rowElement.appendChild(availabilityElement);
        rowElement.appendChild(actionsElement);
        rowElement.appendChild(createBuildingTooltip(buildingDefinition, price, refundPrice));
        return rowElement;
    }

    /**
     * 创建建筑悬浮详情框。
     *
     * @param {BuildingDefinition} buildingDefinition - 建筑定义对象，用于读取介绍和效果。
     * @param {Price[]} price - 当前建造价格数组；amount 为非负资源数量。
     * @param {Price[]} refundPrice - 当前摧毁返还数组；amount 为非负资源数量。
     * @param {BuildingState=} buildingState - 可选建筑运行时状态；提供时在浮窗显示拥有、启用和下一座信息。
     * @returns {HTMLElement} 建筑悬浮框元素。
     */
    function createBuildingTooltip(buildingDefinition, price, refundPrice, buildingState) {
        // HTMLElement 悬浮框元素：承载建筑介绍、成本和效果详情。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表元素：用键值行展示建筑详情。
        var listElement = document.createElement("dl");

        tooltipElement.className = "building-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", buildingDefinition.name));
        appendTooltipDefinition(listElement, "建筑介绍", buildingDefinition.description);
        if (buildingState) {
            appendTooltipDefinition(listElement, "拥有/启用", buildingState.owned + " / " + buildingState.active);
            appendTooltipDefinition(listElement, "下一座", formatBuildingEffects(buildingDefinition.effects));
        }
        appendTooltipDefinition(listElement, "建筑成本", formatPriceList(price));
        appendTooltipDefinition(listElement, "摧毁返还", formatPriceList(refundPrice));
        appendTooltipDefinition(listElement, "建筑效果", formatBuildingEffects(buildingDefinition.effects));
        appendTooltipDefinition(listElement, "价格倍率", "x" + buildingDefinition.priceRatio.toFixed(2));
        tooltipElement.appendChild(listElement);
        return tooltipElement;
    }

    /**
     * 格式化主动操作可用倒计时。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {string} 可用、倒计时或不可用中文文本。
     */
    function formatActionAvailabilityText(state, price) {
        // string 资源等待文本：资源不足时由资源系统估算补齐时间。
        var availabilityText = game.resources.formatPriceAvailabilityText(state, price);

        if (availabilityText) {
            return availabilityText.replace(game.text.TEXT_REGISTRY.ui.availabilityPrefix, "");
        }

        return "可用";
    }

    /**
     * 格式化价格数组。
     *
     * @param {Price[]} price - 价格数组；amount 为非负资源数量。
     * @returns {string} 中文价格文本。
     */
    function formatPriceList(price) {
        // string[] 价格文本数组：每项为资源名和数量。
        var priceTexts = [];

        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < price.length; priceIndex += 1) {
            // Price 当前价格项：用于格式化单项成本。
            var priceEntry = price[priceIndex];

            priceTexts.push(game.resources.getResourceDisplayName(priceEntry.resource) + " " + priceEntry.amount.toFixed(0));
        }

        return priceTexts.join("，");
    }

    /**
     * 格式化效果字典为百分比文本。
     *
     * @param {Object.<string, number>} effects - 效果字典；key 为效果 ID，value 为加成比例。
     * @returns {string} 中文效果文本。
     */
    function formatEffectMap(effects) {
        // string[] 效果文本数组：每项为效果中文名和百分比。
        var effectTexts = [];

        // string[] 效果 ID 数组：用于遍历效果字典。
        var effectIds = Object.keys(effects);

        // number 循环索引：遍历效果 ID 数组的整数下标。
        for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
            // string 当前效果 ID：用于读取效果数值。
            var effectId = effectIds[effectIndex];

            // string 效果名称：优先使用集中效果文案。
            var effectName = game.text.TEXT_REGISTRY.effects[effectId] || effectId;

            effectTexts.push(effectName + " " + formatSignedRatio(effects[effectId]));
        }

        return effectTexts.join("，");
    }

    /**
     * 格式化数值修正字典。
     *
     * @param {Object.<string, number>} bonusMap - 数值修正字典；key 为属性或技能 ID，value 为有符号数值。
     * @param {Object.<string, string>=} labelById - 可选中文名表；key 为属性或技能 ID，value 为显示名，省略时使用原 ID。
     * @returns {string} 修正文本；无修正时返回“无”。
     */
    function formatNumericBonusMap(bonusMap, labelById) {
        if (!bonusMap) {
            return "无";
        }

        // string[] 修正 ID 数组：用于遍历属性或技能修正。
        var bonusIds = Object.keys(bonusMap);

        if (bonusIds.length <= 0) {
            return "无";
        }

        // string[] 修正文本数组：每项为 ID 和有符号整数值。
        var bonusTexts = [];

        // number 循环索引：遍历修正 ID 数组的整数下标。
        for (var bonusIndex = 0; bonusIndex < bonusIds.length; bonusIndex += 1) {
            // string 修正 ID：属性或技能稳定 ID。
            var bonusId = bonusIds[bonusIndex];

            // string 修正显示名：优先使用中文名表，缺失时回退稳定 ID 便于发现数据问题。
            var bonusLabel = labelById && labelById[bonusId] ? labelById[bonusId] : bonusId;

            // number 修正数值：有符号浮点数，显示时保留整数。
            var bonusValue = Number(bonusMap[bonusId]) || 0;

            bonusTexts.push(bonusLabel + " " + (bonusValue >= 0 ? "+" : "") + bonusValue.toFixed(0));
        }

        return bonusTexts.join("，");
    }

    /**
     * 格式化有符号数值。
     *
     * @param {number} value - 数值，可正可负。
     * @returns {string} 带正负号并保留两位小数的文本。
     */
    function formatSignedNumber(value) {
        // string 正负号：非负数显示加号。
        var signText = value >= 0 ? "+" : "";

        return signText + value.toFixed(2);
    }

    /**
     * 格式化有符号比例。
     *
     * @param {number} ratio - 比例数值，0.05 表示 5%。
     * @returns {string} 带正负号的百分比文本。
     */
    function formatSignedRatio(ratio) {
        // string 正负号：非负数显示加号。
        var signText = ratio >= 0 ? "+" : "";

        return signText + Math.round(ratio * 100) + "%";
    }

    /**
     * 格式化建筑效果字典。
     *
     * @param {Object.<string, number>} effects - 建筑效果字典；key 为效果 ID，value 为数值。
     * @returns {string} 中文效果文本。
     */
    function formatBuildingEffects(effects) {
        // string[] 效果文本数组：每项为效果 ID 和数值。
        var effectTexts = [];

        // string[] 效果 ID 数组：用于遍历效果字典。
        var effectIds = Object.keys(effects);

        // number 循环索引：遍历效果 ID 数组的整数下标。
        for (var effectIndex = 0; effectIndex < effectIds.length; effectIndex += 1) {
            // string 当前效果 ID：用于读取效果数值。
            var effectId = effectIds[effectIndex];

            effectTexts.push((game.text.TEXT_REGISTRY.effects[effectId] || effectId) + " +" + effects[effectId]);
        }

        return effectTexts.join("，");
    }

    /**
     * 渲染日志列表。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function renderLogs(state) {
        // HTMLElement 时间显示容器：在日志卡片顶部显示当前游戏日期。
        var logDateElement = document.getElementById("log-date");

        // HTMLElement 日志列表容器：承载最近日志。
        var logListElement = document.getElementById("log-list");

        // HTMLInputElement 普通日志开关：控制普通日志是否显示。
        var showNormalElement = document.getElementById("show-normal-logs");

        // HTMLInputElement 重要日志开关：控制重要日志是否显示。
        var showImportantElement = document.getElementById("show-important-logs");

        // HTMLInputElement 警告日志开关：控制警告日志是否显示。
        var showWarningElement = document.getElementById("show-warning-logs");

        // string 当前天气文本：用于在日志栏时间旁提示自然环境。
        var currentWeatherText = game.weather ? "｜天气：" + game.weather.formatCurrentWeather(state) : "";

        logDateElement.textContent = "时间：" + game.calendar.formatCurrentDate(state) + currentWeatherText;
        logListElement.innerHTML = "";

        // number 循环索引：遍历日志数组的整数下标。
        for (var logIndex = 0; logIndex < state.logs.length; logIndex += 1) {
            // Object 当前日志：包含等级、文本和时间戳。
            var logEntry = state.logs[logIndex];

            if (logEntry.level === "normal" && !showNormalElement.checked) {
                continue;
            }

            if (logEntry.level === "important" && !showImportantElement.checked) {
                continue;
            }

            if (logEntry.level === "warning" && !showWarningElement.checked) {
                continue;
            }

            // HTMLElement 日志行元素：显示单条日志文本。
            var logItemElement = document.createElement("li");

            logItemElement.dataset.level = logEntry.level;
            logItemElement.textContent = logEntry.text;
            logListElement.appendChild(logItemElement);
        }
    }

    /**
     * 渲染完整应用界面。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {boolean=} shouldForceTabRender - 是否强制重建标签页；true 表示忽略交互保护。
     * @returns {void} 无返回值。
     */
    function renderApp(state, shouldForceTabRender) {
        // NodeListOf<HTMLElement> 旧研究路线元素列表：重建标签页前分别记录横向滚动位置。
        var existingResearchLaneElements = document.querySelectorAll(".research-lane[data-research-line-scroll-id]");

        // HTMLElement|null 旧建筑筛选栏：重建标签页前记录玩家当前横向滚动位置。
        var existingBuildingFilterElement = document.querySelector(".building-filter-bar");

        // HTMLElement|null 旧建筑路线栏：重建标签页前记录玩家当前横向滚动位置。
        var existingBuildingRouteElement = document.querySelector(".building-route-navigation");

        if (existingBuildingFilterElement) {
            game.runtime.buildingFilterScrollLeft = existingBuildingFilterElement.scrollLeft;
        }

        if (existingBuildingRouteElement) {
            game.runtime.buildingRouteScrollLeft = existingBuildingRouteElement.scrollLeft;
        }

        if (!game.runtime.researchScrollLeftByLineId) {
            game.runtime.researchScrollLeftByLineId = {};
        }

        // number 路线循环索引：遍历当前图谱中的科研分类卡片。
        for (var laneIndex = 0; laneIndex < existingResearchLaneElements.length; laneIndex += 1) {
            // HTMLElement 路线元素：提供稳定路线 ID 与当前横向滚动像素值。
            var existingResearchLaneElement = existingResearchLaneElements[laneIndex];

            game.runtime.researchScrollLeftByLineId[existingResearchLaneElement.dataset.researchLineScrollId] = existingResearchLaneElement.scrollLeft;
        }

        renderTopbar(state);
        renderResources(state);
        renderStatus(state);
        renderSidebarBuildingAdvice(state);
        if (shouldForceTabRender || !shouldPreserveInteractiveTabDom()) {
            renderTabs(state);
            restoreBuildingNavigationScrollPositions();
        }
        renderLogs(state);
    }

    /**
     * 恢复建筑状态筛选栏和路线导航栏的横向滚动位置。
     *
     * @returns {void} 无返回值；存在对应元素时会写入其 scrollLeft。
     */
    function restoreBuildingNavigationScrollPositions() {
        // HTMLElement|null 新建筑筛选栏：标签页重建后恢复之前的横向像素位置。
        var buildingFilterElement = document.querySelector(".building-filter-bar");

        // HTMLElement|null 新建筑路线栏：标签页重建后恢复之前的横向像素位置。
        var buildingRouteElement = document.querySelector(".building-route-navigation");

        if (buildingFilterElement) {
            buildingFilterElement.scrollLeft = Math.max(0, Number(game.runtime.buildingFilterScrollLeft) || 0);
        }

        if (buildingRouteElement) {
            buildingRouteElement.scrollLeft = Math.max(0, Number(game.runtime.buildingRouteScrollLeft) || 0);
        }
    }

    /**
     * 按固定频率自动刷新界面，减少无意义 DOM 重建对点击和输入的干扰。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {number} nowTimestamp - 当前 Unix 毫秒时间戳。
     * @returns {void} 无返回值。
     */
    function renderAppWhenDue(state, nowTimestamp) {
        if (nowTimestamp - lastAutoRenderTimestamp < AUTO_RENDER_INTERVAL_MS) {
            return;
        }

        lastAutoRenderTimestamp = nowTimestamp;
        renderApp(state, false);
    }

    // Object 渲染模块命名空间：提供完整界面渲染函数。
    game.render = {
        renderApp: renderApp,
        renderAppWhenDue: renderAppWhenDue,
        renderDiplomacyTabOnly: renderDiplomacyTabOnly,
        renderCavernTabOnly: renderCavernTabOnly,
        renderBuildingWorkspaceOnly: renderBuildingWorkspaceOnly,
        renderBuildingWorkspaceResultsOnly: renderBuildingWorkspaceResultsOnly,
        renderResearchWorkspaceResultsOnly: renderResearchWorkspaceResultsOnly,
        renderResearchSelectionOnly: renderResearchSelectionOnly
    };
})(window.GoblinEmpire);
