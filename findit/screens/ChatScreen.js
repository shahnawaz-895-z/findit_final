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
    StatusBar,
    Linking
} from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send, Composer } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_CONFIG from '../config';

// Get screen dimensions and handle orientation changes
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate responsive sizes
const scale = SCREEN_WIDTH / 375; // 375 is standard width
const normalize = (size) => Math.round(size * scale);

// Create a regular function instead of using hooks outside the component
const createApiClient = (baseUrl) => {
    return axios.create({
        baseURL: baseUrl,
        timeout: 15000,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

const ChatScreen = ({ route, navigation }) => {
    // Extract otherUserId, matchId, and userName from route params
    const otherUserId = route.params?.otherUserId;
    const matchId = route.params?.matchId;
    const matchData = route.params?.match;
    
    // Create a user object from the route params
    const user = useMemo(() => {
        // If we have a user object directly, use it
        if (route.params?.user) {
            console.log('Using provided user object:', route.params.user);
            return route.params.user;
        }
        
        // Otherwise create a user object from the other parameters
        const userName = route.params?.userName || 'Unknown Contact';
        console.log('Creating user object with name:', userName);
        return {
            id: otherUserId || '0',
            _id: otherUserId || '0', // Include both formats for compatibility
            name: userName,
            avatar: null
        };
    }, [route.params?.user, otherUserId, route.params?.userName]);

    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [serverUrl, setServerUrl] = useState(API_CONFIG.API_URL);
    
    // Create a memoized API client that updates when serverUrl changes
    const apiClient = useMemo(() => createApiClient(serverUrl), [serverUrl]);

    // Check which server is available - optimized with useCallback
    const checkServer = useCallback(async () => {
        try {
            await axios.get(`${API_CONFIG.API_URL}/api-test`);
            setServerUrl(API_CONFIG.API_URL);
        } catch (error) {
            try {
                await axios.get(`${API_CONFIG.BACKUP_API_URL}/api-test`);
                setServerUrl(API_CONFIG.BACKUP_API_URL);
            } catch (backupError) {
                setError('Server connection failed. Please try again later.');
            }
        }
    }, []);

    // Run server check once on mount
    useEffect(() => {
        checkServer();
    }, [checkServer]);

    // Fetch current user ID from AsyncStorage - optimized with useCallback
    const getCurrentUserId = useCallback(async () => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            
            if (userData) {
                const parsedUserData = JSON.parse(userData);
                // Use _id if available, otherwise use id
                const userId = parsedUserData._id || parsedUserData.id;
                setCurrentUserId(userId);
                return userId;
            } else {
                // If no user data, use a default ID (this should be handled better in a real app)
                setCurrentUserId('1');
                return '1';
            }
        } catch (error) {
            // Fallback to default ID
            setCurrentUserId('1');
            return '1';
        }
    }, []);

    // Run getCurrentUserId once on mount
    useEffect(() => {
        getCurrentUserId();
    }, [getCurrentUserId]);

    // Fetch message history when both user IDs are available - optimized with useCallback
    const fetchMessages = useCallback(async () => {
        if (!currentUserId || (!user.id && !otherUserId)) return;
        
        const chatPartnerId = otherUserId || user.id;
        
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const response = await apiClient.get(
                `/api/messages/${currentUserId}/${chatPartnerId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            
            // Handle the new response format
            if (response.data && response.data.status === 'success' && Array.isArray(response.data.messages)) {
                // Format messages for GiftedChat
                const formattedMessages = response.data.messages.map(msg => ({
                    ...msg,
                    user: {
                        _id: msg.user._id,
                        name: msg.user._id === currentUserId ? 'You' : user.name,
                        avatar: msg.user._id === currentUserId ? null : user.avatar
                    },
                    // Ensure createdAt is a Date object
                    createdAt: new Date(msg.createdAt)
                }));

                // Reverse the order for GiftedChat if needed
                // GiftedChat expects newest messages first
                formattedMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                setMessages(formattedMessages);
            } else if (response.data && Array.isArray(response.data)) {
                // Handle old format for backward compatibility
                const formattedMessages = response.data.map(msg => ({
                    ...msg,
                    user: {
                        _id: msg.user._id,
                        name: msg.user._id === currentUserId ? 'You' : user.name,
                        avatar: msg.user._id === currentUserId ? null : user.avatar
                    },
                    createdAt: new Date(msg.createdAt)
                }));

                formattedMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setMessages(formattedMessages);
            } else {
                setMessages([]);
            }

            setError(null);
        } catch (error) {
            setError('Failed to load message history');
        } finally {
            setLoading(false);
        }
    }, [currentUserId, user, otherUserId, apiClient]);

    // Run fetchMessages when dependencies change
    useEffect(() => {
        if (currentUserId && (user.id || otherUserId)) {
            fetchMessages();
        }
    }, [fetchMessages, currentUserId, user.id, otherUserId]);

    // Setup Socket.IO connection - optimized with useCallback
    const setupSocketConnection = useCallback(() => {
        if (!currentUserId) return;
        
        // Connect to the Socket.IO server
        const newSocket = io(serverUrl);
        setSocket(newSocket);

        // Join the room with the current user's ID
        newSocket.emit('joinRoom', currentUserId);
        
        // Get the chat partner ID
        const chatPartnerId = otherUserId || user.id;

        // Listen for incoming messages
        newSocket.on('receiveMessage', (message) => {
            // Only add the message if it's from the current chat partner
            if (message.senderId === chatPartnerId) {
                const newMessage = {
                    _id: message._id || Math.random().toString(),
                    text: message.text,
                    createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
                    user: {
                        _id: message.senderId,
                        name: user.name,
                        avatar: user.avatar
                    },
                };

                // Add the new message to the existing messages
                setMessages(previousMessages => GiftedChat.append(previousMessages, [newMessage]));
            }
        });
        
        return newSocket;
    }, [currentUserId, user, otherUserId, serverUrl]);

    // Setup and cleanup socket connection
    useEffect(() => {
        const newSocket = setupSocketConnection();
        
        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [setupSocketConnection]);

    // Send message - optimized with useCallback
    const onSend = useCallback((newMessages = []) => {
        if (!currentUserId || !socket) {
            return;
        }

        const chatPartnerId = otherUserId || user.id;
        
        // Format the message for GiftedChat
        const giftedMessage = {
            _id: Math.random().toString(),
            text: newMessages[0].text,
            createdAt: new Date(),
            user: {
                _id: currentUserId,
                name: 'You',
            }
        };

        // Add the message to the local state
        setMessages(previousMessages => GiftedChat.append(previousMessages, [giftedMessage]));

        // Send the message via API
        apiClient.post('/api/messages', {
            receiverId: chatPartnerId,
            senderId: currentUserId,
            text: newMessages[0].text,
        })
            .then(response => {
                // Success case handled silently
            })
            .catch(error => {
                // If API fails, try Socket.IO as fallback
                if (socket) {
                    socket.emit('sendMessage', {
                        receiverId: chatPartnerId,
                        senderId: currentUserId,
                        text: newMessages[0].text,
                    });
                }

                // Show an error alert
                Alert.alert(
                    'Message Status',
                    'Your message might not have been saved. Please check your connection.',
                    [{ text: 'OK' }]
                );
            });
    }, [socket, user, currentUserId, otherUserId, apiClient]);

    // Memoize UI components to prevent recreation on every render
    const renderBubble = useCallback((props) => (
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
    ), []);

    const renderInputToolbar = useCallback((props) => (
        <InputToolbar
            {...props}
            containerStyle={styles.inputToolbar}
        />
    ), []);

    const renderComposer = useCallback((props) => (
        <Composer
            {...props}
            textInputStyle={styles.composer}
        />
    ), []);

    const renderSend = useCallback((props) => (
        <Send {...props} containerStyle={styles.sendContainer}>
            <View style={styles.sendButton}>
                <Ionicons name="send" size={normalize(24)} color="#3b0b40" />
            </View>
        </Send>
    ), []);
    
    // Handle retry loading
    const handleRetry = useCallback(() => {
        setLoading(true);
        setError(null);
        
        // Add a small delay to show the loading state before retrying
        setTimeout(() => {
            fetchMessages();
        }, 500);
    }, [fetchMessages]);
    
    // Show loading skeleton if needed
    const renderLoadingSkeleton = useCallback(() => (
        <View style={styles.loadingContainer}>
            <View style={styles.skeletonHeader}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.skeletonHeaderText} />
            </View>
            <View style={styles.messagesContainer}>
                {[1, 2, 3, 4].map(i => (
                    <View key={i} style={[
                        styles.skeletonMessage,
                        { alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start' }
                    ]} />
                ))}
            </View>
        </View>
    ), []);

    // Render loading state if no messages loaded yet
    if (loading && messages.length === 0) {
        return renderLoadingSkeleton();
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor="#3b0b40" barStyle="light-content" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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

                {error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="warning-outline" size={normalize(40)} color="#FF3B30" />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={handleRetry}
                        >
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <GiftedChat
                        messages={messages}
                        onSend={onSend}
                        user={{ _id: currentUserId }}
                        renderBubble={renderBubble}
                        renderInputToolbar={renderInputToolbar}
                        renderSend={renderSend}
                        renderComposer={renderComposer}
                        alwaysShowSend
                        scrollToBottom
                        renderLoading={() => (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#5A67F2" />
                            </View>
                        )}
                        listViewProps={{
                            showsVerticalScrollIndicator: false,
                            initialNumToRender: 10, // Reduced for better initial load
                            maxToRenderPerBatch: 10, // Reduced for smoother scrolling
                            windowSize: 10, // Reduced window size
                            onEndReachedThreshold: 0.5,
                            contentContainerStyle: { paddingBottom: 10 },
                            removeClippedSubviews: Platform.OS === 'android', // Better performance on Android
                            keyboardShouldPersistTaps: "handled", // Prevents keyboard dismissal issues
                            keyboardDismissMode: "on-drag", // Improves keyboard interaction
                            maintainVisibleContentPosition: { // Keeps visible content in view when keyboard appears
                                minIndexForVisible: 0,
                                autoscrollToTopThreshold: 100
                            }
                        }}
                        messagesContainerStyle={styles.messagesContainer}
                        minComposerHeight={normalize(40)}
                        maxComposerHeight={normalize(100)}
                        minInputToolbarHeight={normalize(60)}
                        parsePatterns={(linkStyle) => [
                            { type: 'url', style: linkStyle, onPress: (url) => Linking.openURL(url) },
                            { type: 'phone', style: linkStyle, onPress: (phone) => Linking.openURL(`tel:${phone}`) },
                            { type: 'email', style: linkStyle, onPress: (email) => Linking.openURL(`mailto:${email}`) }
                        ]}
                        infiniteScroll={false} // Disable auto-loading old messages
                        renderAvatar={null} // Disable avatar rendering for better performance
                        isLoadingEarlier={false} // Disable loading earlier messages indicator
                    />
                )}
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
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: normalize(15),
        backgroundColor: '#fff',
    },
    errorText: {
        color: '#cc0000',
        textAlign: 'center',
        fontSize: normalize(16),
        marginVertical: normalize(15),
    },
    retryButton: {
        padding: normalize(12),
        backgroundColor: '#3b0b40',
        borderRadius: normalize(8),
        marginTop: normalize(10),
        minWidth: normalize(120),
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#fff',
        fontSize: normalize(16),
        fontWeight: 'bold',
    },
    messagesContainer: {
        flex: 1,
        backgroundColor: '#fff',
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
    loadingText: {
        color: '#3b0b40',
        fontSize: normalize(16),
        fontWeight: 'bold',
        marginTop: normalize(10),
    },
    // Skeleton loading styles
    skeletonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: normalize(12),
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
        width: '100%'
    },
    skeletonAvatar: {
        width: normalize(40),
        height: normalize(40),
        borderRadius: normalize(20),
        backgroundColor: '#f0f0f0',
        marginRight: normalize(10),
    },
    skeletonHeaderText: {
        height: normalize(20),
        width: '50%',
        backgroundColor: '#f0f0f0',
        borderRadius: normalize(4),
    },
    skeletonMessage: {
        height: normalize(40),
        width: '70%',
        backgroundColor: '#f0f0f0',
        borderRadius: normalize(12),
        marginVertical: normalize(8),
        marginHorizontal: normalize(15),
    }
});

export default ChatScreen;