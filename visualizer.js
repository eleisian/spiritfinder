import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ColorCorrectionShader } from 'three/examples/jsm/shaders/ColorCorrectionShader.js';

let scene, camera, renderer, analyser, controls;
let shapes = [];
let particles;
let audioElement, audioContext, source;
let composer;
let time = 0;
let water; // Declare this at the top of your file
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;
let audioData = new Uint8Array(128);

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // White background

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 30); // Adjusted camera position

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Remove shadow map settings
    // renderer.shadowMap.enabled = true;
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minPolarAngle = 0.1;
    controls.minDistance = 10; // Increased minimum distance
    controls.maxDistance = 60; // Increased maximum distance

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    // Remove shadow settings for directional light
    // directionalLight.castShadow = true;
    // directionalLight.shadow.mapSize.width = 2048;
    // directionalLight.shadow.mapSize.height = 2048;
    // directionalLight.shadow.camera.near = 1;
    // directionalLight.shadow.camera.far = 200;
    // directionalLight.shadow.camera.left = -50;
    // directionalLight.shadow.camera.right = 50;
    // directionalLight.shadow.camera.top = 50;
    // directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);

    // Add a point light at the center of the scene
    const centerLight = new THREE.PointLight(0xffffff, 1, 50);
    centerLight.position.set(0, 0, 0);
    // Remove shadow settings for center light
    // centerLight.castShadow = true;
    // centerLight.shadow.mapSize.width = 1024;
    // centerLight.shadow.mapSize.height = 1024;
    // centerLight.shadow.camera.near = 0.5;
    // centerLight.shadow.camera.far = 50;
    scene.add(centerLight);

    // Post-processing
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.2, 0.85);
    composer.addPass(bloomPass);

    const colorCorrectionPass = new ShaderPass(ColorCorrectionShader);
    colorCorrectionPass.uniforms['powRGB'].value = new THREE.Vector3(1.0, 1.0, 1.0);
    colorCorrectionPass.uniforms['mulRGB'].value = new THREE.Vector3(1.0, 1.0, 1.0);
    composer.addPass(colorCorrectionPass);

    createWaterSurface();
    createShapes();
    createParticles();
    setupAudioAnalyzer();
    createReplayButton();
    createRecordButton();
    animate();
}

function createWaterSurface() {
    const radius = 16;
    const segments = 32;
    
    const waterGeometry = new THREE.CircleGeometry(radius, segments);
    
    const waterNormals = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg');
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
    
    water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: waterNormals,
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x66ccff,  // Light blue color
        distortionScale: 3.7,
        fog: scene.fog !== undefined,
        format: THREE.RGBAFormat,
        transparent: true,
        opacity: 0.6
    });
    
    water.rotation.x = -Math.PI / 2;
    water.position.y = -10; // Lowered from -5 to -10
    
    scene.add(water);
    
    // Create circular geometry for reflector
    const reflectorGeometry = new THREE.CircleGeometry(radius, segments);
    const reflector = new Reflector(reflectorGeometry, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0xffffff  // Changed to white for a clear appearance
    });
    reflector.position.y = -10.1; // Lowered from -5.1 to -10.1
    reflector.rotateX(-Math.PI / 2);
    scene.add(reflector);
}

function createShapes() {
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const count = 180;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    // Updated pastel colors
    const pastelColors = [
        0xFFDADA, 0xFFF0DB, 0xFFFBDB, 0xE2FFDB, 0xDBFFF3, 0xDBEAFF,
        0xE6DBFF, 0xFFDBF5, 0xFFE8D1, 0xE8FFD1, 0xD1FFE8, 0xD1E8FF
    ];

    for (let i = 0; i < count; i++) {
        const color = pastelColors[i % pastelColors.length];
        const material = new THREE.MeshPhongMaterial({ 
            color: color, 
            shininess: 50,
            emissive: 400,
            specular: 9000
        });
        const shape = new THREE.Mesh(geometry, material);

        const spreadFactor = 1.8;
        const radius = Math.sqrt(i) * spreadFactor;
        const theta = i * goldenAngle;
        const yPosition = Math.random() * 20 - 10;
        shape.position.set(
            radius * Math.cos(theta),
            yPosition,
            radius * Math.sin(theta)
        );

        const size = 0.8 - (i / count) * 0.4;
        shape.scale.setScalar(size);

        // Remove shadow casting and receiving
        // shape.castShadow = true;
        // shape.receiveShadow = true;

        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
        shape.add(line);

        scene.add(shape);
        shapes.push(shape);
    }
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i < 2000; i++) {
        vertices.push(Math.random() * 40 - 20);
        vertices.push(Math.random() * 40 - 20);
        vertices.push(Math.random() * 40 - 20);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({ color: 0x888888, size: 0.05, transparent: true, opacity: 0.7 });
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function setupAudioAnalyzer() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    audioElement = document.createElement('audio');
    source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    document.getElementById('audioFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const fileURL = URL.createObjectURL(file);
        audioElement.src = fileURL;
        audioElement.play();
        
        audioElement.onplay = startRecording;
        audioElement.onended = stopRecording;
    });
}

function startRecording() {
    if (isRecording) return;
    
    isRecording = true;
    recordedChunks = [];
    const stream = renderer.domElement.captureStream(60); // 60 FPS

    const options = { 
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 50000000 // Increased to 50 Mbps for higher quality
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
    }

    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
        console.error('MediaRecorder is not supported by this browser.');
        return;
    }
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = 'visualization.webm';
        a.click();
        URL.revokeObjectURL(url);
    };
    
    // Temporarily increase canvas size
    const originalWidth = renderer.domElement.width;
    const originalHeight = renderer.domElement.height;
    renderer.setSize(window.innerWidth * 2, window.innerHeight * 2);
    camera.aspect = (window.innerWidth * 2) / (window.innerHeight * 2);
    camera.updateProjectionMatrix();

    mediaRecorder.start(100);
    console.log('Recording started');
}

function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    mediaRecorder.stop();
    console.log('Recording stopped');

    // Restore original canvas size
    renderer.setSize(originalWidth, originalHeight);
    camera.aspect = originalWidth / originalHeight;
    camera.updateProjectionMatrix();
}

function createReplayButton() {
    const replayButton = document.createElement('button');
    replayButton.textContent = 'Replay';
    replayButton.style.position = 'absolute';
    replayButton.style.top = '50px';
    replayButton.style.left = '10px';
    replayButton.addEventListener('click', () => {
        if (audioElement.src) {
            audioElement.currentTime = 0;
            audioElement.play();
        }
    });
    document.body.appendChild(replayButton);
}

function createRecordButton() {
    const recordButton = document.createElement('button');
    recordButton.textContent = 'Start Recording';
    recordButton.style.position = 'absolute';
    recordButton.style.top = '90px';
    recordButton.style.left = '10px';
    recordButton.addEventListener('click', toggleRecording);
    document.body.appendChild(recordButton);
}

function toggleRecording() {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

function updateShapes() {
    analyser.getByteFrequencyData(audioData);
    time += 0.005; // Increment time for the floating effect

    shapes.forEach((shape, index) => {
        const dataIndex = Math.floor(index / shapes.length * audioData.length);
        const value = audioData[dataIndex] / 128.0;
        
        // Calculate the scale factor with more limited range
        const minScale = 0.8;
        const maxScale = 1.2;
        const scaleFactor = minScale + (maxScale - minScale) * value;
        
        // Apply the scale factor to the original scale of the shape
        const originalScale = 0.8 - (index / shapes.length) * 0.4;
        shape.scale.setScalar(originalScale * scaleFactor);

        // Update the scale of the edges (black lines)
        if (shape.children[0]) {
            shape.children[0].scale.setScalar(1 / scaleFactor);
        }

        // Add floating effect based on audio data
        const floatAmplitude = 0.5; // Adjust this to control the height of the float
        const floatFrequency = 2; // Adjust this to control the speed of the float
        const phaseOffset = index * 0.2; // This creates a wave-like effect across all cubes
        const floatOffset = Math.sin((time + phaseOffset) * floatFrequency) * floatAmplitude * value;
        
        // Get the original y position (assuming it's stored in userData)
        if (shape.userData.originalY === undefined) {
            shape.userData.originalY = shape.position.y;
        }
        
        // Apply the floating offset to the cube's position
        shape.position.y = shape.userData.originalY + floatOffset;

        // Add a very slow, constant rotation (not affected by music)
        const rotationSpeed = 0.001;
        shape.rotation.x += rotationSpeed;
        shape.rotation.y += rotationSpeed * 0.7;
        shape.rotation.z += rotationSpeed * 0.5;
    });
}

function updateCamera() {
    const time = performance.now() * 0.001;
    const bassValue = audioData[0] / 128.0; // Use the first frequency bin for bass

    // Reduce the base radius and its variation
    const baseRadius = 25 + bassValue * 5; // Reduced from 20 + bassValue * 10

    // Primary Lissajous curve (reduced coefficients)
    const a1 = 0.8, b1 = 0.5, c1 = 0.3;
    const lissajous1X = Math.sin(a1 * time) * Math.cos(b1 * time);
    const lissajous1Y = Math.sin(b1 * time) * Math.cos(c1 * time);
    const lissajous1Z = Math.sin(c1 * time) * Math.cos(a1 * time);

    // Secondary Lissajous curve (slower frequency, reduced coefficients)
    const a2 = 0.2, b2 = 0.1, c2 = 0.05;
    const lissajous2X = Math.sin(a2 * time) * Math.cos(b2 * time);
    const lissajous2Y = Math.sin(b2 * time) * Math.cos(c2 * time);
    const lissajous2Z = Math.sin(c2 * time) * Math.cos(a2 * time);

    // Combine movements and add offset to avoid center (reduced offsets)
    const offsetX = 3;
    const offsetY = 2 + bassValue * 3; // Reduced Y offset variation
    const offsetZ = 2;
    const newX = baseRadius * (lissajous1X * 0.6 + lissajous2X * 0.4) + offsetX;
    const newY = baseRadius * (lissajous1Y * 0.6 + lissajous2Y * 0.4) + offsetY;
    const newZ = baseRadius * (lissajous1Z * 0.6 + lissajous2Z * 0.4) + offsetZ;

    camera.position.set(newX, newY, newZ);

    // Dynamic look-at point (reduced range)
    const a3 = 0.2, b3 = 0.15, c3 = 0.1;
    const lookAtX = Math.sin(a3 * time) * Math.cos(b3 * time) * 3;
    const lookAtY = Math.sin(b3 * time) * Math.cos(c3 * time) * 3;
    const lookAtZ = Math.sin(c3 * time) * Math.cos(a3 * time) * 3;
    camera.lookAt(lookAtX, lookAtY, lookAtZ);

    // Reduced FOV variation
    const baseFOV = 75;
    const fovVariation = bassValue * 10; // Reduced from 20
    camera.fov = baseFOV + fovVariation;
    camera.updateProjectionMatrix();
}

function animate() {
    requestAnimationFrame(animate);

    updateShapes();
    updateCamera();

    particles.rotation.x += 0.0005;
    particles.rotation.y += 0.001;

    controls.update();

    updateWaveform(audioData);

    // Animate water (slower ripples)
    water.material.uniforms['time'].value += 1.0 / 180.0; // Changed from 60.0 to 180.0

    if (isRecording) {
        mediaRecorder.requestData();
    }

    composer.render();
}

function updateWaveform(dataArray) {
    // Remove existing waveform
    scene.children = scene.children.filter(child => !(child instanceof THREE.Line));

    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i < dataArray.length; i++) {
        const x = (i / dataArray.length) * 16 - 8;
        const y = (dataArray[i] / 128.0 - 1) * 2 - 4;
        vertices.push(x, y, 0);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x000000 });
    const waveform = new THREE.Line(geometry, material);
    scene.add(waveform);
}

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

init();