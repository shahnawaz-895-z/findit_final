import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    StyleSheet, 
    ActivityIndicator, 
    Alert, 
    Dimensions,
    ScrollView,
    FlatList,
    RefreshControl,
    StatusBar,
    SafeAreaView,
    Platform
} from 'react-native';
import axios from 'axios';
import API_CONFIG from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

// Create a regular axios instance instead of using useMemo outside component
const api = axios.create({
    baseURL: API_CONFIG.API_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default function MatchingScreen({ navigation, route }) {
    const [activeTab, setActiveTab] = useState('view'); // Default to view matches tab
    const [lostDesc, setLostDesc] = useState('');
    const [foundDesc, setFoundDesc] = useState('');
    const [similarity, setSimilarity] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMatches, setIsLoadingMatches] = useState(false);
    const [error, setError] = useState(null);
    const [processedText, setProcessedText] = useState(null);
    const [userId, setUserId] = useState(null);
    const [matches, setMatches] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    
    // Add state for lost and found item IDs if they exist
    const [lostItemId, setLostItemId] = useState(null);
    const [foundItemId, setFoundItemId] = useState(null);
    
    // Add pagination support for better performance
    const [page, setPage] = useState(1);
    const [hasMoreMatches, setHasMoreMatches] = useState(true);

    // Custom StatusBar component to ensure visibility
    const CustomStatusBar = ({backgroundColor, ...props}) => (
        <View style={[styles.statusBar, { backgroundColor }]}>
            <StatusBar translucent backgroundColor={backgroundColor} {...props} />
        </View>
    );

    // Fetch user ID on component mount - using useCallback
    const getUserId = useCallback(async () => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
                const parsed = JSON.parse(userData);
                setUserId(parsed.id);
                return parsed.id;
            }
            return null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }, []);

    // Use a separate effect for initial loading
    useEffect(() => {
        const loadInitialData = async () => {
            const id = await getUserId();
            if (id) {
                fetchUserMatches(id);
            }
        };
        
        loadInitialData();
    }, [getUserId]);
    
    // Handle navigation params if coming from another screen
    useEffect(() => {
        if (route.params?.refresh && userId) {
            // Reset pagination when refreshing
            setPage(1);
            setHasMoreMatches(true);
            fetchUserMatches(userId, true);
        }
    }, [route.params, userId]);

    // Optimize fetchUserMatches with useCallback to prevent recreation
    const fetchUserMatches = useCallback(async (id, isRefresh = false) => {
        if (!id) return;
        
        if (isRefresh) {
            setPage(1);
            setMatches([]);
        }
        
        if (!hasMoreMatches && !isRefresh) return;
        
        setIsLoadingMatches(true);
        
        try {
            const response = await api.get('/api/view-matches', {
                params: { 
                    userId: id,
                    page: isRefresh ? 1 : page,
                    limit: 10 // Implement pagination with smaller chunks
                }
            });
            
            if (response.data && response.data.status === 'success') {
                const newMatches = response.data.matches || [];
                
                // When refreshing, replace all matches
                // Otherwise, append new matches to existing ones
                if (isRefresh) {
                    setMatches(newMatches);
                } else {
                    setMatches(prevMatches => [...prevMatches, ...newMatches]);
                }
                
                // Check if we've reached the end
                setHasMoreMatches(newMatches.length === 10);
                
                if (!isRefresh) {
                    setPage(prev => prev + 1);
                }
            } else {
                // Only try fallback on first page load or refresh
                if (isRefresh || page === 1) {
                    await tryFallbackMatchFetch(id);
                }
            }
        } catch (error) {
            // Only try fallback on first page load or refresh
            if (isRefresh || page === 1) {
                await tryFallbackMatchFetch(id);
            } else {
                handleFetchError(error);
            }
        } finally {
            setIsLoadingMatches(false);
            setRefreshing(false);
        }
    }, [api, page, hasMoreMatches]);
    
    // Extract fallback logic to a separate function
    const tryFallbackMatchFetch = useCallback(async (id) => {
        try {
            const allMatchesResponse = await api.get('/api/dev/all-matches');
            
            if (allMatchesResponse.data && allMatchesResponse.data.status === 'success') {
                const userIdStr = id.toString();
                
                const userMatches = allMatchesResponse.data.matches.filter(match => {
                    const lostUserStr = match.lostUserId ? match.lostUserId.toString() : '';
                    const foundUserStr = match.foundUserId ? match.foundUserId.toString() : '';
                    return lostUserStr === userIdStr || foundUserStr === userIdStr;
                });
                
                if (userMatches.length > 0) {
                    setMatches(userMatches);
                }
            }
        } catch (fallbackError) {
            handleFetchError(fallbackError);
        }
    }, [api]);
    
    // Handle fetch errors consistently
    const handleFetchError = useCallback((error) => {
        let errorMessage = 'Failed to load your matches. Please try again later.';
        if (error.message && error.message.includes('Network Error')) {
            errorMessage = 'Network connection error. Please check your internet connection.';
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = 'Connection timed out. Server might be temporarily unavailable.';
        }
        
        Alert.alert(
            'Connection Error', 
            errorMessage,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Retry', onPress: () => fetchUserMatches(userId, true) }
            ]
        );
    }, [userId, fetchUserMatches]);

    // Optimize onRefresh with useCallback
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchUserMatches(userId, true);
    }, [userId, fetchUserMatches]);

    // Optimize checkMatch with useCallback
    const checkMatch = useCallback(async () => {
        if (!lostDesc.trim() || !foundDesc.trim()) {
            Alert.alert('Error', 'Please enter both descriptions');
            return;
        }
    
        setIsLoading(true);
        setError(null);
        setProcessedText(null);
    
        try {
            const response = await api.post('/api/match', {
                lost_desc: lostDesc.trim(),
                found_desc: foundDesc.trim()
            });
    
            if (response.data && typeof response.data.similarity_score === 'number') {
                setSimilarity(response.data.similarity_score);
                
                if (response.data.preprocessed_lost && response.data.preprocessed_found) {
                    setProcessedText({
                        lost: response.data.preprocessed_lost,
                        found: response.data.preprocessed_found
                    });
                }
            } else if (response.data && response.data.error) {
                throw new Error(response.data.error);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            handleApiError(error);
        } finally {
            setIsLoading(false);
        }
    }, [api, lostDesc, foundDesc]);
    
    // Consolidated error handling function
    const handleApiError = useCallback((error) => {
        console.error("API Error:", error);
        
        if (error.response) {
            const errorMsg = error.response.data?.message || 'Server error';
            setError(errorMsg);
            Alert.alert('Error', errorMsg);
        } else if (error.request) {
            setError('Request timeout. The service might be down.');
            Alert.alert('Error', 'Service is not responding. Please try again later.');
        } else {
            setError(error.message || 'Failed to process request. Please try again.');
            Alert.alert('Error', 'Service is currently unavailable.');
        }
    }, []);
    
    // Function to navigate to report screens - optimized with useCallback
    const navigateToReport = useCallback((type) => {
        if (type === 'lost') {
            navigation.navigate('ReportLostItem');
        } else {
            navigation.navigate('ReportFoundItem');
        }
    }, [navigation]);
    
    // Optimize recordMatch with useCallback
    const recordMatch = useCallback(async () => {
        if (!similarity || similarity < 0.4) {
            Alert.alert('Low Similarity', 'The similarity score is too low to record a match.');
            return;
        }

        if (!lostItemId || !foundItemId) {
            Alert.alert('Info', 'This is just a description comparison. To record a match, select items from the database.');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const response = await api.post('/api/record-match', {
                lostItemId,
                foundItemId,
                similarityScore: similarity
            });

            if (response.data.status === 'success') {
                Alert.alert('Success', 'Match recorded successfully!');
                
                // Clear the form
                setLostDesc('');
                setFoundDesc('');
                setSimilarity(null);
                setLostItemId(null);
                setFoundItemId(null);
                setProcessedText(null);
                
                // Refresh the matches list if we're going to view tab
                setPage(1);
                setHasMoreMatches(true);
                fetchUserMatches(userId, true);
                setActiveTab('view');
            } else {
                throw new Error(response.data.message || 'Failed to record match');
            }
        } catch (error) {
            handleApiError(error);
        } finally {
            setIsLoading(false);
        }
    }, [api, similarity, lostItemId, foundItemId, userId, fetchUserMatches]);

    // Optimize browseItems with useCallback
    const browseItems = useCallback((type) => {
        navigation.navigate('ItemsListScreen', {
            itemType: type,
            onItemSelect: (item) => {
                if (type === 'lost') {
                    setLostDesc(item.description);
                    setLostItemId(item._id);
                } else {
                    setFoundDesc(item.description);
                    setFoundItemId(item._id);
                }
            }
        });
    }, [navigation]);

    // Optimize getMatchColor with useMemo
    const getMatchColor = useCallback((score) => {
        if (score >= 0.7) return '#28a745';  // Green for high match
        if (score >= 0.4) return '#ffc107';  // Yellow for moderate match
        return '#dc3545';  // Red for low match
    }, []);

    // Optimize navigateToChat with useCallback
    const navigateToChat = useCallback(async (match) => {
        // Handle both string and object IDs by converting to strings for comparison
        const lostUserIdStr = match.lostUserId ? match.lostUserId.toString() : '';
        const foundUserIdStr = match.foundUserId ? match.foundUserId.toString() : '';
        const userIdStr = userId ? userId.toString() : '';
        
        // Determine the other user's ID based on which user is the current user
        const otherUserId = lostUserIdStr === userIdStr ? foundUserIdStr : lostUserIdStr;
        
        if (!otherUserId) {
            Alert.alert('Error', 'Could not determine the other user to contact.');
            return;
        }
        
        try {
            // Try to get other user's details from stored user data
            let otherUserName = null;
            
            // First check if we have user details in the match
            const isLostReporter = lostUserIdStr === userIdStr;
            if (isLostReporter && match.foundUserDetails) {
                otherUserName = match.foundUserDetails.username || match.foundUserDetails.email;
            } else if (!isLostReporter && match.lostUserDetails) {
                otherUserName = match.lostUserDetails.username || match.lostUserDetails.email;
            }
            
            // If we don't have user details from match, try to get from the database
            if (!otherUserName) {
                try {
                    const response = await api.get('/api/users');
                    if (response.data && Array.isArray(response.data.users)) {
                        const otherUser = response.data.users.find(user => 
                            user._id === otherUserId || 
                            (user._id && user._id.toString() === otherUserId) ||
                            user.id === otherUserId ||
                            (user.id && user.id.toString() === otherUserId)
                        );
                        
                        if (otherUser) {
                            otherUserName = otherUser.username || otherUser.email || otherUser.name;
                        }
                    }
                } catch (error) {
                    console.log('Error fetching user data:', error);
                }
            }
            
            // If we still don't have a username, use a generic one with item category
            if (!otherUserName) {
                const otherItem = isLostReporter ? match.foundItemId : match.lostItemId;
                if (otherItem && otherItem.category) {
                    otherUserName = `${otherItem.category} ${isLostReporter ? 'Finder' : 'Owner'}`;
                } else {
                    otherUserName = 'Contact User';
                }
            }
            
            // Create a proper user object to pass to ChatScreen
            const userObject = {
                id: otherUserId,
                _id: otherUserId, // Include both formats for compatibility
                name: otherUserName,
                avatar: null // You can add logic to get avatar if available
            };
            
            // Navigate to chat screen with the user object
            navigation.navigate('ChatScreen', { 
                user: userObject,
                otherUserId: otherUserId,
                matchId: match._id || match.id,
                userName: otherUserName,
                match: match // Pass the whole match for additional context
            });
        } catch (error) {
            console.error('Error preparing chat navigation:', error);
            // Fallback to basic navigation with minimal info
            navigation.navigate('ChatScreen', { 
                user: {
                    id: otherUserId,
                    _id: otherUserId,
                    name: 'Contact User',
                    avatar: null
                },
                otherUserId: otherUserId,
                matchId: match._id || match.id
            });
        }
    }, [api, userId, navigation]);

    // Optimize renderMatchItem with useCallback
    const renderMatchItem = useCallback(({ item }) => {
        if (!item) return null;
        
        // Handle both string and object IDs by converting to strings for comparison
        const lostUserIdStr = item.lostUserId ? item.lostUserId.toString() : '';
        const foundUserIdStr = item.foundUserId ? item.foundUserId.toString() : '';
        const userIdStr = userId ? userId.toString() : '';
        
        // Determine if the current user is the one who reported the lost item
        const isLostReporter = lostUserIdStr === userIdStr;
        
        // Get the other item and user details
        const relevantItem = isLostReporter ? item.lostItemId : item.foundItemId;
        const otherItem = isLostReporter ? item.foundItemId : item.lostItemId;
        
        // Safety check - if items are missing, show a placeholder
        if (!relevantItem || !otherItem) {
            return (
                <View style={styles.matchCard}>
                    <Text style={styles.matchItemName}>Incomplete Match Data</Text>
                    <Text style={styles.matchItemCategory}>
                        This match seems to be missing some information.
                    </Text>
                </View>
            );
        }

        // Construct a friendly description of the match
        const matchType = isLostReporter ? 
            "Someone found an item similar to what you lost" : 
            "Someone lost an item similar to what you found";
        
        // Get category and details
        const category = otherItem.category || 'Unknown category';
        const description = otherItem.description || 'No description available';
        
        return (
            <View style={styles.matchCard}>
                <View style={styles.matchContent}>
                    <Text style={styles.matchItemName}>{matchType}</Text>
                    <View style={styles.categoryContainer}>
                        <Ionicons name="pricetag" size={16} color="#3d0c45" style={{marginRight: 5}} />
                        <Text style={styles.matchItemCategory}>{category}</Text>
                    </View>
                    <View style={styles.descriptionContainer}>
                        <Text style={styles.descriptionLabel}>Description:</Text>
                        <Text style={styles.matchItemDescription} numberOfLines={2}>
                            {description}
                        </Text>
                    </View>
                    <Text style={styles.matchItemTime}>
                        Matched on {new Date(item.createdAt || Date.now()).toLocaleDateString()} 
                    </Text>
                    <View style={styles.scoreContainer}>
                        <Text style={styles.matchScore}>
                            Match Confidence: 
                            <Text style={{color: getMatchColor(item.similarityScore || 0)}}>
                                {' '}{((item.similarityScore || 0) * 100).toFixed(1)}%
                            </Text>
                        </Text>
                    </View>
                </View>
                
                <TouchableOpacity 
                    style={styles.contactButton}
                    onPress={() => navigateToChat(item)}
                >
                    <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                    <Text style={styles.contactButtonText}>Contact</Text>
                </TouchableOpacity>
            </View>
        );
    }, [userId, getMatchColor, navigateToChat]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <CustomStatusBar backgroundColor="#3d0c45" barStyle="light-content" />
            
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Match Items</Text>
                <View style={{width: 40}} />
            </View>
            
            <View style={styles.container}>
                {/* Tab navigation */}
                <View style={styles.tabs}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'view' && styles.activeTab]}
                        onPress={() => setActiveTab('view')}
                    >
                        <Text style={[styles.tabText, activeTab === 'view' && styles.activeTabText]}>
                            View Matches
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'check' && styles.activeTab]}
                        onPress={() => setActiveTab('check')}
                    >
                        <Text style={[styles.tabText, activeTab === 'check' && styles.activeTabText]}>
                            Check Match
                        </Text>
                    </TouchableOpacity>
                </View>
                
                {/* View matches tab */}
                {activeTab === 'view' && (
                    <View style={styles.matchesContainer}>
                        {isLoadingMatches && matches.length === 0 ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#3d0c45" />
                                <Text style={styles.loadingText}>Loading your matches...</Text>
                            </View>
                        ) : matches.length > 0 ? (
                            <FlatList
                                data={matches}
                                renderItem={renderMatchItem}
                                keyExtractor={item => item._id}
                                contentContainerStyle={styles.matchesList}
                                refreshControl={
                                    <RefreshControl
                                        refreshing={refreshing}
                                        onRefresh={onRefresh}
                                        colors={['#3d0c45']}
                                    />
                                }
                                onEndReached={() => fetchUserMatches(userId)}
                                onEndReachedThreshold={0.5}
                                ListFooterComponent={
                                    isLoadingMatches && matches.length > 0 ? (
                                        <ActivityIndicator 
                                            size="small" 
                                            color="#3d0c45" 
                                            style={styles.footerLoader} 
                                        />
                                    ) : null
                                }
                            />
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="search" size={64} color="#ccc" />
                                <Text style={styles.emptyText}>
                                    No matches found
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    When potential matches for your items are found, they will appear here.
                                </Text>
                                <TouchableOpacity 
                                    style={styles.refreshButton}
                                    onPress={onRefresh}
                                >
                                    <Text style={styles.refreshButtonText}>Refresh</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                
                {/* Check match tab */}
                {activeTab === 'check' && (
                    <ScrollView 
                        style={styles.checkContainer}
                        contentContainerStyle={styles.checkContent}
                    >
                        <Text style={styles.checkTitle}>
                            Compare Descriptions
                        </Text>
                        <Text style={styles.checkSubtitle}>
                            Enter the descriptions of a lost and found item to check if they might be a match
                        </Text>
                        
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Lost Item Description</Text>
                            <TextInput
                                style={styles.input}
                                multiline
                                value={lostDesc}
                                onChangeText={setLostDesc}
                                placeholder="Enter the lost item description..."
                                placeholderTextColor="#999"
                            />
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Found Item Description</Text>
                            <TextInput
                                style={styles.input}
                                multiline
                                value={foundDesc}
                                onChangeText={setFoundDesc}
                                placeholder="Enter the found item description..."
                                placeholderTextColor="#999"
                            />
                        </View>
                        
                        <TouchableOpacity 
                            style={styles.checkButton}
                            onPress={checkMatch}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.checkButtonText}>Check Match</Text>
                            )}
                        </TouchableOpacity>
                        
                        {similarity !== null && (
                            <View style={styles.resultContainer}>
                                <Text style={styles.resultTitle}>
                                    Match Result:
                                </Text>
                                <View style={styles.resultBarContainer}>
                                    <View 
                                        style={[
                                            styles.resultBar, 
                                            { width: `${similarity * 100}%` },
                                            { backgroundColor: getMatchColor(similarity) }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.resultPercent}>
                                    {Math.round(similarity * 100)}% match
                                </Text>
                                <Text style={styles.resultConfidence}>
                                    {similarity >= 0.7 ? 'High probability of a match!' : similarity >= 0.4 ? 'Moderate similarity detected.' : 'Low similarity. Likely not a match.'}
                                </Text>
                                {processedText && (
                                    <View style={styles.processedContainer}>
                                        <Text style={styles.processedTitle}>Processing Details:</Text>
                                        <Text style={styles.processedText}>{processedText.lost}</Text>
                                        <Text style={styles.processedText}>{processedText.found}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#3d0c45',
    },
    statusBar: {
        height: STATUSBAR_HEIGHT,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#3d0c45',
        paddingVertical: 16,
        paddingHorizontal: 16,
        paddingTop: STATUSBAR_HEIGHT + 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    backButton: {
        padding: 8,
    },
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    tab: {
        flex: 1,
        paddingVertical: height * 0.02,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#3d0c45',
    },
    tabText: {
        color: '#666',
        fontWeight: '600',
        fontSize: width * 0.04,
    },
    activeTabText: {
        color: '#3d0c45',
        fontWeight: 'bold',
    },
    matchesContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: width * 0.04,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: width * 0.05,
    },
    emptyText: {
        color: '#666',
        fontSize: width * 0.04,
        textAlign: 'center',
        lineHeight: width * 0.06,
    },
    emptySubtext: {
        color: '#666',
        fontSize: width * 0.035,
        textAlign: 'center',
        marginTop: 5,
        marginBottom: 10,
    },
    refreshButton: {
        backgroundColor: '#3d0c45',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 5,
        minWidth: width * 0.4,
        alignItems: 'center',
    },
    refreshButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: width * 0.035,
    },
    checkContainer: {
        flex: 1,
    },
    checkContent: {
        padding: width * 0.05,
        paddingBottom: height * 0.05,
    },
    checkTitle: {
        fontSize: width * 0.06,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginVertical: height * 0.02,
        textAlign: 'center',
    },
    checkSubtitle: {
        fontSize: width * 0.035,
        color: '#666',
        textAlign: 'center',
        marginBottom: height * 0.02,
    },
    inputContainer: {
        marginBottom: height * 0.02,
    },
    inputLabel: {
        fontSize: width * 0.04,
        fontWeight: '600',
        color: '#3d0c45',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: width * 0.02,
        padding: width * 0.03,
        fontSize: width * 0.04,
        minHeight: height * 0.12,
        color: '#333',
    },
    checkButton: {
        backgroundColor: '#3d0c45',
        borderRadius: width * 0.02,
        padding: height * 0.02,
        alignItems: 'center',
        marginTop: height * 0.01,
    },
    checkButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: width * 0.045,
    },
    resultContainer: {
        backgroundColor: '#fff',
        borderRadius: width * 0.02,
        padding: width * 0.04,
        marginTop: height * 0.03,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    resultTitle: {
        fontSize: width * 0.04,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    resultBarContainer: {
        backgroundColor: '#f0f0f0',
        borderRadius: width * 0.02,
        padding: 2,
        marginBottom: 10,
    },
    resultBar: {
        height: 20,
        backgroundColor: '#3d0c45',
        borderRadius: width * 0.01,
    },
    resultPercent: {
        fontSize: width * 0.08,
        fontWeight: 'bold',
        marginBottom: height * 0.01,
    },
    resultConfidence: {
        fontSize: width * 0.035,
        color: '#666',
        textAlign: 'center',
        marginBottom: height * 0.02,
    },
    processedContainer: {
        width: '100%',
        backgroundColor: '#f8f9fa',
        borderRadius: width * 0.02,
        padding: width * 0.03,
        marginTop: height * 0.02,
    },
    processedTitle: {
        fontSize: width * 0.035,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: 5,
    },
    processedText: {
        fontSize: width * 0.035,
        color: '#333',
        marginTop: 2,
    },
    matchesList: {
        padding: width * 0.03,
    },
    footerLoader: {
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
    }
});