import React, { useState } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Mail, Smartphone, Check } from 'lucide-react-native';
import axiosInstance from '../../Components/AxiosInstance';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const navigation = useNavigation();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    otp: '',
  });

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePhone = (phone) => {
    const regex = /^[0-9]{10}$/;
    return regex.test(phone);
  };

  const startResendTimer = () => {
    setResendTimer(30);
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendEmailOtp = async () => {
    console.log('🚀 handleSendEmailOtp called with email:', formData.email);
    
    if (!validateEmail(formData.email)) {
      console.log('❌ Invalid email format:', formData.email);
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log('📤 Sending OTP request to /admin/send-otp');
      const response = await axiosInstance.post('/admin/send-otp', {
        email: formData.email
      });
      
      console.log('✅ OTP Response:', response.data);
      
      if (response.data.success) {
        setOtpSent(true);
        startResendTimer();
        Toast.show({
          type: 'success',
          position: 'bottom',
          text1: 'OTP Sent',
          text2: `OTP has been sent to ${formData.email}`,
          visibilityTime: 2000,
          autoHide: true,
          topOffset: 30,
        });
      } else {
        console.log('❌ OTP send failed:', response.data);
        setError(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('🔥 OTP Send Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      
      let errorMsg = 'Failed to send OTP. Please try again.';
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.response?.status === 404) {
        errorMsg = 'Email not found. Please sign up first.';
      }
      
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    console.log('🔐 handleVerifyOtp called with:', {
      email: formData.email,
      otp: formData.otp
    });
    
    if (!formData.otp || formData.otp.length !== 6) {
      console.log('❌ Invalid OTP length:', formData.otp?.length);
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log('📤 Logging in with OTP at /admin/login-with-otp');
      const response = await axiosInstance.post('/admin/login-with-otp', {
        email: formData.email,
        otp: formData.otp
      });

      console.log('✅ Login with OTP Response:', response.data);

      if (response.status === 200 && response.data.token) {
        setOtpVerified(true);
        
        await AsyncStorage.setItem('authToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.data));

        console.log('✅ Login successful, tokens stored');
        console.log('📱 User Data:', response.data.data);

        // Link guest orders to this user
        if (formData.email) {
          try {
            console.log('🔄 Attempting to link guest orders...');
            const linkResponse = await axiosInstance.post('/api/link-guest-orders', {
              email: formData.email,
              userId: response.data.data._id
            }, {
              headers: { 
                Authorization: `Bearer ${response.data.token}` 
              }
            });
            
            console.log('✅ Link Guest Orders Response:', linkResponse.data);
            
            if (linkResponse.data.success && linkResponse.data.linkedCount > 0) {
              Toast.show({
                type: 'success',
                position: 'bottom',
                text1: 'Orders Linked',
                text2: `${linkResponse.data.linkedCount} previous orders linked to your account`,
                visibilityTime: 4000,
                autoHide: true,
                topOffset: 30,
              });
            }
          } catch (linkError) {
            console.error('🔥 Guest Order Linking Error:', linkError);
          }
        }

        Toast.show({
          type: 'success',
          position: 'bottom',
          text1: 'Welcome!',
          text2: 'Login successful',
          visibilityTime: 2000,
          autoHide: true,
          topOffset: 30,
        });
        
        console.log('➡️ Navigating to Dashboard...');
        navigation.navigate('Dashboard');
      } else {
        console.log('❌ Login failed:', response.data);
        setError('Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('🔥 Verify OTP/Login Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMsg = 'Invalid OTP. Please try again.';
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      setError(errorMsg);
      Toast.show({
        type: 'error',
        position: 'bottom',
        text1: 'Error',
        text2: errorMsg,
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 30,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    console.log('📝 handleSignUp called with:', formData);
    
    if (!formData.fullName.trim()) {
      console.log('❌ Full name missing');
      setError('Please enter your full name');
      return;
    }

    if (!validateEmail(formData.email)) {
      console.log('❌ Invalid email:', formData.email);
      setError('Please enter a valid email address');
      return;
    }

    if (!validatePhone(formData.phone)) {
      console.log('❌ Invalid phone:', formData.phone);
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log('📤 Creating account at /admin/createAdmin');
      const response = await axiosInstance.post('/admin/createAdmin', {
        name: formData.fullName,
        email: formData.email,
        mobile: formData.phone,
      });

      console.log('✅ Signup Response:', {
        status: response.status,
        data: response.data
      });

      if (response.status === 200 || response.status === 201) {
        Toast.show({
          type: 'success',
          position: 'bottom',
          text1: 'Account Created',
          text2: 'Registration successful! Please login',
          visibilityTime: 2000,
          autoHide: true,
          topOffset: 30,
        });
        
        // Switch to login mode
        setIsSignUp(false);
        setFormData({
          ...formData,
          fullName: '',
          phone: '',
        });
      }
    } catch (error) {
      console.error('🔥 Signup Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMsg = 'Registration failed. Please try again.';
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.response?.status === 409) {
        errorMsg = 'Email already registered. Please login instead.';
      }
      
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleForm = () => {
    console.log('🔄 Toggling form from', isSignUp ? 'Sign Up' : 'Login', 'to', !isSignUp ? 'Login' : 'Sign Up');
    
    setIsSignUp(!isSignUp);
    setOtpSent(false);
    setOtpVerified(false);
    setError(null);
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      otp: '',
    });
  };

  const handleBack = () => {
    console.log('⬅️ Back button pressed');
    
    if (otpSent) {
      console.log('↩️ Going back to email input from OTP screen');
      setOtpSent(false);
      setOtpVerified(false);
      setFormData({ ...formData, otp: '' });
    } else {
      console.log('🏠 Navigating to ProductsPage');
      navigation.navigate('ProductsPage');
    }
  };

  console.log('🔄 LoginScreen Render State:', {
    isSignUp,
    otpSent,
    otpVerified,
    resendTimer,
    isSubmitting,
    email: formData.email,
    otpLength: formData.otp?.length
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={24} color="#2C3E50" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>
              {isSignUp ? 'Create Account' : otpSent ? 'Enter OTP' : 'Welcome Back'}
            </Text>
          </View>

          {/* Illustration */}
          <View style={styles.illustrationContainer}>
            <Image
              source={require('../../assets/loginicon.png')}
              style={styles.illustrationImage}
              resizeMode="contain"
            />
            {!isSignUp && !otpSent && (
              <Text style={styles.welcomeText}>
                Sign in to access your account
              </Text>
            )}
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {isSignUp ? (
              /* Sign Up Form */
              <>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      placeholderTextColor="#94A3B8"
                      value={formData.fullName}
                      onChangeText={(text) => {
                        console.log('✏️ Full Name changed:', text);
                        setFormData({ ...formData, fullName: text });
                      }}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputContainer}>
                    <Mail size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.inputWithIcon]}
                      placeholder="example@email.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      value={formData.email}
                      onChangeText={(text) => {
                        console.log('✏️ Email changed:', text);
                        setFormData({ ...formData, email: text });
                      }}
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.inputContainer}>
                    <Smartphone size={20} color="#64748B" style={styles.inputIcon} />
                    <Text style={styles.countryCode}>+91</Text>
                    <TextInput
                      style={[styles.input, styles.phoneInput]}
                      placeholder="9876543210"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={formData.phone}
                      onChangeText={(text) => {
                        const numericText = text.replace(/[^0-9]/g, '');
                        console.log('✏️ Phone changed:', numericText);
                        setFormData({ ...formData, phone: numericText });
                      }}
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={[
                    styles.submitButton, 
                    (!formData.fullName || !formData.email || !validatePhone(formData.phone) || isSubmitting) && styles.disabledButton
                  ]} 
                  onPress={handleSignUp} 
                  disabled={!formData.fullName || !formData.email || !validatePhone(formData.phone) || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.switchContainer}>
                  <Text style={styles.switchText}>Already have an account? </Text>
                  <TouchableOpacity onPress={toggleForm}>
                    <Text style={styles.switchLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Login Form */
              <>
                {!otpSent ? (
                  /* Email Input */
                  <>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>Email Address</Text>
                      <View style={styles.inputContainer}>
                        <Mail size={20} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, styles.inputWithIcon]}
                          placeholder="example@email.com"
                          placeholderTextColor="#94A3B8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                          value={formData.email}
                          onChangeText={(text) => {
                            console.log('✏️ Login Email changed:', text);
                            setFormData({ ...formData, email: text });
                          }}
                        />
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={[
                        styles.submitButton, 
                        (!validateEmail(formData.email) || isSubmitting) && styles.disabledButton
                      ]} 
                      onPress={handleSendEmailOtp} 
                      disabled={!validateEmail(formData.email) || isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.submitText}>Send OTP</Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.switchContainer}>
                      <Text style={styles.switchText}>Don't have an account? </Text>
                      <TouchableOpacity onPress={toggleForm}>
                        <Text style={styles.switchLink}>Sign Up</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* OTP Input */
                  <>
                    <View style={styles.otpHeader}>
                      <Text style={styles.otpTitle}>Enter OTP</Text>
                      <Text style={styles.otpSubtitle}>
                        We've sent a 6-digit code to {'\n'}
                        <Text style={styles.emailText}>{formData.email}</Text>
                      </Text>
                    </View>

                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>6-Digit OTP</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.input}
                          placeholder="000000"
                          placeholderTextColor="#94A3B8"
                          keyboardType="number-pad"
                          maxLength={6}
                          value={formData.otp}
                          onChangeText={(text) => {
                            const numericText = text.replace(/[^0-9]/g, '');
                            console.log('✏️ OTP changed:', numericText);
                            setFormData({ ...formData, otp: numericText });
                          }}
                          textAlign="center"
                          fontSize={24}
                          fontWeight="bold"
                        />
                        {otpVerified && (
                          <View style={styles.verifiedIcon}>
                            <Check size={24} color="#22C55E" />
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.otpActions}>
                      <TouchableOpacity 
                        style={styles.resendButton}
                        onPress={resendTimer === 0 ? handleSendEmailOtp : null}
                        disabled={resendTimer > 0 || isSubmitting}
                      >
                        <Text style={[
                          styles.resendText,
                          resendTimer > 0 && styles.resendDisabled
                        ]}>
                          {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => {
                        console.log('📧 Change Email clicked');
                        setOtpSent(false);
                      }}>
                        <Text style={styles.changeEmailText}>Change Email</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                      style={[
                        styles.submitButton, 
                        (formData.otp.length !== 6 || isSubmitting) && styles.disabledButton
                      ]} 
                      onPress={handleVerifyOtp}
                      disabled={formData.otp.length !== 6 || isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.submitText}>Verify & Login</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  },
  illustrationContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
  },
  illustrationImage: {
    width: width * 0.6,
    height: height * 0.25,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
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
  countryCode: {
    position: 'absolute',
    left: 48,
    top: 16,
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
    zIndex: 1,
  },
  phoneInput: {
    paddingLeft: 90,
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  emailText: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  verifiedIcon: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  resendButton: {
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  resendDisabled: {
    color: '#94A3B8',
  },
  changeEmailText: {
    fontSize: 14,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
});

export default LoginScreen;