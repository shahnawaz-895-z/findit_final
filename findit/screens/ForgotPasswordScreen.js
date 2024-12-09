// ForgotPasswordScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

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
    padding: 20,
    backgroundColor: '#fff',
  },
  backIcon: {
    position: 'absolute',
    top: 40,
    left: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 20,
    borderRadius: 50,
    paddingLeft: 40,
    fontSize: 16,
  },
  icon: {
    position: 'absolute',
    right: 40,
    top: 135, // Adjust this based on input position
  },
  sendButton: {
    backgroundColor: '#3b0b40',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ForgotPasswordScreen;
