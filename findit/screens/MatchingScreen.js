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
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error("Error during matching:", error);
            setError(error.message || 'Failed to check match. Please try again.');
            Alert.alert('Error', 'Matching service is currently unavailable.');
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

            const response = await axios.post(`${API_CONFIG.API_URL}/api/record-match`, {
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
            } else {
                throw new Error('Failed to record match');
            }
        } catch (error) {
            console.error('Error recording match:', error);
            Alert.alert('Error', 'Failed to record match. Please try again.');
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

                    {similarity >= 0.4 && lostItemId && foundItemId && (
                        <TouchableOpacity 
                            style={styles.recordMatchButton}
                            onPress={recordMatch}
                        >
                            <Text style={styles.recordMatchButtonText}>
                                Record this Match
                            </Text>
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
        fontSize: width * 0.035,
        color: '#3d0c45',
        textDecorationLine: 'underline',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(61, 12, 69, 0.1)',
        borderRadius: width * 0.03,
        padding: width * 0.04,
        fontSize: width * 0.04,
        color: '#333',
        minHeight: height * 0.12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    selectedItemText: {
        fontSize: width * 0.03,
        fontStyle: 'italic',
        color: '#28a745',
        marginTop: height * 0.005,
    },
    matchButton: {
        backgroundColor: '#3d0c45',
        padding: height * 0.02,
        borderRadius: width * 0.03,
        alignItems: 'center',
        marginTop: height * 0.02,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    disabledButton: {
        opacity: 0.7,
    },
    matchButtonText: {
        color: '#fff',
        fontSize: width * 0.045,
        fontWeight: 'bold',
    },
    resultContainer: {
        marginTop: height * 0.04,
        padding: width * 0.05,
        backgroundColor: '#fff',
        borderRadius: width * 0.03,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    resultLabel: {
        fontSize: width * 0.04,
        color: '#3d0c45',
        marginBottom: height * 0.01,
    },
    resultScore: {
        fontSize: width * 0.08,
        fontWeight: 'bold',
        marginBottom: height * 0.01,
    },
    resultExplanation: {
        fontSize: width * 0.04,
        color: '#666',
        textAlign: 'center',
        marginBottom: height * 0.02,
    },
    recordMatchButton: {
        backgroundColor: '#28a745',
        paddingVertical: height * 0.015,
        paddingHorizontal: width * 0.06,
        borderRadius: width * 0.02,
        marginTop: height * 0.01,
    },
    recordMatchButtonText: {
        color: '#fff',
        fontSize: width * 0.04,
        fontWeight: '600',
    },
    errorText: {
        color: '#dc3545',
        marginTop: height * 0.02,
        fontSize: width * 0.04,
        textAlign: 'center',
    }
});