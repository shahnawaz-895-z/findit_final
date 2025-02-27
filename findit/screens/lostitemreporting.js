import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Correct import for Picker
import { Ionicons } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice';

const { width, height } = Dimensions.get('window');

const LostItemReporting = ({ navigation }) => {
  const [category, setCategory] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState({});
  const [description, setDescription] = useState('');
  const [isListening, setIsListening] = useState(false); // To manage the recording state
  const [voiceResult, setVoiceResult] = useState('');

  const categories = [
    'Electronics',
    'Bags',
    'Clothing',
    'Accessories',
    'Documents',
    'Others',
  ];

  const handleVoiceRecognition = () => {
    if (isListening) {
      Voice.stop();
      setIsListening(false);
    } else {
      Voice.start('en-US');
      setIsListening(true);
    }
  };

  const handleVoiceResults = (e) => {
    setVoiceResult(e.value[0]);
    setDescription(e.value[0]); // Optionally, update the description with voice input
  };

  useEffect(() => {
    Voice.onSpeechResults = handleVoiceResults;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

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
              placeholder="e.g., Black, Red"
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
              placeholder="e.g., Shirt, Pants"
            />
            <Text style={styles.label}>Size:</Text>
            <TextInput
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, size: text }))}
              placeholder="e.g., M, L, XL"
            />
          </>
        );
      case 'Accessories':
        return (
          <>
            <Text style={styles.label}>Accessory Type:</Text>
            <TextInput
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, accessoryType: text }))}
              placeholder="e.g., Watch, Sunglasses"
            />
          </>
        );
      case 'Documents':
        return (
          <>
            <Text style={styles.label}>Document Type:</Text>
            <TextInput
              style={styles.input}
              onChangeText={text => setAdditionalDetails(prev => ({ ...prev, documentType: text }))}
              placeholder="e.g., Passport, ID"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Lost Item Reporting</Text>

      {/* Category Picker */}
      <Text style={styles.label}>Select Category:</Text>
      <Picker
        selectedValue={category}
        onValueChange={value => setCategory(value)}
        style={styles.picker}
      >
        {categories.map((item, index) => (
          <Picker.Item label={item} value={item} key={index} />
        ))}
      </Picker>

      {/* Additional Questions */}
      {renderAdditionalQuestions()}

      {/* Description */}
      <Text style={styles.label}>Description:</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the item"
      />

      {/* Voice Input */}
      <TouchableOpacity style={styles.voiceButton} onPress={handleVoiceRecognition}>
        <Ionicons name={isListening ? 'mic-off' : 'mic'} size={40} color="#000" />
      </TouchableOpacity>

      {/* Show voice input result */}
      <Text style={styles.voiceResult}>Voice Input: {voiceResult}</Text>

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.submitButton}
        onPress={() => {
          Alert.alert('Report Submitted', 'Your lost item report has been submitted.');
        }}
      >
        <Text style={styles.submitButtonText}>Submit Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: width * 0.05,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    marginBottom: height * 0.03,
    textAlign: 'center',
  },
  label: {
    fontSize: width * 0.04,
    marginBottom: height * 0.01,
  },
  input: {
    height: height * 0.05,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: height * 0.02,
    paddingHorizontal: width * 0.02,
    fontSize: width * 0.04,
  },
  picker: {
    height: height * 0.06,
    width: '100%',
    marginBottom: height * 0.02,
  },
  voiceButton: {
    alignSelf: 'center',
    marginVertical: height * 0.02,
  },
  voiceResult: {
    fontSize: width * 0.04,
    marginBottom: height * 0.02,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#28a745',
    paddingVertical: height * 0.015,
    borderRadius: width * 0.012,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: width * 0.045,
  },
});

export default LostItemReporting;
