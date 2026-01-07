import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Image, 
  StyleSheet, 
  Animated, 
  Dimensions, 
  StatusBar,
  Text
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
  // Optimized animation values with native driver support
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    Array.from({ length: 8 }, () => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.5),
    }))
  ).current;

  useEffect(() => {
    // Optimized animation sequence with native driver
    const startAnimations = () => {
      // Initial entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(slideUpAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous pulse animation
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      // Rotation animation
      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );

      // Progress bar animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false, // Width animation requires layout
      }).start();

      // Shimmer effect
      const shimmerLoop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );

      // Staggered particle animations
      const particleAnimations = particleAnims.map((particle, index) => 
        Animated.stagger(100, [
          Animated.timing(particle.opacity, {
            toValue: 1,
            duration: 500,
            delay: index * 100,
            useNativeDriver: true,
          }),
          Animated.timing(particle.scale, {
            toValue: 1,
            duration: 500,
            delay: index * 100,
            useNativeDriver: true,
          }),
          Animated.loop(
            Animated.sequence([
              Animated.timing(particle.translateY, {
                toValue: -20,
                duration: 3000 + (index * 200),
                useNativeDriver: true,
              }),
              Animated.timing(particle.translateY, {
                toValue: 0,
                duration: 3000 + (index * 200),
                useNativeDriver: true,
              }),
            ])
          ),
        ])
      );

      // Start all animations
      pulseLoop.start();
      rotateLoop.start();
      shimmerLoop.start();
      Animated.parallel(particleAnimations.flat()).start();
    };

    startAnimations();

    // Auto navigate with exit animation
   const timer = setTimeout(() => {
  navigation.replace('Dashboard');
}, 2500);


    return () => clearTimeout(timer);
  }, []);

  // Optimized interpolations
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Enhanced gradient background */}
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated background overlay */}
      <Animated.View style={[styles.backgroundOverlay, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.1)', 'transparent', 'rgba(255,255,255,0.05)']}
          style={styles.overlayGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Floating particles */}
      {particleAnims.map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              left: `${10 + (index * 10)}%`,
              top: `${20 + (index * 8)}%`,
              opacity: particle.opacity,
              transform: [
                { translateY: particle.translateY },
                { scale: particle.scale },
              ],
            },
          ]}
        />
      ))}

      {/* Main content container */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideUpAnim },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        {/* Logo container with enhanced effects */}
        <View style={styles.logoContainer}>
          {/* Rotating outer ring */}
          <Animated.View
            style={[
              styles.outerRing,
              {
                transform: [
                  { rotate: rotateInterpolate },
                  { scale: pulseAnim },
                ],
              },
            ]}
          />

          {/* Inner glow effect */}
          <Animated.View
            style={[
              styles.glowContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)', 'transparent']}
              style={styles.glowGradient}
            />
          </Animated.View>

          {/* Logo with shimmer effect */}
          <View style={styles.logoWrapper}>
            <Image 
              source={require('../../assets/Logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            
            {/* Shimmer overlay */}
            <Animated.View
              style={[
                styles.shimmerOverlay,
                {
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.6)', 'transparent']}
                style={styles.shimmerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </Animated.View>
          </View>
        </View>

        {/* App name with elegant typography */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
        <Text style={styles.appName}>DR. BSK's PHARMA</Text>
<Text style={styles.tagline}>On-Time, Every Time — Because Health Can’t Wait</Text>

        </Animated.View>

        {/* Enhanced progress indicator */}
        <Animated.View
          style={[
            styles.progressContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressWidth,
                },
              ]}
            >
              <LinearGradient
                colors={['#ff6b6b', '#feca57', '#48dbfb']}
                style={styles.progressGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </Animated.View>
          </View>
          <Text style={styles.loadingText}>Loading...</Text>
        </Animated.View>
      </Animated.View>

      {/* Decorative elements */}
      <Animated.View
        style={[
          styles.decorativeElement1,
          {
            opacity: fadeAnim,
            transform: [{ rotate: rotateInterpolate }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.decorativeElement2,
          {
            opacity: fadeAnim,
            transform: [{ rotate: rotateInterpolate }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayGradient: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  outerRing: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderStyle: 'dashed',
  },
  glowContainer: {
    position: 'absolute',
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
  },
  glowGradient: {
    flex: 1,
    borderRadius: width * 0.2,
  },
  logoWrapper: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  logo: {
    width: width * 0.2,
    height: width * 0.2,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: -width * 0.1,
    width: width * 0.1,
    height: '100%',
  },
  shimmerGradient: {
    flex: 1,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 1,
  },
  progressContainer: {
    alignItems: 'center',
    width: width * 0.6,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressGradient: {
    flex: 1,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 12,
    letterSpacing: 1,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  decorativeElement1: {
    position: 'absolute',
    top: height * 0.15,
    right: width * 0.1,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  decorativeElement2: {
    position: 'absolute',
    bottom: height * 0.2,
    left: width * 0.1,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
});

export default SplashScreen;