import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Dimensions,
  StatusBar,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Globe, 
  Package, 
  MapPin, 
  LogOut,
  ChevronRight,
  Phone,
  Mail,
  Shield,
  Heart,
  HelpCircle,
  Settings,
  Home,
  Briefcase,
  MessageCircle
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

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

const Profile = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [userData, setUserData] = useState({
    name: '',
    email: '',
    id: '',
    phone: '',
  });
  const [addresses, setAddresses] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Support contact details
  const supportInfo = {
    email: 'support@yourcompany.com',
    phone: '+91 98765 43210',
    workingHours: 'Mon - Sun: 9:00 AM to 8:00 PM',
    whatsapp: '+91 98765 43210'
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser !== null) {
        const parsedUser = JSON.parse(storedUser);
        setUserData({
          name: parsedUser.name || '',
          email: parsedUser.email || '',
          phone: parsedUser.phone || '',
          id: parsedUser._id || '', 
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };
  
  const fetchSavedAddresses = async () => {
    try {
      const keysToCheck = [
        'guestAddresses',
        'addresses',
        'userAddresses',
        'savedAddresses'
      ];
      
      let allAddresses = [];
      
      for (const key of keysToCheck) {
        try {
          const addressesStr = await AsyncStorage.getItem(key);
          if (addressesStr) {
            const parsedAddresses = JSON.parse(addressesStr);
            if (Array.isArray(parsedAddresses)) {
              const addressesWithSource = parsedAddresses.map(addr => ({
                ...addr,
                source: key
              }));
              allAddresses = [...allAddresses, ...addressesWithSource];
            }
          }
        } catch (error) {
          console.log(`Error reading key ${key}:`, error);
        }
      }
      
      console.log('All fetched addresses:', allAddresses);
      setAddresses(allAddresses);
      
      if (allAddresses.length === 0) {
        console.log('No addresses found in AsyncStorage');
      }
      
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  // Function to handle phone call
  const handlePhoneCall = () => {
    const phoneNumber = supportInfo.phone.replace(/\s/g, '');
    Linking.openURL(`tel:${phoneNumber}`)
      .catch(err => {
        Alert.alert('Error', 'Could not make phone call');
        console.error('Phone call error:', err);
      });
  };

  // Function to handle email
  const handleEmail = () => {
    Linking.openURL(`mailto:${supportInfo.email}`)
      .catch(err => {
        Alert.alert('Error', 'Could not open email client');
        console.error('Email error:', err);
      });
  };

  // Function to handle WhatsApp
  const handleWhatsApp = () => {
    const whatsappNumber = supportInfo.whatsapp.replace(/\s/g, '');
    const message = 'Hello, I need help with my order.';
    Linking.openURL(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`)
      .catch(err => {
        Alert.alert('Error', 'Could not open WhatsApp');
        console.error('WhatsApp error:', err);
      });
  };

  const menuItems = [
    {
      id: 1,
      title: 'Languages',
      rightText: 'English',
      icon: Globe,
      iconBgColor: '#FFF8D6',
      iconColor: '#E7B10A',
    },
    {
      id: 2,
      title: 'My Orders',
      icon: Package,
      iconBgColor: '#FFE5E5',
      iconColor: '#FF7676',
    },
    // {
    //   id: 3,
    //   title: 'My Wishlist',
    //   icon: Heart,
    //   iconBgColor: '#FFE5F1',
    //   iconColor: '#FF4081',
    // },
    {
      id: 4,
      title: 'My Addresses',
      icon: MapPin,
      iconBgColor: '#E3F2FD',
      iconColor: '#2196F3',
      count: addresses.length,
    },
    // {
    //   id: 5,
    //   title: 'Privacy Policy',
    //   icon: Shield,
    //   iconBgColor: '#E8F5E9',
    //   iconColor: '#4CAF50',
    // },
    // {
    //   id: 6,
    //   title: 'Settings',
    //   icon: Settings,
    //   iconBgColor: '#F3E5F5',
    //   iconColor: '#9C27B0',
    // },
    {
      id: 7,
      title: 'Help & Support',
      icon: HelpCircle,
      iconBgColor: '#FFF3E0',
      iconColor: '#FF9800',
    },
    {
      id: 8,
      title: 'Sign Out',
      icon: LogOut,
      iconBgColor: '#FFEBEE',
      iconColor: '#F44336',
    },
  ];

  // Menu item component
  const MenuItem = ({ item }) => {
    const IconComponent = item.icon;
    
    const handlePress = async () => {
      if (item.title === 'Sign Out') {
        Alert.alert(
          'Sign Out',
          'Are you sure you want to sign out?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Sign Out',
              style: 'destructive',
              onPress: async () => {
                try {
                  await AsyncStorage.clear();
                  console.log('AsyncStorage cleared.');
                  navigation.replace('login');
                } catch (error) {
                  console.error('Failed to clear AsyncStorage:', error);
                }
              }
            }
          ]
        );
      } else if (item.title === 'My Orders') {
        navigation.navigate('Orders');
      } else if (item.title === 'My Addresses') {
        await fetchSavedAddresses();
        setShowAddressModal(true);
      } else if (item.title === 'My Wishlist') {
        navigation.navigate('Wishlist');
      } else if (item.title === 'Help & Support') {
        setShowSupportModal(true); // Show support popup
      } else if (item.title === 'Settings') {
        navigation.navigate('Settings');
      } else if (item.title === 'Privacy Policy') {
        navigation.navigate('PrivacyPolicy');
      } else {
        console.log(`Pressed on ${item.title}`);
      }
    };

    return (
      <TouchableOpacity 
        style={styles.menuItem} 
        activeOpacity={0.7} 
        onPress={handlePress}
      >
        <View style={styles.menuItemLeft}>
          <View style={[styles.iconContainer, { backgroundColor: item.iconBgColor }]}>
            <IconComponent size={20} color={item.iconColor} />
          </View>
          <Text style={styles.menuItemTitle}>{item.title}</Text>
          {item.count !== undefined && item.count > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{item.count}</Text>
            </View>
          )}
        </View>
        <View style={styles.menuItemRight}>
          {item.rightText && (
            <Text style={styles.menuItemRightText}>{item.rightText}</Text>
          )}
          <ChevronRight size={18} color={COLORS.gray} />
        </View>
      </TouchableOpacity>
    );
  };

  // Render Support Modal
  const renderSupportModal = () => (
    <Modal
      visible={showSupportModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSupportModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.supportModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Help & Support</Text>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowSupportModal(false)}
            >
              <Text style={styles.closeModalText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.supportContent}>
            <HelpCircle size={60} color={COLORS.primary} style={styles.supportIcon} />
            
            <Text style={styles.supportMessage}>
              We're here to help you! Contact us through any of the following methods:
            </Text>
            
            {/* Email Section */}
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <Mail size={24} color={COLORS.primary} />
                <Text style={styles.contactTitle}>Email Support</Text>
              </View>
              <TouchableOpacity 
                style={styles.contactItem}
                onPress={handleEmail}
              >
                <Text style={styles.contactValue}>{supportInfo.email}</Text>
                <Text style={styles.contactAction}>Tap to email</Text>
              </TouchableOpacity>
            </View>
            
            {/* Phone Section */}
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <Phone size={24} color={COLORS.primary} />
                <Text style={styles.contactTitle}>Phone Support</Text>
              </View>
              <TouchableOpacity 
                style={styles.contactItem}
                onPress={handlePhoneCall}
              >
                <Text style={styles.contactValue}>{supportInfo.phone}</Text>
                <Text style={styles.contactAction}>Tap to call</Text>
              </TouchableOpacity>
              <Text style={styles.workingHours}>
                {supportInfo.workingHours}
              </Text>
            </View>
            
            {/* WhatsApp Section */}
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <MessageCircle size={24} color="#25D366" />
                <Text style={styles.contactTitle}>WhatsApp Support</Text>
              </View>
              <TouchableOpacity 
                style={styles.contactItem}
                onPress={handleWhatsApp}
              >
                <Text style={styles.contactValue}>{supportInfo.whatsapp}</Text>
                <Text style={styles.contactAction}>Tap to chat on WhatsApp</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.supportNote}>
              Our support team will respond to your query within 24 hours.
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowSupportModal(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Render Address Modal (simplified as before)
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
            <Text style={styles.modalTitle}>My Addresses</Text>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowAddressModal(false)}
            >
              <Text style={styles.closeModalText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.addressScrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.addressScrollContent}
          >
            {addresses.length > 0 ? (
              addresses.map((address, index) => (
                <View key={index} style={styles.addressItem}>
                  <View style={styles.addressHeader}>
                    <View style={styles.addressTypeContainer}>
                      {address.addressType === 'home' ? (
                        <Home size={16} color={COLORS.primary} />
                      ) : (
                        <Briefcase size={16} color={COLORS.secondary} />
                      )}
                      <Text style={styles.addressTypeText}>
                        {address.addressType || 'Address'}
                      </Text>
                    </View>
                    {address.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  
                  {address.name && (
                    <Text style={styles.addressName}>{address.name}</Text>
                  )}
                  
                  <Text style={styles.addressText}>
                    {address.fullAddress || address.address || 'No address provided'}
                  </Text>
                  
                  <View style={styles.addressDetails}>
                    {address.city && (
                      <Text style={styles.addressDetail}>
                        {address.city}
                        {address.state && `, ${address.state}`}
                      </Text>
                    )}
                    {address.pincode && (
                      <Text style={styles.addressDetail}>
                        PIN: {address.pincode}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.addressContact}>
                    {address.phone && (
                      <View style={styles.contactItem}>
                        <Phone size={14} color={COLORS.gray} />
                        <Text style={styles.contactText}>{address.phone}</Text>
                      </View>
                    )}
                    {address.email && (
                      <View style={styles.contactItem}>
                        <Mail size={14} color={COLORS.gray} />
                        <Text style={styles.contactText}>{address.email}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noAddressContainer}>
                <MapPin size={60} color={COLORS.lightGray} />
                <Text style={styles.noAddressesTitle}>No Addresses Found</Text>
                <Text style={styles.noAddressesText}>
                  No saved addresses found in your account
                </Text>
              </View>
            )}
          </ScrollView>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowAddressModal(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ChevronRight size={24} color={COLORS.white} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardBackground} />
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ 
                  uri: 'https://img.freepik.com/premium-vector/male-face-avatar-icon-set-flat-design-social-media-profiles_1281173-3806.jpg' 
                }}
                style={styles.avatar}
              />
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>
                {userData.name || 'Guest User'}
              </Text>
              <View style={styles.profileContact}>
                <Mail size={14} color={COLORS.textSecondary} />
                <Text style={styles.profileEmail}>
                  {userData.email || 'No email provided'}
                </Text>
              </View>
              {userData.phone && (
                <View style={styles.profileContact}>
                  <Phone size={14} color={COLORS.textSecondary} />
                  <Text style={styles.profilePhone}>
                    {userData.phone}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <MenuItem key={item.id} item={item} />
          ))}
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>App Version 1.0.0</Text>
          <Text style={styles.appCopyright}>© 2024 Your Company. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* Render Address Modal */}
      {renderAddressModal()}
      
      {/* Render Support Modal */}
      {renderSupportModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    margin: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileCardBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: COLORS.primaryLight,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.white,
    backgroundColor: COLORS.lightGray,
  },
  profileDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  profileContact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  profilePhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  menuContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemTitle: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  countText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemRightText: {
    fontSize: 14,
    color: COLORS.gray,
    marginRight: 8,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  appVersion: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 10,
    color: COLORS.lightGray,
  },
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  // Support Modal Styles
  supportModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  closeModalButton: {
    padding: 4,
  },
  closeModalText: {
    fontSize: 24,
    color: COLORS.gray,
  },
  supportContent: {
    padding: 20,
  },
  supportIcon: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  supportMessage: {
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  contactSection: {
    marginBottom: 24,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 12,
  },
  contactItem: {
    marginBottom: 8,
  },
  contactValue: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
  },
  contactAction: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  workingHours: {
    fontSize: 12,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 4,
  },
  supportNote: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  // Address Modal Styles
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
    elevation: 5,
  },
  addressScrollView: {
    maxHeight: 400,
  },
  addressScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  addressItem: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  defaultBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addressName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  addressDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  addressDetail: {
    fontSize: 13,
    color: COLORS.gray,
    marginRight: 12,
  },
  addressContact: {
    flexDirection: 'column',
    gap: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 8,
  },
  noAddressContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noAddressesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  noAddressesText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Profile;