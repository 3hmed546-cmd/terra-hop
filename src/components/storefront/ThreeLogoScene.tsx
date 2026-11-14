"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface ThreeLogoSceneProps {
  size?: number; // width & height in px
  className?: string;
}

export function ThreeLogoScene({ size = 120, className = "" }: ThreeLogoSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Check WebGL support
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    const width = size;
    const height = size;

    // 2. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 3.0, 10);
    pointLight.position.set(0, 0, 3);
    scene.add(pointLight);

    // 5. Group for the 3D Logo Object
    const logoGroup = new THREE.Group();
    scene.add(logoGroup);

    // 6. Base Metallic Coin / Disc Geometry
    const discRadius = 1.05;
    const discThickness = 0.12;
    const discGeometry = new THREE.CylinderGeometry(discRadius, discRadius, discThickness, 48);

    // Metallic rim material (obsidian chrome)
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x141414,
      metalness: 0.95,
      roughness: 0.18,
    });

    // Face materials (using texture loader for front face)
    const textureLoader = new THREE.TextureLoader();
    const logoTexture = textureLoader.load(
      "/logo/terra-hop-logo-white.png",
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      }
    );

    const frontFaceMaterial = new THREE.MeshStandardMaterial({
      map: logoTexture,
      transparent: true,
      metalness: 0.7,
      roughness: 0.25,
      color: 0xffffff,
    });

    const backFaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Cylinder materials: [side, top (front face), bottom (back face)]
    const materials = [rimMaterial, frontFaceMaterial, backFaceMaterial];
    const coinMesh = new THREE.Mesh(discGeometry, materials);
    // Orient cylinder so top face faces camera (rotate on X)
    coinMesh.rotation.x = Math.PI / 2;
    logoGroup.add(coinMesh);

    // 7. Signature Planetary Orbit Ring (Inspired by TERRA HOP orbital logo)
    const ringRadius = 1.45;
    const ringTube = 0.022;
    const ringGeometry = new THREE.TorusGeometry(ringRadius, ringTube, 16, 64);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x666666,
      metalness: 0.98,
      roughness: 0.1,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = Math.PI / 3; // Tilt ring at ~60 degrees
    logoGroup.add(ringMesh);

    // 8. Sparkle Particle Dust in 3D Depth
    const particleCount = 28;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.045,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 9. Interactive Pointer Tracking
    let targetRotX = 0;
    let targetRotY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const rect = container.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = x;
      mouseY = y;
      targetRotY = x * 0.45;
      targetRotX = -y * 0.45;
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("touchmove", handlePointerMove, { passive: true });

    // 10. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Continuous floating & orbital ring motion
      ringMesh.rotation.z = elapsed * 0.8;
      ringMesh.rotation.y = Math.sin(elapsed * 0.6) * 0.2;

      // Gentle floating oscillation for the coin
      const floatY = Math.sin(elapsed * 1.8) * 0.08;
      logoGroup.position.y = floatY;

      // Smooth lerp to mouse pointer for interactive 3D response
      logoGroup.rotation.y += (targetRotY - logoGroup.rotation.y) * 0.08;
      logoGroup.rotation.x += (targetRotX - logoGroup.rotation.x) * 0.08;

      // Point light tracks pointer position to create specular glints
      pointLight.position.x = mouseX * 2.5;
      pointLight.position.y = mouseY * 2.5;

      // Particles subtle drift
      particles.rotation.y = elapsed * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // 11. Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      discGeometry.dispose();
      ringGeometry.dispose();
      particleGeometry.dispose();
      rimMaterial.dispose();
      frontFaceMaterial.dispose();
      backFaceMaterial.dispose();
      ringMaterial.dispose();
      particleMaterial.dispose();
      logoTexture.dispose();
    };
  }, [size]);

  if (!hasWebGL) {
    return (
      <div
        className={`relative flex items-center justify-center rounded-full bg-obsidian border border-white/10 ${className}`}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/terra-hop-logo-white.png"
          alt="TERRA HOP Logo"
          className="w-3/4 h-3/4 object-contain"
        />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className={`relative flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{ width: size, height: size }}
      title="TERRA HOP 3D Emblem"
    />
  );
}
