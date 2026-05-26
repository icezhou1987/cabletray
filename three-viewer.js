const ThreeViewer = (function() {
    let scene, camera, renderer, controls;
    let elbowGroup = null;
    let autoRotate = false;
    let animationId = null;
    let isInitialized = false;
    let pendingResult = null;

    function init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found');
            return;
        }

        if (typeof THREE === 'undefined') {
            console.error('THREE is not defined');
            showError(container, 'Three.js库未加载');
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) {
                throw new Error('WebGL not supported');
            }
        } catch (e) {
            console.warn('WebGL not available, 3D view disabled');
            showError(container, '3D视图需要WebGL支持');
            return;
        }

        try {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a0a1a);
            scene.fog = new THREE.Fog(0x0a0a1a, 800, 2000);

            const width = container.clientWidth;
            const height = container.clientHeight;
            const aspect = width / height;

            camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
            camera.position.set(600, 400, 600);

            renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: true
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(renderer.domElement);

            if (typeof THREE.OrbitControls !== 'undefined') {
                controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                controls.minDistance = 200;
                controls.maxDistance = 2000;
                controls.target.set(0, 0, 0);
            }

            setupLights();
            createGrid();
            createAxesHelper();

            window.addEventListener('resize', onWindowResize);

            isInitialized = true;
            hideLoading();
            animate();

            if (pendingResult) {
                updateElbow(pendingResult);
                pendingResult = null;
            }

        } catch (e) {
            console.error('Failed to initialize Three.js:', e);
            showError(container, '初始化失败: ' + e.message);
        }
    }

    function showError(container, message) {
        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);text-align:center;padding:2rem;">
                <div>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin:0 auto 1rem;opacity:0.5">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    <p>${message}</p>
                    <p style="font-size:0.8rem;margin-top:0.5rem;">请在支持WebGL的浏览器中打开</p>
                </div>
            </div>
        `;
    }

    function setupLights() {
        if (!scene) {
            console.error('setupLights: scene is undefined');
            return;
        }
        
        try {
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
            scene.add(ambientLight);
            console.log('Added ambient light');

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(500, 800, 500);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            scene.add(directionalLight);
            console.log('Added directional light');

            const fillLight = new THREE.DirectionalLight(0x4a90e2, 0.3);
            fillLight.position.set(-300, 400, -300);
            scene.add(fillLight);
            console.log('Added fill light');

            const backLight = new THREE.DirectionalLight(0xe94560, 0.2);
            backLight.position.set(0, -300, -500);
            scene.add(backLight);
            console.log('Added back light');
        } catch (e) {
            console.error('Error in setupLights:', e);
        }
    }

    function createGrid() {
        if (!scene) {
            console.error('createGrid: scene is undefined');
            return;
        }
        
        try {
            const gridHelper = new THREE.GridHelper(1200, 30, 0x2a2a4e, 0x1a1a2e);
            gridHelper.position.y = -200;
            scene.add(gridHelper);
            console.log('Added grid');
        } catch (e) {
            console.error('Error in createGrid:', e);
        }
    }

    function createAxesHelper() {
        if (!scene) {
            console.error('createAxesHelper: scene is undefined');
            return;
        }
        
        try {
            const axesHelper = new THREE.AxesHelper(100);
            scene.add(axesHelper);
            console.log('Added axes helper');
        } catch (e) {
            console.error('Error in createAxesHelper:', e);
        }
    }

    function createMetalMaterial(color = 0x8a9ba8) {
        return new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.8,
            roughness: 0.3,
            side: THREE.DoubleSide
        });
    }

    function createCutLineMaterial() {
        return new THREE.LineBasicMaterial({ 
            color: 0xe94560,
            linewidth: 2
        });
    }

    function createElbowMesh(result) {
        const group = new THREE.Group();
        
        const { width, height, radius, angle, plane } = result;
        const scale = 0.5;
        const w = width * scale;
        const h = height * scale;
        const r = radius * scale;
        const a = (angle * Math.PI) / 180;

        const segments = Math.max(16, Math.floor(angle / 2));
        const material = createMetalMaterial();

        for (let i = 0; i < segments; i++) {
            const theta1 = (i / segments) * a;
            const theta2 = ((i + 1) / segments) * a;
            
            const innerRadius = r - w / 2;
            const outerRadius = r + w / 2;
            
            const x1Inner = innerRadius * Math.cos(theta1);
            const z1Inner = innerRadius * Math.sin(theta1);
            const x2Inner = innerRadius * Math.cos(theta2);
            const z2Inner = innerRadius * Math.sin(theta2);
            
            const x1Outer = outerRadius * Math.cos(theta1);
            const z1Outer = outerRadius * Math.sin(theta1);
            const x2Outer = outerRadius * Math.cos(theta2);
            const z2Outer = outerRadius * Math.sin(theta2);

            const shape = new THREE.Shape();
            shape.moveTo(x1Inner, z1Inner);
            shape.lineTo(x1Outer, z1Outer);
            shape.lineTo(x2Outer, z2Outer);
            shape.lineTo(x2Inner, z2Inner);
            shape.closePath();

            const extrudeSettings = {
                steps: 1,
                depth: h,
                bevelEnabled: false
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            
            if (plane === 'vertical') {
                geometry.rotateX(-Math.PI / 2);
            }
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            if (plane === 'horizontal') {
                mesh.position.y = 0;
            } else {
                mesh.position.x = 0;
                mesh.rotation.z = Math.PI / 2;
            }
            
            group.add(mesh);
        }

        addFlanges(group, w, h, r, a, plane);
        
        if (plane === 'horizontal') {
            addCutLine(group, w, h, r, a);
        }

        return group;
    }

    function addFlanges(group, width, height, radius, angle, plane) {
        const flangeMaterial = createMetalMaterial(0x6a7a8a);
        const flangeWidth = 15 * 0.5;
        
        const startAngle = 0;
        const endAngle = angle * (Math.PI / 180);
        
        const createFlangeGeometry = (r, isStart) => {
            const shape = new THREE.Shape();
            const halfWidth = width / 2;
            const halfHeight = height / 2;
            
            shape.moveTo(-halfWidth, -halfHeight);
            shape.lineTo(-halfWidth, halfHeight);
            shape.lineTo(halfWidth, halfHeight);
            shape.lineTo(halfWidth, -halfHeight);
            shape.closePath();
            
            return new THREE.ExtrudeGeometry(shape, {
                steps: 1,
                depth: flangeWidth,
                bevelEnabled: false
            });
        };

        if (plane === 'horizontal') {
            const startFlangeGeo = createFlangeGeometry(radius, true);
            const startFlange = new THREE.Mesh(startFlangeGeo, flangeMaterial);
            startFlange.position.set(
                radius * Math.cos(startAngle),
                0,
                radius * Math.sin(startAngle) - flangeWidth
            );
            startFlange.castShadow = true;
            group.add(startFlange);

            const endFlangeGeo = createFlangeGeometry(radius, false);
            const endFlange = new THREE.Mesh(endFlangeGeo, flangeMaterial);
            endFlange.rotation.y = -angle * (Math.PI / 180);
            endFlange.position.set(
                radius * Math.cos(endAngle),
                0,
                radius * Math.sin(endAngle)
            );
            endFlange.castShadow = true;
            group.add(endFlange);
        }
    }

    function addCutLine(group, width, height, radius, angle) {
        const angleRad = (angle * Math.PI) / 180;
        const halfAngleRad = angleRad / 2;
        const cutPosition = (width - (radius * Math.tan(halfAngleRad)));
        
        const innerR = radius - width / 2;
        const cutR = radius - (width / 2 - cutPosition);
        
        const points = [];
        for (let i = 0; i <= 50; i++) {
            const t = i / 50;
            const x = cutR * Math.cos(t * angleRad);
            const z = cutR * Math.sin(t * angleRad);
            points.push(new THREE.Vector3(x, -height / 2 - 10, z));
        }
        
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = createCutLineMaterial();
        const cutLine = new THREE.Line(lineGeometry, lineMaterial);
        group.add(cutLine);

        const cutPlaneGeometry = new THREE.PlaneGeometry(2, height + 20);
        const cutPlaneMaterial = new THREE.MeshBasicMaterial({
            color: 0xe94560,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });
        const cutPlane = new THREE.Mesh(cutPlaneGeometry, cutPlaneMaterial);
        cutPlane.rotation.y = -angleRad / 2;
        cutPlane.position.set(cutR * Math.cos(angleRad / 2), -height / 2, cutR * Math.sin(angleRad / 2));
        group.add(cutPlane);
    }

    function updateElbow(result) {
        if (!isInitialized) {
            if (result && result.success) {
                pendingResult = result;
            }
            return;
        }

        if (!scene) {
            console.error('Scene is not initialized');
            return;
        }

        if (elbowGroup) {
            scene.remove(elbowGroup);
            elbowGroup = null;
        }

        if (result && result.success) {
            try {
                elbowGroup = createElbowMesh(result);
                scene.add(elbowGroup);
                resetView();
            } catch (e) {
                console.error('Failed to create elbow mesh:', e);
            }
        }
    }

    function toggleAutoRotate() {
        autoRotate = !autoRotate;
        return autoRotate;
    }

    function resetView() {
        if (camera && controls) {
            camera.position.set(600, 400, 600);
            controls.target.set(0, 0, 0);
            controls.update();
        }
    }

    function onWindowResize() {
        const container = renderer.domElement.parentElement;
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        
        if (autoRotate && elbowGroup) {
            elbowGroup.rotation.y += 0.005;
        }
        
        if (controls) {
            controls.update();
        }
        
        renderer.render(scene, camera);
    }

    function hideLoading() {
        const loading = document.getElementById('loading3d');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    function dispose() {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        if (renderer) {
            renderer.dispose();
        }
        
        window.removeEventListener('resize', onWindowResize);
    }

    return {
        init,
        updateElbow,
        toggleAutoRotate,
        resetView,
        dispose,
        getAutoRotate: () => autoRotate
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreeViewer;
}
