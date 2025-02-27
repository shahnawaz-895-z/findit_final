// ForgotPasswordScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isValidEmail, setIsValidEmail] = useState(false);

  const validateEmail = (text) => {
    setEmail(text);
    const emailRegex = /\S+@\S+\.\S+/;
    setIsValidEmail(emailRegex.test(text));
  };

  const handleSend = () => {
    // Forgot password logic (e.g., send email to reset password)
    console.log('Reset password for:', email);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back-outline" size={24} color="black" style={styles.backIcon} />
      </TouchableOpacity>

      <Text style={styles.title}>Forgot password</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={validateEmail}
        keyboardType="email-address"
      />
      {isValidEmail ? (
        <Icon name="checkmark-circle-outline" size={20} color="green" style={styles.icon} />
      ) : (
        email && <Icon name="close-circle-outline" size={20} color="red" style={styles.icon} />
      )}

      <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
        <Text style={styles.sendButtonText}>SEND</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: width * 0.05,
    backgroundColor: '#fff',
  },
  backIcon: {
    position: 'absolute',
    top: height * 0.05,
    left: width * 0.05,
  },
  title: {
    fontSize: width * 0.07,
    fontWeight: 'bold',
    marginBottom: height * 0.04,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: height * 0.015,
    marginBottom: height * 0.025,
    borderRadius: width * 0.12,
    paddingLeft: width * 0.1,
    fontSize: width * 0.04,
  },
  icon: {
    position: 'absolute',
    right: width * 0.1,
    top: height * 0.17,
  },
  sendButton: {
    backgroundColor: '#3b0b40',
    padding: height * 0.02,
    borderRadius: width * 0.075,
    alignItems: 'center',
    marginTop: height * 0.025,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: width * 0.045,
    fontWeight: 'bold',
  },
});

export default ForgotPasswordScreen;
