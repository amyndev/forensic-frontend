import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame, useGraph } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MeshPhysicalMaterial } from "three";
import { lerp } from "three/src/math/MathUtils.js";
import { SkeletonUtils } from "three-stdlib";
import useChatbot from "../hooks/useChatbot";

// Rhubarb mouth shapes (A-H, X) mapped to Ready Player Me visemes
const corresponding = {
  A: "viseme_PP",
  B: "viseme_kk",
  C: "viseme_I",
  D: "viseme_aa",
  E: "viseme_O",
  F: "viseme_U",
  G: "viseme_FF",
  H: "viseme_TH",
  X: "viseme_sil",
};

export const Male = ({ ...props }) => {
  const { scene } = useGLTF("/models/Male.glb");
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone);

  // Load animations from male folder
  const { animations: idleAnimation } = useFBX("/animations/male/Idle.fbx");
  const { animations: offensiveIdleAnimation } = useFBX("/animations/male/Offensive Idle.fbx");
  const { animations: armStretchingAnimation } = useFBX("/animations/male/Arm Stretching.fbx");
  const { animations: neckStretchingAnimation } = useFBX("/animations/male/Neck Stretching.fbx");
  const { animations: talkingAnimation } = useFBX("/animations/male/Talking.fbx");
  const { animations: talkingAnimation2 } = useFBX("/animations/male/Talking2.fbx");

  const animations = useMemo(() => {
    idleAnimation[0].name = "Idle";
    offensiveIdleAnimation[0].name = "Offensive Idle";
    armStretchingAnimation[0].name = "Arm Stretching";
    neckStretchingAnimation[0].name = "Neck Stretching";
    talkingAnimation[0].name = "Talking";
    talkingAnimation2[0].name = "Talking2";
    return [
      idleAnimation[0],
      offensiveIdleAnimation[0],
      armStretchingAnimation[0],
      neckStretchingAnimation[0],
      talkingAnimation[0],
      talkingAnimation2[0],
    ];
  }, [idleAnimation, offensiveIdleAnimation, armStretchingAnimation, neckStretchingAnimation, talkingAnimation, talkingAnimation2]);

  const group = useRef();
  const { actions, mixer } = useAnimations(animations, group);
  const previousAction = useRef();

  const currentLipsync = useChatbot((state) => state.currentLipsync);
  const status = useChatbot((state) => state.status);
  const isSpeaking = useChatbot((state) => state.isSpeaking);

  // Apply enhanced materials
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
        child.frustumCulled = false;
        child.material = new MeshPhysicalMaterial({
          ...child.material,
          roughness: 1,
          ior: 2.2,
          iridescence: 0.7,
          iridescenceIOR: 1.3,
          reflectivity: 1,
        });
      }
    });
  }, [scene]);

  // Animation groups
  const talkingAnimations = useMemo(() => ["Talking", "Talking2"], []);
  const idleAnimations = useMemo(
    () => [
      { name: "Idle", weight: 70 },
      { name: "Offensive Idle", weight: 10 },
      { name: "Arm Stretching", weight: 15 },
      { name: "Neck Stretching", weight: 15 },
    ],
    []
  );

  const getRandomAnimation = (anims) => anims[Math.floor(Math.random() * anims.length)];

  const getWeightedRandomAnimation = (weightedAnims) => {
    const totalWeight = weightedAnims.reduce((sum, anim) => sum + anim.weight, 0);
    let random = Math.random() * totalWeight;
    for (const anim of weightedAnims) {
      random -= anim.weight;
      if (random <= 0) return anim.name;
    }
    return weightedAnims[0].name;
  };

  const [animation, setAnimation] = useState({ name: "Idle", runId: 0 });

  // Trigger animation change when status changes
  useEffect(() => {
    let nextAnim;
    if (status === "speaking" || isSpeaking) {
      nextAnim = getRandomAnimation(talkingAnimations);
    } else if (status === "idle") {
      nextAnim = getWeightedRandomAnimation(idleAnimations);
    } else if (status === "loading") {
      nextAnim = "Idle";
    }

    if (nextAnim) {
      setAnimation((prev) => ({ name: nextAnim, runId: prev.runId + 1 }));
    }
  }, [status, isSpeaking, talkingAnimations, idleAnimations]);

  // Handle animation playback
  useEffect(() => {
    const action = actions[animation.name];
    if (!action) return;

    const onFinished = () => {
      let nextAnimName;
      if (status === "speaking" || isSpeaking) {
        nextAnimName = getRandomAnimation(talkingAnimations);
      } else if (status === "idle") {
        nextAnimName = getWeightedRandomAnimation(idleAnimations);
      }
      if (nextAnimName) {
        setAnimation((prev) => ({ name: nextAnimName, runId: prev.runId + 1 }));
      }
    };

    mixer.addEventListener("finished", onFinished);

    if (previousAction.current !== action) {
      if (previousAction.current) previousAction.current.fadeOut(0.5);
      action.reset().fadeIn(0.5).play();
    } else if (!action.isRunning()) {
      action.reset().play();
    }

    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    previousAction.current = action;

    return () => mixer.removeEventListener("finished", onFinished);
  }, [animation, actions, mixer, status, talkingAnimations, idleAnimations]);

  // Cache skinned meshes for morph targets
  const skinnedMeshes = useMemo(() => {
    const meshes = [];
    clone.traverse((child) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        meshes.push(child);
      }
    });
    return meshes;
  }, [clone]);

  // Lipsync frame loop (simulated for TTS)
  useFrame(() => {
    const lerpMorphTarget = (target, value, speed = 0.1) => {
      skinnedMeshes.forEach((child) => {
        const index = child.morphTargetDictionary[target];
        if (index !== undefined && child.morphTargetInfluences[index] !== undefined) {
          child.morphTargetInfluences[index] = lerp(child.morphTargetInfluences[index], value, speed);
        }
      });
    };

    let activeViseme = "viseme_sil";

    if (isSpeaking) {
      // Simulate talking - cycle through visemes
      const visemes = ["A", "B", "C", "D", "E", "F", "G", "H"];
      activeViseme = corresponding[visemes[Math.floor(Date.now() / 150) % visemes.length]];
    }

    Object.values(corresponding).forEach((viseme) => {
      lerpMorphTarget(viseme, viseme === activeViseme ? 1 : 0, 0.2);
    });
  });

  return (
    <group {...props} ref={group} dispose={null}>
      <primitive object={nodes.Hips} />
      <skinnedMesh geometry={nodes.Wolf3D_Hair.geometry} material={materials.Wolf3D_Hair} skeleton={nodes.Wolf3D_Hair.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Glasses.geometry} material={materials.Wolf3D_Glasses} skeleton={nodes.Wolf3D_Glasses.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Body.geometry} material={materials.Wolf3D_Body} skeleton={nodes.Wolf3D_Body.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Bottom.geometry} material={materials.Wolf3D_Outfit_Bottom} skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Footwear.geometry} material={materials.Wolf3D_Outfit_Footwear} skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Top.geometry} material={materials.Wolf3D_Outfit_Top} skeleton={nodes.Wolf3D_Outfit_Top.skeleton} />
      <skinnedMesh name="EyeLeft" geometry={nodes.EyeLeft.geometry} material={materials.Wolf3D_Eye} skeleton={nodes.EyeLeft.skeleton} morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary} morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences} />
      <skinnedMesh name="EyeRight" geometry={nodes.EyeRight.geometry} material={materials.Wolf3D_Eye} skeleton={nodes.EyeRight.skeleton} morphTargetDictionary={nodes.EyeRight.morphTargetDictionary} morphTargetInfluences={nodes.EyeRight.morphTargetInfluences} />
      <skinnedMesh name="Wolf3D_Head" geometry={nodes.Wolf3D_Head.geometry} material={materials.Wolf3D_Skin} skeleton={nodes.Wolf3D_Head.skeleton} morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences} />
      <skinnedMesh name="Wolf3D_Teeth" geometry={nodes.Wolf3D_Teeth.geometry} material={materials.Wolf3D_Teeth} skeleton={nodes.Wolf3D_Teeth.skeleton} morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences} />
    </group>
  );
};

useGLTF.preload("/models/Male.glb");
useFBX.preload("/animations/male/Idle.fbx");
useFBX.preload("/animations/male/Offensive Idle.fbx");
useFBX.preload("/animations/male/Arm Stretching.fbx");
useFBX.preload("/animations/male/Neck Stretching.fbx");
useFBX.preload("/animations/male/Talking.fbx");
useFBX.preload("/animations/male/Talking2.fbx");
