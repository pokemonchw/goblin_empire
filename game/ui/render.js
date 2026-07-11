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

        appendTooltipDefinition(listElement, "总产出速度", formatRate(flowSummary.totalOutputPerSecond));
        appendTooltipDefinition(listElement, "产出明细", formatFlowEntries(flowSummary.outputEntries));

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

            if (!state.tabsUnlockedById[tabDefinition.id] && state.activeTabId !== tabDefinition.id) {
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
     * @returns {boolean} 是否应跳过标签页重建；true 表示当前有输入框聚焦或鼠标正按住标签内容。
     */
    function shouldPreserveInteractiveTabDom() {
        // Element|null 当前聚焦元素：用于判断玩家是否正在搜索框输入。
        var activeElement = document.activeElement;

        // HTMLElement|null 标签页内容容器：用于判断活动元素或鼠标是否位于内容区。
        var tabContentElement = document.getElementById("tab-content");

        // HTMLElement|null 标签页按钮容器：用于保护标签切换点击过程。
        var tabListElement = document.getElementById("tab-list");

        if (activeElement && activeElement.dataset && activeElement.dataset.censusFilterKey) {
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
        appendCaptiveActionButton(actionsElement, state, captive, "food", game.text.TEXT_REGISTRY.ui.captiveFood);
        cardElement.appendChild(actionsElement);
        cardElement.appendChild(renderCaptiveTooltip(state, captive, captiveTypeDefinition, qualityDefinition));
        return cardElement;
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
     * @param {"bed"|"modify"|"food"} dispositionId - 处置方式 ID。
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
        appendDefinitionDetail(listElement, "种类", (qualityDefinition ? qualityDefinition.name : captive.quality) + " " + (captiveTypeDefinition ? captiveTypeDefinition.name : captive.type));
        appendDefinitionDetail(listElement, "来源", formatCaptiveSource(captive.source));
        appendDefinitionDetail(listElement, "倾向", formatCaptiveTraitHint(captive.traitHint));
        appendDefinitionDetail(listElement, "洗脑程度", Math.round(Number(captive.brainwashLevel) || 0) + "%");
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

        // HTMLElement 列表元素：承载所有已解锁科技研究行。
        var listElement = document.createElement("div");

        tabContentElement.appendChild(headingElement);
        tabContentElement.appendChild(renderResearchSummary(state));
        tabContentElement.appendChild(renderResearchControls());
        tabContentElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.researchTitle));
        listElement.className = "building-list research-list";

        // TechnologyDefinition[] 可见科技定义数组：按筛选和排序生成。
        var visibleTechnologies = getVisibleResearchTechnologies(state);

        // number 循环索引：遍历可见科技定义数组的整数下标。
        for (var technologyIndex = 0; technologyIndex < visibleTechnologies.length; technologyIndex += 1) {
            // TechnologyDefinition 当前科技定义：用于渲染研究行。
            var technologyDefinition = visibleTechnologies[technologyIndex];

            // TechnologyState 当前科技状态：用于判断显示和完成态。
            var technologyState = state.technologiesById[technologyDefinition.id];

            if (!technologyState || !technologyState.isUnlocked) {
                continue;
            }

            listElement.appendChild(renderTechnologyRow(state, technologyDefinition, technologyState));
        }

        tabContentElement.appendChild(listElement);
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

        summaryElement.className = "action-card";
        summaryElement.appendChild(createTextElement("h3", "研究资源与线路"));
        summaryElement.appendChild(createTextElement("p", "粗识：" + formatResearchResource(state, "crudeKnowledge") + "，账册：" + formatResearchResource(state, "ledger") + "，魔晶：" + formatResearchResource(state, "manaCrystal")));
        summaryElement.appendChild(createTextElement("p", formatResearchLineCounts(state)));
        return summaryElement;
    }

    /**
     * 渲染研究筛选与排序控件。
     *
     * @returns {HTMLElement} 研究控件元素。
     */
    function renderResearchControls() {
        // HTMLElement 控件元素：承载研究筛选与排序按钮。
        var controlsElement = document.createElement("div");

        controlsElement.className = "toolbar";
        controlsElement.appendChild(createResearchButton("researchFilter", "all", "全部"));
        controlsElement.appendChild(createResearchButton("researchFilter", "available", "可研究"));
        controlsElement.appendChild(createResearchButton("researchFilter", "hide_done", "隐藏已完成"));
        controlsElement.appendChild(createResearchButton("researchSort", "line", "按线路"));
        controlsElement.appendChild(createResearchButton("researchSort", "cost", "按成本"));
        return controlsElement;
    }

    /**
     * 创建研究筛选或排序按钮。
     *
     * @param {"researchFilter"|"researchSort"} dataKey - dataset 字段名。
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

            if (!technologyState || !technologyState.isUnlocked) {
                continue;
            }

            if (researchFilter === "available" && !game.technology.canResearch(state, technologyDefinition)) {
                continue;
            }

            if (researchFilter === "hide_done" && technologyState.isResearched) {
                continue;
            }

            visibleTechnologies.push(technologyDefinition);
        }

        visibleTechnologies.sort(function (leftTechnology, rightTechnology) {
            if (researchSort === "cost") {
                return getTechnologyCostScore(leftTechnology) - getTechnologyCostScore(rightTechnology);
            }

            return getTechnologyLine(leftTechnology.id).localeCompare(getTechnologyLine(rightTechnology.id)) || leftTechnology.id.localeCompare(rightTechnology.id);
        });
        return visibleTechnologies;
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
        if (technologyId === "marks" || technologyId === "deadwood_cultivation" || technologyId === "foraging" || technologyId === "digging" || technologyId === "hut_building" || technologyId === "woodcraft") {
            return "生存";
        }

        if (technologyId === "mining" || technologyId === "metallurgy" || technologyId === "charcoal_burning" || technologyId === "crude_tools" || technologyId === "engineering" || technologyId === "machinery" || technologyId === "steel" || technologyId === "black_iron_smelting") {
            return "矿业";
        }

        if (technologyId === "clan_rules" || technologyId === "census" || technologyId === "counting" || technologyId === "calendar" || technologyId === "currency" || technologyId === "writing" || technologyId === "diplomacy" || technologyId === "imperial_code" || technologyId === "migration_code") {
            return "制度";
        }

        if (technologyId === "beast_pen" || technologyId === "big_club" || technologyId === "crossbow" || technologyId === "surface_lore") {
            return "军工";
        }

        if (technologyId === "rituals" || technologyId === "runology" || technologyId === "rift_engineering") {
            return "符文";
        }

        return "深渊";
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
     * @returns {string} 中文显示名；找不到定义时返回稳定 ID 以暴露数据缺口。
     */
    function formatUnlockDisplayName(definitionType, unlockId) {
        if (definitionType === "resource") {
            // ResourceDefinition|null 资源定义：用于读取资源中文名。
            var resourceDefinition = game.resources.getResourceDefinition(unlockId);

            return resourceDefinition ? resourceDefinition.name : unlockId;
        }

        if (definitionType === "technology") {
            // TechnologyDefinition|null 科技定义：用于读取科技中文名。
            var technologyDefinition = game.technology.getTechnologyDefinition(unlockId);

            return technologyDefinition ? technologyDefinition.name : unlockId;
        }

        if (definitionType === "building") {
            // BuildingDefinition|null 建筑定义：用于读取建筑中文名。
            var buildingDefinition = game.buildings.getBuildingDefinition(unlockId);

            return buildingDefinition ? buildingDefinition.name : unlockId;
        }

        if (definitionType === "job") {
            // JobDefinition|null 职业定义：用于读取职业中文名。
            var jobDefinition = game.jobs.getJobDefinition(unlockId);

            return jobDefinition ? jobDefinition.name : unlockId;
        }

        if (definitionType === "policy" && game.policiesSystem) {
            // PolicyDefinition|null 政策定义：用于读取政策中文名。
            var policyDefinition = game.policiesSystem.getPolicyDefinition(unlockId);

            return policyDefinition ? policyDefinition.name : unlockId;
        }

        if (definitionType === "craft" && game.crafting) {
            // CraftRecipeDefinition|null 配方定义：用于读取配方中文名。
            var recipeDefinition = game.crafting.getRecipeDefinition(unlockId);

            return recipeDefinition ? recipeDefinition.name : unlockId;
        }

        if (definitionType === "upgrade" && game.rituals) {
            // RitualUpgradeDefinition|null 祖灵升级定义：用于读取升级中文名。
            var upgradeDefinition = game.rituals.getRitualUpgradeDefinition(unlockId);

            return upgradeDefinition ? upgradeDefinition.name : unlockId;
        }

        if (definitionType === "tab") {
            return findDefinitionNameById(game.definitions.TAB_DEFINITIONS, unlockId);
        }

        return unlockId;
    }

    /**
     * 从带 name 字段的定义表中查找中文显示名。
     *
     * @param {{id: string, name: string}[]} definitionList - 定义列表；每项必须包含稳定 ID 和中文显示名。
     * @param {string} definitionId - 要查找的稳定 ID。
     * @returns {string} 中文显示名；找不到定义时返回稳定 ID。
     */
    function findDefinitionNameById(definitionList, definitionId) {
        // number 循环索引：遍历定义列表的整数下标。
        for (var definitionIndex = 0; definitionIndex < definitionList.length; definitionIndex += 1) {
            // {id: string, name: string} 当前定义项：包含稳定 ID 和中文显示名。
            var definitionEntry = definitionList[definitionIndex];

            if (definitionEntry.id === definitionId) {
                return definitionEntry.name;
            }
        }

        return definitionId;
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
        tabContentElement.appendChild(createTextElement("p", "工程师：" + game.jobs.countAssigned(state, "engineer") + "，自动制作：" + (state.statistics.autoCraftRecipeId || "未选择") + "，速度 " + game.crafting.calculateAutoCraftRate(state).toFixed(2) + "/秒"));
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
        cardElement.appendChild(createTextElement("p", "解锁：" + formatBuildingUnlockCondition(buildingDefinition)));

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

        // string[] 当前政策组 ID 数组：用于显示已使用的等价法令。
        var activePolicyGroupIds = Object.keys(state.policies);

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "法令能力"));
        cardElement.appendChild(createTextElement("p", "酋长厅等级：" + chiefHallCount + "，法令槽位：" + decreeSlotCount));
        cardElement.appendChild(createTextElement("p", "当前政策组：" + (activePolicyGroupIds.length > 0 ? activePolicyGroupIds.join("，") : "无")));
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
     * @param {BuildingDefinition} buildingDefinition - 建筑定义对象。
     * @returns {string} 建筑解锁条件中文文本。
     */
    function formatBuildingUnlockCondition(buildingDefinition) {
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

        return conditionTexts.length > 0 ? conditionTexts.join("；") : "由科技、建筑或阶段解锁";
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

        // number 食物口数：当前消耗菌菇的哥布林和俘虏总数。
        var fungusConsumerCount = game.population.countFungusConsumers(state);

        // number 住房上限：用于拥挤度来源。
        var housingMax = game.population.calculateHousingMax(state);

        // number 拥挤度比例：来自人口系统。
        var crowdingRatio = game.population.calculateCrowdingRatio(state);

        // number 菌菇消耗：当前哥布林和俘虏理论消耗，单位菌菇/秒。
        var fungusConsumption = game.population.calculateFungusConsumptionPerSecond(state);

        // number 待处置俘虏数量：苗床繁育的直接入口数量。
        var captiveCount = state.captives.length;

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "人口压力"));
        cardElement.appendChild(createTextElement("p", "人口/住房：" + aliveCount + " / " + housingMax));
        cardElement.appendChild(createTextElement("p", "口粮口数：" + fungusConsumerCount + "（含俘虏 " + captiveCount + "）"));
        cardElement.appendChild(createTextElement("p", "拥挤度：" + Math.round(crowdingRatio * 100) + "%"));
        cardElement.appendChild(createTextElement("p", "菌菇消耗：" + fungusConsumption.toFixed(2) + "/秒"));
        cardElement.appendChild(createTextElement("p", "繁育入口：俘虏卡牌培育新生"));
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
        gridElement.appendChild(renderPaceCard("1-3 小时", "建立酋长厅、黑市、训练坑和祖灵祭坛", hasBuildingOwned(state, "chief_hall") && hasBuildingOwned(state, "black_market") && hasBuildingOwned(state, "training_pit") && hasBuildingOwned(state, "ancestral_altar")));
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
        // HTMLElement 卡片元素：显示祖灵回响、战利品和深渊回响。
        var cardElement = document.createElement("div");

        cardElement.className = "action-card";
        cardElement.appendChild(createTextElement("h3", "神秘资源"));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "ancestralEcho")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "loot")));
        cardElement.appendChild(createTextElement("p", formatRitualResource(state, "abyssEcho")));
        return cardElement;
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
        // ResourceDefinition|null 资源定义：用于读取中文名。
        var resourceDefinition = game.resources.getResourceDefinition(resourceId);

        // ResourceState|null 资源状态：用于读取当前库存、容量和变化率。
        var resourceState = state.resourcesById[resourceId] || null;

        if (!resourceState || !resourceState.isVisible) {
            return (resourceDefinition ? resourceDefinition.name : resourceId) + "：未显示";
        }

        return (resourceDefinition ? resourceDefinition.name : resourceId) + "：" + resourceState.value.toFixed(1) + " / " + resourceState.maxValue.toFixed(0) + "（" + formatSignedNumber(resourceState.perSecond) + "/秒）";
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

        // HTMLButtonElement 迁徙按钮：点击后需要二次确认。
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

        rowElement.appendChild(createLocationMainElement(factionDefinition.name, "关系 " + game.diplomacy.getRelation(state, factionDefinition.id)));
        rowElement.appendChild(createTextElement("span", "消耗：" + formatPriceList(factionDefinition.cost)));
        rowElement.appendChild(createTextElement("span", "收益：" + (rewardDefinition ? rewardDefinition.name : factionDefinition.rewardResource) + " " + preview.minReward.toFixed(1) + "-" + preview.maxReward.toFixed(1)));
        rowElement.appendChild(createTextElement("span", "距离 " + formatSecondsText(preview.distanceSeconds)));
        rowElement.appendChild(createTextElement("span", missingTexts.length > 0 ? game.text.TEXT_REGISTRY.ui.missingPrefix + missingTexts.join("，") : (activeMissionCount > 0 ? "在途 " + activeMissionCount : "可派出")));
        rowElement.appendChild(buttonElement);
        rowElement.appendChild(renderFactionLocationTooltip(state, factionDefinition, preview, rewardDefinition, missingTexts));
        return rowElement;
    }

    /**
     * 创建地点行左侧主信息。
     *
     * @param {string} nameText - 地点或势力中文名称。
     * @param {string} detailText - 右侧短说明文本。
     * @returns {HTMLElement} 主信息元素。
     */
    function createLocationMainElement(nameText, detailText) {
        // HTMLElement 主信息元素：包含名称和短状态。
        var mainElement = document.createElement("span");

        // HTMLElement 名称元素：显示地点或势力名称。
        var nameElement = document.createElement("strong");

        // HTMLElement 详情元素：显示关系、强度等短状态。
        var detailElement = document.createElement("span");

        mainElement.className = "location-main";
        nameElement.textContent = nameText;
        detailElement.textContent = detailText;
        mainElement.appendChild(nameElement);
        mainElement.appendChild(detailElement);
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

        // Object.<string, number|string|boolean|Price[]|Object> 掠夺预览：包含队伍强度、成功率和风险。
        var preview = game.raids.previewRaid(state, targetDefinition.id, configuredRaiderCount);

        // number 当前可显示派出人数：限制在最低需求和可用战斗职业人数之间。
        var displayedRaiderCount = Math.min(Math.max(configuredRaiderCount, targetDefinition.minRaiders), Math.max(preview.availableRaiderCount, targetDefinition.minRaiders));

        // HTMLElement 派出人数控件：使用与职业分配一致的按钮加减模式。
        var memberControlElement = renderRaidMemberControls(state, targetDefinition, preview, displayedRaiderCount);

        // string[] 掠夺成本缺口文本：菌菇不足时用于行内摘要和浮窗。
        var missingCostTexts = game.resources.getMissingResourceTexts(state, preview.cost);

        // number 在途掠夺队数量：显示同一目标尚未返程的行动数量。
        var activeMissionCount = game.diplomacy.countActiveMissionsForLocation(state, "raid", targetDefinition.id);

        // HTMLButtonElement 掠夺按钮：点击后执行掠夺。
        var buttonElement = document.createElement("button");

        rowElement.className = "resource-row location-row raid-location-row";
        rowElement.tabIndex = 0;
        rowElement.dataset.raidMemberCount = String(displayedRaiderCount);
        buttonElement.type = "button";
        buttonElement.dataset.raidTargetId = targetDefinition.id;
        buttonElement.textContent = "派出";
        buttonElement.disabled = state.isPaused || !preview.canStart;
        rowElement.appendChild(createLocationMainElement(targetDefinition.name, factionDefinition.name));
        rowElement.appendChild(createTextElement("span", "强度 " + targetDefinition.targetStrength));
        rowElement.appendChild(createTextElement("span", "消耗：" + formatRaidCostText(preview)));
        rowElement.appendChild(createTextElement("span", "成功率 " + Math.round(preview.successChance * 100) + "%"));
        rowElement.appendChild(createTextElement("span", "距离 " + formatSecondsText(preview.distanceSeconds)));
        rowElement.appendChild(createTextElement("span", preview.canStart ? (activeMissionCount > 0 ? "在途 " + activeMissionCount : "可派出") : getRaidMissingSummary(preview, targetDefinition, missingCostTexts)));
        rowElement.appendChild(memberControlElement);
        rowElement.appendChild(buttonElement);
        rowElement.appendChild(renderRaidTargetLocationTooltip(state, targetDefinition, factionDefinition, preview, missingCostTexts));
        return rowElement;
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

            // ResourceDefinition|null 菌菇资源定义：缺失时回退显示稳定 ID。
            var fungusDefinition = game.resources.getResourceDefinition("fungus");

            if (fungusPriceEntry) {
                return (fungusDefinition ? fungusDefinition.name : fungusPriceEntry.resource) + " 不可用";
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
        appendDefinitionDetail(listElement, "伤亡", "受伤 " + Math.round(preview.casualtyChance * 100) + "%，死亡 " + Math.round(preview.deathChance * 100) + "%");
        appendDefinitionDetail(listElement, "关系", "下降 " + preview.relationPenalty + "，报复可能 " + Math.round(preview.retaliationChance * 100) + "%");
        appendDefinitionDetail(listElement, "声名", "成功恶名 +" + preview.infamyReward + "、善名 -" + preview.goodwillPenalty + "；失败恶名 -" + preview.infamyFailurePenalty);
        appendDefinitionDetail(listElement, "收益", formatRewardDictionary(targetDefinition.rewards));
        appendDefinitionDetail(listElement, "俘虏", String(preview.captiveTypes));

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

            // ResourceDefinition|null 资源定义：用于把资源 ID 转成中文名称。
            var resourceDefinition = game.resources.getResourceDefinition(resourceId);

            rewardTexts.push((resourceDefinition ? resourceDefinition.name : resourceId) + " " + rewardsByResourceId[resourceId]);
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

            // ResourceDefinition|null 资源定义：用于显示中文名称。
            var resourceDefinition = game.resources.getResourceDefinition(resourceId);

            outputTexts.push((resourceDefinition ? resourceDefinition.name : resourceId) + " +" + jobDefinition.baseOutput[resourceId] + "/tick");
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
        cardElement.appendChild(createTextElement("p", "年龄：" + goblin.age));
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

            // ResourceDefinition|null 产出资源定义：用于显示中文资源名。
            var resourceDefinition = game.resources.getResourceDefinition(actionDefinition.resource);

            cardElement.className = "action-card";
            buttonElement.type = "button";
            buttonElement.dataset.actionId = actionDefinition.id;
            buttonElement.textContent = actionDefinition.name;
            buttonElement.disabled = state.isPaused;
            cardElement.appendChild(buttonElement);
            cardElement.appendChild(createTextElement("p", actionDefinition.description));
            cardElement.appendChild(createTextElement("p", "+" + actionDefinition.amount + " " + (resourceDefinition ? resourceDefinition.name : actionDefinition.resource)));
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
        // HTMLElement 区块元素：承载建筑购买行列表。
        var sectionElement = document.createElement("section");

        // HTMLElement 行列表元素：按资源卡片风格排列建筑行。
        var listElement = document.createElement("div");

        sectionElement.appendChild(createTextElement("h3", game.text.TEXT_REGISTRY.ui.basicBuildings));
        listElement.className = "building-list";

        // number 循环索引：遍历建筑定义数组的整数下标。
        for (var buildingIndex = 0; buildingIndex < game.definitions.BUILDING_DEFINITIONS.length; buildingIndex += 1) {
            // BuildingDefinition 当前建筑定义：用于渲染购买行和效果。
            var buildingDefinition = game.definitions.BUILDING_DEFINITIONS[buildingIndex];

            // BuildingState 建筑状态：用于读取解锁和拥有数量。
            var buildingState = state.buildingsById[buildingDefinition.id];

            if (!buildingState || !buildingState.isUnlocked) {
                continue;
            }

            listElement.appendChild(renderBuildingRow(state, buildingDefinition, buildingState));
        }

        sectionElement.appendChild(listElement);
        return sectionElement;
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
     * @returns {HTMLElement} 建筑悬浮框元素。
     */
    function createBuildingTooltip(buildingDefinition, price, refundPrice) {
        // HTMLElement 悬浮框元素：承载建筑介绍、成本和效果详情。
        var tooltipElement = document.createElement("div");

        // HTMLElement 明细列表元素：用键值行展示建筑详情。
        var listElement = document.createElement("dl");

        tooltipElement.className = "building-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.appendChild(createTextElement("h4", buildingDefinition.name));
        appendTooltipDefinition(listElement, "建筑介绍", buildingDefinition.description);
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

            // ResourceDefinition|null 资源定义：用于显示中文资源名。
            var resourceDefinition = game.resources.getResourceDefinition(priceEntry.resource);

            priceTexts.push((resourceDefinition ? resourceDefinition.name : priceEntry.resource) + " " + priceEntry.amount.toFixed(0));
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
        renderTopbar(state);
        renderResources(state);
        renderStatus(state);
        if (shouldForceTabRender || !shouldPreserveInteractiveTabDom()) {
            renderTabs(state);
        }
        renderLogs(state);
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
        renderAppWhenDue: renderAppWhenDue
    };
})(window.GoblinEmpire);
