import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import API_CONFIG from '../config';

const ShowFoundItemData = ({ route }) => {
    const { lostItemDescription } = route.params;
    const [matchedItems, setMatchedItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [noMatchesFound, setNoMatchesFound] = useState(false);

    useEffect(() => {
        const fetchMatchedItems = async () => {
            try {
                const response = await fetch(`${API_CONFIG.API_URL}/matchingfounditems`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lostItemDescription })
                });
        
                const data = await response.json();
                console.log('Response data:', data); // Log the response data for debugging
        
                if (data.status === 'success') {
                    setMatchedItems(data.matchedItems);
                    setNoMatchesFound(false);
                } else if (data.status === 'not_found') {
                    setNoMatchesFound(true);
                    Alert.alert('No Matches Found', 'No items match your description. Try broadening your search.');
                } else {
                    throw new Error(data.message || 'Unknown error occurred');
                }
            } catch (error) {
                console.error('Error fetching matched items:', error);
                Alert.alert('Error', 'Failed to fetch matching items. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchMatchedItems();
    }, [lostItemDescription]);

    const renderItem = ({ item }) => (
        <View style={styles.itemContainer}>
            <Text style={styles.itemText}>Description: {item.description}</Text>
            <Text style={styles.itemText}>Location: {item.location}</Text>
            <Text style={styles.itemText}>Contact: {item.contact}</Text>
            <Text style={styles.similarityText}>
                Similarity: {(item.similarityScore * 100).toFixed(2)}%
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color="#4a148c" />
                <Text>Searching for matching items...</Text>
            </View>
        );
    }

    if (noMatchesFound) {
        return (
            <View style={styles.centeredContainer}>
                <Text style={styles.noMatchText}>
                    No matching items found. Try describing your item differently.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Matching Found Items</Text>
            <FlatList
                data={matchedItems}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                ListEmptyComponent={
                    <Text style={styles.noMatchText}>
                        No matching items found.
                    </Text>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 20,
    },
    itemContainer: {
        padding: 15,
        borderBottomWidth: 1,
        borderColor: '#ccc',
        marginBottom: 10,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
    },
    itemText: {
        fontSize: 16,
        marginBottom: 5,
        color: '#333',
    },
    similarityText: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    noMatchText: {
        fontSize: 18,
        textAlign: 'center',
        color: '#888',
        marginTop: 20,
    },
});

export default ShowFoundItemData;