import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const pressed = 0.97;
const spring = { damping: 18, stiffness: 420, mass: 0.6 };

/**
 * Subtle press-in scale for buttons. Apply `style` to an Animated.View wrapping the
 * Pressable and pass the handlers to it. Honors the system reduced-motion setting.
 */
export function usePressScale(disabled = false) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const active = !disabled && !reduceMotion;
  return {
    style,
    onPressIn: () => {
      if (active) scale.value = withSpring(pressed, spring);
    },
    onPressOut: () => {
      scale.value = withSpring(1, spring);
    },
  };
}
