import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Animated,
  Image,
  Share,
  Linking,
  Dimensions,
  Platform,
  Easing,
} from 'react-native';
import { 
  CheckCircle, 
  Home, 
  Package, 
  Mail, 
  Phone, 
  MapPin, 
  Clock,
  Calendar,
  Shield,
  ChevronRight,
  Download,
  Share2,
  MessageCircle,
  Truck,
  CreditCard,
  FileText,
  ShoppingBag,
  User,
  AlertCircle,
  ArrowLeft,
  Star
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const OrderConfirmation = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  const {
    orderId,
    email,
    amount,
    items,
    address,
    phone,
    name,
    orderDetails = {}
  } = route.params || {};

  const orderItems = Array.isArray(items) ? items : [];
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  
  // Confetti particles
  const [confettiParticles, setConfettiParticles] = useState([]);

  useEffect(() => {
    // Create confetti particles
    const particles = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: -20,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.5,
      speed: 2 + Math.random() * 3,
      color: ['#FFD700', '#FF6B6B', '#4CAF50', '#2196F3', '#9C27B0'][Math.floor(Math.random() * 5)],
    }));
    setConfettiParticles(particles);

    // Start confetti animation
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 3000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Main animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();

    // Pulse animation for order ID
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Auto hide confetti after 5 seconds
    const timer = setTimeout(() => {
      Animated.timing(confettiAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleBackToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };

  const handleShareOrder = async () => {
    try {
      await Share.share({
        message: `I just placed an order! 🎉\nOrder ID: ${orderId?.slice(-8) || 'N/A'}\nTotal: ₹${amount?.toFixed(2) || '0.00'}`,
        title: 'Check out my order!',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleContactSupport = () => {
    const phoneNumber = '+919115513759';
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmailSupport = () => {
    const email = 'ukgermanpharmaceutical@gmail.com';
    Linking.openURL(`mailto:${email}`);
  };

  const handleDownloadInvoice = () => {
    alert('Invoice download feature coming soon!');
  };

  const formatDate = (dateString) => {
    if (!dateString) return new Date().toLocaleDateString();
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return new Date().toLocaleDateString();
    }
  };

  const getEstimatedDelivery = () => {
    const today = new Date();
    const deliveryDate = new Date(today);
    deliveryDate.setDate(deliveryDate.getDate() + 5);
    
    return deliveryDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderConfetti = () => {
    return confettiParticles.map((particle) => {
      const translateY = confettiAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [particle.y, height],
      });

      const opacity = confettiAnim.interpolate({
        inputRange: [0, 0.8, 1],
        outputRange: [0, 1, 0],
      });

      return (
        <Animated.View
          key={particle.id}
          style={[
            styles.confettiParticle,
            {
              backgroundColor: particle.color,
              left: particle.x,
              transform: [
                { translateY },
                { rotate: `${particle.rotation}deg` },
                { scale: particle.scale },
              ],
              opacity,
            },
          ]}
        />
      );
    });
  };

  const renderOrderTimeline = () => {
    const timelineSteps = [
      {
        id: 1,
        title: 'Order Placed',
        status: 'completed',
        icon: <ShoppingBag size={20} color="#4CAF50" />,
        time: 'Just now',
      },
      {
        id: 2,
        title: 'Order Confirmed',
        status: 'pending',
        icon: <CheckCircle size={20} color="#2196F3" />,
        time: 'Within 24 hours',
      },
      {
        id: 3,
        title: 'Processing',
        status: 'pending',
        icon: <Package size={20} color="#FF9800" />,
        time: '1-2 business days',
      },
      {
        id: 4,
        title: 'Shipped',
        status: 'pending',
        icon: <Truck size={20} color="#9C27B0" />,
        time: 'Estimated delivery',
      },
      {
        id: 5,
        title: 'Delivered',
        status: 'pending',
        icon: <CheckCircle size={20} color="#4CAF50" />,
        time: getEstimatedDelivery(),
      },
    ];

    return (
      <Animated.View 
        style={[
          styles.timelineCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.timelineHeader}>
          <Clock size={24} color="#FF9800" />
          <Text style={styles.timelineTitle}>Order Timeline</Text>
        </View>
        
        {timelineSteps.map((step, index) => (
          <View key={step.id} style={styles.timelineStep}>
            <View style={styles.timelineConnector}>
              <Animated.View 
                style={[
                  styles.timelineDot,
                  step.status === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending,
                  {
                    transform: [{ scale: step.status === 'completed' ? pulseAnim : 1 }]
                  }
                ]}
              >
                {step.icon}
              </Animated.View>
              {index < timelineSteps.length - 1 && (
                <View style={styles.timelineLine} />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStepTitle}>{step.title}</Text>
              <Text style={styles.timelineStepTime}>{step.time}</Text>
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderQuickActions = () => (
    <Animated.View 
      style={[
        styles.quickActionsContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Text style={styles.quickActionsTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={handleDownloadInvoice}
        >
          <Animated.View 
            style={[
              styles.quickActionIcon,
              { backgroundColor: '#4CAF50' },
              { transform: [{ scale: scaleAnim }] }
            ]}
          >
            <Download size={24} color="#fff" />
          </Animated.View>
          <Text style={styles.quickActionText}>Invoice</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={handleShareOrder}
        >
          <Animated.View 
            style={[
              styles.quickActionIcon,
              { backgroundColor: '#2196F3' }
            ]}
          >
            <Share2 size={24} color="#fff" />
          </Animated.View>
          <Text style={styles.quickActionText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Orders')}
        >
          <Animated.View 
            style={[
              styles.quickActionIcon,
              { backgroundColor: '#FF9800' }
            ]}
          >
            <Package size={24} color="#fff" />
          </Animated.View>
          <Text style={styles.quickActionText}>Track</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={handleContactSupport}
        >
          <Animated.View 
            style={[
              styles.quickActionIcon,
              { backgroundColor: '#F47B20' }
            ]}
          >
            <MessageCircle size={24} color="#fff" />
          </Animated.View>
          <Text style={styles.quickActionText}>Support</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderOrderItems = () => {
    if (orderItems.length === 0) return null;

    return (
      <Animated.View 
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <ShoppingBag size={24} color="#9C27B0" />
          <Text style={styles.cardTitle}>Order Items</Text>
        </View>
        {orderItems.slice(0, 3).map((item, index) => (
          <Animated.View 
            key={index} 
            style={[
              styles.orderItem,
              {
                opacity: fadeAnim,
                transform: [{ translateX: index % 2 === 0 ? slideAnim : Animated.multiply(slideAnim, -1) }]
              }
            ]}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name || `Item ${index + 1}`}
              </Text>
              <Text style={styles.itemDetails}>
                Qty: {item.quantity || 1} × ₹{item.price || 0}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              ₹{((item.quantity || 1) * (item.price || 0)).toFixed(2)}
            </Text>
          </Animated.View>
        ))}
        {orderItems.length > 3 && (
          <TouchableOpacity 
            style={styles.viewMoreButton}
            onPress={() => navigation.navigate('Orders')}
          >
            <Text style={styles.viewMoreText}>
              View all {orderItems.length} items
            </Text>
            <ChevronRight size={16} color="#F47B20" />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const renderPaymentInfo = () => (
    <Animated.View 
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.cardHeader}>
        <CreditCard size={24} color="#2196F3" />
        <Text style={styles.cardTitle}>Payment Information</Text>
      </View>
      <View style={styles.paymentRow}>
        <Text style={styles.paymentLabel}>Payment Method:</Text>
        <Text style={styles.paymentValue}>{orderDetails.paymentMethod || 'Credit Card'}</Text>
      </View>
      <View style={styles.paymentRow}>
        <Text style={styles.paymentLabel}>Transaction ID:</Text>
        <Text style={styles.paymentValue}>{orderDetails.paymentId?.slice(-12) || 'N/A'}</Text>
      </View>
      <View style={styles.paymentRow}>
        <Text style={styles.paymentLabel}>Status:</Text>
        <Animated.View 
          style={[
            styles.paymentStatus,
            { backgroundColor: '#E8F5E9' },
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <CheckCircle size={14} color="#4CAF50" />
          <Text style={[styles.paymentStatusText, { color: '#4CAF50' }]}>
            Paid
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4CAF50" barStyle="light-content" />
      
      {/* Custom Confetti */}
      {renderConfetti()}

      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.successHeader,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.headerBackground} />
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.successContent}>
          <Animated.View 
            style={[
              styles.iconContainer,
              {
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <CheckCircle size={80} color="#4CAF50" />
            <Animated.View 
              style={[
                styles.sparkleEffect,
                {
                  transform: [
                    { rotate: pulseAnim.interpolate({
                      inputRange: [1, 1.1],
                      outputRange: ['0deg', '360deg']
                    })}
                  ]
                }
              ]}
            >
              <Star size={20} color="#FFD700" />
            </Animated.View>
          </Animated.View>
          <Text style={styles.successTitle}>Order Confirmed! 🎉</Text>
          <Text style={styles.successSubtitle}>
            Thank you for your purchase. Your order #{orderId?.slice(-8) || 'N/A'} has been placed successfully.
          </Text>
        </View>

        {/* Animated order ID badge */}
        <Animated.View 
          style={[
            styles.orderIdBadge,
            {
              transform: [{ scale: pulseAnim }]
            }
          ]}
        >
          <Text style={styles.orderIdText}>
            {orderId?.slice(-8) || 'N/A'}
          </Text>
        </Animated.View>
      </Animated.View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Estimated Delivery Card */}
        <Animated.View 
          style={[
            styles.etaCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.etaHeader}>
            <Truck size={28} color="#F47B20" />
            <View style={styles.etaContent}>
              <Text style={styles.etaTitle}>Estimated Delivery</Text>
              <Text style={styles.etaDate}>{getEstimatedDelivery()}</Text>
            </View>
          </View>
          <Text style={styles.etaNote}>
            Your order will be delivered within 3-5 business days
          </Text>
        </Animated.View>

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Order Summary */}
        <Animated.View 
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.cardHeader}>
            <FileText size={24} color="#F47B20" />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Order ID</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {orderId || 'N/A'}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.amountSymbol}>₹</Text>
                <Text style={styles.amountValue}>
                  {amount?.toFixed(2) || '0.00'}
                </Text>
              </View>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Items</Text>
              <Text style={styles.summaryValue}>
                {orderItems.length || 0} item(s)
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Order Date</Text>
              <Text style={styles.summaryValue}>
                {formatDate(orderDetails.createdAt)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Order Items */}
        {renderOrderItems()}

        {/* Payment Information */}
        {renderPaymentInfo()}

        {/* Timeline */}
        {renderOrderTimeline()}

        {/* Customer Details */}
        <Animated.View 
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.cardHeader}>
            <User size={24} color="#4CAF50" />
            <Text style={styles.cardTitle}>Customer Details</Text>
          </View>
          
          <View style={styles.customerGrid}>
            <View style={styles.customerItem}>
              <Mail size={18} color="#666" />
              <Text style={styles.customerLabel}>Email</Text>
              <Text style={styles.customerValue} numberOfLines={1}>
                {email || 'N/A'}
              </Text>
            </View>
            
            <View style={styles.customerItem}>
              <User size={18} color="#666" />
              <Text style={styles.customerLabel}>Name</Text>
              <Text style={styles.customerValue}>{name || 'N/A'}</Text>
            </View>
            
            <View style={styles.customerItem}>
              <Phone size={18} color="#666" />
              <Text style={styles.customerLabel}>Phone</Text>
              <Text style={styles.customerValue}>{phone || 'N/A'}</Text>
            </View>
            
            {address && (
              <View style={styles.customerItem}>
                <MapPin size={18} color="#666" />
                <Text style={styles.customerLabel}>Address</Text>
                <Text style={styles.customerValue} numberOfLines={2}>
                  {address}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Support Card */}
        <Animated.View 
          style={[
            styles.supportCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.supportHeader}>
            <AlertCircle size={24} color="#F47B20" />
            <Text style={styles.supportTitle}>Need Help?</Text>
          </View>
          <View style={styles.supportButtons}>
            <TouchableOpacity 
              style={styles.supportButton}
              onPress={handleContactSupport}
            >
              <Phone size={20} color="#fff" />
              <Text style={styles.supportButtonText}>Call Support</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.supportButton, styles.emailButton]}
              onPress={handleEmailSupport}
            >
              <Mail size={20} color="#fff" />
              <Text style={styles.supportButtonText}>Email Us</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View 
          style={[
            styles.buttonContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Orders')}
          >
            <Package size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>View My Orders</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleBackToHome}
          >
            <Home size={22} color="#F47B20" />
            <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            Thank you for shopping with us! ❤️
          </Text>
          <Text style={styles.footerContact}>
            UK German Pharmaceuticals | ukgermanpharmaceutical@gmail.com
          </Text>
          <Text style={styles.footerPhone}>
            +91-911-551-3759
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f9',
  },
  confettiParticle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 1000,
  },
  successHeader: {
    backgroundColor: '#4CAF50',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 40,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  headerBackground: {
    position: 'absolute',
    top: -100,
    left: -100,
    right: -100,
    height: 400,
    backgroundColor: '#4CAF50',
    transform: [{ rotate: '-5deg' }],
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  successContent: {
    alignItems: 'center',
    zIndex: 2,
  },
  iconContainer: {
    backgroundColor: '#fff',
    borderRadius: 50,
    padding: 15,
    marginBottom: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    position: 'relative',
  },
  sparkleEffect: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  successSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    paddingHorizontal: 30,
    maxWidth: 400,
  },
  orderIdBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 10,
  },
  orderIdText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  etaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F47B20',
  },
  etaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  etaContent: {
    marginLeft: 15,
  },
  etaTitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  etaDate: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F47B20',
  },
  etaNote: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 5,
  },
  quickActionsContainer: {
    marginBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    alignItems: 'center',
    width: (width - 32) / 4 - 12,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  quickActionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    marginBottom: 15,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountSymbol: {
    fontSize: 14,
    color: '#F47B20',
    marginRight: 2,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F47B20',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: '#666',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F47B20',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  viewMoreText: {
    color: '#F47B20',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentLabel: {
    fontSize: 15,
    color: '#666',
    flex: 1,
  },
  paymentValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  paymentStatusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  timelineCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineConnector: {
    width: 40,
    alignItems: 'center',
    marginRight: 15,
  },
  timelineDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  timelineDotCompleted: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  timelineDotPending: {
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 5,
    marginBottom: 5,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  timelineStepTime: {
    fontSize: 14,
    color: '#666',
  },
  customerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  customerItem: {
    width: '48%',
    marginBottom: 15,
  },
  customerLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    marginBottom: 2,
  },
  customerValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  supportCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E65100',
    marginLeft: 12,
  },
  supportButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  supportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F47B20',
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 8,
  },
  emailButton: {
    backgroundColor: '#4CAF50',
    marginRight: 0,
    marginLeft: 8,
  },
  supportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F47B20',
    borderRadius: 12,
    paddingVertical: 18,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: '#F47B20',
  },
  secondaryButtonText: {
    color: '#F47B20',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerNote: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  footerContact: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerPhone: {
    fontSize: 14,
    color: '#F47B20',
    fontWeight: '600',
  },
});

export default OrderConfirmation;