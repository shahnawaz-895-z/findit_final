import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomePage from './screens/Homepage.js';
import ReportFoundItem from './screens/ReportFoundItem';
import ReportLostItem from './screens/ReportLostItem';
import ShowFoundItemData from './screens/Showfounditemdata';
import LostItemReporting from './screens/LostItemReporting.js';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createStackNavigator();

const screenOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: '#fff' },
  cardStyleInterpolator: ({ current: { progress } }) => ({
    cardStyle: {
      opacity: progress,
    },
  }),
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#fff"
          translucent={true}
        />
        <Stack.Navigator initialRouteName="Login" screenOptions={screenOptions}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="HomePage" component={HomePage} />
          <Stack.Screen name="ReportFoundItem" component={ReportFoundItem} />
          <Stack.Screen name="ReportLostItem" component={ReportLostItem} />
          <Stack.Screen name="ShowFoundItemData" component={ShowFoundItemData} />
          <Stack.Screen name="LostItemReporting" component={LostItemReporting} />
          <Stack.Screen 
            name="ProfileScreen" component={ProfileScreen} 
            options={{ animationEnabled: true, gestureEnabled: true }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
