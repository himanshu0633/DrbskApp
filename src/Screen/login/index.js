import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Mail,
  Smartphone,
  Check,
  User,
  Lock,
  Eye,
  EyeOff,
  X,
} from 'lucide-react-native';
import axiosInstance from '../../Components/AxiosInstance';
import {useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import {SvgUri} from 'react-native-svg';

const {width, height} = Dimensions.get('window');
const rs = (size, factor = 0.5) => {
  return size + ((width / 400) - 1) * size * factor;
};
const LoginScreen = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const navigation = useNavigation();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    otp: '',
  });

  // Timer for OTP resend
  const startResendTimer = () => {
    setResendTimer(30);
    const timer = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData({...formData, [field]: value});
    if (error) setError('');

    // Reset OTP verification if email changes
    if (field === 'email') {
      setIsOtpVerified(false);
      setOtpSent(false);
    }
  };

  // Toggle between login and signup
  const toggleForm = () => {
    setIsSignUp(!isSignUp);
    setIsOtpVerified(false);
    setOtpSent(false);
    setError('');
    setResendTimer(0);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      otp: '',
    });
  };

  // Show error in toast and local state
  const showError = (message) => {
    setError(message);
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: message,
      position: 'top',
      visibilityTime: 4000,
    });
  };

  // Show success in toast
  const showSuccess = (title, message) => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  // ================= SEND OTP =================
  const handleSendOtp = async () => {
    if (isSignUp) {
      // For signup, validate all fields first
      if (!formData.fullName.trim()) {
        showError('Please enter your name');
        return;
      }
      if (!formData.email || !formData.email.includes('@')) {
        showError('Please enter a valid email address');
        return;
      }
      if (!formData.phone || formData.phone.length !== 10) {
        showError('Please enter a valid 10-digit phone number');
        return;
      }
      if (!formData.password || formData.password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        showError('Passwords do not match');
        return;
      }
    } else {
      // For login, only validate email
      if (!formData.email || !formData.email.includes('@')) {
        showError('Please enter a valid email address');
        return;
      }
    }

    setIsSendingOtp(true);
    setError('');

    try {
      const endpoint = isSignUp ? '/api/send-otp' : '/admin/send-otp';
      const data = {email: formData.email};

      const response = await axiosInstance.post(endpoint, data);

      // Check response structure
      if (response.data?.success || response.status === 200) {
        setOtpSent(true);
        startResendTimer();
        setShowOtpModal(true);
        setIsOtpVerified(false);

        showSuccess(
          'OTP Sent',
          `OTP has been sent to ${formData.email}`
        );
      } else {
        const errorMsg = response.data?.message || 'Failed to send OTP. Please try again.';
        showError(errorMsg);
      }
    } catch (error) {
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.response?.status === 404 && !isSignUp) {
        errorMessage = 'Email not found. Please sign up.';
      } else if (error.response?.status === 400 && isSignUp) {
        errorMessage = error.response.data?.message || 'Email already registered. Please sign in.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.request) {
        errorMessage = 'No response from server. Please try again.';
      }

      showError(errorMessage);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ================= VERIFY OTP =================
  const handleVerifyOtp = async () => {
    if (!formData.otp || formData.otp.length !== 6) {
      showError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsVerifyingOtp(true);
    setError('');

    try {
      if (isSignUp) {
        // For signup verification
        const response = await axiosInstance.post('/api/verify-otp', {
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          otp: formData.otp,
        });

        // Check if response has data
        if (response.data) {
          const responseData = response.data;

          // Check various success conditions
          if (
            responseData.success ||
            responseData.admin ||
            responseData.user ||
            responseData.token ||
            responseData.data
          ) {
            setIsOtpVerified(true);
            setShowOtpModal(false);

            // Store user data and token if available
            if (responseData.token) {
              await AsyncStorage.setItem('authToken', responseData.token);
            }

            // Store user data if available
            const userData =
              responseData.admin || responseData.user || responseData.data;
            if (userData) {
              await AsyncStorage.setItem('userData', JSON.stringify(userData));
            }

            showSuccess(
              'Success!',
              'Registration completed successfully'
            );

            // Try different navigation methods
            setTimeout(() => {
              // Method 1: Try replace first
              if (navigation.replace) {
                navigation.replace('Dashboard');
              } 
              // Method 2: Try reset
              else if (navigation.reset) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Dashboard' }],
                });
              }
              // Method 3: Regular navigate
              else {
                navigation.navigate('Dashboard');
              }
            }, 1000);
            
          } else {
            const errorMsg = responseData.message || 'OTP verification failed';
            showError(errorMsg);
          }
        } else {
          showError('No response data received from server');
        }
      } else {
        // For login verification
        const response = await axiosInstance.post('/admin/login-with-otp', {
          email: formData.email,
          otp: formData.otp,
        });

        if (response.data) {
          const responseData = response.data;

          if (responseData.token || responseData.success) {
            setIsOtpVerified(true);
            setShowOtpModal(false);

            // Store user data and token
            if (responseData.token) {
              await AsyncStorage.setItem('authToken', responseData.token);
            }

            // Store user data if available
            const userData =
              responseData.data || responseData.user || responseData.admin;
            if (userData) {
              await AsyncStorage.setItem('userData', JSON.stringify(userData));
            }

            showSuccess(
              'Welcome!',
              'Login successful'
            );

            // Navigate to Dashboard
            setTimeout(() => {
              // Try different navigation methods
              if (navigation.replace) {
                navigation.replace('Dashboard');
              } else if (navigation.reset) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Dashboard' }],
                });
              } else {
                navigation.navigate('Dashboard');
              }
            }, 1000);
          } else {
            const errorMsg = responseData.message || 'Invalid OTP';
            showError(errorMsg);
          }
        } else {
          showError('No response data received from server');
        }
      }
    } catch (error) {
      let errorMessage = 'OTP verification failed. Please try again.';
      
      if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid or expired OTP';
      } else if (error.response?.status === 404) {
        errorMessage = 'User not found. Please sign up first.';
      } else if (error.response?.status === 409) {
        errorMessage = error.response.data?.message || 'User already exists with this email';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.request) {
        errorMessage = 'No response from server. Please try again.';
      }

      showError(errorMessage);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP
  const resendOtp = async () => {
    if (resendTimer > 0) return;

    setError('');
    try {
      const endpoint = isSignUp ? '/api/send-otp' : '/admin/send-otp';

      const response = await axiosInstance.post(endpoint, {
        email: formData.email,
      });

      if (response.data?.success || response.status === 200) {
        startResendTimer();
        showSuccess(
          'OTP Resent',
          'New OTP has been sent to your email'
        );
      } else {
        const errorMsg = response.data?.message || 'Failed to resend OTP';
        showError(errorMsg);
      }
    } catch (error) {
      let errorMessage = 'Failed to resend OTP. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      showError(errorMessage);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // ================= RENDER LOGIN FORM =================
  const renderLoginForm = () => {
    return (
      <>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.emailContainer}>
            <View style={styles.emailInputContainer}>
              <Mail size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputWithIcon]}
                placeholder="example@email.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={text => handleInputChange('email', text)}
              />
            </View>
          </View>
        </View>

        {/* Send OTP Button for Login */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!formData.email || !formData.email.includes('@') || isSendingOtp) && styles.disabledButton,
          ]}
          onPress={handleSendOtp}
          disabled={!formData.email || !formData.email.includes('@') || isSendingOtp}>
          {isSendingOtp ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>Send OTP</Text>
          )}
        </TouchableOpacity>

        {isOtpVerified && (
          <View style={styles.verifiedStatusContainer}>
            <Check size={24} color="#10B981" />
            <Text style={styles.verifiedStatusText}>
              Login Successful! Redirecting to Dashboard...
            </Text>
          </View>
        )}
      </>
    );
  };

  // ================= RENDER SIGNUP FORM =================
  const renderSignupForm = () => {
    // Check if all required fields are filled
    const isSignupFormValid =
      formData.fullName.trim() &&
      formData.email &&
      formData.email.includes('@') &&
      formData.phone &&
      formData.phone.length === 10 &&
      formData.password &&
      formData.password.length >= 8 &&
      formData.confirmPassword &&
      formData.password === formData.confirmPassword;

    return (
      <>
        {/* Full Name */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <View style={styles.inputContainer}>
            <User size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="John Doe"
              placeholderTextColor="#94A3B8"
              value={formData.fullName}
              onChangeText={text => handleInputChange('fullName', text)}
            />
          </View>
        </View>

        {/* Email with OTP Button */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.emailContainer}>
            <View style={styles.emailInputContainer}>
              <Mail size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputWithIcon]}
                placeholder="example@email.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={text => handleInputChange('email', text)}
              />
            </View>
          </View>
        </View>

        {/* Phone */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={styles.inputContainer}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.countryCode}>+91</Text>
            </View>
            <Smartphone
              size={20}
              color="#64748B"
              style={[styles.inputIcon, {left: 48}]}
            />
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="9876543210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={10}
              value={formData.phone}
              onChangeText={text =>
                handleInputChange('phone', text.replace(/[^0-9]/g, ''))
              }
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <Lock size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputWithIcon, {paddingRight: 50}]}
              placeholder="Minimum 8 characters"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              value={formData.password}
              onChangeText={text => handleInputChange('password', text)}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={20} color="#64748B" />
              ) : (
                <Eye size={20} color="#64748B" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm Password */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <Lock size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputWithIcon, {paddingRight: 50}]}
              placeholder="Confirm your password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showConfirmPassword}
              value={formData.confirmPassword}
              onChangeText={text => handleInputChange('confirmPassword', text)}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              {showConfirmPassword ? (
                <EyeOff size={20} color="#64748B" />
              ) : (
                <Eye size={20} color="#64748B" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Message */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {isSignupFormValid
              ? 'Click "Send OTP" to verify your email'
              : 'Please fill all fields correctly to send OTP'}
          </Text>
        </View>

        {/* Send OTP Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!isSignupFormValid || isSendingOtp) && styles.disabledButton,
          ]}
          onPress={handleSendOtp}
          disabled={!isSignupFormValid || isSendingOtp}>
          {isSendingOtp ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>Send OTP</Text>
          )}
        </TouchableOpacity>

        {/* Verified Status */}
        {isOtpVerified && (
          <View style={styles.verifiedStatusContainer}>
            <Check size={24} color="#10B981" />
            <Text style={styles.verifiedStatusText}>
              Registration Completed! Redirecting to Dashboard...
            </Text>
          </View>
        )}
      </>
    );
  };

  // ================= OTP MODAL =================
  const renderOtpModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOtpModal}
        onRequestClose={() => {
          setShowOtpModal(false);
          setFormData({...formData, otp: ''});
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify OTP</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowOtpModal(false);
                  setFormData({...formData, otp: ''});
                }}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <View style={styles.modalContent}>
              <Text style={styles.modalSubtitle}>
                Enter the 6-digit OTP sent to
              </Text>
              <Text style={styles.modalEmail}>{formData.email}</Text>

              <View style={styles.modalInputWrapper}>
                <Text style={styles.modalInputLabel}>OTP Code</Text>
                <TextInput
                  style={styles.modalOtpInput}
                  placeholder="000000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={formData.otp}
                  onChangeText={text =>
                    handleInputChange('otp', text.replace(/[^0-9]/g, ''))
                  }
                  textAlign="center"
                  autoFocus
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalResendButton}
                  onPress={resendOtp}
                  disabled={resendTimer > 0}>
                  <Text
                    style={[
                      styles.modalResendText,
                      resendTimer > 0 && styles.resendDisabled,
                    ]}>
                    {resendTimer > 0
                      ? `Resend in ${resendTimer}s`
                      : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowOtpModal(false);
                    setFormData({...formData, otp: ''});
                  }}>
                  <Text style={styles.modalChangeEmail}>Change Email</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.modalVerifyButton,
                  (formData.otp.length !== 6 || isVerifyingOtp) &&
                    styles.modalButtonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={formData.otp.length !== 6 || isVerifyingOtp}>
                {isVerifyingOtp ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalVerifyText}>
                    {isSignUp ? 'Verify & Register' : 'Verify & Login'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <ScrollView
          contentContainerStyle={{flexGrow: 1}}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={24} color="#2C3E50" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
          </View>

          {/* Illustration */}
          <View style={styles.illustrationContainer}>
            <SvgUri
              width={200}
              height={200}
              uri="https://app.davaindia.com/images/AuthLogo.svg"
            />
            <Text style={styles.welcomeText}>
              {isSignUp ? 'Create your account' : 'Sign in to your account'}
            </Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {isSignUp ? renderSignupForm() : renderLoginForm()}

            {/* Form Toggle */}
            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>
                {isSignUp
                  ? 'Already have an account? '
                  : "Don't have an account? "}
              </Text>
              <TouchableOpacity onPress={toggleForm}>
                <Text style={styles.switchLink}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* OTP Modal */}
      {renderOtpModal()}

      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: rs(0),
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 20,
    flex: 1,
  },
  illustrationContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emailInputContainer: {
    flex: 1,
    position: 'relative',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputWithIcon: {
    paddingLeft: 48,
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 1,
  },
  sendOtpButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  sendOtpButtonDisabled: {
    backgroundColor: '#93C5FD',
    opacity: 0.7,
  },
  sendOtpText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  countryCodeBox: {
    position: 'absolute',
    left: 16,
    top: 16,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  countryCode: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  phoneInput: {
    paddingLeft: 70,
    width: '100%',
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  verifiedButton: {
    backgroundColor: '#10B981',
  },
  disabledButton: {
    backgroundColor: '#93C5FD',
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 16,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedStatusText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  infoContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoText: {
    color: '#0369A1',
    fontSize: 14,
    textAlign: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  switchText: {
    fontSize: 14,
    color: '#64748B',
  },
  switchLink: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    marginLeft: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width * 0.9,
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalEmail: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInputWrapper: {
    marginBottom: 24,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 8,
  },
  modalOtpInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    textAlign: 'center',
    letterSpacing: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalResendButton: {
    paddingVertical: 8,
  },
  modalResendText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  modalChangeEmail: {
    fontSize: 14,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  modalVerifyButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    backgroundColor: '#93C5FD',
    opacity: 0.7,
  },
  modalVerifyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resendDisabled: {
    color: '#94A3B8',
  },
});

export default LoginScreen;