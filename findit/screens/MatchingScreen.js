import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    StyleSheet, 
    ActivityIndicator, 
    Alert, 
    Dimensions,
    ScrollView
} from 'react-native';
import axios from 'axios';
import API_CONFIG from '../config';

const { width, height } = Dimensions.get('window');

export default function MatchingScreen({ navigation }) {
    const [lostDesc, setLostDesc] = useState('');
    const [foundDesc, setFoundDesc] = useState('');
    const [similarity, setSimilarity] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [processedText, setProcessedText] = useState(null);
    
    // Add state for lost and found item IDs if they exist
    const [lostItemId, setLostItemId] = useState(null);
    const [foundItemId, setFoundItemId] = useState(null);

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
                timeout: 10000,
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
                timeout: 8000,
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

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Match Descriptions</Text>

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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    contentContainer: {
        padding: width * 0.05,
        paddingBottom: height * 0.05,
    },
    title: {
        fontSize: width * 0.07,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: height * 0.03,
        textAlign: 'center',
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
        minHeight: height * 0.15,
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
    }
});