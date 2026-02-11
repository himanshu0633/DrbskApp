import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Image,
  FlatList,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Animated,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import axiosInstance from '../../Components/AxiosInstance';
import { useNavigation } from '@react-navigation/native';
import API_URL from '../../../config';
import { useFocusEffect } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { 
  Search, 
  ShoppingBag, 
  ArrowLeft, 
  ChevronLeft, 
  X, 
  Package, 
  RotateCcw,
  CheckCircle,
  Truck,
  Shield,
  Clock,
  Star,
  ShoppingCart,
  Filter,
  ChevronDown
} from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { addData } from '../../store/Action';
import { useToast } from '../../ToastProvider';
const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#f26522',
  primaryLight: '#ff8a50',
  primaryDark: '#c53d00',
  secondary: '#2e7d32',
  secondaryLight: '#60ad5e',
  secondaryDark: '#005005',
  background: '#f8f9fa',
  white: '#ffffff',
  black: '#000000',
  gray: '#757575',
  lightGray: '#e0e0e0',
  textPrimary: '#212121',
  textSecondary: '#757575',
};

/* --------------------------- Product Normalization Functions -------------------------- */

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

const rs = (size, factor = 0.5) => {
  return size + ((width / 400) - 1) * size * factor;
};

const Shop = () => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredCategories, setFilteredCategories] = useState([]);
  const navigation = useNavigation();
  const route = useRoute();
  
  // Search functionality states
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Product details modal states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [mainImage, setMainImage] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [addedProductName, setAddedProductName] = useState('');
  
  const { showToast } = useToast();
  const cartItems = useSelector((state) => state?.app?.data || []);  
  const cartCount = cartItems.length;
  const dispatch = useDispatch();
  

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const catRes = await axiosInstance.get('/user/allcategories');
          const cats = catRes?.data || [];
          setCategories(cats);
          setFilteredCategories(cats);

          const subRes = await axiosInstance.get('/user/allSubcategories');
          const subs = subRes?.data || [];
          setSubcategories(subs);

          // Handle pre-selected category from route params
          const incomingCategory = route.params?.selectedCategory;
          if (incomingCategory) {
            setSelectedCategoryId(incomingCategory._id);
          }
        } catch (error) {
          console.error('Error loading data:', error);
        }
      };

      loadData();
    }, [route.params?.selectedCategory])
  );

  // Filter categories based on search
  useEffect(() => {
    if (searchText.trim()) {
      const filtered = categories.filter(category =>
        category.name.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(categories);
    }
  }, [searchText, categories]);

  /* ------------------------------- Search Functions ------------------------------- */
  
  const fetchSearchResults = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const response = await axiosInstance.get(`/user/search?query=${encodeURIComponent(query)}`);
      
      // Handle different response structures
      let results = [];
      if (Array.isArray(response.data)) {
        results = response.data;
      } else if (response.data?.results) {
        results = response.data.results;
      } else if (response.data?.data) {
        results = response.data.data;
      } else if (typeof response.data === 'object') {
        // Try to extract array from object
        const keys = Object.keys(response.data);
        if (keys.length > 0 && Array.isArray(response.data[keys[0]])) {
          results = response.data[keys[0]];
        }
      }
      
      const normalizedResults = (results || []).map(normalizeProduct);
      setSearchResults(normalizedResults);
    } catch (error) {
      console.error('Error fetching search results:', error);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSearch = (text) => {
    setSearchText(text);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (text.length > 1) {
      setShowSearchResults(true);
      const timeout = setTimeout(() => {
        fetchSearchResults(text);
      }, 500);
      setSearchTimeout(timeout);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleClearSearch = () => {
    setSearchText('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchActive(false);
  };

  const handleProductPress = (product) => {
    setSelectedProduct(product);
    setShowProductDetails(true);
    setShowSearchResults(false);
    setSearchText('');
    setSearchResults([]);
  };

  const handleShowProductDetails = (product) => {
    const normalized = normalizeProduct(product);
    setSelectedProduct(normalized);
    
    const imageUrl = normalized?.media?.length > 0 
      ? `${API_URL}${normalized.media[0].url}`
      : null;
    setMainImage(imageUrl);
    
    const availableVariant = normalized?.variants?.find(v => v.in_stock);
    setSelectedQuantity(availableVariant?.label || normalized?.variants?.[0]?.label || null);
    
    setShowProductDetails(true);
  };

  /* --------------------- Add to Cart Functions -------------------- */

  const handleAddToCart = (product, quantity = null, variant = null, showModal = true) => {
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
      showToast(`${product.name} added to cart`, 'success');
    }
  };

  const navigateToCart = useCallback(() => {
    try {
      // Navigate to Cart screen
      navigation.navigate('Cart');
    } catch (error) {
      console.error('Navigation error:', error);
      showToast('Cannot navigate to cart right now', 'error');
    }
  }, [navigation, showToast]);

  const isProductInCart = (productId) => {
    return cartItems.some(item => item._id === productId);
  };

  const filteredSubcategories = subcategories.filter(
    (sub) => sub?.category_id?._id === selectedCategoryId
  );

  const renderSearchResultItem = ({ item }) => {
    const displayPrice = toNum(item.price, 0);
    const displayOriginalPrice = toNum(item.originalPrice, 0);
    const discountPercent = item.discountPercent || 0;
    const hasVariants = item.variants?.length > 0;
    const isInCart = isProductInCart(item._id);
    
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
          
          {hasVariants && (
            <View style={styles.variantIndicator}>
              <Text style={styles.variantText}>
                {item.variants.length} variant{item.variants.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
          
          <View style={styles.searchResultPriceRow}>
            <Text style={styles.searchResultPrice}>₹{displayPrice.toFixed(2)}</Text>
            {discountPercent > 0 && displayOriginalPrice > displayPrice && (
              <>
                <Text style={styles.searchResultOriginalPrice}>
                  ₹{displayOriginalPrice.toFixed(2)}
                </Text>
                <View style={styles.searchResultDiscountBadge}>
                  <Text style={styles.searchResultDiscountText}>
                    {discountPercent}% OFF
                  </Text>
                </View>
              </>
            )}
          </View>
          
          <TouchableOpacity
            style={[
              styles.searchResultAddButton,
              isInCart && styles.searchResultGoToCartButton,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              if (isInCart) {
                navigateToCart();
              } else {
                handleAddToCart(item, item.variants?.[0]?.label || null, null, false);
              }
            }}
          >
            <ShoppingBag size={14} color="#fff" />
            <Text style={styles.searchResultAddButtonText}>
              {isInCart ? 'Go to Cart' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        item._id === selectedCategoryId && styles.categoryItemSelected,
      ]}
      onPress={() => setSelectedCategoryId(item._id)}
    >
      <Image
        source={{ uri: `${API_URL}/${item.image}` }}
        style={styles.categoryImage}
      />
      <Text
        style={[
          styles.categoryText,
          item._id === selectedCategoryId && styles.categoryTextSelected,
        ]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderSubCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.subcategoryBox}
      onPress={() =>
        navigation.navigate('ProductsPage', {
          subcategoryId: item._id,
          subcategoryName: item.name,
        })
      }
    >
      <Image
        source={{ uri: `${API_URL}/${item?.image}` }}
        style={styles.subcategoryImage}
      />
      <Text style={styles.subcategoryText} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  /* ---------------------------- Product Details Modal ---------------------------- */

  const renderProductDetailsModal = () => {
    if (!selectedProduct) return null;

    const isInCart = isProductInCart(selectedProduct._id);
    const displayPrice = getDisplayPrice(selectedProduct, selectedQuantity);
    const selectedVariant =
      selectedProduct?.variants?.find(v => v.label === selectedQuantity) || null;

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={showProductDetails}
        onRequestClose={() => setShowProductDetails(false)}
      >
        <SafeAreaView style={styles.productDetailsContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          
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
                <View style={styles.cartBadgeModal}>
                  <Text style={styles.cartBadgeTextModal}>
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
        </SafeAreaView>
      </Modal>
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
        <View style={styles.successModal}>
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
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Modals */}
      {renderProductDetailsModal()}
      {renderSuccessModal()}

      {/* Header Section */}
      <View style={styles.header}>
        {searchActive ? (
          <View style={styles.searchHeader}>
            <TouchableOpacity
              onPress={() => handleClearSearch()}
              style={styles.searchBackButton}
            >
              <ArrowLeft size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.searchInputContainer}>
              <Search size={20} color={COLORS.gray} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search medicines, health products..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchText}
                onChangeText={handleSearch}
                autoFocus
                autoCapitalize="none"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => handleClearSearch()}>
                  <X size={20} color={COLORS.gray} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.normalHeader}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Categories</Text>
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setSearchActive(true)}
              >
                <Search size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, styles.cartButton]}
                onPress={navigateToCart}
              >
                <ShoppingBag size={22} color={COLORS.textPrimary} />
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

      {/* Search Results Overlay */}
      {showSearchResults && (
        <View style={styles.searchResultsOverlay}>
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
            ) : null}
          </View>
        </View>
      )}

      {/* Main Content */}
      {!showSearchResults && (
        <View style={styles.contentContainer}>
          <View style={styles.leftPane}>
            <FlatList
              data={filteredCategories}
              keyExtractor={(item) => item._id.toString()}
              renderItem={renderCategoryItem}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.noDataText}>No categories found</Text>
              }
            />
          </View>

          <View style={styles.rightPane}>
            {selectedCategoryId ? (
              <FlatList
                data={filteredSubcategories}
                keyExtractor={(item) => item._id.toString()}
                renderItem={renderSubCategoryItem}
                numColumns={2}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={styles.noDataText}>No subcategories found</Text>
                }
              />
            ) : (
              <View style={styles.noSelectionContainer}>
                <ShoppingBag size={60} color={COLORS.lightGray} />
                <Text style={styles.noSelectionText}>
                  Please select a category to view subcategories
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: rs(0),
  },
  
  // Header Styles
  header: { 
    paddingHorizontal: rs(1),
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  
  normalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 1,
    paddingVertical: 12,
  },
  
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  
  headerCenter: {
    flex: 1,
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  
  headerRight: {
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
  
  // Search Header Styles
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  
  searchBackButton: {
    padding: 8,
    marginRight: 8,
  },
  
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  
  // Search Results Styles
  searchResultsOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  
  searchResultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  
  searchResultsHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  
  searchResultsTitle: {
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  
  searchResultsSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  
  searchResultsList: {
    padding: 10,
  },
  
  searchResultItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  
  searchResultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  
  searchResultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  
  searchResultCategory: {
    fontSize: 10,
    color: '#FF6B00',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 18,
  },
  
  variantIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  
  variantText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  
  searchResultPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  
  searchResultPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  
  searchResultOriginalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  
  searchResultDiscountBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  searchResultDiscountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  searchResultAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  
  searchResultGoToCartButton: {
    backgroundColor: '#FF6B00',
  },
  
  searchResultAddButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  searchLoadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  searchLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  
  noResultsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  
  contentContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  
  leftPane: {
    width: width * 0.25,
    backgroundColor: COLORS.white,
    borderRightWidth: 1,
    borderRightColor: COLORS.lightGray,
  },
  
  rightPane: {
    flex: 1,
    padding: 12,
  },
  
  categoryItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    alignItems: 'center',
  },
  
  categoryItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  
  categoryImage: {
    width: 50,
    height: 40,
    marginBottom: 8,
    borderRadius: 4,
    resizeMode: 'cover',
  },
  
  categoryText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  categoryTextSelected: {
    fontWeight: 'bold',
    color: COLORS.white,
  },
  
  subcategoryBox: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 15,
    padding: 12,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  
  subcategoryImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginBottom: 10,
    resizeMode: 'cover',
  },
  
  subcategoryText: {
    fontSize: 13,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  
  noDataText: {
    textAlign: 'center',
    color: COLORS.gray,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  
  noSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  noSelectionText: {
    textAlign: 'center',
    color: COLORS.gray,
    marginTop: 16,
    fontSize: 16,
    paddingHorizontal: 20,
  },

  // Product Details Modal Styles
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
  
  cartBadgeModal: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B00',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  
  cartBadgeTextModal: {
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

  // Success Modal Styles
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

export default Shop;