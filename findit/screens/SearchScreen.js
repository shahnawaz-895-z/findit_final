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
    Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const SearchScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isServerConnected, setIsServerConnected] = useState(true);

    const SERVER_URL = 'http://192.168.18.18:5000'; // Make sure this matches your server

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

        console.log('Image URI available:', !!imageUri); // Debug log

        return (
            <TouchableOpacity
                style={styles.userItem}
                onPress={() => navigation.navigate('ChatScreen', { user: item })}
            >
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
            </TouchableOpacity>
        );
    };

    if (!isServerConnected) {
        return (
            <View style={styles.container}>
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
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.searchBar}>
                <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search users..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {loading && (
                <ActivityIndicator style={styles.loader} color="#3b0b40" />
            )}

            {error && (
                <Text style={styles.errorText}>{error}</Text>
            )}

            {!loading && !error && (
                <FlatList
                    data={users}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item._id}
                    ListEmptyComponent={
                        searchQuery.length > 2 ? (
                            <Text style={styles.noResults}>No users found</Text>
                        ) : null
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
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        margin: width * 0.025,
        padding: width * 0.025,
        borderRadius: width * 0.05,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: width * 0.04,
    },
    userItem: {
        flexDirection: 'row',
        padding: width * 0.04,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
    },
    avatarContainer: {
        marginRight: 15,
    },
    avatar: {
        width: width * 0.125,
        height: width * 0.125,
        borderRadius: width * 0.0625,
        backgroundColor: '#f0f0f0', // Fallback color
    },
    placeholderAvatar: {
        backgroundColor: '#3b0b40',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
        marginLeft: width * 0.03,
    },
    userName: {
        fontSize: width * 0.04,
        fontWeight: 'bold',
        color: '#333',
    },
    userEmail: {
        fontSize: width * 0.035,
        color: '#666',
        marginTop: height * 0.003,
    },
    loader: {
        marginTop: 20,
    },
    errorText: {
        textAlign: 'center',
        color: 'red',
        margin: 20,
    },
    noResults: {
        textAlign: 'center',
        margin: 20,
        color: '#666',
    },
});

export default SearchScreen;