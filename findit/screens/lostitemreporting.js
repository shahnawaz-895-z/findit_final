import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

const LostItemReporting = ({ navigation }) => {
  const [category, setCategory] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState({});
  const [description, setDescription] = useState('');

  const categories = [
    'Electronics',
    'Bags',
    'Clothing',
    'Accessories',
    'Documents',
    'Others',
  ];

  const renderAdditionalQuestions = () => {
    switch (category) {
      case 'Electronics':
        return (
          <>
            <Text style={styles.label}>Device Type:</Text>
            <TextInput 
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, deviceType: text }))}
              placeholder="e.g., Smartphone, Laptop"
            />
            <Text style={styles.label}>Brand:</Text>
            <TextInput 
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, brand: text }))}
              placeholder="e.g., Apple, Samsung"
            />
          </>
        );
      case 'Bags':
        return (
          <>
            <Text style={styles.label}>Bag Type:</Text>
            <TextInput 
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, bagType: text }))}
              placeholder="e.g., Backpack, Handbag"
            />
            <Text style={styles.label}>Color:</Text>
            <TextInput 
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, color: text }))}
              placeholder="e.g., Black, Brown"
            />
          </>
        );
      case 'Clothing':
        return (
          <>
            <Text style={styles.label}>Clothing Type:</Text>
            <TextInput 
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, clothingType: text }))}
              placeholder="e.g., T-shirt, Jeans"
            />
            <Text style={styles.label}>Size:</Text>
            <TextInput 
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, size: text }))}
              placeholder="e.g., M, L, XL"
            />
          </>
        );
      default:
        return null;
    }
  };

  const handleSubmit = () => {
    if (!category) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }

    // Here you would typically send the data to your backend
    // For now, we'll just show an alert with the collected data
    Alert.alert(
      'Report Submitted',
      `Category: ${category}\nDescription: ${description}\nAdditional Details: ${JSON.stringify(additionalDetails)}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Report Lost Item</Text>
        <Ionicons name="alert-circle-outline" size={32} color="#4a148c" />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Category:</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={category}
            onValueChange={(itemValue) => setCategory(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select a category" value="" />
            {categories.map((item, index) => (
              <Picker.Item key={index} label={item} value={item} />
            ))}
          </Picker>
        </View>

        {category && renderAdditionalQuestions()}

        <Text style={styles.label}>Description:</Text>
        <TextInput
          style={styles.descriptionInput}
          multiline
          numberOfLines={4}
          onChangeText={setDescription}
          placeholder="Provide a detailed description of the lost item"
        />

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>SUBMIT REPORT</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4a148c',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#4a148c',
    borderRadius: 5,
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#4a148c',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4a148c',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LostItemReporting;

