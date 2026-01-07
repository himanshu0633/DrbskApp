import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  TextInput,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ShoppingBag,
  Clock,
  Shield,
  Pill,
  AlertCircle,
  X,
  CheckCircle,
  Filter,
  Grid,
  List,
  Heart,
  Star,
  Package,
  Truck,
  RotateCcw,
} from 'lucide-react-native';
import axiosInstance from '../../Components/AxiosInstance';
import API_URL from '../../../config';
import { useDispatch, useSelector } from 'react-redux';
import { addData } from '../../store/Action';
import { Picker } from '@react-native-picker/picker';

const { width, height } = Dimensions.get('window');

/* --------------------------- helpers / normalizers -------------------------- */

function toNum(x, fallback = 0) {
  const n = parseFloat(String(x ?? '').toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Parse the API's `quantity` field into a clean array of variant objects */
function parseVariants(raw) {
  try {
    let parsed = [];

    if (Array.isArray(raw) && raw.length > 0) {
      if (typeof raw[0] === 'string') {
        parsed = JSON.parse(raw[0]);
      } else if (typeof raw[0] === 'object') {
        parsed = raw;
      }
    } else if (typeof raw === 'string') {
      parsed = JSON.parse(raw);
    }

    return (parsed || []).map(v => ({
      label: (v.label || '').trim(),
      mrp: toNum(v.mrp),
      discount: toNum(v.discount),
      gst: toNum(v.gst),
      retail_price: toNum(v.retail_price),
      final_price: toNum(v.final_price),
      in_stock: String(v.in_stock || '').toLowerCase() === 'yes',
    }));
  } catch (e) {
    console.warn('Failed to parse variants from quantity:', e);
    return [];
  }
}

/** Build a normalized product with price/originalPrice/discountPercent & variants */
function normalizeProduct(p) {
  const variants = parseVariants(p.quantity);

  const consumerTop = toNum(p.consumer_price, NaN);
  let price = 0;
  let originalPrice = 0;

  if (Number.isFinite(consumerTop) && consumerTop > 0) {
    price = consumerTop;
    originalPrice = toNum(p.retail_price, price);
  } else if (variants.length > 0) {
    const minVar = variants.reduce((acc, v) => {
      const vPrice = v.final_price || v.retail_price || v.mrp || Infinity;
      const aPrice = acc.final_price || acc.retail_price || acc.mrp || Infinity;
      return vPrice < aPrice ? v : acc;
    }, variants[0]);

    price = toNum(minVar.final_price || minVar.retail_price || minVar.mrp, 0);
    originalPrice = toNum(minVar.retail_price || minVar.mrp || price, price);
  } else {
    price = 0;
    originalPrice = 0;
  }

  const discountPercent =
    originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  return {
    ...p,
    price,
    originalPrice,
    discountPercent,
    variants,
  };
}

/** Get the display price for a product based on a selected variant label */
function getDisplayPrice(product, selectedLabel) {
  if (!product?.variants?.length) return toNum(product?.price, 0);
  const v = product.variants.find(x => x.label === selectedLabel);
  if (!v) return toNum(product?.price, 0);
  return toNum(v.final_price || v.retail_price || v.mrp, 0);
}

/* -------------------------------- component -------------------------------- */

export default function ProductsPage({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortOption, setSortOption] = useState('featured');
  const [mainImage, setMainImage] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [addedProductName, setAddedProductName] = useState('');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [wishlist, setWishlist] = useState([]);

  const cartItems = useSelector((state) => state?.app?.data || []);
  const cartCount = cartItems.length;
  const dispatch = useDispatch();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });
  
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  /* ------------------------------- fetchers -------------------------------- */

  const fetchCategories = async () => {
    try {
      const response = await axiosInstance.get('/user/allcategories');
      const fetchedCategories = response?.data?.map(cat => cat.name) || [];
      setCategories(['All', ...fetchedCategories]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/user/allproducts');
      const fetched = (response?.data || []).map(normalizeProduct);
      setAllProducts(fetched);
      setProducts(fetched);
    } catch (error) {
      console.error('Error fetching products:', error);
      showCustomAlert('Error', 'Failed to fetch products. Please try again.', 'error');
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCategories();
    await fetchProducts();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  /* ------------------------- category + search + sort ------------------------ */

  const filterByCategory = (category) => {
    setSelectedCategory(category);
    let filtered = category === 'All'
      ? [...allProducts]
      : allProducts.filter(p => p.category === category);

    applySorting(filtered, sortOption);
  };

  const applySorting = (data, option) => {
    let sorted = [...data];
    switch (option) {
      case 'priceLowToHigh':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'priceHighToLow':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'nameAZ':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'nameZA':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'discount':
        sorted.sort((a, b) => b.discountPercent - a.discountPercent);
        break;
      default: // 'featured'
        break;
    }
    setProducts(sorted);
  };

  useEffect(() => {
    let filtered = [...allProducts];

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    applySorting(filtered, sortOption);
  }, [searchText, selectedCategory, sortOption, allProducts]);

  /* ------------------------- deep link open via route ------------------------ */

  useEffect(() => {
    if (route?.params?.selectedProduct) {
      const normalized = normalizeProduct(route.params.selectedProduct);
      setSelectedProduct(normalized);
      const imageUrl =
        normalized?.media?.length > 0 ? `${API_URL}${normalized.media[0].url}` : null;
      setMainImage(imageUrl);
      setSelectedQuantity(normalized?.variants?.[0]?.label || null);
      setShowProductDetails(true);
    }
  }, [route?.params]);

  /* ---------------------- Custom Alert Functions ---------------------- */

  const showCustomAlert = (title, message, type = 'info') => {
    const bgColor = type === 'error' ? '#ff4444' : type === 'success' ? '#4CAF50' : '#2196F3';
    
    Alert.alert(
      title,
      message,
      [{ text: "OK", style: "default" }],
      {
        cancelable: true,
        backgroundColor: bgColor,
      }
    );
  };

  const showConfirmationAlert = (title, message, onConfirm, onCancel) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: onCancel
        },
        {
          text: "OK",
          style: "destructive",
          onPress: onConfirm
        }
      ],
      { cancelable: true }
    );
  };

  /* --------------------- Add to Cart Functions -------------------- */

  const handleAddToCart = (product, quantity = null, variant = null, showModal = true) => {
    const priceToUse = quantity 
      ? getDisplayPrice(product, quantity)
      : toNum(product?.price);
    
    const selectedVariant = variant || 
      (quantity ? product.variants.find(v => v.label === quantity) : null);
    
    // Check if product is in stock
    if (selectedVariant && !selectedVariant.in_stock) {
      showCustomAlert(
        'Out of Stock',
        'This product is currently out of stock.',
        'error'
      );
      return;
    }
    
    const payload = {
      ...product,
      selectedQuantity: quantity,
      selectedVariant,
      price: priceToUse,
      addedAt: new Date().toISOString(),
      quantity: 1,
    };
    
    // Add to Redux store
    dispatch(addData(payload));
    
    if (showModal) {
      setAddedProductName(product.name);
      setShowSuccessModal(true);
    } else {
      showCustomAlert(
        'Added to Cart',
        `${product.name} has been added to your cart.`,
        'success'
      );
    }
  };

  const toggleWishlist = (productId) => {
    if (wishlist.includes(productId)) {
      setWishlist(wishlist.filter(id => id !== productId));
      showCustomAlert('Removed from Wishlist', 'Product removed from your wishlist.');
    } else {
      setWishlist([...wishlist, productId]);
      showCustomAlert('Added to Wishlist', 'Product added to your wishlist!', 'success');
    }
  };

  /* ----------------------------- Sort Modal ----------------------------- */

  const renderSortModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showSortModal}
      onRequestClose={() => setShowSortModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSortModal(false)}
      >
        <View style={styles.sortModalContainer}>
          <View style={styles.sortModalContent}>
            <View style={styles.sortModalHeader}>
              <Text style={styles.sortModalTitle}>Sort By</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {[
              { key: 'featured', label: 'Featured', icon: '⭐' },
              { key: 'priceLowToHigh', label: 'Price: Low to High', icon: '↗️' },
              { key: 'priceHighToLow', label: 'Price: High to Low', icon: '↘️' },
              { key: 'nameAZ', label: 'Name: A to Z', icon: '🔤' },
              { key: 'nameZA', label: 'Name: Z to A', icon: '🔤' },
              { key: 'discount', label: 'Best Discount', icon: '🏷️' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.sortOption,
                  sortOption === option.key && styles.sortOptionSelected,
                ]}
                onPress={() => {
                  setSortOption(option.key);
                  setShowSortModal(false);
                }}
              >
                <View style={styles.sortOptionContent}>
                  <Text style={styles.sortOptionIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.sortOptionLabel,
                    sortOption === option.key && styles.sortOptionLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                </View>
                {sortOption === option.key && (
                  <CheckCircle size={20} color="#FF6B00" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  /* ------------------------------ render items ------------------------------ */

  const renderGridProductCard = ({ item }) => {
    const isInWishlist = wishlist.includes(item._id);
    
    return (
      <TouchableOpacity
        style={styles.productCardGrid}
        onPress={() => {
          const normalized = normalizeProduct(item);
          setSelectedProduct(normalized);
          const imageUrl =
            normalized?.media?.length > 0 ? `${API_URL}${normalized.media[0].url}` : null;
          setMainImage(imageUrl);
          setSelectedQuantity(normalized?.variants?.[0]?.label || null);
          setShowProductDetails(true);
        }}
        activeOpacity={0.9}
      >
        {/* Product Image with Wishlist */}
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: `${API_URL}${item?.media?.[0]?.url}` }}
            style={styles.productImageGrid}
            resizeMode="contain"
          />
          <TouchableOpacity 
            style={styles.wishlistButton}
            onPress={() => toggleWishlist(item._id)}
          >
            <Heart 
              size={20} 
              color={isInWishlist ? "#FF6B00" : "#fff"} 
              fill={isInWishlist ? "#FF6B00" : "transparent"}
            />
          </TouchableOpacity>
          
          {/* Discount Badge */}
          {item.discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{item.discountPercent}% OFF</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfoGrid}>
          <Text style={styles.productCategory}>{item.category || 'Category'}</Text>
          <Text style={styles.productTitleGrid} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={12}
                  color="#FFD700"
                  fill={star <= 4 ? "#FFD700" : "#E0E0E0"}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>4.0 (128)</Text>
          </View>

          {/* Price */}
          <View style={styles.priceContainerGrid}>
            <Text style={styles.productPriceGrid}>₹{toNum(item?.price).toFixed(2)}</Text>
            {item.discountPercent > 0 && (
              <Text style={styles.originalPriceGrid}>₹{toNum(item?.originalPrice).toFixed(2)}</Text>
            )}
          </View>

          {/* Stock Status */}
          <View style={styles.stockContainer}>
            <View style={[
              styles.stockDot,
              { backgroundColor: item.variants?.some(v => v.in_stock) ? '#4CAF50' : '#FF5252' }
            ]} />
            <Text style={styles.stockText}>
              {item.variants?.some(v => v.in_stock) ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>

          {/* Add to Cart Button */}
          <TouchableOpacity
            style={[
              styles.addToCartButtonGrid,
              !item.variants?.some(v => v.in_stock) && styles.addToCartButtonDisabled
            ]}
            onPress={() => handleAddToCart(item, item.variants?.[0]?.label || null, null, false)}
            disabled={!item.variants?.some(v => v.in_stock)}
          >
            <ShoppingBag size={16} color="#fff" />
            <Text style={styles.addToCartTextGrid}>
              {item.variants?.some(v => v.in_stock) ? 'Add to Cart' : 'Out of Stock'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListProductCard = ({ item }) => {
    const isInWishlist = wishlist.includes(item._id);
    
    return (
      <TouchableOpacity
        style={styles.productCardList}
        onPress={() => {
          const normalized = normalizeProduct(item);
          setSelectedProduct(normalized);
          const imageUrl =
            normalized?.media?.length > 0 ? `${API_URL}${normalized.media[0].url}` : null;
          setMainImage(imageUrl);
          setSelectedQuantity(normalized?.variants?.[0]?.label || null);
          setShowProductDetails(true);
        }}
        activeOpacity={0.9}
      >
        {/* Product Image */}
        <View style={styles.productImageContainerList}>
          <Image
            source={{ uri: `${API_URL}${item?.media?.[0]?.url}` }}
            style={styles.productImageList}
            resizeMode="contain"
          />
          {item.discountPercent > 0 && (
            <View style={styles.discountBadgeList}>
              <Text style={styles.discountTextList}>{item.discountPercent}% OFF</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfoList}>
          <View style={styles.productHeaderList}>
            <View style={styles.productTitleContainer}>
              <Text style={styles.productCategoryList}>{item.category}</Text>
              <Text style={styles.productTitleList} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.wishlistButtonList}
              onPress={() => toggleWishlist(item._id)}
            >
              <Heart 
                size={20} 
                color={isInWishlist ? "#FF6B00" : "#666"} 
                fill={isInWishlist ? "#FF6B00" : "transparent"}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.productDescriptionList} numberOfLines={2}>
            {item.description || 'No description available'}
          </Text>

          <View style={styles.ratingContainerList}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={12}
                  color="#FFD700"
                  fill={star <= 4 ? "#FFD700" : "#E0E0E0"}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>4.0 (128)</Text>
          </View>

          <View style={styles.priceRowList}>
            <View style={styles.priceContainerList}>
              <Text style={styles.productPriceList}>₹{toNum(item?.price).toFixed(2)}</Text>
              {item.discountPercent > 0 && (
                <Text style={styles.originalPriceList}>₹{toNum(item?.originalPrice).toFixed(2)}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.addToCartButtonList,
                !item.variants?.some(v => v.in_stock) && styles.addToCartButtonDisabled
              ]}
              onPress={() => handleAddToCart(item, item.variants?.[0]?.label || null, null, false)}
              disabled={!item.variants?.some(v => v.in_stock)}
            >
              <ShoppingBag size={16} color="#fff" />
              <Text style={styles.addToCartTextList}>
                {item.variants?.some(v => v.in_stock) ? 'ADD' : 'OUT'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProductCard = ({ item }) => {
    return viewMode === 'grid' 
      ? renderGridProductCard({ item }) 
      : renderListProductCard({ item });
  };

  const renderProductDetails = () => {
    if (!selectedProduct) return null;

    const displayPrice = getDisplayPrice(selectedProduct, selectedQuantity);
    const selectedVariant =
      selectedProduct?.variants?.find(v => v.label === selectedQuantity) || null;

    return (
      <View style={styles.productDetailsContainer}>
        {/* Custom Header */}
        <Animated.View style={styles.detailsHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowProductDetails(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.detailsTitle}>Product Details</Text>
          <TouchableOpacity 
            style={styles.wishlistButtonHeader}
            onPress={() => toggleWishlist(selectedProduct._id)}
          >
            <Heart 
              size={22} 
              color={wishlist.includes(selectedProduct._id) ? "#FF6B00" : "#666"} 
              fill={wishlist.includes(selectedProduct._id) ? "#FF6B00" : "transparent"}
            />
          </TouchableOpacity>
        </Animated.View>

        <ScrollView 
          style={styles.detailsContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Gallery */}
          <View style={styles.imageGallery}>
            {mainImage ? (
              <Image source={{ uri: mainImage }} style={styles.detailsImage} resizeMode="contain" />
            ) : (
              <View style={styles.noImageContainer}>
                <Package size={60} color="#ccc" />
                <Text style={styles.noImageText}>No image available</Text>
              </View>
            )}
          </View>

          {/* Product Info */}
          <View style={styles.detailsInfoContainer}>
            {/* Product Name and Category */}
            <View style={styles.productHeaderDetails}>
              <View style={styles.productCategoryBadge}>
                <Text style={styles.productCategoryText}>{selectedProduct.category}</Text>
              </View>
              <Text style={styles.detailsProductName}>{selectedProduct.name}</Text>
            </View>

            {/* Rating and Reviews */}
            <View style={styles.ratingSection}>
              <View style={styles.ratingBadge}>
                <Star size={16} color="#FFD700" fill="#FFD700" />
                <Text style={styles.ratingValue}>4.5</Text>
                <Text style={styles.ratingCount}>(128 reviews)</Text>
              </View>
              <View style={styles.deliveryBadge}>
                <Truck size={16} color="#4CAF50" />
                <Text style={styles.deliveryText}>Free Delivery</Text>
              </View>
            </View>

            {/* Price Section */}
            <View style={styles.detailsPriceSection}>
              <View style={styles.priceMain}>
                <Text style={styles.detailsPrice}>₹{toNum(displayPrice).toFixed(2)}</Text>
                {selectedVariant?.retail_price && selectedVariant.retail_price > displayPrice ? (
                  <>
                    <Text style={styles.detailsOriginalPrice}>
                      ₹{toNum(selectedVariant.retail_price).toFixed(2)}
                    </Text>
                    <View style={styles.detailsDiscountBadge}>
                      <Text style={styles.detailsDiscountText}>
                        {Math.round(
                          ((toNum(selectedVariant.retail_price) - displayPrice) /
                            toNum(selectedVariant.retail_price)) *
                            100
                          )}% OFF
                      </Text>
                    </View>
                  </>
                ) : selectedProduct.discountPercent > 0 ? (
                  <>
                    <Text style={styles.detailsOriginalPrice}>
                      ₹{toNum(selectedProduct.originalPrice).toFixed(2)}
                    </Text>
                    <View style={styles.detailsDiscountBadge}>
                      <Text style={styles.detailsDiscountText}>
                        {selectedProduct.discountPercent}% OFF
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
              <View style={styles.gstBadge}>
                <Text style={styles.gstText}>+ GST applicable</Text>
              </View>
            </View>

            {/* Quantity Selector */}
            {selectedProduct?.variants?.length > 1 ? (
              <View style={styles.quantitySection}>
                <Text style={styles.quantityTitle}>Select Quantity</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.quantityScroll}
                >
                  {selectedProduct.variants.map((v) => (
                    <TouchableOpacity
                      key={v.label}
                      style={[
                        styles.quantityOption,
                        selectedQuantity === v.label && styles.quantityOptionSelected,
                        !v.in_stock && styles.quantityOptionDisabled,
                      ]}
                      onPress={() => v.in_stock && setSelectedQuantity(v.label)}
                      disabled={!v.in_stock}
                    >
                      <Text style={[
                        styles.quantityOptionText,
                        selectedQuantity === v.label && styles.quantityOptionTextSelected,
                        !v.in_stock && styles.quantityOptionTextDisabled,
                      ]}>
                        {v.label}
                      </Text>
                      <Text style={[
                        styles.quantityOptionPrice,
                        selectedQuantity === v.label && styles.quantityOptionPriceSelected,
                      ]}>
                        ₹{toNum(v.final_price || v.retail_price || v.mrp).toFixed(2)}
                      </Text>
                      {!v.in_stock && (
                        <Text style={styles.outOfStockLabel}>Out of Stock</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.singleQuantity}>
                <Text style={styles.singleQuantityLabel}>Available: </Text>
                <Text style={styles.singleQuantityValue}>
                  {selectedProduct?.variants?.[0]?.label || 'Standard Pack'}
                </Text>
              </View>
            )}

            {/* Description */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionContent}>
                {selectedProduct.description || 'No description available'}
              </Text>
            </View>

            {/* Key Features */}
            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>Key Features</Text>
              <View style={styles.featuresGrid}>
                <View style={styles.featureItem}>
                  <Shield size={20} color="#4CAF50" />
                  <Text style={styles.featureText}>100% Authentic</Text>
                </View>
                <View style={styles.featureItem}>
                  <Package size={20} color="#2196F3" />
                  <Text style={styles.featureText}>Secure Packaging</Text>
                </View>
                <View style={styles.featureItem}>
                  <RotateCcw size={20} color="#FF9800" />
                  <Text style={styles.featureText}>Easy Returns</Text>
                </View>
                <View style={styles.featureItem}>
                  <Clock size={20} color="#9C27B0" />
                  <Text style={styles.featureText}>24/7 Support</Text>
                </View>
              </View>
            </View>

            {/* Specifications */}
            <View style={styles.specsSection}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <View style={styles.specsGrid}>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Category</Text>
                  <Text style={styles.specValue}>{selectedProduct.category || '—'}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Sub Category</Text>
                  <Text style={styles.specValue}>{selectedProduct.sub_category || '—'}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Expiry Date</Text>
                  <Text style={styles.specValue}>{selectedProduct.expires_on || '—'}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Availability</Text>
                  <Text style={[
                    styles.specValue,
                    { color: selectedVariant?.in_stock ? '#4CAF50' : '#FF5252' }
                  ]}>
                    {selectedVariant?.in_stock ? 'In Stock' : 'Out of Stock'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Footer */}
        <View style={styles.detailsFooter}>
          <TouchableOpacity 
            style={styles.wishlistButtonFooter}
            onPress={() => toggleWishlist(selectedProduct._id)}
          >
            <Heart 
              size={22} 
              color={wishlist.includes(selectedProduct._id) ? "#FF6B00" : "#666"} 
              fill={wishlist.includes(selectedProduct._id) ? "#FF6B00" : "transparent"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addToCartButtonLarge,
              (!selectedVariant?.in_stock || !selectedProduct?.variants?.some(v => v.in_stock)) && 
                styles.addToCartButtonDisabled
            ]}
            onPress={() => handleAddToCart(selectedProduct, selectedQuantity, selectedVariant)}
            disabled={!selectedVariant?.in_stock}
          >
            <ShoppingBag size={22} color="#fff" />
            <Text style={styles.addToCartTextLarge}>
              {selectedVariant?.in_stock ? 'Add to Cart' : 'Out of Stock'}
            </Text>
            {selectedVariant?.in_stock && (
              <Text style={styles.addToCartPrice}>₹{toNum(displayPrice).toFixed(2)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ---------------------------- Success Modal ---------------------------- */

  const renderSuccessModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showSuccessModal}
      onRequestClose={() => setShowSuccessModal(false)}
      statusBarTranslucent
    >
      <View style={styles.successModalOverlay}>
        <Animated.View style={styles.successModal}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <CheckCircle size={60} color="#4CAF50" />
            </View>
            <Text style={styles.successModalTitle}>Added to Cart!</Text>
            <Text style={styles.successModalMessage}>
              {addedProductName} has been successfully added to your cart.
            </Text>
            
            <View style={styles.successModalButtons}>
              <TouchableOpacity 
                style={styles.continueButton}
                onPress={() => setShowSuccessModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>Continue Shopping</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.viewCartButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  navigation.navigate('Cart');
                }}
                activeOpacity={0.8}
              >
                <ShoppingBag size={18} color="#fff" />
                <Text style={styles.viewCartButtonText}>
                  View Cart ({cartCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Modals */}
      {renderSortModal()}
      {renderSuccessModal()}

      {showProductDetails ? (
        renderProductDetails()
      ) : (
        <>
          {/* Main Header */}
          <Animated.View style={[styles.mainHeader, { 
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }]
          }]}>
            {searchActive ? (
              <View style={styles.searchHeader}>
                <TouchableOpacity 
                  onPress={() => {
                    setSearchActive(false);
                    setSearchText('');
                  }}
                  style={styles.searchBackButton}
                >
                  <ArrowLeft size={24} color="#666" />
                </TouchableOpacity>
                <View style={styles.searchInputContainer}>
                  <Search size={20} color="#666" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search products..."
                    placeholderTextColor="#999"
                    value={searchText}
                    onChangeText={setSearchText}
                    autoFocus
                    autoCapitalize="none"
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchText('')}>
                      <X size={20} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.normalHeader}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ArrowLeft size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Premium Health Products</Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity 
                    style={styles.headerButton}
                    onPress={() => setSearchActive(true)}
                  >
                    <Search size={22} color="#333" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.headerButton, styles.cartButton]}
                    onPress={() => navigation.navigate('Cart')}
                  >
                    <ShoppingBag size={22} color="#333" />
                    {cartCount > 0 && (
                      <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>
                          {cartCount > 9 ? '9+' : cartCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScrollView}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive,
                ]}
                onPress={() => filterByCategory(category)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category && styles.categoryButtonTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Filters Bar */}
          <View style={styles.filterBar}>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[
                  styles.viewToggleButton,
                  viewMode === 'grid' && styles.viewToggleButtonActive,
                ]}
                onPress={() => setViewMode('grid')}
              >
                <Grid size={18} color={viewMode === 'grid' ? "#FF6B00" : "#666"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.viewToggleButton,
                  viewMode === 'list' && styles.viewToggleButtonActive,
                ]}
                onPress={() => setViewMode('list')}
              >
                <List size={18} color={viewMode === 'list' ? "#FF6B00" : "#666"} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.productCount}>
              {products.length} {products.length === 1 ? 'Product' : 'Products'}
            </Text>
            
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowSortModal(true)}
              >
                <Text style={styles.filterButtonText}>Sort</Text>
                <ChevronDown size={14} color="#666" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilterModal(true)}
              >
                <Text style={styles.filterButtonText}>Filter</Text>
                <Filter size={14} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Products List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.loadingText}>Loading premium products...</Text>
            </View>
          ) : (
            <Animated.FlatList
              data={products}
              renderItem={renderProductCard}
              keyExtractor={(item) => String(item._id)}
              contentContainerStyle={[
                styles.productList,
                viewMode === 'grid' ? styles.productListGrid : styles.productListList,
              ]}
              showsVerticalScrollIndicator={false}
              numColumns={viewMode === 'grid' ? 2 : 1}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#FF6B00']}
                  tintColor="#FF6B00"
                />
              }
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true }
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Package size={60} color="#ccc" />
                  <Text style={styles.emptyTitle}>No Products Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchText 
                      ? `No results for "${searchText}"`
                      : 'No products available in this category'
                    }
                  </Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={fetchProducts}
                    activeOpacity={0.8}
                  >
                    <RotateCcw size={18} color="#fff" />
                    <Text style={styles.retryButtonText}>Refresh Products</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

/* --------------------------------- styles --------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // Header Styles
  mainHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 100,
  },
  normalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  cartButton: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // Search Header
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBackButton: {
    padding: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginLeft: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  
  // Categories
  categoryScrollView: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#f5f5f5',
  },
  categoryButtonActive: {
    backgroundColor: '#FF6B00',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  categoryButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
  },
  viewToggleButton: {
    padding: 8,
    borderRadius: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  productCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Product List
  productList: {
    padding: 12,
  },
  productListGrid: {
    paddingHorizontal: 8,
  },
  productListList: {
    paddingHorizontal: 12,
  },
  
  // Grid View Product Card
  productCardGrid: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImageContainer: {
    position: 'relative',
    height: 160,
    backgroundColor: '#f8f9fa',
  },
  productImageGrid: {
    width: '100%',
    height: '100%',
  },
  wishlistButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productInfoGrid: {
    padding: 12,
  },
  productCategory: {
    fontSize: 10,
    color: '#FF6B00',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  productTitleGrid: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 6,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
  },
  priceContainerGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPriceGrid: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  originalPriceGrid: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
    textDecorationLine: 'line-through',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  stockText: {
    fontSize: 12,
    color: '#666',
  },
  addToCartButtonGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addToCartTextGrid: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // List View Product Card
  productCardList: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImageContainerList: {
    position: 'relative',
    width: 120,
    height: 120,
    backgroundColor: '#f8f9fa',
  },
  productImageList: {
    width: '100%',
    height: '100%',
  },
  discountBadgeList: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountTextList: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productInfoList: {
    flex: 1,
    padding: 12,
  },
  productHeaderList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  productTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  productCategoryList: {
    fontSize: 10,
    color: '#FF6B00',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  productTitleList: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    lineHeight: 18,
  },
  wishlistButtonList: {
    padding: 4,
  },
  productDescriptionList: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  ratingContainerList: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceRowList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainerList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productPriceList: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  originalPriceList: {
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
    textDecorationLine: 'line-through',
  },
  addToCartButtonList: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addToCartTextList: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Product Details Styles
  productDetailsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  closeButton: {
    padding: 8,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  wishlistButtonHeader: {
    padding: 8,
  },
  detailsContent: {
    flex: 1,
  },
  imageGallery: {
    height: 320,
    backgroundColor: '#f8f9fa',
  },
  detailsImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  noImageText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  detailsInfoContainer: {
    padding: 16,
  },
  productHeaderDetails: {
    marginBottom: 12,
  },
  productCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  productCategoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsProductName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 28,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 12,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#666',
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deliveryText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  detailsPriceSection: {
    marginBottom: 20,
  },
  priceMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailsPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  detailsOriginalPrice: {
    fontSize: 18,
    color: '#999',
    marginLeft: 12,
    textDecorationLine: 'line-through',
  },
  detailsDiscountBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  detailsDiscountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gstBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gstText: {
    fontSize: 12,
    color: '#666',
  },
  quantitySection: {
    marginBottom: 24,
  },
  quantityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  quantityScroll: {
    flexGrow: 0,
  },
  quantityOption: {
    width: 100,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
    alignItems: 'center',
  },
  quantityOptionSelected: {
    backgroundColor: '#FF6B00',
  },
  quantityOptionDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  quantityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  quantityOptionTextSelected: {
    color: '#fff',
  },
  quantityOptionTextDisabled: {
    color: '#999',
  },
  quantityOptionPrice: {
    fontSize: 12,
    color: '#666',
  },
  quantityOptionPriceSelected: {
    color: '#fff',
  },
  outOfStockLabel: {
    fontSize: 10,
    color: '#FF5252',
    marginTop: 4,
    fontWeight: '600',
  },
  singleQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  singleQuantityLabel: {
    fontSize: 14,
    color: '#666',
  },
  singleQuantityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  featuresSection: {
    marginBottom: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  featureItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  specsSection: {
    marginBottom: 24,
  },
  specsGrid: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  specLabel: {
    fontSize: 14,
    color: '#666',
  },
  specValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  detailsFooter: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  wishlistButtonFooter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addToCartButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  addToCartTextLarge: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addToCartPrice: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sortModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  sortModalContent: {
    padding: 24,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sortModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sortOptionSelected: {
    backgroundColor: '#FFF5E6',
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortOptionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  sortOptionLabel: {
    fontSize: 16,
    color: '#333',
  },
  sortOptionLabelSelected: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  
  // Success Modal
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  successModalContent: {
    padding: 32,
    alignItems: 'center',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  successModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  viewCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FF6B00',
    gap: 8,
  },
  viewCartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});