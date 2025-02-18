import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Sending login request with:', { email, password: '****' });
      
      const response = await fetch('http://192.168.18.18:5000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Login Response Status:', response.status);
      const responseText = await response.text();
      console.log('Raw Response:', responseText);
      
      // Try to parse the JSON response, but handle potential errors
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        Alert.alert('Error', 'Received invalid response from server');
        return;
      }
      
      console.log('Parsed Response:', data);

      if (response.status === 200 && data.user) {
        // Save user data to AsyncStorage
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));
        
        Alert.alert('Success', 'Login successful');
        navigation.reset({
          index: 0,
          routes: [{ name: 'HomePage' }],
        });
      } else {
        // Handle different error scenarios
        const errorMessage = data.message || 'Invalid credentials';
        Alert.alert('Login Failed', errorMessage);
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Network Error', 'Unable to connect to the server. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>

      <View style={styles.inputContainer}>
        <Icon name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Icon name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.forgotPassword}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.signInButton, isLoading && styles.disabledButton]} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.signInButtonText}>SIGN IN</Text>
        )}
      </TouchableOpacity>

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't Have An Account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.signupLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.socialIconsContainer}>
        <Icon name="logo-facebook" size={35} color="blue" style={styles.socialIcon} />
        <Icon name="logo-twitter" size={35} color="#1DA1F2" style={styles.socialIcon} />
        <Icon name="logo-google" size={35} color="red" style={styles.socialIcon} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#3b0b40',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 50,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 10,
    paddingLeft: 5,
  },
  input: {
    flex: 1,
    padding: 10,
    fontSize: 16,
  },
  forgotPassword: {
    color: '#3b0b40',
    textAlign: 'right',
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: '#3b0b40',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#9a8a9a',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  signupText: {
    color: '#333',
  },
  signupLink: {
    color: '#3b0b40',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  socialIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  socialIcon: {
    marginHorizontal: 10,
  },
});

export default LoginScreen;