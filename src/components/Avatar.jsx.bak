
import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame, useGraph } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MeshPhysicalMaterial } from "three";
import { lerp, randInt } from "three/src/math/MathUtils.js";
import { SkeletonUtils } from "three-stdlib";
import useChatbot from "../hooks/useChatbot";

// Rhubarb mouth shapes (A-H, X) mapped to Ready Player Me visemes
const corresponding = {
  A: "viseme_PP",   // Closed mouth for M, B, P
  B: "viseme_kk",   // Slightly open mouth
  C: "viseme_I",    // Open mouth (EE, IH)
  D: "viseme_aa",   // Wide open mouth (AH)
  E: "viseme_O",    // Rounded lips (OH)
  F: "viseme_U",    // Puckered lips (OO, EW)
  G: "viseme_FF",   // Upper teeth on lower lip (F, V)
  H: "viseme_TH",   // Tongue between teeth (L, TH)
  X: "viseme_sil",  // Silence/rest position
}

export const Detective = ({ ...props }) => {
  const { scene } = useGLTF("/models/Detective.glb");
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone);

  const { animations: idleAnimation } = useFBX("animations/Idle.fbx");
  const { animations: offensiveIdleAnimation } = useFBX("animations/Offensive Idle.fbx");
  const { animations: armStretchingAnimation } = useFBX("animations/Arm Stretching.fbx");
  const { animations: neckStretchingAnimation } = useFBX("animations/Neck Stretching.fbx");
  const { animations: talkingAnimation } = useFBX("animations/Talking.fbx");
  const { animations: talkingAnimation2 } = useFBX("animations/Talking2.fbx");

  // Memoize animations to prevent re-naming on every render
  const animations = useMemo(() => {
    idleAnimation[0].name = "Idle";
    offensiveIdleAnimation[0].name = "Offensive Idle";
    armStretchingAnimation[0].name = "Arm Stretching";
    neckStretchingAnimation[0].name = "Neck Stretching";
    talkingAnimation[0].name = "Talking";
    talkingAnimation2[0].name = "Talking2";
    return [idleAnimation[0], offensiveIdleAnimation[0], armStretchingAnimation[0], neckStretchingAnimation[0], talkingAnimation[0], talkingAnimation2[0]];
  }, [idleAnimation, offensiveIdleAnimation, armStretchingAnimation, neckStretchingAnimation, talkingAnimation, talkingAnimation2]);

  const group = useRef();
  const { actions, mixer } = useAnimations(animations, group);
  const previousAction = useRef();

  const currentAudioUrl = useChatbot(state => state.currentAudio);
  const currentLipsync = useChatbot(state => state.currentLipsync);
  const setStatus = useChatbot(state => state.setStatus);
  const status = useChatbot(state => state.status);
  const isSpeaking = useChatbot(state => state.isSpeaking);

  const audio = useMemo(() => new Audio(), []);

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

  // Audio and Status Management
  useEffect(() => {
    if (currentAudioUrl) {
      audio.src = currentAudioUrl;
      audio.onplay = () => setStatus("speaking");
      audio.onended = () => setStatus("idle");

      audio.play().catch(e => {
        console.error("Audio play failed", e);
        setStatus("idle");
      });

      return () => {
        audio.pause();
        audio.onplay = null;
        audio.onended = null;
      };
    } else {
      audio.pause();
      setStatus("idle");
    }
  }, [currentAudioUrl, audio, setStatus]);

  // Animation State Management
  // Animation groups for random selection
  const talkingAnimations = useMemo(() => ["Talking", "Talking2"], []);
  const idleAnimations = useMemo(() => [
    { name: "Idle", weight: 70 },
    { name: "Offensive Idle", weight: 10 },
    { name: "Arm Stretching", weight: 15 },
    { name: "Neck Stretching", weight: 15 },
  ], []);

  const getRandomAnimation = (animations) => {
    return animations[Math.floor(Math.random() * animations.length)];
  };

  const getWeightedRandomAnimation = (weightedAnimations) => {
    const totalWeight = weightedAnimations.reduce((sum, anim) => sum + anim.weight, 0);
    let random = Math.random() * totalWeight;

    for (const anim of weightedAnimations) {
      random -= anim.weight;
      if (random <= 0) {
        return anim.name;
      }
    }
    return weightedAnimations[0].name;
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

    // Always update to force re-trigger even if same animation name
    if (nextAnim) {
      setAnimation(prev => ({
        name: nextAnim,
        runId: prev.runId + 1
      }));
    }
  }, [status, isSpeaking, talkingAnimations, idleAnimations]);

  // Handle animation playback and sequencing
  useEffect(() => {
    const action = actions[animation.name];
    if (!action) return;

    const onFinished = () => {
      // Use logic to pick next animation but wrap in setAnimation with new runId
      let nextAnimName;
      if (status === "speaking" || isSpeaking) {
        nextAnimName = getRandomAnimation(talkingAnimations);
      } else if (status === "idle") {
        nextAnimName = getWeightedRandomAnimation(idleAnimations);
      }

      if (nextAnimName) {
        setAnimation(prev => ({
          name: nextAnimName,
          runId: prev.runId + 1
        }));
      }
    };

    mixer.addEventListener('finished', onFinished);

    if (previousAction.current !== action) {
      if (previousAction.current) {
        previousAction.current.fadeOut(0.5);
      }
      action.reset().fadeIn(0.5).play();
    } else {
      // Same animation repeating: only reset if it's finished and not looping
      // For idle states, we generally want them to continue smoothly rather than snap reset
      if (!action.isRunning()) {
        action.reset().play();
      }
    }

    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    previousAction.current = action;

    return () => {
      mixer.removeEventListener('finished', onFinished);
    };
  }, [animation, actions, mixer, status, talkingAnimations, idleAnimations]);

  // Cache skinned meshes for morph target updates
  const skinnedMeshes = useMemo(() => {
    const meshes = [];
    clone.traverse((child) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        meshes.push(child);
      }
    });
    return meshes;
  }, [clone]);

  // Frame Loop: Lipsync
  useFrame(() => {
    // Helper to lerp morph target on cached meshes
    const lerpMorphTarget = (target, value, speed = 0.1) => {
      skinnedMeshes.forEach((child) => {
        const index = child.morphTargetDictionary[target];
        if (index === undefined || child.morphTargetInfluences[index] === undefined) {
          return;
        }
        child.morphTargetInfluences[index] = lerp(
          child.morphTargetInfluences[index],
          value,
          speed
        );
      });
    };

    // Lipsync
    const currentAudioTime = audio.currentTime;

    let activeViseme = "viseme_sil";
    if (status === "speaking" || isSpeaking) {
      if (currentLipsync && currentLipsync.mouthCues) {
        for (let i = 0; i < currentLipsync.mouthCues.length; i++) {
          const mouthCue = currentLipsync.mouthCues[i];
          if (currentAudioTime >= mouthCue.start && currentAudioTime <= mouthCue.end) {
            activeViseme = corresponding[mouthCue.value];
            break;
          }
        }
      } else {
        // Simulate talking for TTS
        const visemes = ["A", "B", "C", "D", "E", "F", "G", "H"];
        activeViseme = corresponding[visemes[Math.floor(Date.now() / 150) % visemes.length]];
      }
    }

    // Apply visemes
    Object.values(corresponding).forEach((viseme) => {
      // If activeViseme is silence, we want to zero out everything else, 
      // providing "viseme_sil" itself usually maps to a neutral state or specific silence shape.
      // If the model has a specific shape for silence, we lerp it to 1.
      lerpMorphTarget(viseme, viseme === activeViseme ? 1 : 0, 0.2);
    });
  });

  return (
    <group {...props} ref={group} dispose={null}>
      <primitive object={nodes.Hips} />
      <skinnedMesh geometry={nodes.Wolf3D_Glasses.geometry} material={materials.Wolf3D_Glasses} skeleton={nodes.Wolf3D_Glasses.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Headwear.geometry} material={materials.Wolf3D_Headwear} skeleton={nodes.Wolf3D_Headwear.skeleton} />
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

useGLTF.preload("/models/Detective.glb");
