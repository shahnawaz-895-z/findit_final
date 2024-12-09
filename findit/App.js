import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StatusBar } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomePage from './screens/homepage';
import ReportFoundItem from './screens/ReportFoundItem';
//import SearchScreen from './screens/SearchScreen';
//import MessagesScreen from './screens/MessagesScreen';
//import ProfileUpdateScreen from './screens/ProfileUpdateScreen';

const Stack = createStackNavigator();

const screenOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: '#fff' },
  cardStyleInterpolator: ({ current: { progress } }) => ({
    cardStyle: {
      opacity: progress
    }
  })
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
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={screenOptions}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              animationEnabled: true,
              gestureEnabled: true
            }}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{
              animationEnabled: true,
              gestureEnabled: true
            }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              animationEnabled: true,
              gestureEnabled: true
            }}
          />
          <Stack.Screen
            name="HomePage"
            component={HomePage}
            options={{
              animationEnabled: true,
              gestureEnabled: false
            }}
          />
          <Stack.Screen
            name="ReportFoundItem"
            component={ReportFoundItem}
            options={{
              animationEnabled: true,
              gestureEnabled: true
            }}
          />
          
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}