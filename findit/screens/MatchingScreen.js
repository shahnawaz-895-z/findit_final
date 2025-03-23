import React, { useState, useEffect } from 'react';
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

const { width, height } = Dimensions.get('window');

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

    // Fetch user ID on component mount
    useEffect(() => {
        const getUserId = async () => {
            try {
                const userData = await AsyncStorage.getItem('userData');
                if (userData) {
                    const parsed = JSON.parse(userData);
                    setUserId(parsed.id);
                    console.log('User ID found:', parsed.id);
                    // Fetch matches on initial load
                    fetchUserMatches(parsed.id);
                }
            } catch (error) {
                console.error('Error getting user data:', error);
            }
        };
        
        getUserId();
    }, []);
    
    // Handle navigation params if coming from another screen
    useEffect(() => {
        if (route.params?.refresh) {
            // If coming from report page with refresh param, refresh matches
            if (userId) {
                fetchUserMatches(userId);
            }
        }
    }, [route.params]);

    // Fetch matches for the logged-in user
    const fetchUserMatches = async (id) => {
        if (!id) return;
        
        setIsLoadingMatches(true);
        
        try {
            console.log('Fetching matches for user ID:', id);
            console.log('API URL being used:', API_CONFIG.API_URL);
            
            // First try directly getting the user's matches
            try {
                console.log('Making request to:', `${API_CONFIG.API_URL}/api/view-matches?userId=${id}`);
                
                const response = await axios.get(`${API_CONFIG.API_URL}/api/view-matches`, {
                    params: { userId: id },
                    timeout: 20000, // Increased timeout to 20 seconds
                });
                
                if (response.data && response.data.status === 'success') {
                    console.log(`Received ${response.data.matches.length} matches from API`);
                    setMatches(response.data.matches || []);
                } else {
                    console.warn('API returned success=false:', response.data?.message);
                }
            } catch (matchError) {
                console.error('Error fetching user matches:', matchError);
                console.error('Error details:', matchError.message);
                
                // Fallback to all-matches endpoint if view-matches fails
                try {
                    console.log('Trying fallback to /api/dev/all-matches endpoint');
                    const allMatchesResponse = await axios.get(`${API_CONFIG.API_URL}/api/dev/all-matches`, {
                        timeout: 20000
                    });
                    
                    if (allMatchesResponse.data && allMatchesResponse.data.status === 'success') {
                        console.log(`Total matches in database: ${allMatchesResponse.data.totalMatches}`);
                        
                        // Use string comparison for reliable results
                        const userIdStr = id.toString();
                        
                        // Look for matches that should belong to this user
                        const userMatches = allMatchesResponse.data.matches.filter(match => {
                            const lostUserStr = match.lostUserId ? match.lostUserId.toString() : '';
                            const foundUserStr = match.foundUserId ? match.foundUserId.toString() : '';
                            return lostUserStr === userIdStr || foundUserStr === userIdStr;
                        });
                        
                        console.log(`Found ${userMatches.length} matches for user ${id} in all matches`);
                        
                        if (userMatches.length > 0) {
                            setMatches(userMatches);
                        }
                    }
                } catch (allMatchesError) {
                    console.error('Error fetching all matches as fallback:', allMatchesError);
                    throw matchError; // Re-throw the original error
                }
            }
        } catch (error) {
            console.error('Error in match fetching process:', error);
            
            // Show appropriate error message based on error type
            let errorMessage = 'Failed to load your matches. Please try again later.';
            if (error.message && error.message.includes('Network Error')) {
                errorMessage = 'Network connection error. Please check if your backend server is running and accessible from your device.';
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = 'Connection timed out. Server might be temporarily unavailable.';
            }
            
            Alert.alert(
                'Connection Error', 
                errorMessage,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                        text: 'Retry', 
                        onPress: () => {
                            // Retry the fetch operation
                            fetchUserMatches(id);
                        }
                    }
                ]
            );
        } finally {
            setIsLoadingMatches(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchUserMatches(userId);
    };

    const checkMatch = async () => {
        if (!lostDesc.trim() || !foundDesc.trim()) {
            Alert.alert('Error', 'Please enter both descriptions');
            return;
        }
    
        setIsLoading(true);
        setError(null);
        setProcessedText(null);
    
        try {
            const response = await axios.post(`${API_CONFIG.API_URL}/api/match`, {
                lost_desc: lostDesc.trim(),
                found_desc: foundDesc.trim()
            }, {
                timeout: 15000, // Increased timeout
                headers: { 'Content-Type': 'application/json' }
            });
    
            if (response.data && typeof response.data.similarity_score === 'number') {
                setSimilarity(response.data.similarity_score);
                
                // Store processed text if available
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
            console.error("Error during matching:", error);
            
            // Handle different types of errors
            if (error.response) {
                // The server responded with an error status
                const errorMsg = error.response.data?.message || 'Server error';
                setError(errorMsg);
                Alert.alert('Error', errorMsg);
            } else if (error.request) {
                // The request was made but no response was received (timeout)
                setError('Request timeout. The matching service might be down.');
                Alert.alert('Error', 'Matching service is not responding. Please try again later.');
            } else {
                // Something else caused the error
                setError(error.message || 'Failed to check match. Please try again.');
                Alert.alert('Error', 'Matching service is currently unavailable.');
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    // Function to navigate to report screens
    const navigateToReport = (type) => {
        if (type === 'lost') {
            navigation.navigate('ReportLostItem');
        } else {
            navigation.navigate('ReportFoundItem');
        }
    };
    
    const recordMatch = async () => {
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

            const response = await axios.post(`${API_CONFIG.API_URL}/api/record-match`, {
                lostItemId,
                foundItemId,
                similarityScore: similarity
            }, {
                timeout: 15000, // Increased timeout
                headers: { 'Content-Type': 'application/json' }
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
                fetchUserMatches(userId);
                setActiveTab('view');
            } else {
                throw new Error(response.data.message || 'Failed to record match');
            }
        } catch (error) {
            console.error('Error recording match:', error);
            
            const errorMsg = error.response?.data?.message || error.message || 'Failed to record match';
            setError(errorMsg);
            Alert.alert('Error', errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const browseItems = (type) => {
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
    };

    const getMatchColor = (score) => {
        if (score >= 0.7) return '#28a745';  // Green for high match
        if (score >= 0.4) return '#ffc107';  // Yellow for moderate match
        return '#dc3545';  // Red for low match
    };

    // Render a single match item
    const renderMatchItem = ({ item }) => {
        if (!item) return null;
        
        // Log the match item for debugging
        console.log('Rendering match item:', JSON.stringify(item, null, 2));
        
        // Handle both string and object IDs by converting to strings for comparison
        const lostUserIdStr = item.lostUserId ? item.lostUserId.toString() : '';
        const foundUserIdStr = item.foundUserId ? item.foundUserId.toString() : '';
        const userIdStr = userId ? userId.toString() : '';
        
        console.log(`Match item - lostUser: ${lostUserIdStr}, foundUser: ${foundUserIdStr}, currentUser: ${userIdStr}`);
        
        // Determine if the current user is the one who reported the lost item
        const isLostReporter = lostUserIdStr === userIdStr;
        console.log(`User is the lost reporter? ${isLostReporter}`);
        
        // Get the other item and user details
        const relevantItem = isLostReporter ? item.lostItemId : item.foundItemId;
        const otherItem = isLostReporter ? item.foundItemId : item.lostItemId;
        
        // Safety check - if items are missing, show a placeholder
        if (!relevantItem || !otherItem) {
            console.log('Missing item data in match:', item);
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
            <TouchableOpacity 
                style={styles.matchCard}
                onPress={() => viewMatchDetails(item)}
            >
                <View>
                    <Text style={styles.matchItemName}>{matchType}</Text>
                    <Text style={styles.matchItemCategory}>Category: {category}</Text>
                    <Text style={styles.matchItemDescription} numberOfLines={2}>
                        {description}
                    </Text>
                    <Text style={styles.matchItemTime}>
                        Matched on {new Date(item.createdAt || Date.now()).toLocaleDateString()} 
                    </Text>
                    <Text style={styles.matchScore}>
                        Match Confidence: 
                        <Text style={{color: getMatchColor(item.similarityScore || 0)}}>
                            {' '}{((item.similarityScore || 0) * 100).toFixed(1)}%
                        </Text>
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const viewMatchDetails = (match) => {
        // Navigation to view match details could be implemented here
        Alert.alert(
            'Match Details',
            `This match has a similarity score of ${(match.similarityScore * 100).toFixed(1)}%.`,
            [{ text: 'OK' }]
        );
    };

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
                        fetchUserMatches(userId);
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
                    
                    {isLoadingMatches && !refreshing ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3d0c45" />
                            <Text style={styles.loadingText}>Loading matches...</Text>
                        </View>
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
                            keyExtractor={(item) => item._id.toString()}
                            contentContainerStyle={styles.matchesList}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    colors={['#3d0c45']}
                                />
                            }
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
        borderRadius: width * 0.02,
        padding: width * 0.04,
        marginBottom: height * 0.02,
        borderWidth: 1,
        borderColor: '#ddd',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    matchItemName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    matchItemCategory: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    matchItemDescription: {
        fontSize: 14,
        color: '#555',
        marginBottom: 4,
        lineHeight: 20,
    },
    matchItemTime: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
    },
    matchScore: {
        fontSize: width * 0.035,
        fontWeight: '600',
        marginBottom: 5,
    },
    matchItemUser: {
        fontSize: width * 0.035,
        color: '#333',
        marginTop: 5,
    },
    // New action buttons
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
    }
});