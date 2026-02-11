import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Dimensions,
  Animated,
  Platform,
  Pressable,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FileText,
  Bell,
  Search,
  ShoppingCart,
  Heart,
  Star,
  ChevronRight,
  Pill,
  Stethoscope,
  Thermometer,
  Baby,
  Leaf,
  Flask,
  User,
  Clock,
  Award,
  TrendingUp,
  Bookmark,
  Calendar,
  Droplet,
  Zap,
  MapPin,
  ArrowRight,
  Plus,
  Minus,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  ShoppingBag,
  Menu,
  Home as HomeIcon,
  Package,
  MessageCircle,
  Settings,
  Bone,
  ArrowLeft,
  CheckCircle,
  Truck,
  Shield,
  RotateCcw,
} from 'lucide-react-native';
import axiosInstance from '../../Components/AxiosInstance';
import Geolocation from 'react-native-geolocation-service';
import API_URL from '../../../config';
import { useNavigation } from '@react-navigation/native';
import { PermissionsAndroid, Linking } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { addData } from '../../store/Action';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

/* --------------------------- Product Normalization Functions -------------------------- */

function toNum(x, fallback = 0) {
  if (x === null || x === undefined || x === '') return fallback;
  const n = parseFloat(String(x).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Parse the API's `quantity` field into a clean array of variant objects */
function parseVariants(raw) {
  try {
    console.log('=== PARSING VARIANTS ===');
    console.log('Raw quantity field:', raw);
    console.log('Type of raw:', typeof raw);
    
    let parsed = [];

    if (Array.isArray(raw) && raw.length > 0) {
      // Case 1: Array में JSON string है
      if (typeof raw[0] === 'string') {
        console.log('Case 1: Array with string');
        try {
          // First try to parse as JSON
          parsed = JSON.parse(raw[0]);
          console.log('First parse result:', parsed);
          console.log('Type after first parse:', typeof parsed);
          
          // If parsed is still a string, try parsing again
          if (typeof parsed === 'string') {
            console.log('Parsed is still string, parsing again');
            parsed = JSON.parse(parsed);
            console.log('Second parse result:', parsed);
          }
        } catch (innerError) {
          console.warn('Failed to parse JSON string:', innerError);
        }
      } 
      // Case 2: Direct array of objects है
      else if (typeof raw[0] === 'object') {
        console.log('Case 2: Direct array of objects');
        parsed = raw;
      }
    } 
    // Case 3: Direct JSON string है
    else if (typeof raw === 'string') {
      console.log('Case 3: Direct JSON string');
      parsed = JSON.parse(raw);
    }
    // Case 4: Direct array है
    else if (Array.isArray(raw)) {
      console.log('Case 4: Direct array');
      parsed = raw;
    }

    console.log('Parsed after initial processing:', parsed);

    // Ensure parsed is an array
    if (!Array.isArray(parsed)) {
      console.log('Parsed is not array, converting to array');
      parsed = [parsed];
    }

    // Filter out null/undefined and map to clean objects
    const result = (parsed || [])
      .filter(v => v != null)
      .map(v => ({
        label: String(v.label || '').trim() || 'Standard Pack',
        mrp: toNum(v.mrp),
        discount: toNum(v.discount),
        gst: toNum(v.gst),
        retail_price: toNum(v.retail_price),
        final_price: toNum(v.final_price),
        in_stock: String(v.in_stock || 'yes').toLowerCase() === 'yes',
      }));
    
    console.log('Final parsed variants:', result);
    return result;
    
  } catch (e) {
    console.warn('Failed to parse variants from quantity:', e, 'Raw:', raw);
    return [];
  }
}

/** Extract product level prices from variants */
function getProductPrices(variants) {
  console.log('=== GET PRODUCT PRICES ===');
  console.log('Input variants:', variants);
  
  if (!variants || variants.length === 0) {
    console.log('No variants, returning defaults');
    return {
      retail_price: 0,
      consumer_price: 0,
      discount: 0,
      gst: 0,
      mrp: 0
    };
  }
  
  // Use the first variant's data for product level display
  const firstVariant = variants[0];
  console.log('First variant:', firstVariant);
  
  // Calculate consumer price if not available
  const consumerPrice = toNum(firstVariant.final_price) || 
                       toNum(firstVariant.retail_price);
  
  const result = {
    retail_price: toNum(firstVariant.retail_price),
    consumer_price: consumerPrice,
    discount: toNum(firstVariant.discount), // Direct from variant
    gst: toNum(firstVariant.gst),
    mrp: toNum(firstVariant.mrp)
  };
  
  console.log('Product prices result:', result);
  return result;
}

/** Build a normalized product with price/originalPrice/discountPercent & variants */
function normalizeProduct(p) {
  console.log('=== NORMALIZE PRODUCT START ===');
  console.log('Product name:', p.name);
  console.log('Product ID:', p._id);
  
  const variants = parseVariants(p.quantity);
  console.log('Parsed variants:', variants);
  
  // Get product level prices from variants
  const productPrices = getProductPrices(variants);
  console.log('Product prices:', productPrices);
  
  // Calculate display prices
  let price = 0;
  let originalPrice = 0;
  
  if (variants.length > 0) {
    console.log('Variants found, calculating display prices');
    // Find variant with lowest final_price for display
    const minVar = variants.reduce((acc, v) => {
      const vPrice = v.final_price || 0;
      const aPrice = acc.final_price || 0;
      return vPrice < aPrice ? v : acc;
    }, variants[0]);

    console.log('Min variant for price:', minVar);
    
    price = toNum(minVar.final_price);
    originalPrice = toNum(minVar.mrp);
    
    console.log('Price from minVar.final_price:', price);
    console.log('OriginalPrice from minVar.mrp:', originalPrice);
    
    // If final_price is not available, use retail_price
    if (price === 0) {
      price = toNum(minVar.retail_price);
      console.log('Price after fallback to retail_price:', price);
    }
    
    // If mrp is not available, use retail_price as original price
    if (originalPrice === 0) {
      originalPrice = toNum(minVar.retail_price);
      console.log('OriginalPrice after fallback to retail_price:', originalPrice);
    }
  } else {
    console.log('No variants, using product level prices');
    price = productPrices.consumer_price || productPrices.retail_price || 0;
    originalPrice = productPrices.mrp || productPrices.retail_price || 0;
  }
  
  // Use discount directly from variant (NO CALCULATION)
  const discountPercent = productPrices.discount || 0;
  
  console.log('Discount from variant (no calculation):', discountPercent, '%');

  const result = {
    ...p,
    price,
    originalPrice,
    discountPercent, // Direct from variant
    variants,
    // Add product level prices from variants
    retail_price: productPrices.retail_price,
    consumer_price: productPrices.consumer_price,
    discount_value: productPrices.discount,
    gst: productPrices.gst,
    mrp: productPrices.mrp
  };
  
  console.log('=== NORMALIZE PRODUCT END ===');
  console.log('Final normalized product:', {
    name: result.name,
    price: result.price,
    originalPrice: result.originalPrice,
    discountPercent: result.discountPercent,
    variantCount: result.variants?.length
  });
  
  return result;
}

/** Get the display price for a product based on a selected variant label */
function getDisplayPrice(product, selectedLabel) {
  console.log('=== GET DISPLAY PRICE ===');
  console.log('Product:', product.name);
  console.log('Selected label:', selectedLabel);
  
  if (!product?.variants?.length) {
    console.log('No variants, using product fields');
    // Try to get price from product fields
    const price = toNum(
      product?.consumer_price || 
      product?.retail_price || 
      product?.price || 
      0
    );
    console.log('Price from product fields:', price);
    return price;
  }
  
  const v = product.variants.find(x => x.label === selectedLabel);
  console.log('Found variant:', v);
  
  if (!v) {
    console.log('Variant not found, using first variant');
    // Return first variant's price
    const price = toNum(product.variants[0]?.final_price || product.variants[0]?.retail_price || 0);
    console.log('Price from first variant:', price);
    return price;
  }
  
  const price = toNum(v.final_price || v.retail_price || 0);
  console.log('Price from selected variant:', price);
  return price;
}

/** Get variant details for selected variant */
function getVariantDetails(product, selectedLabel) {
  if (!product?.variants?.length || !selectedLabel) return null;
  return product.variants.find(x => x.label === selectedLabel);
}

const rs = (size, factor = 0.5) => {
  return size + ((width / 400) - 1) * size * factor;
};

// Health Articles Data
const healthArticles = [
  {
    id: 1,
    title: 'How to Boost Your Immunity Naturally',
    image: `https://www.uclahealth.org/sites/default/files/styles/landscape_16x9_030000_1200x675/public/images/08/boost-immunity-blog.jpg?f=eda12c20&itok=PWxFSp7F`,
    readTime: '5 min read',
    author: 'Dr. Sarah Johnson',
    category: 'Wellness',
    authorImage: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    id: 2,
    title: 'Understanding Blood Pressure Readings',
    image: `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSW_-i34FlBvo1YGMrHGFAjelsQcUv0JzCD4Q&s`,
    readTime: '7 min read',
    author: 'Dr. Michael Chen',
    category: 'Health',
    authorImage: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    id: 3,
    title: 'Benefits of Regular Exercise for Heart Health',
    image: `https://images.squarespace-cdn.com/content/v1/5e419cdc97af032560004b99/89c8838b-680a-4b42-b484-e604f6bf51e7/Blog+Heart+Health+1.jpg`,
    readTime: '4 min read',
    author: 'Dr. Emily Wilson',
    category: 'Fitness',
    authorImage: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
  {
    id: 4,
    title: 'Managing Diabetes: Diet & Lifestyle Tips',
    image: `https://www.fitterfly.com/blog/wp-content/uploads/2021/07/How-to-Control-Diabetes-Lifestyle-Modification-and-Diet-Tips-to-Keep-Your-Blood-Sugars-in-Control-scaled-1200x900.jpg`,
    readTime: '6 min read',
    author: 'Dr. Robert Patel',
    category: 'Diabetes',
    authorImage: 'https://randomuser.me/api/portraits/men/75.jpg',
  },
  {
    id: 5,
    title: 'The Importance of Vitamin D for Bone Health',
    image: `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQaCK7_68c9xzoXql31RdS0l51v45Vkmzzy3w&s`,
    readTime: '5 min read',
    author: 'Dr. Lisa Thompson',
    category: 'Nutrition',
    authorImage: 'https://randomuser.me/api/portraits/women/90.jpg',
  },
];

const trendingSearches = [
  'Vitamin C', 'Blood Pressure Monitor', 'Diabetes Test Strips', 
  'Immunity Boosters', 'Face Masks', 'Protein Powder', 
  'Multivitamins', 'Hand Sanitizer', 'Thermometer'
];

// Updated Header with integrated location
const Header = ({ location, onLocationPress, cartCount, onCartPress }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {/* Logo and Location in same row */}
        <View style={styles.logoLocationRow}>
          <Image source={require('../../assets/Logo.png')} style={styles.logo} />
          
          <View style={styles.verticalDivider} />
          
          <TouchableOpacity 
            style={styles.locationCompact}
            onPress={onLocationPress}
          >
            <View style={styles.locationInfoCompact}>
              <Text style={styles.deliverToCompact}>Deliver to</Text>
              <View style={styles.locationRowCompact}>
                <MapPin size={rs(12)} color="#FF6B00" />
                <Text style={styles.locationTextCompact} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            </View>
            <ChevronDown size={rs(14)} color="#777" />
          </TouchableOpacity>
        </View>
        
        {/* Icons on right */}
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.iconButton, styles.cartButton]}
            onPress={onCartPress}
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
    </View>
  );
};

// Search bar component with trending searches - UPDATED WITH EXACT FUNCTIONALITY
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
      console.log('=== SEARCH API CALL START ===');
      console.log('Search Query:', query);
      const apiUrl = `/user/search?query=${encodeURIComponent(query)}`;
      console.log('API URL:', apiUrl);
      
      const response = await axiosInstance.get(apiUrl);
      
      console.log('=== SEARCH API RESPONSE ===');
      console.log('Response Status:', response.status);
      console.log('Response Data Type:', typeof response.data);
      console.log('Response Data:', JSON.stringify(response.data, null, 2));
      
      // Handle different response structures
      let results = [];
      if (Array.isArray(response.data)) {
        console.log('Case 1: Response.data is Array');
        results = response.data;
      } else if (response.data?.results) {
        console.log('Case 2: Response.data.results exists');
        results = response.data.results;
      } else if (response.data?.data) {
        console.log('Case 3: Response.data.data exists');
        results = response.data.data;
      } else if (typeof response.data === 'object') {
        console.log('Case 4: Response.data is object');
        // Try to extract array from object
        const keys = Object.keys(response.data);
        console.log('Object Keys:', keys);
        
        if (keys.length > 0 && Array.isArray(response.data[keys[0]])) {
          console.log(`Key "${keys[0]}" contains array`);
          results = response.data[keys[0]];
        } else {
          // Try to see if it's a single product object
          console.log('Checking if it\'s a single product object');
          if (response.data._id) {
            console.log('Single product found with ID:', response.data._id);
            results = [response.data];
          }
        }
      }
      
      console.log('=== PARSED RESULTS ===');
      console.log('Results Count:', results.length);
      
      if (results.length > 0) {
        console.log('First Result Full:', JSON.stringify(results[0], null, 2));
        
        if (results[0].quantity) {
          console.log('=== QUANTITY FIELD DEBUG ===');
          console.log('Quantity field type:', typeof results[0].quantity);
          console.log('Quantity field value:', results[0].quantity);
          
          // Debug parseVariants
          const testVariants = parseVariants(results[0].quantity);
          console.log('Parsed Variants:', testVariants);
          
          // Debug normalizeProduct
          const testNormalized = normalizeProduct(results[0]);
          console.log('Normalized Product:', {
            name: testNormalized.name,
            price: testNormalized.price,
            originalPrice: testNormalized.originalPrice,
            discountPercent: testNormalized.discountPercent,
            variants: testNormalized.variants
          });
        }
      } else {
        console.log('No results found');
      }
      
      const normalizedResults = (results || []).map(normalizeProduct);
      console.log('=== FINAL NORMALIZED RESULTS ===');
      normalizedResults.forEach((prod, idx) => {
        console.log(`Product ${idx + 1}:`, {
          name: prod.name,
          price: prod.price,
          originalPrice: prod.originalPrice,
          discountPercent: prod.discountPercent,
          variantCount: prod.variants?.length,
          variants: prod.variants
        });
      });
      
      setSearchResults(normalizedResults);
      
    } catch (error) {
      console.error('=== SEARCH API ERROR ===');
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      if (error.response) {
        console.error('Error Response Status:', error.response.status);
        console.error('Error Response Data:', error.response.data);
      }
      setSearchResults([]);
    } finally {
      console.log('=== SEARCH API CALL END ===');
      setLoadingSearch(false);
    }
  };

  const handleProductPress = (product) => {
    console.log('=== PRODUCT PRESSED ===');
    console.log('Product Name:', product.name);
    console.log('Product ID:', product._id);
    console.log('Product Price:', product.price);
    console.log('Product Original Price:', product.originalPrice);
    console.log('Product Discount:', product.discountPercent);
    console.log('Product Variants:', product.variants);
    
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
    console.log('=== RENDERING SEARCH RESULT ITEM ===');
    console.log('Item ID:', item._id);
    console.log('Item Name:', item.name);
    
    const normalizedProduct = normalizeProduct(item);
    console.log('Normalized Product in render:', {
      price: normalizedProduct.price,
      originalPrice: normalizedProduct.originalPrice,
      discountPercent: normalizedProduct.discountPercent,
      variants: normalizedProduct.variants
    });
    
    const price = toNum(normalizedProduct.price, 0);
    const originalPrice = toNum(normalizedProduct.originalPrice, 0);
    const discountPercent = normalizedProduct.discountPercent || 0; // Direct from variant
    const hasVariants = normalizedProduct.variants?.length > 0;
    
    console.log('Display Price:', price);
    console.log('Display Original Price:', originalPrice);
    console.log('Discount (from variant):', discountPercent, '%');
    
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
            // Delay hiding to allow clicks on results
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

// Main banner with carousel
const MainBanner = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [banners, setBanners] = useState([]);
  const scrollViewRef = useRef(null);
  const scrollTimer = useRef(null);

  const fetchData = async () => {
    try {
      const response = await axiosInstance.get('/user/allBanners');
      const bannerData = response.data;

      const mainBanners = bannerData?.filter(
        (banner) =>
          banner?.type === 'HomePageSlider' &&
          Array.isArray(banner.slider_image) &&
          banner.slider_image.length > 0
      );

      if (mainBanners.length > 0) {
        setBanners([
          mainBanners[mainBanners.length - 1],
          ...mainBanners,
          mainBanners[0],
        ]);
      }
    } catch (error) {
      console.error('Error fetching banners:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (banners.length === 0) return;

    scrollTimer.current = setInterval(() => {
      setActiveSlide((prev) => {
        const nextSlide = (prev + 1) % banners.length;
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: nextSlide * (width - 30),
            animated: true,
          });
        }
        return nextSlide;
      });
    }, 5000);

    return () => clearInterval(scrollTimer.current);
  }, [banners]);

  return (
    <View style={styles.mainBannerContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const slideIndex = Math.floor(
            event.nativeEvent.contentOffset.x / (width - 30)
          );
          setActiveSlide(slideIndex);
        }}
      >
        {banners?.map((banner, index) => (
          <ImageBackground
            key={index}
            source={{ uri: `${API_URL}/${banner.slider_image[0]}` }}
            style={[styles.mainBanner, { width: width - 30 }]}
            imageStyle={{ borderRadius: 16 }}
            resizeMode="contain"
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.0)', 'transparent']}
              style={styles.bannerGradient}
            >
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        ))}
      </ScrollView>

      <View style={styles.paginationContainer}>
        {banners.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.paginationDot,
              {
                width: index === activeSlide ? rs(20) : rs(8),
                backgroundColor: index === activeSlide ? '#FF6B00' : '#D1D1D1',
              },
            ]}
            onPress={() => {
              if (scrollViewRef.current) {
                scrollViewRef.current.scrollTo({
                  x: index * (width - 30),
                  animated: true,
                });
                setActiveSlide(index);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
};

// LinearGradient fallback component
const LinearGradient = ({ colors, style, children }) => {
  return (
    <View style={[style, { backgroundColor: colors[0] }]}>
      {children}
    </View>
  );
};

// Quick actions grid
const QuickActions = ({ onProductsPress, onOrdersPress }) => {
  const navigation = useNavigation();

  const actions = [
    { 
      icon: 'Pill', 
      title: 'Order Medicine', 
      color: '#E3F2FD', 
      onPress: onProductsPress || (() => navigation.navigate('ProductsPage'))
    },
    { 
      icon: 'FileText', 
      title: 'No Prescription', 
      color: '#FFF3E0', 
      onPress: onProductsPress || (() => navigation.navigate('ProductsPage'))
    },
    { 
      icon: 'Clock', 
      title: 'Previously Bought', 
      color: '#E8F5E9', 
      onPress: onOrdersPress || (() => navigation.navigate('Orders'))
    },
    { 
      icon: 'Award', 
      title: 'Deals For You', 
      color: '#F3E5F5',
      onPress: () => navigation.navigate('ProductsPage', { sortOption: 'discount' })
    },
  ];

  const itemsPerRow = width < 600 ? 2 : width < 900 ? 3 : 4;

  return (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={[styles.quickActionsGrid, { gap: rs(12) }]}>
        {actions.map((action, index) => (
          <TouchableOpacity 
            key={index} 
            onPress={action.onPress}
            style={[
              styles.quickActionItem, 
              { 
                width: (width - 30 - (itemsPerRow - 1) * rs(12)) / itemsPerRow,
                height: rs(100)
              }
            ]}
          >
            <View 
              style={[
                styles.quickActionIconContainer, 
                { backgroundColor: action.color }
              ]}
            >
              {action.icon === 'Pill' && <Pill size={rs(24)} color="#FF6B00" />}
              {action.icon === 'FileText' && <FileText size={rs(24)} color="#FF6B00" />}
              {action.icon === 'Clock' && <Clock size={rs(24)} color="#FF6B00" />}
              {action.icon === 'Award' && <Award size={rs(24)} color="#FF6B00" />}
            </View>
            <Text style={styles.quickActionText}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Categories horizontal scroll with images
const Categories = ({ onCategoryPress }) => {
  const [categoriesData, setCategoriesData] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axiosInstance.get('/user/allSubcategories');
      const allSubcategories = response?.data || [];
      const humanCategories = allSubcategories.filter(cat => cat.subCategoryvariety === 'Human' || !cat.subCategoryvariety);
      setCategoriesData(humanCategories);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  return (
    <View style={styles.categoriesContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shop by Human Subcategory</Text>
      </View>
      <FlatList
        data={categoriesData}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.categoryItem} 
            onPress={() => onCategoryPress ? onCategoryPress(item) : navigation.navigate('Category', { selectedCategory: item })}
          >
            <ImageBackground
              source={{ uri: `${API_URL}/${item.image}` }}
              style={styles.categoryImage}
              imageStyle={{ borderRadius: rs(12) }}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)']}
                style={styles.categoryGradient}
              >
                <Text style={styles.categoryText}>{item.name}</Text>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: 15, gap: rs(12) }}
      />
    </View>
  );
};

const VeterinaryCategories = ({ onCategoryPress }) => {
  const [categoriesData, setCategoriesData] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axiosInstance.get('/user/allSubcategories');
      const allSubcategories = response?.data || [];
      const vetCategories = allSubcategories.filter(cat => cat.subCategoryvariety === 'Veterinary'|| !cat.subCategoryvariety);
      setCategoriesData(vetCategories);
    } catch (error) {
      console.error("Error fetching veterinary categories:", error);
    }
  };

  return (
    <View style={styles.categoriesContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shop by Veterinary Subcategory</Text>
      </View>
      <FlatList
        data={categoriesData}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.categoryItem} 
            onPress={() => onCategoryPress ? onCategoryPress(item) : navigation.navigate('Category', { selectedCategory: item })}
          >
            <ImageBackground
              source={{ uri: `${API_URL}/${item.image}` }}
              style={styles.categoryImage}
              imageStyle={{ borderRadius: rs(12) }}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)']}
                style={styles.categoryGradient}
              >
                <Text style={styles.categoryText}>{item.name}</Text>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: 15, gap: rs(12) }}
      />
    </View>
  );
};

// Offers section with gradient cards 
const OffersSection = () => {
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    const fetchData2 = async () => {
      try {
        const response = await axiosInstance.get("/user/allBanners");
        const bannerData = response.data;

        const offerBanners = bannerData.filter(
          (banner) =>
            banner.type === "carousel1" &&
            Array.isArray(banner.slider_image) &&
            banner.slider_image.length > 0
        );

        setOffers(offerBanners);
      } catch (error) {
        console.error("Error fetching banners:", error?.response || error);
      }
    };

    fetchData2();
  }, []);

  if (offers.length === 0) return null;

  return (
    <View style={styles.offersContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Special Offers</Text>
        <TouchableOpacity style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight size={rs(14)} color="#FF6B00" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={offers}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <Image
            source={{ uri: `${API_URL}/${item.slider_image[0]}` }}
            style={styles.offerImageOnly}
            resizeMode="cover"
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 15, gap: rs(12) }}
      />
    </View>
  );
};

// Enhanced product card component
const ProductCard = ({ product, style, onPress, onAddToCart, isInCart, navigateToCart }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };
  
  const normalizedProduct = normalizeProduct(product);
  const discountPercent = normalizedProduct.discountPercent || 0;
  const price = toNum(normalizedProduct.price, 0);
  const originalPrice = toNum(normalizedProduct.originalPrice, 0);
  const isProductInCart = isInCart;
  const isInStock = normalizedProduct.variants?.some(v => v.in_stock) || true;
  
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View 
        style={[
          styles.productCard, 
          style,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        {/* <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={(e) => {
            e.stopPropagation();
            setIsFavorite(!isFavorite);
          }}
        >
          <Heart 
            size={rs(20)} 
            color={isFavorite ? "#E91E63" : "#777"} 
            fill={isFavorite ? "#E91E63" : "none"} 
          />
        </TouchableOpacity> */}
        
        {discountPercent > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>
              {discountPercent}% OFF
            </Text>
          </View>
        )}
        
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.productImageContainer}
        >
          {imageError ? (
            <View style={[styles.productImage, styles.placeholderContainer]}>
              <Pill size={rs(30)} color="#ccc" />
            </View>
          ) : (
            <Image
              source={{ 
                uri: product?.media?.[0]?.url 
                  ? `${API_URL}${product.media[0].url}`
                  : `https://via.placeholder.com/120x120?text=${product.name?.charAt(0) || 'P'}`
              }}
              style={styles.productImage}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          )}
        </Pressable>
        
        <View style={styles.ratingContainer}>
          <Star size={rs(12)} color="#FFC107" fill="#FFC107" />
          <Text style={styles.ratingText}>4.0</Text>
          <Text style={styles.reviewsText}>(128)</Text>
        </View>
        
        <Text style={styles.productTitle} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productCategory} numberOfLines={1}>
          {product.category || 'Category'}
        </Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>₹{price.toFixed(2)}</Text>
          {discountPercent > 0 && originalPrice > price && (
            <Text style={styles.originalPrice}>₹{originalPrice.toFixed(2)}</Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={[
            styles.addToCartButton,
            !isInStock && styles.addToCartButtonDisabled,
            isProductInCart && styles.goToCartButton
          ]}
          onPress={(e) => {
            e.stopPropagation();
            if (isProductInCart) {
              navigateToCart();
            } else {
              onAddToCart(product, normalizedProduct.variants?.[0]?.label || null, null, false);
            }
          }}
          disabled={!isInStock}
        >
          <ShoppingCart size={rs(16)} color={isProductInCart ? "#fff" : "#FF6B00"} />
          <Text style={[
            styles.addToCartText,
            isProductInCart && styles.goToCartText
          ]}>
            {isProductInCart ? 'Go to Cart' : (isInStock ? 'Add to Cart' : 'Out of Stock')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Health articles section with enhanced cards
const HealthArticles = () => {
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Health Articles</Text>
        <TouchableOpacity style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight size={rs(14)} color="#FF6B00" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={healthArticles}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.articleCard}>
            <ImageBackground
              source={{ uri: item.image }}
              style={styles.articleImage}
              imageStyle={{ borderTopLeftRadius: rs(12), borderTopRightRadius: rs(12) }}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.articleImageGradient}
              >
                <View style={styles.articleCategoryContainer}>
                  <Text style={styles.articleCategory}>{item.category}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
            
            <View style={styles.articleContent}>
              <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
              
              <View style={styles.articleMeta}>
                <View style={styles.authorContainer}>
                  <Image 
                    source={{ uri: item.authorImage }} 
                    style={styles.authorImage} 
                  />
                  <Text style={styles.articleAuthor}>{item.author}</Text>
                </View>
                <View style={styles.articleReadTimeContainer}>
                  <Clock size={rs(12)} color="#777" />
                  <Text style={styles.articleReadTime}>{item.readTime}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: 15, gap: rs(12) }}
      />
    </View>
  );
};

// Product Details Modal (similar to ProductsPage)
const ProductDetailsModal = ({ 
  product, 
  visible, 
  onClose, 
  onAddToCart, 
  cartCount, 
  navigation,
  isProductInCart,
  navigateToCart 
}) => {
  const [selectedQuantity, setSelectedQuantity] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const [isInCart, setIsInCart] = useState(false);

  useEffect(() => {
    if (product) {
      const normalized = normalizeProduct(product);
      const imageUrl = normalized?.media?.length > 0 
        ? `${API_URL}${normalized.media[0].url}`
        : null;
      setMainImage(imageUrl);
      
      const availableVariant = normalized?.variants?.find(v => v.in_stock);
      setSelectedQuantity(availableVariant?.label || normalized?.variants?.[0]?.label || null);
      setIsInCart(isProductInCart(product._id));
    }
  }, [product, isProductInCart]);

  if (!product) return null;

  const normalizedProduct = normalizeProduct(product);
  const displayPrice = getDisplayPrice(normalizedProduct, selectedQuantity);
  const selectedVariant = getVariantDetails(normalizedProduct, selectedQuantity);
  
  // Get product level prices from the first variant
  const productPrices = getProductPrices(normalizedProduct.variants);
  
  // Use discount directly from variant (NO CALCULATION)
  const actualDiscountPercent = selectedVariant 
    ? toNum(selectedVariant.discount)
    : productPrices.discount || 0;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.productDetailsContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Custom Header */}
        <View style={styles.detailsHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
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
                <Text style={styles.productCategoryText}>{normalizedProduct.category}</Text>
              </View>
              <Text style={styles.detailsProductName}>{normalizedProduct.name}</Text>
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
                {selectedVariant && (
                  <>
                    {selectedVariant.mrp > 0 && selectedVariant.mrp > displayPrice && (
                      <Text style={styles.detailsOriginalPrice}>
                        ₹{toNum(selectedVariant.mrp).toFixed(2)}
                      </Text>
                    )}
                    {actualDiscountPercent > 0 && (
                      <View style={styles.detailsDiscountBadge}>
                        <Text style={styles.detailsDiscountText}>
                          {actualDiscountPercent}% OFF
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
              
              {/* Display GST information */}
              {selectedVariant && selectedVariant.gst > 0 && (
                <View style={styles.gstBadge}>
                  <Text style={styles.gstText}>+ {selectedVariant.gst}% GST applicable</Text>
                </View>
              )}
            </View>

            {/* Quantity Selector */}
            {normalizedProduct?.variants?.length > 1 ? (
              <View style={styles.quantitySection}>
                <Text style={styles.quantityTitle}>Select Quantity</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.quantityScroll}
                >
                  {normalizedProduct.variants.map((v, index) => (
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
            ) : (
              <View style={styles.singleQuantity}>
                <Text style={styles.singleQuantityLabel}>Available: </Text>
                <Text style={styles.singleQuantityValue}>
                  {normalizedProduct?.variants?.[0]?.label || 'Standard Pack'}
                </Text>
              </View>
            )}

            {/* Description */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionContent}>
                {normalizedProduct.description || 'No description available'}
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
            {normalizedProduct && (
              <View style={styles.specsSection}>
                <Text style={styles.sectionTitle}>Specifications</Text>
                <View style={styles.specsGrid}>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Category</Text>
                    <Text style={styles.specValue}>{normalizedProduct.category || '—'}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Sub Category</Text>
                    <Text style={styles.specValue}>{normalizedProduct.sub_category || '—'}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Expiry Date</Text>
                    <Text style={styles.specValue}>{normalizedProduct.expires_on || '—'}</Text>
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
            
            {/* Price Breakdown */}
            {selectedVariant && (
              <View style={styles.priceBreakdownSection}>
                <Text style={styles.sectionTitle}>Price Breakdown</Text>
                <View style={styles.priceBreakdownGrid}>
                  <View style={styles.priceBreakdownItem}>
                    <Text style={styles.priceBreakdownLabel}>MRP</Text>
                    <Text style={styles.priceBreakdownValue}>
                      ₹{toNum(selectedVariant.mrp || normalizedProduct.mrp).toFixed(2)}
                    </Text>
                  </View>
                  {/* <View style={styles.priceBreakdownItem}>
                    <Text style={styles.priceBreakdownLabel}>Retail Price</Text>
                    <Text style={styles.priceBreakdownValue}>
                      ₹{toNum(selectedVariant.retail_price || normalizedProduct.retail_price).toFixed(2)}
                    </Text>
                  </View> */}
                  <View style={styles.priceBreakdownItem}>
                    <Text style={styles.priceBreakdownLabel}>Discount</Text>
                    <Text style={[styles.priceBreakdownValue, { color: '#FF6B00' }]}>
                      {toNum(selectedVariant.discount || normalizedProduct.discount_value)}%
                    </Text>
                  </View>
                  <View style={styles.priceBreakdownItem}>
                    <Text style={styles.priceBreakdownLabel}>GST</Text>
                    <Text style={styles.priceBreakdownValue}>
                      {toNum(selectedVariant.gst || normalizedProduct.gst)}%
                    </Text>
                  </View>
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

        {/* Fixed Footer */}
        <View style={styles.detailsFooter}>
          <TouchableOpacity
            style={[
              styles.addToCartButtonLarge,
              (!selectedVariant?.in_stock || !normalizedProduct?.variants?.some(v => v.in_stock)) && 
                styles.addToCartButtonDisabled,
              isInCart && styles.goToCartButton
            ]}
            onPress={() => {
              if (isInCart) {
                navigateToCart();
              } else {
                onAddToCart(normalizedProduct, selectedQuantity, selectedVariant);
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

// Toast configuration
const toastConfig = {
  success: (props) => (
    <View style={styles.toastContainer}>
      <View style={styles.toastContent}>
        <View style={styles.toastIconContainer}>
          <CheckCircle size={24} color="#fff" />
        </View>
        <View style={styles.toastTextContainer}>
          <Text style={styles.toastTitle}>{props.text1}</Text>
          <Text style={styles.toastMessage} numberOfLines={2}>
            {props.text2}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.toastCloseButton}
          onPress={() => Toast.hide()}
        >
          <X size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  ),
  error: (props) => (
    <View style={[styles.toastContainer, styles.toastErrorContainer]}>
      <View style={styles.toastContent}>
        <View style={[styles.toastIconContainer, styles.toastErrorIconContainer]}>
          <X size={24} color="#fff" />
        </View>
        <View style={styles.toastTextContainer}>
          <Text style={styles.toastTitle}>{props.text1}</Text>
          <Text style={styles.toastMessage} numberOfLines={2}>
            {props.text2}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.toastCloseButton}
          onPress={() => Toast.hide()}
        >
          <X size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  ),
};

// Main Home component
const Home = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [location, setLocation] = useState('Detecting location…');
  const [status, setStatus] = useState('init');
  const [showTrending, setShowTrending] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const cartItems = useSelector((state) => state?.app?.data || []);
  const cartCount = cartItems.length;

  // Check if product is already in cart
  const isProductInCart = useCallback((productId) => {
    return cartItems.some(item => item._id === productId);
  }, [cartItems]);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location for delivery services.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setStatus(`coords: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        fetchAddressFromCoords(latitude, longitude);
      },
      err => {
        setStatus(`loc error code=${err?.code} msg=${err?.message}`);
        setLocation(err?.code === 2 ? 'Turn on device location' : 'Unable to get location');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  };

  const fetchAddressFromCoords = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        { headers: { 'User-Agent': 'your.app.id/1.0 (RN)' } }
      );
      const data = await res.json();
      setLocation(data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } catch (e) {
      setStatus(`reverse error: ${String(e)}`);
      setLocation(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }
  };

  const handleLocationPress = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        getCurrentLocation();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Location permission is required for delivery services.',
          position: 'bottom',
          bottomOffset: 80,
          visibilityTime: 4000,
        });
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await axiosInstance.get('/user/allproducts?limit=10&page=1');
      const products = (response?.data || []).map(normalizeProduct);
      setFeaturedProducts(products);
    } catch (error) {
      console.error('Error fetching featured products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchFeaturedProducts(),
      new Promise(resolve => setTimeout(resolve, 1000)),
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        await requestAndroidLocation();
      } else {
        const auth = await Geolocation.requestAuthorization('whenInUse');
        setStatus(`iOS auth: ${auth}`);
        if (auth === 'granted') getCurrentLocation();
        else setLocation('Permission denied');
      }
    })();

    fetchFeaturedProducts();
  }, []);

  const requestAndroidLocation = async () => {
    try {
      const fineHas = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const coarseHas = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);

      if (!fineHas && !coarseHas) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        const fine = result['android.permission.ACCESS_FINE_LOCATION'];
        const coarse = result['android.permission.ACCESS_COARSE_LOCATION'];
        setStatus(`fine=${fine}, coarse=${coarse}`);

        const NEVER = PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
        const GRANTED = PermissionsAndroid.RESULTS.GRANTED;

        if (fine === NEVER || coarse === NEVER) {
          setLocation('Permission permanently denied');
          return;
        }
        if (fine !== GRANTED && coarse !== GRANTED) {
          setLocation('Permission denied');
          return;
        }
      } else {
        setStatus(`already granted fine=${fineHas}, coarse=${coarseHas}`);
      }

      getCurrentLocation();
    } catch (e) {
      setStatus(`perm error: ${String(e)}`);
      setLocation('Permission error');
    }
  };

  // Add to Cart Function with Toast
  const handleAddToCart = useCallback((product, quantity = null, variant = null, showToast = true) => {
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
        bottomOffset: 80,
        visibilityTime: 3000,
        autoHide: true,
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
    
    if (showToast) {
      Toast.show({
        type: 'success',
        text1: 'Added to Cart!',
        text2: `${product.name} has been added to your cart`,
        position: 'bottom',
        bottomOffset: 80,
        visibilityTime: 3000,
        autoHide: true,
      });
    }
  }, [dispatch]);

  // Navigate to cart function
  const navigateToCart = useCallback(() => {
    try {
      if (navigation.canGoBack()) {
        navigation.navigate('Cart');
      } else {
        navigation.navigate('Dashboard', { screen: 'Cart' });
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Cannot navigate to cart right now',
        position: 'bottom',
        bottomOffset: 80,
        visibilityTime: 3000,
      });
    }
  }, [navigation]);

  const handleSearchResultPress = (product) => {
    setSelectedProduct(product);
    setShowProductDetails(true);
    setShowTrending(false);
  };

  const handleCategoryPress = (category) => {
    navigation.navigate('ProductsPage', { 
      selectedCategory: category.name,
      subcategoryName: category.name 
    });
  };

  const handleProductsPress = () => {
    navigation.navigate('ProductsPage');
  };

  const handleCartPress = () => {
    navigateToCart();
  };

  const renderFeaturedProducts = () => {
    if (featuredProducts.length === 0 && !loadingProducts) return null;

    return (
      <View style={styles.featuredProductsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={handleProductsPress}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <ChevronRight size={rs(14)} color="#FF6B00" />
          </TouchableOpacity>
        </View>
        
        {loadingProducts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FF6B00" />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : (
          <FlatList
            data={featuredProducts}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item._id || Math.random().toString()}
            renderItem={({ item }) => (
              <ProductCard 
                product={item} 
                onPress={() => handleSearchResultPress(item)}
                onAddToCart={handleAddToCart}
                isInCart={isProductInCart(item._id)}
                navigateToCart={navigateToCart}
                style={styles.featuredProductCard}
              />
            )}
            contentContainerStyle={{ paddingHorizontal: 15, gap: rs(12) }}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      
      <ProductDetailsModal
        product={selectedProduct}
        visible={showProductDetails}
        onClose={() => setShowProductDetails(false)}
        onAddToCart={handleAddToCart}
        cartCount={cartCount}
        navigation={navigation}
        isProductInCart={isProductInCart}
        navigateToCart={navigateToCart}
      />
      
      <Header 
        location={location} 
        onLocationPress={handleLocationPress}
        cartCount={cartCount}
        onCartPress={handleCartPress}
      />
      
      <SearchBar 
        onSearchResultPress={handleSearchResultPress}
        showTrending={showTrending}
        setShowTrending={setShowTrending}
      />
      
      {showTrending && (selectedProduct || featuredProducts.length > 0) ? null : (
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: rs(70) }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FF6B00']}
              tintColor="#FF6B00"
            />
          }
        >
          <MainBanner />
          <QuickActions 
            onProductsPress={handleProductsPress}
          />
          <Categories onCategoryPress={handleCategoryPress} />
          {renderFeaturedProducts()}
          <OffersSection />
          <VeterinaryCategories onCategoryPress={handleCategoryPress} />
          <HealthArticles />
        </ScrollView>
      )}
      
      <Toast config={toastConfig} />
    </SafeAreaView>
  );
};

// Enhanced styles with responsive sizing
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
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
  logoLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: rs(50),
    height: rs(50),
  },
  verticalDivider: {
    width: 1,
    height: rs(30),
    backgroundColor: '#e0e0e0',
    marginHorizontal: rs(12),
  },
  locationCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: rs(6),
  },
  locationInfoCompact: {
    flex: 1,
  },
  deliverToCompact: {
    fontSize: rs(10),
    color: '#777',
    marginBottom: 2,
    fontWeight: '500',
  },
  locationRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  locationTextCompact: {
    fontSize: rs(13),
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
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
  badgeText: {
    color: '#fff',
    fontSize: rs(10),
    fontWeight: 'bold',
  },
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
  scrollView: {
    flex: 1,
  },
  mainBannerContainer: {
    padding: rs(15),
    backgroundColor: '#f5f5f5',
  },
  mainBanner: {
    height: rs(160),
    borderRadius: rs(16),
    overflow: 'hidden',
  },
  bannerGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: rs(16),
  },
  bannerContent: {
    maxWidth: '70%',
  },
  bannerTitle: {
    fontSize: rs(22),
    fontWeight: '700',
    color: '#fff',
    marginBottom: rs(4),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bannerSubtitle: {
    fontSize: rs(14),
    fontWeight: '400',
    color: '#fff',
    marginBottom: rs(12),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: rs(12),
    gap: rs(6),
  },
  paginationDot: {
    height: rs(8),
    borderRadius: rs(4),
  },
  sectionContainer: {
    padding: rs(15),
    backgroundColor: '#fff',
    marginBottom: rs(10),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(15),
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: rs(18),
    color: '#333',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  viewAllText: {
    fontWeight: '500',
    fontSize: rs(14),
    color: '#FF6B00',
  },
  quickActionsContainer: {
    padding: rs(10),
    backgroundColor: '#fff',
    marginBottom: rs(10),
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: rs(12),
    borderRadius: rs(12),
    gap: rs(8),
    borderWidth: 1,
    borderColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quickActionIconContainer: {
    width: rs(50),
    height: rs(50),
    borderRadius: rs(25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontWeight: '500',
    fontSize: rs(13),
    color: '#333',
    textAlign: 'center',
  },
  categoriesContainer: {
    padding: rs(15),
    backgroundColor: '#fff',
    marginBottom: rs(10),
  },
  categoryItem: {
    width: rs(120),
    height: rs(80),
    borderRadius: rs(12),
    overflow: 'hidden',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    fontWeight: '600',
    fontSize: rs(12),
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  offersContainer: {
    padding: rs(15),
    backgroundColor: '#fff',
    marginBottom: rs(10),
  },
  offerImageOnly: {
    width: rs(250),
    height: rs(120),
    resizeMode: 'cover',
    borderRadius: rs(10),
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: rs(12),
    padding: rs(12),
    position: 'relative',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    width: rs(160),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  featuredProductCard: {
    width: rs(180),
  },
  favoriteButton: {
    position: 'absolute',
    top: rs(10),
    right: rs(10),
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: rs(15),
    padding: rs(5),
  },
  productImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(10),
  },
  productImage: {
    width: '100%',
    height: rs(100),
    marginBottom: rs(10),
  },
  placeholderContainer: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: rs(8),
  },
  badgeContainer: {
    position: 'absolute',
    top: rs(10),
    left: rs(10),
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(4),
    zIndex: 1,
    backgroundColor: '#FF6B00',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: rs(5),
  },
  ratingText: {
    fontWeight: '500',
    fontSize: rs(12),
    color: '#333',
    marginLeft: rs(4),
  },
  reviewsText: {
    fontWeight: '400',
    fontSize: rs(11),
    color: '#777',
    marginLeft: rs(2),
  },
  productTitle: {
    fontWeight: '600',
    fontSize: rs(14),
    color: '#333',
    marginBottom: rs(4),
    height: rs(36),
  },
  productCategory: {
    fontSize: rs(12),
    color: '#666',
    marginBottom: rs(8),
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    marginBottom: rs(10),
  },
  currentPrice: {
    fontWeight: '700',
    fontSize: rs(16),
    color: '#333',
  },
  originalPrice: {
    fontWeight: '400',
    fontSize: rs(14),
    color: '#777',
    textDecorationLine: 'line-through',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderRadius: rs(8),
    paddingVertical: rs(8),
    gap: rs(8),
  },
  addToCartButtonDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  goToCartButton: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  addToCartText: {
    fontWeight: '500',
    fontSize: rs(14),
    color: '#FF6B00',
  },
  goToCartText: {
    color: '#fff',
  },
  articleCard: {
    width: width * 0.65,
    backgroundColor: '#fff',
    borderRadius: rs(12),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  articleImage: {
    width: '100%',
    height: rs(120),
  },
  articleImageGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: rs(10),
  },
  articleContent: {
    padding: rs(15),
  },
  articleCategoryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(4),
    alignSelf: 'flex-start',
  },
  articleCategory: {
    fontWeight: '600',
    fontSize: rs(10),
    color: '#FF6B00',
  },
  articleTitle: {
    fontWeight: '600',
    fontSize: rs(16),
    color: '#333',
    marginBottom: rs(8),
    height: rs(44),
  },
  articleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(15)
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
  },
  authorImage: {
    width: rs(20),
    height: rs(20),
    borderRadius: rs(10),
  },
  articleAuthor: {
    fontWeight: '500',
    fontSize: rs(12),
    color: '#555',
  },
  articleReadTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  articleReadTime: {
    fontWeight: '400',
    fontSize: rs(12),
    color: '#777',
  },
  featuredProductsContainer: {
    padding: rs(15),
    backgroundColor: '#fff',
    marginBottom: rs(10),
  },
  loadingContainer: {
    padding: rs(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: rs(12),
    fontSize: rs(14),
    color: '#666',
  },

  // Product Details Modal Styles (similar to ProductsPage)
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

  // Toast Styles
  toastContainer: {
    width: '90%',
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#333',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  toastErrorContainer: {
    backgroundColor: '#DC3545',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 14,
  },
  toastIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toastErrorIconContainer: {
    backgroundColor: '#B02A37',
  },
  toastTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  toastCloseButton: {
    padding: 4,
  },
});

export default Home;