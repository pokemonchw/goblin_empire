/* 价格模块：统一创建、校验和缩放 Price[]。 */
/**
 * 初始化价格模块。
 *
 * @param {Object} game - GoblinEmpire 命名空间对象，会挂载 pricing 模块。
 * @returns {void} 无返回值。
 */
(function (game) {
    /**
     * 创建单项价格。
     *
     * @param {ResourceId} resourceId - 资源稳定 ID，必须已登记到资源 ID 清单。
     * @param {number} amount - 资源数量，非负浮点数。
     * @returns {Price} 单项价格对象。
     * @throws {Error} 资源 ID 未登记或数量无效时抛出错误。
     */
    function createPrice(resourceId, amount) {
        if (!game.ids.isRegisteredId(game.ids.ID_REGISTRY.resources, resourceId)) {
            throw new Error("未登记的资源 ID：" + resourceId);
        }

        if (!isFinite(amount) || amount < 0) {
            throw new Error("价格数量必须是非负数。");
        }

        return {
            resource: resourceId,
            amount: amount
        };
    }

    /**
     * 校验价格数组是否符合统一结构。
     *
     * @param {Price[]} priceEntries - 价格数组；每项包含 resource 和 amount。
     * @returns {boolean} 是否有效；true 表示所有价格项都可用于结算。
     */
    function isValidPriceList(priceEntries) {
        if (!Array.isArray(priceEntries)) {
            return false;
        }

        // number 循环索引：遍历价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < priceEntries.length; priceIndex += 1) {
            // Price 当前价格项：用于校验资源 ID 和数量。
            var priceEntry = priceEntries[priceIndex];

            if (!priceEntry || !game.ids.isRegisteredId(game.ids.ID_REGISTRY.resources, priceEntry.resource)) {
                return false;
            }

            if (!isFinite(priceEntry.amount) || priceEntry.amount < 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * 按倍率缩放价格数组。
     *
     * @param {Price[]} basePrice - 基础价格数组；amount 为非负资源数量。
     * @param {number} ratio - 缩放倍率，非负浮点数。
     * @returns {Price[]} 缩放后的新价格数组，不修改输入。
     */
    function scalePrice(basePrice, ratio) {
        // Price[] 缩放后价格数组：用于建筑成本或制作倍率。
        var scaledPrice = [];

        // number 循环索引：遍历基础价格数组的整数下标。
        for (var priceIndex = 0; priceIndex < basePrice.length; priceIndex += 1) {
            // Price 当前基础价格项：用于计算缩放后的单项成本。
            var priceEntry = basePrice[priceIndex];

            scaledPrice.push({
                resource: priceEntry.resource,
                amount: priceEntry.amount * ratio
            });
        }

        return scaledPrice;
    }

    // Object 价格模块命名空间：提供统一 Price[] 操作。
    game.pricing = {
        createPrice: createPrice,
        isValidPriceList: isValidPriceList,
        scalePrice: scalePrice
    };
})(window.GoblinEmpire);
