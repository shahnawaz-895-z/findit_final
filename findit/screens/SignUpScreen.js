import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const SignUpScreen = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [contact, setContact] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profileImage, setProfileImage] = useState(null);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access your photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setProfileImage(result.assets[0]);
        }
    };

    const handleSignUp = async () => {
        try {
            if (!name || !email || !contact || !password || !confirmPassword || !profileImage) {
                Alert.alert('Error', 'All fields including profile image are required');
                return;
            }
    
            if (password !== confirmPassword) {
                Alert.alert('Error', 'Passwords do not match');
                return;
            }
    
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('mobile', contact);
            formData.append('password', password);
            
            // Append image
            const imageUri = profileImage.uri;
            const filename = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image';
            
            formData.append('profileImage', {
                uri: imageUri,
                name: filename,
                type
            });
    
            // Log the form data to check what's being sent
            console.log('Form Data:', Object.fromEntries(formData._parts));
    
            const response = await fetch(`http://192.168.18.18:5000/register`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });
    
            // Log the raw response
            console.log('Raw response:', response);
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.status === 'success') {
                Alert.alert(
                    'Success',
                    'Registration successful!',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.navigate('Login')
                        }
                    ]
                );
            } else {
                Alert.alert('Error', data.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            Alert.alert('Error', 'Network request failed: ' + error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <View style={styles.formContainer}>
                    <Text style={styles.title}>Sign Up</Text>

                    <TouchableOpacity 
                        style={styles.imageContainer} 
                        onPress={pickImage}
                    >
                        {profileImage ? (
                            <Image 
                                source={{ uri: profileImage.uri }} 
                                style={styles.profileImage} 
                            />
                        ) : (
                            <View style={styles.placeholderImage}>
                                <Text>Tap to add profile photo</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TextInput
                        style={styles.input}
                        placeholder="Name"
                        value={name}
                        onChangeText={setName}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Contact"
                        value={contact}
                        onChangeText={setContact}
                        keyboardType="phone-pad"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity 
                        style={styles.signUpButton} 
                        onPress={handleSignUp}
                    >
                        <Text style={styles.signUpButtonText}>SIGN UP</Text>
                    </TouchableOpacity>

                    <View style={styles.signupContainer}>
                        <Text style={styles.signupText}>Already Have An Account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.signupLink}>Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    formContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 30,
        textAlign: 'center',
        color: '#3b0b40',
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    placeholderImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 15,
        marginBottom: 20,
        borderRadius: 25,
        fontSize: 16,
        backgroundColor: '#f8f8f8',
    },
    signUpButton: {
        backgroundColor: '#3b0b40',
        padding: 15,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 10,
    },
    signUpButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    signupText: {
        color: '#333',
    },
    signupLink: {
        color: '#3b0b40',
        marginLeft: 5,
        fontWeight: 'bold',
    },
});

export default SignUpScreen;