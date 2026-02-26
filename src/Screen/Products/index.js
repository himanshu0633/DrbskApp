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
  FlatList,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { addData } from '../../store/Action';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

/* --------------------------- helpers / normalizers -------------------------- */

function toNum(x, fallback = 0) {
  if (x === null || x === undefined || x === '') return fallback;
  // If it's already a number, return it
  if (typeof x === 'number') return x;
  // If it's a string, clean it and parse
  const n = parseFloat(String(x).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Parse the API's `quantity` field into a clean array of variant objects */
function parseVariants(raw) {
  try {
    console.log('Raw quantity data:', JSON.stringify(raw, null, 2));
    
    let parsed = [];

    // Handle your specific data structure: quantity is an array containing an array
    if (Array.isArray(raw) && raw.length > 0) {
      // Check if first element is an array (your case)
      if (Array.isArray(raw[0]) && raw[0].length > 0) {
        // This handles: quantity: [ [ {...} ] ]
        const innerArray = raw[0];
        if (typeof innerArray[0] === 'object') {
          parsed = innerArray;
        }
      } 
      // Check if first element is a string that needs parsing
      else if (typeof raw[0] === 'string') {
        try {
          const parsedString = JSON.parse(raw[0]);
          if (Array.isArray(parsedString)) {
            parsed = parsedString;
          } else if (typeof parsedString === 'object') {
            parsed = [parsedString];
          }
        } catch (e) {
          console.warn('Failed to parse stringified quantity:', e);
        }
      }
      // Check if first element is an object (direct array of variants)
      else if (typeof raw[0] === 'object') {
        parsed = raw;
      }
    } 
    // Handle if raw is a string
    else if (typeof raw === 'string') {
      try {
        const parsedJSON = JSON.parse(raw);
        if (Array.isArray(parsedJSON)) {
          parsed = parsedJSON;
        } else if (typeof parsedJSON === 'object') {
          parsed = [parsedJSON];
        }
      } catch (e) {
        console.warn('Failed to parse string quantity:', e);
      }
    }
    // Handle if raw is already an object
    else if (typeof raw === 'object' && raw !== null) {
      parsed = [raw];
    }

    // Map each variant to ensure proper types
    const mappedVariants = (parsed || []).map(v => ({
      label: (v.label || '').trim(),
      mrp: toNum(v.mrp),
      discount: toNum(v.discount),
      gst: toNum(v.gst),
      retail_price: toNum(v.retail_price),
      final_price: toNum(v.final_price),
      in_stock: String(v.in_stock || '').toLowerCase() === 'yes' || v.in_stock === true,
    }));

    console.log('Parsed variants:', mappedVariants);
    return mappedVariants;
  } catch (e) {
    console.warn('Failed to parse variants from quantity:', e);
    return [];
  }
}

/** Extract product level prices from variants */
function getProductPrices(variants) {
  if (!variants || variants.length === 0) {
    return {
      retail_price: 0,
      consumer_price: 0,
      discount: 0,
      gst: 0,
      mrp: 0
    };
  }
  
  const firstVariant = variants[0];
  return {
    retail_price: toNum(firstVariant.retail_price),
    consumer_price: toNum(firstVariant.final_price || firstVariant.retail_price),
    discount: toNum(firstVariant.discount),
    gst: toNum(firstVariant.gst),
    mrp: toNum(firstVariant.mrp)
  };
}

/** Calculate discount percentage from variant data */
function calculateDiscountPercent(variant) {
  if (!variant) return 0;
  
  const mrp = toNum(variant.mrp);
  const finalPrice = toNum(variant.final_price || variant.retail_price);
  
  // If discount is directly provided
  if (variant.discount > 0) {
    return Math.round(toNum(variant.discount));
  }
  
  // Calculate discount from MRP and final price
  if (mrp > 0 && finalPrice > 0 && mrp > finalPrice) {
    return Math.round(((mrp - finalPrice) / mrp) * 100);
  }
  
  return 0;
}

/** Get the display price for a product based on a selected variant label */
function getDisplayPrice(product, selectedLabel) {
  if (!product?.variants?.length) return toNum(product?.consumer_price || product?.retail_price || 0);
  
  const v = product.variants.find(x => x.label === selectedLabel);
  if (!v) return toNum(product?.consumer_price || product?.retail_price || 0);
  
  return toNum(v.final_price || v.retail_price || 0);
}

/** Get variant details for selected variant */
function getVariantDetails(product, selectedLabel) {
  if (!product?.variants?.length || !selectedLabel) return null;
  return product.variants.find(x => x.label === selectedLabel);
}

/** Get the original price (MRP) for display */
function getOriginalPrice(product, selectedLabel) {
  if (!product?.variants?.length) return toNum(product?.mrp || 0);
  
  const v = product.variants.find(x => x.label === selectedLabel);
  if (!v) return toNum(product?.mrp || 0);
  
  return toNum(v.mrp || 0);
}

/** Build a normalized product with price/originalPrice/discountPercent & variants */
function normalizeProduct(p) {
  if (!p) return p;
  
  console.log('Normalizing product:', p.name);
  
  const variants = parseVariants(p.quantity);
  
  let price = 0;
  let originalPrice = 0;
  let discountPercent = 0;
  
  // Use product-level prices as fallback
  const productRetailPrice = toNum(p.retail_price);
  const productConsumerPrice = toNum(p.consumer_price);
  const productMrp = toNum(p.mrp);
  const productDiscount = toNum(p.discount);
  
  if (variants.length > 0) {
    // Find variant with lowest price
    const minVar = variants.reduce((acc, v) => {
      const vPrice = v.final_price || v.retail_price || 0;
      const aPrice = acc.final_price || acc.retail_price || 0;
      return vPrice < aPrice ? v : acc;
    }, variants[0]);

    price = toNum(minVar.final_price || minVar.retail_price);
    originalPrice = toNum(minVar.mrp);
    discountPercent = calculateDiscountPercent(minVar);
  } else {
    // Use product-level prices
    price = productConsumerPrice || productRetailPrice;
    originalPrice = productMrp || price;
    discountPercent = productDiscount;
    
    // Calculate discount if not provided
    if (discountPercent === 0 && originalPrice > price) {
      discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
    }
  }
  
  const normalized = {
    ...p,
    price,
    originalPrice,
    discountPercent,
    variants,
    retail_price: productRetailPrice,
    consumer_price: productConsumerPrice,
    discount_value: productDiscount,
    gst: toNum(p.gst),
    mrp: productMrp,
    // Ensure stock status from variants or product level
    in_stock: variants.length > 0 
      ? variants.some(v => v.in_stock)
      : p.stock?.toLowerCase() === 'yes' || p.stock === true
  };
  
  console.log('Normalized product:', {
    name: normalized.name,
    price: normalized.price,
    originalPrice: normalized.originalPrice,
    discountPercent: normalized.discountPercent,
    variantsCount: normalized.variants.length,
    in_stock: normalized.in_stock
  });
  
  return normalized;
}

const rs = (size, factor = 0.5) => {
  return size + ((width / 400) - 1) * size * factor;
};

// Trending searches data
const trendingSearches = [
  'Vitamin C', 'Blood Pressure Monitor', 'Diabetes Test Strips', 
  'Immunity Boosters', 'Face Masks', 'Protein Powder', 
  'Multivitamins', 'Hand Sanitizer', 'Thermometer'
];

/* ---------------------------- Search Bar Component --------------------------- */

const SearchBar = ({ onSearchResultPress, showTrending, setShowTrending }) => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const fetchSearchResults = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const apiUrl = `/user/search?query=${encodeURIComponent(query)}`;
      const response = await axiosInstance.get(apiUrl);
      
      let results = [];
      if (Array.isArray(response.data)) {
        results = response.data;
      } else if (response.data?.results) {
        results = response.data.results;
      } else if (response.data?.data) {
        results = response.data.data;
      } else if (typeof response.data === 'object') {
        const keys = Object.keys(response.data);
        if (keys.length > 0 && Array.isArray(response.data[keys[0]])) {
          results = response.data[keys[0]];
        } else if (response.data._id) {
          results = [response.data];
        }
      }
      
      const normalizedResults = (results || []).map(normalizeProduct);
      setSearchResults(normalizedResults);
      
    } catch (error) {
      console.error('Search API error:', error);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleProductPress = (product) => {
    console.log('Product pressed:', product.name);
    if (onSearchResultPress) {
      onSearchResultPress(product);
    } else {
      navigation.navigate('ProductsPage', { selectedProduct: product });
    }
    setShowTrending(false);
    setSearchText('');
    setSearchResults([]);
  };

  const handleClearSearch = () => {
    setSearchText('');
    setSearchResults([]);
    setShowTrending(false);
  };

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (searchText.length > 1) {
      setShowTrending(true);
      const timeout = setTimeout(() => {
        fetchSearchResults(searchText);
      }, 500);
      setSearchTimeout(timeout);
    } else {
      setSearchResults([]);
    }
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchText]);

  const renderSearchResultItem = ({ item }) => {
    const normalizedProduct = normalizeProduct(item);
    const price = toNum(normalizedProduct.price, 0);
    const originalPrice = toNum(normalizedProduct.originalPrice, 0);
    const discountPercent = normalizedProduct.discountPercent || 0;
    const hasVariants = normalizedProduct.variants?.length > 0;
    
    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ 
            uri: item?.media?.[0]?.url 
              ? `${API_URL}${item.media[0].url}`
              : `https://via.placeholder.com/80x80?text=${item.name?.charAt(0) || 'P'}`
          }}
          style={styles.searchResultImage}
          resizeMode="cover"
        />
        
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultCategory} numberOfLines={1}>
            {item.category || 'Category'}
          </Text>
          <Text style={styles.searchResultName} numberOfLines={2}>
            {item.name}
          </Text>
          
          {hasVariants && normalizedProduct.variants?.length > 0 && (
            <View style={styles.variantIndicator}>
              <Text style={styles.variantText}>
                {normalizedProduct.variants[0].label}
                {normalizedProduct.variants.length > 1 ? ` +${normalizedProduct.variants.length - 1} more` : ''}
              </Text>
            </View>
          )}
          
          <View style={styles.searchResultPriceRow}>
            <Text style={styles.searchResultPrice}>
              ₹{price.toFixed(2)}
            </Text>
            {originalPrice > 0 && originalPrice > price && discountPercent > 0 && (
              <>
                <Text style={styles.searchResultOriginalPrice}>
                  ₹{originalPrice.toFixed(2)}
                </Text>
                <View style={styles.searchResultDiscountBadge}>
                  <Text style={styles.searchResultDiscountText}>
                    {discountPercent}% OFF
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.searchBarContainer}>
      <View style={styles.searchBar}>
        <View style={styles.searchIconContainer}>
          <Search size={rs(20)} color="#fff" />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines, health products..."
          placeholderTextColor="#777"
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setShowTrending(true)}
          onBlur={() => {
            setTimeout(() => {
              if (!searchText) {
                setShowTrending(false);
              }
            }, 200);
          }}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText ? (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={handleClearSearch}
          >
            <X size={rs(18)} color="#777" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.micButton}
            onPress={() => setShowTrending(true)}
          >
            <Filter size={rs(18)} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {showTrending && (searchResults.length > 0 || loadingSearch || searchText.length > 0) && (
        <View style={styles.searchResultsContainer}>
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsTitle}>
              {loadingSearch ? 'Searching...' : searchResults.length > 0 ? 'Search Results' : 'No Results'}
            </Text>
            {searchText.length > 0 && !loadingSearch && searchResults.length === 0 && (
              <Text style={styles.searchResultsSubtitle}>
                No products found for "{searchText}"
              </Text>
            )}
          </View>
          
          {loadingSearch ? (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color="#FF6B00" />
              <Text style={styles.searchLoadingText}>Searching products...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item._id || Math.random().toString()}
              renderItem={renderSearchResultItem}
              contentContainerStyle={styles.searchResultsList}
              showsVerticalScrollIndicator={false}
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={5}
            />
          ) : searchText.length > 1 && !loadingSearch ? (
            <View style={styles.noResultsContainer}>
              <Package size={40} color="#ccc" />
              <Text style={styles.noResultsText}>No products found</Text>
              <Text style={styles.noResultsSubtext}>
                Try different keywords or browse categories
              </Text>
            </View>
          ) : (
            <View style={styles.trendingContainer}>
              <Text style={styles.trendingTitle}>Trending Searches</Text>
              <View style={styles.trendingTagsContainer}>
                {trendingSearches.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.trendingTag}
                    onPress={() => {
                      setSearchText(item);
                      setShowTrending(true);
                    }}
                  >
                    <Text style={styles.trendingTagText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

/* --------------------------- Header Component -------------------------- */

const Header = ({ navigation, cartCount }) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {/* Left: Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        
        {/* Center: Logo */}
        <Image 
          source={require('../../assets/Logo.png')} 
          style={styles.logo} 
        />
        
        {/* Right: Cart Button */}
        <TouchableOpacity 
          style={[styles.iconButton, styles.cartButton]}
          onPress={() => navigation.navigate('Cart')}
        >
          <ShoppingBag size={rs(20)} color="#333" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.badgeText}>
                {cartCount > 9 ? '9+' : cartCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* -------------------------------- Main Component -------------------------------- */

export default function ProductsPage({ navigation, route }) {
  const insets = useSafeAreaInsets();
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
  const [showTrending, setShowTrending] = useState(false);
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
  
  const subcategoryId = route.params?.subcategoryId;
  const subcategoryName = route.params?.subcategoryName;

  /* ------------------------------- Navigation Helper ------------------------------- */
  
  const navigateToCart = useCallback(() => {
    try {
      navigation.navigate('Cart');
    } catch (error) {
      console.warn('Navigation failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Cannot navigate to cart right now',
        position: 'bottom',
        visibilityTime: 3000,
      });
    }
  }, [navigation]);

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

  const fetchProducts = async (pageNum = 1, isRefresh = false) => {
    if (isRefresh) {
      setLoading(true);
      setPage(1);
    } else if (pageNum > 1) {
      setLoadingMore(true);
    }
    
    setError(null);
    
    try {
      if (subcategoryName) {
        const encodedSubcategory = encodeURIComponent(subcategoryName);
        const response = await axiosInstance.get(
          `/api/productsBySubcategory?subcategory=${encodedSubcategory}`
        );
        
        let fetchedProducts = [];
        if (Array.isArray(response?.data)) {
          fetchedProducts = response.data;
        } else if (response?.data && typeof response.data === 'object') {
          fetchedProducts = response.data.products || response.data.data || response.data.result || [];
        }
        
        console.log('Fetched products for subcategory:', fetchedProducts.length);
        const normalized = (fetchedProducts || []).map(normalizeProduct);
        setAllProducts(normalized);
        setProducts(normalized);
        setHasMore(false);
        
      } else {
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
      setError('Failed to load products. Please try again.');
    }
    
    setLoading(false);
    setLoadingMore(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCategories(), fetchProducts(1, true)]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts(1, true);
  }, [subcategoryId]);

  /* ------------------------- category + search + sort ------------------------ */

  const filterByCategory = useCallback((category) => {
    setSelectedCategory(category);
    setPage(1);
  }, []);

  const applySorting = useCallback((option) => {
    setSortOption(option);
    setShowSortModal(false);
  }, []);

  const isProductInCart = useCallback((productId) => {
    return cartItems.some(item => item._id === productId);
  }, [cartItems]);

  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

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
  }, [allProducts, selectedCategory, sortOption]);

  useEffect(() => {
    setProducts(filteredProducts);
    setPage(1);
    setHasMore(false);
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
    
    // Set default selected quantity from first in-stock variant
    const availableVariant = normalized?.variants?.find(v => v.in_stock);
    setSelectedQuantity(availableVariant?.label || normalized?.variants?.[0]?.label || null);
    
    setShowProductDetails(true);
  }, []);

  /* --------------------- Add to Cart Functions -------------------- */

  const handleAddToCart = useCallback((product, quantity = null, variant = null, showModal = true) => {
    const priceToUse = quantity 
      ? getDisplayPrice(product, quantity)
      : toNum(product?.price);
    
    const selectedVariant = variant || 
      (quantity ? product.variants.find(v => v.label === quantity) : null);
    
    if (selectedVariant && !selectedVariant.in_stock) {
      Toast.show({
        type: 'error',
        text1: 'Out of Stock',
        text2: 'This product is currently out of stock',
        position: 'bottom',
        visibilityTime: 3000,
      });
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
      Toast.show({
        type: 'success',
        text1: 'Added to Cart!',
        text2: `${product.name} has been added to your cart`,
        position: 'bottom',
        visibilityTime: 3000,
      });
    }
  }, [dispatch]);

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
    const isInStock = item.in_stock || item.variants?.some(v => v.in_stock);
    
    return (
      <TouchableOpacity
        style={styles.productCardGrid}
        onPress={() => handleShowProductDetails(item)}
        activeOpacity={0.9}
      >
        <View style={styles.productImageContainer}>
          {!isImageLoaded && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="small" color="#FF6B00" />
            </View>
          )}
          <Image
            source={{ uri: item?.media?.[0]?.url ? `${API_URL}${item.media[0].url}` : 'https://via.placeholder.com/150' }}
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

        <View style={styles.productInfoGrid}>
          <Text style={styles.productCategory}>{item.category || 'Category'}</Text>
          <Text style={styles.productTitleGrid} numberOfLines={2}>
            {item.name}
          </Text>

          {item.variants?.length > 0 && (
            <View style={styles.variantIndicator}>
              <Text style={styles.variantText}>
                {item.variants[0].label}
                {item.variants.length > 1 ? ` +${item.variants.length - 1}` : ''}
              </Text>
            </View>
          )}

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
            <Text style={styles.ratingText}>4.0</Text>
          </View>

          <View style={styles.priceContainerGrid}>
            <Text style={styles.productPriceGrid}>₹{toNum(item?.price).toFixed(2)}</Text>
            {item.originalPrice > 0 && item.originalPrice > item.price && (
              <Text style={styles.originalPriceGrid}>₹{toNum(item?.originalPrice).toFixed(2)}</Text>
            )}
          </View>

          <View style={styles.stockContainer}>
            <View style={[
              styles.stockDot,
              { backgroundColor: isInStock ? '#FF6B00' : '#FF6B00' }
            ]} />
            <Text style={styles.stockText}>
              {isInStock ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>

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
              } else if (isInStock) {
                handleAddToCart(item, item.variants?.[0]?.label || null, null, false);
              }
            }}
            disabled={!isInStock}
          >
            <ShoppingBag size={16} color="#fff" />
            <Text style={styles.addToCartTextGrid}>
              {isInCart ? 'Go to Cart' : (isInStock ? 'Add' : 'Out')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [isProductInCart, imageLoaded, handleShowProductDetails, handleAddToCart, handleImageLoad, navigateToCart]);

  const renderListProductCard = useCallback(({ item }) => {
    const isInCart = isProductInCart(item._id);
    const isImageLoaded = imageLoaded[item._id];
    const isInStock = item.in_stock || item.variants?.some(v => v.in_stock);
    
    return (
      <TouchableOpacity
        style={styles.productCardList}
        onPress={() => handleShowProductDetails(item)}
        activeOpacity={0.9}
      >
        <View style={styles.productImageContainerList}>
          {!isImageLoaded && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="small" color="#FF6B00" />
            </View>
          )}
          <Image
            source={{ uri: item?.media?.[0]?.url ? `${API_URL}${item.media[0].url}` : 'https://via.placeholder.com/120' }}
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

        <View style={styles.productInfoList}>
          <View style={styles.productHeaderList}>
            <View style={styles.productTitleContainer}>
              <Text style={styles.productCategoryList}>{item.category}</Text>
              <Text style={styles.productTitleList} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
          </View>

          {item.variants?.length > 0 && (
            <View style={styles.variantIndicator}>
              <Text style={styles.variantText}>
                {item.variants[0].label}
                {item.variants.length > 1 ? ` +${item.variants.length - 1} more` : ''}
              </Text>
            </View>
          )}

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
            <Text style={styles.ratingText}>4.0</Text>
          </View>

          <View style={styles.priceRowList}>
            <View style={styles.priceContainerList}>
              <Text style={styles.productPriceList}>₹{toNum(item?.price).toFixed(2)}</Text>
              {item.originalPrice > 0 && item.originalPrice > item.price && (
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
                } else if (isInStock) {
                  handleAddToCart(item, item.variants?.[0]?.label || null, null, false);
                }
              }}
              disabled={!isInStock}
            >
              <ShoppingBag size={16} color="#fff" />
              <Text style={styles.addToCartTextList}>
                {isInCart ? 'CART' : (isInStock ? 'ADD' : 'OUT')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [isProductInCart, imageLoaded, handleShowProductDetails, handleAddToCart, handleImageLoad, navigateToCart]);

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
    const selectedVariant = getVariantDetails(selectedProduct, selectedQuantity);
    const originalPrice = getOriginalPrice(selectedProduct, selectedQuantity);
    
    const discountPercent = calculateDiscountPercent(selectedVariant);

    console.log('Rendering details for:', selectedProduct.name, 'with variant:', selectedVariant);

    return (
      <View style={styles.productDetailsContainer}>
        <View style={styles.header}>
      <View style={styles.headerContent}>
        {/* Left: Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setShowProductDetails(false)} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        
        {/* Center: Header Title */}
        <Text style={styles.headerTitle}>Products Details</Text>
        
        {/* Right: Cart Button */}
        <TouchableOpacity 
          style={[styles.iconButton, styles.cartButton]}
          onPress={() => navigation.navigate('Cart')}
        >
          <ShoppingBag size={rs(20)} color="#333" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.badgeText}>
                {cartCount > 9 ? '9+' : cartCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>

        <ScrollView 
          style={styles.detailsContent}
          showsVerticalScrollIndicator={false}
        >
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

          <View style={styles.detailsInfoContainer}>
            <View style={styles.productHeaderDetails}>
              <View style={styles.productCategoryBadge}>
                <Text style={styles.productCategoryText}>{selectedProduct.category || 'Category'}</Text>
              </View>
              <Text style={styles.detailsProductName}>{selectedProduct.name}</Text>
            </View>

            <View style={styles.ratingSection}>
              <View style={styles.ratingBadge}>
                <Star size={16} color="#FFD700" fill="#FFD700" />
                <Text style={styles.ratingValue}>4.5</Text>
                <Text style={styles.ratingCount}>(128)</Text>
              </View>
              <View style={styles.deliveryBadge}>
                <Truck size={16} color="#FF6B00" />
                <Text style={styles.deliveryText}>Free Delivery</Text>
              </View>
            </View>

            <View style={styles.detailsPriceSection}>
              <View style={styles.priceMain}>
                <Text style={styles.detailsPrice}>₹{toNum(displayPrice).toFixed(2)}</Text>
                {originalPrice > 0 && originalPrice > displayPrice && (
                  <Text style={styles.detailsOriginalPrice}>
                    ₹{toNum(originalPrice).toFixed(2)}
                  </Text>
                )}
                {discountPercent > 0 && (
                  <View style={styles.detailsDiscountBadge}>
                    <Text style={styles.detailsDiscountText}>
                      {discountPercent}% OFF
                    </Text>
                  </View>
                )}
              </View>
              
              {selectedVariant && selectedVariant.gst > 0 && (
                <View style={styles.gstBadge}>
                  <Text style={styles.gstText}>+ {selectedVariant.gst}% GST applicable</Text>
                </View>
              )}
            </View>

            {selectedProduct?.variants?.length > 0 && (
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
                        ₹{toNum(v.final_price || v.retail_price).toFixed(2)}
                      </Text>
                      {!v.in_stock && (
                        <Text style={styles.outOfStockLabel}>Out of Stock</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Show prescription requirement if applicable */}
            {selectedProduct.prescription === 'required' && (
              <View style={styles.prescriptionWarning}>
                <AlertCircle size={20} color="#FF6B00" />
                <Text style={styles.prescriptionText}>
                  Prescription required for this item
                </Text>
              </View>
            )}

            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionContent}>
                {selectedProduct.description || 'No description available'}
              </Text>
            </View>

            {/* Show benefits if available */}
            {selectedProduct.benefits && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Benefits</Text>
                <Text style={styles.sectionContent}>
                  {selectedProduct.benefits}
                </Text>
              </View>
            )}

            {/* Show dosage if available */}
            {selectedProduct.dosage && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Dosage</Text>
                <Text style={styles.sectionContent}>
                  {selectedProduct.dosage}
                </Text>
              </View>
            )}

            {/* Show side effects if available */}
            {selectedProduct.side_effects && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Side Effects</Text>
                <Text style={styles.sectionContent}>
                  {selectedProduct.side_effects}
                </Text>
              </View>
            )}

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
                    <Text style={styles.specLabel}>Product Variety</Text>
                    <Text style={styles.specValue}>{selectedProduct.productvariety || '—'}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Expiry</Text>
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
            
            {selectedVariant && (
              <View style={styles.priceBreakdownSection}>
                <Text style={styles.sectionTitle}>Price Breakdown</Text>
                <View style={styles.priceBreakdownGrid}>
                  <View style={styles.priceBreakdownItem}>
                    <Text style={styles.priceBreakdownLabel}>MRP</Text>
                    <Text style={styles.priceBreakdownValue}>
                      ₹{toNum(selectedVariant.mrp).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.priceBreakdownItem}>
                    <Text style={styles.priceBreakdownLabel}>Discount</Text>
                    <Text style={[styles.priceBreakdownValue, { color: '#FF6B00' }]}>
                      {toNum(selectedVariant.discount)}%
                    </Text>
                  </View>
                  {selectedVariant.gst > 0 && (
                    <View style={styles.priceBreakdownItem}>
                      <Text style={styles.priceBreakdownLabel}>GST</Text>
                      <Text style={styles.priceBreakdownValue}>
                        {toNum(selectedVariant.gst)}%
                      </Text>
                    </View>
                  )}
                  <View style={[styles.priceBreakdownItem, styles.priceBreakdownTotal]}>
                    <Text style={styles.priceBreakdownLabel}>Final Price</Text>
                    <Text style={[styles.priceBreakdownValue, styles.priceBreakdownTotalValue]}>
                      ₹{toNum(selectedVariant.final_price || displayPrice).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

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
              } else if (selectedVariant?.in_stock) {
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

//  const renderSuccessModal = () => {
//   const scaleAnim = useRef(new Animated.Value(0)).current;
//   const opacityAnim = useRef(new Animated.Value(0)).current;

//   useEffect(() => {
//     if (showSuccessModal) {
//       Animated.parallel([
//         Animated.spring(scaleAnim, {
//           toValue: 1,
//           tension: 50,
//           friction: 7,
//           useNativeDriver: true,
//         }),
//         Animated.timing(opacityAnim, {
//           toValue: 1,
//           duration: 200,
//           useNativeDriver: true,
//         }),
//       ]).start();
//     } else {
//       scaleAnim.setValue(0);
//       opacityAnim.setValue(0);
//     }
//   }, [showSuccessModal]);

//   return (
//     <Modal
//       animationType="fade"
//       transparent={true}
//       visible={showSuccessModal}
//       onRequestClose={() => setShowSuccessModal(false)}
//       statusBarTranslucent
//     >
//       <Animated.View 
//         style={[
//           styles.successModalOverlay,
//           { opacity: opacityAnim }
//         ]}
//       >
//         <Animated.View 
//           style={[
//             styles.successModal,
//             {
//               transform: [
//                 { scale: scaleAnim },
//                 {
//                   translateY: scaleAnim.interpolate({
//                     inputRange: [0, 1],
//                     outputRange: [50, 0],
//                   }),
//                 },
//               ],
//             },
//           ]}
//         >
//           <View style={styles.successModalContent}>
//             {/* Success Icon with Pulse Animation */}
//             <View style={styles.successIconWrapper}>
//               <Animated.View 
//                 style={[
//                   styles.successIconContainer,
//                   {
//                     transform: [{
//                       scale: scaleAnim.interpolate({
//                         inputRange: [0, 0.5, 1],
//                         outputRange: [0, 1.2, 1],
//                       }),
//                     }],
//                   },
//                 ]}
//               >
//                 <CheckCircle size={60} color="#10b981" />
//               </Animated.View>
//             </View>

//             {/* Text Content */}
//             <Text style={styles.successModalTitle}>Success! 🎉</Text>
//             <Text style={styles.successModalMessage}>
//               <Text style={styles.successProductName}>{addedProductName}</Text>
//               {'\n'}has been added to your cart
//             </Text>

//             {/* Action Buttons */}
//             <View style={styles.successModalButtons}>
//               <TouchableOpacity 
//                 style={styles.continueButton}
//                 onPress={() => {
//                   Animated.timing(opacityAnim, {
//                     toValue: 0,
//                     duration: 150,
//                     useNativeDriver: true,
//                   }).start(() => setShowSuccessModal(false));
//                 }}
//                 activeOpacity={0.7}
//               >
//                 <Text style={styles.continueButtonText}>Continue Shopping</Text>
//               </TouchableOpacity>
              
//               <TouchableOpacity 
//                 style={styles.viewCartButton}
//                 onPress={() => {
//                   Animated.timing(opacityAnim, {
//                     toValue: 0,
//                     duration: 150,
//                     useNativeDriver: true,
//                   }).start(() => {
//                     setShowSuccessModal(false);
//                     navigateToCart();
//                   });
//                 }}
//                 activeOpacity={0.7}
//               >
//                 <ShoppingBag size={18} color="#fff" />
//                 <Text style={styles.viewCartButtonText}>
//                   View Cart 
//                   {cartCount > 0 && (
//                     <Text style={styles.viewCartButtonCount}> ({cartCount})</Text>
//                   )}
//                 </Text>
//               </TouchableOpacity>
//             </View>

//             {/* Close Button (Optional) */}
//             <TouchableOpacity 
//               style={styles.closeButton}
//               onPress={() => setShowSuccessModal(false)}
//               hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
//             >
//               <X size={20} color="#9ca3af" />
//             </TouchableOpacity>
//           </View>
//         </Animated.View>
//       </Animated.View>
//     </Modal>
//   );
// };


  /* ----------------------------- List Components ----------------------------- */

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Package size={60} color="#ccc" />
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptySubtitle}>
        {subcategoryName 
          ? `No products found in "${subcategoryName}" subcategory`
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
  ), [subcategoryName]);

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

  /* ---------------------------------- Main UI ---------------------------------- */

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      {/* Modals */}
      {renderSortModal()}
      {/* {renderSuccessModal()} */}

      {showProductDetails ? (
        renderProductDetails()
      ) : (
        <>
          {/* Header */}
          <Header navigation={navigation} cartCount={cartCount} />

          {/* Search Bar */}
          <SearchBar 
            onSearchResultPress={handleShowProductDetails}
            showTrending={showTrending}
            setShowTrending={setShowTrending}
          />

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
          {!loading && !error && !showTrending && (
            <>
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
              <FlatList
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
      
      {/* Toast */}
      <Toast />
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
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: rs(15),
    paddingVertical: rs(8),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: rs(8),
  },
  logo: {
    width: rs(50),
    height: rs(50),
  },
  iconButton: {
    position: 'relative',
    padding: rs(8),
  },
  cartButton: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF6B00',
    width: rs(18),
    height: rs(18),
    borderRadius: rs(9),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: rs(10),
    fontWeight: 'bold',
  },
  
  // Search Bar Styles
  searchBarContainer: {
    backgroundColor: '#FF6B00',
    padding: rs(15),
    zIndex: 5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: rs(25),
    overflow: 'hidden',
  },
  searchIconContainer: {
    backgroundColor: '#FF6B00',
    padding: rs(10),
    borderRadius: rs(25),
  },
  searchInput: {
    flex: 1,
    paddingVertical: rs(10),
    paddingHorizontal: rs(15),
    fontWeight: '400',
    color: '#333',
    fontSize: rs(14),
  },
  clearButton: {
    padding: rs(10),
  },
  micButton: {
    padding: rs(10),
  },
  searchResultsContainer: {
    backgroundColor: '#fff',
    marginTop: rs(10),
    borderRadius: rs(12),
    maxHeight: height * 0.6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  searchResultsHeader: {
    padding: rs(15),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultsTitle: {
    fontWeight: '600',
    fontSize: rs(16),
    color: '#333',
    marginBottom: rs(4),
  },
  searchResultsSubtitle: {
    fontSize: rs(12),
    color: '#666',
  },
  searchResultsList: {
    padding: rs(10),
  },
  searchResultItem: {
    flexDirection: 'row',
    padding: rs(10),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultImage: {
    width: rs(60),
    height: rs(60),
    borderRadius: rs(8),
    marginRight: rs(12),
  },
  searchResultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  searchResultCategory: {
    fontSize: rs(10),
    color: '#FF6B00',
    fontWeight: '600',
    marginBottom: rs(2),
    textTransform: 'uppercase',
  },
  searchResultName: {
    fontSize: rs(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: rs(6),
    lineHeight: rs(18),
  },
  variantIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f4f8',
    paddingHorizontal: rs(8),
    paddingVertical: rs(2),
    borderRadius: rs(4),
    marginBottom: rs(6),
  },
  variantText: {
    fontSize: rs(10),
    color: '#666',
    fontWeight: '500',
  },
  searchResultPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchResultPrice: {
    fontSize: rs(16),
    fontWeight: 'bold',
    color: '#333',
    marginRight: rs(8),
  },
  searchResultOriginalPrice: {
    fontSize: rs(12),
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: rs(8),
  },
  searchResultDiscountBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: rs(6),
    paddingVertical: rs(2),
    borderRadius: rs(4),
  },
  searchResultDiscountText: {
    color: '#fff',
    fontSize: rs(10),
    fontWeight: 'bold',
  },
  searchLoadingContainer: {
    padding: rs(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchLoadingText: {
    marginTop: rs(12),
    fontSize: rs(14),
    color: '#666',
  },
  noResultsContainer: {
    padding: rs(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: rs(16),
    fontWeight: '600',
    color: '#333',
    marginTop: rs(12),
  },
  noResultsSubtext: {
    fontSize: rs(14),
    color: '#666',
    textAlign: 'center',
    marginTop: rs(8),
  },
  trendingContainer: {
    padding: rs(15),
  },
  trendingTitle: {
    fontWeight: '600',
    fontSize: rs(16),
    color: '#333',
    marginBottom: rs(10),
  },
  trendingTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(8),
  },
  trendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    borderRadius: rs(20),
    gap: rs(5),
  },
  trendingTagText: {
    fontWeight: '500',
    fontSize: rs(13),
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
    paddingHorizontal: 16,
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
  addToCartTextGrid: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  goToCartButton: {
    backgroundColor: '#FF6B00',
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
  headerButton: {
    padding: 8,
    position: 'relative',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
  prescriptionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  prescriptionText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
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
  
  // Price Breakdown Section
  priceBreakdownSection: {
    marginBottom: 24,
  },
  priceBreakdownGrid: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  priceBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  priceBreakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceBreakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  priceBreakdownTotal: {
    borderTopWidth: 2,
    borderTopColor: '#FF6B00',
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
  },
  priceBreakdownTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B00',
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
  // successModalOverlay: {
  //   flex: 1,
  //   backgroundColor: 'rgba(0, 0, 0, 0.7)',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   padding: 20,
  // },
  // successModal: {
  //   width: '100%',
  //   maxWidth: 400,
  //   backgroundColor: '#fff',
  //   borderRadius: 24,
  //   elevation: 5,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 4 },
  //   shadowOpacity: 0.3,
  //   shadowRadius: 8,
  // },
  // successModalContent: {
  //   padding: 32,
  //   alignItems: 'center',
  // },
  // successIconContainer: {
  //   width: 80,
  //   height: 80,
  //   borderRadius: 40,
  //   backgroundColor: '#E8F5E9',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   marginBottom: 24,
  // },
  // successModalTitle: {
  //   fontSize: 24,
  //   fontWeight: 'bold',
  //   color: '#333',
  //   marginBottom: 12,
  //   textAlign: 'center',
  // },
  // successModalMessage: {
  //   fontSize: 16,
  //   color: '#666',
  //   textAlign: 'center',
  //   marginBottom: 32,
  //   lineHeight: 24,
  // },
  // successModalButtons: {
  //   flexDirection: 'row',
  //   width: '100%',
  //   gap: 12,
  // },
  // continueButton: {
  //   flex: 1,
  //   paddingVertical: 16,
  //   borderRadius: 12,
  //   backgroundColor: '#f5f5f5',
  //   alignItems: 'center',
  // },
  // continueButtonText: {
  //   fontSize: 16,
  //   fontWeight: '600',
  //   color: '#333',
  // },
  // viewCartButton: {
  //   flex: 1,
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   paddingVertical: 16,
  //   borderRadius: 12,
  //   backgroundColor: '#FF6B00',
  //   gap: 8,
  // },
  // viewCartButtonText: {
  //   fontSize: 16,
  //   fontWeight: '600',
  //   color: '#fff',
  // },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  successModal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  successModalContent: {
    padding: 28,
    alignItems: 'center',
    position: 'relative',
  },
  successIconWrapper: {
    marginBottom: 20,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  successModalTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successModalMessage: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  successProductName: {
    fontWeight: '600',
    color: '#111827',
  },
  successModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  continueButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  viewCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#10b981',
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  viewCartButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  viewCartButtonCount: {
    fontWeight: '400',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
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