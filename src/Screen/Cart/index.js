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
      let price = parseFloat(item.final_price);
      if (!price || price <= 0 || isNaN(price)) {
        price = parseFloat(item.price) || parseFloat(item.mrp) || 0;
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
    }, [])
  );

  const initializeData = async () => {
    try {
      // Check authentication
      const userDataStr = await AsyncStorage.getItem('userData');
      if (userDataStr) {
        setIsAuthenticated(true);
        const userData = JSON.parse(userDataStr);
        setFormData(prev => ({
          ...prev,
          email: userData?.email || '',
          phone: userData?.phone || '',
        }));
      } else {
        setIsAuthenticated(false);
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
  };

  const handleQuantityChange = (itemId, newQuantity) => {
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
  };

  const handleRemoveItem = (itemId) => {
    dispatch(deleteProduct(itemId));
    Toast.show({
      type: 'info',
      text1: 'Removed',
      text2: 'Item removed from cart.',
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

  // Fetch states
  const loadStates = async () => {
    try {
      const res = await axiosInstance.post('https://countriesnow.space/api/v0.1/countries/states', {
        country: 'India'
      });
      if (res.data.data && res.data.data.states) {
        setStates(res.data.data.states.map(s => s.name));
      }
    } catch (err) {
      console.error('Error fetching states', err);
    }
  };

  // Fetch cities when state changes
  const fetchCities = async (stateName) => {
    try {
      const res = await axiosInstance.post('https://countriesnow.space/api/v0.1/countries/state/cities', {
        country: 'India',
        state: stateName
      });
      if (res.data.data) {
        setCities(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching cities', err);
    }
  };

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

    // Address object बनाएं
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
      // AsyncStorage से existing addresses निकालें
      const existingAddressesStr = await AsyncStorage.getItem('guestAddresses');
      const existingAddresses = existingAddressesStr ? JSON.parse(existingAddressesStr) : [];
      const updatedAddresses = [...existingAddresses, addressObject];
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('guestAddresses', JSON.stringify(updatedAddresses));
      
      // Also save email and phone separately
      await AsyncStorage.setItem('guestEmail', formData.email);
      await AsyncStorage.setItem('guestPhone', formData.phone);
      
      // State update करें
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
      if (!checkoutEmail) {
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

      if (!phoneNumber) {
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
          final_price: item.final_price,
          price: item.price,
          mrp: item.mrp,
          calculatedPrice: price,
          quantity: qty
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

      // Show processing loader
      setIsProcessing(true);
      setProcessingMessage("Creating payment order...");
      setPaymentProcessing(true);

      // Step 2: Open Razorpay checkout
      const options = {
        description: 'Order Payment - Dr BSK',
        currency: razorpayOrder.currency || 'INR',
        key: "rzp_test_RpQ1JwSJEy6yAw",
        amount: razorpayOrder.amount.toString(),
        name: "Dr BSK",
        order_id: razorpayOrder.id,
        prefill: {
          name: 'Customer',
          email: checkoutEmail,
          contact: `+91${phoneNumber}`
        },
        theme: { color: '#3f51b5' },
        notes: {
          order_type: 'pharma_order',
          items_count: cartItems.length.toString(),
          userId: userId
        }
      };

      console.log("Opening Razorpay checkout...");
      console.log("Razorpay options:", options);
      
      try {
        const razorpayData = await RazorpayCheckout.open(options);
        
        console.log("Razorpay response:", razorpayData);
        
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
          await AsyncStorage.removeItem('cartItems');
          
          // Clear guest addresses if guest user
          if (!isAuthenticated) {
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
            navigation.navigate('Success', {
              orderId: verifyResponse.data.orderId,
              orderDetails: verifyResponse.data.orderDetails
            });
          }, 2000);
          
        } else {
          console.error("❌ Order creation failed:", verifyResponse.data.message);
          setIsProcessing(false);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: verifyResponse.data.message || 'Failed to create order',
          });
        }
      } catch (error) {
        console.error("❌ Razorpay checkout error:", error);
        setIsProcessing(false);
        
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
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Payment process failed. Please try again.',
          });
        }
      } finally {
        setPaymentProcessing(false);
        setCheckoutLoading(false);
      }

    } catch (error) {
      console.error('=== CHECKOUT ERROR ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
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
  const getProductImageUrl = (media) => {
    try {
      if (!media || !Array.isArray(media) || media.length === 0 || !media[0]?.url) {
        return 'https://via.placeholder.com/80x100?text=No+Image';
      }
      
      const imageUrl = media[0].url;
      
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }
      
      return imageUrl;
    } catch (error) {
      console.error('Error getting product image:', error);
      return 'https://via.placeholder.com/80x100?text=Error';
    }
  };

  // Clear cart
  const clearCart = () => {
    dispatch(clearProducts());
    Toast.show({
      type: 'info',
      text1: 'Cart Cleared',
      text2: 'Your cart has been cleared.',
    });
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
          setFormData(prev => ({ 
            ...prev, 
            selectedAddress: addressText
          }));
          
          // If it's an object address, update email and phone
          if (typeof addr === 'object') {
            if (addr.email) {
              setFormData(prev => ({ ...prev, email: addr.email }));
              AsyncStorage.setItem('guestEmail', addr.email);
            }
            if (addr.phone) {
              setFormData(prev => ({ ...prev, phone: addr.phone }));
              AsyncStorage.setItem('guestPhone', addr.phone);
            }
          }
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
          <ActivityIndicator size="large" color="#3f51b5" />
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
          <Text style={styles.modalTitle}>Add Delivery Address</Text>
          
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
              {formData.email && !isValidEmail(formData.email) && (
                <Text style={styles.errorText}>Please enter a valid email</Text>
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
              {formData.phone.length > 0 && formData.phone.length !== 10 && (
                <Text style={styles.errorText}>Phone must be 10 digits</Text>
              )}
            </View>
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
                <Text style={styles.saveButtonText}>Save Address</Text>
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

    return cartItems.map((item) => {
      const itemPrice = getItemPrice(item);
      
      return (
        <View key={item._id} style={styles.cartItem}>
          <Image 
            source={{ uri: getProductImageUrl(item.media) }} 
            style={styles.productImage}
            resizeMode="contain"
          />

          <View style={styles.itemDetails}>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.itemDescription}>{item.quantity || 1} Pack</Text>

            <View style={styles.itemPricing}>
              <Text style={styles.currentPrice}>
                ₹{itemPrice.toFixed(2)}
              </Text>
              {item.discount && item.discount > 0 && (
                <Text style={styles.discount}>
                  {Math.round(item.discount)}% OFF
                </Text>
              )}
            </View>
          </View>

          <View style={styles.itemActions}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[styles.quantityBtn, (item.quantity || 1) <= 1 && styles.disabledBtn]}
                onPress={() => handleQuantityChange(item._id, (item.quantity || 1) - 1)}
                disabled={(item.quantity || 1) <= 1}
              >
                <Text style={styles.quantityBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantity}>{item.quantity || 1}</Text>
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => handleQuantityChange(item._id, (item.quantity || 1) + 1)}
              >
                <Text style={styles.quantityBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.removeBtn}
              onPress={() => handleRemoveItem(item._id)}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3f51b5" />
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
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        
        {cartItems.length > 0 && (
          <TouchableOpacity onPress={clearCart}>
            <Text style={styles.clearAllText}>Clear All</Text>
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
          <Text style={styles.sectionTitle}>Your Items ({cartItems.length})</Text>
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
                {addresses.length > 0 ? 'Add Another Address' : 'Add Address'}
              </Text>
            </TouchableOpacity>

            {/* Saved Addresses */}
            {addresses.length > 0 ? (
              <View style={styles.savedAddresses}>
                <Text style={styles.sectionSubtitle}>Saved Addresses</Text>
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
                <Text>Subtotal ({cartItems.length} items)</Text>
                <Text>₹{totalPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text>Shipping</Text>
                <Text style={styles.freeShipping}>FREE</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text>Tax</Text>
                <Text>₹0.00</Text>
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

// Styles (same as previous code, no changes needed)
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
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clearAllText: {
    fontSize: 14,
    color: '#ff4444',
    fontWeight: '500',
  },
  loginPrompt: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#bbdefb',
  },
  loginPromptText: {
    fontSize: 14,
    color: '#1565c0',
    textAlign: 'center',
  },
  loginLink: {
    fontWeight: 'bold',
    color: '#0d47a1',
  },
  scrollView: {
    flex: 1,
  },
  cartItemsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 40,
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
    backgroundColor: '#3f51b5',
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
    alignItems: 'center',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
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
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  quantityBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  quantityBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  quantity: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  removeBtn: {
    padding: 4,
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
    padding: 16,
    marginTop: 8,
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
  },
  addAddressBtn: {
    backgroundColor: '#3f51b5',
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
    borderColor: '#3f51b5',
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
    backgroundColor: '#3f51b5',
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
  },
  summaryDetails: {
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    color: '#3f51b5',
  },
  checkoutBtn: {
    backgroundColor: '#3f51b5',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
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
    backgroundColor: '#3f51b5',
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
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
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
    backgroundColor: '#3f51b5',
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