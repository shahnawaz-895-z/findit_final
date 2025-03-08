import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    StyleSheet,
    Dimensions,
    StatusBar,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import API_CONFIG from '../config';

// Get screen dimensions and handle orientation changes
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_URL = API_CONFIG.API_URL;

// Calculate responsive sizes
const scale = SCREEN_WIDTH / 375; // 375 is standard width
const normalize = (size) => Math.round(size * scale);

// Get status bar height
const STATUSBAR_HEIGHT = Platform.OS === 'ios' 
  ? 44 
  : StatusBar.currentHeight || 0;

// Fallback data in case API fails
const FALLBACK_CHAT_DATA = [
    {
        id: '1',
        name: 'UWS Pakistan - Scottish Campuses',
        lastMessage: 'Hi, ! Please let us know how we...',
        time: '12:10 AM',
        avatar: null,
        unread: false
    },
    {
        id: '2',
        name: 'Abdul Hanan',
        lastMessage: 'You can now message and call each...',
        time: 'Sun',
        avatar: null,
        unread: false
    },
    {
        id: '3',
        name: 'dj bulb',
        lastMessage: 'Isnay nakli baal lagain hai...',
        time: 'Feb 20',
        avatar: null,
        unread: false
    },
];

const ChatListScreen = ({ navigation }) => {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [userId, setUserId] = useState(null);

    // Fetch user ID from AsyncStorage
    useEffect(() => {
        const getUserId = async () => {
            try {
                const userData = await AsyncStorage.getItem('userData');
                console.log('User data from AsyncStorage:', userData);
                
                if (userData) {
                    const parsedUserData = JSON.parse(userData);
                    console.log('Parsed user data:', parsedUserData);
                    
                    // Use _id if available, otherwise use id
                    const userId = parsedUserData._id || parsedUserData.id;
                    console.log('Using user ID for chat list:', userId);
                    
                    setUserId(userId);
                } else {
                    console.warn('No user data found in AsyncStorage');
                    setError('User not logged in');
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                setError('Failed to load user data');
            }
        };

        getUserId();
    }, []);

    const fetchConversations = async (isRefreshing = false) => {
        if (!userId) {
            console.log('No userId available, skipping conversation fetch');
            return;
        }
        
        try {
            if (!isRefreshing) {
                setLoading(true);
            }
            console.log(`Making API request to: ${API_URL}/api/messages/${userId}`);
            
            const response = await axios.get(`${API_URL}/api/messages/${userId}`);
            console.log('API response:', response.data);
            
            if (response.data && Array.isArray(response.data)) {
                console.log(`Found ${response.data.length} conversations`);
                setChats(response.data);
            } else {
                console.log('No conversations found or invalid response format');
                // If no conversations yet, use empty array
                setChats([]);
            }
            setError(null);
        } catch (error) {
            console.error('Error fetching conversations:', error);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            setError('Failed to load conversations');
            // Use fallback data if API fails
            setChats(FALLBACK_CHAT_DATA);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fetch conversations when the screen comes into focus
    useFocusEffect(
        useCallback(() => {
            console.log('ChatListScreen is now focused');
            if (userId) {
                console.log('Fetching conversations on focus');
                fetchConversations();
                
                // Set up interval to refresh conversations every 15 seconds
                const intervalId = setInterval(() => {
                    console.log('Interval refresh');
                    fetchConversations();
                }, 15000);
                
                return () => {
                    console.log('Clearing conversation refresh interval');
                    clearInterval(intervalId);
                };
            }
            
            return () => {
                console.log('ChatListScreen is now unfocused');
            };
        }, [userId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchConversations(true);
    };

    const renderChatItem = ({ item }) => {
        console.log('Rendering chat item:', item);
        
        // Process the avatar if it's a base64 string
        let avatarUri = null;
        if (item.avatar) {
            if (typeof item.avatar === 'string' && item.avatar.startsWith('data:')) {
                // It's already a data URI
                avatarUri = item.avatar;
            } else if (typeof item.avatar === 'string' && item.avatar.length > 100) {
                // It's likely a base64 string without the data URI prefix
                avatarUri = `data:image/jpeg;base64,${item.avatar}`;
            } else {
                // It's a regular URL
                avatarUri = item.avatar;
            }
        }
        
        return (
            <TouchableOpacity 
                style={styles.chatItem}
                onPress={() => {
                    console.log('Navigating to chat with user:', item.id);
                    navigation.navigate('ChatScreen', { 
                        recipientId: item.id,
                        recipientName: item.name,
                        recipientAvatar: avatarUri
                    });
                }}
            >
                {/* Avatar */}
                {avatarUri ? (
                    <Image 
                        source={{ uri: avatarUri }} 
                        style={styles.avatar}
                        onError={(e) => console.log('Error loading avatar:', e.nativeEvent.error)}
                    />
                ) : (
                    <View style={styles.placeholderAvatar}>
                        <Text style={styles.avatarText}>
                            {item.name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                {/* Chat Details */}
                <View style={styles.chatDetails}>
                    <View style={styles.chatHeader}>
                        <Text style={styles.chatName} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.chatTime}>{item.time}</Text>
                    </View>
                    <Text style={[
                        styles.lastMessage, 
                        item.unread && styles.unreadMessage
                    ]} numberOfLines={1}>
                        {item.lastMessage}
                    </Text>
                </View>
                
                {/* Unread indicator */}
                {item.unread && (
                    <View style={styles.unreadIndicator} />
                )}
            </TouchableOpacity>
        );
    };

    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubText}>
                Your conversations will appear here
            </Text>
            <TouchableOpacity 
                style={styles.searchButton}
                onPress={() => navigation.navigate('SearchScreen')}
            >
                <Text style={styles.searchButtonText}>Find people to chat with</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Status Bar */}
            <View style={styles.statusBar}>
                <StatusBar backgroundColor="#3b0b40" barStyle="light-content" />
            </View>
            
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chats</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity 
                        style={styles.headerButton}
                        onPress={onRefresh}
                    >
                        <Ionicons name="refresh" size={normalize(24)} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.headerButton}
                        onPress={() => navigation.navigate('SearchScreen')}
                    >
                        <Ionicons name="search" size={normalize(24)} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Error message */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Loading indicator */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b0b40" />
                </View>
            ) : (
                /* Chat List */
                <FlatList
                    data={chats}
                    renderItem={renderChatItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[
                        styles.chatList,
                        chats.length === 0 && styles.emptyList
                    ]}
                    ListEmptyComponent={renderEmptyComponent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#3b0b40']}
                            tintColor="#3b0b40"
                        />
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    statusBar: {
        height: STATUSBAR_HEIGHT,
        backgroundColor: '#3b0b40',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: normalize(16),
        paddingVertical: normalize(16),
        backgroundColor: '#3b0b40',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    headerTitle: {
        fontSize: normalize(20),
        fontWeight: 'bold',
        color: '#fff',
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerButton: {
        marginLeft: normalize(16),
        padding: normalize(4),
    },
    chatList: {
        paddingBottom: normalize(16),
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: normalize(16),
        paddingVertical: normalize(12),
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    avatar: {
        width: normalize(50),
        height: normalize(50),
        borderRadius: normalize(25),
    },
    placeholderAvatar: {
        width: normalize(50),
        height: normalize(50),
        borderRadius: normalize(25),
        backgroundColor: '#3b0b40',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: normalize(18),
        fontWeight: 'bold',
    },
    chatDetails: {
        flex: 1,
        marginLeft: normalize(12),
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chatName: {
        fontSize: normalize(16),
        fontWeight: 'bold',
        color: '#333',
        maxWidth: SCREEN_WIDTH * 0.5,
    },
    chatTime: {
        fontSize: normalize(14),
        color: '#888',
    },
    lastMessage: {
        fontSize: normalize(14),
        color: '#666',
        marginTop: normalize(4),
    },
    unreadMessage: {
        fontWeight: 'bold',
        color: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        padding: normalize(16),
        backgroundColor: '#ffeeee',
        borderRadius: normalize(8),
        margin: normalize(16),
    },
    errorText: {
        color: '#cc0000',
        textAlign: 'center',
        fontSize: normalize(14),
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: normalize(32),
    },
    emptyText: {
        fontSize: normalize(18),
        fontWeight: 'bold',
        color: '#666',
        marginTop: normalize(16),
    },
    emptySubText: {
        fontSize: normalize(14),
        color: '#999',
        marginTop: normalize(8),
        textAlign: 'center',
    },
    searchButton: {
        marginTop: normalize(24),
        backgroundColor: '#3b0b40',
        paddingHorizontal: normalize(20),
        paddingVertical: normalize(12),
        borderRadius: normalize(8),
    },
    searchButtonText: {
        color: '#fff',
        fontSize: normalize(16),
        fontWeight: 'bold',
    },
    unreadIndicator: {
        width: normalize(10),
        height: normalize(10),
        borderRadius: normalize(5),
        backgroundColor: '#000',
        marginLeft: normalize(8),
    },
});

export default ChatListScreen;