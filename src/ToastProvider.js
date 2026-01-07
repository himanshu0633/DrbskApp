import React, { createContext, useState, useRef, useCallback, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import {
  CheckCircle,
  AlertCircle,
  X,
  Info,
  ShoppingBag,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Toast Context
const ToastContext = createContext();

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    // Clear existing toast
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setToast(null);
    }

    // Create new toast
    const newToast = {
      id: Date.now(),
      message,
      type,
      duration,
    };

    setToast(newToast);

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after duration
    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  }, [fadeAnim, slideAnim]);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    });
  }, [fadeAnim, slideAnim]);

  const showSuccess = useCallback((message, duration = 3000) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message, duration = 3000) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showWarning = useCallback((message, duration = 3000) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const showInfo = useCallback((message, duration = 3000) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const showCartAdded = useCallback((productName, duration = 3000) => {
    showToast(`${productName} added to cart`, 'success', duration);
  }, [showToast]);

  // Get icon based on toast type
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={22} color="#fff" />;
      case 'error':
        return <AlertCircle size={22} color="#fff" />;
      case 'warning':
        return <AlertCircle size={22} color="#fff" />;
      case 'info':
        return <Info size={22} color="#fff" />;
      case 'cart':
        return <ShoppingBag size={22} color="#fff" />;
      default:
        return <Info size={22} color="#fff" />;
    }
  };

  // Get background color based on toast type
  const getBackgroundColor = (type) => {
    switch (type) {
      case 'success':
        return '#FF6B00'; // Orange
      case 'error':
        return '#FF4444'; // Red
      case 'warning':
        return '#FF9800'; // Orange
      case 'info':
        return '#2196F3'; // Blue
      case 'cart':
        return '#FF6B00'; // Orange
      default:
        return '#333'; // Dark gray
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showCartAdded,
        hideToast,
      }}
    >
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.toast,
              { backgroundColor: getBackgroundColor(toast.type) },
            ]}
          >
            <View style={styles.toastContent}>
              <View style={styles.toastIcon}>
                {getIcon(toast.type)}
              </View>
              <Text style={styles.toastMessage} numberOfLines={2}>
                {toast.message}
              </Text>
            </View>
            <TouchableOpacity
              onPress={hideToast}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

// Custom hook to use toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Toast styles
const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  toast: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  toastContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  toastIcon: {
    marginRight: 12,
  },
  toastMessage: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
  },
});

// Toast types constants
export const ToastType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  CART: 'cart',
};

export default ToastProvider;