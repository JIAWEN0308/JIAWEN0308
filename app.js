// App.js with 3D floating name on button click
import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { DRACOLoader } from './libs/three/jsm/DRACOLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { Stats } from './libs/stats.module.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { VRButton } from './libs/VRButton.js';
import { GazeController } from './libs/GazeController.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';
import { FontLoader } from './libs/three/jsm/FontLoader.js';
import { TextGeometry } from './libs/three/jsm/TextGeometry.js';

class App {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.assetsPath = './assets/';
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 500);
        this.camera.position.set(0, 1.6, 0);

        this.dolly = new THREE.Object3D();
        this.dolly.position.set(0, 0, 10);
        this.dolly.add(this.camera);
        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

        this.scene = new THREE.Scene();
        this.scene.add(this.dolly);

        const ambient = new THREE.HemisphereLight(0xFFFFFF, 0xAAAAAA, 0.8);
        this.scene.add(ambient);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);
        this.setEnvironment();

        window.addEventListener('resize', this.resize.bind(this));

        this.clock = new THREE.Clock();
        this.up = new THREE.Vector3(0, 1, 0);
        this.origin = new THREE.Vector3();
        this.workingVec3 = new THREE.Vector3();
        this.workingQuaternion = new THREE.Quaternion();
        this.raycaster = new THREE.Raycaster();

        this.stats = new Stats();
        container.appendChild(this.stats.dom);

        this.loadingBar = new LoadingBar();
        this.loadCollege();

        this.immersive = false;

        // Button to trigger name display
        const displayBtn = document.createElement('button');
        displayBtn.textContent = 'Display Name';
        displayBtn.style.position = 'absolute';
        displayBtn.style.bottom = '20px';
        displayBtn.style.right = '20px';
        displayBtn.style.zIndex = '10';
        document.body.appendChild(displayBtn);
        displayBtn.addEventListener('click', () => this.displayUserName3D());

        this.fontLoader = new FontLoader();
        this.nameMesh = null;
    }

    setEnvironment() {
        const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        loader.load('./assets/hdr/venice_sunset_1k.hdr', (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();
            this.scene.environment = envMap;
        }, undefined, (err) => {
            console.error('An error occurred setting the environment');
        });
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    loadCollege() {
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./libs/three/js/draco/');
        loader.setDRACOLoader(dracoLoader);

        const self = this;
        loader.load('college.glb', function (gltf) {
            const college = gltf.scene.children[0];
            self.scene.add(college);

            college.traverse(function (child) {
                if (child.isMesh) {
                    if (child.name.indexOf("PROXY") !== -1) {
                        child.material.visible = false;
                        self.proxy = child;
                    } else if (child.material.name.indexOf('Glass') !== -1) {
                        child.material.opacity = 0.1;
                        child.material.transparent = true;
                    } else if (child.material.name.indexOf("SkyBox") !== -1) {
                        const mat1 = child.material;
                        const mat2 = new THREE.MeshBasicMaterial({ map: mat1.map });
                        child.material = mat2;
                        mat1.dispose();
                    }
                }
            });

            const door1 = college.getObjectByName("LobbyShop_Door__1_");
            const door2 = college.getObjectByName("LobbyShop_Door__2_");
            const pos = door1.position.clone().sub(door2.position).multiplyScalar(0.5).add(door2.position);
            const obj = new THREE.Object3D();
            obj.name = "LobbyShop";
            obj.position.copy(pos);
            college.add(obj);

            self.loadingBar.visible = false;
            self.setupXR();
        });
    }

    setupXR() {
        this.renderer.xr.enabled = true;
        const btn = new VRButton(this.renderer);

        const self = this;
        const timeoutId = setTimeout(() => {
            self.useGaze = true;
            self.gazeController = new GazeController(self.scene, self.dummyCam);
        }, 2000);

        function onSelectStart(event) {
            this.userData.selectPressed = true;
        }

        function onSelectEnd(event) {
            this.userData.selectPressed = false;
        }

        function onConnected(event) {
            clearTimeout(timeoutId);
        }

        this.controllers = this.buildControllers(this.dolly);
        this.controllers.forEach((controller) => {
            controller.addEventListener('selectstart', onSelectStart);
            controller.addEventListener('selectend', onSelectEnd);
            controller.addEventListener('connected', onConnected);
        });

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    buildControllers(parent = this.scene) {
        const controllerModelFactory = new XRControllerModelFactory();
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);
        const line = new THREE.Line(geometry);
        line.scale.z = 0;

        const controllers = [];
        for (let i = 0; i <= 1; i++) {
            const controller = this.renderer.xr.getController(i);
            controller.add(line.clone());
            controller.userData.selectPressed = false;
            parent.add(controller);
            controllers.push(controller);

            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(controllerModelFactory.createControllerModel(grip));
            parent.add(grip);
        }
        return controllers;
    }

    displayUserName3D() {
        const input = document.getElementById('userName');
        if (!input) return;

        const name = input.value.trim();
        if (!name) return;

        if (this.nameMesh) {
            this.scene.remove(this.nameMesh);
            this.nameMesh.geometry.dispose();
            this.nameMesh.material.dispose();
        }

        this.fontLoader.load('./assets/fonts/helvetiker_regular.typeface.json', (font) => {
            const geometry = new TextGeometry(name, {
                font: font,
                size: 0.2,
                height: 0.02
            });
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
            this.nameMesh = new THREE.Mesh(geometry, material);

            this.nameMesh.position.set(0, 2, -1);
            this.camera.add(this.nameMesh);
        });
    }

    render() {
        const dt = this.clock.getDelta();
        if (this.renderer.xr.isPresenting) {
            if (this.useGaze && this.gazeController !== undefined) {
                this.gazeController.update();
            }
        }
        this.stats.update();
        this.renderer.render(this.scene, this.camera);
    }
}

export { App };
