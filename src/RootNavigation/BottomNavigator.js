import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../Screen/Home';
import Cart from '../Screen/Cart';
import Shop from '../Screen/Shop';
import Profile from '../Screen/Profile';
import LoginScreen from '../Screen/login';
import Theme from '../Config/Theme';
import { useSelector } from 'react-redux';

// Lucide React Icons
import { Home as HomeIcon, ShoppingCart, User, LayoutGrid, Box } from 'lucide-react-native';
import ProductsPage from '../Screen/Products';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
const [userData, setUserData] = useState({});
  // Redux state को सही तरीके से access करें
  const cartCount = useSelector((state) => state.app?.data?.length || 0);

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

useEffect(() => {
  fetchUserData();
}, []);

  
  // const isUserLoggedIn = !!userData; // userData होने पर true

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabelStyle: {
          fontFamily: Theme.FontFamily.Medium,
        },
        tabBarActiveTintColor: Theme.PrimaryColor,
        tabBarIcon: ({ focused, color, size }) => {
          let IconComponent;

          switch (route.name) {
            case 'Home':
              IconComponent = HomeIcon;
              break;
            case 'Category':
              IconComponent = LayoutGrid;
              break;
            case 'Cart':
              IconComponent = ShoppingCart;
              break;
            case 'Profile':
              IconComponent = User;
              break;
            case 'Login':
              IconComponent = User;
              break;  
          }

          return <IconComponent color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Category" component={Shop} />
      <Tab.Screen 
        name="Products" 
        component={ProductsPage} 
        options={{ 
          tabBarLabel: 'Products', 
          tabBarIcon: ({ color, size }) => <Box color={color} size={size} /> 
        }} 
      />
      <Tab.Screen
        name="Cart"
        component={Cart}
        options={{
          tabBarBadge: cartCount > 0 ? cartCount : null,
        }}
      />
      
      {/* Conditionally render Profile tab */}
    {userData?.name ? (
  <Tab.Screen name="Profile" component={Profile} />
) : (
  <Tab.Screen name="Login" component={LoginScreen} />
)}
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;