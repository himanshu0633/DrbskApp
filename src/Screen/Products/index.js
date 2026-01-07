import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  Modal,
  RefreshControl,
  Platform,
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
import { useToast } from '../../ToastProvider'; 
const { width, height } = Dimensions.get('window');

/* --------------------------- helpers / normalizers -------------------------- */

function toNum(x, fallback = 0) {
  if (x === null || x === undefined) return fallback;
  const n = parseFloat(String(x).toString().replace(/[^0-9.\-]/g, ''));
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
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
  const [error, setError] = useState(null);
  const [imageLoaded, setImageLoaded] = useState({});

  const cartItems = useSelector((state) => state?.app?.data || []);
  const cartCount = cartItems.length;
  const dispatch = useDispatch();
  
  const { showToast } = useToast();

  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Get subcategory data from route params
  const subcategoryId = route.params?.subcategoryId;
  const subcategoryName = route.params?.subcategoryName;

  /* ------------------------------- Navigation Helper ------------------------------- */
  
  // Safe navigation function to handle Cart navigation
  const navigateToCart = useCallback(() => {
    try {
      // Try different navigation approaches
      if (navigation.canGoBack()) {
        // Try navigating to Cart screen directly
        navigation.navigate('Cart');
      } else {
        // Try navigating to Dashboard first then Cart
        navigation.navigate('Dashboard', { screen: 'Cart' });
      }
    } catch (error) {
      console.error('Navigation error:', error);
      showToast('Cannot navigate to cart right now', 'error');
    }
  }, [navigation, showToast]);

  /* ------------------------------- fetchers -------------------------------- */

  const fetchCategories = async () => {
    try {
      const response = await axiosInstance.get('/user/allcategories');
      const fetchedCategories = response?.data?.map(cat => cat.name) || [];
      setCategories(['All', ...fetchedCategories]);
    } catch (error) {
      console.error('Error fetching categories:', error);
      showToast('Failed to load categories', 'error');
    }
  };

const fetchProducts = async (pageNum = 1, isRefresh = false) => {
  if (isRefresh) {
    setLoading(true);
    setPage(1);
  } else if (pageNum > 1) {
    setLoadingMore(true);
  }
  
  setError(null);
  
  try {
    // If we have a subcategory name from route params, use the productsBySubcategory API
    if (subcategoryName) {
      console.log('Fetching products for subcategory:', subcategoryName);
      
      const encodedSubcategory = encodeURIComponent(subcategoryName);
      
      const response = await axiosInstance.get(
        `/api/productsBySubcategory?subcategory=${encodedSubcategory}`
      );
      
      console.log('Full API URL would be:', `${API_URL}/api/productsBySubcategory?subcategory=${encodedSubcategory}`);
      console.log('API Response status:', response.status);
      console.log('API Response data:', response?.data);
      
      let fetchedProducts = [];
      
      // Handle response based on actual API structure
      if (Array.isArray(response?.data)) {
        fetchedProducts = response.data;
      } else if (response?.data && typeof response.data === 'object') {
        // Try to extract products from nested structure
        fetchedProducts = response.data.products || response.data.data || response.data.result || [];
      }
      
      const normalized = (fetchedProducts || []).map(normalizeProduct);
      console.log(`Found ${normalized.length} products for subcategory "${subcategoryName}"`);
      
      setAllProducts(normalized);
      setProducts(normalized);
      setHasMore(false);
      
      if (normalized.length === 0) {
        showToast(`No products found in "${subcategoryName}" category`, 'info');
      }
    } else {
      // Original API call for all products
      const response = await axiosInstance.get(`/user/allproducts?page=${pageNum}&limit=20`);
      const fetched = (response?.data || []).map(normalizeProduct);
      
      if (pageNum === 1) {
        setAllProducts(fetched);
        setProducts(fetched);
      } else {
        setAllProducts(prev => [...prev, ...fetched]);
        setProducts(prev => [...prev, ...fetched]);
      }
      
      setHasMore(fetched.length === 20);
    }
  } catch (error) {
    console.error('Error fetching products:', error.message);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
    });
    
    // More specific error handling
    if (error.response?.status === 404) {
      if (subcategoryName) {
        setError(`API endpoint not found for "${subcategoryName}". Please try again later.`);
        showToast('Subcategory API endpoint not available', 'error');
        
        // Fallback: Try to get all products and filter client-side
        try {
          const fallbackResponse = await axiosInstance.get(`/user/allproducts?page=1&limit=100`);
          const allProducts = (fallbackResponse?.data || []).map(normalizeProduct);
          
          // Show all products as fallback
          setAllProducts(allProducts);
          setProducts(allProducts);
          setHasMore(false);
          
          showToast(`Showing all products (${allProducts.length} items)`, 'info');
        } catch (fallbackError) {
          setError('Failed to load any products. Please check your connection.');
        }
      } else {
        setError('Products API endpoint not found. Please contact support.');
      }
    } else if (error.response?.status === 500) {
      setError('Server error. Please try again later.');
    } else if (error.message.includes('Network Error')) {
      setError('Network error. Please check your internet connection.');
    } else {
      setError('Failed to load products. Please try again.');
    }
    
    showToast('Failed to load products', 'error');
  }
  
  setLoading(false);
  setLoadingMore(false);
};

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCategories(), fetchProducts(1, true)]);
    setRefreshing(false);
    showToast('Products refreshed', 'success');
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts(1, true);
  }, [subcategoryId]); // Re-fetch when subcategoryId changes

  /* ------------------------- category + search + sort ------------------------ */

  const filterByCategory = useCallback((category) => {
    setSelectedCategory(category);
    setPage(1);
    showToast(`Showing ${category} products`, 'info');
  }, [showToast]);

  const applySorting = useCallback((option) => {
    setSortOption(option);
    setShowSortModal(false);
    
    // Show toast for sorting
    const sortLabels = {
      'featured': 'Featured',
      'priceLowToHigh': 'Price: Low to High',
      'priceHighToLow': 'Price: High to Low',
      'nameAZ': 'Name: A to Z',
      'nameZA': 'Name: Z to A',
      'discount': 'Best Discount',
    };
    showToast(`Sorted by ${sortLabels[option]}`, 'info');
  }, [showToast]);

  // Check if product is already in cart
  const isProductInCart = useCallback((productId) => {
    return cartItems.some(item => item._id === productId);
  }, [cartItems]);

  // Memoize filtered products
  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    // Apply sorting
    let sorted = [...filtered];
    switch (sortOption) {
      case 'priceLowToHigh':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'priceHighToLow':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'nameAZ':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'nameZA':
        sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'discount':
        sorted.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
        break;
      default:
        break;
    }
    
    return sorted;
  }, [allProducts, selectedCategory, searchText, sortOption]);

  useEffect(() => {
    setProducts(filteredProducts);
    setPage(1);
    setHasMore(false); // Reset pagination when filtering
  }, [filteredProducts]);

  /* ------------------------- deep link open via route ------------------------ */

  useEffect(() => {
    if (route?.params?.selectedProduct) {
      const normalized = normalizeProduct(route.params.selectedProduct);
      handleShowProductDetails(normalized);
    }
  }, [route?.params]);

  const handleShowProductDetails = useCallback((product) => {
    const normalized = normalizeProduct(product);
    setSelectedProduct(normalized);
    
    const imageUrl = normalized?.media?.length > 0 
      ? `${API_URL}${normalized.media[0].url}`
      : null;
    setMainImage(imageUrl);
    
    const availableVariant = normalized?.variants?.find(v => v.in_stock);
    setSelectedQuantity(availableVariant?.label || normalized?.variants?.[0]?.label || null);
    
    setShowProductDetails(true);
  }, [API_URL]);

  /* --------------------- Add to Cart Functions -------------------- */

  const handleAddToCart = useCallback((product, quantity = null, variant = null, showModal = true) => {
    const priceToUse = quantity 
      ? getDisplayPrice(product, quantity)
      : toNum(product?.price);
    
    const selectedVariant = variant || 
      (quantity ? product.variants.find(v => v.label === quantity) : null);
    
    if (selectedVariant && !selectedVariant.in_stock) {
      showToast('This product is currently out of stock', 'error');
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
    
    dispatch(addData(payload));
    
    if (showModal) {
      setAddedProductName(product.name);
      setShowSuccessModal(true);
    } else {
      showToast(`${product.name} has been added to your cart`, 'success');
    }
  }, [dispatch, showToast]);

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
                onPress={() => applySorting(option.key)}
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

  const handleImageLoad = useCallback((productId) => {
    setImageLoaded(prev => ({ ...prev, [productId]: true }));
  }, []);

  const renderGridProductCard = useCallback(({ item }) => {
    const isInCart = isProductInCart(item._id);
    const isImageLoaded = imageLoaded[item._id];
    const isInStock = item.variants?.some(v => v.in_stock);
    
    return (
      <TouchableOpacity
        style={styles.productCardGrid}
        onPress={() => handleShowProductDetails(item)}
        activeOpacity={0.9}
      >
        {/* Product Image with Wishlist */}
        <View style={styles.productImageContainer}>
          {!isImageLoaded && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="small" color="#FF6B00" />
            </View>
          )}
          <Image
            source={{ uri: `${API_URL}${item?.media?.[0]?.url}` }}
            style={[
              styles.productImageGrid,
              !isImageLoaded && styles.hiddenImage
            ]}
            resizeMode="contain"
            onLoad={() => handleImageLoad(item._id)}
          />
          
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
              { backgroundColor: isInStock ? '#FF6B00' : '#FF6B00' }
            ]} />
            <Text style={styles.stockText}>
              {isInStock ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>

          {/* Add to Cart / Go to Cart Button */}
          <TouchableOpacity
            style={[
              styles.addToCartButtonGrid,
              !isInStock && styles.addToCartButtonDisabled,
              isInCart && styles.goToCartButton
            ]}
            onPress={(e) => {
              e.stopPropagation();
              if (isInCart) {
                navigateToCart();
              } else {
                handleAddToCart(item, item.variants?.[0]?.label || null, null, false);
              }
            }}
            disabled={!isInStock}
          >
            <ShoppingBag size={16} color="#fff" />
            <Text style={styles.addToCartTextGrid}>
              {isInCart ? 'Go to Cart' : (isInStock ? 'Add to Cart' : 'Out of Stock')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [isProductInCart, imageLoaded, handleShowProductDetails, handleAddToCart, handleImageLoad, API_URL, navigateToCart]);

  const renderListProductCard = useCallback(({ item }) => {
    const isInCart = isProductInCart(item._id);
    const isImageLoaded = imageLoaded[item._id];
    const isInStock = item.variants?.some(v => v.in_stock);
    
    return (
      <TouchableOpacity
        style={styles.productCardList}
        onPress={() => handleShowProductDetails(item)}
        activeOpacity={0.9}
      >
        {/* Product Image */}
        <View style={styles.productImageContainerList}>
          {!isImageLoaded && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="small" color="#FF6B00" />
            </View>
          )}
          <Image
            source={{ uri: `${API_URL}${item?.media?.[0]?.url}` }}
            style={[
              styles.productImageList,
              !isImageLoaded && styles.hiddenImage
            ]}
            resizeMode="contain"
            onLoad={() => handleImageLoad(item._id)}
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
                !isInStock && styles.addToCartButtonDisabled,
                isInCart && styles.goToCartButton
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (isInCart) {
                  navigateToCart();
                } else {
                  handleAddToCart(item, item.variants?.[0]?.label || null, null, false);
                }
              }}
              disabled={!isInStock}
            >
              <ShoppingBag size={16} color="#fff" />
              <Text style={styles.addToCartTextList}>
                {isInCart ? 'GO TO CART' : (isInStock ? 'ADD' : 'OUT')}
            </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [isProductInCart, imageLoaded, handleShowProductDetails, handleAddToCart, handleImageLoad, API_URL, navigateToCart]);

  const renderProductCard = useCallback(({ item }) => {
    return viewMode === 'grid' 
      ? renderGridProductCard({ item }) 
      : renderListProductCard({ item });
  }, [viewMode, renderGridProductCard, renderListProductCard]);

  const keyExtractor = useCallback((item) => String(item._id), []);

  const renderProductDetails = () => {
    if (!selectedProduct) return null;

    const isInCart = isProductInCart(selectedProduct._id);
    const displayPrice = getDisplayPrice(selectedProduct, selectedQuantity);
    const selectedVariant =
      selectedProduct?.variants?.find(v => v.label === selectedQuantity) || null;

    return (
      <View style={styles.productDetailsContainer}>
        {/* Custom Header */}
        <View style={styles.detailsHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowProductDetails(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.detailsTitle}>Product Details</Text>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={navigateToCart}
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

        <ScrollView 
          style={styles.detailsContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Gallery */}
          <View style={styles.imageGallery}>
            {mainImage ? (
              <Image 
                source={{ uri: mainImage }} 
                style={styles.detailsImage} 
                resizeMode="contain" 
              />
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
                <Truck size={16} color="#FF6B00" />
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
                  {selectedProduct.variants.map((v, index) => (
                    <TouchableOpacity
                      key={`${v.label}-${index}`}
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
                  <Shield size={20} color="#FF6B00" />
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
            {selectedProduct && (
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
                  <View style={[styles.specItem, styles.specItemLast]}>
                    <Text style={styles.specLabel}>Availability</Text>
                    <Text style={[
                      styles.specValue,
                      { color: selectedVariant?.in_stock ? '#FF6B00' : '#FF6B00' }
                    ]}>
                      {selectedVariant?.in_stock ? 'In Stock' : 'Out of Stock'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Fixed Footer */}
        <View style={styles.detailsFooter}>
          <TouchableOpacity
            style={[
              styles.addToCartButtonLarge,
              (!selectedVariant?.in_stock || !selectedProduct?.variants?.some(v => v.in_stock)) && 
                styles.addToCartButtonDisabled,
              isInCart && styles.goToCartButton
            ]}
            onPress={() => {
              if (isInCart) {
                navigateToCart();
              } else {
                handleAddToCart(selectedProduct, selectedQuantity, selectedVariant);
              }
            }}
            disabled={!selectedVariant?.in_stock}
          >
            <ShoppingBag size={22} color="#fff" />
            <Text style={styles.addToCartTextLarge}>
              {isInCart ? 'Go to Cart' : (selectedVariant?.in_stock ? 'Add to Cart' : 'Out of Stock')}
            </Text>
            {selectedVariant?.in_stock && !isInCart && (
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
              <CheckCircle size={60} color="#FF6B00" />
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
                  navigateToCart();
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

  /* ----------------------------- List Components ----------------------------- */

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Package size={60} color="#ccc" />
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptySubtitle}>
        {subcategoryName 
          ? `No products found in "${subcategoryName}" subcategory`
          : searchText.trim()
            ? `No results for "${searchText}"`
            : 'No products available in this category'
        }
      </Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={() => fetchProducts(1, true)}
        activeOpacity={0.8}
      >
        <RotateCcw size={18} color="#fff" />
        <Text style={styles.retryButtonText}>Refresh Products</Text>
      </TouchableOpacity>
    </View>
  ), [searchText, subcategoryName]);

  const ListFooterComponent = useMemo(() => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#FF6B00" />
        <Text style={styles.footerText}>Loading more products...</Text>
      </View>
    );
  }, [loadingMore]);

  const ErrorComponent = useMemo(() => {
    if (!error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color="#FF6B00" />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => fetchProducts(1, true)}
          activeOpacity={0.8}
        >
          <RotateCcw size={18} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }, [error]);

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
          <View style={styles.mainHeader}>
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
                <Text style={styles.headerTitle}>
                  {subcategoryName ? subcategoryName : 'Premium Health Products'}
                </Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity 
                    style={styles.headerButton}
                    onPress={() => setSearchActive(true)}
                  >
                    <Search size={22} color="#333" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.headerButton, styles.cartButton]}
                    onPress={navigateToCart}
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
          </View>

          {/* Error Display */}
          {error && !loading && (
            <View style={styles.errorContainerFull}>
              {ErrorComponent}
            </View>
          )}

          {/* Full Loading State */}
          {loading && !refreshing && !error && (
            <View style={styles.fullLoadingContainer}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.loadingText}>
                {subcategoryName ? `Loading ${subcategoryName} products...` : 'Loading premium products...'}
              </Text>
            </View>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {/* Only show categories section if not viewing a specific subcategory */}
              {!subcategoryId && (
                <View style={styles.categoriesSection}>
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
                </View>
              )}

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
                  {subcategoryName && ` in ${subcategoryName}`}
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
                    onPress={() => setShowSortModal(true)}
                  >
                    <Text style={styles.filterButtonText}>Filter</Text>
                    <Filter size={14} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Products List */}
              <Animated.FlatList
                key={`products-${viewMode}`}
                data={products}
                renderItem={renderProductCard}
                keyExtractor={keyExtractor}
                contentContainerStyle={[
                  styles.productList,
                  viewMode === 'grid' ? styles.productListGrid : styles.productListList,
                  products.length === 0 && styles.emptyListContainer,
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
                ListEmptyComponent={ListEmptyComponent}
                ListFooterComponent={ListFooterComponent}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={10}
                scrollEventThrottle={16}
              />
            </>
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
  
  // Toast Styles
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  toastSuccess: {
    backgroundColor: '#FF6B00',
  },
  toastError: {
    backgroundColor: '#FF4444',
  },
  toastWarning: {
    backgroundColor: '#FF9800',
  },
  toastInfo: {
    backgroundColor: '#2196F3',
  },
  toastText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
    marginRight: 12,
  },
  toastCloseButton: {
    padding: 4,
  },
  
  // Main Header Styles
  mainHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 1000,
  },
  normalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginLeft: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    position: 'relative',
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
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
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
  
  // Categories Section
  categoriesSection: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryScrollView: {
    flexGrow: 0,
  },
  categoryScrollContent: {
    paddingHorizontal: 1,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  fullLoadingContainer: {
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
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 300,
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
  
  // Error State
  errorContainerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  
  // Product List
  productList: {
    paddingBottom: 20,
    flexGrow: 1,
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
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  hiddenImage: {
    opacity: 0,
  },
  productImageGrid: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 2,
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
  goToCartButton: {
    backgroundColor: '#FF6B00',
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
    zIndex: 2,
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
  goToCartButton: {
    backgroundColor: '#FF6B00',
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
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
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
    color: '#FF6B00',
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
    marginBottom: 8,
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
    color: '#FF6B00',
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
  specItemLast: {
    borderBottomWidth: 0,
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
  addToCartButtonDisabled: {
    backgroundColor: '#ccc',
  },
  goToCartButton: {
    backgroundColor: '#FF6B00',
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
  
  // Footer Loader
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});