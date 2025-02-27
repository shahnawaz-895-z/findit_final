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
    Image,
    ActivityIndicator,
    ScrollView,
    Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

const SignUpScreen = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [contact, setContact] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isFormSubmitted, setIsFormSubmitted] = useState(false);

    const pickImage = async () => {
        try {
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
                allowsMultipleSelection: false,
                exif: false,
            });

            if (!result.canceled) {
                const selectedImage = result.assets[0];
                const fileInfo = await FileSystem.getInfoAsync(selectedImage.uri);
                
                if (fileInfo.size > 5 * 1024 * 1024) {
                    Alert.alert('Image too large', 'Please select an image smaller than 5MB');
                    return;
                }
                
                setProfileImage(selectedImage);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to select image');
        }
    };

    const handleSignUp = async () => {
        // Prevent duplicate submissions
        if (isUploading || isFormSubmitted) {
            return;
        }
        
        try {
            setIsUploading(true);
            setIsFormSubmitted(true);
            
            // Validate inputs
            if (!name || !email || !contact || !password || !confirmPassword) {
                Alert.alert('Error', 'All fields are required');
                setIsUploading(false);
                setIsFormSubmitted(false);
                return;
            }
            
            if (!profileImage) {
                Alert.alert('Error', 'Please select a profile image');
                setIsUploading(false);
                setIsFormSubmitted(false);
                return;
            }
    
            if (password !== confirmPassword) {
                Alert.alert('Error', 'Passwords do not match');
                setIsUploading(false);
                setIsFormSubmitted(false);
                return;
            }
    
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('mobile', contact);
            formData.append('password', password);
            
            // Process and append image
            const imageUri = profileImage.uri;
            const filename = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename?.toLowerCase());
            
            let type;
            if (match) {
                switch (match[1]) {
                    case 'jpg':
                    case 'jpeg':
                        type = 'image/jpeg';
                        break;
                    case 'png':
                        type = 'image/png';
                        break;
                    case 'gif':
                        type = 'image/gif';
                        break;
                    case 'webp':
                        type = 'image/webp';
                        break;
                    case 'heic':
                        type = 'image/heic';
                        break;
                    default:
                        type = 'image/jpeg';
                }
            } else {
                type = profileImage.type || 'image/jpeg';
            }
            
            formData.append('profileImage', {
                uri: imageUri,
                name: filename || `profile.${type.split('/')[1]}`,
                type
            });
    
            console.log('Sending registration request...');
            
            const response = await fetch('http://192.168.18.18:5000/register', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });
    
            console.log('Response status:', response.status);
            
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
        } finally {
            setIsUploading(false);
            setIsFormSubmitted(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Sign Up</Text>

                        <TouchableOpacity 
                            style={styles.imageContainer} 
                            onPress={pickImage}
                            disabled={isUploading}
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
                            editable={!isUploading}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            editable={!isUploading}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Contact"
                            value={contact}
                            onChangeText={setContact}
                            keyboardType="phone-pad"
                            editable={!isUploading}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            editable={!isUploading}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            editable={!isUploading}
                        />

                        <TouchableOpacity 
                            style={[styles.signUpButton, (isUploading || isFormSubmitted) && styles.disabledButton]} 
                            onPress={handleSignUp}
                            disabled={isUploading || isFormSubmitted}
                        >
                            {isUploading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.signUpButtonText}>SIGN UP</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.signupContainer}>
                            <Text style={styles.signupText}>Already Have An Account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isUploading}>
                                <Text style={styles.signupLink}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    formContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: width * 0.05,
    },
    title: {
        fontSize: width * 0.08,
        fontWeight: 'bold',
        marginBottom: height * 0.04,
        textAlign: 'center',
        color: '#3b0b40',
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: height * 0.025,
    },
    profileImage: {
        width: width * 0.3,
        height: width * 0.3,
        borderRadius: width * 0.15,
    },
    placeholderImage: {
        width: width * 0.3,
        height: width * 0.3,
        borderRadius: width * 0.15,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: height * 0.02,
        marginBottom: height * 0.02,
        borderRadius: width * 0.06,
        fontSize: width * 0.04,
        backgroundColor: '#f8f8f8',
    },
    signUpButton: {
        backgroundColor: '#3b0b40',
        padding: height * 0.02,
        borderRadius: width * 0.06,
        alignItems: 'center',
        marginTop: height * 0.015,
    },
    disabledButton: {
        backgroundColor: '#9a8a9a',
    },
    signUpButtonText: {
        color: '#fff',
        fontSize: width * 0.045,
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