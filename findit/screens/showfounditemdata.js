import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';

const ShowFoundItemData = ({ route }) => {
    const { lostItemDescription } = route.params;
    const [matchedItems, setMatchedItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMatchedItems = async () => {
            try {
                const response = await fetch(`http://192.168.0.114:5003/matchingfounditems?lostItemDescription=${encodeURIComponent(lostItemDescription)}`);
                const data = await response.json();

                if (response.ok) {
                    setMatchedItems(data);
                } else {
                    console.error('Failed to fetch matching items:', data.message);
                }
            } catch (error) {
                console.error('Error fetching matched items:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMatchedItems();
    }, [lostItemDescription]);

    if (loading) {
        return <ActivityIndicator size="large" color="#4a148c" />;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Matching Found Items</Text>
            <FlatList
                data={matchedItems}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <View style={styles.itemContainer}>
                        <Text style={styles.itemText}>Category: {item.category}</Text>
                        <Text style={styles.itemText}>Description: {item.description}</Text>
                        <Text style={styles.itemText}>Location: {item.location}</Text>
                        <Text style={styles.itemText}>Contact: {item.contact}</Text>
                    </View>
                )}
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
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 20,
    },
    itemContainer: {
        padding: 10,
        borderBottomWidth: 1,
        borderColor: '#ccc',
        marginBottom: 10,
    },
    itemText: {
        fontSize: 16,
        marginBottom: 5,
    },
});

export default ShowFoundItemData;
