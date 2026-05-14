import React, { useRef } from 'react';
import { View, StyleSheet, Animated, PanResponder, Text } from 'react-native';
const Joystick = ({ onMove }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const loopRef = useRef(null);
  const positionRef = useRef({ x: 0, y: 0 }); 
  const startLoop = () => {
    if (loopRef.current) return;
    loopRef.current = setInterval(() => {
      const { x, y } = positionRef.current;
      if (Math.abs(x) > 10 || Math.abs(y) > 10) {
        const dx = Math.max(-50, Math.min(50, x)) / 50;
        const dy = Math.max(-50, Math.min(50, y)) / 50;
        onMove(dx, dy);
      }
    }, 100);
  };
  const stopLoop = () => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    positionRef.current = { x: 0, y: 0 };
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
        startLoop();
      },
      onPanResponderMove: (e, gestureState) => {
        let newX = gestureState.dx;
        let newY = gestureState.dy;
        const distance = Math.sqrt(newX * newX + newY * newY);
        if (distance > 50) {
          newX = (newX / distance) * 50;
          newY = (newY / distance) * 50;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(e, gestureState);
        positionRef.current = { x: newX, y: newY };
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          useNativeDriver: false,
        }).start();
        stopLoop();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        stopLoop();
      }
    })
  ).current;
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>TELEOP DRAG</Text>
      <View style={styles.base}>
        <View style={styles.gridLines} />
        <Animated.View
          style={[styles.knob, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.knobInner} />
        </Animated.View>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  title: {
    color: '#0ff', fontSize: 10, fontWeight: 'bold', marginBottom: 10,
    textShadowColor: '#0ff', textShadowRadius: 10, letterSpacing: 1
  },
  base: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(10, 15, 25, 0.7)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(0, 255, 255, 0.3)',
    shadowColor: '#0ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 15,
  },
  gridLines: {
    position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(0,255,255,0.1)'
  },
  knob: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#111',
    borderWidth: 2, borderColor: '#0ff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10,
  },
  knobInner: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,255,255,0.5)'
  }
});
export default Joystick;
