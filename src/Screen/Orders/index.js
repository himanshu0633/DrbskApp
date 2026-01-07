import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  Alert,
  StatusBar,
  Animated,
  Platform,
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
  AlertCircle,
  ChevronRight,
  Filter,
  Search,
  X,
  Star,
  Truck,
  CheckCircle,
  RotateCw,
  Info,
  Download,
  Share2,
  MessageCircle,
  Eye,
  ShoppingCart
} from 'lucide-react-native';

const OrdersScreen = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [userData, setUserData] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const statusFilters = [
    { id: 'all', label: 'All Orders' },
    { id: 'pending', label: 'Pending' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'shipped', label: 'Shipped' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  useEffect(() => {
    fetchUserAndOrders();
  }, []);

  useEffect(() => {
    filterAndSortOrders();
  }, [orders, searchQuery, selectedFilter, sortBy]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchUserAndOrders = useCallback(async () => {
    try {
      setRefreshing(true);
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUserData(parsedUser);
        const userId = parsedUser._id;

        const response = await axiosInstance.get(`/api/orders/${userId}`);
        const sortedOrders = response.data.orders?.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        ) || [];
        setOrders(sortedOrders);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const filterAndSortOrders = () => {
    let result = [...orders];

    // Apply status filter
    if (selectedFilter !== 'all') {
      result = result.filter(order => 
        order.status.toLowerCase() === selectedFilter.toLowerCase()
      );
    }

    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order._id.toLowerCase().includes(query) ||
        order.items.some(item => 
          item.name.toLowerCase().includes(query)
        ) ||
        order.address.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'price-high':
        result.sort((a, b) => b.totalAmount - a.totalAmount);
        break;
      case 'price-low':
        result.sort((a, b) => a.totalAmount - b.totalAmount);
        break;
    }

    setFilteredOrders(result);
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
        return <Clock size={18} color="#F59E0B" />;
      case 'confirmed':
        return <Package size={18} color="#3B82F6" />;
      case 'shipped':
        return <Truck size={18} color="#8B5CF6" />;
      case 'delivered':
        return <CheckCircle size={18} color="#10B981" />;
      case 'cancelled':
        return <AlertCircle size={18} color="#EF4444" />;
      default:
        return <Package size={18} color="#6B7280" />;
    }
  };

  const getStatusDescription = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Your order is being processed';
      case 'confirmed':
        return 'Order confirmed and being prepared';
      case 'shipped':
        return 'Order is on the way';
      case 'delivered':
        return 'Order has been delivered';
      case 'cancelled':
        return 'Order has been cancelled';
      default:
        return 'Order status unknown';
    }
  };

  const handleOrderPress = (order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const handleReorder = (order) => {
    Alert.alert(
      'Reorder',
      'Add all items from this order to cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reorder', 
          style: 'default',
          onPress: () => {
            // Implement reorder logic here
            Alert.alert('Success', 'Items added to cart!');
          }
        }
      ]
    );
  };

  const handleTrackOrder = (order) => {
    // Implement tracking logic here
    Alert.alert('Track Order', `Tracking for order #${order._id.slice(-8)}`);
  };

  const handleContactSupport = () => {
    // Implement contact support logic here
    Alert.alert('Contact Support', 'Redirecting to support...');
  };

  const handleDownloadInvoice = (order) => {
    // Implement invoice download logic here
    Alert.alert('Download Invoice', `Invoice for order #${order._id.slice(-8)}`);
  };

  const renderOrderItem = ({ item, index }) => {
    const isExpanded = expandedOrder === item._id;
    const statusColor = getStatusColor(item.status);
    
    return (
      <Animated.View
        style={[
          styles.orderCard,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })
            }]
          }
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => toggleOrderExpand(item._id)}
        >
          {/* Order Header */}
          <View style={styles.orderHeader}>
            <View>
              <View style={styles.orderIdContainer}>
                <ShoppingBag size={20} color="#6366F1" />
                <Text style={styles.orderId}>ORDER #{item._id.slice(-8).toUpperCase()}</Text>
              </View>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              {getStatusIcon(item.status)}
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Order Summary */}
          <View style={styles.orderSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Items</Text>
              <Text style={styles.summaryValue}>{item.items.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total</Text>
              <View style={styles.priceContainer}>
                <IndianRupee size={14} color="#059669" />
                <Text style={styles.summaryPrice}>{item.totalAmount.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Payment</Text>
              <Text style={[styles.summaryValue, { color: item.paymentStatus === 'paid' ? '#10B981' : '#EF4444' }]}>
                {item.paymentStatus || 'Paid'}
              </Text>
            </View>
          </View>

          {/* Expandable Content */}
          {isExpanded && (
            <View style={styles.expandedContent}>
              {/* Items List */}
              <View style={styles.itemsSection}>
                <Text style={styles.sectionTitle}>Order Items</Text>
                {item.items.map((product, idx) => (
                  <View key={`${product._id}_${idx}`} style={styles.productItem}>
                    <View style={styles.productImagePlaceholder}>
                      {product.image ? (
                        <Image
                          source={{ uri: product.image }}
                          style={styles.productImage}
                        />
                      ) : (
                        <ShoppingCart size={24} color="#9CA3AF" />
                      )}
                    </View>
                    <View style={styles.productDetails}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      <View style={styles.productMeta}>
                        <Text style={styles.productQuantity}>Qty: {product.quantity}</Text>
                        <View style={styles.priceContainer}>
                          <IndianRupee size={12} color="#059669" />
                          <Text style={styles.productPrice}>{product.price}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Shipping Info */}
              <View style={styles.shippingSection}>
                <View style={styles.sectionHeader}>
                  <Truck size={18} color="#6366F1" />
                  <Text style={styles.sectionTitle}>Shipping Details</Text>
                </View>
                <View style={styles.infoRow}>
                  <MapPin size={16} color="#6B7280" />
                  <Text style={styles.infoText} numberOfLines={3}>
                    {item.address}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Phone size={16} color="#6B7280" />
                  <Text style={styles.infoText}>{item.phone}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                {item.status.toLowerCase() === 'delivered' && (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.reviewButton]}
                    onPress={() => handleReorder(item)}
                  >
                    <Star size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Leave Review</Text>
                  </TouchableOpacity>
                )}
                
                {item.status.toLowerCase() === 'shipped' && (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.trackButton]}
                    onPress={() => handleTrackOrder(item)}
                  >
                    <Truck size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Track Order</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={[styles.actionButton, styles.reorderButton]}
                  onPress={() => handleReorder(item)}
                >
                  <RotateCw size={16} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Reorder</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.supportButton]}
                  onPress={handleContactSupport}
                >
                  <MessageCircle size={16} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Support</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Expand/Collapse Indicator */}
          <View style={styles.expandIndicator}>
            <ChevronRight 
              size={20} 
              color="#9CA3AF" 
              style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderFilterChips = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.filterContainer}
      contentContainerStyle={styles.filterContent}
    >
      {statusFilters.map((filter) => (
        <TouchableOpacity
          key={filter.id}
          style={[
            styles.filterChip,
            selectedFilter === filter.id && styles.filterChipActive
          ]}
          onPress={() => setSelectedFilter(filter.id)}
        >
          <Text style={[
            styles.filterChipText,
            selectedFilter === filter.id && styles.filterChipTextActive
          ]}>
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Search size={20} color="#9CA3AF" />
      <TextInput
        style={styles.searchInput}
        placeholder="Search orders, items..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#9CA3AF"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <X size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSortOptions = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.sortLabel}>Sort by:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[
          { id: 'newest', label: 'Newest First' },
          { id: 'oldest', label: 'Oldest First' },
          { id: 'price-high', label: 'Price: High to Low' },
          { id: 'price-low', label: 'Price: Low to High' },
        ].map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.sortChip,
              sortBy === option.id && styles.sortChipActive
            ]}
            onPress={() => setSortBy(option.id)}
          >
            <Text style={[
              styles.sortChipText,
              sortBy === option.id && styles.sortChipTextActive
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <ShoppingBag size={80} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || selectedFilter !== 'all' 
          ? 'Try changing your search or filter'
          : 'Start shopping to see your orders here!'}
      </Text>
      {(searchQuery || selectedFilter !== 'all') && (
        <TouchableOpacity 
          style={styles.clearFiltersButton}
          onPress={() => {
            setSearchQuery('');
            setSelectedFilter('all');
          }}
        >
          <Text style={styles.clearFiltersText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{orders.length}</Text>
        <Text style={styles.statLabel}>Total Orders</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <IndianRupee size={20} color="#059669" />
        <Text style={styles.statValue}>
          {orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
        </Text>
        <Text style={styles.statLabel}>Total Spent</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>
          {orders.filter(o => o.status === 'delivered').length}
        </Text>
        <Text style={styles.statLabel}>Delivered</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Orders</Text>
          {userData && (
            <Text style={styles.userName}>Hi, {userData.name?.split(' ')[0]}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={24} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {orders.length > 0 && renderStats()}

      {/* Search Bar */}
      {orders.length > 0 && renderSearchBar()}

      {/* Filters */}
      {orders.length > 0 && renderFilterChips()}

      {/* Sort Options */}
      {orders.length > 0 && renderSortOptions()}

      {/* Orders List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item._id.toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchUserAndOrders}
              colors={['#6366F1']}
              tintColor="#6366F1"
            />
          }
          ListFooterComponent={<View style={styles.footer} />}
        />
      )}

      {/* Order Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal content would go here */}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  userName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginRight: 8,
  },
  sortChipActive: {
    backgroundColor: '#6366F1',
  },
  sortChipText: {
    fontSize: 12,
    color: '#6B7280',
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 8,
  },
  orderDate: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 28,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  orderSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  summaryPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginLeft: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  itemsSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  productImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  productDetails: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 6,
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
    marginLeft: 2,
  },
  shippingSection: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    minWidth: '48%',
  },
  reorderButton: {
    backgroundColor: '#6366F1',
  },
  trackButton: {
    backgroundColor: '#8B5CF6',
  },
  supportButton: {
    backgroundColor: '#6B7280',
  },
  reviewButton: {
    backgroundColor: '#F59E0B',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: 8,
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
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 12,
  },
  clearFiltersText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    height: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default OrdersScreen;