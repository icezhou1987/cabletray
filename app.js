const App = (function() {
    let currentResult = null;
    let history = [];
    const STORAGE_KEY = 'cableTrayHistory';

    function init() {
        loadHistory();
        setupEventListeners();
        setupPWA();
        init3DViewer();
        setupRangeSync();
        updateHistoryUI();
        
        setTimeout(() => {
            calculate();
        }, 500);
    }

    function setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', handleTabClick);
        });

        document.getElementById('calculateBtn').addEventListener('click', calculate);
        document.getElementById('resetBtn').addEventListener('click', resetForm);
        document.getElementById('copyResult').addEventListener('click', copyResult);
        document.getElementById('saveHistory').addEventListener('click', saveToHistory);
        document.getElementById('clearHistory').addEventListener('click', clearHistory);
        document.getElementById('toggleRotate').addEventListener('click', toggleRotate);
        document.getElementById('resetView').addEventListener('click', reset3DView);
    }

    function setupRangeSync() {
        const widthInput = document.getElementById('trayWidth');
        const widthRange = document.getElementById('trayWidthRange');
        const heightInput = document.getElementById('trayHeight');
        const heightRange = document.getElementById('trayHeightRange');

        widthInput.addEventListener('input', (e) => {
            widthRange.value = e.target.value;
            updateBendRadiusRecommendation();
        });

        widthRange.addEventListener('input', (e) => {
            widthInput.value = e.target.value;
            updateBendRadiusRecommendation();
        });

        heightInput.addEventListener('input', (e) => {
            heightRange.value = e.target.value;
        });

        heightRange.addEventListener('input', (e) => {
            heightInput.value = e.target.value;
        });
    }

    function updateBendRadiusRecommendation() {
        const width = parseInt(document.getElementById('trayWidth').value) || 200;
        const recommended = Calculator.recommendBendRadius(width);
        document.getElementById('bendRadius').value = recommended;
    }

    function handleTabClick(e) {
        const tabId = e.currentTarget.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.currentTarget.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');
    }

    function calculate() {
        const params = {
            elbowType: document.getElementById('elbowType').value,
            trayWidth: parseInt(document.getElementById('trayWidth').value),
            trayHeight: parseInt(document.getElementById('trayHeight').value),
            bendRadius: parseInt(document.getElementById('bendRadius').value),
            material: document.getElementById('material').value,
            thickness: document.getElementById('thickness').value
        };

        const validation = Calculator.validateParams(params);
        if (!validation.valid) {
            showToast(validation.errors.join('\n'), 'error');
            return;
        }

        currentResult = Calculator.calculate(params);
        
        updateResultsUI(currentResult);
        ThreeViewer.updateElbow(currentResult);
        
        document.getElementById('resultsSection').classList.add('visible');
        
        showToast('计算完成', 'success');
    }

    function updateResultsUI(result) {
        document.getElementById('unfoldLength').textContent = result.unfoldLength;
        document.getElementById('cutPosition').textContent = result.cutPosition;
        document.getElementById('arcLength').textContent = result.arcLength;
        document.getElementById('cutAngle').textContent = result.cutAngle;
        
        document.getElementById('detailAngle').textContent = result.angle + '°';
        document.getElementById('detailRadius').textContent = result.radius + ' mm';
        document.getElementById('detailSpec').textContent = result.width + '×' + result.height + ' mm';
        document.getElementById('detailMaterial').textContent = result.material;
        document.getElementById('detailThickness').textContent = result.thickness + ' mm';
        document.getElementById('detailWeight').textContent = result.weight + ' kg';
    }

    function resetForm() {
        document.getElementById('elbowType').value = 'horizontal90';
        document.getElementById('trayWidth').value = 200;
        document.getElementById('trayHeight').value = 100;
        document.getElementById('bendRadius').value = 300;
        document.getElementById('material').value = 'steel';
        document.getElementById('thickness').value = '1.2';
        
        document.getElementById('trayWidthRange').value = 200;
        document.getElementById('trayHeightRange').value = 100;
        
        document.getElementById('resultsSection').classList.remove('visible');
        currentResult = null;
        
        showToast('已重置', 'success');
    }

    function copyResult() {
        if (!currentResult) {
            showToast('请先计算', 'error');
            return;
        }

        const text = Calculator.formatResult(currentResult);
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制到剪贴板', 'success');
        }).catch(() => {
            showToast('复制失败', 'error');
        });
    }

    function saveToHistory() {
        if (!currentResult) {
            showToast('请先计算', 'error');
            return;
        }

        const item = { ...currentResult };
        history.unshift(item);
        
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        
        saveHistory();
        updateHistoryUI();
        showToast('已保存到历史记录', 'success');
    }

    function loadHistory() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                history = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load history:', e);
            history = [];
        }
    }

    function saveHistory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save history:', e);
        }
    }

    function updateHistoryUI() {
        const container = document.getElementById('historyList');
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <p>暂无历史记录</p>
                    <span>保存的计算将显示在这里</span>
                </div>
            `;
            return;
        }

        container.innerHTML = history.map((item, index) => `
            <div class="history-item" data-index="${index}">
                <div class="history-item-header">
                    <span class="history-item-type">${item.elbowName}</span>
                    <span class="history-item-date">${new Date(item.timestamp).toLocaleDateString('zh-CN')}</span>
                </div>
                <div class="history-item-details">
                    <div class="history-item-detail">
                        规格: <span>${item.width}×${item.height}mm</span>
                    </div>
                    <div class="history-item-detail">
                        展开长度: <span>${item.unfoldLength}mm</span>
                    </div>
                    <div class="history-item-detail">
                        弯曲半径: <span>${item.radius}mm</span>
                    </div>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                loadFromHistory(parseInt(item.dataset.index));
            });
        });
    }

    function loadFromHistory(index) {
        const item = history[index];
        if (!item) return;

        document.getElementById('elbowType').value = item.elbowType;
        document.getElementById('trayWidth').value = item.width;
        document.getElementById('trayHeight').value = item.height;
        document.getElementById('bendRadius').value = item.radius;
        document.getElementById('material').value = item.material;
        document.getElementById('thickness').value = item.thickness;
        
        document.getElementById('trayWidthRange').value = item.width;
        document.getElementById('trayHeightRange').value = item.height;

        currentResult = item;
        updateResultsUI(currentResult);
        ThreeViewer.updateElbow(currentResult);
        
        document.getElementById('resultsSection').classList.add('visible');

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-tab="calculator"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById('calculator').classList.add('active');

        showToast('已加载历史记录', 'success');
    }

    function clearHistory() {
        if (history.length === 0) {
            showToast('没有历史记录', 'error');
            return;
        }

        if (confirm('确定要清空所有历史记录吗？')) {
            history = [];
            saveHistory();
            updateHistoryUI();
            showToast('历史记录已清空', 'success');
        }
    }

    function toggleRotate() {
        const isRotating = ThreeViewer.toggleAutoRotate();
        const btn = document.getElementById('toggleRotate');
        
        if (isRotating) {
            btn.classList.add('active');
            btn.style.background = 'var(--accent-color)';
            btn.style.color = 'white';
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.color = '';
        }
    }

    function reset3DView() {
        ThreeViewer.resetView();
    }

    function init3DViewer() {
        if (typeof ThreeViewer !== 'undefined') {
            ThreeViewer.init('canvas3d');
        }
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const messageEl = toast.querySelector('.toast-message');
        
        messageEl.textContent = message;
        toast.className = 'toast show';
        
        if (type === 'success') {
            toast.classList.add('success');
        }
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function setupPWA() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        console.log('SW registered:', registration);
                    })
                    .catch(error => {
                        console.log('SW registration failed:', error);
                    });
            });
        }

        let deferredPrompt;
        const installBtn = document.getElementById('installBtn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBtn.style.display = 'block';
        });

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) return;

                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            });
        }

        window.addEventListener('appinstalled', () => {
            installBtn.style.display = 'none';
            showToast('应用安装成功！', 'success');
        });

        window.addEventListener('online', () => {
            document.getElementById('offlineIndicator').style.display = 'none';
        });

        window.addEventListener('offline', () => {
            document.getElementById('offlineIndicator').style.display = 'block';
        });

        if (!navigator.onLine) {
            document.getElementById('offlineIndicator').style.display = 'block';
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        calculate,
        resetForm,
        copyResult,
        saveToHistory
    };
})();
