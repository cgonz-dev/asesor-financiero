import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMobileApp } from '../../src/application/mobile-app-provider';
import { useReducedMotion } from '../../src/ui/motion';
import { colors, fontFamilies } from '../../src/ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  activeIcon,
  color,
  focused,
  icon,
  size,
}: {
  activeIcon: IconName;
  color: ColorValue;
  focused: boolean;
  icon: IconName;
  size: number;
}) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(focused ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(focused ? 1 : 0);
      return;
    }

    Animated.spring(progress, {
      damping: 17,
      mass: 0.55,
      stiffness: 300,
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [focused, progress, reducedMotion]);

  return (
    <Animated.View
      style={[
        styles.tabIcon,
        {
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.1],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -2],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View style={[styles.tabIconGlow, { opacity: progress }]} />
      <Ionicons color={color} name={focused ? activeIcon : icon} size={size} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { session } = useMobileApp();
  const insets = useSafeAreaInsets();

  if (session.status !== 'authenticated') {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        animation: 'shift',
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accentCyan,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: {
          fontFamily: fontFamilies.semibold,
          fontSize: 11,
          marginTop: 3,
        },
        tabBarItemStyle: {
          paddingTop: 3,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              activeIcon="home"
              color={color}
              focused={focused}
              icon="home-outline"
              size={size}
            />
          ),
          title: 'Inicio',
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              activeIcon="people"
              color={color}
              focused={focused}
              icon="people-outline"
              size={size}
            />
          ),
          title: 'Hogar',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              activeIcon="person-circle"
              color={color}
              focused={focused}
              icon="person-circle-outline"
              size={size}
            />
          ),
          title: 'Perfil',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 44,
  },
  tabIconGlow: {
    backgroundColor: 'rgba(45, 212, 191, 0.14)',
    borderRadius: 16,
    height: 30,
    position: 'absolute',
    width: 44,
  },
});
