import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    AppState
} from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send, Composer } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_CONFIG from '../config';

// Get screen dimensions and handle orientation changes
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_URL = API_CONFIG.BASE_URL;
const API_URL = API_CONFIG.API_URL;
const BACKUP_API_URL = `${BASE_URL}:5001`;
const POLLING_INTERVAL = 3000; // Poll every 3 seconds

// Calculate responsive sizes
const scale = SCREEN_WIDTH / 375; // 375 is standard width
const normalize = (size) => Math.round(size * scale);

const ChatScreen = ({ route, navigation }) => {
    // Extract recipient information from route params
    // Support both direct params and nested user object (from ChatListScreen)
    const user = route.params?.user;
    const recipientId = user?.id || route.params?.recipientId;
    const recipientName = user?.name || route.params?.recipientName || 'Unknown Contact';
    const recipientAvatar = user?.avatar || route.params?.recipientAvatar;
    const matchId = route.params?.matchId;
    const itemDescription = route.params?.itemDescription;
    const matchContext = route.params?.matchContext || {};
    
    // Log the received parameters for debugging
    console.log('ChatScreen params:', { 
        recipientId, 
        recipientName, 
        recipientAvatar: recipientAvatar ? 'Avatar exists' : 'No avatar',
        matchId,
        itemDescription
    });
    
    // Create user object for GiftedChat with proper null checks
    const recipient = useMemo(() => ({
        _id: recipientId || 'unknown',
        name: recipientName || 'Unknown Contact',
        avatar: recipientAvatar || 'https://randomuser.me/api/portraits/lego/1.jpg'
    }), [recipientId, recipientName, recipientAvatar]);

    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [serverUrl, setServerUrl] = useState(API_URL);
    const [lastPolled, setLastPolled] = useState(null);
    const pollingInterval = useRef(null);
    const appState = useRef(AppState.currentState);

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
            } finally {
                // Set loading to false even if there's an error with user ID
                // This allows the UI to render with a placeholder
                setLoading(false);
            }
        };

        getCurrentUserId();
    }, []);

    // Fetch message history when both user IDs are available
    useEffect(() => {
        if (!currentUserId) {
            console.log('Current user ID not available yet');
            return;
        }
        
        if (!recipient._id) {
            console.log('Recipient ID not available');
            setError('Invalid recipient information');
            setLoading(false);
            return;
        }

        console.log('Fetching messages between', currentUserId, 'and', recipient._id);

        const fetchMessages = async () => {
            try {
                setLoading(true);
                
                // Set a timeout to handle slow connections
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout')), 10000)
                );
                
                // Actual fetch request
                const fetchPromise = axios.get(`${serverUrl}/api/messages/${currentUserId}/${recipient._id}`);
                
                // Race between timeout and fetch
                const response = await Promise.race([fetchPromise, timeoutPromise]);
                
                console.log('Messages API response:', response.data);
                
                if (response.data && Array.isArray(response.data)) {
                    // Format messages for GiftedChat if needed
                    const formattedMessages = response.data.map(msg => ({
                        ...msg,
                        user: {
                            _id: msg.user?._id || msg.senderId,
                            name: msg.user?._id === currentUserId ? 'You' : recipient.name,
                            avatar: msg.user?._id === currentUserId ? null : recipient.avatar
                        }
                    }));
                    
                    // Sort messages by createdAt in descending order (newest first)
                    // GiftedChat expects messages sorted this way
                    formattedMessages.sort((a, b) => {
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    });
                    
                    // Store messages in AsyncStorage for persistence
                    try {
                        const chatKey = `chat_${currentUserId}_${recipient._id}`;
                        await AsyncStorage.setItem(chatKey, JSON.stringify(formattedMessages));
                        console.log('Messages saved to AsyncStorage with key:', chatKey);
                    } catch (storageError) {
                        console.error('Error saving messages to AsyncStorage:', storageError);
                    }
                    
                    setMessages(formattedMessages);
                    console.log('Messages loaded:', formattedMessages.length);
                } else {
                    // If no messages, try to load from AsyncStorage
                    try {
                        const chatKey = `chat_${currentUserId}_${recipient._id}`;
                        const savedMessages = await AsyncStorage.getItem(chatKey);
                        if (savedMessages) {
                            const parsedMessages = JSON.parse(savedMessages);
                            setMessages(parsedMessages);
                            console.log('Loaded messages from AsyncStorage:', parsedMessages.length);
                        } else {
                            setMessages([]);
                        }
                    } catch (storageError) {
                        console.error('Error loading messages from AsyncStorage:', storageError);
                        setMessages([]);
                    }
                }
                setError(null);
            } catch (error) {
                console.error('Error fetching messages:', error);
                setError('Failed to load message history');
                
                // Try to load from AsyncStorage as fallback
                try {
                    const chatKey = `chat_${currentUserId}_${recipient._id}`;
                    const savedMessages = await AsyncStorage.getItem(chatKey);
                    if (savedMessages) {
                        const parsedMessages = JSON.parse(savedMessages);
                        setMessages(parsedMessages);
                        console.log('Loaded messages from AsyncStorage as fallback:', parsedMessages.length);
                    } else {
                        setMessages([]);
                    }
                } catch (storageError) {
                    console.error('Error loading messages from AsyncStorage:', storageError);
                    setMessages([]);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [currentUserId, recipient._id, recipient.name, recipient.avatar, serverUrl]);

    // Set up Socket.IO connection
    useEffect(() => {
        if (!currentUserId) return;
        if (!recipient._id) return;

        console.log('Setting up Socket.IO connection for user', currentUserId);

        try {
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
                if (message.senderId === recipient._id) {
                    // Check if this message already exists in our state (by clientMessageId)
                    if (message.clientMessageId) {
                        const messageExists = messages.some(
                            msg => msg._id === message.clientMessageId || 
                                  (msg.clientMessageId && msg.clientMessageId === message.clientMessageId)
                        );
                        
                        if (messageExists) {
                            console.log('Message already exists in state, skipping:', message.clientMessageId);
                            return;
                        }
                    }
                    
                    const newMessage = {
                        _id: message._id || Math.random().toString(),
                        text: message.text,
                        createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
                        user: {
                            _id: message.senderId,
                            name: recipient.name,
                            avatar: recipient.avatar // Always use the user's avatar for their messages
                        },
                        clientMessageId: message.clientMessageId
                    };
                    
                    // Add the new message to the existing messages
                    // GiftedChat.append puts the new message at the beginning of the array
                    // which is correct for inverted={true}
                    setMessages(previousMessages => {
                        const updatedMessages = GiftedChat.append(previousMessages, [newMessage]);
                        
                        // Save to AsyncStorage for persistence
                        try {
                            const chatKey = `chat_${currentUserId}_${recipient._id}`;
                            AsyncStorage.setItem(chatKey, JSON.stringify(updatedMessages));
                        } catch (error) {
                            console.error('Error saving messages to AsyncStorage:', error);
                        }
                        
                        return updatedMessages;
                    });
                }
            });
            
            // Listen for message confirmations
            newSocket.on('messageSaved', (message) => {
                console.log('Message confirmation received:', message);
                
                // Update the message in our state to mark it as sent
                if (message.clientMessageId) {
                    setMessages(previousMessages => {
                        // Check if we already have this message with the server ID
                        const hasServerMessage = previousMessages.some(msg => msg._id === message._id);
                        
                        if (hasServerMessage) {
                            console.log('Server message already exists, skipping update');
                            return previousMessages;
                        }
                        
                        // Update the message with the client ID to include the server ID
                        const updatedMessages = previousMessages.map(msg => 
                            msg._id === message.clientMessageId ? 
                            { 
                                ...msg, 
                                _id: message._id, // Use the server-generated ID
                                pending: false, 
                                sent: true,
                                serverConfirmed: true
                            } : msg
                        );
                        
                        // Save to AsyncStorage for persistence
                        try {
                            const chatKey = `chat_${currentUserId}_${recipient._id}`;
                            AsyncStorage.setItem(chatKey, JSON.stringify(updatedMessages));
                        } catch (error) {
                            console.error('Error saving messages to AsyncStorage:', error);
                        }
                        
                        return updatedMessages;
                    });
                }
            });

            return () => {
                console.log('Disconnecting Socket.IO');
                newSocket.disconnect();
            };
        } catch (error) {
            console.error('Error setting up socket connection:', error);
            setError('Failed to connect to chat server');
        }
    }, [currentUserId, recipient._id, recipient.name, recipient.avatar, serverUrl, messages]);

    // Add a system message with match information
    useEffect(() => {
        if (itemDescription && matchContext && messages.length > 0) {
            // Check if system message already exists
            const hasSystemMessage = messages.some(msg => msg.system === true);
            
            if (!hasSystemMessage) {
                const systemMessage = {
                    _id: 'system-' + Date.now(),
                    text: `This conversation is about a found item: "${itemDescription}"\n\nMatch confidence: ${matchContext.matchConfidence}%`,
                    createdAt: new Date(),
                    system: true,
                };
                
                setMessages(previousMessages => 
                    GiftedChat.append(previousMessages, [systemMessage])
                );
            }
        }
    }, [itemDescription, matchContext, messages]);

    useEffect(() => {
        const setupChat = async () => {
            if (!currentUserId || !recipient._id) return;
            
            await fetchMessages();
            startPolling();
        };
        
        setupChat();
        
        // Handle app state changes
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App has come to foreground
                setupChat();
            } else if (nextAppState.match(/inactive|background/)) {
                // App has gone to background
                stopPolling();
            }
            appState.current = nextAppState;
        });
        
        return () => {
            stopPolling();
            subscription.remove();
        };
    }, [currentUserId, recipient._id]);
    
    const startPolling = () => {
        if (pollingInterval.current) return;
        
        pollingInterval.current = setInterval(() => {
            pollMessages();
        }, POLLING_INTERVAL);
    };
    
    const stopPolling = () => {
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }
    };
    
    const fetchMessages = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/messages`, {
                params: {
                    senderId: currentUserId,
                    receiverId: recipient._id
                }
            });
            
            if (response.data.status === 'success') {
                const formattedMessages = response.data.messages.map(formatMessage);
                setMessages(formattedMessages);
                setLastPolled(new Date().toISOString());
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
            setError('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };
    
    const pollMessages = async () => {
        if (!lastPolled) return;
        
        try {
            const response = await axios.get(`${API_URL}/api/messages/poll`, {
                params: {
                    senderId: currentUserId,
                    receiverId: recipient._id,
                    lastPolled
                }
            });
            
            if (response.data.status === 'success' && response.data.messages.length > 0) {
                const formattedMessages = response.data.messages.map(formatMessage);
                setMessages(prevMessages => 
                    GiftedChat.append(prevMessages, formattedMessages)
                );
            }
            
            setLastPolled(response.data.timestamp);
        } catch (error) {
            console.error('Error polling messages:', error);
        }
    };
    
    const onSend = useCallback(async (newMessages = []) => {
        const messageText = newMessages[0].text;
        const messageId = newMessages[0]._id;
        
        // Optimistically add message to UI
        setMessages(previousMessages =>
            GiftedChat.append(previousMessages, newMessages)
        );
        
        try {
            // Send message via API
            const response = await axios.post(`${API_URL}/api/messages`, {
                receiverId: recipient._id,
                senderId: currentUserId,
                text: messageText,
                messageId,
                matchId: matchId || null
            });
            
            if (response.data.status !== 'success') {
                throw new Error(response.data.message || 'Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            
            // If the error is because no match exists, show a specific message
            if (error.response?.data?.message === 'Cannot send messages - no match exists between these users') {
                Alert.alert(
                    'Cannot Send Message',
                    'You can only message users with whom you have a match.',
                    [{ text: 'OK' }]
                );
                
                // Remove the failed message
                setMessages(previousMessages => 
                    previousMessages.filter(msg => msg._id !== messageId)
                );
            } else {
                Alert.alert(
                    'Error',
                    'Failed to send message. Please try again.',
                    [{ text: 'OK' }]
                );
            }
        }
    }, [currentUserId, recipient._id, matchId]);

    if (loading && messages.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b0b40" />
                <Text>Loading messages...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#3d0c45" />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <TouchableOpacity 
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.headerUserInfo}>
                            {recipient.avatar ? (
                                <Image
                                    source={{ uri: recipient.avatar }}
                                    style={styles.headerAvatar}
                                    onError={() => console.log('Error loading header avatar')}
                                />
                            ) : (
                                <View style={styles.placeholderAvatar}>
                                    <Text style={styles.avatarText}>
                                        {recipient.name ? recipient.name.charAt(0).toUpperCase() : '?'}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.headerTextContainer}>
                                <Text style={styles.headerTitle} numberOfLines={1}>{recipient.name}</Text>
                                {matchContext.matchConfidence && (
                                    <Text style={styles.matchInfo}>
                                        Match: {matchContext.matchConfidence}%
                                    </Text>
                                )}
                            </View>
                        </View>
                    </View>
                    {itemDescription && (
                        <View style={styles.itemInfoBanner}>
                            <Text style={styles.itemInfoText} numberOfLines={1}>
                                Re: {itemDescription}
                            </Text>
                        </View>
                    )}
                </View>

                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <View style={styles.chatContainer}>
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
                                    left: { color: '#333' },
                                }}
                            />
                        )}
                        renderInputToolbar={(props) => (
                            <InputToolbar
                                {...props}
                                containerStyle={styles.inputToolbar}
                            />
                        )}
                        renderSend={(props) => (
                            <Send
                                {...props}
                                containerStyle={styles.sendContainer}
                            >
                                <Ionicons name="send" size={24} color="#3b0b40" />
                            </Send>
                        )}
                        renderComposer={(props) => (
                            <Composer
                                {...props}
                                textInputStyle={styles.composer}
                                placeholder="Type a message..."
                            />
                        )}
                        alwaysShowSend
                        scrollToBottom
                        inverted={true}
                    />
                </View>
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
    },
    header: {
        backgroundColor: '#3d0c45',
        paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
        paddingBottom: normalize(8),
        paddingHorizontal: normalize(16),
        borderBottomWidth: 1,
        borderBottomColor: '#2a082f',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: normalize(8),
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
        backgroundColor: '#f0f0f0', // Add background color to show placeholder while loading
    },
    placeholderAvatar: {
        width: normalize(40),
        height: normalize(40),
        borderRadius: normalize(20),
        backgroundColor: '#6b1a78',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: normalize(10),
    },
    avatarText: {
        color: '#fff',
        fontSize: normalize(16),
        fontWeight: 'bold',
    },
    headerTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: normalize(16),
        fontWeight: 'bold',
        color: '#fff',
    },
    matchInfo: {
        fontSize: normalize(12),
        color: '#f0c4ff',
        marginTop: normalize(2),
    },
    itemInfoBanner: {
        backgroundColor: '#2a082f',
        paddingVertical: normalize(4),
        paddingHorizontal: normalize(16),
        marginTop: normalize(4),
        borderRadius: normalize(4),
    },
    itemInfoText: {
        color: '#fff',
        fontSize: normalize(12),
    },
    chatContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    errorContainer: {
        padding: normalize(8),
        backgroundColor: '#ffebee',
        borderBottomWidth: 1,
        borderBottomColor: '#ffcdd2',
    },
    errorText: {
        color: '#c62828',
        fontSize: normalize(14),
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    inputToolbar: {
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    composer: {
        backgroundColor: '#f5f5f5',
        borderRadius: normalize(18),
        paddingHorizontal: normalize(12),
        marginRight: normalize(8),
        maxHeight: normalize(100),
    },
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: normalize(8),
        marginBottom: normalize(5),
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: normalize(5),
        marginRight: normalize(5),
        width: normalize(36),
        height: normalize(36),
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
    textInput: {
        fontSize: normalize(16),
        lineHeight: normalize(20),
        marginTop: Platform.OS === 'ios' ? 0 : normalize(5),
    }
});

export default ChatScreen;