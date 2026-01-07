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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  ShoppingCart,
  Globe,
  Package,
  Link,
  MapPin,
  MessageCircle,
  LogOut,
  ChevronRight,
  Edit,
  Bell
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
    import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../Components/AxiosInstance';
    


const Profile = () => {
  const insets = useSafeAreaInsets();
  const windowWidth = Dimensions.get('window').width;
  const navigation = useNavigation();
  const [orderCount, setOrderCount] = useState(0);

  const [userData, setUserData] = useState({
  name: '',
  email: '',
  id: '',
});

useEffect(() => {
  const fetchUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser !== null) {
        const parsedUser = JSON.parse(storedUser);
        setUserData({
          name: parsedUser.name || '',
          email: parsedUser.email || '',
          id: parsedUser._id || '',  // Make sure `id` exists
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  fetchUserData();
}, []);


 useEffect(() => {
  if (userData.id) {
    fetchUserOrders(userData.id);
  }
}, [userData.id]);

const fetchUserOrders = async (userId) => {
  try {
    const response = await axiosInstance.get(`/api/orders/${userId}`);
    const orders = response?.data?.orders || [];
    setOrderCount(orders?.length); // Set total count
  } catch (error) {
    console.error('Error fetching orders:', error);
  }
};


  
  // Menu items data with Lucide icon names
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
    
    {
      id: 4,
      title: 'My Addresses',
      icon: MapPin,
      iconBgColor: '#FFEFD5',
      iconColor: '#FFA500',
    },

    {
      id: 6,
      title: 'Sign Out',
      icon: LogOut,
      iconBgColor: '#FFCCCB',
      iconColor: '#DC143C',
    },
  ];

  // Menu item component
  const MenuItem = ({ item }) => {
    const IconComponent = item.icon;


const handlePress = async () => {
  if (item.title === 'Sign Out') {
    try {
      await AsyncStorage.clear();
      console.log('AsyncStorage cleared.');
      navigation.replace('login');
    } catch (error) {
      console.error('Failed to clear AsyncStorage:', error);
    }
  } else if (item.title === 'My Orders') {
    navigation.navigate('Orders'); 
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
        </View>
        <View style={styles.menuItemRight}>
          {item.rightText && (
            <Text style={styles.menuItemRightText}>{item.rightText}</Text>
          )}
          <ChevronRight size={18} color="#CCCCCC" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#6366F1" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
     
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardBackground} />
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: 'https://img.freepik.com/premium-vector/male-face-avatar-icon-set-flat-design-social-media-profiles_1281173-3806.jpg?semt=ais_hybrid&w=740' }}
                style={styles.avatar}
              />
             
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{userData.name}</Text>
<Text style={styles.profileEmail}>{userData.email}</Text>

              <Text style={styles.profilePhone}>{userData?.phone || 'XXXXXXXXXX'}</Text>
            </View>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={styles.statItem}>
  <Text style={styles.statNumber}>{orderCount}</Text>
  <Text style={styles.statLabel}>Orders</Text>
</View>

            </View>
            <View style={styles.statDivider} />
            {/* <View style={styles.statItem}>
              <Text style={styles.statNumber}>4</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </View> */}
            <View style={styles.statDivider} />
            {/* <View style={styles.statItem}>
              <Text style={styles.statNumber}>2</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View> */}
          </View>
        </View>
        
        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <React.Fragment key={item.id}>
              <MenuItem item={item} />
              {index !== menuItems.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>
        
        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>App Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginVertical: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileCardBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#FF7F1A',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 30,
  },
  avatarContainer: {
    marginRight: 16,
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileDetails: {
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'black',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
    color: 'black',
  },
  statsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#F0F0F0',
    alignSelf: 'center',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#333333',
    fontWeight: '500',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemRightText: {
    fontSize: 14,
    color: '#888888',
    marginRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 12,
    color: '#888888',
  },
});

export default Profile;