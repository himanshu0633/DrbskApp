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
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RazorpayCheckout from 'react-native-razorpay';

import { deleteProduct, updateData, clearProducts } from '../../store/Action';
import axiosInstance from '../../Components/AxiosInstance';
import API_URL from '../../../config';

const { width } = Dimensions.get('window');

const Cart = () => {
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

  // Ref to track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Email validation function
  const isValidEmail = useCallback((email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // Calculate item price
  const getItemPrice = (item) => {
    try {
      let price = 0;
      
      // Check for final_price first
      if (item.final_price) {
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
  };

  // Calculate total price
  const totalPrice = cartItems.reduce((acc, item) => {
    const price = getItemPrice(item);
    const quantity = parseInt(item.quantity) || 1;
    return acc + price * quantity;
  }, 0);

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
        
        // Set form data from user data
        setFormData(prev => ({
          ...prev,
          email: parsedUserData?.email || '',
          phone: parsedUserData?.phone || '',
        }));
        
        console.log('User authenticated:', parsedUserData.email);
      } else {
        setIsAuthenticated(false);
        setUserData(null);
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

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      const loadData = async () => {
        if (isActive) {
          setLoading(true);
          try {
            await initializeData();
            await loadStates();
          } catch (error) {
            console.error('Error loading cart data:', error);
          } finally {
            if (isActive) {
              setLoading(false);
            }
          }
        }
      };
      
      loadData();
      
      return () => {
        isActive = false;
      };
    }, [initializeData])
  );

  // Load states
  const loadStates = async () => {
    try {
      console.log('Loading states...');
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
    }
  };

  // Handle product click - navigate to product details
  const handleProductClick = useCallback((item) => {
    // Create a normalized product object for the product details page
    const productForDetails = {
      ...item,
      // Ensure we have all required fields for product details page
      category: item.category || 'General',
      description: item.description || '',
      variants: item.variants || [],
      media: item.media || [],
      price: getItemPrice(item),
    };
    
    // Navigate to Products page with the selected product
    navigation.navigate('Products', {
      selectedProduct: productForDetails
    });
  }, [navigation, getItemPrice]);

  // Handle quantity change
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
  const handleRemoveItem = useCallback((itemId, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            dispatch(deleteProduct(itemId));
            Toast.show({
              type: 'info',
              text1: 'Removed',
              text2: 'Item removed from cart.',
            });
          }
        }
      ]
    );
  }, [dispatch]);

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

  // Fetch cities when state changes
  const fetchCities = async (stateName) => {
    if (!stateName) return;
    
    try {
      console.log('Fetching cities for state:', stateName);
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

  // Handle checkout
  const handleCheckout = async () => {
    console.log("=== STARTING CHECKOUT PROCESS ===");
    
    if (checkoutLoading || paymentProcessing) {
      console.log("Checkout already in progress");
      return;
    }

    setCheckoutLoading(true);

    try {
      // Form validation
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

      // Validate all cart items before proceeding
      const invalidItems = [];
      cartItems.forEach((item) => {
        const qty = parseInt(item.quantity) || 1;
        const price = getItemPrice(item);
        
        if (!item._id || !item.name || qty < 1 || price <= 0 || isNaN(price)) {
          invalidItems.push(item.name || 'Unknown item');
        }
      });

      if (invalidItems.length > 0) {
        console.error('Invalid cart items:', invalidItems);
        Toast.show({
          type: 'error',
          text1: 'Invalid Items',
          text2: `Please remove or update: ${invalidItems.join(', ')}`,
        });
        setCheckoutLoading(false);
        return;
      }

      // Get email from form or AsyncStorage
      let checkoutEmail = formData.email;
      if (!checkoutEmail || !isValidEmail(checkoutEmail)) {
        checkoutEmail = await AsyncStorage.getItem('guestEmail') || '';
      }
      
      if (!checkoutEmail || !isValidEmail(checkoutEmail)) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please provide a valid email address',
        });
        setCheckoutLoading(false);
        return;
      }

      // Get phone number
      let phoneNumber = formData.phone?.toString().trim();

      if (!phoneNumber || phoneNumber.length !== 10) {
        // Try to get from saved addresses
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

      // Prepare order items
      const orderItems = cartItems.map((item) => {
        const qty = parseInt(item.quantity) || 1;
        const price = getItemPrice(item);
        
        console.log('Processing item:', {
          name: item.name,
          id: item._id,
          quantity: qty,
          price: price,
          final_price: item.final_price,
          calculatedPrice: price
        });

        return {
          productId: item._id,
          name: item.name?.trim() || 'Product',
          quantity: qty,
          price: price
        };
      });

      // Create guest user ID if not logged in
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

      // Calculate total amount from order items
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

      // Prepare order payload
      const orderPayload = {
        userId: userId,
        items: orderItems,
        address: formData.selectedAddress.trim(),
        phone: phoneNumber,
        email: checkoutEmail,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        isGuest: isGuest
      };

      console.log("Creating Razorpay order...");
      console.log("Order payload:", JSON.stringify(orderPayload, null, 2));
      
      // Step 1: Create Razorpay Order
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
      console.log("Order amount:", razorpayOrder.amount);
      console.log("Order currency:", razorpayOrder.currency);

      // Show processing loader
      setIsProcessing(true);
      setProcessingMessage("Creating payment order...");
      setPaymentProcessing(true);

      // Step 2: Open Razorpay checkout
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
      console.log("Razorpay options:", options);
      
      // Open Razorpay
      RazorpayCheckout.open(options).then(async (razorpayData) => {
        console.log("Razorpay payment success:", razorpayData);
        
        if (!razorpayData.razorpay_payment_id) {
          throw new Error('Payment ID not received from Razorpay');
        }
        
        // Update processing message
        setProcessingMessage("Verifying your payment...");
        
        // Step 3: Verify payment and create order
        console.log("Verifying payment and creating order...");
        
        const verifyPayload = {
          razorpay_order_id: razorpayData.razorpay_order_id,
          razorpay_payment_id: razorpayData.razorpay_payment_id,
          razorpay_signature: razorpayData.razorpay_signature,
          ...orderPayload
        };

        // Update loader message
        setProcessingMessage("Creating your order...");
        
        const verifyResponse = await axiosInstance.post('/api/verifyPayment', verifyPayload);
        
        if (verifyResponse.data.success) {
          console.log("✅ Order created successfully:", verifyResponse.data.orderId);
          
          // Update loader for final step
          setProcessingMessage("Finalizing your order...");
          
          // Clear cart
          dispatch(clearProducts());
          
          // Clear guest addresses if guest user
          if (isGuest) {
            await AsyncStorage.removeItem('guestAddresses');
            await AsyncStorage.removeItem('guestEmail');
            await AsyncStorage.removeItem('guestPhone');
          }
          
          // Show success
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Order placed successfully!',
          });
          
          // Wait 2 seconds before navigating
          setTimeout(() => {
            // Hide loader and navigate
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
        
        // Handle Razorpay errors
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
          // If error is a string
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

      // Handle specific error cases
      if (error.response) {
        // Server error (500)
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
        // Network error
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

  // Get product image URL
  const getProductImageUrl = (item) => {
    try {
      // Priority 1: Check if item has media array with URL
      if (item.media && Array.isArray(item.media) && item.media.length > 0) {
        const firstMedia = item.media[0];
        if (firstMedia && firstMedia.url) {
          // Check if URL is already absolute
          if (firstMedia.url.startsWith('http://') || firstMedia.url.startsWith('https://')) {
            return firstMedia.url;
          }
          
          // If relative URL, prepend API_URL
          return `${API_URL}${firstMedia.url}`;
        }
      }
      
      // Priority 2: Check if product has direct image property
      if (item.image) {
        if (item.image.startsWith('http://') || item.image.startsWith('https://')) {
          return item.image;
        } else {
          return `${API_URL}${item.image}`;
        }
      }
      
      // Priority 3: Check for product_image
      if (item.product_image) {
        if (item.product_image.startsWith('http://') || item.product_image.startsWith('https://')) {
          return item.product_image;
        } else {
          return `${API_URL}${item.product_image}`;
        }
      }
      
      // Priority 4: Check for selectedVariant image
      if (item.selectedVariant && item.selectedVariant.image) {
        if (item.selectedVariant.image.startsWith('http://') || item.selectedVariant.image.startsWith('https://')) {
          return item.selectedVariant.image;
        } else {
          return `${API_URL}${item.selectedVariant.image}`;
        }
      }
      
      // Fallback to placeholder
      return 'https://via.placeholder.com/100x100?text=No+Image';
    } catch (error) {
      console.error('Error getting product image:', error);
      return 'https://via.placeholder.com/100x100?text=Error';
    }
  };

  // Clear cart
  const clearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            dispatch(clearProducts());
            Toast.show({
              type: 'info',
              text1: 'Cart Cleared',
              text2: 'Your cart has been cleared.',
            });
          }
        }
      ]
    );
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
                onPress={() => {
                  if (states.length === 0) {
                    Toast.show({
                      type: 'info',
                      text1: 'Loading',
                      text2: 'Loading states...',
                    });
                    return;
                  }
                  
                  Alert.alert(
                    'Select State',
                    '',
                    states.map(state => ({
                      text: state,
                      onPress: () => {
                        setFormData(prev => ({ ...prev, state, city: '' }));
                        fetchCities(state);
                      }
                    })).concat([{ text: 'Cancel', style: 'cancel' }])
                  );
                }}
              >
                <Text style={formData.state ? styles.pickerText : styles.pickerPlaceholder}>
                  {formData.state || 'Select State'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* City Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>City *</Text>
              <TouchableOpacity
                style={[styles.pickerButton, !formData.state && styles.disabledPicker]}
                onPress={() => {
                  if (!formData.state) return;
                  if (cities.length === 0) {
                    Toast.show({
                      type: 'info',
                      text1: 'Loading',
                      text2: 'Loading cities...',
                    });
                    return;
                  }
                  
                  Alert.alert(
                    'Select City',
                    '',
                    cities.map(city => ({
                      text: city,
                      onPress: () => setFormData(prev => ({ ...prev, city }))
                    })).concat([{ text: 'Cancel', style: 'cancel' }])
                  );
                }}
                disabled={!formData.state}
              >
                <Text style={formData.city ? styles.pickerText : styles.pickerPlaceholder}>
                  {formData.city || (formData.state ? 'Select City' : 'Select state first')}
                </Text>
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
              onPress={(e) => handleRemoveItem(item._id, e)}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    });
  };

  if (loading && cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />
      
      {/* Processing Loader */}
      {renderProcessingLoader()}
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        
        {cartItems.length > 0 && (
          <TouchableOpacity 
            style={styles.clearAllButton}
            onPress={clearCart}
          >
            {/* <Text style={styles.clearAllText}>Clear All</Text> */}
          </TouchableOpacity>
        )}
      </View>

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
            <Text style={styles.sectionTitle}>Your Items ({cartItems.length})</Text>
            {cartItems.length > 0 && (
              <TouchableOpacity onPress={clearCart}>
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
                  🎯 Guest Checkout Available! Enter your details below.
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

            {/* Order Summary Details */}
            <View style={styles.summaryDetails}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal ({cartItems.length} items)</Text>
                <Text style={styles.summaryValue}>₹{totalPrice.toFixed(2)}</Text>
              </View>
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
              <Text style={styles.totalValue}>₹{totalPrice.toFixed(2)}</Text>
            </View>

            {/* Checkout Button */}
            <TouchableOpacity
              style={[
                styles.checkoutBtn,
                (!formData.selectedAddress || 
                  checkoutLoading || 
                  paymentProcessing || 
                  isProcessing ||
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
                !formData.email ||
                !isValidEmail(formData.email) ||
                !formData.phone ||
                formData.phone.length !== 10
              }
            >
              {checkoutLoading || paymentProcessing || isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.checkoutBtnText}>
                  {isAuthenticated ? 'Proceed to Payment' : 'Proceed as Guest'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Validation Warning */}
            {!isAuthenticated && (!formData.email || !isValidEmail(formData.email) || !formData.phone || formData.phone.length !== 10) && (
              <Text style={styles.validationWarning}>
                ⚠️ Email and phone required for order confirmation
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

            {/* Security Badges */}
            <View style={styles.securityBadges}>
              <Text style={styles.badge}>🔒 Secure Payment</Text>
              <Text style={styles.badge}>💳 Razorpay Verified</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Address Modal */}
      {renderAddressModal()}
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f9',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clearAllButton: {
    padding: 4,
  },
  clearAllText: {
    fontSize: 14,
    color: '#ff4444',
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeBtnText: {
    fontSize: 12,
    color: '#ff4444',
    textDecorationLine: 'underline',
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
    marginBottom: 24,
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
  securityBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  badge: {
    fontSize: 12,
    color: '#666',
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  modalScroll: {
    maxHeight: 400,
  },
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
});

export default Cart;