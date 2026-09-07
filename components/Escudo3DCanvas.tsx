"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface Escudo3DCanvasProps {
  className?: string;
  progreso?: number;
}

export default function Escudo3DCanvas({
  className = "",
}: Escudo3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 340;

    // 1. ESCENA, CÁMARA Y RENDERER
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 2. ILUMINACIÓN CINEMATOGRÁFICA
    // Luz ambiental suave para ver detalles en las sombras
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    // Luz principal dorada cálida desde arriba-adelante
    const keyGoldLight = new THREE.DirectionalLight(0xfff3cc, 2.5);
    keyGoldLight.position.set(3, 4, 5);
    scene.add(keyGoldLight);

    // Luz secundaria azul cian desde abajo-izquierda (como en la imagen de referencia)
    const cyanRimLight = new THREE.DirectionalLight(0x00e5ff, 2.8);
    cyanRimLight.position.set(-4, -2, -3);
    scene.add(cyanRimLight);

    // Luz dorada desde atrás-derecha para resaltar el bisel al girar
    const goldBackLight = new THREE.DirectionalLight(0xffaa00, 2.2);
    goldBackLight.position.set(4, 2, -4);
    scene.add(goldBackLight);

    // Luz puntual brillante central debajo del escudo (como el rayo del pedestal)
    const pedestalPointLight = new THREE.PointLight(0x00c8ff, 3.5, 8);
    pedestalPointLight.position.set(0, -2.6, 0.5);
    scene.add(pedestalPointLight);

    // 3. GRUPO PRINCIPAL DEL ESCUDO (Permite rotar en 360°)
    const shieldGroup = new THREE.Group();
    scene.add(shieldGroup);

    // Silueta heráldica del Escudo de Santa Rita
    const shape = new THREE.Shape();
    // Escala aproximada 2.8 unidades de alto
    shape.moveTo(0, 1.4);
    // Corona superior central y ondulación hacia la derecha
    shape.bezierCurveTo(0.45, 1.48, 0.95, 1.52, 1.25, 1.35);
    shape.bezierCurveTo(1.35, 1.25, 1.38, 1.05, 1.35, 0.85);
    // Costado derecho descendente suave
    shape.bezierCurveTo(1.32, 0.2, 1.18, -0.4, 0.85, -0.9);
    // Punta inferior del escudo
    shape.bezierCurveTo(0.55, -1.35, 0.25, -1.65, 0, -1.82);
    // Lado izquierdo simétrico
    shape.bezierCurveTo(-0.25, -1.65, -0.55, -1.35, -0.85, -0.9);
    shape.bezierCurveTo(-1.18, -0.4, -1.32, 0.2, -1.35, 0.85);
    shape.bezierCurveTo(-1.38, 1.05, -1.35, 1.25, -1.25, 1.35);
    shape.bezierCurveTo(-0.95, 1.52, -0.45, 1.48, 0, 1.4);

    // Geometría extruida con bisel para darle grosor y bordes de oro real
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    };

    const goldFrameGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    goldFrameGeometry.center();

    // Material de oro reflectante de alta gama (PBR)
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf6c343),
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.8,
    });

    const goldFrameMesh = new THREE.Mesh(goldFrameGeometry, goldMaterial);
    shieldGroup.add(goldFrameMesh);

    // 4. CARA FRONTAL DEL ESCUDO CON TEXTURA OFICIAL DE ALTA DEFINICIÓN
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load("/img/escudo-3d-gold.png", (frontTexture) => {
      frontTexture.colorSpace = THREE.SRGBColorSpace;
      frontTexture.minFilter = THREE.LinearMipmapLinearFilter;
      frontTexture.generateMipmaps = true;

      // Geometría frontal con proporción exacta del escudo
      const frontPlaneGeo = new THREE.PlaneGeometry(2.7, 3.1);
      const frontMat = new THREE.MeshStandardMaterial({
        map: frontTexture,
        transparent: true,
        roughness: 0.25,
        metalness: 0.65,
        depthWrite: true,
      });

      const frontMesh = new THREE.Mesh(frontPlaneGeo, frontMat);
      frontMesh.position.set(0, -0.05, 0.175);
      shieldGroup.add(frontMesh);

      // CARA TRASERA (Sello Institucional Dorado para cuando gire 180°)
      const backMat = new THREE.MeshStandardMaterial({
        map: frontTexture,
        transparent: true,
        roughness: 0.35,
        metalness: 0.8,
        color: new THREE.Color(0xefc050),
      });

      const backMesh = new THREE.Mesh(frontPlaneGeo, backMat);
      backMesh.position.set(0, -0.05, -0.175);
      backMesh.rotation.y = Math.PI; // Mirando hacia atrás
      shieldGroup.add(backMesh);
    });

    // 5. ANILLOS HOLOGRÁFICOS 3D EN ÓRBITA (Cyan y Dorado como en la foto)
    // Anillo 1: Neón Azul / Cian
    const cyanTorusGeo = new THREE.TorusGeometry(2.2, 0.022, 16, 100);
    const cyanTorusMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
    });
    const cyanRing = new THREE.Mesh(cyanTorusGeo, cyanTorusMat);
    cyanRing.rotation.x = Math.PI / 2.5; // Inclinado
    cyanRing.rotation.y = -0.2;
    scene.add(cyanRing);

    // Anillo 2: Neón Oro Cálido
    const goldTorusGeo = new THREE.TorusGeometry(2.35, 0.018, 16, 100);
    const goldTorusMat = new THREE.MeshBasicMaterial({
      color: 0xffb700,
      transparent: true,
      opacity: 0.75,
    });
    const goldRing = new THREE.Mesh(goldTorusGeo, goldTorusMat);
    goldRing.rotation.x = Math.PI / 2.3;
    goldRing.rotation.y = 0.35;
    scene.add(goldRing);

    // 6. PARTÍCULAS DE ENERGÍA FLOTANTES (Polvo estelar del pedestal)
    const particleCount = 45;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4.0 - 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3.0;
      speeds[i] = Math.random() * 0.015 + 0.008;
    }

    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.065,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 7. INTERACCIÓN DE PARALAJE SUAVE (Mouse & Touch)
    let mouseX = 0;
    let mouseY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const rect = container.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;
      targetTiltX = -y * 0.35;
      targetTiltY = x * 0.45;
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("touchmove", handlePointerMove);

    // 8. BUCLE DE ANIMACIÓN A 60 FPS
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Rotación 360° suave y continua en el eje Y
      shieldGroup.rotation.y = elapsedTime * 1.15;

      // Suave levitación vertical (respiración cósmica)
      shieldGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.09;

      // Parallax suave con amortiguación
      mouseX += (targetTiltX - mouseX) * 0.08;
      mouseY += (targetTiltY - mouseY) * 0.08;
      shieldGroup.rotation.x = mouseX + Math.sin(elapsedTime * 1.5) * 0.04;
      shieldGroup.rotation.z = -mouseY * 0.4;

      // Animación de los anillos orbitales
      cyanRing.rotation.z = elapsedTime * 0.45;
      goldRing.rotation.z = -elapsedTime * 0.35;

      // Animación de las partículas ascendentes
      const pos = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3 + 1] += speeds[i];
        if (pos[i * 3 + 1] > 2.5) {
          pos[i * 3 + 1] = -2.2;
          pos[i * 3] = (Math.random() - 0.5) * 4.0;
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // 9. RESPONSIVE RESIZE
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // LIMPIEZA AL DESMONTAR
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove);
      cancelAnimationFrame(animationFrameId);

      // Liberar memoria GPU
      goldFrameGeometry.dispose();
      goldMaterial.dispose();
      cyanTorusGeo.dispose();
      cyanTorusMat.dispose();
      goldTorusGeo.dispose();
      goldTorusMat.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center pointer-events-none select-none ${className}`}
      style={{ touchAction: "none" }}
    />
  );
}
