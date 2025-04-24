import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import API_CONFIG from '../config';

const ItemDetailsScreen = ({ route, navigation }) => {
  const { itemId, itemType } = route.params;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reposting, setReposting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    fetchItemDetails();
  }, []);

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      
      const url = `${API_CONFIG.API_URL}/${itemType === 'lost' ? 'lostitem' : 'founditem'}/${itemId}`;
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setItem(data.item);
      } else {
        setError(data.message || 'Failed to fetch item details');
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
      setError('Failed to fetch item details');
    } finally {
      setLoading(false);
    }
  };

  const handleRepostItem = async () => {
    try {
      setReposting(true);
      
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Authentication Error', 'You need to be logged in to repost an item.');
        return;
      }

      const url = `${API_CONFIG.API_URL}/repost-lost-item/${itemId}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'Success',
          'Your item has been reposted. We will notify you if it matches with any found items.',
          [{ text: 'OK', onPress: fetchItemDetails }]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to repost item');
      }
    } catch (error) {
      console.error('Error reposting item:', error);
      Alert.alert('Error', 'An error occurred while reposting the item');
    } finally {
      setReposting(false);
    }
  };

  const handleReturnItem = async () => {
    try {
      // Confirm with the user that they want to mark the item as returned
      Alert.alert(
        'Return Item',
        `Are you sure you want to mark this ${itemType} item as returned? This will remove it from the active ${itemType} items list.`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Yes, Return Item',
            onPress: async () => {
              try {
                setReturning(true);
                
                const token = await AsyncStorage.getItem('authToken');
                if (!token) {
                  Alert.alert('Authentication Error', 'You need to be logged in to return an item.');
                  return;
                }
                
                const url = `${API_CONFIG.API_URL}/return-item`;
                
                const response = await fetch(url, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    itemId: itemId,
                    itemType: itemType,
                    returnNotes: 'Item returned by user'
                  })
                });
                
                let data;
                try {
                  const textResponse = await response.text();
                  try {
                    data = JSON.parse(textResponse);
                  } catch (parseError) {
                    console.error('Error parsing server response as JSON:', parseError);
                    console.error('Server response:', textResponse);
                    throw new Error('Server returned an invalid response format');
                  }
                } catch (responseError) {
                  console.error('Error reading server response:', responseError);
                  throw new Error('Failed to process server response');
                }
                
                if (response.ok) {
                  Alert.alert(
                    'Success',
                    `This ${itemType} item has been marked as returned and removed from the active list.`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                  );
                } else {
                  Alert.alert('Error', data.message || 'Failed to return item');
                }
              } catch (error) {
                console.error('Error returning item:', error);
                Alert.alert('Error', error.message || 'An error occurred while returning the item');
              } finally {
                setReturning(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleReturnItem:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    const time = new Date(timeString);
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3d0c45" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={64} color="#dc3545" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="information-outline" size={64} color="#6c757d" />
        <Text style={styles.errorText}>Item not found</Text>
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon 
          name={itemType === 'lost' ? 'help-circle-outline' : 'checkbox-marked-circle-outline'} 
          size={24} 
          color="#3d0c45" 
        />
        <Text style={styles.headerTitle}>
          {itemType === 'lost' ? 'Lost Item' : 'Found Item'}
        </Text>
      </View>

      {/* Photo section */}
      {item.photo && typeof item.photo === 'string' && item.photo.length > 0 && !imageError ? (
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: `data:image/jpeg;base64,${item.photo}` }}
            style={styles.itemImage}
            resizeMode="cover"
            onError={() => {
              console.error('Error loading image');
              setImageError(true);
            }}
          />
        </View>
      ) : (
        <View style={[styles.imageContainer, styles.noImageContainer]}>
          <Icon name="image-off" size={50} color="#ccc" />
          <Text style={styles.noImageText}>
            {imageError ? 'Failed to load image' : 'No image available'}
          </Text>
        </View>
      )}

      <View style={styles.detailsContainer}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        
        <View style={styles.infoRow}>
          <Icon name="shape-outline" size={20} color="#555" />
          <Text style={styles.infoLabel}>Category:</Text>
          <Text style={styles.infoText}>{item.category}</Text>
        </View>

        <View style={styles.infoRow}>
          <Icon name="map-marker-outline" size={20} color="#555" />
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoText}>{item.location}</Text>
        </View>

        <View style={styles.infoRow}>
          <Icon name="calendar-outline" size={20} color="#555" />
          <Text style={styles.infoLabel}>Date:</Text>
          <Text style={styles.infoText}>{formatDate(item.date)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Icon name="clock-outline" size={20} color="#555" />
          <Text style={styles.infoLabel}>Time:</Text>
          <Text style={styles.infoText}>{formatTime(item.time)}</Text>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionLabel}>Description:</Text>
          <Text style={styles.descriptionText}>{item.description}</Text>
        </View>

        {/* Category-specific details */}
        {item.category === 'Electronics' && (
          <View style={styles.categoryDetailsContainer}>
            <Text style={styles.categoryTitle}>Electronics Details</Text>
            {item.brand && (
              <View style={styles.infoRow}>
                <Icon name="tag-outline" size={20} color="#555" />
                <Text style={styles.infoLabel}>Brand:</Text>
                <Text style={styles.infoText}>{item.brand}</Text>
              </View>
            )}
            {item.model && (
              <View style={styles.infoRow}>
                <Icon name="information-outline" size={20} color="#555" />
                <Text style={styles.infoLabel}>Model:</Text>
                <Text style={styles.infoText}>{item.model}</Text>
              </View>
            )}
            {item.color && (
              <View style={styles.infoRow}>
                <Icon name="palette-outline" size={20} color="#555" />
                <Text style={styles.infoLabel}>Color:</Text>
                <Text style={styles.infoText}>{item.color}</Text>
              </View>
            )}
          </View>
        )}

        {/* Repost button - only for lost items */}
        {itemType === 'lost' && (
          <View style={styles.repostContainer}>
            <Text style={styles.repostTitle}>
              Can't find your item? Repost to expand your search reach.
            </Text>
            <TouchableOpacity
              style={styles.repostButton}
              onPress={handleRepostItem}
              disabled={reposting}
            >
              {reposting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="refresh" size={20} color="#fff" style={styles.repostIcon} />
                  <Text style={styles.repostButtonText}>Repost This Item</Text>
                </>
              )}
            </TouchableOpacity>
            {item.repostedAt && (
              <Text style={styles.repostedText}>
                Last reposted: {formatDate(item.repostedAt)}
              </Text>
            )}
          </View>
        )}

        {/* Contact information */}
        <View style={styles.contactContainer}>
          <Text style={styles.contactTitle}>Contact Information</Text>
          <Text style={styles.contactText}>{item.contact}</Text>
        </View>

        {/* Return Item button */}
        <View style={styles.returnContainer}>
          <Text style={styles.returnTitle}>
            Has this item been returned to its owner?
          </Text>
          <TouchableOpacity
            style={styles.returnButton}
            onPress={handleReturnItem}
            disabled={returning}
          >
            {returning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="checkbox-marked-circle-outline" size={20} color="#fff" style={styles.returnIcon} />
                <Text style={styles.returnButtonText}>Mark as Returned</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.buttonContainer}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3d0c45',
    marginLeft: 10,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    padding: 16,
  },
  itemName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
    marginRight: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    flex: 1,
  },
  descriptionContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  categoryDetailsContainer: {
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  contactContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 16,
    color: '#555',
  },
  buttonContainer: {
    backgroundColor: '#3d0c45',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 16,
    color: '#ccc',
  },
  repostContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9f1fe',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9d8f4',
  },
  repostTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  repostButton: {
    backgroundColor: '#3d0c45',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repostButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  repostIcon: {
    marginRight: 8,
  },
  repostedText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  returnContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9f1fe',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9d8f4',
  },
  returnTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  returnButton: {
    backgroundColor: '#3d0c45',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  returnButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  returnIcon: {
    marginRight: 8,
  },
});

export default ItemDetailsScreen; 