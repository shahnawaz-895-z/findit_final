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
    RefreshControl
} from 'react-native';
import axios from 'axios';
import API_CONFIG from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

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

    // Add a footer for the FlatList to show loading indicator when loading more data
    const renderFooter = useCallback(() => {
        if (!isLoadingMatches || refreshing) return null;
        return (
            <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color="#3d0c45" />
                <Text style={styles.footerText}>Loading more matches...</Text>
            </View>
        );
    }, [isLoadingMatches, refreshing]);

    // Add function to handle loading more matches when reaching end of list
    const handleLoadMore = useCallback(() => {
        if (!isLoadingMatches && hasMoreMatches && userId) {
            fetchUserMatches(userId);
        }
    }, [isLoadingMatches, hasMoreMatches, userId, fetchUserMatches]);

    // Skeleton screen component for when matches are loading initially
    const MatchSkeleton = useCallback(() => (
        <View style={styles.skeletonContainer}>
            {[1, 2, 3].map((_, index) => (
                <View key={index} style={styles.matchCard}>
                    <View style={styles.matchContent}>
                        <View style={styles.skeletonLine} />
                        <View style={[styles.skeletonLine, { width: '70%' }]} />
                        <View style={styles.skeletonDescription} />
                        <View style={[styles.skeletonLine, { width: '50%' }]} />
                    </View>
                    <View style={styles.skeletonButton} />
                </View>
            ))}
        </View>
    ), []);

    return (
        <View style={styles.container}>
            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[
                        styles.tabButton, 
                        activeTab === 'check' && styles.activeTab
                    ]}
                    onPress={() => setActiveTab('check')}
                >
                    <Text style={[
                        styles.tabButtonText,
                        activeTab === 'check' && styles.activeTabText
                    ]}>
                        Manual Check
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.tabButton, 
                        activeTab === 'view' && styles.activeTab
                    ]}
                    onPress={() => {
                        setActiveTab('view');
                        if (userId) {
                            setPage(1);
                            setHasMoreMatches(true);
                            fetchUserMatches(userId, true);
                        }
                    }}
                >
                    <Text style={[
                        styles.tabButtonText,
                        activeTab === 'view' && styles.activeTabText
                    ]}>
                        View Matches
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Manual Check Content */}
            {activeTab === 'check' && (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer}>
                    <Text style={styles.title}>Manual Match Check</Text>
                    <Text style={styles.subtitle}>
                        This tool is for testing purposes only. To find real matches,
                        please report lost and found items.
                    </Text>

                    <View style={styles.inputContainer}>
                        <View style={styles.inputHeader}>
                            <Text style={styles.label}>Lost Item Description:</Text>
                            <TouchableOpacity onPress={() => browseItems('lost')}>
                                <Text style={styles.browseText}>Browse Items</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.input}
                            value={lostDesc}
                            onChangeText={setLostDesc}
                            placeholder="Enter lost item details"
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            placeholderTextColor="#666"
                        />
                        {lostItemId && (
                            <Text style={styles.selectedItemText}>
                                Item from database selected
                            </Text>
                        )}
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={styles.inputHeader}>
                            <Text style={styles.label}>Found Item Description:</Text>
                            <TouchableOpacity onPress={() => browseItems('found')}>
                                <Text style={styles.browseText}>Browse Items</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.input}
                            value={foundDesc}
                            onChangeText={setFoundDesc}
                            placeholder="Enter found item details"
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            placeholderTextColor="#666"
                        />
                        {foundItemId && (
                            <Text style={styles.selectedItemText}>
                                Item from database selected
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity 
                        style={[styles.matchButton, isLoading && styles.disabledButton]}
                        onPress={checkMatch}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.matchButtonText}>Check Match</Text>
                        )}
                    </TouchableOpacity>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {similarity !== null && !error && (
                        <View style={styles.resultContainer}>
                            <Text style={styles.resultLabel}>Similarity Score:</Text>
                            <Text 
                                style={[
                                    styles.resultScore,
                                    { color: getMatchColor(similarity) }
                                ]}
                            >
                                {(similarity * 100).toFixed(1)}%
                            </Text>
                            
                            <Text style={styles.resultExplanation}>
                                {similarity >= 0.7 ? 
                                    'High probability of a match!' : 
                                    similarity >= 0.4 ? 
                                        'Moderate similarity detected.' : 
                                        'Low similarity. Likely not a match.'}
                            </Text>

                            {processedText && (
                                <View style={styles.processedTextContainer}>
                                    <Text style={styles.processedTextTitle}>Processed Text:</Text>
                                    <View style={styles.processedTextItem}>
                                        <Text style={styles.processedTextLabel}>Lost:</Text>
                                        <Text style={styles.processedTextValue}>{processedText.lost}</Text>
                                    </View>
                                    <View style={styles.processedTextItem}>
                                        <Text style={styles.processedTextLabel}>Found:</Text>
                                        <Text style={styles.processedTextValue}>{processedText.found}</Text>
                                    </View>
                                </View>
                            )}

                            {similarity >= 0.4 && lostItemId && foundItemId && (
                                <TouchableOpacity 
                                    style={styles.recordMatchButton}
                                    onPress={recordMatch}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.recordMatchButtonText}>
                                            Record this Match
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* View Matches Content */}
            {activeTab === 'view' && (
                <View style={styles.tabContent}>
                    <Text style={styles.title}>Your Matches</Text>
                    
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity 
                            style={styles.reportButton}
                            onPress={() => navigateToReport('lost')}
                        >
                            <Text style={styles.reportButtonText}>Report Lost Item</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={styles.reportButton}
                            onPress={() => navigateToReport('found')}
                        >
                            <Text style={styles.reportButtonText}>Report Found Item</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.instruction}>
                        The system automatically matches your reported items with others.
                    </Text>
                    
                    {isLoadingMatches && !refreshing && matches.length === 0 ? (
                        <MatchSkeleton />
                    ) : matches.length === 0 ? (
                        <View style={styles.noMatchesContainer}>
                            <Text style={styles.noMatchesText}>
                                No matches found. Report lost or found items to find potential matches.
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={matches}
                            renderItem={renderMatchItem}
                            keyExtractor={(item, index) => (item._id ? item._id.toString() : `match-${index}`)}
                            contentContainerStyle={styles.matchesList}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    colors={['#3d0c45']}
                                />
                            }
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={renderFooter}
                            windowSize={10} // Reduce rendering window for better performance
                            removeClippedSubviews={true} // Important optimization for large lists
                            maxToRenderPerBatch={5} // Limit number of items rendered per batch
                            initialNumToRender={7} // Limit initial render amount
                            updateCellsBatchingPeriod={50} // Lower the delay before rendering new cells
                        />
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    tabButton: {
        flex: 1,
        paddingVertical: height * 0.02,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#3d0c45',
    },
    tabButtonText: {
        color: '#666',
        fontWeight: '600',
        fontSize: width * 0.04,
    },
    activeTabText: {
        color: '#3d0c45',
        fontWeight: 'bold',
    },
    tabContent: {
        flex: 1,
    },
    contentContainer: {
        padding: width * 0.05,
        paddingBottom: height * 0.05,
    },
    title: {
        fontSize: width * 0.06,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginVertical: height * 0.02,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: width * 0.035,
        color: '#666',
        textAlign: 'center',
        marginBottom: height * 0.02,
    },
    instruction: {
        fontSize: width * 0.035,
        color: '#666',
        textAlign: 'center',
        marginTop: 5,
        marginBottom: 10,
        paddingHorizontal: 15,
    },
    inputContainer: {
        marginBottom: height * 0.02,
    },
    inputHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: height * 0.01,
    },
    label: {
        fontSize: width * 0.04,
        fontWeight: '600',
        color: '#3d0c45',
    },
    browseText: {
        fontSize: width * 0.03,
        color: '#3d0c45',
        textDecorationLine: 'underline',
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
    selectedItemText: {
        fontSize: width * 0.03,
        color: '#3d0c45',
        fontStyle: 'italic',
        marginTop: 5,
    },
    matchButton: {
        backgroundColor: '#3d0c45',
        borderRadius: width * 0.02,
        padding: height * 0.02,
        alignItems: 'center',
        marginTop: height * 0.01,
    },
    disabledButton: {
        opacity: 0.7,
    },
    matchButtonText: {
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
    resultLabel: {
        fontSize: width * 0.04,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    resultScore: {
        fontSize: width * 0.08,
        fontWeight: 'bold',
        marginBottom: height * 0.01,
    },
    resultExplanation: {
        fontSize: width * 0.035,
        color: '#666',
        textAlign: 'center',
        marginBottom: height * 0.02,
    },
    recordMatchButton: {
        backgroundColor: '#28a745',
        borderRadius: width * 0.02,
        paddingVertical: height * 0.015,
        paddingHorizontal: width * 0.05,
        marginTop: height * 0.01,
    },
    recordMatchButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: width * 0.04,
    },
    errorContainer: {
        backgroundColor: '#f8d7da',
        borderColor: '#f5c6cb',
        borderWidth: 1,
        borderRadius: width * 0.02,
        padding: width * 0.03,
        marginTop: height * 0.02,
    },
    errorText: {
        color: '#721c24',
        fontSize: width * 0.035,
        textAlign: 'center',
    },
    processedTextContainer: {
        width: '100%',
        backgroundColor: '#f8f9fa',
        borderRadius: width * 0.02,
        padding: width * 0.03,
        marginTop: height * 0.02,
    },
    processedTextTitle: {
        fontSize: width * 0.035,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: 5,
    },
    processedTextItem: {
        marginTop: 5,
    },
    processedTextLabel: {
        fontSize: width * 0.03,
        fontWeight: 'bold',
        color: '#666',
    },
    processedTextValue: {
        fontSize: width * 0.035,
        color: '#333',
        marginTop: 2,
    },
    // New styles for matches list
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
    noMatchesContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: width * 0.05,
    },
    noMatchesText: {
        color: '#666',
        fontSize: width * 0.04,
        textAlign: 'center',
        lineHeight: width * 0.06,
    },
    matchesList: {
        padding: width * 0.03,
    },
    matchCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#eaeaea',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        flexDirection: 'row',
    },
    matchContent: {
        flex: 1,
        paddingRight: 10,
    },
    matchItemName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: 8,
    },
    categoryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    matchItemCategory: {
        fontSize: 14,
        color: '#555',
        fontWeight: '500',
    },
    descriptionContainer: {
        marginVertical: 5,
        backgroundColor: '#f9f5fd',
        padding: 8,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#3d0c45',
    },
    descriptionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3d0c45',
        marginBottom: 3,
    },
    matchItemDescription: {
        fontSize: 13,
        color: '#444',
        lineHeight: 18,
    },
    matchItemTime: {
        fontSize: 12,
        color: '#888',
        marginTop: 5,
        fontStyle: 'italic',
    },
    scoreContainer: {
        marginTop: 5,
    },
    matchScore: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
    },
    contactButton: {
        backgroundColor: '#3d0c45',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        height: 60,
        width: 70
    },
    contactButtonText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: width * 0.05,
        marginBottom: 10,
    },
    reportButton: {
        backgroundColor: '#3d0c45',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 5,
        minWidth: width * 0.4,
        alignItems: 'center',
    },
    reportButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: width * 0.035,
    },
    footerLoading: {
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
    },
    footerText: {
        color: '#3d0c45',
        marginLeft: 8,
        fontSize: 14,
    },
    skeletonContainer: {
        flex: 1,
        padding: width * 0.03
    },
    skeletonLine: {
        height: 14,
        backgroundColor: '#f0f0f0',
        borderRadius: 7,
        marginBottom: 8,
        width: '100%'
    },
    skeletonDescription: {
        height: 40,
        backgroundColor: '#f0f0f0',
        borderRadius: 5,
        marginVertical: 10
    },
    skeletonButton: {
        height: 60,
        width: 70,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignSelf: 'center'
    }
});