import React, { useState, useEffect } from 'react';
import {
    View,
    TextInput,
    FlatList,
    Image,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
    SafeAreaView,
    StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import API_CONFIG from '../config';

// Get screen dimensions and handle orientation changes
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate responsive sizes
const scale = SCREEN_WIDTH / 375; // 375 is standard width
const normalize = (size) => Math.round(size * scale);

const SearchScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isServerConnected, setIsServerConnected] = useState(true);

    const SERVER_URL = API_CONFIG.API_URL; // Using centralized config

    const testServerConnection = async () => {
        try {
            const response = await fetch(`${SERVER_URL}/api-test`);

            // Check if response is OK before trying to parse JSON
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Add timeout to fetch request
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 5000)
            );

            const data = await Promise.race([
                response.json(),
                timeoutPromise
            ]);

            setIsServerConnected(data.status === 'success');
            return data.status === 'success';
        } catch (error) {
            console.error('Server connection test failed:', error.message);
            setIsServerConnected(false);
            return false;
        }
    };
    const fetchUsers = async (query) => {
        try {
            setLoading(true);
            setError(null);

            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(`${SERVER_URL}/search-users?query=${encodedQuery}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && Array.isArray(data.users)) {
                // Process the users to ensure proper image data
                const processedUsers = data.users.map(user => ({
                    ...user,
                    // Ensure the profileImage is properly formatted
                    profileImage: user.profileImage || null
                }));
                setUsers(processedUsers);
            } else {
                throw new Error(data.message || 'Invalid response format');
            }
        } catch (err) {
            console.error('Search error:', err);
            setError(err.message || 'Failed to fetch users');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        testServerConnection();
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery.length > 2) {
                fetchUsers(searchQuery);
            } else {
                setUsers([]);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const renderUserItem = ({ item }) => {
        // Create the image URI only if profileImage exists
        const imageUri = item.profileImage
            ? `data:${item.profileImageType};base64,${item.profileImage}`
            : null;

        console.log('User item:', item);
        console.log('User ID for messaging:', item._id);

        return (
            <View style={styles.userItem}>
                <View style={styles.avatarContainer}>
                    {imageUri ? (
                        <Image
                            source={{ uri: imageUri }}
                            style={styles.avatar}
                            onError={(error) => console.error('Image loading error:', error)}
                        />
                    ) : (
                        <View style={[styles.avatar, styles.placeholderAvatar]}>
                            <Text style={styles.avatarText}>
                                {item.name[0].toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                </View>
                <TouchableOpacity
                    style={styles.messageButton}
                    onPress={() => {
                        console.log('Starting conversation with user:', item.name);
                        console.log('User ID:', item._id);
                        
                        navigation.navigate('ChatScreen', { 
                            user: {
                                id: item._id,
                                name: item.name,
                                avatar: imageUri
                            } 
                        });
                    }}
                >
                    <Icon name="chatbubble-ellipses" size={20} color="#fff" />
                    <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#3b0b40" barStyle="light-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-back" size={normalize(24)} color="#3b0b40" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Search Users</Text>
            </View>
            
            {/* Search Input */}
            <View style={styles.searchContainer}>
                <Icon name="search" size={normalize(20)} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search for users..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity 
                        style={styles.clearButton}
                        onPress={() => setSearchQuery('')}
                    >
                        <Icon name="close-circle" size={normalize(20)} color="#999" />
                    </TouchableOpacity>
                )}
            </View>
            
            {/* Server Connection Error */}
            {!isServerConnected && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>
                        Unable to connect to server. Please check your connection and ensure the server is running.
                    </Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={testServerConnection}
                    >
                        <Text style={styles.retryButtonText}>Retry Connection</Text>
                    </TouchableOpacity>
                </View>
            )}
            
            {/* Search Results */}
            {isServerConnected && (
                <>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3b0b40" />
                        </View>
                    ) : (
                        <>
                            {error ? (
                                <View style={styles.errorContainer}>
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={users}
                                    renderItem={renderUserItem}
                                    keyExtractor={(item) => item._id}
                                    contentContainerStyle={styles.userList}
                                    ListEmptyComponent={
                                        searchQuery.length > 2 ? (
                                            <View style={styles.emptyContainer}>
                                                <Icon name="search" size={normalize(50)} color="#ccc" />
                                                <Text style={styles.emptyText}>No users found</Text>
                                                <Text style={styles.emptySubText}>
                                                    Try a different search term
                                                </Text>
                                            </View>
                                        ) : searchQuery.length > 0 ? (
                                            <View style={styles.emptyContainer}>
                                                <Text style={styles.emptySubText}>
                                                    Type at least 3 characters to search
                                                </Text>
                                            </View>
                                        ) : null
                                    }
                                />
                            )}
                        </>
                    )}
                </>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: normalize(16),
        paddingVertical: normalize(12),
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
        marginRight: normalize(10),
    },
    headerTitle: {
        fontSize: normalize(20),
        fontWeight: 'bold',
        color: '#3b0b40',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: normalize(8),
        margin: normalize(16),
        paddingHorizontal: normalize(12),
        paddingVertical: normalize(8),
    },
    searchIcon: {
        marginRight: normalize(8),
    },
    searchInput: {
        flex: 1,
        fontSize: normalize(16),
        color: '#333',
        paddingVertical: normalize(8),
    },
    clearButton: {
        padding: normalize(5),
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
        lineHeight: normalize(20),
    },
    retryButton: {
        backgroundColor: '#3b0b40',
        paddingHorizontal: normalize(20),
        paddingVertical: normalize(10),
        borderRadius: normalize(8),
        marginTop: normalize(16),
        alignSelf: 'center',
    },
    retryButtonText: {
        color: '#fff',
        fontSize: normalize(16),
        fontWeight: 'bold',
    },
    userList: {
        paddingBottom: normalize(16),
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: normalize(16),
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    avatarContainer: {
        width: normalize(50),
        height: normalize(50),
        borderRadius: normalize(25),
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: normalize(50),
        height: normalize(50),
    },
    placeholderAvatar: {
        backgroundColor: '#3b0b40',
    },
    avatarText: {
        color: '#fff',
        fontSize: normalize(18),
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
        marginLeft: normalize(12),
    },
    userName: {
        fontSize: normalize(16),
        fontWeight: 'bold',
        color: '#333',
    },
    userEmail: {
        fontSize: normalize(14),
        color: '#666',
        marginTop: normalize(4),
    },
    messageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b0b40',
        paddingHorizontal: normalize(12),
        paddingVertical: normalize(8),
        borderRadius: normalize(8),
        marginLeft: 'auto',
    },
    messageButtonText: {
        color: '#fff',
        fontSize: normalize(14),
        marginLeft: normalize(4),
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: normalize(32),
        flex: 1,
        marginTop: normalize(50),
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
});

export default SearchScreen;