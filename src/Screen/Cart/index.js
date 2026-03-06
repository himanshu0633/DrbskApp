import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RazorpayCheckout from 'react-native-razorpay';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteProduct, updateData, clearProducts } from '../../store/Action';
import axiosInstance from '../../Components/AxiosInstance';
import API_URL from '../../../config';

const { width, height } = Dimensions.get('window');
const rs = (size, factor = 0.5) => {
  return size + ((width / 400) - 1) * size * factor;
};

// Lucide Icons Import (using MaterialIcons as fallback for React Native)
import {
  ArrowLeft,
  Star,
  Shield,
  Package,
  Truck,
  RotateCcw,
  Clock,
  ShoppingBag,
  AlertCircle,
  X,
  CreditCard,
  Wallet,
  CheckCircle,
} from 'lucide-react-native';

// ============= UTILITY FUNCTIONS (MUST BE DEFINED BEFORE COMPONENT) =============

function toNum(x, fallback = 0) {
  if (x === null || x === undefined || x === '') return fallback;
  const n = parseFloat(String(x).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Parse the API's `quantity` field into a clean array of variant objects */
function parseVariants(raw) {
  try {
    console.log("parseVariants raw input:", raw);
    
    if (!raw) return [];
    
    let parsed = [];
    
    // Case 1: Already an array
    if (Array.isArray(raw)) {
      if (raw.length === 0) return [];
      
      // Case 1a: Array of strings (JSON strings)
      if (typeof raw[0] === 'string') {
        try {
          parsed = JSON.parse(raw[0]);
        } catch (e) {
          console.warn('Failed to parse array string:', e);
        }
      }
      // Case 1b: Array of objects
      else if (typeof raw[0] === 'object') {
        parsed = raw;
      }
    }
    // Case 2: String (JSON string)
    else if (typeof raw === 'string') {
      try {
        // Remove any extra quotes or formatting
        const cleanStr = raw.replace(/\\"/g, '"').replace(/^"(.*)"$/, '$1');
        parsed = JSON.parse(cleanStr);
      } catch (e) {
        console.warn('Failed to parse string:', e, 'Raw:', raw);
        // Try to extract array from malformed JSON
        const match = raw.match(/\[.*\]/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (e2) {
            console.warn('Failed to extract array:', e2);
          }
        }
      }
    }
    // Case 3: Object (single variant)
    else if (typeof raw === 'object') {
      parsed = [raw];
    }

    // Ensure parsed is an array
    if (!Array.isArray(parsed)) {
      parsed = [];
    }

    // Normalize variant objects
    const normalizedVariants = parsed.map(v => {
      // Handle both object and string values
      const variant = v || {};
      
      return {
        label: String(variant.label || variant.name || variant.quantity || 'Standard').trim(),
        mrp: toNum(variant.mrp || variant.MRP || 0),
        discount: toNum(variant.discount || variant.discount_percent || 0),
        gst: toNum(variant.gst || variant.GST || 0),
        retail_price: toNum(variant.retail_price || variant.retailPrice || 0),
        final_price: toNum(variant.final_price || variant.finalPrice || variant.price || 0),
        in_stock: String(variant.in_stock || variant.available || 'yes').toLowerCase() === 'yes',
      };
    });

    console.log("parseVariants result:", normalizedVariants);
    return normalizedVariants;
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
    consumer_price: toNum(firstVariant.final_price),
    discount: toNum(firstVariant.discount),
    gst: toNum(firstVariant.gst),
    mrp: toNum(firstVariant.mrp)
  };
}

/** Calculate discount percentage from variant data */
function calculateDiscountPercent(variant) {
  if (!variant) return 0;
  
  const mrp = toNum(variant.mrp);
  const finalPrice = toNum(variant.final_price);
  
  // If discount is explicitly provided
  if (variant.discount > 0) {
    return Math.round(toNum(variant.discount));
  }
  
  // Calculate discount from MRP and final price
  if (mrp > 0 && finalPrice > 0 && mrp > finalPrice) {
    const discount = ((mrp - finalPrice) / mrp) * 100;
    return Math.round(discount);
  }
  
  return 0;
}

/** Build a normalized product with price/originalPrice/discountPercent & variants */
function normalizeProduct(p) {
  console.log("=== NORMALIZE PRODUCT ===");
  console.log("Input product:", p?.name);
  console.log("Raw quantity field:", p?.quantity);
  
  if (!p) {
    console.warn("Product is null or undefined");
    return null;
  }

  // Try to parse variants from quantity field
  const variants = parseVariants(p.quantity);
  console.log("Parsed variants:", variants);

  // If no variants from quantity, check if product has direct variants
  let finalVariants = variants;
  if (variants.length === 0 && p.variants && Array.isArray(p.variants)) {
    console.log("Using direct variants from product object");
    finalVariants = parseVariants(p.variants);
  }

  // Get product level prices
  const productPrices = getProductPrices(finalVariants);
  console.log("Product prices from variants:", productPrices);

  // Calculate display prices
  let price = 0;
  let originalPrice = 0;
  let discountPercent = 0;
  
  if (finalVariants.length > 0) {
    // Use first variant for display
    const firstVariant = finalVariants[0];
    price = toNum(firstVariant.final_price || firstVariant.retail_price || 0);
    originalPrice = toNum(firstVariant.mrp || 0);
    discountPercent = calculateDiscountPercent(firstVariant);
    console.log("Using variant prices:", { price, originalPrice, discountPercent });
  } else {
    // Fallback to direct product prices
    price = toNum(p.price || p.final_price || p.retail_price || 0);
    originalPrice = toNum(p.mrp || 0);
    discountPercent = toNum(p.discount || 0);
    console.log("Using direct product prices:", { price, originalPrice, discountPercent });
  }

  // Build normalized product
  const normalized = {
    ...p,
    price,
    originalPrice,
    discountPercent,
    variants: finalVariants,
    retail_price: productPrices.retail_price || toNum(p.retail_price),
    consumer_price: productPrices.consumer_price || toNum(p.consumer_price),
    discount_value: productPrices.discount || toNum(p.discount),
    gst: productPrices.gst || toNum(p.gst),
    mrp: productPrices.mrp || toNum(p.mrp)
  };

  console.log("Normalized product result:", normalized);
  return normalized;
}

/** Get the display price for a product based on a selected variant label */
function getDisplayPrice(product, selectedLabel) {
  if (!product?.variants?.length) {
    return toNum(product?.consumer_price || product?.price || product?.retail_price || 0);
  }
  
  if (selectedLabel) {
    const v = product.variants.find(x => x.label === selectedLabel);
    if (v) {
      return toNum(v.final_price || v.retail_price || 0);
    }
  }
  
  // Return price from first variant
  const firstVariant = product.variants[0];
  return toNum(firstVariant.final_price || firstVariant.retail_price || 0);
}

/** Get variant details for selected variant */
function getVariantDetails(product, selectedLabel) {
  if (!product?.variants?.length || !selectedLabel) return null;
  return product.variants.find(x => x.label === selectedLabel);
}

/** Get the original price (MRP) for display */
function getOriginalPrice(product, selectedLabel) {
  if (!product?.variants?.length) {
    return toNum(product?.mrp || product?.originalPrice || 0);
  }
  
  if (selectedLabel) {
    const v = product.variants.find(x => x.label === selectedLabel);
    if (v) return toNum(v.mrp || 0);
  }
  
  const firstVariant = product.variants[0];
  return toNum(firstVariant.mrp || 0);
}

// ============= COMPONENT STARTS HERE =============

const Cart = () => {
  const insets = useSafeAreaInsets();
  const cartItems = useSelector((state) => state.app.data || []);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  
  // State declarations
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  
  // NEW: COD Settings State
  const [codEnabled, setCodEnabled] = useState(true);
  
  // Payment method states
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [codCharge] = useState(99);
  const [codProcessing, setCodProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Product Details Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [mainImage, setMainImage] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(null);
  
  // Dropdown visibility states
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  
  // User info state
  const [formData, setFormData] = useState({
    flat: '',
    landmark: '',
    state: '',
    city: '',
    country: 'India',
    phone: '',
    email: '',
    selectedAddress: ''
  });
  
  // Loader states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  // User data state
  const [userData, setUserData] = useState(null);
  
  // User type detection
  const [isWholesaler, setIsWholesaler] = useState(false);
  
  // Clear Cart Modal State
  const [showClearCartModal, setShowClearCartModal] = useState(false);
  
  // Remove Item Modal State
  const [showRemoveItemModal, setShowRemoveItemModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [itemNameToRemove, setItemNameToRemove] = useState('');
  
  // Ref to track if component is mounted
  const isMounted = useRef(true);

  // ============= NEW: FETCH COD SETTINGS =============
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      try {
        const res = await axiosInstance.get('/api/cash-on-delivery');
        if (res.data && res.data.data) {
          setCodEnabled(res.data.data.codEnabled);
        }
      } catch (err) {
        console.error("Failed to fetch payment settings", err);
        // Default to true if API fails
        setCodEnabled(true);
      }
    };

    fetchPaymentSettings();
  }, []);

  // ============= FUNCTION DEFINITIONS (NOW SAFE TO USE IN HOOKS) =============

  // Calculate item price with wholesale logic
  const getItemPrice = useCallback((item) => {
    try {
      let price = 0;
      
      // Check if user is wholesaler and item has retail_price
      if (isWholesaler && item.retail_price) {
        price = parseFloat(item.retail_price);
      }
      // Check for selectedVariant price first
      else if (item.selectedVariant && item.selectedVariant.final_price) {
        price = parseFloat(item.selectedVariant.final_price);
      }
      // Check for final_price
      else if (item.final_price) {
        price = parseFloat(item.final_price);
      } 
      // Then check for price
      else if (item.price) {
        price = parseFloat(item.price);
      }
      // Then check for mrp
      else if (item.mrp) {
        price = parseFloat(item.mrp);
      }
      
      // If price is invalid, set to 0
      if (!price || price <= 0 || isNaN(price)) {
        price = 0;
      }
      
      return price;
    } catch (error) {
      console.error('Error getting item price:', error);
      return 0;
    }
  }, [isWholesaler]);

  // Email validation function
  const isValidEmail = useCallback((email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // Calculate totals with user type based pricing
  const baseTotal = cartItems.reduce((acc, item) => {
    const price = getItemPrice(item);
    return acc + price * (item.quantity || 1);
  }, 0);

  const codTotal = paymentMethod === 'cod' ? baseTotal + codCharge : baseTotal;
  const finalTotal = paymentMethod === 'cod' ? codTotal : baseTotal;

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Get product image URL
  const getProductImageUrl = useCallback((item) => {
    try {
      console.log('Getting image for:', item?.name);
      
      // Priority 1: Check if item has media array with URL
      if (item?.media && Array.isArray(item.media) && item.media.length > 0) {
        const firstMedia = item.media[0];
        if (firstMedia && firstMedia.url) {
          // Check if URL is already absolute
          if (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) {
            console.log('Using absolute media URL:', firstMedia.url);
            return firstMedia.url;
          }
          
          // If relative URL, prepend API_URL
          const fullUrl = `${API_URL}${firstMedia.url}`;
          console.log('Using relative media URL:', fullUrl);
          return fullUrl;
        }
      }
      
      // Priority 2: Check if product has direct image property
      if (item?.image) {
        if (item.image.startsWith('http://') || item.image.startsWith('https://')) {
          console.log('Using absolute image URL:', item.image);
          return item.image;
        } else {
          const fullUrl = `${API_URL}${item.image}`;
          console.log('Using relative image URL:', fullUrl);
          return fullUrl;
        }
      }
      
      // Priority 3: Check for product_image
      if (item?.product_image) {
        if (item.product_image.startsWith('http://') || item.product_image.startsWith('https://')) {
          console.log('Using absolute product_image URL:', item.product_image);
          return item.product_image;
        } else {
          const fullUrl = `${API_URL}${item.product_image}`;
          console.log('Using relative product_image URL:', fullUrl);
          return fullUrl;
        }
      }
      
      // Priority 4: Check for selectedVariant image
      if (item?.selectedVariant && item.selectedVariant.image) {
        if (item.selectedVariant.image.startsWith('http://') || item.selectedVariant.image.startsWith('https://')) {
          console.log('Using variant absolute image URL:', item.selectedVariant.image);
          return item.selectedVariant.image;
        } else {
          const fullUrl = `${API_URL}${item.selectedVariant.image}`;
          console.log('Using variant relative image URL:', fullUrl);
          return fullUrl;
        }
      }
      
      // Fallback to placeholder
      console.log('No image found, using placeholder');
      return 'https://via.placeholder.com/300x300?text=No+Image';
    } catch (error) {
      console.error('Error getting product image:', error);
      return 'https://via.placeholder.com/300x300?text=Error';
    }
  }, []);

  // Initialize data
  const initializeData = useCallback(async () => {
    try {
      console.log('Initializing cart data...');
      
      // Check authentication
      const userDataStr = await AsyncStorage.getItem('userData');
      if (userDataStr) {
        const parsedUserData = JSON.parse(userDataStr);
        setIsAuthenticated(true);
        setUserData(parsedUserData);
        
        // Check if user is wholesaler
        setIsWholesaler(parsedUserData?.type === "wholesalePartner");
        
        // Set form data from user data
        setFormData(prev => ({
          ...prev,
          email: parsedUserData?.email || '',
          phone: parsedUserData?.phone || '',
        }));
        
        console.log('User authenticated:', parsedUserData.email);
        console.log('Is wholesaler:', parsedUserData?.type === "wholesalePartner");
      } else {
        setIsAuthenticated(false);
        setUserData(null);
        setIsWholesaler(false);
        console.log('User not authenticated - guest mode');
      }

      // Load saved data from AsyncStorage
      const savedEmail = await AsyncStorage.getItem('guestEmail') || '';
      const savedPhone = await AsyncStorage.getItem('guestPhone') || '';
      const savedAddressesStr = await AsyncStorage.getItem('guestAddresses');
      const savedAddresses = savedAddressesStr ? JSON.parse(savedAddressesStr) : [];
      
      // Set initial form data
      setFormData(prev => ({
        ...prev,
        email: savedEmail || prev.email,
        phone: savedPhone || prev.phone
      }));
      
      setAddresses(savedAddresses);
      
      console.log('Loaded saved addresses:', savedAddresses.length);
      
      // Auto-select first address if available
      if (savedAddresses.length > 0 && !formData.selectedAddress) {
        const firstAddress = savedAddresses[0];
        const addressValue = typeof firstAddress === 'object' ? firstAddress.fullAddress : firstAddress;
        const addressEmail = typeof firstAddress === 'object' ? firstAddress.email : savedEmail;
        const addressPhone = typeof firstAddress === 'object' ? firstAddress.phone : savedPhone;
        
        setFormData(prev => ({
          ...prev,
          selectedAddress: addressValue,
          email: addressEmail || savedEmail || prev.email,
          phone: addressPhone || savedPhone || prev.phone
        }));
      }
    } catch (error) {
      console.error('Error initializing data:', error);
    }
  }, [formData.selectedAddress]);

  // Load states from API
  const loadStates = async () => {
    try {
      console.log('Loading states...');
      setLoading(true);
      const res = await axiosInstance.post('https://countriesnow.space/api/v0.1/countries/states', {
        country: 'India'
      });
      if (res.data.data && res.data.data.states) {
        const stateNames = res.data.data.states.map(s => s.name);
        setStates(stateNames);
        console.log('States loaded:', stateNames.length);
      }
    } catch (err) {
      console.error('Error fetching states', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load states. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load cities when state changes
  const loadCities = async (stateName) => {
    if (!stateName) return;
    
    try {
      console.log('Fetching cities for state:', stateName);
      setLoading(true);
      const res = await axiosInstance.post('https://countriesnow.space/api/v0.1/countries/state/cities', {
        country: 'India',
        state: stateName
      });
      if (res.data.data) {
        setCities(res.data.data);
        console.log('Cities loaded:', res.data.data.length);
      }
    } catch (err) {
      console.error('Error fetching cities', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load cities. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      const loadData = async () => {
        if (isActive) {
          try {
            await initializeData();
            await loadStates();
          } catch (error) {
            console.error('Error loading cart data:', error);
          }
        }
      };
      
      loadData();
      
      return () => {
        isActive = false;
      };
    }, [initializeData])
  );

  // Handle state selection
  const handleStateSelect = (stateName) => {
    setFormData(prev => ({ 
      ...prev, 
      state: stateName,
      city: '' // Reset city when state changes
    }));
    setShowStateDropdown(false);
    
    // Load cities for selected state
    if (stateName) {
      loadCities(stateName);
    }
  };

  // Handle city selection
  const handleCitySelect = (cityName) => {
    setFormData(prev => ({ ...prev, city: cityName }));
    setShowCityDropdown(false);
  };

  // Handle payment method change
  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
  };

  // Handle product click - OPEN MODAL
  const handleProductClick = useCallback((item) => {
    console.log('=== PRODUCT CLICKED ===');
    console.log('Cart item:', item);
    console.log('Item keys:', Object.keys(item));
    console.log('Item quantity field:', item.quantity);
    
    // Normalize the product
    const normalizedProduct = normalizeProduct(item);
    console.log('Normalized product:', normalizedProduct);
    
    if (!normalizedProduct) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not load product details',
      });
      return;
    }
    
    setSelectedProduct(normalizedProduct);
    
    // Get image URL
    const imageUrl = getProductImageUrl(normalizedProduct);
    console.log('Main image URL:', imageUrl);
    setMainImage(imageUrl);
    
    // Set default selected quantity
    const availableVariants = normalizedProduct?.variants || [];
    const defaultVariant = availableVariants.find(v => v.in_stock) || availableVariants[0];
    const defaultLabel = defaultVariant?.label || null;
    console.log('Default selected quantity:', defaultLabel);
    setSelectedQuantity(defaultLabel);
    
    setShowProductDetails(true);
  }, [getProductImageUrl]);

  // Handle quantity change in cart
  const handleQuantityChange = useCallback((itemId, newQuantity, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (newQuantity < 1) return;
    const updatedItem = cartItems.find((item) => item._id === itemId);
    if (updatedItem) {
      const updatedProduct = { ...updatedItem, quantity: newQuantity };
      dispatch(updateData(updatedProduct));
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Item quantity updated!',
      });
    }
  }, [cartItems, dispatch]);

  // Handle remove item
  const handleRemoveItem = useCallback((itemId, itemName, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    // Set the item details to remove
    setItemToRemove(itemId);
    setItemNameToRemove(itemName);
    // Show the modal
    setShowRemoveItemModal(true);
  }, []);

  // Confirm remove item function
  const confirmRemoveItem = () => {
    if (itemToRemove) {
      dispatch(deleteProduct(itemToRemove));
      Toast.show({
        type: 'info',
        text1: 'Removed',
        text2: 'Item removed from cart.',
      });
    }
    // Close modal and reset states
    setShowRemoveItemModal(false);
    setItemToRemove(null);
    setItemNameToRemove('');
  };

  // Handle clear cart
  const handleClearCart = () => {
    setShowClearCartModal(true);
  };

  const confirmClearCart = () => {
    dispatch(clearProducts());
    setShowClearCartModal(false);
    Toast.show({
      type: 'info',
      text1: 'Cart Cleared',
      text2: 'Your cart has been cleared.',
    });
  };

  // Handle email change
  const handleEmailChange = (email) => {
    setFormData(prev => ({ ...prev, email }));
    
    // Save to AsyncStorage immediately
    if (email && isValidEmail(email)) {
      AsyncStorage.setItem('guestEmail', email);
    }
  };

  // Handle phone change
  const handlePhoneChange = (phone) => {
    const value = phone.replace(/\D/g, '');
    if (value.length <= 10) {
      setFormData(prev => ({ ...prev, phone: value }));
      
      // Save to AsyncStorage immediately
      if (value.length === 10) {
        AsyncStorage.setItem('guestPhone', value);
      }
    }
  };

  // Handle add address
  const handleAddAddress = async () => {
    setLoading(true);
    
    // Validate email
    if (formData.email && !isValidEmail(formData.email)) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid email address',
      });
      setLoading(false);
      return;
    }

    // Validate phone
    if (!formData.phone || formData.phone.length !== 10) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid 10-digit phone number',
      });
      setLoading(false);
      return;
    }

    // Validate address fields
    if (!formData.flat || !formData.landmark || !formData.city || !formData.state) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill all address fields',
      });
      setLoading(false);
      return;
    }

    // Create address object
    const addressObject = {
      flat: formData.flat,
      landmark: formData.landmark,
      city: formData.city,
      state: formData.state,
      country: formData.country,
      phone: formData.phone,
      email: formData.email,
      fullAddress: `${formData.flat}, ${formData.landmark}, ${formData.city}, ${formData.state}, ${formData.country}`
    };
    
    try {
      // Get existing addresses from AsyncStorage
      const existingAddressesStr = await AsyncStorage.getItem('guestAddresses');
      const existingAddresses = existingAddressesStr ? JSON.parse(existingAddressesStr) : [];
      const updatedAddresses = [...existingAddresses, addressObject];
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('guestAddresses', JSON.stringify(updatedAddresses));
      
      // Also save email and phone separately
      if (formData.email) {
        await AsyncStorage.setItem('guestEmail', formData.email);
      }
      if (formData.phone) {
        await AsyncStorage.setItem('guestPhone', formData.phone);
      }
      
      // Update state
      setAddresses(updatedAddresses);
      setFormData(prev => ({
        ...prev,
        selectedAddress: addressObject.fullAddress,
        flat: '',
        landmark: '',
        state: '',
        city: ''
      }));
      setShowAddressModal(false);
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Address saved successfully!',
      });
    } catch (error) {
      console.error('Error saving address:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save address',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============= NEW: HANDLE COD CHECKOUT =============
  const handleCODCheckout = async () => {
    console.log("=== STARTING COD CHECKOUT ===");
    
    setCodProcessing(true);

    try {
      if (!formData.selectedAddress) {
        Toast.show({
          type: 'warning',
          text1: 'Warning',
          text2: 'Please select an address before checkout.',
        });
        setCodProcessing(false);
        return;
      }

      if (!cartItems || cartItems.length === 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Your cart is empty',
        });
        setCodProcessing(false);
        return;
      }

      const checkoutEmail = formData.email || await AsyncStorage.getItem('guestEmail') || '';
      
      if (!checkoutEmail || !isValidEmail(checkoutEmail)) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please provide a valid email address',
        });
        setCodProcessing(false);
        return;
      }

      let phoneNumber = formData.phone?.toString().trim();

      if (!phoneNumber) {
        const selectedAddressObj = addresses.find(addr => 
          typeof addr === 'object' ? addr.fullAddress === formData.selectedAddress : addr === formData.selectedAddress
        );
        
        if (selectedAddressObj && typeof selectedAddressObj === 'object' && selectedAddressObj.phone) {
          phoneNumber = selectedAddressObj.phone;
        } else {
          phoneNumber = await AsyncStorage.getItem('guestPhone') || '';
        }
      }

      phoneNumber = phoneNumber.replace(/^\+91/, '').replace(/^91/, '').trim();

      if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please provide a valid 10-digit phone number',
        });
        setCodProcessing(false);
        return;
      }

      const orderItems = cartItems.map((item) => {
        const qty = parseInt(item.quantity) || 1;
        const price = getItemPrice(item);

        if (!item._id || !item.name || qty < 1 || price <= 0) {
          throw new Error(`Invalid item data for: ${item.name || 'Unknown item'}`);
        }

        return {
          productId: item._id,
          name: item.name.trim(),
          quantity: qty,
          price: price
        };
      });

      const userDataStr = await AsyncStorage.getItem('userData');
      let userId;
      let isGuest = true;
      
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        if (userData._id) {
          userId = userData._id;
          isGuest = false;
        }
      }
      
      if (!userId) {
        userId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const codPayload = {
        userId: userId,
        items: orderItems,
        address: formData.selectedAddress.trim(),
        phone: phoneNumber,
        email: checkoutEmail,
        totalAmount: parseFloat(finalTotal.toFixed(2)),
        baseAmount: parseFloat(baseTotal.toFixed(2)),
        codCharge: codCharge,
        isGuest: isGuest,
        isWholesaler: isWholesaler
      };

      console.log("Creating COD order:", codPayload);
      
      setIsProcessing(true);
      setProcessingMessage("Creating your COD order...");

      const response = await axiosInstance.post('/api/createCOD', codPayload);

      if (response.data.success) {
        console.log("✅ COD order created successfully:", response.data.orderId);
        
        setProcessingMessage("Finalizing your order...");
        
        dispatch(clearProducts());
        
        if (isGuest) {
          await AsyncStorage.removeItem('guestAddresses');
          await AsyncStorage.removeItem('guestEmail');
          await AsyncStorage.removeItem('guestPhone');
        }
        
        setSuccessMessage(`COD Order placed successfully! Order ID: ${response.data.orderId}`);
        setShowSuccessModal(true);
        
        setTimeout(() => {
          setIsProcessing(false);
          setCodProcessing(false);
          setShowSuccessModal(false);
          navigation.navigate('Success', {
            orderId: response.data.orderId,
            orderDetails: response.data.orderDetails,
            isCOD: true,
            codCharge: codCharge
          });
        }, 2000);
        
      } else {
        console.error("❌ COD order creation failed:", response.data.message);
        setIsProcessing(false);
        setCodProcessing(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.data.message || 'Failed to create COD order',
        });
      }

    } catch (error) {
      console.error('=== COD CHECKOUT ERROR ===');
      console.error('Error:', error.message);
      console.error('Response:', error.response?.data);

      let errorMessage = 'COD order failed. Please try again.';

      if (error.response?.status === 400) {
        const validationError = error.response.data?.message;
        if (validationError) {
          errorMessage = validationError;
        }
      } 

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
      setIsProcessing(false);
      setCodProcessing(false);
    }
  };

  // Handle online payment checkout
  const handleOnlineCheckout = async () => {
    console.log("=== STARTING ONLINE CHECKOUT PROCESS ===");
    
    setCheckoutLoading(true);

    try {
      if (!formData.selectedAddress) {
        Toast.show({
          type: 'warning',
          text1: 'Warning',
          text2: 'Please select an address before checkout.',
        });
        setCheckoutLoading(false);
        return;
      }

      if (!cartItems || cartItems.length === 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Your cart is empty',
        });
        setCheckoutLoading(false);
        return;
      }

      const checkoutEmail = formData.email || await AsyncStorage.getItem('guestEmail') || '';
      
      if (!checkoutEmail || !isValidEmail(checkoutEmail)) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please provide a valid email address',
        });
        setCheckoutLoading(false);
        return;
      }

      let phoneNumber = formData.phone?.toString().trim();

      if (!phoneNumber) {
        const selectedAddressObj = addresses.find(addr => 
          typeof addr === 'object' ? addr.fullAddress === formData.selectedAddress : addr === formData.selectedAddress
        );
        
        if (selectedAddressObj && typeof selectedAddressObj === 'object' && selectedAddressObj.phone) {
          phoneNumber = selectedAddressObj.phone;
        } else {
          phoneNumber = await AsyncStorage.getItem('guestPhone') || '';
        }
      }

      phoneNumber = phoneNumber.replace(/^\+91/, '').replace(/^91/, '').trim();

      if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please provide a valid 10-digit phone number',
        });
        setCheckoutLoading(false);
        return;
      }

      const orderItems = cartItems.map((item) => {
        const qty = parseInt(item.quantity) || 1;
        const price = getItemPrice(item);

        return {
          productId: item._id,
          name: item.name?.trim() || 'Product',
          quantity: qty,
          price: price
        };
      });

      const userDataStr = await AsyncStorage.getItem('userData');
      let userId;
      let isGuest = true;
      
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        if (userData._id) {
          userId = userData._id;
          isGuest = false;
        }
      }
      
      if (!userId) {
        userId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const totalAmount = orderItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      if (totalAmount <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Total amount cannot be zero. Please check your cart items.',
        });
        setCheckoutLoading(false);
        return;
      }

      const orderPayload = {
        userId: userId,
        items: orderItems,
        address: formData.selectedAddress.trim(),
        phone: phoneNumber,
        email: checkoutEmail,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        isGuest: isGuest,
        isWholesaler: isWholesaler
      };

      console.log("Creating Razorpay order...");
      
      const orderResponse = await axiosInstance.post('/api/createPaymentOrder', orderPayload);

      if (!orderResponse.data.success) {
        const errorMsg = orderResponse.data?.message || 'Failed to create payment order';
        console.error("❌ Razorpay order creation failed:", errorMsg);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMsg,
        });
        setCheckoutLoading(false);
        return;
      }

      const { order: razorpayOrder } = orderResponse.data;
      console.log("✅ Razorpay order created:", razorpayOrder.id);

      setIsProcessing(true);
      setProcessingMessage("Creating payment order...");
      setPaymentProcessing(true);

      const options = {
        description: 'Order Payment - Dr BSK',
        currency: razorpayOrder.currency || 'INR',
        key: "rzp_live_RsAhVxy2ldrBIl",
        amount: razorpayOrder.amount.toString(),
        name: "Dr BSK",
        order_id: razorpayOrder.id,
        prefill: {
          name: userData?.name || checkoutEmail.split('@')[0],
          email: checkoutEmail,
          contact: `+91${phoneNumber}`,
        },
        theme: { color: '#FF6B00' },
        notes: {
          order_type: 'pharma_order',
          items_count: cartItems.length.toString(),
          userId: userId
        }
      };

      console.log("Opening Razorpay checkout...");
      
      RazorpayCheckout.open(options).then(async (razorpayData) => {
        console.log("Razorpay payment success:", razorpayData);
        
        if (!razorpayData.razorpay_payment_id) {
          throw new Error('Payment ID not received from Razorpay');
        }
        
        setProcessingMessage("Verifying your payment...");
        
        const verifyPayload = {
          razorpay_order_id: razorpayData.razorpay_order_id,
          razorpay_payment_id: razorpayData.razorpay_payment_id,
          razorpay_signature: razorpayData.razorpay_signature,
          ...orderPayload
        };

        setProcessingMessage("Creating your order...");
        
        const verifyResponse = await axiosInstance.post('/api/verifyPayment', verifyPayload);
        
        if (verifyResponse.data.success) {
          console.log("✅ Order created successfully:", verifyResponse.data.orderId);
          
          setProcessingMessage("Finalizing your order...");
          
          dispatch(clearProducts());
          
          if (isGuest) {
            await AsyncStorage.removeItem('guestAddresses');
            await AsyncStorage.removeItem('guestEmail');
            await AsyncStorage.removeItem('guestPhone');
          }
          
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Order placed successfully!',
          });
          
          setTimeout(() => {
            setIsProcessing(false);
            setPaymentProcessing(false);
            setCheckoutLoading(false);
            
            navigation.navigate('Success', {
              orderId: verifyResponse.data.orderId,
              orderDetails: verifyResponse.data.orderDetails
            });
          }, 2000);
          
        } else {
          console.error("❌ Order creation failed:", verifyResponse.data.message);
          setIsProcessing(false);
          setPaymentProcessing(false);
          setCheckoutLoading(false);
          
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: verifyResponse.data.message || 'Failed to create order',
          });
        }
      }).catch((error) => {
        console.error("❌ Razorpay checkout error:", error);
        setIsProcessing(false);
        setPaymentProcessing(false);
        setCheckoutLoading(false);
        
        if (error.error && typeof error.error === 'object') {
          const errorCode = error.error.code;
          let errorMsg = error.error.description || 'Payment failed';
          
          if (errorCode === 'BAD_REQUEST_ERROR') {
            errorMsg = 'Invalid payment data. Please check your information.';
          } else if (errorCode === 'PAYMENT_CANCELLED') {
            errorMsg = 'Payment was cancelled by user.';
          }
          
          Toast.show({
            type: 'error',
            text1: 'Payment Failed',
            text2: errorMsg,
          });
        } else if (error.error && typeof error.error === 'string') {
          Toast.show({
            type: 'error',
            text1: 'Payment Failed',
            text2: error.error,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Payment process failed. Please try again.',
          });
        }
      });

    } catch (error) {
      console.error('=== CHECKOUT ERROR ===');
      console.error('Error:', error);
      
      let errorMessage = 'Checkout failed. Please try again.';

      if (error.response) {
        if (error.response.status === 500) {
          errorMessage = 'Server error. Please try again later or contact support.';
        } else if (error.response.status === 400) {
          const validationError = error.response.data?.message;
          if (validationError) {
            errorMessage = validationError;
          }
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your internet connection.';
      }

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
      
      setIsProcessing(false);
      setCheckoutLoading(false);
      setPaymentProcessing(false);
    }
  };

  // Handle checkout based on payment method
  const handleCheckout = async () => {
    console.log("=== STARTING CHECKOUT ===");
    
    if (checkoutLoading || paymentProcessing || codProcessing || isProcessing) {
      console.log("Checkout already in progress");
      return;
    }

    if (paymentMethod === 'cod') {
      await handleCODCheckout();
    } else {
      await handleOnlineCheckout();
    }
  };

  // Render address item
  const renderAddressItem = (addr, index) => {
    const addressText = typeof addr === 'object' ? addr.fullAddress : addr;
    const isSelected = formData.selectedAddress === addressText;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.addressCard,
          isSelected && styles.selectedAddressCard
        ]}
        onPress={() => {
          const newFormData = { 
            ...formData, 
            selectedAddress: addressText
          };
          
          // If it's an object address, update email and phone
          if (typeof addr === 'object') {
            if (addr.email) {
              newFormData.email = addr.email;
            }
            if (addr.phone) {
              newFormData.phone = addr.phone;
            }
          }
          
          setFormData(newFormData);
          
          // Save to AsyncStorage
          (async () => {
            if (typeof addr === 'object') {
              if (addr.email) {
                await AsyncStorage.setItem('guestEmail', addr.email);
              }
              if (addr.phone) {
                await AsyncStorage.setItem('guestPhone', addr.phone);
              }
            }
          })();
        }}
      >
        <View style={styles.addressRadio}>
          {isSelected && <View style={styles.addressRadioSelected} />}
        </View>
        <View style={styles.addressDetails}>
          <Text style={styles.addressText}>{addressText}</Text>
          {typeof addr === 'object' && addr.email && (
            <Text style={styles.addressEmail}>📧 {addr.email}</Text>
          )}
          {typeof addr === 'object' && addr.phone && (
            <Text style={styles.addressPhone}>📱 {addr.phone}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render cart items
  const renderCartItems = () => {
    if (cartItems.length === 0) {
      return (
        <View style={styles.emptyCart}>
          <View style={styles.emptyCartIcon}>
            <Text style={styles.emptyCartEmoji}>🛒</Text>
          </View>
          <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
          <Text style={styles.emptyCartText}>Add some items to get started</Text>
          <TouchableOpacity 
            style={styles.continueShoppingBtn}
            onPress={() => navigation.navigate("Category")}
          >
            <Text style={styles.continueShoppingText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return cartItems.map((item, index) => {
      const itemPrice = getItemPrice(item);
      const discount = item.discount || 0;
      const imageUrl = getProductImageUrl(item);
      
      console.log(`Rendering cart item ${index}:`, {
        name: item.name,
        price: itemPrice,
        imageUrl: imageUrl
      });
      
      return (
        <TouchableOpacity
          key={`${item._id}_${index}_${item.selectedVariant?.label || 'default'}`}
          style={styles.cartItem}
          onPress={() => handleProductClick(item)}
          activeOpacity={0.7}
        >
          {/* Product Image */}
          <View style={styles.imageContainer}>
            <Image 
              source={{ 
                uri: imageUrl,
                cache: 'force-cache'
              }} 
              style={styles.productImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.itemDetails}>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
            {item.selectedVariant?.label && (
              <Text style={styles.itemVariant}>{item.selectedVariant.label}</Text>
            )}
            <Text style={styles.itemDescription}>{item.quantity || 1} Pack</Text>

            <View style={styles.itemPricing}>
              <Text style={styles.currentPrice}>
                ₹{itemPrice.toFixed(2)}
              </Text>
              {discount > 0 && (
                <Text style={styles.discount}>
                  {Math.round(discount)}% OFF
                </Text>
              )}
            </View>
          </View>

          <View style={styles.itemActions}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[styles.quantityBtn, (item.quantity || 1) <= 1 && styles.disabledBtn]}
                onPress={(e) => handleQuantityChange(item._id, (item.quantity || 1) - 1, e)}
                disabled={(item.quantity || 1) <= 1}
              >
                <Text style={styles.quantityBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantity}>{item.quantity || 1}</Text>
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={(e) => handleQuantityChange(item._id, (item.quantity || 1) + 1, e)}
              >
                <Text style={styles.quantityBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.removeBtn}
              onPress={(e) => handleRemoveItem(item._id, item.name, e)}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    });
  };

  // Render processing loader
  const renderProcessingLoader = () => (
    <Modal
      transparent={true}
      animationType="fade"
      visible={isProcessing}
      onRequestClose={() => {}}
    >
      <View style={styles.processingOverlay}>
        <View style={styles.processingModal}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.processingTitle}>Processing Your Order</Text>
          <Text style={styles.processingMessage}>{processingMessage}</Text>
          <View style={styles.processingProgress}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '60%' }]} />
            </View>
            <View style={styles.progressSteps}>
              <Text style={styles.stepText}>Payment</Text>
              <Text style={styles.stepText}>Verification</Text>
              <Text style={styles.stepText}>Confirmation</Text>
            </View>
          </View>
          <Text style={styles.processingNote}>
            Please do not close this window
          </Text>
        </View>
      </View>
    </Modal>
  );

  // Render state dropdown modal
  const renderStateDropdown = () => (
    <Modal
      visible={showStateDropdown}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowStateDropdown(false)}
    >
      <View style={styles.dropdownOverlay}>
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>Select State</Text>
            <TouchableOpacity onPress={() => setShowStateDropdown(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.dropdownLoading}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.dropdownLoadingText}>Loading states...</Text>
            </View>
          ) : (
            <ScrollView style={styles.dropdownScroll}>
              {states.map((state, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.dropdownItem}
                  onPress={() => handleStateSelect(state)}
                >
                  <Text style={styles.dropdownItemText}>{state}</Text>
                  {formData.state === state && (
                    <Icon name="check" size={20} color="#FF6B00" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // Render city dropdown modal
  const renderCityDropdown = () => (
    <Modal
      visible={showCityDropdown}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowCityDropdown(false)}
    >
      <View style={styles.dropdownOverlay}>
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>Select City</Text>
            <TouchableOpacity onPress={() => setShowCityDropdown(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.dropdownLoading}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.dropdownLoadingText}>Loading cities...</Text>
            </View>
          ) : cities.length === 0 ? (
            <View style={styles.dropdownEmpty}>
              <Text style={styles.dropdownEmptyText}>
                Please select a state first
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.dropdownScroll}>
              {cities.map((city, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.dropdownItem}
                  onPress={() => handleCitySelect(city)}
                >
                  <Text style={styles.dropdownItemText}>{city}</Text>
                  {formData.city === city && (
                    <Icon name="check" size={20} color="#FF6B00" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // Render address modal
  const renderAddressModal = () => (
    <Modal
      visible={showAddressModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddressModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isAuthenticated ? 'Add New Address' : 'Add Delivery Address'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Please fill in all required fields
            </Text>
          </View>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Email Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={[styles.textInput, formData.email && !isValidEmail(formData.email) && styles.inputError]}
                value={formData.email}
                onChangeText={handleEmailChange}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {formData.email && !isValidEmail(formData.email) ? (
                <Text style={styles.errorText}>Please enter a valid email</Text>
              ) : (
                <Text style={styles.helperText}>Required for order confirmation and updates</Text>
              )}
            </View>

            {/* Address Fields */}
            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Flat / House No. *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.flat}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, flat: text }))}
                  placeholder="Enter flat/house number"
                />
              </View>
              
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Landmark *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.landmark}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, landmark: text }))}
                  placeholder="Enter landmark"
                />
              </View>
            </View>

            {/* State Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>State *</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowStateDropdown(true)}
              >
                <Text style={formData.state ? styles.pickerText : styles.pickerPlaceholder}>
                  {formData.state || 'Select State'}
                </Text>
                <Icon name="arrow-drop-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* City Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>City *</Text>
              <TouchableOpacity
                style={[styles.pickerButton, !formData.state && styles.disabledPicker]}
                onPress={() => {
                  if (formData.state) {
                    setShowCityDropdown(true);
                  }
                }}
                disabled={!formData.state}
              >
                <Text style={formData.city ? styles.pickerText : styles.pickerPlaceholder}>
                  {formData.city || (formData.state ? 'Select City' : 'Select state first')}
                </Text>
                <Icon name="arrow-drop-down" size={24} color="#666" />
              </TouchableOpacity>
              {!formData.state && (
                <Text style={styles.helperText}>Please select state first</Text>
              )}
            </View>

            {/* Country Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Country</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: '#f5f5f5' }]}
                value="India"
                editable={false}
              />
            </View>

            {/* Phone Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <View style={styles.phoneInputContainer}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, formData.phone.length > 0 && formData.phone.length !== 10 && styles.inputError]}
                  value={formData.phone}
                  onChangeText={handlePhoneChange}
                  placeholder="Enter 10-digit phone number"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              {formData.phone.length > 0 && formData.phone.length !== 10 ? (
                <Text style={styles.errorText}>Phone number must be exactly 10 digits</Text>
              ) : (
                <Text style={styles.helperText}>Required for delivery updates</Text>
              )}
            </View>

            {/* Required Note */}
            <View style={styles.requiredNote}>
              <Text style={styles.requiredStar}>*</Text>
              <Text style={styles.requiredText}>Required fields</Text>
            </View>

            {/* Guest Info Note */}
            {!isAuthenticated && (
              <View style={styles.guestInfoNote}>
                <Text style={styles.guestInfoIcon}>ⓘ</Text>
                <Text style={styles.guestInfoText}>
                  Your address will be saved locally for this session only. 
                  <Text style={styles.guestInfoBold}> Sign up</Text> to save addresses permanently.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAddressModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.saveButton,
                (loading || 
                  !formData.email || 
                  !isValidEmail(formData.email) ||
                  !formData.flat || 
                  !formData.landmark || 
                  !formData.city || 
                  !formData.state || 
                  formData.phone.length !== 10) && styles.disabledButton
              ]}
              onPress={handleAddAddress}
              disabled={
                loading || 
                !formData.email || 
                !isValidEmail(formData.email) ||
                !formData.flat || 
                !formData.landmark || 
                !formData.city || 
                !formData.state || 
                formData.phone.length !== 10
              }
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isAuthenticated ? 'Add Address' : 'Save Address'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Clear Cart Modal Component
  const ClearCartModal = ({ visible, onClose, onConfirm }) => {
    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (visible) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [visible]);

    if (!visible) return null;

    return (
      <Modal
        transparent={true}
        animationType="none"
        visible={visible}
        onRequestClose={onClose}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <Animated.View 
            style={[
              styles.clearModalContainer, 
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Header */}
            <View style={styles.clearModalHeader}>
              <View style={styles.clearModalIconContainer}>
                <AlertCircle size={30} color="#FF6B00" />
              </View>
              <TouchableOpacity 
                style={styles.clearModalCloseBtn}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={22} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.clearModalContent}>
              <Text style={styles.clearModalTitle}>Clear Cart</Text>
              <Text style={styles.clearModalDescription}>
                Are you sure you want to remove all items from your cart? This action cannot be undone.
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.clearModalButtons}>
              <TouchableOpacity
                style={styles.clearModalCancelBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.clearModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.clearModalConfirmBtn}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF6B00', '#FF8E53']}
                  style={styles.clearModalGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.clearModalConfirmText}>Clear All</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  };

  // Remove Item Modal Component
  const RemoveItemModal = ({ visible, onClose, onConfirm, itemName }) => {
    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (visible) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [visible]);

    if (!visible) return null;

    return (
      <Modal
        transparent={true}
        animationType="none"
        visible={visible}
        onRequestClose={onClose}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <Animated.View 
            style={[
              styles.removeModalContainer, 
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Header */}
            <View style={styles.removeModalHeader}>
              <View style={styles.removeModalIconContainer}>
                <AlertCircle size={30} color="#FF6B00" />
              </View>
              <TouchableOpacity 
                style={styles.removeModalCloseBtn}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={22} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.removeModalContent}>
              <Text style={styles.removeModalTitle}>Remove Item</Text>
              <Text style={styles.removeModalDescription}>
                Are you sure you want to remove "{itemName}" from your cart?
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.removeModalButtons}>
              <TouchableOpacity
                style={styles.removeModalCancelBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.removeModalCancelText}>Keep Item</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.removeModalConfirmBtn}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF4444', '#FF6B6B']}
                  style={styles.removeModalGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.removeModalConfirmText}>Remove</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  };

  // Success Modal for COD Orders
  const SuccessModal = ({ visible, message, onClose }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (visible) {
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }).start();
      } else {
        scaleAnim.setValue(0);
      }
    }, [visible]);

    if (!visible) return null;

    return (
      <Modal transparent visible={visible} animationType="fade">
        <View style={styles.successModalOverlay}>
          <Animated.View style={[styles.successModalContent, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.successIconContainer}>
              <CheckCircle size={60} color="#4CAF50" />
            </View>
            <Text style={styles.successModalTitle}>Order Placed Successfully!</Text>
            <Text style={styles.successModalMessage}>{message}</Text>
            <TouchableOpacity style={styles.successModalButton} onPress={onClose}>
              <Text style={styles.successModalButtonText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  if (loading && cartItems.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar backgroundColor="#fff" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      
      <ClearCartModal
        visible={showClearCartModal}
        onClose={() => setShowClearCartModal(false)}
        onConfirm={confirmClearCart}
      />
      
      {/* Remove Item Modal */}
      <RemoveItemModal
        visible={showRemoveItemModal}
        onClose={() => {
          setShowRemoveItemModal(false);
          setItemToRemove(null);
          setItemNameToRemove('');
        }}
        onConfirm={confirmRemoveItem}
        itemName={itemNameToRemove}
      />
      
      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        message={successMessage}
        onClose={() => setShowSuccessModal(false)}
      />
      
      {/* Processing Loader */}
      {renderProcessingLoader()}
      
      {/* State Dropdown */}
      {renderStateDropdown()}
      
      {/* City Dropdown */}
      {renderCityDropdown()}
      
      {/* Address Modal */}
      {renderAddressModal()}
      
      {/* Login Prompt */}
      {!isAuthenticated && (
        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptText}>
            You are browsing as a guest. 
            <Text style={styles.loginLink} onPress={() => navigation.navigate('Login')}> Login </Text> 
            for order tracking.
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <View style={styles.cartItemsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleContainer}>
              <Text style={styles.sectionTitle}>Your Items ({cartItems.length})</Text>
              {isWholesaler && (
                <View style={styles.wholesaleTag}>
                  <Text style={styles.wholesaleTagText}>Wholesale</Text>
                </View>
              )}
            </View>
            {cartItems.length > 0 && (
              <TouchableOpacity onPress={handleClearCart}>
                <Text style={styles.clearCartText}>Clear Cart</Text>
              </TouchableOpacity>
            )}
          </View>
          {renderCartItems()}
        </View>

        {cartItems.length > 0 && (
          <View style={styles.orderSummary}>
            <Text style={styles.summaryTitle}>Order Summary</Text>

            {/* Guest Notice */}
            {!isAuthenticated && (
              <View style={styles.guestNotice}>
                <Text style={styles.guestNoticeText}>
                  🎯 Guest Checkout Available! Enter your details below to proceed without login.
                </Text>
              </View>
            )}

            {/* Wholesaler Note */}
            {isWholesaler && (
              <View style={styles.wholesalerNote}>
                <Text style={styles.wholesalerNoteText}>
                  📦 You are viewing wholesale prices. Payment will be processed at wholesale rates.
                </Text>
              </View>
            )}

            {/* Add Address Button */}
            <TouchableOpacity
              style={styles.addAddressBtn}
              onPress={() => setShowAddressModal(true)}
            >
              <Text style={styles.addAddressBtnText}>
                ➕ {addresses.length > 0 ? 'Add Another Address' : 'Add Address'}
              </Text>
            </TouchableOpacity>

            {/* Saved Addresses */}
            {addresses.length > 0 ? (
              <View style={styles.savedAddresses}>
                <Text style={styles.sectionSubtitle}>📍 Saved Addresses</Text>
                {addresses.map((addr, index) => renderAddressItem(addr, index))}
              </View>
            ) : (
              <Text style={styles.noAddressText}>
                No address saved yet. Please add your delivery address.
              </Text>
            )}

            {/* Payment Method Selection */}
            <View style={styles.paymentMethodSection}>
              <Text style={styles.sectionSubtitle}>💳 Payment Method</Text>
              <View style={styles.paymentMethods}>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodCard,
                    paymentMethod === 'online' && styles.paymentMethodSelected
                  ]}
                  onPress={() => handlePaymentMethodChange('online')}
                >
                  <View style={styles.paymentMethodHeader}>
                    <CreditCard size={20} color={paymentMethod === 'online' ? '#FF6B00' : '#666'} />
                    <Text style={[
                      styles.paymentMethodTitle,
                      paymentMethod === 'online' && styles.paymentMethodTitleSelected
                    ]}>Online Payment</Text>
                  </View>
                  <Text style={styles.paymentMethodDescription}>
                    Pay securely with Razorpay
                  </Text>
                </TouchableOpacity>

                {codEnabled && (
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodCard,
                      paymentMethod === 'cod' && styles.paymentMethodSelected
                    ]}
                    onPress={() => handlePaymentMethodChange('cod')}
                  >
                    <View style={styles.paymentMethodHeader}>
                      <Wallet size={20} color={paymentMethod === 'cod' ? '#FF6B00' : '#666'} />
                      <Text style={[
                        styles.paymentMethodTitle,
                        paymentMethod === 'cod' && styles.paymentMethodTitleSelected
                      ]}>Cash on Delivery</Text>
                    </View>
                    <Text style={styles.paymentMethodDescription}>
                      Pay when you receive your order
                      <Text style={styles.codChargeText}> + ₹{codCharge} COD charge</Text>
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Order Summary Details */}
            <View style={styles.summaryDetails}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal ({cartItems.length} items)</Text>
                <Text style={styles.summaryValue}>₹{baseTotal.toFixed(2)}</Text>
              </View>
              
              {paymentMethod === 'cod' && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>COD Charge</Text>
                  <Text style={styles.summaryValue}>+ ₹{codCharge.toFixed(2)}</Text>
                </View>
              )}
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={[styles.summaryValue, styles.freeShipping]}>FREE</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>₹0.00</Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryTotal}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{finalTotal.toFixed(2)}</Text>
            </View>

            {/* COD Note */}
            {paymentMethod === 'cod' && (
              <View style={styles.codNote}>
                <Text style={styles.codNoteText}>
                  💡 Note: You'll pay ₹{finalTotal.toFixed(2)} (including ₹{codCharge} COD charge) when your order is delivered.
                </Text>
              </View>
            )}

            {/* Checkout Button */}
            <TouchableOpacity
              style={[
                styles.checkoutBtn,
                paymentMethod === 'cod' && styles.codCheckoutBtn,
                (!formData.selectedAddress || 
                  checkoutLoading || 
                  paymentProcessing || 
                  isProcessing ||
                  codProcessing ||
                  !formData.email ||
                  !isValidEmail(formData.email) ||
                  !formData.phone ||
                  formData.phone.length !== 10) && styles.disabledBtn
              ]}
              onPress={handleCheckout}
              disabled={
                !formData.selectedAddress || 
                checkoutLoading || 
                paymentProcessing || 
                isProcessing ||
                codProcessing ||
                !formData.email ||
                !isValidEmail(formData.email) ||
                !formData.phone ||
                formData.phone.length !== 10
              }
            >
              {checkoutLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : paymentProcessing || isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : codProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.checkoutBtnText}>
                  {paymentMethod === 'cod' 
                    ? `Place COD Order (₹${finalTotal.toFixed(2)})`
                    : isAuthenticated 
                      ? 'Proceed to Payment' 
                      : 'Proceed as Guest'
                  }
                </Text>
              )}
            </TouchableOpacity>

            {/* Validation Warning */}
            {!isAuthenticated && (!formData.email || !isValidEmail(formData.email) || !formData.phone || formData.phone.length !== 10) && (
              <Text style={styles.validationWarning}>
                ⚠️ Email address and phone number are required for order confirmation
              </Text>
            )}

            {/* Login Suggestion */}
            {!isAuthenticated && (
              <View style={styles.loginSuggestion}>
                <Text style={styles.loginSuggestionText}>
                  <Text 
                    style={styles.loginSuggestionLink}
                    onPress={() => navigation.navigate('Login')}
                  >
                    Login
                  </Text> for order tracking and faster checkout next time.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles - Add new styles for payment methods and COD
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f9',
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  loginPrompt: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#bbdefb',
  },
  loginPromptText: {
    fontSize: 14,
    color: '#FF6B00',
    textAlign: 'center',
  },
  loginLink: {
    fontWeight: 'bold',
    color: '#FF6B00',
    textDecorationLine: 'underline',
  },
  scrollView: {
    flex: 1,
  },
  cartItemsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  wholesaleTag: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  wholesaleTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  clearCartText: {
    fontSize: 14,
    color: '#ff4444',
    fontWeight: '500',
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCartIcon: {
    marginBottom: 16,
  },
  emptyCartEmoji: {
    fontSize: 48,
  },
  emptyCartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptyCartText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  continueShoppingBtn: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  continueShoppingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cartItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'flex-start',
  },
  imageContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  itemVariant: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  itemPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  discount: {
    fontSize: 12,
    color: '#4caf50',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quantityBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  disabledBtn: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  quantityBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  quantity: {
    width: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    backgroundColor: '#fff',
    paddingVertical: 6,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF5F5',
    borderRadius: 6,
    gap: 4,
  },
  removeBtnText: {
    fontSize: 12,
    color: '#ff4444',
    fontWeight: '500',
  },
  orderSummary: {
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 16,
    marginTop: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  guestNotice: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  guestNoticeText: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
  },
  wholesalerNote: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  wholesalerNoteText: {
    fontSize: 14,
    color: '#E65100',
    textAlign: 'center',
  },
  addAddressBtn: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addAddressBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  savedAddresses: {
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  selectedAddressCard: {
    borderColor: '#FF6B00',
    backgroundColor: '#e8eaf6',
  },
  addressRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  addressRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B00',
  },
  addressDetails: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  addressEmail: {
    fontSize: 12,
    color: '#666',
  },
  addressPhone: {
    fontSize: 12,
    color: '#666',
  },
  noAddressText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 12,
    paddingVertical: 8,
  },
  paymentMethodSection: {
    marginBottom: 16,
  },
  paymentMethods: {
    gap: 12,
  },
  paymentMethodCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  paymentMethodSelected: {
    borderColor: '#FF6B00',
    backgroundColor: '#e8eaf6',
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  paymentMethodTitleSelected: {
    color: '#FF6B00',
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 28,
  },
  codChargeText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  summaryDetails: {
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  freeShipping: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  codNote: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  codNoteText: {
    fontSize: 14,
    color: '#E65100',
    textAlign: 'center',
  },
  checkoutBtn: {
    backgroundColor: '#FF6B00',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  codCheckoutBtn: {
    backgroundColor: '#2E7D32',
  },
  disabledBtn: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  validationWarning: {
    fontSize: 12,
    color: '#f57c00',
    textAlign: 'center',
    marginBottom: 12,
  },
  loginSuggestion: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  loginSuggestionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loginSuggestionLink: {
    color: '#FF6B00',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  
  // Clear Cart Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  clearModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    position: 'absolute',
    bottom: 0,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 10,
  },
  clearModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  clearModalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearModalCloseBtn: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  clearModalContent: {
    marginBottom: 24,
  },
  clearModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  clearModalDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  clearModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  clearModalCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  clearModalCancelText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '600',
  },
  clearModalConfirmBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  clearModalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  clearModalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Remove Item Modal Styles
  removeModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    position: 'absolute',
    bottom: 0,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 10,
  },
  removeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  removeModalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeModalCloseBtn: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  removeModalContent: {
    marginBottom: 24,
  },
  removeModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  removeModalDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  removeModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  removeModalCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  removeModalCancelText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '600',
  },
  removeModalConfirmBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  removeModalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  removeModalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  successModalButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Processing Loader
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 12,
    textAlign: 'center',
  },
  processingMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  processingProgress: {
    width: '100%',
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepText: {
    fontSize: 12,
    color: '#666',
  },
  processingNote: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // Dropdown Styles
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dropdownLoading: {
    padding: 40,
    alignItems: 'center',
  },
  dropdownLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  dropdownScroll: {
    maxHeight: 400,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  
  // Modal Input Styles
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  disabledPicker: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  phonePrefix: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  phonePrefixText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  requiredNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  requiredStar: {
    color: '#d32f2f',
    fontWeight: '700',
    fontSize: 16,
    marginRight: 4,
  },
  requiredText: {
    fontSize: 12,
    color: '#666',
  },
  guestInfoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1ecf1',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bee5eb',
  },
  guestInfoIcon: {
    fontSize: 16,
    color: '#0c5460',
    marginRight: 8,
  },
  guestInfoText: {
    fontSize: 14,
    color: '#0c5460',
    flex: 1,
  },
  guestInfoBold: {
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
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
    marginTop: 4,
  },
  gstText: {
    fontSize: 12,
    color: '#666',
  },
  finalPriceBadge: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  finalPriceText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
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
  variantDiscountText: {
    fontSize: 10,
    color: '#4CAF50',
    marginTop: 2,
    fontWeight: '600',
  },
  outOfStockLabel: {
    fontSize: 10,
    color: '#F44336',
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
  outOfStockText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
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
  savingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  savingsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  savingsValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E65100',
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
});

export default Cart;