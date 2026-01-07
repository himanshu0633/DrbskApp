import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../Screen/Home';
import Cart from '../Screen/Cart';
import Shop from '../Screen/Shop';
import Profile from '../Screen/Profile/index';
import { Text } from 'react-native';
import Theme from '../Config/Theme';
import { useSelector } from 'react-redux';


// Lucide React Icons
import { Home as HomeIcon, ShoppingCart, User, LayoutGrid, ArrowRight, Box } from 'lucide-react-native';
import ProductsPage from '../Screen/Products';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  const cartCount = useSelector((state) => state.app.data.length);

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
    tabBarBadge: cartCount > 0 ? cartCount : null, // Hide badge if count is 0
  }}
/>

      <Tab.Screen name="Profile" component={Profile} />
      
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
