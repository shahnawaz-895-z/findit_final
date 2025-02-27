import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    KeyboardAvoidingView,
    Platform,
    Modal,
    FlatList,
    Image,
    StyleSheet,
    Dimensions
} from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const ChatScreen = ({ route, navigation }) => {
    const [messages, setMessages] = useState([]);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMessages([
            {
                _id: 1,
                text: 'Hello! How can I help you?',
                createdAt: new Date(),
                user: {
                    _id: 2,
                    name: 'Support',
                    avatar: 'https://placeimg.com/140/140/any',
                },
            },
        ]);
    }, []);

    const onSend = useCallback((newMessages = []) => {
        setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
    }, []);

    const searchUsers = async (query) => {
        try {
            setLoading(true);
            const response = await fetch(`http://192.168.18.18:5000/search-users?query=${query}`);
            const data = await response.json();
            if (data.status === 'success') {
                setSearchResults(data.users);
            }
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserSelect = (user) => {
        setSearchVisible(false);
        // Here you would typically start a new chat with the selected user
        // This could involve creating a new chat room, etc.
        navigation.navigate('ChatScreen', { user });
    };

    const renderSearchItem = ({ item }) => (
        <TouchableOpacity
            style={styles.searchItem}
            onPress={() => handleUserSelect(item)}
        >
            {item.profileImage ? (
                <Image
                    source={{ uri: `data:${item.profileImageType};base64,${item.profileImage}` }}
                    style={styles.searchAvatar}
                />
            ) : (
                <View style={[styles.searchAvatar, styles.placeholderAvatar]}>
                    <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
                </View>
            )}
            <View style={styles.searchItemText}>
                <Text style={styles.searchItemName}>{item.name}</Text>
                <Text style={styles.searchItemEmail}>{item.email}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setSearchVisible(true)}>
                    <Ionicons name="search" size={24} color="#3b0b40" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chat</Text>
            </View>

            <GiftedChat
                messages={messages}
                onSend={(messages) => onSend(messages)}
                user={{ _id: 1 }}
                renderBubble={(props) => (
                    <Bubble
                        {...props}
                        wrapperStyle={{
                            right: { backgroundColor: '#3b0b40' },
                            left: { backgroundColor: '#f0f0f0' },
                        }}
                    />
                )}
                renderInputToolbar={(props) => <InputToolbar {...props} />}
                renderSend={(props) => (
                    <Send {...props}>
                        <View style={styles.sendButton}>
                            <Ionicons name="send" size={24} color="#3b0b40" />
                        </View>
                    </Send>
                )}
            />

            <Modal
                visible={searchVisible}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.searchContainer}>
                        <View style={styles.searchHeader}>
                            <TouchableOpacity 
                                onPress={() => setSearchVisible(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#3b0b40" />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search users..."
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    if (text.length > 2) {
                                        searchUsers(text);
                                    }
                                }}
                            />
                        </View>
                        <FlatList
                            data={searchResults}
                            renderItem={renderSearchItem}
                            keyExtractor={(item) => item._id}
                            ListEmptyComponent={
                                searchQuery.length > 2 && !loading && (
                                    <Text style={styles.noResults}>No users found</Text>
                                )
                            }
                        />
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: width * 0.04,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: width * 0.045,
        fontWeight: 'bold',
        marginLeft: width * 0.04,
        color: '#3b0b40',
    },
    sendButton: {
        marginRight: width * 0.025,
        marginBottom: height * 0.006,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    searchContainer: {
        flex: 1,
        backgroundColor: '#fff',
        marginTop: height * 0.06,
        borderTopLeftRadius: width * 0.05,
        borderTopRightRadius: width * 0.05,
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: width * 0.04,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    closeButton: {
        padding: 5,
    },
    searchInput: {
        flex: 1,
        marginLeft: width * 0.025,
        fontSize: width * 0.04,
        padding: width * 0.02,
    },
    searchItem: {
        flexDirection: 'row',
        padding: width * 0.04,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
    },
    searchAvatar: {
        width: width * 0.1,
        height: width * 0.1,
        borderRadius: width * 0.05,
    },
    placeholderAvatar: {
        backgroundColor: '#3b0b40',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    searchItemText: {
        marginLeft: width * 0.04,
    },
    searchItemName: {
        fontSize: width * 0.04,
        fontWeight: 'bold',
    },
    searchItemEmail: {
        fontSize: width * 0.035,
        color: '#666',
    },
    noResults: {
        textAlign: 'center',
        margin: 20,
        color: '#666',
    },
});

export default ChatScreen;