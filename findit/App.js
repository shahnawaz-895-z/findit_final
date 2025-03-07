import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar, Dimensions } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomePage from './screens/Homepage.js';
import ReportFoundItem from './screens/ReportFoundItem';
import ReportLostItem from './screens/ReportLostItem';
import ShowFoundItemData from './screens/Showfounditemdata';
import ProfileScreen from './screens/ProfileScreen';
import ChatScreen from './screens/ChatScreen.js';
import SearchScreen from './screens/SearchScreen.js';
import ChatListScreen from './screens/ChatListScreen.js';
import MatchesScreen from './screens/MatchesScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import MatchDetailsScreen from './screens/MatchDetailsScreen';
import DashboardScreen from './screens/DashboardScreen';
import ActivityListScreen from './screens/ActivityListScreen';
import TipsScreen from './screens/TipsScreen';
import HelpScreen from './screens/HelpScreen';

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
  const [dimensions, setDimensions] = useState({
    window: Dimensions.get('window'),
    screen: Dimensions.get('screen'),
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window, screen }) => {
      setDimensions({ window, screen });
    });

    return () => subscription?.remove();
  }, []);

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
          <Stack.Screen 
            name="ProfileScreen" component={ProfileScreen} 
            options={{ headerShown: true, animationEnabled: true, gestureEnabled: true }} 
          />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="SearchScreen" component={SearchScreen} />
          <Stack.Screen name="ChatListScreen" component={ChatListScreen} />
          <Stack.Screen name="MatchesScreen" component={MatchesScreen} />
          <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
          <Stack.Screen name="MatchDetailsScreen" component={MatchDetailsScreen} />
          <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
          <Stack.Screen name="ActivityListScreen" component={ActivityListScreen} />
          <Stack.Screen name="TipsScreen" component={TipsScreen} />
          <Stack.Screen name="HelpScreen" component={HelpScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
