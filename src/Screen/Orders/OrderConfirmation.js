import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
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
  Shield
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

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

  const handleBackToHome = () => {
    // Navigate to home and reset navigation stack
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4CAF50" barStyle="light-content" />
      
      {/* Success Header */}
      <View style={styles.successHeader}>
        <View style={styles.iconContainer}>
          <CheckCircle size={80} color="#fff" />
        </View>
        <Text style={styles.successTitle}>Order Confirmed!</Text>
        <Text style={styles.successSubtitle}>
          Thank you for your purchase. Your order has been placed successfully.
        </Text>
        <Text style={styles.orderId}>
          Order ID: {orderId?.slice(-8) || 'N/A'}
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Order Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={24} color="#2196F3" />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order ID:</Text>
            <Text style={styles.detailValue}>{orderId || 'N/A'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Amount:</Text>
            <Text style={[styles.detailValue, styles.amountText]}>
              ₹{amount?.toFixed(2) || '0.00'}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Items:</Text>
            <Text style={styles.detailValue}>{items || 0} item(s)</Text>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.iconLabel}>
              <Calendar size={18} color="#666" />
              <Text style={styles.detailLabel}>Order Date:</Text>
            </View>
            <Text style={styles.detailValue}>
              {formatDate(orderDetails.createdAt)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {orderDetails.status || 'Processing'}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Shield size={24} color="#4CAF50" />
            <Text style={styles.cardTitle}>Customer Details</Text>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.iconLabel}>
              <Mail size={18} color="#666" />
              <Text style={styles.detailLabel}>Email:</Text>
            </View>
            <Text style={styles.detailValue} numberOfLines={1}>
              {email || 'N/A'}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name:</Text>
            <Text style={styles.detailValue}>{name || 'N/A'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.iconLabel}>
              <Phone size={18} color="#666" />
              <Text style={styles.detailLabel}>Phone:</Text>
            </View>
            <Text style={styles.detailValue}>{phone || 'N/A'}</Text>
          </View>
        </View>

        {/* Delivery Address Card */}
        {address && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={24} color="#F47B20" />
              <Text style={styles.cardTitle}>Delivery Address</Text>
            </View>
            <View style={styles.addressContainer}>
              <Text style={styles.addressText}>{address}</Text>
            </View>
          </View>
        )}

        {/* Next Steps Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Clock size={24} color="#FF9800" />
            <Text style={styles.infoTitle}>What Happens Next?</Text>
          </View>
          <View style={styles.infoContent}>
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>
                Order confirmation email sent to {email || 'your email'}
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>
                Our team will process your order within 24 hours
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>
                You can track your order using the Order ID
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>
                Delivery expected within 3-5 business days
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Orders')}
          >
            <Text style={styles.primaryButtonText}>View My Orders</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleBackToHome}
          >
            <Home size={20} color="#F47B20" />
            <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
        
        {/* Footer Note */}
        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            Need help with your order?
          </Text>
          <Text style={styles.footerContact}>
            Contact us: ukgermanpharmaceutical@gmail.com | +91-911-551-3759
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
  successHeader: {
    backgroundColor: '#4CAF50',
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 50,
    padding: 10,
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  orderId: {
    fontSize: 14,
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginLeft: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
    marginLeft: 8,
  },
  detailValue: {
    fontSize: 15,
    color: '#000',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  amountText: {
    fontSize: 18,
    color: '#F47B20',
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  addressContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#E65100',
    marginLeft: 12,
  },
  infoContent: {
    marginLeft: 4,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9800',
    marginTop: 8,
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#5D4037',
    lineHeight: 22,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#F47B20',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#F47B20',
  },
  secondaryButtonText: {
    color: '#F47B20',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerNote: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  footerContact: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default OrderConfirmation;