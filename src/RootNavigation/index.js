import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import SplashScreen from '../Screen/SplashScreen';
import BottomTabNavigator from './BottomNavigator';
import ProductsPage from '../Screen/Products';
import LoginScreen from '../Screen/login';
import OrdersScreen from '../Screen/Orders';
import OrderConfirmation from '../Screen/Orders/OrderConfirmation';
const Stack = createNativeStackNavigator();
const RootNavigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={BottomTabNavigator} options={{ headerShown: false }} />
        {/* <Stack.Screen name="ProductsPage" component={Produc} options={{ headerShown: false }} /> */}
         <Stack.Screen name="ProductsPage" component={ProductsPage} options={{ headerShown: false }} />
         <Stack.Screen name="login" component={LoginScreen} options={{ headerShown: false }} />
         <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
              <Stack.Screen 
          name="OrderConfirmation" 
          component={OrderConfirmation} 
          options={{ 
            headerShown: false,
            presentation: 'modal', 
          }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
export default RootNavigation;