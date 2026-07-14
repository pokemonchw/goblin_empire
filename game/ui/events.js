/* 事件模块：绑定用户输入并调用系统函数修改 GameState。 */
/**
 * 初始化事件模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 events 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 绑定顶栏按钮事件。
     *
     * @returns {void} 无返回值。
     */
    function bindToolbarEvents() {
        // HTMLButtonElement 暂停按钮元素：点击后切换全局暂停状态。
        var pauseButtonElement = document.getElementById("pause-toggle");

        // HTMLButtonElement 保存按钮元素：点击后写入 localStorage。
        var saveButtonElement = document.getElementById("save-game");

        // HTMLButtonElement 加载按钮元素：点击后从 localStorage 恢复。
        var loadButtonElement = document.getElementById("load-game");

        // HTMLButtonElement 重置按钮元素：点击后清空 localStorage 并创建新局。
        var resetButtonElement = document.getElementById("reset-save");

        // HTMLButtonElement 导出按钮元素：点击后把存档文本写入内嵌文本框。
        var exportButtonElement = document.getElementById("export-save");

        // HTMLButtonElement 导入按钮元素：点击后打开内嵌文本框等待粘贴。
        var importButtonElement = document.getElementById("import-save");

        // HTMLButtonElement 新手教程按钮元素：点击后切换到始终可见的教程标签页。
        var tutorialButtonElement = document.getElementById("open-tutorial");

        // HTMLElement 存档文本面板元素：承载导出和导入的内嵌文本框。
        var saveTransferPanelElement = document.getElementById("save-transfer-panel");

        // HTMLTextAreaElement 存档文本输入框：用于显示导出文本或接收导入文本。
        var saveTransferTextElement = document.getElementById("save-transfer-text");

        // HTMLButtonElement 导入应用按钮元素：点击后尝试从内嵌文本框载入存档。
        var applyImportButtonElement = document.getElementById("apply-import-save");

        // HTMLButtonElement 存档文本收起按钮元素：点击后隐藏内嵌文本框。
        var closeSaveTransferButtonElement = document.getElementById("close-save-transfer");

        pauseButtonElement.addEventListener("click", function () {
            // GameState 当前运行时状态：按钮执行时读取，避免加载后操作旧状态。
            var currentState = game.runtime.state;

            game.simulation.togglePause(currentState);
            game.render.renderApp(currentState);
        });

        saveButtonElement.addEventListener("click", function () {
            // GameState 当前运行时状态：用于保存最新存档对象。
            var currentState = game.runtime.state;

            game.save.saveToLocalStorage(currentState);
            game.simulation.addLog(currentState, "normal", game.text.TEXT_REGISTRY.logs.saved);
            game.render.renderApp(currentState);
        });

        loadButtonElement.addEventListener("click", function () {
            // GameState 当前运行时状态：加载失败时写入警告日志。
            var currentState = game.runtime.state;

            // string|null 原始存档文本：从浏览器本地存储读取。
            var rawSaveText = game.save.loadRawFromLocalStorage();

            if (!rawSaveText) {
                game.simulation.addLog(currentState, "warning", game.text.TEXT_REGISTRY.logs.noLocalSave);
                game.render.renderApp(currentState);
                return;
            }

            try {
                // GameState 恢复状态：由存档文本解析并迁移得到。
                var restoredState = game.save.loadFromText(rawSaveText);

                game.captivesSystem.syncCaptiveResource(restoredState);
                game.unlocks.applyPopulationUnlocks(restoredState);
                game.runtime.state = restoredState;
                game.simulation.addLog(restoredState, "normal", game.text.TEXT_REGISTRY.logs.loaded);
                game.render.renderApp(restoredState);
            } catch (error) {
                game.simulation.addLog(currentState, "warning", game.text.TEXT_REGISTRY.ui.corruptedSave + error.message);
                game.render.renderApp(currentState);
            }
        });

        resetButtonElement.addEventListener("click", resetSaveAndRestart);

        exportButtonElement.addEventListener("click", function () {
            // GameState 当前运行时状态：用于导出最新存档对象。
            var currentState = game.runtime.state;

            // string 导出存档文本：可复制到导入框恢复同一状态。
            var exportedSaveText = game.save.exportToText(currentState);

            showSaveTransferPanel(saveTransferPanelElement, saveTransferTextElement, exportedSaveText, game.text.TEXT_REGISTRY.ui.exportInlineHint);
            game.simulation.addLog(currentState, "normal", game.text.TEXT_REGISTRY.logs.exportedToPanel);
            game.render.renderApp(currentState);
        });

        importButtonElement.addEventListener("click", function () {
            // GameState 当前运行时状态：用于记录导入面板打开日志。
            var currentState = game.runtime.state;

            showSaveTransferPanel(saveTransferPanelElement, saveTransferTextElement, "", game.text.TEXT_REGISTRY.ui.importInlineHint);
            game.simulation.addLog(currentState, "normal", game.text.TEXT_REGISTRY.logs.importPanelOpened);
            game.render.renderApp(currentState);
        });

        tutorialButtonElement.addEventListener("click", function () {
            // GameState 当前运行时状态：顶部导航打开教程时暂停游戏并写入活动标签 ID。
            var currentState = game.runtime.state;

            if (!currentState.isPaused) {
                game.simulation.togglePause(currentState);
            }

            currentState.activeTabId = "tutorial";
            game.render.renderApp(currentState, true);
        });

        applyImportButtonElement.addEventListener("click", function () {
            // GameState 当前运行时状态：导入失败时写入警告日志。
            var currentState = game.runtime.state;

            // string 导入存档文本：由玩家粘贴到内嵌文本框的 JSON 文本。
            var importedSaveText = saveTransferTextElement.value.trim();

            if (!importedSaveText) {
                game.simulation.addLog(currentState, "warning", game.text.TEXT_REGISTRY.ui.importEmpty);
                game.render.renderApp(currentState);
                return;
            }

            try {
                // GameState 导入状态：由输入文本解析并迁移得到。
                var importedState = game.save.loadFromText(importedSaveText);

                game.captivesSystem.syncCaptiveResource(importedState);
                game.unlocks.applyPopulationUnlocks(importedState);
                game.runtime.state = importedState;
                saveTransferPanelElement.hidden = true;
                game.simulation.addLog(importedState, "normal", game.text.TEXT_REGISTRY.logs.imported);
                game.render.renderApp(importedState);
            } catch (error) {
                game.simulation.addLog(currentState, "warning", game.text.TEXT_REGISTRY.ui.importFailed + error.message);
                game.render.renderApp(currentState);
            }
        });

        closeSaveTransferButtonElement.addEventListener("click", function () {
            // GameState 当前运行时状态：收起面板后刷新界面保持日志同步。
            var currentState = game.runtime.state;

            saveTransferPanelElement.hidden = true;
            game.render.renderApp(currentState);
        });
    }

    /**
     * 重置本地存档并替换为全新的运行时状态。
     *
     * @returns {void} 无返回值。
     */
    function resetSaveAndRestart() {
        game.save.clearLocalStorageSave();

        // GameState 新建状态：清空旧进度后从初始地穴重新开始。
        var newState = game.initialState.createInitialState();

        game.captivesSystem.syncCaptiveResource(newState);
        game.runtime.state = newState;
        game.simulation.addLog(newState, "important", game.text.TEXT_REGISTRY.logs.reset);
        game.render.renderApp(newState, true);
    }

    /**
     * 显示内嵌存档文本面板。
     *
     * @param {HTMLElement} panelElement - 存档文本面板元素，会被显示。
     * @param {HTMLTextAreaElement} textElement - 存档文本输入框，会写入文本和提示。
     * @param {string} saveText - 要显示的存档文本；导入模式可传空字符串。
     * @param {string} placeholderText - 输入框提示文本，用于说明当前导入或导出意图。
     * @returns {void} 无返回值。
     */
    function showSaveTransferPanel(panelElement, textElement, saveText, placeholderText) {
        panelElement.hidden = false;
        textElement.value = saveText;
        textElement.placeholder = placeholderText;
        textElement.focus();
        textElement.select();
    }

    /**
     * 绑定标签页切换事件。
     *
     * @returns {void} 无返回值。
     */
    function bindTabEvents() {
        // HTMLElement 标签按钮容器：使用事件委托处理标签切换。
        var tabListElement = document.getElementById("tab-list");

        tabListElement.addEventListener("click", function (event) {
            // HTMLElement|null 点击目标：可能是标签按钮或其子元素。
            var targetElement = event.target;

            if (!targetElement || !targetElement.dataset || !targetElement.dataset.tabId) {
                return;
            }

            // GameState 当前运行时状态：标签切换写入最新状态对象。
            var currentState = game.runtime.state;

            currentState.activeTabId = targetElement.dataset.tabId;
            game.render.renderApp(currentState);
        });
    }

    /**
     * 绑定地穴内容按钮事件。
     *
     * @returns {void} 无返回值。
     */
    function bindContentEvents() {
        // HTMLElement 标签页内容容器：使用事件委托处理采集和建筑按钮。
        var tabContentElement = document.getElementById("tab-content");

        tabContentElement.addEventListener("click", function (event) {
            // HTMLElement|null 点击目标：可能是采集按钮、建筑按钮或其他元素。
            var targetElement = event.target;

            if (!targetElement || !targetElement.dataset) {
                return;
            }

            // GameState 当前运行时状态：按钮执行时读取最新状态对象。
            var currentState = game.runtime.state;

            if (targetElement.dataset.actionId) {
                if (game.challengesSystem && game.challengesSystem.isRunModeSelectionOpen(currentState)) {
                    game.challengesSystem.selectNormalModeForNewRun(currentState);
                }

                game.resources.applyManualAction(currentState, targetElement.dataset.actionId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.normalRunMode) {
                game.challengesSystem.selectNormalModeForNewRun(currentState);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.challengeId) {
                game.challengesSystem.selectChallengeForNewRun(currentState, targetElement.dataset.challengeId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.buildingId) {
                game.buildings.buyBuilding(currentState, targetElement.dataset.buildingId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.buildingDestroyId) {
                game.buildings.destroyBuilding(currentState, targetElement.dataset.buildingDestroyId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.jobId && targetElement.dataset.jobAction) {
                applyJobButtonAction(currentState, targetElement.dataset.jobId, targetElement.dataset.jobAction);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.jobPreset) {
                if (targetElement.dataset.jobPreset === "clear_all") {
                    clearAllUnpinnedJobs(currentState);
                } else {
                    game.jobs.applyJobPreset(currentState, targetElement.dataset.jobPreset);
                }
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.technologyId) {
                game.technology.researchTechnology(currentState, targetElement.dataset.technologyId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.researchFilter) {
                game.runtime.researchFilter = targetElement.dataset.researchFilter;
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.researchSort) {
                game.runtime.researchSort = targetElement.dataset.researchSort;
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.goblinId && targetElement.dataset.goblinAction) {
                applyGoblinButtonAction(currentState, targetElement.dataset.goblinId, targetElement.dataset.goblinAction);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.recipeId && targetElement.dataset.craftCount) {
                applyCraftButtonAction(currentState, targetElement.dataset.recipeId, targetElement.dataset.craftCount);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.autoCraftRecipeId) {
                game.crafting.selectAutoCraftRecipe(currentState, targetElement.dataset.autoCraftRecipeId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.captiveId && targetElement.dataset.captiveDisposition) {
                game.captivesSystem.applyDisposition(currentState, targetElement.dataset.captiveId, targetElement.dataset.captiveDisposition);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.captiveAutoBrainwashId) {
                game.captivesSystem.toggleAutoBrainwash(currentState, targetElement.dataset.captiveAutoBrainwashId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.captiveAutoBreedId) {
                game.captivesSystem.toggleAutoBreed(currentState, targetElement.dataset.captiveAutoBreedId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.warbeastId && targetElement.dataset.warbeastDisposition) {
                game.warbeastsSystem.applyDisposition(currentState, targetElement.dataset.warbeastId, targetElement.dataset.warbeastDisposition);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.diplomacySubtab) {
                game.runtime.activeDiplomacySubtab = targetElement.dataset.diplomacySubtab;
                renderAfterDiplomacyViewChange(currentState);
                return;
            }

            if (targetElement.dataset.diplomacyWorldSubtab && targetElement.dataset.diplomacyMode) {
                game.runtime.activeDiplomacyWorldByModeId[targetElement.dataset.diplomacyMode] = targetElement.dataset.diplomacyWorldSubtab;
                renderAfterDiplomacyViewChange(currentState);
                return;
            }

            if (targetElement.dataset.diplomacyFactionSubtab && targetElement.dataset.diplomacyMode && targetElement.dataset.diplomacyWorldId) {
                game.runtime.activeDiplomacyFactionByScopeId[targetElement.dataset.diplomacyMode + "_" + targetElement.dataset.diplomacyWorldId] = targetElement.dataset.diplomacyFactionSubtab;
                renderAfterDiplomacyViewChange(currentState);
                return;
            }

            if (targetElement.dataset.raidMemberTargetId && targetElement.dataset.raidMemberAction) {
                applyRaidMemberButtonAction(currentState, targetElement.dataset.raidMemberTargetId, targetElement.dataset.raidMemberAction);
                renderAfterDiplomacyViewChange(currentState);
                return;
            }

            if (targetElement.dataset.tradeFactionId) {
                game.diplomacy.executeTrade(currentState, targetElement.dataset.tradeFactionId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.raidTargetId) {
                // number 派出人数：从当前掠夺地点行按钮控件读取的正整数。
                var raidMemberCount = getRaidMemberCountFromButton(currentState, targetElement);

                // string|null 随队战兽 ID：从地点行选择器读取；空值表示本次不派战兽。
                var raidWarbeastId = getRaidWarbeastIdFromButton(targetElement);

                game.raids.executeRaid(currentState, targetElement.dataset.raidTargetId, raidMemberCount, raidWarbeastId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.policyId) {
                game.policiesSystem.selectPolicy(currentState, targetElement.dataset.policyId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.ritualUpgradeId) {
                game.rituals.buyRitualUpgrade(currentState, targetElement.dataset.ritualUpgradeId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.sacrificeId) {
                game.rituals.executeSacrifice(currentState, targetElement.dataset.sacrificeId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.pactId) {
                game.pacts.togglePact(currentState, targetElement.dataset.pactId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.expeditionRouteId) {
                game.expeditions.startExpedition(currentState, targetElement.dataset.expeditionRouteId);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.empireMigration) {
                game.prestigeSystem.executeMigration(currentState, true);
                renderAfterStateChange(currentState);
                return;
            }

            if (targetElement.dataset.prestigePerkId) {
                game.prestigeSystem.purchasePrestigePerk(currentState, targetElement.dataset.prestigePerkId);
                renderAfterStateChange(currentState);
            }
        });

        tabContentElement.addEventListener("change", function (event) {
            // HTMLSelectElement|null 变化目标：这里只处理掠夺随队战兽选择器。
            var targetElement = event.target;

            if (!targetElement || !targetElement.dataset || !targetElement.dataset.raidWarbeastTargetId) {
                return;
            }

            if (!game.runtime.raidWarbeastByTargetId) {
                game.runtime.raidWarbeastByTargetId = {};
            }

            game.runtime.raidWarbeastByTargetId[targetElement.dataset.raidWarbeastTargetId] = targetElement.value || null;
            renderAfterDiplomacyViewChange(game.runtime.state);
        });

        tabContentElement.addEventListener("input", function (event) {
            // HTMLElement|null 输入目标：可能是人口普查筛选框。
            var targetElement = event.target;

            if (!targetElement || !targetElement.dataset) {
                return;
            }

            if (!targetElement.dataset.censusFilterKey) {
                return;
            }

            if (!game.runtime.censusFilters) {
                game.runtime.censusFilters = {
                    job: "",
                    trait: "",
                    wound: ""
                };
            }

            game.runtime.censusFilters[targetElement.dataset.censusFilterKey] = targetElement.value;
            game.render.renderApp(game.runtime.state);
        });
    }

    /**
     * 从掠夺按钮所在地点行读取随队战兽 ID。
     *
     * @param {HTMLElement} buttonElement - 被点击的掠夺按钮元素。
     * @returns {string|null} 随队战兽稳定 ID；未选择时返回 null。
     */
    function getRaidWarbeastIdFromButton(buttonElement) {
        // HTMLElement|null 地点行元素：限制查询范围到当前掠夺目标。
        var rowElement = buttonElement.closest("[data-raid-member-count]");

        // HTMLSelectElement|null 战兽选择器：当前地点行内至多一个。
        var selectElement = rowElement ? rowElement.querySelector("[data-raid-warbeast-target-id]") : null;

        return selectElement && selectElement.value ? selectElement.value : null;
    }

    /**
     * 在玩家操作后统一检查灭亡并刷新界面。
     *
     * @param {GameState} state - 当前游戏状态对象，灭亡时会回到初始状态。
     * @returns {void} 无返回值。
     */
    function renderAfterStateChange(state) {
        game.simulation.resolveExtinctionIfNeeded(state);
        game.render.renderApp(state, true);
    }

    /**
     * 外交页纯界面状态变化后刷新，避免重建资源栏、状态栏和日志栏。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @returns {void} 无返回值。
     */
    function renderAfterDiplomacyViewChange(state) {
        if (game.render.renderDiplomacyTabOnly(state)) {
            return;
        }

        game.render.renderApp(state);
    }

    /**
     * 绑定交互按压状态，供自动渲染判断是否需要暂时保留 DOM。
     *
     * @returns {void} 无返回值。
     */
    function bindInteractivePointerEvents() {
        // HTMLElement 标签页内容容器：按钮、搜索框和卡片操作的主要交互区域。
        var tabContentElement = document.getElementById("tab-content");

        // HTMLElement 标签页按钮容器：承载标签切换按钮。
        var tabListElement = document.getElementById("tab-list");

        tabContentElement.addEventListener("pointerdown", rememberPointerDownElement);
        tabListElement.addEventListener("pointerdown", rememberPointerDownElement);
        document.addEventListener("pointerup", clearPointerDownElement);
        document.addEventListener("pointercancel", clearPointerDownElement);
    }

    /**
     * 绑定建筑悬浮框定位事件。
     *
     * @returns {void} 无返回值。
     */
    function bindBuildingTooltipEvents() {
        // HTMLElement 标签页内容容器：使用事件委托处理动态生成的建筑行。
        var tabContentElement = document.getElementById("tab-content");

        tabContentElement.addEventListener("pointerover", updateBuildingTooltipFromPointer);
        tabContentElement.addEventListener("pointermove", updateBuildingTooltipFromPointer);
        tabContentElement.addEventListener("pointerout", hideBuildingTooltipFromPointer);
        tabContentElement.addEventListener("focusin", updateBuildingTooltipFromFocus);
        tabContentElement.addEventListener("focusout", hideBuildingTooltipFromFocus);
        window.addEventListener("scroll", hideAllBuildingTooltips, true);
        window.addEventListener("resize", hideAllBuildingTooltips);
    }

    /**
     * 绑定资源悬浮框定位事件。
     *
     * @returns {void} 无返回值。
     */
    function bindResourceTooltipEvents() {
        // HTMLElement 资源列表容器：使用事件委托处理动态生成的资源行。
        var resourceListElement = document.getElementById("resource-list");

        // HTMLElement 标签页内容容器：使用事件委托处理动态生成的俘虏行。
        var tabContentElement = document.getElementById("tab-content");

        resourceListElement.addEventListener("pointerover", updateResourceTooltipFromPointer);
        resourceListElement.addEventListener("pointermove", updateResourceTooltipFromPointer);
        resourceListElement.addEventListener("pointerout", hideResourceTooltipFromPointer);
        resourceListElement.addEventListener("focusin", updateResourceTooltipFromFocus);
        resourceListElement.addEventListener("focusout", hideResourceTooltipFromFocus);
        tabContentElement.addEventListener("pointerover", updateResourceTooltipFromPointer);
        tabContentElement.addEventListener("pointermove", updateResourceTooltipFromPointer);
        tabContentElement.addEventListener("pointerout", hideResourceTooltipFromPointer);
        tabContentElement.addEventListener("focusin", updateResourceTooltipFromFocus);
        tabContentElement.addEventListener("focusout", hideResourceTooltipFromFocus);
        window.addEventListener("scroll", hideAllResourceTooltips, true);
        window.addEventListener("resize", hideAllResourceTooltips);
    }

    /**
     * 根据鼠标位置更新建筑悬浮框位置，底部空间不足时显示在鼠标上方。
     *
     * @param {PointerEvent} event - 指针事件；clientX/clientY 为视口内鼠标坐标。
     * @returns {void} 无返回值。
     */
    function updateBuildingTooltipFromPointer(event) {
        // HTMLElement|null 建筑行元素：从事件目标向上查找整行触发区。
        var rowElement = getBuildingTooltipRow(event.target);

        if (!rowElement) {
            return;
        }

        // HTMLElement|null 悬浮框元素：建筑行内承载建筑详情的节点。
        var tooltipElement = rowElement.querySelector(".building-tooltip");

        if (!tooltipElement) {
            return;
        }

        showBuildingTooltip(tooltipElement);
        placeBuildingTooltip(tooltipElement, event.clientX, event.clientY);
    }

    /**
     * 根据鼠标位置更新资源悬浮框位置，视口空间不足时自动向上或向左收束。
     *
     * @param {PointerEvent} event - 指针事件；clientX/clientY 为视口内鼠标坐标。
     * @returns {void} 无返回值。
     */
    function updateResourceTooltipFromPointer(event) {
        // HTMLElement|null 资源行元素：从事件目标向上查找整行触发区。
        var rowElement = getResourceTooltipRow(event.target);

        if (!rowElement) {
            return;
        }

        // HTMLElement|null 悬浮框元素：资源行内承载资源详情的节点。
        var tooltipElement = rowElement.querySelector(".resource-tooltip");

        if (!tooltipElement) {
            return;
        }

        showInterfaceTooltip(tooltipElement);
        placeInterfaceTooltip(tooltipElement, event.clientX, event.clientY);
    }

    /**
     * 鼠标离开建筑行时隐藏对应建筑悬浮框。
     *
     * @param {PointerEvent} event - 指针离开事件；relatedTarget 为新的悬停目标。
     * @returns {void} 无返回值。
     */
    function hideBuildingTooltipFromPointer(event) {
        // HTMLElement|null 建筑行元素：从离开目标查找原建筑行。
        var rowElement = getBuildingTooltipRow(event.target);

        if (!rowElement || rowElement.contains(event.relatedTarget)) {
            return;
        }

        hideBuildingTooltip(rowElement);
    }

    /**
     * 鼠标离开资源行时隐藏对应资源悬浮框。
     *
     * @param {PointerEvent} event - 指针离开事件；relatedTarget 为新的悬停目标。
     * @returns {void} 无返回值。
     */
    function hideResourceTooltipFromPointer(event) {
        // HTMLElement|null 资源行元素：从离开目标查找原资源行。
        var rowElement = getResourceTooltipRow(event.target);

        if (!rowElement || rowElement.contains(event.relatedTarget)) {
            return;
        }

        hideResourceTooltip(rowElement);
    }

    /**
     * 键盘聚焦建筑行时更新建筑悬浮框位置，底部空间不足时显示在行上方。
     *
     * @param {FocusEvent} event - 聚焦事件；target 为当前获得焦点的元素。
     * @returns {void} 无返回值。
     */
    function updateBuildingTooltipFromFocus(event) {
        // HTMLElement|null 建筑行元素：从聚焦目标向上查找整行触发区。
        var rowElement = getBuildingTooltipRow(event.target);

        if (!rowElement) {
            return;
        }

        // HTMLElement|null 悬浮框元素：建筑行内承载建筑详情的节点。
        var tooltipElement = rowElement.querySelector(".building-tooltip");

        if (!tooltipElement) {
            return;
        }

        // DOMRect 行边界：用于键盘聚焦时把浮窗锚定到行左下角。
        var rowRect = rowElement.getBoundingClientRect();

        showBuildingTooltip(tooltipElement);
        placeBuildingTooltip(tooltipElement, rowRect.left + 10, rowRect.bottom);
    }

    /**
     * 键盘聚焦资源行时更新资源悬浮框位置，底部空间不足时显示在行上方。
     *
     * @param {FocusEvent} event - 聚焦事件；target 为当前获得焦点的元素。
     * @returns {void} 无返回值。
     */
    function updateResourceTooltipFromFocus(event) {
        // HTMLElement|null 资源行元素：从聚焦目标向上查找整行触发区。
        var rowElement = getResourceTooltipRow(event.target);

        if (!rowElement) {
            return;
        }

        // HTMLElement|null 悬浮框元素：资源行内承载资源详情的节点。
        var tooltipElement = rowElement.querySelector(".resource-tooltip");

        if (!tooltipElement) {
            return;
        }

        // DOMRect 行边界：用于键盘聚焦时把浮窗锚定到资源行右侧。
        var rowRect = rowElement.getBoundingClientRect();

        showInterfaceTooltip(tooltipElement);
        placeInterfaceTooltip(tooltipElement, rowRect.right, rowRect.top);
    }

    /**
     * 焦点离开建筑行时隐藏对应建筑悬浮框。
     *
     * @param {FocusEvent} event - 失焦事件；relatedTarget 为新的聚焦目标。
     * @returns {void} 无返回值。
     */
    function hideBuildingTooltipFromFocus(event) {
        // HTMLElement|null 建筑行元素：从失焦目标查找原建筑行。
        var rowElement = getBuildingTooltipRow(event.target);

        if (!rowElement || rowElement.contains(event.relatedTarget)) {
            return;
        }

        hideBuildingTooltip(rowElement);
    }

    /**
     * 焦点离开资源行时隐藏对应资源悬浮框。
     *
     * @param {FocusEvent} event - 失焦事件；relatedTarget 为新的聚焦目标。
     * @returns {void} 无返回值。
     */
    function hideResourceTooltipFromFocus(event) {
        // HTMLElement|null 资源行元素：从失焦目标查找原资源行。
        var rowElement = getResourceTooltipRow(event.target);

        if (!rowElement || rowElement.contains(event.relatedTarget)) {
            return;
        }

        hideResourceTooltip(rowElement);
    }

    /**
     * 从事件目标查找建筑行元素。
     *
     * @param {EventTarget|null} targetElement - 事件目标，可能不是 HTMLElement。
     * @returns {HTMLElement|null} 建筑行元素；不存在时返回 null。
     */
    function getBuildingTooltipRow(targetElement) {
        if (!targetElement || !targetElement.closest) {
            return null;
        }

        return targetElement.closest(".building-row");
    }

    /**
     * 从事件目标查找资源行元素。
     *
     * @param {EventTarget|null} targetElement - 事件目标，可能不是 HTMLElement。
     * @returns {HTMLElement|null} 资源行元素；不存在时返回 null。
     */
    function getResourceTooltipRow(targetElement) {
        if (!targetElement || !targetElement.closest) {
            return null;
        }

        return targetElement.closest(".resource-row, .captive-row");
    }

    /**
     * 显示建筑悬浮框并先移出可视区，便于测量实际尺寸。
     *
     * @param {HTMLElement} tooltipElement - 建筑悬浮框元素，会被直接修改 class 和 style。
     * @returns {void} 无返回值。
     */
    function showBuildingTooltip(tooltipElement) {
        showInterfaceTooltip(tooltipElement);
    }

    /**
     * 显示通用界面悬浮框并先移出可视区，便于测量实际尺寸。
     *
     * @param {HTMLElement} tooltipElement - 悬浮框元素，会被直接修改 class 和 style。
     * @returns {void} 无返回值。
     */
    function showInterfaceTooltip(tooltipElement) {
        tooltipElement.classList.add("is-tooltip-active");
        tooltipElement.style.left = "-9999px";
        tooltipElement.style.top = "-9999px";
    }

    /**
     * 按视口边界放置建筑悬浮框；下方放不下时翻到锚点上方。
     *
     * @param {HTMLElement} tooltipElement - 建筑悬浮框元素，会被直接写入 fixed 坐标。
     * @param {number} anchorX - 锚点视口横坐标，CSS 像素。
     * @param {number} anchorY - 锚点视口纵坐标，CSS 像素。
     * @returns {void} 无返回值。
     */
    function placeBuildingTooltip(tooltipElement, anchorX, anchorY) {
        placeInterfaceTooltip(tooltipElement, anchorX, anchorY);
    }

    /**
     * 按视口边界放置通用界面悬浮框；下方放不下时翻到锚点上方。
     *
     * @param {HTMLElement} tooltipElement - 悬浮框元素，会被直接写入 fixed 坐标。
     * @param {number} anchorX - 锚点视口横坐标，CSS 像素。
     * @param {number} anchorY - 锚点视口纵坐标，CSS 像素。
     * @returns {void} 无返回值。
     */
    function placeInterfaceTooltip(tooltipElement, anchorX, anchorY) {
        // number 浮窗边距：浮窗与鼠标、视口边缘保持的 CSS 像素距离。
        var tooltipGap = 10;

        // DOMRect 浮窗边界：显示后测量出的实际尺寸。
        var tooltipRect = tooltipElement.getBoundingClientRect();

        // number 视口宽度：当前浏览器可见区域宽度，CSS 像素。
        var viewportWidth = window.innerWidth || document.documentElement.clientWidth;

        // number 视口高度：当前浏览器可见区域高度，CSS 像素。
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        // number 横坐标：优先放在锚点右侧，超出右边界时向左收束。
        var leftPosition = Math.min(anchorX + tooltipGap, viewportWidth - tooltipRect.width - tooltipGap);

        // number 纵坐标：默认放在锚点下方，空间不足时改放上方。
        var topPosition = anchorY + tooltipGap;

        if (topPosition + tooltipRect.height + tooltipGap > viewportHeight) {
            topPosition = anchorY - tooltipRect.height - tooltipGap;
        }

        tooltipElement.style.left = Math.max(tooltipGap, leftPosition) + "px";
        tooltipElement.style.top = Math.max(tooltipGap, topPosition) + "px";
    }

    /**
     * 隐藏单个建筑行内的悬浮框。
     *
     * @param {HTMLElement} rowElement - 建筑行元素，用于查找内部悬浮框。
     * @returns {void} 无返回值。
     */
    function hideBuildingTooltip(rowElement) {
        // HTMLElement|null 悬浮框元素：建筑行内承载建筑详情的节点。
        var tooltipElement = rowElement.querySelector(".building-tooltip");

        if (!tooltipElement) {
            return;
        }

        tooltipElement.classList.remove("is-tooltip-active");
        tooltipElement.removeAttribute("style");
    }

    /**
     * 隐藏单个资源行内的悬浮框。
     *
     * @param {HTMLElement} rowElement - 资源行元素，用于查找内部悬浮框。
     * @returns {void} 无返回值。
     */
    function hideResourceTooltip(rowElement) {
        // HTMLElement|null 悬浮框元素：资源行内承载资源详情的节点。
        var tooltipElement = rowElement.querySelector(".resource-tooltip");

        if (!tooltipElement) {
            return;
        }

        tooltipElement.classList.remove("is-tooltip-active");
        tooltipElement.removeAttribute("style");
    }

    /**
     * 隐藏当前页面全部建筑悬浮框。
     *
     * @returns {void} 无返回值。
     */
    function hideAllBuildingTooltips() {
        // NodeListOf<HTMLElement> 悬浮框列表：当前 DOM 中所有建筑悬浮框。
        var tooltipElements = document.querySelectorAll(".building-tooltip");

        // number 循环索引：遍历建筑悬浮框列表的整数下标。
        for (var tooltipIndex = 0; tooltipIndex < tooltipElements.length; tooltipIndex += 1) {
            // HTMLElement 悬浮框元素：本轮需要隐藏的建筑详情框。
            var tooltipElement = tooltipElements[tooltipIndex];

            tooltipElement.classList.remove("is-tooltip-active");
            tooltipElement.removeAttribute("style");
        }
    }

    /**
     * 隐藏当前页面全部资源悬浮框。
     *
     * @returns {void} 无返回值。
     */
    function hideAllResourceTooltips() {
        // NodeListOf<HTMLElement> 悬浮框列表：当前 DOM 中所有资源悬浮框。
        var tooltipElements = document.querySelectorAll(".resource-tooltip");

        // number 循环索引：遍历资源悬浮框列表的整数下标。
        for (var tooltipIndex = 0; tooltipIndex < tooltipElements.length; tooltipIndex += 1) {
            // HTMLElement 悬浮框元素：本轮需要隐藏的资源详情框。
            var tooltipElement = tooltipElements[tooltipIndex];

            tooltipElement.classList.remove("is-tooltip-active");
            tooltipElement.removeAttribute("style");
        }
    }

    /**
     * 记录本次按压起点，避免自动刷新在 click 派发前替换目标按钮。
     *
     * @param {PointerEvent} event - 浏览器指针按下事件，target 为按压起点元素。
     * @returns {void} 无返回值。
     */
    function rememberPointerDownElement(event) {
        if (!game.runtime) {
            return;
        }

        // EventTarget|null 按压目标：保存到运行时供渲染保护使用。
        var pointerDownElement = event.target;

        game.runtime.isPointerPressingInteractiveDom = true;
        game.runtime.pointerDownElement = pointerDownElement;
    }

    /**
     * 清除按压状态，让下一次自动刷新可以正常重建内容区。
     *
     * @returns {void} 无返回值。
     */
    function clearPointerDownElement() {
        if (!game.runtime) {
            return;
        }

        window.setTimeout(clearPointerDownElementNow, 80);
    }

    /**
     * 立即清除按压状态；由延迟清理调用，保证 click 事件先完成派发。
     *
     * @returns {void} 无返回值。
     */
    function clearPointerDownElementNow() {
        if (!game.runtime) {
            return;
        }

        game.runtime.isPointerPressingInteractiveDom = false;
        game.runtime.pointerDownElement = null;
    }

    /**
     * 执行制作按钮操作。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} recipeId - 配方稳定 ID。
     * @param {string} rawCraftCount - 制作次数文本；"all" 表示全部。
     * @returns {void} 无返回值。
     */
    function applyCraftButtonAction(state, recipeId, rawCraftCount) {
        // number|string 制作次数：数字按钮转为整数，全部按钮保持 "all"。
        var craftCount = rawCraftCount === "all" ? "all" : Number(rawCraftCount);

        game.crafting.craftRecipe(state, recipeId, craftCount);
    }

    /**
     * 从掠夺按钮所在地点行读取玩家选择的派出人数。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {HTMLElement} buttonElement - 被点击的掠夺按钮元素。
     * @returns {number} 派出人数，正整数；缺失或非法时返回 1。
     */
    function getRaidMemberCountFromButton(state, buttonElement) {
        // HTMLElement|null 行元素：用于限制查询范围到当前掠夺地点行，兼容旧卡片结构。
        var rowElement = buttonElement.closest(".location-row") || buttonElement.closest(".action-card");

        if (rowElement && rowElement.dataset.raidMemberCount) {
            // number 行内派出人数：由渲染层写入，代表当前按钮选择结果。
            var rowRaidMemberCount = Number(rowElement.dataset.raidMemberCount);

            if (Number.isFinite(rowRaidMemberCount) && rowRaidMemberCount > 0) {
                return Math.floor(rowRaidMemberCount);
            }
        }

        // RaidTargetDefinition|null 掠夺目标定义：作为缺省派出人数来源。
        var targetDefinition = game.raids.getRaidTargetDefinition(buttonElement.dataset.raidTargetId);

        if (!targetDefinition) {
            return 1;
        }

        // Object.<string, number> 掠夺派出人数缓存：key 为目标 ID，value 为按钮选择人数。
        var raidMemberCountsByTargetId = game.runtime && game.runtime.raidMemberCountsByTargetId ? game.runtime.raidMemberCountsByTargetId : {};

        // number 缓存派出人数：缺失时回退到目标最低人数。
        var cachedRaidMemberCount = raidMemberCountsByTargetId[targetDefinition.id] || targetDefinition.minRaiders;

        // Object 掠夺预览：用于读取当前可派出人数上限。
        var raidPreview = game.raids.previewRaid(state, targetDefinition.id, cachedRaidMemberCount);

        return Math.min(Math.max(cachedRaidMemberCount, targetDefinition.minRaiders), Math.max(raidPreview.availableRaiderCount, targetDefinition.minRaiders));
    }

    /**
     * 执行掠夺派出人数按钮操作。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} targetId - 掠夺目标稳定 ID。
     * @param {string} actionId - 派出人数操作 ID；remove、add 或 max。
     * @returns {void} 无返回值。
     */
    function applyRaidMemberButtonAction(state, targetId, actionId) {
        if (!game.runtime.raidMemberCountsByTargetId) {
            game.runtime.raidMemberCountsByTargetId = {};
        }

        // RaidTargetDefinition|null 掠夺目标定义：用于读取最低派出人数。
        var targetDefinition = game.raids.getRaidTargetDefinition(targetId);

        if (!targetDefinition) {
            return;
        }

        // number 当前缓存派出人数：缺省按目标最低人数。
        var currentRaidMemberCount = game.runtime.raidMemberCountsByTargetId[targetId] || targetDefinition.minRaiders;

        // Object 掠夺预览：用于读取当前可派出人数上限。
        var raidPreview = game.raids.previewRaid(state, targetId, currentRaidMemberCount);

        // number 最大派出人数：不能低于目标最低人数，避免不可达目标显示 0。
        var maxRaidMemberCount = Math.max(targetDefinition.minRaiders, raidPreview.availableRaiderCount);

        if (actionId === "remove") {
            game.runtime.raidMemberCountsByTargetId[targetId] = Math.max(targetDefinition.minRaiders, currentRaidMemberCount - 1);
            return;
        }

        if (actionId === "add") {
            game.runtime.raidMemberCountsByTargetId[targetId] = Math.min(maxRaidMemberCount, currentRaidMemberCount + 1);
            return;
        }

        if (actionId === "max") {
            game.runtime.raidMemberCountsByTargetId[targetId] = maxRaidMemberCount;
        }
    }

    /**
     * 执行职业按钮操作。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {JobId} jobId - 职业稳定 ID。
     * @param {string} actionId - 职业操作 ID。
     * @returns {void} 无返回值。
     */
    function applyJobButtonAction(state, jobId, actionId) {
        if (actionId === "add") {
            game.jobs.assignWorker(state, jobId);
            return;
        }

        if (actionId === "remove") {
            game.jobs.unassignWorker(state, jobId);
            return;
        }

        if (actionId === "clear") {
            game.jobs.unassignAll(state, jobId);
            return;
        }

        if (actionId === "max") {
            game.jobs.assignMax(state, jobId);
        }
    }

    /**
     * 绑定日志过滤开关事件。
     *
     * @returns {void} 无返回值。
     */
    function bindLogFilterEvents() {
        // HTMLElement 右侧栏容器：使用事件委托处理日志过滤开关。
        var sidebarElement = document.querySelector(".sidebar-right");

        sidebarElement.addEventListener("change", function () {
            game.render.renderApp(game.runtime.state);
        });
    }

    /**
     * 执行哥布林按钮操作。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {string} goblinId - 哥布林稳定 ID。
     * @param {string} actionId - 哥布林操作 ID。
     * @returns {void} 无返回值。
     */
    function applyGoblinButtonAction(state, goblinId, actionId) {
        // Goblin|null 目标哥布林：根据稳定 ID 查找。
        var targetGoblin = findGoblinById(state, goblinId);

        if (!targetGoblin || state.isPaused) {
            return;
        }

        if (actionId === "unassign") {
            targetGoblin.jobId = undefined;
            return;
        }

        if (actionId === "pin") {
            targetGoblin.isPinned = !targetGoblin.isPinned;
            return;
        }

        if (actionId === "leader") {
            setLeaderGoblin(state, targetGoblin);
        }
    }

    /**
     * 清空所有未固定哥布林的职业。
     *
     * @param {GameState} state - 当前游戏状态对象，会修改未固定哥布林 jobId。
     * @returns {void} 无返回值。
     */
    function clearAllUnpinnedJobs(state) {
        if (state.isPaused) {
            return;
        }

        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于清空未固定职业。
            var goblin = state.goblins[goblinIndex];

            if (goblin.isAlive && !goblin.isPinned) {
                goblin.jobId = undefined;
            }
        }
    }

    /**
     * 按 ID 查找哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，不会被修改。
     * @param {string} goblinId - 哥布林稳定 ID。
     * @returns {Goblin|null} 找到的哥布林对象；不存在时返回 null。
     */
    function findGoblinById(state, goblinId) {
        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于匹配稳定 ID。
            var goblin = state.goblins[goblinIndex];

            if (goblin.id === goblinId) {
                return goblin;
            }
        }

        return null;
    }

    /**
     * 设置领袖哥布林。
     *
     * @param {GameState} state - 当前游戏状态对象，会被直接修改。
     * @param {Goblin} leaderGoblin - 新领袖哥布林对象，会设置 isLeader。
     * @returns {void} 无返回值。
     */
    function setLeaderGoblin(state, leaderGoblin) {
        // number 循环索引：遍历哥布林数组的整数下标。
        for (var goblinIndex = 0; goblinIndex < state.goblins.length; goblinIndex += 1) {
            // Goblin 当前哥布林对象：用于清理旧领袖标记。
            var goblin = state.goblins[goblinIndex];

            goblin.isLeader = false;
        }

        leaderGoblin.isLeader = true;
        state.leaderGoblinId = leaderGoblin.id;
    }

    /**
     * 绑定所有用户事件。
     *
     * @returns {void} 无返回值。
     */
    function bindAllEvents() {
        bindToolbarEvents();
        bindTabEvents();
        bindContentEvents();
        bindInteractivePointerEvents();
        bindBuildingTooltipEvents();
        bindResourceTooltipEvents();
        bindLogFilterEvents();
    }

    // Object 事件模块命名空间：提供全局事件绑定入口。
    game.events = {
        bindAllEvents: bindAllEvents
    };
})(window.GoblinEmpire);
