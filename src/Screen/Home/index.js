import React, { useState, useRef, useEffect } from 'react';
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
  Bone
} from 'lucide-react-native';
import axiosInstance from '../../Components/AxiosInstance';
import Geolocation from 'react-native-geolocation-service';
import API_URL from '../../../config';
import { useNavigation } from '@react-navigation/native';
import { PermissionsAndroid, Linking, Alert } from 'react-native';

const { width, height } = Dimensions.get('window');

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

const LinearGradient = ({ colors, style, children }) => {
  return (
    <View style={[style, { backgroundColor: colors[0] }]}>
      {children}
    </View>
  );
};

const rs = (size, factor = 0.5) => {
  return size + ((width / 400) - 1) * size * factor;
};

// Updated Header with integrated location
const Header = ({ location, onLocationPress }) => {
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
        {/* <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton}>
            <Bell size={rs(20)} color="#333" />
            <View style={styles.notificationBadge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconButton}>
            <ShoppingCart size={rs(20)} color="#333" />
            <View style={styles.cartBadge}>
              <Text style={styles.badgeText}>5</Text>
            </View>
          </TouchableOpacity>
        </View> */}
      </View>
    </View>
  );
};

// Search bar component with trending searches
const SearchBar = () => {
  const navigation = useNavigation();
  const [showTrending, setShowTrending] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const fetchSearchResults = async (query) => {
    try {
      const response = await axiosInstance.get(`/user/search?query=${query}`);
      setSearchResults(response.data.results || []);
    } catch (error) {
      console.error('Error fetching search results:', error);
    }
  };

  const handleProductPress = (product) => {
    navigation.navigate('ProductsPage', { selectedProduct: product });
    setShowTrending(false);
    setSearchText('');
  };

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (searchText.length > 2) {
      const timeout = setTimeout(() => {
        fetchSearchResults(searchText);
      }, 500);
      setSearchTimeout(timeout);
    }
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchText]);

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
          onChangeText={(text) => setSearchText(text)}
          onFocus={() => setShowTrending(true)}
          onBlur={() => setTimeout(() => setShowTrending(false), 200)}
        />
        {searchText ? (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <X size={rs(18)} color="#777" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.micButton}>
            <Filter size={rs(18)} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {showTrending && searchResults.length > 0 && (
        <View style={styles.trendingContainer}>
          <Text style={styles.trendingTitle}>Search Results</Text>
          <View style={styles.trendingTagsContainer}>
            {searchResults.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.trendingTag}
                onPress={() => handleProductPress(item)}
              >
                <Text style={styles.trendingTagText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
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

      console.log('Fetched banners:', bannerData);

      const mainBanners = bannerData?.filter(
        (banner) =>
          banner?.type === 'HomePageSlider' &&
          Array.isArray(banner.slider_image) &&
          banner.slider_image.length > 0
      );

      console.log('Filtered banners:', mainBanners);
      if (mainBanners.length > 0) {
        setBanners([
          mainBanners[mainBanners.length - 1], // clone last
          ...mainBanners,
          mainBanners[0], // clone first
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

// Quick actions grid
const QuickActions = () => {
  const navigation = useNavigation();

  const actions = [
    { icon: 'Pill', title: 'Order Medicine', color: '#E3F2FD', route: 'ProductsPage' },
    { icon: 'FileText', title: 'No Prescription', color: '#FFF3E0', route: 'ProductsPage' },
    { icon: 'Clock', title: 'Previously Bought', color: '#E8F5E9', route: 'Orders' },
    { icon: 'Award', title: 'Deals For You', color: '#F3E5F5' },
  ];

  const itemsPerRow = width < 600 ? 2 : width < 900 ? 3 : 4;

  const handlePress = (action) => {
    if (action.route) {
      navigation.navigate(action.route);
    } else {
      console.warn('No route defined for this action:', action.title);
    }
  };

  return (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={[styles.quickActionsGrid, { gap: rs(12) }]}>
        {actions.map((action, index) => (
          <TouchableOpacity 
            key={index} 
            onPress={() => handlePress(action)}
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
const Categories = () => {
  const [categoriesData, setCategoriesData] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axiosInstance.get('/user/allcategories');
      const allCategories = response?.data || [];
      const humanCategories = allCategories.filter(cat => cat.variety === 'Human' || !cat.variety);
      setCategoriesData(humanCategories);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  return (
    <View style={styles.categoriesContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shop by Human Category</Text>
      </View>
      <FlatList
        data={categoriesData}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.categoryItem} onPress={() => navigation.navigate('Category', { selectedCategory: item })}>
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

const VeterinaryCategories = () => {
  const [categoriesData, setCategoriesData] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axiosInstance.get('/user/allcategories');
      const allCategories = response?.data || [];
      const vetCategories = allCategories.filter(cat => cat.variety === 'Veterinary');
      setCategoriesData(vetCategories);
    } catch (error) {
      console.error("Error fetching veterinary categories:", error);
    }
  };

  return (
    <View style={styles.categoriesContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shop by Veterinary Category</Text>
      </View>
      <FlatList
        data={categoriesData}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.categoryItem} onPress={() => navigation.navigate('Category', { selectedCategory: item })}>
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

// Enhanced product card component - FIXED VERSION
const ProductCard = ({ product, style }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(0);
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
  
  return (
    <Animated.View 
      style={[
        styles.productCard, 
        style,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <TouchableOpacity 
        style={styles.favoriteButton}
        onPress={() => setIsFavorite(!isFavorite)}
      >
        <Heart 
          size={rs(20)} 
          color={isFavorite ? "#E91E63" : "#777"} 
          fill={isFavorite ? "#E91E63" : "none"} 
        />
      </TouchableOpacity>
      
      {(product.badge || product.discount) && (
        <View style={[
          styles.badgeContainer, 
          { 
            backgroundColor: 
              product.badge === 'New' ? '#4CAF50' :
              product.badge === 'Trending' ? '#FF9800' :
              product.badge === 'Bestseller' ? '#9C27B0' :
              product.badge === 'Premium' ? '#2196F3' :
              product.badge === 'Organic' ? '#8BC34A' :
              product.badge === 'Essential' ? '#607D8B' :
              product.badge === 'Top Rated' ? '#FFC107' :
              product.badge === 'Popular' ? '#E91E63' : '#E91E63'
          }
        ]}>
          <Text style={styles.badgeText}>
            {product.badge || product.discount}
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
            source={{ uri: product.image }}
            style={styles.productImage}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        )}
      </Pressable>
      
      <View style={styles.ratingContainer}>
        <Star size={rs(12)} color="#FFC107" fill="#FFC107" />
        <Text style={styles.ratingText}>{product.rating}</Text>
        <Text style={styles.reviewsText}>({product.reviews})</Text>
      </View>
      
      <Text style={styles.productTitle} numberOfLines={2}>{product.name}</Text>
      <Text style={styles.productQuantity}>{product.quantity}</Text>
      <Text style={styles.productDescription} numberOfLines={1}>{product.description}</Text>
      
      <View style={styles.priceContainer}>
        <Text style={styles.currentPrice}>₹{product.currentPrice.toFixed(2)}</Text>
        <Text style={styles.originalPrice}>₹{product.originalPrice.toFixed(2)}</Text>
      </View>
      
      {quantity === 0 ? (
        <TouchableOpacity 
          style={styles.addToCartButton}
          onPress={() => setQuantity(1)}
        >
          <ShoppingCart size={rs(16)} color="#FF6B00" />
          <Text style={styles.addToCartText}>Add to Cart</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.quantitySelector}>
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => setQuantity(Math.max(0, quantity - 1))}
          >
            <Minus size={rs(16)} color="#FF6B00" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => setQuantity(quantity + 1)}
          >
            <Plus size={rs(16)} color="#FF6B00" />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
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
              
              {/* <TouchableOpacity style={styles.readMoreButton}>
                <Text style={styles.readMoreText}>Read More</Text>
                <ArrowRight size={rs(14)} color="#FF6B00" />
              </TouchableOpacity> */}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: 15, gap: rs(12) }}
      />
    </View>
  );
};

// Main Home component
const Home = () => {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState('Detecting location…');
  const [status, setStatus] = useState('init');
  const [isLoading, setIsLoading] = useState({
    banners: true,
    categories: true,
    products: true,
  });

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
        Alert.alert(
          'Permission Required',
          'Location permission is required for delivery services.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      console.error('Location error:', error);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      <Header location={location} onLocationPress={handleLocationPress} />
      <SearchBar />
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: rs(70) }}
      >
        <MainBanner />
        <QuickActions />
        <Categories />
        <OffersSection />
        <VeterinaryCategories />
        <HealthArticles />
      </ScrollView>
    </SafeAreaView>
  );
};

// Enhanced styles with responsive sizing
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 20,
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
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF6B00',
    width: rs(16),
    height: rs(16),
    borderRadius: rs(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF6B00',
    width: rs(16),
    height: rs(16),
    borderRadius: rs(8),
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
  trendingContainer: {
    backgroundColor: '#fff',
    marginTop: rs(10),
    borderRadius: rs(10),
    padding: rs(15),
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
    paddingHorizontal: rs(10),
    paddingVertical: rs(6),
    borderRadius: rs(20),
    gap: rs(5),
  },
  trendingTagText: {
    fontWeight: '400',
    fontSize: rs(12),
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
    height: rs(100),
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
    height: rs(120),
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
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: rs(10),
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
  productQuantity: {
    fontWeight: '400',
    fontSize: rs(12),
    color: '#777',
    marginBottom: rs(4),
  },
  productDescription: {
    fontWeight: '400',
    fontSize: rs(12),
    color: '#555',
    marginBottom: rs(8),
    fontStyle: 'italic',
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
  addToCartText: {
    fontWeight: '500',
    fontSize: rs(14),
    color: '#FF6B00',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderRadius: rs(8),
    paddingVertical: rs(5),
    paddingHorizontal: rs(5),
  },
  quantityButton: {
    padding: rs(5),
  },
  quantityText: {
    fontWeight: '600',
    fontSize: rs(14),
    color: '#333',
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
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: rs(5),
    gap: rs(4),
  },
  readMoreText: {
    fontWeight: '500',
    fontSize: rs(14),
    color: '#FF6B00',
  },
});

export default Home;