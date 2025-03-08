import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    Image, 
    TouchableOpacity, 
    Alert,
    Dimensions,
    ActivityIndicator,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

const { width, height } = Dimensions.get('window');
const BACKEND_URL = API_CONFIG.API_URL; // Using centralized config

const MatchesScreen = ({ route, navigation }) => {
    // Handle case when navigating directly from homepage
    const routeParams = route.params || {};
    const { matches: routeMatches, lostItemId, lostItemDescription } = routeParams;
    
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [matches, setMatches] = useState(routeMatches || []);
    const [stats, setStats] = useState({
        totalMatches: 0,
        pendingMatches: 0,
        confirmedMatches: 0
    });
    
    useEffect(() => {
        // Get the user ID from AsyncStorage
        const getUserId = async () => {
            try {
                const userData = await AsyncStorage.getItem('userData');
                if (userData) {
                    const parsedUserData = JSON.parse(userData);
                    setUserId(parsedUserData._id);
                    
                    // If no matches were passed via route params, fetch all matches for the user
                    if (!routeMatches) {
                        fetchUserMatches(parsedUserData._id);
                    } else {
                        setLoading(false);
                        updateStats(routeMatches);
                    }
                } else {
                    // Demo data if no user is logged in
                    setDemoData();
                }
            } catch (error) {
                console.error('Error getting user data:', error);
                // Demo data if there's an error
                setDemoData();
            }
        };
        
        getUserId();
    }, [routeMatches]);
    
    const fetchUserMatches = async (userId) => {
        try {
            setLoading(true);
            // Fetch matches from the backend
            const response = await axios.get(`${BACKEND_URL}/user-matches/${userId}`);
            
            if (response.data.status === 'success' && response.data.matches) {
                setMatches(response.data.matches);
                updateStats(response.data.matches);
            } else {
                // If no matches found or error in response
                setMatches([]);
                updateStats([]);
                Alert.alert('Info', 'No matches found for your items.');
            }
        } catch (error) {
            console.error('Error fetching matches:', error);
            Alert.alert('Error', 'Failed to fetch matches. Please try again later.');
            // Only use demo data in development environment
            if (__DEV__) {
                console.log('Using demo data in development mode');
                setDemoData();
            } else {
                setMatches([]);
                updateStats([]);
            }
        } finally {
            setLoading(false);
        }
    };
    
    const setDemoData = () => {
        const demoMatches = [
            {
                id: '1',
                foundItemId: 'f1',
                lostItemId: 'l1',
                foundItemDescription: 'Blue wallet with ID cards',
                lostItemDescription: 'Lost blue leather wallet',
                foundDate: '2023-06-15',
                foundLocation: 'Central Park',
                matchConfidence: 92,
                status: 'pending',
                foundByUser: {
                    id: 'u2',
                    name: 'Jane Smith',
                    avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
                }
            },
            {
                id: '2',
                foundItemId: 'f2',
                lostItemId: 'l2',
                foundItemDescription: 'iPhone 13 Pro, black color',
                lostItemDescription: 'Lost iPhone 13 Pro',
                foundDate: '2023-06-10',
                foundLocation: 'Coffee Shop',
                matchConfidence: 88,
                status: 'confirmed',
                foundByUser: {
                    id: 'u3',
                    name: 'Mike Johnson',
                    avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
                }
            },
            {
                id: '3',
                foundItemId: 'f3',
                lostItemId: 'l3',
                foundItemDescription: 'Car keys with Honda keychain',
                lostItemDescription: 'Lost car keys',
                foundDate: '2023-06-18',
                foundLocation: 'Shopping Mall',
                matchConfidence: 75,
                status: 'pending',
                foundByUser: {
                    id: 'u4',
                    name: 'Sarah Williams',
                    avatar: 'https://randomuser.me/api/portraits/women/67.jpg'
                }
            }
        ];
        
        setMatches(demoMatches);
        updateStats(demoMatches);
    };
    
    const updateStats = (matchesData) => {
        const totalMatches = matchesData.length;
        const pendingMatches = matchesData.filter(match => match.status === 'pending').length;
        const confirmedMatches = matchesData.filter(match => match.status === 'confirmed').length;
        
        setStats({
            totalMatches,
            pendingMatches,
            confirmedMatches
        });
    };
    
    const handleContactOwner = (item) => {
        if (!userId) {
            Alert.alert('Error', 'You need to be logged in to contact the owner.');
            return;
        }
        
        // Navigate to chat screen with the contact information
        navigation.navigate('ChatScreen', {
            recipientId: item.foundByUser.id,
            recipientName: item.foundByUser.name,
            recipientAvatar: item.foundByUser.avatar,
            matchId: item.id
        });
    };
    
    const renderMatchItem = ({ item }) => {
        return (
            <TouchableOpacity 
                style={styles.matchCard}
                onPress={() => navigation.navigate('MatchDetailsScreen', { match: item })}
            >
                <View style={styles.matchHeader}>
                    <View style={styles.matchConfidenceContainer}>
                        <Text style={styles.matchConfidenceLabel}>Match</Text>
                        <Text style={styles.matchConfidenceValue}>{item.matchConfidence}%</Text>
                    </View>
                    <View style={[styles.statusBadge, 
                        { backgroundColor: item.status === 'confirmed' ? '#4CAF50' : '#FFC107' }]}>
                        <Text style={styles.statusText}>
                            {item.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </Text>
                    </View>
                </View>
                
                <View style={styles.matchDetails}>
                    <View style={styles.itemDetail}>
                        <Text style={styles.itemLabel}>Found Item:</Text>
                        <Text style={styles.itemDescription}>{item.foundItemDescription}</Text>
                        <Text style={styles.itemMeta}>
                            Found at {item.foundLocation} on {new Date(item.foundDate).toLocaleDateString()}
                        </Text>
                    </View>
                    
                    <View style={styles.itemDetail}>
                        <Text style={styles.itemLabel}>Lost Item:</Text>
                        <Text style={styles.itemDescription}>
                            {lostItemDescription || item.lostItemDescription}
                        </Text>
                    </View>
                </View>
                
                <View style={styles.founderInfo}>
                    <Image 
                        source={{ uri: item.foundByUser.avatar }} 
                        style={styles.founderAvatar} 
                    />
                    <View style={styles.founderDetails}>
                        <Text style={styles.founderName}>Found by {item.foundByUser.name}</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.contactButton}
                        onPress={() => handleContactOwner(item)}
                    >
                        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                        <Text style={styles.contactButtonText}>Contact</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };
    
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Matches</Text>
                <View style={{ width: 40 }} />
            </View>
            
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.totalMatches}</Text>
                    <Text style={styles.statLabel}>Total Matches</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.pendingMatches}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.confirmedMatches}</Text>
                    <Text style={styles.statLabel}>Confirmed</Text>
                </View>
            </View>
            
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3d0c45" />
                    <Text style={styles.loadingText}>Loading matches...</Text>
                </View>
            ) : matches.length > 0 ? (
                <FlatList
                    data={matches}
                    renderItem={renderMatchItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.matchesList}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Ionicons name="search" size={64} color="#ccc" />
                    <Text style={styles.emptyTitle}>No Matches Found</Text>
                    <Text style={styles.emptyText}>
                        We haven't found any matches for your items yet. 
                        We'll notify you when we find a potential match.
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#3d0c45',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e1e1',
    },
    statCard: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
    matchesList: {
        padding: 16,
    },
    matchCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f0e6f2',
    },
    matchConfidenceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    matchConfidenceLabel: {
        fontSize: 14,
        color: '#666',
        marginRight: 4,
    },
    matchConfidenceValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
    },
    matchDetails: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e1e1e1',
    },
    itemDetail: {
        marginBottom: 12,
    },
    itemLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    itemDescription: {
        fontSize: 16,
        color: '#333',
        marginBottom: 4,
    },
    itemMeta: {
        fontSize: 12,
        color: '#666',
    },
    founderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    founderAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    founderDetails: {
        flex: 1,
    },
    founderName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3d0c45',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    contactButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
});

export default MatchesScreen; 