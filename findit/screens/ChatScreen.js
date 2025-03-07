import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    TouchableOpacity,
    Text,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send, Composer } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Get screen dimensions and handle orientation changes
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_URL = 'http://192.168.18.18';
const API_URL = `${BASE_URL}:5000`;
const BACKUP_API_URL = `${BASE_URL}:5001`;

// Calculate responsive sizes
const scale = SCREEN_WIDTH / 375; // 375 is standard width
const normalize = (size) => Math.round(size * scale);

const ChatScreen = ({ route, navigation }) => {
    const user = useMemo(() => route.params?.user || {
        id: '0',
        name: 'Unknown Contact',
        avatar: null
    }, [route.params?.user]);

    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [serverUrl, setServerUrl] = useState(API_URL);

    // Check which server is available
    useEffect(() => {
        const checkServer = async () => {
            try {
                await axios.get(`${API_URL}/api-test`);
                setServerUrl(API_URL);
                console.log('Using primary server:', API_URL);
            } catch (error) {
                console.log('Primary server unavailable, trying backup server');
                try {
                    await axios.get(`${BACKUP_API_URL}/api-test`);
                    setServerUrl(BACKUP_API_URL);
                    console.log('Using backup server:', BACKUP_API_URL);
                } catch (backupError) {
                    console.error('Both servers unavailable:', backupError);
                    setError('Server connection failed. Please try again later.');
                }
            }
        };
        
        checkServer();
    }, []);

    // Fetch current user ID from AsyncStorage
    useEffect(() => {
        const getCurrentUserId = async () => {
            try {
                const userData = await AsyncStorage.getItem('userData');
                console.log('User data from AsyncStorage:', userData);
                
                if (userData) {
                    const parsedUserData = JSON.parse(userData);
                    console.log('Parsed user data:', parsedUserData);
                    
                    // Use _id if available, otherwise use id
                    const userId = parsedUserData._id || parsedUserData.id;
                    console.log('Using user ID:', userId);
                    
                    setCurrentUserId(userId);
                } else {
                    // If no user data, use a default ID (this should be handled better in a real app)
                    console.warn('No user data found, using default ID');
                    setCurrentUserId('1');
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                // Fallback to default ID
                setCurrentUserId('1');
            }
        };

        getCurrentUserId();
    }, []);

    // Fetch message history when both user IDs are available
    useEffect(() => {
        if (!currentUserId || !user.id) return;

        console.log('Fetching messages between', currentUserId, 'and', user.id);

        const fetchMessages = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${serverUrl}/api/messages/${currentUserId}/${user.id}`);
                console.log('Messages API response:', response.data);
                
                if (response.data && Array.isArray(response.data)) {
                    // Format messages for GiftedChat if needed
                    const formattedMessages = response.data.map(msg => ({
                        ...msg,
                        user: {
                            _id: msg.user._id,
                            name: msg.user._id === currentUserId ? 'You' : user.name,
                            avatar: msg.user._id === currentUserId ? null : user.avatar
                        }
                    }));
                    
                    // Sort messages by createdAt in descending order (newest first)
                    // GiftedChat expects messages sorted this way
                    formattedMessages.sort((a, b) => {
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    });
                    
                    setMessages(formattedMessages);
                }
                setError(null);
            } catch (error) {
                console.error('Error fetching messages:', error);
                setError('Failed to load message history');
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [currentUserId, user.id, user.name, user.avatar, serverUrl]);

    // Set up Socket.IO connection
    useEffect(() => {
        if (!currentUserId) return;

        console.log('Setting up Socket.IO connection for user', currentUserId);

        // Connect to the Socket.IO server
        const newSocket = io(serverUrl);
        setSocket(newSocket);

        // Join the room with the current user's ID
        newSocket.emit('joinRoom', currentUserId);
        console.log('Joined room:', currentUserId);

        // Listen for incoming messages
        newSocket.on('receiveMessage', (message) => {
            console.log('Received message via Socket.IO:', message);
            
            // Only add the message if it's from the current chat partner
            if (message.senderId === user.id) {
                const newMessage = {
                    _id: message._id || Math.random().toString(),
                    text: message.text,
                    createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
                    user: {
                        _id: message.senderId,
                        name: user.name,
                        avatar: user.avatar // Always use the user's avatar for their messages
                    },
                };
                
                // Add the new message to the existing messages
                // GiftedChat.append puts the new message at the beginning of the array
                // which is correct for inverted={true}
                setMessages(previousMessages => GiftedChat.append(previousMessages, [newMessage]));
            }
        });

        return () => {
            console.log('Disconnecting Socket.IO');
            newSocket.disconnect();
        };
    }, [currentUserId, user.id, user.name, user.avatar, serverUrl]);

    const onSend = useCallback((newMessages = []) => {
        if (!currentUserId || !socket) {
            console.error('Cannot send message: currentUserId or socket is missing');
            return;
        }

        console.log('Sending message to', user.id, 'from', currentUserId);
        console.log('Message content:', newMessages[0].text);

        // Format the message for GiftedChat
        const giftedMessage = {
            _id: Math.random().toString(),
            text: newMessages[0].text,
            createdAt: new Date(),
            user: {
                _id: currentUserId,
                name: 'You',
                // Don't set avatar for current user's messages
            }
        };

        // Add the message to the local state
        // GiftedChat.append puts the new message at the beginning of the array
        // which is correct for inverted={true}
        setMessages(previousMessages => GiftedChat.append(previousMessages, [giftedMessage]));

        // Use only one method to send the message - either API or Socket.IO, not both
        // We'll use the API method as it's more reliable
        axios.post(`${serverUrl}/api/messages`, {
            receiverId: user.id,
            senderId: currentUserId,
            text: newMessages[0].text,
        })
        .then(response => {
            console.log('Message saved via API:', response.data);
            
            // No need to also send via Socket.IO - the backend will handle that
            // socket.emit('sendMessage', {
            //     receiverId: user.id,
            //     senderId: currentUserId,
            //     text: newMessages[0].text,
            // });
            
            // Remove the automatic navigation back to chat list
            // setTimeout(() => {
            //     navigation.navigate('ChatListScreen');
            // }, 1000);
        })
        .catch(error => {
            console.error('Error saving message via API:', error);
            
            // If API fails, try Socket.IO as fallback
            socket.emit('sendMessage', {
                receiverId: user.id,
                senderId: currentUserId,
                text: newMessages[0].text,
            });
            
            // Show an error alert
            Alert.alert(
                'Message Status',
                'Your message might not have been saved. Please check your connection.',
                [{ text: 'OK' }]
            );
        });
        
        console.log('Message sending process initiated');
    }, [socket, user.id, currentUserId, navigation, serverUrl]);

    if (loading && messages.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b0b40" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor="#3b0b40" barStyle="light-content" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 90}
            >
                <View style={styles.header}>
                    <TouchableOpacity 
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={normalize(24)} color="#3b0b40" />
                    </TouchableOpacity>
                    <View style={styles.headerUserInfo}>
                        {user.avatar ? (
                            <Image
                                source={{ uri: user.avatar }}
                                style={styles.headerAvatar}
                            />
                        ) : (
                            <View style={styles.placeholderAvatar}>
                                <Text style={styles.avatarText}>
                                    {user.name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.headerTitle} numberOfLines={1}>{user.name}</Text>
                    </View>
                </View>

                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <GiftedChat
                    messages={messages}
                    onSend={messages => onSend(messages)}
                    user={{ _id: currentUserId }}
                    renderBubble={(props) => (
                        <Bubble
                            {...props}
                            wrapperStyle={{
                                right: { backgroundColor: '#3b0b40' },
                                left: { backgroundColor: '#f0f0f0' },
                            }}
                            textStyle={{
                                right: { color: '#fff' },
                                left: { color: '#000' }
                            }}
                        />
                    )}
                    renderInputToolbar={(props) => (
                        <InputToolbar
                            {...props}
                            containerStyle={styles.inputToolbar}
                        />
                    )}
                    renderComposer={(props) => (
                        <Composer
                            {...props}
                            textInputStyle={styles.composer}
                        />
                    )}
                    renderSend={(props) => (
                        <Send {...props} containerStyle={styles.sendContainer}>
                            <View style={styles.sendButton}>
                                <Ionicons name="send" size={normalize(24)} color="#3b0b40" />
                            </View>
                        </Send>
                    )}
                    renderLoading={() => (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3b0b40" />
                        </View>
                    )}
                    renderAvatar={(props) => {
                        // Only show avatar for other user's messages
                        if (props.currentMessage.user._id !== currentUserId) {
                            return (
                                <View style={styles.avatarContainer}>
                                    {props.currentMessage.user.avatar ? (
                                        <Image
                                            source={{ uri: props.currentMessage.user.avatar }}
                                            style={styles.messageAvatar}
                                        />
                                    ) : (
                                        <View style={styles.placeholderMessageAvatar}>
                                            <Text style={styles.avatarText}>
                                                {props.currentMessage.user.name.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        }
                        return null;
                    }}
                    inverted={true}
                    infiniteScroll
                    alwaysShowSend
                    scrollToBottom
                    showUserAvatar
                    renderAvatarOnTop
                    minInputToolbarHeight={normalize(50)}
                    bottomOffset={Platform.OS === 'ios' ? normalize(30) : 0}
                    listViewProps={{
                        style: { backgroundColor: '#fff' },
                        contentContainerStyle: { paddingBottom: normalize(10) }
                    }}
                    timeTextStyle={{
                        right: { color: '#ddd' },
                        left: { color: '#777' }
                    }}
                    dateFormat="MMM D, YYYY"
                    textInputProps={{
                        placeholder: "Type a message...",
                        placeholderTextColor: "#999",
                        multiline: true,
                        maxHeight: normalize(100),
                        style: styles.textInput
                    }}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: normalize(12),
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    backButton: {
        padding: normalize(5),
    },
    headerUserInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: normalize(10),
    },
    headerAvatar: {
        width: normalize(40),
        height: normalize(40),
        borderRadius: normalize(20),
        marginRight: normalize(10),
    },
    placeholderAvatar: {
        width: normalize(40),
        height: normalize(40),
        borderRadius: normalize(20),
        backgroundColor: '#3b0b40',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: normalize(10),
    },
    avatarText: {
        color: '#fff',
        fontSize: normalize(16),
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: normalize(18),
        fontWeight: 'bold',
        color: '#3b0b40',
        flex: 1,
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: normalize(5),
        marginRight: normalize(5),
        width: normalize(36),
        height: normalize(36),
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        padding: normalize(15),
        backgroundColor: '#ffeeee',
        borderRadius: normalize(5),
        margin: normalize(15),
    },
    errorText: {
        color: '#cc0000',
        textAlign: 'center',
        fontSize: normalize(14),
    },
    avatarContainer: {
        width: normalize(36),
        height: normalize(36),
        borderRadius: normalize(18),
        marginRight: normalize(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageAvatar: {
        width: normalize(36),
        height: normalize(36),
        borderRadius: normalize(18),
    },
    placeholderMessageAvatar: {
        width: normalize(36),
        height: normalize(36),
        borderRadius: normalize(18),
        backgroundColor: '#3b0b40',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputToolbar: {
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
        paddingHorizontal: normalize(8),
        paddingVertical: normalize(5),
    },
    composer: {
        backgroundColor: '#f5f5f5',
        borderRadius: normalize(20),
        paddingHorizontal: normalize(12),
        paddingTop: normalize(8),
        paddingBottom: normalize(8),
        marginLeft: normalize(5),
        fontSize: normalize(16),
        lineHeight: normalize(20),
        maxHeight: normalize(100),
    },
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
        marginRight: 0,
    },
    textInput: {
        fontSize: normalize(16),
        lineHeight: normalize(20),
        marginTop: Platform.OS === 'ios' ? 0 : normalize(5),
    }
});

export default ChatScreen;