import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

const useNativeDriver = Platform.OS !== 'web';

export const motionDurations = {
  enter: 460,
  quick: 180,
  stagger: 65,
} as const;

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReducedMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

export function useRevealMotion(delay = 0) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      delay,
      duration: motionDurations.enter,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver,
    });

    animation.start();
    return () => animation.stop();
  }, [delay, progress, reducedMotion]);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };
}

export function usePressMotion(pressedScale = 0.975) {
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const setPressed = (pressed: boolean) => {
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }

    Animated.spring(scale, {
      damping: 18,
      mass: 0.55,
      stiffness: 360,
      toValue: pressed ? pressedScale : 1,
      useNativeDriver,
    }).start();
  };

  return {
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
    style: { transform: [{ scale }] },
  };
}

export function useAmbientMotion(reverse = false) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          duration: 7200,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver,
        }),
        Animated.timing(progress, {
          duration: 7200,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const direction = reverse ? -1 : 1;

  return {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 18 * direction],
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -12 * direction],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.06],
        }),
      },
    ],
  };
}
