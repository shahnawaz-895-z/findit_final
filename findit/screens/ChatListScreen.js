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

// Calculate responsive sizes
const scale = SCREEN_WIDTH / 375; // 375 is standard width
const normalize = (size) => Math.round(size * scale);

// Get the status bar height for proper padding
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

// Fallback data for when API fails
const FALLBACK_CHAT_DATA = [
    {
        id: '1',
        name: 'Support Team',
        lastMessage: 'How can we assist you today?',
        time: '10:30 AM',
        unread: true,
    }
];

// Function to get initials from a name
const getInitials = (name) => {
    if (!name) return '??';
    
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    
    return (
        parts[0].charAt(0).toUpperCase() + 
        parts[parts.length - 1].charAt(0).toUpperCase()
    );
};

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
            console.log(`Making API request to: ${API_CONFIG.API_URL}/api/messages/${userId}`);
            
            const response = await axios.get(`${API_CONFIG.API_URL}/api/messages/${userId}`);
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
                style={[
                    styles.chatItem,
                    item.unread && styles.unreadChatItem
                ]}
                activeOpacity={0.7}
                onPress={() => {
                    console.log('Navigating to chat with user:', item.id);
                    navigation.navigate('ChatScreen', { 
                        user: {
                            id: item.id,
                            name: item.name,
                            avatar: avatarUri
                        } 
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
                    <View style={[styles.placeholderAvatar, item.unread && styles.unreadAvatar]}>
                        <Text style={styles.avatarText}>
                            {getInitials(item.name)}
                        </Text>
                    </View>
                )}

                {/* Chat Details */}
                <View style={styles.chatDetails}>
                    <View style={styles.chatHeader}>
                        <Text style={[styles.chatName, item.unread && styles.unreadChatName]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.chatTime}>
                            {item.time}
                        </Text>
                    </View>
                    <Text 
                        style={[
                            styles.lastMessage, 
                            item.unread && styles.unreadMessage
                        ]}
                        numberOfLines={2}
                    >
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
                Start a chat by finding something to match
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#3d0c45" barStyle="light-content" translucent={true} />
            
            {/* Safe area for status bar */}
            <SafeAreaView style={styles.safeTopArea} />
            
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chats</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity 
                        style={styles.headerButton}
                        onPress={onRefresh}
                        hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                    >
                        <Ionicons name="refresh" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content area */}
            <SafeAreaView style={styles.safeContentArea}>
                {/* Error message */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={24} color="#cc0000" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Loading indicator */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#3d0c45" />
                        <Text style={styles.loadingText}>Loading conversations...</Text>
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
                                colors={['#3d0c45']}
                                tintColor="#3d0c45"
                            />
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#3d0c45',
    },
    safeTopArea: {
        flex: 0,
        backgroundColor: '#3d0c45',
    },
    safeContentArea: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: STATUSBAR_HEIGHT + 16,
        paddingBottom: 16,
        backgroundColor: '#3d0c45',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerButton: {
        padding: 5,
    },
    chatList: {
        paddingTop: 8,
        paddingBottom: 16,
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eeeeee',
        backgroundColor: '#ffffff',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: '#f0f0f0',
    },
    placeholderAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#6a1b9a',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#f0f0f0',
    },
    avatarText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    chatDetails: {
        flex: 1,
        marginLeft: 12,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333333',
        maxWidth: SCREEN_WIDTH * 0.5,
    },
    chatTime: {
        fontSize: 14,
        color: '#888888',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666666',
    },
    unreadMessage: {
        fontWeight: 'bold',
        color: '#000000',
    },
    unreadIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#3d0c45',
        marginLeft: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666666',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#ffeeee',
        borderRadius: 8,
        margin: 16,
    },
    errorText: {
        color: '#cc0000',
        marginLeft: 8,
        fontSize: 14,
        flex: 1,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        height: SCREEN_HEIGHT * 0.7,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666666',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#999999',
        marginTop: 8,
        textAlign: 'center',
    },
    unreadChatItem: {
        backgroundColor: 'rgba(61, 12, 69, 0.05)',
        borderLeftWidth: 4,
        borderLeftColor: '#3d0c45',
    },
    unreadChatName: {
        color: '#3d0c45',
    },
    unreadAvatar: {
        backgroundColor: '#3d0c45',
        borderColor: '#3d0c45',
    },
});

export default ChatListScreen;