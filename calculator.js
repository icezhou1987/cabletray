const Calculator = (function() {
    const MATERIAL_DENSITY = {
        steel: 7.85,
        aluminum: 2.7,
        stainless: 7.9,
        plastic: 1.4
    };

    const MATERIAL_NAMES = {
        steel: '热镀锌钢',
        aluminum: '铝合金',
        stainless: '不锈钢',
        plastic: 'PVC'
    };

    const ELBOW_TYPES = {
        horizontal90: { name: '水平90°弯头', angle: 90, plane: 'horizontal' },
        horizontal45: { name: '水平45°弯头', angle: 45, plane: 'horizontal' },
        horizontal30: { name: '水平30°弯头', angle: 30, plane: 'horizontal' },
        vertical90up: { name: '垂直90°上弯', angle: 90, plane: 'vertical' },
        vertical90down: { name: '垂直90°下弯', angle: 90, plane: 'vertical' },
        vertical45up: { name: '垂直45°上弯', angle: 45, plane: 'vertical' },
        vertical45down: { name: '垂直45°下弯', angle: 45, plane: 'vertical' }
    };

    function calculateUnfoldLength(angle, bendRadius) {
        const angleRad = (angle * Math.PI) / 180;
        return angleRad * bendRadius;
    }

    function calculateCutPosition(width, bendRadius, angle) {
        const angleRad = (angle * Math.PI) / 180;
        const halfAngleRad = angleRad / 2;
        return width - (bendRadius * Math.tan(halfAngleRad));
    }

    function calculateArcLength(angle, bendRadius) {
        const angleRad = (angle * Math.PI) / 180;
        return angleRad * bendRadius;
    }

    function calculateCutAngle(angle) {
        return 90 - (angle / 2);
    }

    function estimateWeight(width, height, unfoldLength, thickness, material) {
        const volume = (width * 2 + height * 2 + unfoldLength) * thickness * 0.001;
        const density = MATERIAL_DENSITY[material] || 7.85;
        return (volume * density).toFixed(2);
    }

    function calculate(params) {
        const {
            elbowType,
            trayWidth,
            trayHeight,
            bendRadius,
            material,
            thickness
        } = params;

        const elbowInfo = ELBOW_TYPES[elbowType] || ELBOW_TYPES.horizontal90;
        const angle = elbowInfo.angle;

        const unfoldLength = calculateUnfoldLength(angle, bendRadius);
        const cutPosition = calculateCutPosition(trayWidth, bendRadius, angle);
        const arcLength = calculateArcLength(angle, bendRadius);
        const cutAngle = calculateCutAngle(angle);
        const weight = estimateWeight(trayWidth, trayHeight, unfoldLength, parseFloat(thickness), material);

        return {
            success: true,
            elbowType,
            elbowName: elbowInfo.name,
            plane: elbowInfo.plane,
            width: trayWidth,
            height: trayHeight,
            radius: bendRadius,
            angle,
            material: MATERIAL_NAMES[material] || material,
            thickness: parseFloat(thickness),
            unfoldLength: Math.round(unfoldLength * 100) / 100,
            cutPosition: Math.round(cutPosition * 100) / 100,
            arcLength: Math.round(arcLength * 100) / 100,
            cutAngle: Math.round(cutAngle * 100) / 100,
            weight,
            timestamp: Date.now()
        };
    }

    function recommendBendRadius(width) {
        return Math.round(width * 1.5 / 10) * 10;
    }

    function validateParams(params) {
        const errors = [];

        if (params.trayWidth < 50 || params.trayWidth > 1200) {
            errors.push('桥架宽度应在 50-1200mm 之间');
        }

        if (params.trayHeight < 50 || params.trayHeight > 400) {
            errors.push('桥架高度应在 50-400mm 之间');
        }

        if (params.bendRadius < 100 || params.bendRadius > 1000) {
            errors.push('弯曲半径应在 100-1000mm 之间');
        }

        if (params.bendRadius < params.trayWidth * 0.5) {
            errors.push('弯曲半径应不小于桥架宽度的50%');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    function formatResult(result) {
        const lines = [
            `═══════════════════════════════`,
            `      桥架弯头计算结果`,
            `═══════════════════════════════`,
            ``,
            `弯头类型: ${result.elbowName}`,
            `桥架规格: ${result.width}×${result.height}mm`,
            `弯曲半径: ${result.radius}mm`,
            `材质: ${result.material}`,
            `板材厚度: ${result.thickness}mm`,
            ``,
            `───────────────────────────────`,
            ``,
            `展开长度: ${result.unfoldLength} mm`,
            `切割位置: ${result.cutPosition} mm`,
            `中心弧长: ${result.arcLength} mm`,
            `切割角度: ${result.cutAngle}°`,
            ``,
            `───────────────────────────────`,
            ``,
            `估算重量: ${result.weight} kg`,
            ``,
            `═══════════════════════════════`,
            ``,
            `计算时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}`,
            ``
        ];

        return lines.join('\n');
    }

    return {
        calculate,
        validateParams,
        recommendBendRadius,
        formatResult,
        ELBOW_TYPES,
        MATERIAL_NAMES
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Calculator;
}
