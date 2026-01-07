import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../Components/AxiosInstance';
import { 
  Package, 
  Calendar, 
  Clock, 
  IndianRupee, 
  MapPin, 
  Phone,
  ShoppingBag,
  AlertCircle 
} from 'lucide-react-native';

const OrdersScreen = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserAndOrders();
  }, []);

  const fetchUserAndOrders = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser !== null) {
        const parsedUser = JSON.parse(storedUser);
        const userId = parsedUser._id;

        const response = await axiosInstance.get(`/api/orders/${userId}`);
        console.log('API Response:', response.data);
        setOrders(response.data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#F59E0B';
      case 'confirmed':
        return '#3B82F6';
      case 'shipped':
        return '#8B5CF6';
      case 'delivered':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock size={16} color="#F59E0B" />;
      case 'confirmed':
        return <Package size={16} color="#3B82F6" />;
      case 'shipped':
        return <Package size={16} color="#8B5CF6" />;
      case 'delivered':
        return <Package size={16} color="#10B981" />;
      case 'cancelled':
        return <AlertCircle size={16} color="#EF4444" />;
      default:
        return <Package size={16} color="#6B7280" />;
    }
  };

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderCard}>
      {/* Order Header */}
      <View style={styles.orderHeader}>
        <View style={styles.orderIdContainer}>
          <ShoppingBag size={20} color="#6366F1" />
          <Text style={styles.orderId}>#{item._id.slice(-8).toUpperCase()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          {getStatusIcon(item.status)}
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>

      {/* Order Date */}
      <View style={styles.infoRow}>
        <Calendar size={16} color="#6B7280" />
        <Text style={styles.infoText}>
          {new Date(item.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>

      {/* Items Section */}
      <View style={styles.itemsSection}>
        <Text style={styles.sectionTitle}>Items ({item.items.length})</Text>
        {item.items.map((product, index) => (
          <View key={product._id || index} style={styles.productItem}>
            {/* <Image
              source={{
                uri: product.image || 'https://cdn.pixabay.com/photo/2014/04/02/10/53/shopping-cart-304843_640.png'
              }}
              style={styles.productImage}
              defaultSource={{ uri: 'https://cdn.pixabay.com/photo/2014/04/02/10/53/shopping-cart-304843_640.png' }}
            /> */}
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              <View style={styles.productMeta}>
                <Text style={styles.productQuantity}>Qty: {product.quantity}</Text>
                <Text style={styles.productPrice}>₹{product.price}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Address Section */}
      <View style={styles.addressSection}>
        <View style={styles.infoRow}>
          <MapPin size={16} color="#6B7280" />
          <Text style={styles.addressText} numberOfLines={2}>
            {item.address}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Phone size={16} color="#6B7280" />
          <Text style={styles.infoText}>{item.phone}</Text>
        </View>
      </View>

      {/* Order Total */}
      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <IndianRupee size={18} color="#059669" />
          <Text style={styles.totalAmount}>{item.totalAmount.toFixed(2)}</Text>
        </View>
        {item.paymentId && (
          <Text style={styles.paymentId}>Payment ID: {item.paymentId}</Text>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <ShoppingBag size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your order history will appear here once you make your first purchase.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSubtitle}>
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id.toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchUserAndOrders}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 16,

  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  itemsSection: {
    marginVertical: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    padding: 2,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    padding:4,
    backgroundColor: '#E5E7EB',
  },
  productDetails: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productQuantity: {
    fontSize: 13,
    color: '#6B7280',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  addressSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  addressText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  totalSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginLeft: 4,
  },
  paymentId: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default OrdersScreen;